import { Pool } from 'pg';
import { fetchTourismVenueBatch, stageTourismVenueBatch } from '../src/venues/tourism-open-data';

async function main() {
  const apply = process.argv.slice(2).includes('--apply');
  const batch = await fetchTourismVenueBatch();
  const summary = {
    datasetVersion: batch.datasetVersion,
    sourceUpdatedAt: batch.sourceUpdatedAt,
    sourceRecords: batch.sourceRecordCount,
    scopedRecords: batch.scopedRecordCount,
    stagedRecords: batch.records.length,
    rejectedRecords: batch.rejectedRecordCount,
    rejectionSummary: batch.rejectionSummary,
    scopeCities: batch.scopeCities,
    applied: false,
  };
  if (!apply) {
    console.log(JSON.stringify(summary));
    return;
  }
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL is required with --apply');
  const db = new Pool({ connectionString });
  const client = await db.connect();
  try {
    const staged = await stageTourismVenueBatch(client, batch);
    console.log(JSON.stringify({ ...summary, applied: true, ...staged }));
  } finally { client.release(); await db.end(); }
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Government venue refresh failed');
  process.exitCode = 1;
});
