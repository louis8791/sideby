import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { localPostgres } from '../scripts/postgres';
import { seedShowcase } from '../scripts/seed-showcase';
import { publishVenueRelease } from '../src/venues/publish';
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
      for (const record of records) await client.query(`INSERT INTO venue_staging_records(run_id,venue_id,source_key,source_record_id,record)
        VALUES ($1,$2,'test-source',$2,$3)`, [runId, record.venueId, { ...record, review: { status: 'draft', reviewedBy: null, reviewedAt: null } }]);
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
      await client.query('BEGIN');
      await assert.rejects(() => publishVenueRelease(client, release), /ALREADY_EXISTS/);
      await client.query('ROLLBACK');
    } finally { client.release(); }
  } finally { await db.end(); await postgres.stop(); }
});
