import { Pool } from 'pg';
import { recommendationLegs, recommendationRecord, recommendationSlot } from '../tests/recommendation-fixtures';

export async function seedSyntheticDemo(connectionString: string) {
  const db = new Pool({ connectionString });
  const client = await db.connect();
  try {
    const taipeiDate = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    await client.query('BEGIN');
    await client.query("UPDATE venue_datasets SET status='stale' WHERE status='active'");
    await client.query(`INSERT INTO venue_datasets(version,status,approved_at,data_mode)
      VALUES ('test-v1','active',now(),'synthetic_demo')
      ON CONFLICT (version) DO UPDATE SET status='active',approved_at=now(),data_mode='synthetic_demo'`);
    await client.query("UPDATE travel_matrix_versions SET status='stale' WHERE status='active'");
    await client.query(`INSERT INTO travel_matrix_versions(version,status,checked_at,data_mode)
      VALUES ('matrix-v1','active',now(),'synthetic_demo')
      ON CONFLICT (version) DO UPDATE SET status='active',checked_at=now(),data_mode='synthetic_demo'`);
    for (let index = 1; index <= 8; index++) {
      const record = recommendationRecord(index), slot = {
        ...recommendationSlot(index),
        opensAt: `${taipeiDate}T00:00:00Z`,
        closesAt: `${taipeiDate}T15:59:00Z`,
      };
      await client.query(`INSERT INTO venue_records(venue_id,dataset_version,record) VALUES ($1,'test-v1',$2)
        ON CONFLICT (dataset_version,venue_id) DO UPDATE SET record=EXCLUDED.record`, [record.venueId, record]);
      await client.query(`INSERT INTO venue_execution_slots(id,dataset_version,venue_id,execution)
        VALUES ($1,'test-v1',$2,$3) ON CONFLICT (id) DO UPDATE SET execution=EXCLUDED.execution`,
      [slot.slotId, slot.venueId, slot]);
    }
    for (const leg of recommendationLegs()) {
      await client.query(`INSERT INTO travel_matrix(matrix_version,from_key,to_key,mode,minutes)
        VALUES ($1,$2,$3,$4,$5) ON CONFLICT (matrix_version,from_key,to_key,mode)
        DO UPDATE SET minutes=EXCLUDED.minutes`, [leg.matrixVersion, leg.fromKey, leg.toKey, leg.mode, leg.minutes]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await db.end();
  }
}
