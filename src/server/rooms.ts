import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool, transaction } from './db';
import { ApiError, type PublicState, type SharedConditions } from './contracts';

export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export async function identify(request: Request): Promise<string> {
  const token = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if (!token) throw new ApiError(401, 'UNAUTHENTICATED');
  const result = await pool().query(
    'SELECT id FROM anonymous_users WHERE token_hash=$1 AND expires_at > now()', [hash(token)],
  );
  if (!result.rowCount) throw new ApiError(401, 'UNAUTHENTICATED');
  return result.rows[0].id;
}

export async function anonymous() {
  const token = randomBytes(32).toString('base64url'), userId = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
  await pool().query('INSERT INTO anonymous_users(id, token_hash, expires_at) VALUES ($1,$2,$3)',
    [userId, hash(token), expiresAt]);
  return { token, expiresAt };
}

export async function createCouple(userId: string) {
  const coupleId = randomUUID(), inviteCode = randomBytes(24).toString('base64url');
  const inviteExpiresAt = new Date(Date.now() + 86400000).toISOString();
  await transaction(async client => {
    await client.query('INSERT INTO couples(id,invite_hash,invite_expires_at) VALUES ($1,$2,$3)',
      [coupleId, hash(inviteCode), inviteExpiresAt]);
    await client.query("INSERT INTO couple_members(couple_id,user_id,role) VALUES ($1,$2,'A')", [coupleId, userId]);
  });
  return { coupleId, role: 'A', inviteCode, inviteExpiresAt };
}

export async function joinCouple(userId: string, inviteCode: string) {
  return transaction(async client => {
    const room = await client.query('SELECT id, invite_expires_at > now() AS valid FROM couples WHERE invite_hash=$1 FOR UPDATE', [hash(inviteCode)]);
    if (!room.rowCount) throw new ApiError(404, 'INVITE_UNAVAILABLE');
    const coupleId = room.rows[0].id;
    const members = await client.query('SELECT user_id, role FROM couple_members WHERE couple_id=$1', [coupleId]);
    const existing = members.rows.find(member => member.user_id === userId);
    if (existing) return { coupleId, role: existing.role };
    if (!room.rows[0].valid) throw new ApiError(404, 'INVITE_UNAVAILABLE');
    if (members.rowCount === 2) throw new ApiError(409, 'ROOM_FULL');
    await client.query("INSERT INTO couple_members(couple_id,user_id,role) VALUES ($1,$2,'B')", [coupleId, userId]);
    return { coupleId, role: 'B' };
  });
}

export async function createSession(userId: string, coupleId: string) {
  return transaction(async client => {
    const member = await client.query('SELECT role FROM couple_members WHERE couple_id=$1 AND user_id=$2', [coupleId, userId]);
    if (!member.rowCount) throw new ApiError(404, 'NOT_FOUND');
    // One active session per room in Phase 1B; retries return the same session.
    const result = await client.query(`INSERT INTO date_sessions(id,couple_id) VALUES ($1,$2)
      ON CONFLICT (couple_id) DO UPDATE SET couple_id=EXCLUDED.couple_id RETURNING id`, [randomUUID(), coupleId]);
    return { sessionId: result.rows[0].id };
  });
}

async function lockedSession(client: PoolClient, userId: string, sessionId: string, expectedVersion: number) {
  const result = await client.query(`SELECT s.* FROM date_sessions s
    JOIN couple_members m ON m.couple_id=s.couple_id AND m.user_id=$2
    WHERE s.id=$1 FOR UPDATE OF s`, [sessionId, userId]);
  if (!result.rowCount) throw new ApiError(404, 'NOT_FOUND');
  if (result.rows[0].version !== expectedVersion) throw new ApiError(409, 'VERSION_CONFLICT');
  return result.rows[0];
}

export async function updateShared(userId: string, sessionId: string, expectedVersion: number, shared: SharedConditions) {
  await transaction(async client => {
    await lockedSession(client, userId, sessionId, expectedVersion);
    await client.query('UPDATE date_sessions SET shared=$2,version=version+1 WHERE id=$1', [sessionId, shared]);
    await client.query('DELETE FROM session_confirmations WHERE session_id=$1', [sessionId]);
  });
}

export async function confirm(userId: string, sessionId: string, expectedVersion: number) {
  await transaction(async client => {
    const session = await lockedSession(client, userId, sessionId, expectedVersion);
    if (!session.shared) throw new ApiError(409, 'SHARED_REQUIRED');
    const count = await client.query('SELECT count(*)::int AS n FROM couple_members WHERE couple_id=$1', [session.couple_id]);
    if (count.rows[0].n !== 2) throw new ApiError(409, 'PARTNER_REQUIRED');
    await client.query(`INSERT INTO session_confirmations(session_id,user_id,version) VALUES ($1,$2,$3)
      ON CONFLICT (session_id,user_id) DO UPDATE SET version=EXCLUDED.version`, [sessionId, userId, expectedVersion]);
  });
}

export async function publicState(userId: string, sessionId: string, touch = true): Promise<PublicState> {
  if (touch) await pool().query(`UPDATE couple_members m SET last_seen_at=clock_timestamp()
    FROM date_sessions s WHERE s.couple_id=m.couple_id AND s.id=$1 AND m.user_id=$2`, [sessionId, userId]);
  // Explicit public allowlist, one SQL snapshot. Never SELECT private inputs here.
  const result = await pool().query(`SELECT s.id,s.couple_id,s.shared,s.version,
    jsonb_agg(jsonb_build_object('role',m.role,'online',m.last_seen_at > now()-interval '30 seconds',
      'confirmed',coalesce(c.version=s.version,false)) ORDER BY m.role) AS members
    FROM date_sessions s JOIN couple_members m ON m.couple_id=s.couple_id
    LEFT JOIN session_confirmations c ON c.session_id=s.id AND c.user_id=m.user_id
    WHERE s.id=$1 AND EXISTS(SELECT 1 FROM couple_members own WHERE own.couple_id=s.couple_id AND own.user_id=$2)
    GROUP BY s.id`, [sessionId, userId]);
  if (!result.rowCount) throw new ApiError(404, 'NOT_FOUND');
  const row = result.rows[0];
  const members: PublicState['members'] = row.members;
  return {
    sessionId: row.id, coupleId: row.couple_id, version: row.version, shared: row.shared,
    status: members.length < 2 ? 'waiting_partner' : members.every(member => member.confirmed) ? 'ready' : 'editing',
    members,
  };
}
