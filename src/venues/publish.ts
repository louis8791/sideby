import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { executionSlotSchema } from '../recommendations/engine';
import { estimatedDatasetLegs } from '../recommendations/approved-real-data';
import { venueRecordSchema } from './schema';
import { qualifyVenue } from './qualification';
import { buildVenueRecommendationIndex } from '../server/learning';

export const venueReleaseSchema = z.strictObject({
  version: z.string().regex(/^sideby-release-[a-z0-9-]{1,55}$/),
  records: z.array(venueRecordSchema).min(3).max(2000),
  slots: z.array(executionSlotSchema).min(3).max(200000),
});

/** Caller owns the transaction. A release is immutable and may only use known candidates. */
export async function publishVenueRelease(client: PoolClient, input: unknown) {
  const release = venueReleaseSchema.parse(input);
  await client.query('SELECT pg_advisory_xact_lock(738922)');
  const ids = new Set(release.records.map(record => record.venueId));
  if (ids.size !== release.records.length) throw new Error('DUPLICATE_VENUE');
  if (new Set(release.slots.map(slot => slot.slotId)).size !== release.slots.length) throw new Error('DUPLICATE_SLOT');
  if (release.slots.some(slot => !ids.has(slot.venueId))) throw new Error('ORPHAN_SLOT');
  const latest = await client.query(`SELECT id FROM venue_import_runs WHERE status='staged'
    ORDER BY source_updated_at DESC,created_at DESC LIMIT 1 FOR SHARE`);
  if (!latest.rowCount) throw new Error('GOVERNMENT_CANDIDATES_REQUIRED');
  const known = await client.query(`SELECT venue_id FROM venue_staging_records WHERE run_id=$1
    AND venue_id=ANY($2::text[])`, [latest.rows[0].id, [...ids]]);
  if (known.rowCount !== ids.size) throw new Error('UNKNOWN_SOURCE_VENUE');
  for (const record of release.records) {
    if (record.datasetVersion !== release.version) throw new Error('DATASET_VERSION_MISMATCH');
    const slots = release.slots.filter(slot => slot.venueId === record.venueId);
    if (qualifyVenue(record, slots.length).status !== 'eligible') throw new Error(`VENUE_EVIDENCE_INCOMPLETE:${record.venueId}`);
    if (slots.some(slot => Date.parse(slot.closesAt) <= Date.parse(slot.opensAt)
      || Date.parse(slot.closesAt) - Date.parse(slot.opensAt) < slot.durationMinutes * 60000)) throw new Error('INVALID_EXECUTION_WINDOW');
  }
  const exists = await client.query('SELECT version FROM venue_datasets WHERE version=$1', [release.version]);
  if (exists.rowCount) throw new Error('RELEASE_VERSION_ALREADY_EXISTS');
  const matrixVersion = `routes-${release.version}`;
  await client.query("UPDATE venue_datasets SET status='stale' WHERE status='active'");
  await client.query("UPDATE travel_matrix_versions SET status='stale' WHERE status='active'");
  await client.query(`INSERT INTO venue_datasets(version,status,approved_at,data_mode) VALUES ($1,'active',now(),'approved_dataset')`, [release.version]);
  await client.query(`INSERT INTO travel_matrix_versions(version,status,checked_at,data_mode) VALUES ($1,'active',now(),'approved_dataset')`, [matrixVersion]);
  for (const record of release.records) await client.query(
    'INSERT INTO venue_records(venue_id,dataset_version,record) VALUES ($1,$2,$3)', [record.venueId, release.version, record]);
  for (const slot of release.slots) await client.query(
    'INSERT INTO venue_execution_slots(id,dataset_version,venue_id,execution) VALUES ($1,$2,$3,$4)', [slot.slotId, release.version, slot.venueId, slot]);
  // Large releases retain 32 nearest neighbors per venue. Missing legs stay unavailable.
  const legs = estimatedDatasetLegs(release.records, matrixVersion, ids.size > 200 ? 32 : undefined);
  await client.query(`INSERT INTO travel_matrix(matrix_version,from_key,to_key,mode,minutes)
    SELECT $1,x."fromKey",x."toKey",x.mode,x.minutes FROM jsonb_to_recordset($2::jsonb)
    AS x("fromKey" text,"toKey" text,mode text,minutes integer)`, [matrixVersion, JSON.stringify(legs)]);
  await client.query(`UPDATE venue_staging_records SET review_status='approved' WHERE run_id=$1 AND venue_id=ANY($2::text[])`, [latest.rows[0].id, [...ids]]);
  await buildVenueRecommendationIndex(client, `index-${release.version}`);
  return { version: release.version, matrixVersion, venues: ids.size, slots: release.slots.length,
    legs: legs.length, contentSha256: createHash('sha256').update(JSON.stringify(release)).digest('hex') };
}
