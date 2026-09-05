import { assessVenue } from './policy';
import { venueRecordSchema, type VenueRecord } from './schema';

export type VenueQualification = {
  venueId: string; name: string; sourceVersion: string; placeIdMatched: boolean;
  status: 'eligible' | 'eligible_with_unknowns' | 'needs_evidence' | 'rejected'; missing: string[];
  knownAttributes: string[]; unknownAttributes: string[];
};

/** Admission text is a proposed value until a reviewed record supplies exact applicability. */
export function explicitAdmissionPrice(text: string | null | undefined): number | null {
  if (!text) return null;
  const normalized = text.normalize('NFKC').trim();
  if (/^(?:免費|免費入場|免費參觀)[。\s]*$/u.test(normalized)) return 0;
  const ticket = normalized.match(/^(?:門票|入場費)[:：\s]*(?:NT\$?|新臺幣)?\s*(\d{1,5})\s*元(?:\s*\/\s*人)?[。\s]*$/u);
  return ticket ? Number(ticket[1]) : null;
}

export function qualifyVenue(input: unknown, executionCount = 0): VenueQualification {
  const parsed = venueRecordSchema.safeParse(input);
  if (!parsed.success) return { venueId: 'invalid', name: 'invalid', sourceVersion: 'invalid',
    placeIdMatched: false, status: 'rejected', missing: ['invalid_schema'], knownAttributes: [], unknownAttributes: [] };
  const record = parsed.data, assessment = assessVenue(record);
  const missing: string[] = [];
  if (!assessment.valid) missing.push('policy_rejected');
  if (record.review.status !== 'approved') missing.push('review');
  if (record.facts.price.status !== 'verified_current') missing.push('verified_price');
  if (record.facts.openingHours.status !== 'verified_current') missing.push('verified_hours');
  if (!executionCount) missing.push('execution_area_and_schedule');
  if (record.location.address.includes('未提供街道地址')) missing.push('street_address');
  const blocking = missing.some(reason => ['policy_rejected', 'review', 'execution_area_and_schedule'].includes(reason));
  return {
    venueId: record.venueId, name: record.name, sourceVersion: record.datasetVersion,
    placeIdMatched: Boolean(record.google_place_id),
    status: !assessment.valid ? 'rejected' : blocking ? 'needs_evidence' : missing.length ? 'eligible_with_unknowns' : 'eligible', missing,
    knownAttributes: assessment.approvedAttributes.map(item => item.attribute),
    unknownAttributes: assessment.unknownAttributes,
  };
}

export function qualificationSummary(records: VenueRecord[]) {
  const items = records.map(record => ({ ...qualifyVenue(record),
    proposedAdmissionTwd: explicitAdmissionPrice(record.facts.admissionText),
    hasSourceHours: Boolean(record.facts.openingHours.rawText),
  }));
  const missingCounts: Record<string, number> = {};
  for (const item of items) for (const reason of item.missing) missingCounts[reason] = (missingCounts[reason] ?? 0) + 1;
  return { total: items.length, eligible: items.filter(item => item.status === 'eligible').length,
    eligibleWithUnknowns: items.filter(item => item.status === 'eligible_with_unknowns').length,
    sourceHours: items.filter(item => item.hasSourceHours).length,
    explicitAdmission: items.filter(item => item.proposedAdmissionTwd !== null).length,
    missingCounts, items };
}
