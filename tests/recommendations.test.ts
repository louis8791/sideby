import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parseWithRuleBaseline } from '../src/model/preference-query';
import { applyBrightPreferenceDelta } from '../src/model/preference-learning';
import { composeItineraries, materiallyDifferent, publicItinerarySchema } from '../src/recommendations/engine';
import {
  recommendationLegs, recommendationParserOutputs, recommendationSessionId as sessionId,
  recommendationShared as shared, recommendationSlot, recommendationVenues,
} from './recommendation-fixtures';

const parserOutputs = recommendationParserOutputs();
const venues = recommendationVenues();
const legs = recommendationLegs();

test('each stop meets both private area and cooling constraints; unknown cooling fails closed', () => {
  const withEnvironment = (label: string, partner = '放鬆') => [label, partner].map(rawText =>
    parseWithRuleBaseline({ sessionId, mode: 'future', visibility: 'private_session', rawText }));
  const compose = (label: string, rows: typeof venues, partner = '放鬆', outdoorAllowed = true) => composeItineraries({
    sessionId, version: 3, shared: { ...shared, outdoorAllowed }, parserOutputs: withEnvironment(label, partner), venues: rows, legs,
  });
  const cooled = venues.map(row => ({ ...row, execution: { ...row.execution, airConditioned: true } }));
  const uncooled = venues.map(row => ({ ...row, execution: { ...row.execution, airConditioned: false } }));
  const outdoor = uncooled.map(row => ({ ...row, execution: {
    ...row.execution, outdoor: true, areaName: '戶外露臺', weatherStatus: 'verified_suitable',
  } }));
  assert.equal(compose('室內、冷氣', cooled).length, 3);
  assert.equal(compose('室內、無冷氣', uncooled).length, 3);
  assert.equal(compose('戶外、無冷氣', outdoor).length, 3);
  assert.equal(compose('戶外、冷氣', outdoor.map(row => ({ ...row, execution: {
    ...row.execution, airConditioned: true,
  } }))).length, 3);
  assert.deepEqual(compose('無冷氣', venues.map(row => ({ ...row, execution: {
    ...row.execution, airConditioned: null,
  } }))), []);
  assert.deepEqual(compose('冷氣', venues), []);
  assert.deepEqual(compose('無冷氣', venues), []);
  assert.deepEqual(compose('冷氣', uncooled), []);
  assert.deepEqual(compose('無冷氣', cooled), []);
  assert.deepEqual(compose('室內', outdoor), []);
  assert.deepEqual(compose('戶外', cooled), []);
  assert.deepEqual(compose('戶外', outdoor, '放鬆', false), []);
  assert.deepEqual(compose('室內', cooled, '戶外'), []);
  assert.deepEqual(compose('冷氣', cooled, '無冷氣'), []);
  assert.deepEqual(compose('戶外', outdoor.map(row => ({ ...row, execution: {
    ...row.execution, weatherStatus: 'not_applicable',
  } }))), []);
  // A cafe's indoor cooling must not qualify its outdoor terrace.
  const mixed = [...cooled, ...outdoor.map((row, index) => ({ ...row, execution: {
    ...row.execution, slotId: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  } }))];
  assert.deepEqual(compose('戶外、冷氣', mixed), []);
  const terracePlans = compose('戶外、無冷氣', mixed);
  assert.equal(terracePlans.length, 3);
  assert.ok(terracePlans.every(plan => plan.stops.every(stop => stop.area_name === '戶外露臺'
    && stop.execution_slot_id?.startsWith('10000000-'))));
  const oldEnvelopes = structuredClone(parserOutputs);
  for (const envelope of oldEnvelopes) if (envelope.status === 'parsed') delete envelope.result.hard_constraints.environment;
  assert.equal(composeItineraries({ sessionId, version: 3, shared, parserOutputs: oldEnvelopes, venues, legs }).length, 3);
});

test('locked execution areas survive replan and are not replaced by another area in the same venue', () => {
  const original = composeItineraries({ sessionId, version: 3, shared, parserOutputs, venues, legs })[0];
  const locked = original.stops[0];
  const inputs = { sessionId, version: 3, shared, parserOutputs, venues, legs,
    requiredVenueIds: [locked.venue_id], excludedVenueIds: [original.stops[1].venue_id], resultLimit: 1 as const,
    lockedStopIdsByVenue: { [locked.venue_id]: locked.stop_id },
    lockedOrderByVenue: { [locked.venue_id]: locked.order_no },
    lockedSlotIdsByVenue: { [locked.venue_id]: locked.execution_slot_id! },
  };
  const result = composeItineraries(inputs);
  assert.equal(result.length, 1);
  assert.equal(result[0].stops[0].execution_slot_id, locked.execution_slot_id);
  assert.deepEqual(composeItineraries({ ...inputs, venues: venues.map(row => row.record.venueId === locked.venue_id
    ? { ...row, execution: { ...row.execution, slotId: '10000000-0000-4000-8000-000000000001' } } : row) }), []);
});

test('composer returns three schema-valid, diverse and hard-valid itineraries', () => {
  const result = composeItineraries({ sessionId, version: 3, shared, parserOutputs, venues, legs, now: new Date('2026-09-05T02:00:00Z') });
  assert.equal(result.length, 3);
  for (const itinerary of result) {
    assert.equal(publicItinerarySchema.safeParse(itinerary).success, true);
    assert.equal(itinerary.stops.length, 2);
    assert.ok(itinerary.total_cost <= shared.budgetTwdTotal);
    assert.ok(itinerary.travel_minutes <= shared.maxTotalTravelMinutes!);
    assert.ok(!itinerary.stops.some(stop => stop.venue_id === 'venue_test_8'));
    assert.match(itinerary.public_reason, /^符合共同時間與預算/);
  }
  for (let i = 0; i < result.length; i++) for (let j = i + 1; j < result.length; j++) {
    assert.equal(materiallyDifferent(result[i], result[j]), true);
  }
});

test('sponsorship never changes CoupleScore', () => {
  const plain = composeItineraries({ sessionId, version: 3, shared, parserOutputs, venues, legs });
  const sponsored = composeItineraries({
    sessionId, version: 3, shared, parserOutputs,
    venues: venues.map((item, index) => ({ ...item, execution: recommendationSlot(index + 1, true) })), legs,
  });
  assert.deepEqual(plain.map(item => item.couple_score), sponsored.map(item => item.couple_score));
  assert.ok(sponsored.every(item => item.sponsored_content));
});

test('Google detail enrichment requires an explicit Place ID from the venue record', () => {
  const synthetic = composeItineraries({ sessionId, version: 3, shared, parserOutputs, venues, legs });
  assert.ok(synthetic.every(item => item.stops.every(stop => stop.google_place_id === undefined)));

  const identifiedVenues = venues.map((item, index) => ({
    ...item,
    record: { ...item.record, google_place_id: `place_${index + 1}` },
  }));
  const identified = composeItineraries({
    sessionId, version: 3, shared, parserOutputs, venues: identifiedVenues, legs,
  });
  assert.ok(identified.every(item => item.stops.every(stop =>
    stop.google_place_id === `place_${Number(stop.venue_id.replace('venue_test_', ''))}`)));
});

test('missing routes, unresolved input and impossible budget fail closed', () => {
  assert.deepEqual(composeItineraries({ sessionId, version: 3, shared, parserOutputs, venues, legs: [] }), []);
  assert.deepEqual(composeItineraries({ sessionId, version: 3, shared: { ...shared, budgetTwdTotal: 1 }, parserOutputs, venues, legs }), []);
  assert.deepEqual(composeItineraries({ sessionId, version: 3, shared, parserOutputs: [parserOutputs[0]], venues, legs }), []);
  const privateBudget = [
    parseWithRuleBaseline({ sessionId, mode: 'future', visibility: 'private_session', rawText: '每人最多 50 元。' }),
    parserOutputs[1],
  ];
  assert.deepEqual(composeItineraries({ sessionId, version: 3, shared, parserOutputs: privateBudget, venues, legs }), []);
});

test('private hard constraints, padded allergens and unknown price basis fail closed', () => {
  const withHard = (values: Record<string, unknown>) => {
    const result = structuredClone(parserOutputs) as Array<{ result: { hard_constraints: Record<string, unknown> } }>;
    Object.assign(result[0].result.hard_constraints, values);
    return result;
  };
  const outdoor = venues.map(item => ({ ...item, execution: { ...item.execution, outdoor: true, weatherStatus: 'verified_suitable' } }));
  assert.deepEqual(composeItineraries({ sessionId, version: 3, shared: { ...shared, outdoorAllowed: true },
    parserOutputs: withHard({ outdoor_allowed: false }), venues: outdoor, legs }), []);
  assert.deepEqual(composeItineraries({ sessionId, version: 3, shared: { ...shared, bookingAllowed: true },
    parserOutputs: withHard({ booking_required: true }), venues, legs }), []);
  assert.deepEqual(composeItineraries({ sessionId, version: 3, shared,
    parserOutputs: withHard({ date: '2026-10-11' }), venues, legs }), []);
  const paddedAllergen = venues.map(item => ({ ...item, execution: { ...item.execution, allergensPresent: [' peanut '] } }));
  assert.deepEqual(composeItineraries({ sessionId, version: 3, shared, parserOutputs, venues: paddedAllergen, legs }), []);
  const unknownBasis = venues.map(item => ({ ...item, record: { ...item.record,
    facts: { ...item.record.facts, price: { ...item.record.facts.price, basis: 'unknown' } } } }));
  assert.deepEqual(composeItineraries({ sessionId, version: 3, shared, parserOutputs, venues: unknownBasis, legs }), []);
});

test('replan preserves locked stops, excludes rejected venues and fails closed when no route remains', () => {
  const original = composeItineraries({ sessionId, version: 3, shared, parserOutputs, venues, legs })[0];
  const locked = original.stops[0];
  const rejected = original.stops[1];
  const replanned = composeItineraries({
    sessionId, version: 3, shared, parserOutputs, venues, legs,
    requiredVenueIds: [locked.venue_id], excludedVenueIds: [rejected.venue_id], resultLimit: 1,
    itineraryId: original.itinerary_id, lockedStopIdsByVenue: { [locked.venue_id]: locked.stop_id },
    lockedOrderByVenue: { [locked.venue_id]: locked.order_no },
  });
  assert.equal(replanned.length, 1);
  assert.equal(replanned[0].itinerary_id, original.itinerary_id);
  assert.ok(replanned[0].stops.some(stop => stop.stop_id === locked.stop_id
    && stop.venue_id === locked.venue_id && stop.order_no === locked.order_no && stop.locked));
  assert.ok(!replanned[0].stops.some(stop => stop.venue_id === rejected.venue_id));
  assert.equal(replanned[0].validation.hard_constraints_passed, true);
  assert.ok(replanned[0].total_cost <= shared.budgetTwdTotal);
  assert.ok(replanned[0].travel_minutes <= shared.maxTotalTravelMinutes!);

  const otherVenues = venues.map(item => item.record.venueId).filter(id => id !== locked.venue_id);
  assert.deepEqual(composeItineraries({
    sessionId, version: 3, shared, parserOutputs, venues, legs,
    requiredVenueIds: [locked.venue_id], excludedVenueIds: otherVenues, resultLimit: 1,
    itineraryId: original.itinerary_id, lockedStopIdsByVenue: { [locked.venue_id]: locked.stop_id },
    lockedOrderByVenue: { [locked.venue_id]: locked.order_no },
  }), []);
});

test('too-dark feedback changes only the reporting user projection and can change ranking', () => {
  const untouchedB = structuredClone(parserOutputs[1]);
  const learnedA = applyBrightPreferenceDelta(parserOutputs[0], 0.3);
  assert.deepEqual(parserOutputs[1], untouchedB);
  const learned = composeItineraries({ sessionId, version: 3, shared,
    parserOutputs: [learnedA, parserOutputs[1]], venues, legs });
  const baseline = composeItineraries({ sessionId, version: 3, shared, parserOutputs, venues, legs });
  assert.equal(learned.length, 3);
  assert.notDeepEqual(learned.map(item => item.stops.map(stop => stop.venue_id)),
    baseline.map(item => item.stops.map(stop => stop.venue_id)));
});

test('public JSON Schema requires every runtime public field', async () => {
  const schema = JSON.parse(await readFile('schemas/itinerary.schema.json', 'utf8'));
  for (const field of ['data_mode', 'dataset_version', 'route_matrix_version', 'score_breakdown', 'offers', 'validation', 'version']) {
    assert.ok(schema.required.includes(field));
  }
  for (const field of ['district', 'booking_url', 'google_maps_url']) assert.ok(schema.$defs.stop.required.includes(field));
  assert.ok(schema.$defs.validation.required.includes('data_freshness_note'));
  assert.equal(schema.properties.offers.maxItems, 0);
});
