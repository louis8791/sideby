import { Pool } from 'pg';
import { buildCandidatePoolRelease } from '../src/venues/candidate-release';
import { publishVenueRelease } from '../src/venues/publish';

export async function publishLatestCandidatePool(connectionString: string, apply: boolean, startDate?: string) {
  const db = new Pool({ connectionString }), client = await db.connect();
  try {
    const latest = await client.query(`SELECT id,dataset_version FROM venue_import_runs WHERE status='staged'
      ORDER BY source_updated_at DESC,created_at DESC LIMIT 1`);
    if (!latest.rowCount) throw new Error('GOVERNMENT_CANDIDATES_REQUIRED');
    const staged = await client.query('SELECT record FROM venue_staging_records WHERE run_id=$1 ORDER BY venue_id', [latest.rows[0].id]);
    const taipeiDate = startDate ?? new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
    const release = buildCandidatePoolRelease(staged.rows.map(row => row.record), taipeiDate);
    const summary = { version: release.version, records: release.records.length, slots: release.slots.length,
      verifiedVenues: release.verifiedVenueCount, confirmationRequiredVenues: release.confirmationRequiredVenueCount };
    if (!apply) return { ...summary, applied: false };
    const exists = await client.query('SELECT status FROM venue_datasets WHERE version=$1', [release.version]);
    if (exists.rowCount) return { ...summary, applied: false, reused: true, status: exists.rows[0].status };
    await client.query('BEGIN');
    try {
      const result = await publishVenueRelease(client, { version: release.version, records: release.records, slots: release.slots });
      await client.query('COMMIT');
      return { ...summary, ...result, applied: true, reused: false };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally { client.release(); await db.end(); }
}

if (process.argv[1]?.endsWith('publish-candidate-pool.ts')) {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL is required');
  publishLatestCandidatePool(connectionString, process.argv.includes('--apply'))
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(error instanceof Error ? error.message : 'Candidate pool publication failed'); process.exitCode = 1; });
}
