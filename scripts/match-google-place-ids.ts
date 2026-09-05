import { Pool } from 'pg';
import { findGooglePlaceId, listMatchCandidates, saveGooglePlaceMatch } from '../src/venues/google-place-matcher';

function option(name: string, fallback: number) {
  const raw = process.argv.slice(2).find(value => value.startsWith(`--${name}=`))?.split('=')[1];
  const value = raw ? Number(raw) : fallback;
  if (!Number.isInteger(value) || value < 1) throw new Error(`--${name} must be a positive integer`);
  return value;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const refresh = process.argv.includes('--refresh');
  const limit = Math.min(option('limit', 100), 1_500);
  const concurrency = Math.min(option('concurrency', 2), 5);
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
  if (apply && !apiKey) throw new Error('GOOGLE_MAPS_SERVER_API_KEY is required with --apply');
  const db = new Pool({ connectionString, max: concurrency + 1 });
  const client = await db.connect();
  let candidates;
  try { candidates = await listMatchCandidates(client, limit, refresh); }
  finally { client.release(); }
  if (!apply) {
    console.log(JSON.stringify({ candidates: candidates.length, apply: false, refresh }));
    await db.end();
    return;
  }
  let matched = 0, notFound = 0, retry = 0, cursor = 0;
  let stopped = false;
  const workers = Array.from({ length: Math.min(concurrency, candidates.length) }, async () => {
    for (;;) {
      if (stopped) return;
      const candidate = candidates[cursor++];
      if (!candidate) return;
      let placeId: string | null = null;
      let shouldRetry = false;
      try { placeId = await findGooglePlaceId(candidate, apiKey!); }
      catch (error) {
        shouldRetry = true;
        if (error instanceof Error && /GOOGLE_HTTP_(401|403|429)/.test(error.message)) stopped = true;
      }
      const write = await db.connect();
      try { await saveGooglePlaceMatch(write, candidate, placeId, shouldRetry); }
      finally { write.release(); }
      if (shouldRetry) retry += 1;
      else if (placeId) matched += 1;
      else notFound += 1;
    }
  });
  await Promise.all(workers);
  await db.end();
  console.log(JSON.stringify({ candidates: candidates.length, matched, notFound, retry,
    unprocessed: candidates.length - matched - notFound - retry, stopped, apply: true, refresh }));
  if (stopped) process.exitCode = 1;
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Google Place ID matching failed');
  process.exitCode = 1;
});
