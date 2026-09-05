import { Pool } from 'pg';
import {
  showcaseDatasetVersion, showcaseExecutionSlots, showcaseMatrixVersion, showcaseRecords, showcaseTravelLegs,
} from '../src/recommendations/showcase-data';
import {
  approvedDatasetVersion, approvedExecutionSlots, approvedMatrixVersion, approvedRecords,
  approvedSourceRecordIds, approvedTravelLegs,
} from '../src/recommendations/approved-real-data';

export async function seedShowcase(connectionString: string) {
  const db = new Pool({ connectionString });
  const client = await db.connect();
  const taipeiDate = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const synthetic = process.env.SIDEBY_DATA_MODE === 'synthetic_demo';
  const datasetVersion = synthetic ? showcaseDatasetVersion : approvedDatasetVersion;
  const matrixVersion = synthetic ? showcaseMatrixVersion : approvedMatrixVersion;
  const records = synthetic ? showcaseRecords() : approvedRecords();
  const slots = synthetic ? showcaseExecutionSlots(taipeiDate) : approvedExecutionSlots(taipeiDate, 90);
  const legs = synthetic ? showcaseTravelLegs() : approvedTravelLegs();
  try {
    await client.query('BEGIN');
    await client.query("UPDATE venue_datasets SET status='stale' WHERE status='active'");
    await client.query(`INSERT INTO venue_datasets(version,status,approved_at,data_mode)
      VALUES ($1,'active',now(),$2) ON CONFLICT (version)
      DO UPDATE SET status='active',approved_at=now(),data_mode=EXCLUDED.data_mode`,
    [datasetVersion, synthetic ? 'synthetic_demo' : 'approved_dataset']);
    await client.query("UPDATE travel_matrix_versions SET status='stale' WHERE status='active'");
    await client.query(`INSERT INTO travel_matrix_versions(version,status,checked_at,data_mode)
      VALUES ($1,'active',now(),$2) ON CONFLICT (version)
      DO UPDATE SET status='active',checked_at=now(),data_mode=EXCLUDED.data_mode`,
    [matrixVersion, synthetic ? 'synthetic_demo' : 'approved_dataset']);
    await client.query('DELETE FROM venue_execution_slots WHERE dataset_version=$1', [datasetVersion]);
    await client.query('DELETE FROM venue_records WHERE dataset_version=$1', [datasetVersion]);
    await client.query('DELETE FROM travel_matrix WHERE matrix_version=$1', [matrixVersion]);
    for (const record of records) await client.query(
      'INSERT INTO venue_records(venue_id,dataset_version,record) VALUES ($1,$2,$3)',
      [record.venueId, datasetVersion, record],
    );
    for (const slot of slots) await client.query(
      'INSERT INTO venue_execution_slots(id,dataset_version,venue_id,execution) VALUES ($1,$2,$3,$4)',
      [slot.slotId, datasetVersion, slot.venueId, slot],
    );
    for (const leg of legs) await client.query(
      'INSERT INTO travel_matrix(matrix_version,from_key,to_key,mode,minutes) VALUES ($1,$2,$3,$4,$5)',
      [leg.matrixVersion, leg.fromKey, leg.toKey, leg.mode, leg.minutes],
    );
    if (!synthetic) await client.query(`UPDATE venue_staging_records SET review_status='approved'
      WHERE run_id=(SELECT id FROM venue_import_runs WHERE status='staged' ORDER BY source_updated_at DESC,created_at DESC LIMIT 1)
      AND source_record_id=ANY($1::text[])`, [approvedSourceRecordIds()]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await db.end();
  }
}

if (process.argv[1]?.endsWith('seed-showcase.ts')) {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL is required');
  seedShowcase(connectionString)
    .then(() => console.log(process.env.SIDEBY_DATA_MODE === 'synthetic_demo'
      ? `Seeded ${showcaseDatasetVersion} with Google Place IDs and Sideby-owned demo facts.`
      : `Activated ${approvedDatasetVersion} with 13 Owner-approved government venues.`))
    .catch(error => { console.error(error instanceof Error ? error.message : 'Showcase seed failed'); process.exitCode = 1; });
}
