import { parseWithRuleBaseline } from '../src/model/preference-query';
import type { SharedConditions } from '../src/server/contracts';

export const recommendationSessionId = '10000000-0000-4000-8000-000000000001';
const categories = ['cafe', 'exhibition', 'park', 'workshop', 'restaurant', 'entertainment', 'cultural', 'market'] as const;

export function recommendationRecord(index: number) {
  const evidenceId = `evidence_test_${index}`;
  return {
    schemaVersion: '1.0', datasetVersion: 'test-v1', dataOwner: 'Sideby synthetic test',
    venueId: `venue_test_${index}`, name: `合成場地 ${index}`, category: categories[index - 1],
    location: { address: `合成地址 ${index}`, district: `測試區${index}`, latitude: 25.04, longitude: 121.52 },
    facts: {
      description: '只供測試，不是真實推薦資料。', phone: null, website: null,
      price: { status: 'verified_current', minTwd: index * 40, maxTwd: index * 50, basis: 'couple', evidenceRefs: [evidenceId] },
      openingHours: { status: 'verified_current', rawText: '測試時段', evidenceRefs: [evidenceId] },
      facilities: ['vegan', 'wheelchair'],
    },
    sources: [{
      evidenceId, sourceType: 'team_observation', sourceName: 'Sideby synthetic test',
      sourceUrl: null, sourceRecordId: `synthetic-${index}`, checkedAt: '2026-09-05T01:00:00Z',
      observedAt: '2026-09-05T01:00:00Z', licenseName: null, licenseUrl: null,
      rightsStatus: 'owned', allowInRag: true, evidenceSummary: 'Synthetic behavior-test evidence only.',
    }],
    attributes: [
      ['bright', 0.55 + index * 0.04], ['quiet', 0.9 - index * 0.04],
      ['cute', 0.45 + index * 0.03], ['childish', 0.1], ['walking', 0.15],
    ].map(([attribute, value]) => ({
      attribute, value, scaleVersion: 'test-v1', evidenceQuality: 'high', uncertainty: null,
      scope: 'general', context: null, status: 'approved', evidenceRefs: [evidenceId],
      reviewedBy: 'test-reviewer', reviewedAt: '2026-09-05T01:00:00Z',
    })),
    review: { status: 'approved', reviewedBy: 'test-reviewer', reviewedAt: '2026-09-05T01:00:00Z' },
  };
}

export function recommendationSlot(index: number, sponsored = false) {
  return {
    slotId: `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    venueId: `venue_test_${index}`, opensAt: '2026-10-10T02:00:00Z', closesAt: '2026-10-10T12:00:00Z',
    durationMinutes: 45, outdoor: false, weatherStatus: 'not_applicable', bookingStatus: 'not_required',
    transportModes: ['metro'], dietarySupport: ['vegan'], allergenStatus: 'verified_current',
    allergensPresent: index === 8 ? ['peanut'] : [], accessibilitySupport: ['wheelchair'], minimumAge: null,
    sourceCheckedAt: '2026-09-05T01:00:00Z', status: 'verified_current', sponsored,
  };
}

export const recommendationShared: SharedConditions = {
  mode: 'future', startsAt: '2026-10-10T10:00:00+08:00', endsAt: '2026-10-10T20:00:00+08:00',
  meetingPoint: { label: '合成集合點', latitude: 25.04, longitude: 121.52, matrixKey: 'meeting_test' },
  budgetTwdTotal: 1600, transport: ['transit'], stops: 2, outdoorAllowed: false, bookingAllowed: false,
  maxLegTravelMinutes: 30, maxTotalTravelMinutes: 60,
  dietaryRequirements: ['vegan'], allergensToAvoid: ['peanut'], accessibilityRequirements: ['wheelchair'],
};

export const recommendationParserOutputs = (sessionId = recommendationSessionId) => [
  parseWithRuleBaseline({ sessionId, mode: 'future', visibility: 'private_session', rawText: '希望明亮。' }),
  parseWithRuleBaseline({ sessionId, mode: 'future', visibility: 'private_session', rawText: '想安靜聊天。' }),
];

export const recommendationVenues = () => Array.from({ length: 8 }, (_, index) => ({
  record: recommendationRecord(index + 1), execution: recommendationSlot(index + 1),
}));

export const recommendationLegs = () => [
  ...Array.from({ length: 8 }, (_, index) => ({ matrixVersion: 'matrix-v1', fromKey: 'meeting_test', toKey: `venue_test_${index + 1}`, mode: 'metro', minutes: 5 + index })),
  ...Array.from({ length: 8 }, (_, from) => Array.from({ length: 8 }, (_, to) => ({
    matrixVersion: 'matrix-v1', fromKey: `venue_test_${from + 1}`, toKey: `venue_test_${to + 1}`,
    mode: 'metro', minutes: 6 + Math.abs(from - to),
  }))).flat(),
];
