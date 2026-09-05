import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { localPostgres } from '../scripts/postgres';
import { seedShowcase } from '../scripts/seed-showcase';
import { publishVenueRelease } from '../src/venues/publish';
import { buildCandidatePoolRelease } from '../src/venues/candidate-release';
import { explicitAdmissionPrice, qualifyVenue } from '../src/venues/qualification';
import { approvedRecords, approvedExecutionSlots } from '../src/recommendations/approved-real-data';

test('admission suggestions never turn partial discounts into a verified price', () => {
  assert.equal(explicitAdmissionPrice('免費參觀'), 0);
  assert.equal(explicitAdmissionPrice('門票 120 元'), 120);
  assert.equal(explicitAdmissionPrice('兒童免費，成人另計'), null);
  const record = approvedRecords()[0];
  assert.equal(qualifyVenue(record, 1).status, 'eligible');
  assert.equal(qualifyVenue({ ...record, review: { status: 'draft', reviewedBy: null, reviewedAt: null } }, 1).status, 'needs_evidence');
});

test('Owner bulk publication keeps missing facts unknown while admitting every valid government candidate', () => {
  const base = approvedRecords()[0];
  const drafts = Array.from({ length: 3 }, (_, index) => ({
    ...base, datasetVersion: 'tourism-test-candidates', venueId: `venue_candidate_${index + 1}`,
    name: `政府候選 ${index + 1}`,
    facts: { ...base.facts,
      price: { status: 'unknown' as const, minTwd: null, maxTwd: null, basis: 'unknown' as const, evidenceRefs: [] },
      openingHours: { status: 'source_reported' as const, rawText: base.facts.openingHours.rawText,
        evidenceRefs: base.facts.openingHours.evidenceRefs },
    },
    review: { status: 'draft' as const, reviewedBy: null, reviewedAt: null },
  }));
  const release = buildCandidatePoolRelease(drafts, '2026-09-06');
  assert.equal(release.records.length, 3);
  assert.equal(release.slots.length, 3);
  assert.equal(release.confirmationRequiredVenueCount, 3);
  assert.ok(release.records.every(record => qualifyVenue(record, 1).status === 'eligible_with_unknowns'));
  assert.ok(release.slots.every(slot => slot.status === 'provisional' && slot.outdoor === null));
});

test('publication switches dataset, route matrix and index atomically and startup preserves releases', { timeout: 60_000 }, async () => {
  const { postgres, url } = await localPostgres(`.local/tests/venue-publish-${Date.now()}`);
  const db = new Pool({ connectionString: url });
  try {
    await seedShowcase(url);
    const records = approvedRecords();
    const client = await db.connect();
    try {
      // Synthetic source batch is used only in this isolated test database.
      const runId = '40000000-0000-4000-8000-000000000001';
      await client.query(`INSERT INTO venue_sources(source_key,dataset_name,source_url,data_owner,license_name,license_url,update_frequency)
        VALUES ('test-source','Test only','https://example.com','Test','Test','https://example.com/license','manual')`);
      await client.query(`INSERT INTO venue_import_runs(id,dataset_version,source_bundle_hash,source_updated_at,scope_cities,
        source_record_count,scoped_record_count,staged_record_count,rejected_record_count,status)
        VALUES ($1,'test-release-source',$2,now(),ARRAY['臺北市'],13,13,13,0,'staged')`, [runId, 'a'.repeat(64)]);
      const unknownCandidates = Array.from({ length: 3 }, (_, index) => ({ ...records[0],
        venueId: `venue_candidate_db_${index + 1}`, name: `資料庫候選 ${index + 1}`,
        facts: { ...records[0].facts,
          price: { status: 'unknown' as const, minTwd: null, maxTwd: null, basis: 'unknown' as const, evidenceRefs: [] },
          openingHours: { ...records[0].facts.openingHours, status: 'source_reported' as const },
        },
      }));
      const stagedRecords = [...records, ...unknownCandidates].map(record => ({ ...record,
        datasetVersion: 'test-candidate-source', review: { status: 'draft' as const, reviewedBy: null, reviewedAt: null } }));
      for (const record of stagedRecords) await client.query(`INSERT INTO venue_staging_records(run_id,venue_id,source_key,source_record_id,record)
        VALUES ($1,$2,'test-source',$2,$3)`, [runId, record.venueId, record]);
      const version = 'sideby-release-test-v1';
      const release = { version, records: records.map(record => ({ ...record, datasetVersion: version })),
        slots: approvedExecutionSlots('2026-09-06', 90).map(slot => ({ ...slot, slotId: randomUUID() })) };
      await client.query('BEGIN');
      await publishVenueRelease(client, release);
      await client.query('ROLLBACK');
      assert.notEqual((await client.query("SELECT version FROM venue_datasets WHERE status='active'")).rows[0].version, version);
      await client.query('BEGIN');
      assert.equal((await publishVenueRelease(client, release)).venues, 13);
      await client.query('COMMIT');
      await seedShowcase(url);
      assert.equal((await client.query("SELECT version FROM venue_datasets WHERE status='active'")).rows[0].version, version);
      assert.equal((await client.query("SELECT dataset_version FROM venue_recommendation_indexes WHERE status='active'")).rows[0].dataset_version, version);
      const candidateRelease = buildCandidatePoolRelease(stagedRecords, '2026-09-06');
      await client.query('BEGIN');
      assert.equal((await publishVenueRelease(client, {
        version: candidateRelease.version, records: candidateRelease.records, slots: candidateRelease.slots,
      })).venues, 16);
      await client.query('COMMIT');
      assert.equal((await client.query('SELECT count(*)::int n FROM venue_records WHERE dataset_version=$1', [candidateRelease.version])).rows[0].n, 16);
      assert.equal((await client.query(`SELECT count(*)::int n FROM venue_recommendation_index_entries
        WHERE index_version=$1 AND price_max_twd IS NULL`, [`index-${candidateRelease.version}`])).rows[0].n, 3);
      await client.query('BEGIN');
      await assert.rejects(() => publishVenueRelease(client, release), /ALREADY_EXISTS/);
      await client.query('ROLLBACK');
    } finally { client.release(); }
  } finally { await db.end(); await postgres.stop(); }
});
