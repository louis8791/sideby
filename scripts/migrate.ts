import { readFile, readdir } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { Pool } from 'pg';

export async function migrate(connectionString: string) {
  const db = new Pool({ connectionString });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(738921)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const migrations = (await readdir(resolve('db'))).filter(file => /^\d{3}_[a-z0-9_-]+\.sql$/.test(file)).sort();
    for (const file of migrations) {
      const migrationVersion = basename(file, '.sql');
      const done = await client.query('SELECT 1 FROM schema_migrations WHERE version=$1', [migrationVersion]);
      if (done.rowCount) continue;
      await client.query(await readFile(resolve('db', file), 'utf8'));
      await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [migrationVersion]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); await db.end(); }
}

if (process.argv[1]?.endsWith('migrate.ts')) {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before migrating');
  migrate(process.env.DATABASE_URL).then(() => console.log('Database migration complete.'))
    .catch(() => { console.error('Database migration failed. Check server configuration.'); process.exitCode = 1; });
}
