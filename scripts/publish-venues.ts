import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { publishVenueRelease, venueReleaseSchema } from '../src/venues/publish';

async function main() {
  const path = process.argv.find(arg => arg.startsWith('--file='))?.slice(7);
  if (!path) throw new Error('A reviewed release file is required (--file=...)');
  const release = venueReleaseSchema.parse(JSON.parse(await readFile(path, 'utf8')));
  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify({ version: release.version, records: release.records.length, slots: release.slots.length, applied: false }));
    return;
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const db = new Pool({ connectionString: process.env.DATABASE_URL }), client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await publishVenueRelease(client, release);
    await client.query('COMMIT');
    console.log(JSON.stringify({ ...result, applied: true }));
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await db.end(); }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'Venue publication failed'); process.exitCode = 1; });
