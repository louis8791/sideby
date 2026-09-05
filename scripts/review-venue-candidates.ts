import { Pool } from 'pg';

async function main() {
  const raw = process.argv.slice(2).find(value => value.startsWith('--limit='))?.split('=')[1];
  const limit = raw ? Number(raw) : 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('--limit must be an integer from 1 to 500');
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const db = new Pool({ connectionString });
  try {
    const result = await db.query(`SELECT dataset_version AS "datasetVersion",venue_id AS "venueId",
      source_key AS "sourceKey",source_record_id AS "sourceRecordId",name,district,category,
      google_place_id AS "googlePlaceId",completeness_score AS "completenessScore"
      FROM venue_candidate_review_queue
      ORDER BY completeness_score DESC,google_place_id NULLS LAST,district,name LIMIT $1`, [limit]);
    console.log(JSON.stringify({ count: result.rowCount, candidates: result.rows }));
  } finally { await db.end(); }
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Venue review queue failed');
  process.exitCode = 1;
});
