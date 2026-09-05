import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { importGovernmentRow } from '../src/venues/government-import';
import { assessVenue } from '../src/venues/policy';
import { googleMapsUrl } from '../src/venues/maps';
import type { VenueRecord } from '../src/venues/schema';
import { venueRecordSchema } from '../src/venues/schema';

const governmentRow = {
  datasetVersion: 'test-1', datasetName: '政府開放資料測試', datasetUrl: 'https://example.gov.tw/data/1',
  dataOwner: 'test-owner', licenseName: '測試開放授權', licenseUrl: 'https://example.gov.tw/license/1',
  recordId: 'test-001', name: '合成場地', address: '臺北市中山區測試路1號', district: '中山區',
  latitude: 25.05, longitude: 121.52, category: 'cafe' as const, description: '合成介紹', phone: null,
  website: null, openingHours: '10:00–18:00', checkedAt: '2026-09-05T10:00:00+08:00',
  licenseVerified: true, descriptionReuseAllowed: true,
};

function approvedVenue(): VenueRecord {
  const venue = importGovernmentRow(governmentRow);
  const governmentEvidence = venue.sources[0].evidenceId;
  venue.sources.push({
    evidenceId: 'evidence_team_1', sourceType: 'team_observation', sourceName: '團隊實地觀察', sourceUrl: null,
    sourceRecordId: null, checkedAt: '2026-09-05T12:00:00+08:00', observedAt: '2026-09-05T11:00:00+08:00',
    licenseName: null, licenseUrl: null,
    rightsStatus: 'owned', allowInRag: true, evidenceSummary: '平日下午窗邊座位採光觀察。',
  });
  venue.sources.push({
    evidenceId: 'evidence_user_1', sourceType: 'consented_feedback', sourceName: '已同意的測試回饋', sourceUrl: null,
    sourceRecordId: 'consent_test_1', checkedAt: '2026-09-05T12:00:00+08:00', observedAt: '2026-09-05T11:00:00+08:00',
    licenseName: null, licenseUrl: null,
    rightsStatus: 'permission_recorded', allowInRag: false, evidenceSummary: '我覺得太吵。',
  });
  venue.facts.price = { status: 'verified_current', minTwd: 200, maxTwd: 350, basis: 'person', evidenceRefs: [governmentEvidence] };
  venue.facts.openingHours.status = 'verified_current';
  venue.attributes = [
    { attribute: 'bright', value: 0.8, scaleVersion: 'atmosphere-v1', evidenceQuality: 'medium', uncertainty: '只觀察平日下午窗邊座位', scope: 'contextual', context: { timeOfDay: 'afternoon', dayType: 'weekday', area: '窗邊座位' }, status: 'approved', evidenceRefs: ['evidence_team_1'], reviewedBy: 'reviewer', reviewedAt: '2026-09-05T12:00:00+08:00' },
    { attribute: 'quiet', value: 0.2, scaleVersion: 'atmosphere-v1', evidenceQuality: 'low', uncertainty: '單一使用者感受', scope: 'personal', context: null, status: 'approved', evidenceRefs: ['evidence_user_1'], reviewedBy: 'reviewer', reviewedAt: '2026-09-05T12:00:00+08:00' },
  ];
  venue.review = { status: 'approved', reviewedBy: 'reviewer', reviewedAt: '2026-09-05T12:00:00+08:00' };
  return venue;
}

test('government import creates only a draft skeleton and infers no atmosphere labels', () => {
  const venue = importGovernmentRow(governmentRow);
  assert.equal(venue.review.status, 'draft');
  assert.equal(venue.facts.openingHours.status, 'source_reported');
  assert.equal(venue.facts.price.status, 'unknown');
  assert.deepEqual(venue.attributes, []);
  assert.equal(assessVenue(venue).itineraryEligible, false);

  const first = importGovernmentRow({ ...governmentRow, recordId: '中文編號' });
  const second = importGovernmentRow({ ...governmentRow, recordId: '中文編號', datasetUrl: 'https://example.gov.tw/data/2' });
  assert.match(first.venueId, /^venue_gov_record_[a-f0-9]{12}$/);
  assert.notEqual(first.venueId, second.venueId);
});

test('only reviewed non-personal observations become shared recommendation attributes', () => {
  const result = assessVenue(approvedVenue());
  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.equal(result.itineraryEligible, true);
  assert.deepEqual(result.approvedAttributes.map(item => item.attribute), ['bright']);
  assert.ok(result.unknownAttributes.includes('quiet'));
  assert.match(result.ragDocument ?? '', /bright=0.8/);
  assert.match(result.ragDocument ?? '', /weekday\/afternoon\/窗邊座位/);
  assert.doesNotMatch(result.ragDocument ?? '', /我覺得太吵|quiet=0.2/);
});

test('the shared gate rejects Google-derived sources and unlicensed RAG content', () => {
  const google = approvedVenue();
  google.sources[0].sourceUrl = 'https://maps.google.com/example';
  const googleResult = assessVenue(google);
  assert.equal(googleResult.valid, false);
  assert.deepEqual(googleResult.approvedAttributes, []);
  assert.equal(googleResult.ragDocument, null);

  const unlicensed = approvedVenue();
  unlicensed.sources[0].rightsStatus = 'reference_only';
  unlicensed.sources[0].allowInRag = true;
  assert.equal(assessVenue(unlicensed).valid, false);

  const missingConsent = approvedVenue();
  missingConsent.sources.find(source => source.sourceType === 'consented_feedback')!.sourceRecordId = null;
  assert.equal(assessVenue(missingConsent).valid, false);

  const governmentSlogan = approvedVenue();
  governmentSlogan.attributes[0].evidenceRefs = [governmentSlogan.sources[0].evidenceId];
  const sloganResult = assessVenue(governmentSlogan);
  assert.equal(sloganResult.valid, false);
  assert.ok(sloganResult.errors.some(error => error.includes('direct observation evidence')));
});

test('generated JSON Schema stays parseable', async () => {
  const schema = JSON.parse(await readFile('schemas/venue-record.schema.json', 'utf8'));
  assert.equal(schema.type, 'object');
  assert.ok(schema.properties.venueId);
  assert.deepEqual(schema, z.toJSONSchema(venueRecordSchema, { target: 'draft-7' }));
});

test('Google Maps click-out encodes owned names, prefers optional Place ID and has no API key', () => {
  const withId = new URL(googleMapsUrl('自有 場地＆咖啡', 'ChIJ_test-123'));
  assert.equal(withId.origin, 'https://www.google.com');
  assert.equal(withId.searchParams.get('api'), '1');
  assert.equal(withId.searchParams.get('query'), '自有 場地＆咖啡');
  assert.equal(withId.searchParams.get('query_place_id'), 'ChIJ_test-123');
  assert.equal(withId.searchParams.has('key'), false);
  const withoutId = new URL(googleMapsUrl('授權場地'));
  assert.equal(withoutId.searchParams.get('query'), '授權場地');
  assert.equal(withoutId.searchParams.has('query_place_id'), false);
});
