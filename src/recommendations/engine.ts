import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { acceptParserOutput } from '../model/preference-query';
import { assessVenue } from '../venues/policy';
import { googleMapsUrl } from '../venues/maps';
import { venueId, venueRecordSchema, type VenueAttribute, type VenueRecord } from '../venues/schema';
import type { SharedConditions } from '../server/contracts';

const travelMode = z.enum(['walk', 'metro', 'bus', 'scooter', 'car', 'taxi']);
export const executionSlotSchema = z.strictObject({
  slotId: z.uuid(), venueId,
  opensAt: z.iso.datetime({ offset: true }), closesAt: z.iso.datetime({ offset: true }),
  durationMinutes: z.number().int().min(15).max(480),
  outdoor: z.boolean(), weatherStatus: z.enum(['not_applicable', 'verified_suitable', 'unknown', 'unsuitable']),
  areaName: z.string().trim().min(1).max(80).optional(),
  airConditioned: z.boolean().nullable().optional(),
  bookingStatus: z.enum(['not_required', 'available', 'required', 'unknown']),
  transportModes: z.array(travelMode).min(1).max(6),
  dietarySupport: z.array(z.string().min(1).max(40)).max(30),
  allergenStatus: z.enum(['verified_current', 'unknown']),
  allergensPresent: z.array(z.string().min(1).max(40)).max(30),
  accessibilitySupport: z.array(z.string().min(1).max(40)).max(30),
  minimumAge: z.number().int().min(0).max(120).nullable(),
  sourceCheckedAt: z.iso.datetime({ offset: true }), status: z.literal('verified_current'),
  sponsored: z.boolean().default(false),
});

export const travelLegSchema = z.strictObject({
  matrixVersion: z.string().min(1).max(80), fromKey: z.string().min(1).max(160),
  toKey: z.string().min(1).max(160), mode: travelMode,
  minutes: z.number().int().min(0).max(240),
});

type Query = NonNullable<Extract<ReturnType<typeof acceptParserOutput>, { status: 'parsed' }>['result']>;
type Slot = z.infer<typeof executionSlotSchema>;
type Leg = z.infer<typeof travelLegSchema>;
type Candidate = { venue: VenueRecord; slot: Slot; attributes: Map<VenueAttribute, number> };

export interface PublicItinerary {
  itinerary_id: string; session_id: string; title: string;
  data_mode: 'approved_dataset' | 'synthetic_demo'; dataset_version: string; route_matrix_version: string;
  stops: Array<{
    stop_id: string; order_no: number; venue_id: string; venue_name: string; category: string; district: string;
    execution_slot_id?: string; area_name?: string;
    arrival_at: string; leave_at: string; travel_mode: z.infer<typeof travelMode>;
    travel_minutes: number; estimated_cost: number; locked: boolean;
    booking_status: Slot['bookingStatus']; booking_url: null; google_maps_url: string; google_place_id?: string;
  }>;
  total_cost: number; total_duration_minutes: number; travel_minutes: number; couple_score: number;
  score_breakdown: { min_fit: number; mean_fit: number; context_fit: number; novelty: number; route_efficiency: number };
  public_reason: string; sponsored_content: boolean; offers: [];
  validation: { hard_constraints_passed: true; privacy_guard_passed: true; source_ids_verified: true; checked_at: string; data_freshness_note: string };
  version: number;
}

const round = (value: number) => Math.round(value * 10000) / 10000;
const normalizeList = (values: string[] | undefined) => new Set((values ?? []).map(value => value.trim().toLocaleLowerCase('zh-TW')));
const compatibleMode = (mode: Leg['mode'], allowed: SharedConditions['transport']) =>
  allowed.includes(mode === 'metro' || mode === 'bus' ? 'transit' : mode === 'scooter' ? 'bike' : mode === 'taxi' ? 'car' : mode);

export const publicItinerarySchema = z.strictObject({
  itinerary_id: z.uuid(), session_id: z.uuid(), title: z.string().min(1).max(120),
  data_mode: z.enum(['approved_dataset', 'synthetic_demo']),
  dataset_version: z.string().min(1).max(80), route_matrix_version: z.string().min(1).max(80),
  stops: z.array(z.strictObject({
    stop_id: z.uuid(), order_no: z.number().int().min(1), venue_id: venueId,
    execution_slot_id: z.uuid().optional(), area_name: z.string().min(1).max(80).optional(),
    venue_name: z.string().min(1), category: z.string().min(1), district: z.string().min(1),
    arrival_at: z.iso.datetime(), leave_at: z.iso.datetime(), travel_mode: travelMode,
    travel_minutes: z.number().int().min(0), estimated_cost: z.number().min(0),
    locked: z.boolean(), booking_status: executionSlotSchema.shape.bookingStatus, booking_url: z.null(),
    google_maps_url: z.url(), google_place_id: z.string().regex(/^[A-Za-z0-9_-]{1,300}$/).optional(),
  })).min(2).max(4),
  total_cost: z.number().min(0), total_duration_minutes: z.number().int().min(1),
  travel_minutes: z.number().int().min(0), couple_score: z.number().min(0).max(1),
  score_breakdown: z.strictObject({
    min_fit: z.number().min(0).max(1), mean_fit: z.number().min(0).max(1),
    context_fit: z.number().min(0).max(1), novelty: z.number().min(0).max(1),
    route_efficiency: z.number().min(0).max(1),
  }),
  public_reason: z.string().min(1).max(500), sponsored_content: z.boolean(), offers: z.tuple([]),
  validation: z.strictObject({
    hard_constraints_passed: z.literal(true), privacy_guard_passed: z.literal(true),
    source_ids_verified: z.literal(true), checked_at: z.iso.datetime(), data_freshness_note: z.string().min(1),
  }),
  version: z.number().int().min(1),
});

function fitValue(value: number | undefined, min?: number, max?: number) {
  if (value === undefined) return 0;
  if (min !== undefined && value < min) return min === 0 ? 1 : value / min;
  if (max !== undefined && value > max) return max === 1 ? 1 : Math.max(0, 1 - (value - max) / (1 - max));
  return 1;
}

function userFit(query: Query, candidates: Candidate[]) {
  const averages = new Map<VenueAttribute, number>();
  for (const attribute of [...new Set(candidates.flatMap(item => [...item.attributes.keys()]))]) {
    const values = candidates.map(item => item.attributes.get(attribute)).filter((value): value is number => value !== undefined);
    if (values.length === candidates.length) averages.set(attribute, values.reduce((a, b) => a + b, 0) / values.length);
  }
  let weighted = 0, weights = 0;
  for (const item of query.preferences) {
    const weight = item.importance * item.confidence;
    weighted += fitValue(averages.get(item.attribute), item.target_min, item.target_max) * weight;
    weights += weight;
  }
  for (const item of query.avoid) {
    weighted += fitValue(averages.get(item.attribute), undefined, item.target_max ?? 0) * item.importance;
    weights += item.importance;
  }
  return weights ? weighted / weights : 0.5;
}

function venueCost(venue: VenueRecord) {
  const price = venue.facts.price;
  if (price.maxTwd === null) return Number.POSITIVE_INFINITY;
  return price.basis === 'couple' ? price.maxTwd : price.maxTwd * 2;
}

function combinedHard(query: Query[], shared: SharedConditions) {
  const privateBudgets = query.flatMap(item => item.hard_constraints.absolute_budget === null ? [] : [
    item.hard_constraints.absolute_budget * (item.hard_constraints.budget_scope === 'per_person' ? 2 : 1),
  ]);
  const privateTransport = query.map(item => new Set(item.hard_constraints.transport_modes)).filter(set => set.size);
  const privateDates = query.flatMap(item => item.hard_constraints.date ? [item.hard_constraints.date] : []);
  const sharedDate = new Date(Date.parse(shared.startsAt) + 8 * 3600000).toISOString().slice(0, 10);
  const privateMeetingPoints = query.flatMap(item => item.hard_constraints.meeting_point
    ? [item.hard_constraints.meeting_point.trim().toLocaleLowerCase('zh-TW')]
    : []);
  const bookingPreferences = [...new Set(query.flatMap(item => item.hard_constraints.booking_required === null
    ? []
    : [item.hard_constraints.booking_required]))];
  const privateStarts = query.flatMap(item => item.hard_constraints.start_time
    ? [Date.parse(`${sharedDate}T${item.hard_constraints.start_time}:00+08:00`)]
    : []);
  const privateEnds = query.flatMap(item => item.hard_constraints.end_time
    ? [Date.parse(`${sharedDate}T${item.hard_constraints.end_time}:00+08:00`)]
    : []);
  const settings = [...new Set(query.flatMap(item => item.hard_constraints.environment?.setting ?? []))];
  const cooling = [...new Set(query.flatMap(item => item.hard_constraints.environment?.airConditioning ?? []))];
  return {
    setting: settings[0] ?? null,
    airConditioning: cooling[0] ?? null,
    budget: Math.min(shared.budgetTwdTotal, ...privateBudgets),
    maxWalk: Math.min(...query.map(item => item.hard_constraints.max_walk_minutes ?? Number.POSITIVE_INFINITY)),
    maxTotalTravel: Math.min(shared.maxTotalTravelMinutes ?? Number.POSITIVE_INFINITY,
      ...query.map(item => item.hard_constraints.max_total_travel_minutes ?? Number.POSITIVE_INFINITY)),
    dietary: normalizeList([...(shared.dietaryRequirements ?? []), ...query.flatMap(item => item.hard_constraints.dietary_restrictions)]),
    allergens: normalizeList(shared.allergensToAvoid),
    accessibility: normalizeList([...(shared.accessibilityRequirements ?? []), ...query.flatMap(item => item.hard_constraints.accessibility_needs)]),
    hardNo: normalizeList([...query.flatMap(item => item.hard_constraints.hard_no), ...(shared.hardNoCategories ?? [])]),
    weather: query.some(item => item.hard_constraints.weather_required && item.hard_constraints.weather_required !== 'any'),
    outdoorAllowed: shared.outdoorAllowed && !query.some(item => item.hard_constraints.outdoor_allowed === false),
    bookingRequired: bookingPreferences.length === 1 ? bookingPreferences[0] : null,
    start: Math.max(Date.parse(shared.startsAt), ...privateStarts),
    end: Math.min(Date.parse(shared.endsAt), ...privateEnds),
    incompatible: bookingPreferences.length > 1 || settings.length > 1 || cooling.length > 1
      || privateDates.some(date => date !== sharedDate)
      || privateMeetingPoints.some(point => point !== shared.meetingPoint.label.trim().toLocaleLowerCase('zh-TW')),
    privateTransport,
  };
}

function candidateAllowed(candidate: Candidate, shared: SharedConditions, hard: ReturnType<typeof combinedHard>, queries: Query[]) {
  const { venue, slot } = candidate;
  if (hard.hardNo.has(venue.category) || hard.hardNo.has(venue.venueId.toLocaleLowerCase('zh-TW'))) return false;
  if (!hard.outdoorAllowed && slot.outdoor) return false;
  if (hard.setting === 'outdoor' && !slot.outdoor) return false;
  if (hard.setting === 'indoor' && slot.outdoor) return false;
  if (hard.airConditioning === 'required' && slot.airConditioned !== true) return false;
  if (hard.airConditioning === 'excluded' && slot.airConditioned !== false) return false;
  if (slot.outdoor && slot.weatherStatus !== 'verified_suitable') return false;
  if (hard.weather && slot.weatherStatus !== 'verified_suitable') return false;
  if (slot.bookingStatus === 'unknown') return false;
  if ((!shared.bookingAllowed || hard.bookingRequired === false) && slot.bookingStatus !== 'not_required') return false;
  if (hard.bookingRequired === true && slot.bookingStatus === 'not_required') return false;
  if (shared.participantMinAge !== undefined && slot.minimumAge !== null && shared.participantMinAge < slot.minimumAge) return false;
  const supports = normalizeList(slot.dietarySupport), access = normalizeList(slot.accessibilitySupport);
  if ([...hard.dietary].some(item => !supports.has(item))) return false;
  if ([...hard.accessibility].some(item => !access.has(item))) return false;
  if (hard.allergens.size && slot.allergenStatus !== 'verified_current') return false;
  if ([...normalizeList(slot.allergensPresent)].some(item => hard.allergens.has(item))) return false;
  return !queries.some(query => query.avoid.some(item => item.hard
    && fitValue(candidate.attributes.get(item.attribute), undefined, item.target_max ?? 0) < 1));
}

function signature(itinerary: PublicItinerary) {
  const categories = [...new Set(itinerary.stops.map(stop => stop.category))].sort().join('|');
  const districts = [...new Set(itinerary.stops.map(stop => stop.district))].sort().join('|');
  const budget = itinerary.total_cost <= 800 ? 'low' : itinerary.total_cost <= 1800 ? 'mid' : 'high';
  const density = itinerary.travel_minutes / itinerary.total_duration_minutes < 0.15 ? 'low' : itinerary.travel_minutes / itinerary.total_duration_minutes < 0.3 ? 'mid' : 'high';
  return { categories, districts, budget, density };
}

export function materiallyDifferent(a: PublicItinerary, b: PublicItinerary) {
  const aIds = new Set(a.stops.map(stop => stop.venue_id));
  const overlap = b.stops.filter(stop => aIds.has(stop.venue_id)).length / Math.max(a.stops.length, b.stops.length);
  const sa = signature(a), sb = signature(b);
  const differences = (Object.keys(sa) as Array<keyof typeof sa>).filter(key => sa[key] !== sb[key]).length;
  return overlap <= 0.5 && differences >= 2;
}

export function composeItineraries(input: {
  sessionId: string; version: number; shared: SharedConditions; parserOutputs: unknown[];
  venues: Array<{ record: unknown; execution: unknown }>; legs: unknown[]; now?: Date;
  dataMode?: 'approved_dataset' | 'synthetic_demo'; datasetVersion?: string; routeMatrixVersion?: string;
  requiredVenueIds?: string[]; excludedVenueIds?: string[]; resultLimit?: 1 | 3;
  itineraryId?: string; lockedStopIdsByVenue?: Record<string, string>;
  lockedOrderByVenue?: Record<string, number>;
  lockedSlotIdsByVenue?: Record<string, string>;
}): PublicItinerary[] {
  const envelopes = input.parserOutputs.map(acceptParserOutput);
  if (envelopes.length !== 2 || envelopes.some(item => item.status !== 'parsed')) return [];
  const queries = envelopes.map(item => item.status === 'parsed' ? item.result : null).filter((item): item is Query => !!item);
  if (queries.some(query => query.session_id !== input.sessionId || query.mode !== input.shared.mode)) return [];
  const hard = combinedHard(queries, input.shared);
  if (hard.incompatible || hard.end <= hard.start) return [];
  const required = new Set(input.requiredVenueIds ?? []), excluded = new Set(input.excludedVenueIds ?? []);
  const resultLimit = input.resultLimit ?? 3;
  if (required.size > input.shared.stops || [...required].some(id => excluded.has(id))) return [];
  if (input.itineraryId && (resultLimit !== 1 || !z.uuid().safeParse(input.itineraryId).success)) return [];
  const candidates: Candidate[] = [];
  for (const row of input.venues) {
    const record = venueRecordSchema.safeParse(row.record), slot = executionSlotSchema.safeParse(row.execution);
    if (!record.success || !slot.success || record.data.venueId !== slot.data.venueId) continue;
    const lockedSlot = input.lockedSlotIdsByVenue?.[record.data.venueId];
    if (lockedSlot && lockedSlot !== slot.data.slotId) continue;
    const assessment = assessVenue(record.data);
    if (!assessment.itineraryEligible) continue;
    const attributes = new Map(assessment.approvedAttributes.map(item => [item.attribute, item.value!]));
    const candidate = { venue: record.data, slot: slot.data, attributes };
    if (!excluded.has(record.data.venueId) && candidateAllowed(candidate, input.shared, hard, queries)) candidates.push(candidate);
  }
  const legs = input.legs.map(item => travelLegSchema.safeParse(item)).filter(item => item.success).map(item => item.data);
  const meetingKey = input.shared.meetingPoint.matrixKey
    ?? (input.dataMode === 'approved_dataset' ? 'meeting_user' : undefined);
  if (!meetingKey || candidates.length < input.shared.stops) return [];
  const start = hard.start, end = hard.end;
  const options: PublicItinerary[] = [];
  const route = (from: string, to: string) => legs
    .filter(leg => leg.fromKey === from && leg.toKey === to && compatibleMode(leg.mode, input.shared.transport)
      && hard.privateTransport.every(modes => modes.has(leg.mode)))
    .sort((a, b) => a.minutes - b.minutes)[0];

  const visit = (chosen: Candidate[], stops: PublicItinerary['stops'], from: string, current: number, cost: number, travel: number) => {
    if (chosen.length === input.shared.stops) {
      if ([...required].some(id => !chosen.some(item => item.venue.venueId === id))) return;
      if (cost > hard.budget || travel > hard.maxTotalTravel) return;
      const fitA = userFit(queries[0], chosen), fitB = userFit(queries[1], chosen);
      const duration = Math.round((current - start) / 60000);
      const novelty = new Set(chosen.map(item => item.venue.category)).size / chosen.length;
      const efficiency = Math.max(0, 1 - travel / Math.max(1, duration));
      const minFit = Math.min(fitA, fitB), meanFit = (fitA + fitB) / 2, contextFit = 1;
      const score = .45 * minFit + .25 * meanFit + .15 * contextFit + .10 * novelty + .05 * efficiency;
      const categories = [...new Set(chosen.map(item => item.venue.category))];
      options.push({
        itinerary_id: input.itineraryId ?? randomUUID(), session_id: input.sessionId,
        title: `${categories.slice(0, 2).join('＋')}約會`, stops,
        data_mode: input.dataMode ?? 'synthetic_demo',
        dataset_version: input.datasetVersion ?? 'synthetic-test',
        route_matrix_version: input.routeMatrixVersion ?? 'synthetic-test',
        total_cost: cost, total_duration_minutes: duration, travel_minutes: travel, couple_score: round(score),
        score_breakdown: { min_fit: round(minFit), mean_fit: round(meanFit), context_fit: 1, novelty: round(novelty), route_efficiency: round(efficiency) },
        public_reason: `符合共同時間與預算，安排 ${categories.join('、')}，並控制移動時間。`,
        sponsored_content: chosen.some(item => item.slot.sponsored), offers: [],
        validation: { hard_constraints_passed: true, privacy_guard_passed: true, source_ids_verified: true,
          checked_at: (input.now ?? new Date()).toISOString(), data_freshness_note: input.dataMode === 'approved_dataset'
            ? '使用核准資料集與作用中交通矩陣產生。'
            : '使用明確標示的合成展示資料與合成交通矩陣產生；不是現實世界推薦。' },
        version: input.version,
      });
      return;
    }
    for (const candidate of candidates) {
      if (chosen.some(item => item.venue.venueId === candidate.venue.venueId)) continue;
      const orderNo = chosen.length + 1;
      const requiredAtOrder = [...required].find(id => input.lockedOrderByVenue?.[id] === orderNo);
      if (requiredAtOrder && requiredAtOrder !== candidate.venue.venueId) continue;
      const lockedOrder = input.lockedOrderByVenue?.[candidate.venue.venueId];
      if (lockedOrder !== undefined && lockedOrder !== orderNo) continue;
      const leg = route(from, candidate.venue.venueId);
      if (!leg || !candidate.slot.transportModes.includes(leg.mode)) continue;
      if (input.shared.maxLegTravelMinutes !== undefined && leg.minutes > input.shared.maxLegTravelMinutes) continue;
      if (leg.mode === 'walk' && leg.minutes > hard.maxWalk) continue;
      const arrival = Math.max(current + leg.minutes * 60000, Date.parse(candidate.slot.opensAt));
      const leave = arrival + candidate.slot.durationMinutes * 60000;
      if (arrival < start || leave > end || leave > Date.parse(candidate.slot.closesAt)) continue;
      const nextCost = cost + venueCost(candidate.venue);
      if (nextCost > hard.budget) continue;
      visit([...chosen, candidate], [...stops, {
        stop_id: input.lockedStopIdsByVenue?.[candidate.venue.venueId] ?? randomUUID(), order_no: orderNo, venue_id: candidate.venue.venueId,
        venue_name: candidate.venue.name, category: candidate.venue.category, district: candidate.venue.location.district,
        execution_slot_id: candidate.slot.slotId,
        area_name: candidate.slot.areaName ?? (candidate.slot.outdoor ? '戶外區' : '室內區'),
        arrival_at: new Date(arrival).toISOString(), leave_at: new Date(leave).toISOString(),
        travel_mode: leg.mode, travel_minutes: leg.minutes, estimated_cost: venueCost(candidate.venue),
        locked: required.has(candidate.venue.venueId), booking_status: candidate.slot.bookingStatus, booking_url: null,
        google_maps_url: googleMapsUrl(candidate.venue.name, candidate.venue.google_place_id),
        ...(candidate.venue.google_place_id ? { google_place_id: candidate.venue.google_place_id } : {}),
      }], candidate.venue.venueId, leave, nextCost, travel + leg.minutes);
    }
  };
  visit([], [], meetingKey, start, 0, 0);
  const selected: PublicItinerary[] = [];
  for (const option of options.sort((a, b) => b.couple_score - a.couple_score)) {
    if (selected.every(existing => materiallyDifferent(existing, option))) selected.push(option);
    if (selected.length === resultLimit) break;
  }
  return selected.map(item => publicItinerarySchema.parse(item));
}
