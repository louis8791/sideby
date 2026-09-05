import { Pool } from 'pg';
import { fetchTourismVenueBatch } from '../src/venues/tourism-open-data';
import { qualificationSummary } from '../src/venues/qualification';

async function main() {
  const useDatabase = process.argv.includes('--database');
  let records;
  if (useDatabase) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
    const db = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      records = (await db.query(`SELECT s.record FROM venue_staging_records s
        WHERE run_id=(SELECT id FROM venue_import_runs WHERE status='staged'
          ORDER BY source_updated_at DESC,created_at DESC LIMIT 1) ORDER BY venue_id`)).rows.map(row => row.record);
    } finally { await db.end(); }
  } else records = (await fetchTourismVenueBatch()).records;
  const { items, ...summary } = qualificationSummary(records);
  console.log(JSON.stringify(process.argv.includes('--details') ? { ...summary, items } : summary, null, 2));
}
void main().catch(() => { console.error('Venue qualification failed; check source or database configuration.'); process.exitCode = 1; });
