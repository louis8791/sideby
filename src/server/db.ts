import { Pool, type PoolClient } from 'pg';

const globalDb = globalThis as typeof globalThis & { sidebyPool?: Pool };
export function pool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error('Database not configured');
  if (globalDb.sidebyPool) return globalDb.sidebyPool;
  const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10, connectionTimeoutMillis: 3000, statement_timeout: 5000,
    idleTimeoutMillis: 10000,
  });
  db.on('error', () => console.error('Sideby database connection unavailable'));
  return globalDb.sidebyPool = db;
}

export async function transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
