import { Pool } from 'pg';
import {
  showcaseDatasetVersion, showcaseExecutionSlots, showcaseMatrixVersion, showcaseRecords, showcaseTravelLegs,
} from '../src/recommendations/showcase-data';

export async function seedShowcase(connectionString: string) {
  const db = new Pool({ connectionString });
  const client = await db.connect();
  const taipeiDate = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  try {
    await client.query('BEGIN');
    await client.query("UPDATE venue_datasets SET status='stale' WHERE status='active'");
    await client.query(`INSERT INTO venue_datasets(version,status,approved_at,data_mode)
      VALUES ($1,'active',now(),'synthetic_demo') ON CONFLICT (version)
      DO UPDATE SET status='active',approved_at=now(),data_mode='synthetic_demo'`, [showcaseDatasetVersion]);
    await client.query("UPDATE travel_matrix_versions SET status='stale' WHERE status='active'");
    await client.query(`INSERT INTO travel_matrix_versions(version,status,checked_at,data_mode)
      VALUES ($1,'active',now(),'synthetic_demo') ON CONFLICT (version)
      DO UPDATE SET status='active',checked_at=now(),data_mode='synthetic_demo'`, [showcaseMatrixVersion]);
    await client.query('DELETE FROM venue_execution_slots WHERE dataset_version=$1', [showcaseDatasetVersion]);
    await client.query('DELETE FROM venue_records WHERE dataset_version=$1', [showcaseDatasetVersion]);
    await client.query('DELETE FROM travel_matrix WHERE matrix_version=$1', [showcaseMatrixVersion]);
    for (const record of showcaseRecords()) await client.query(
      'INSERT INTO venue_records(venue_id,dataset_version,record) VALUES ($1,$2,$3)',
      [record.venueId, showcaseDatasetVersion, record],
    );
    for (const slot of showcaseExecutionSlots(taipeiDate)) await client.query(
      'INSERT INTO venue_execution_slots(id,dataset_version,venue_id,execution) VALUES ($1,$2,$3,$4)',
      [slot.slotId, showcaseDatasetVersion, slot.venueId, slot],
    );
    for (const leg of showcaseTravelLegs()) await client.query(
      'INSERT INTO travel_matrix(matrix_version,from_key,to_key,mode,minutes) VALUES ($1,$2,$3,$4,$5)',
      [leg.matrixVersion, leg.fromKey, leg.toKey, leg.mode, leg.minutes],
    );
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
    .then(() => console.log(`Seeded ${showcaseDatasetVersion} with Google Place IDs and Sideby-owned demo facts.`))
    .catch(error => { console.error(error instanceof Error ? error.message : 'Showcase seed failed'); process.exitCode = 1; });
}
