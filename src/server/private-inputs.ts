import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { parseWithRuleBaseline } from '../model/preference-query';
import { ApiError, CURRENT_TERMS_VERSION, type PrivateInput } from './contracts';
import { pool, transaction } from './db';

async function sessionForMember(client: PoolClient, userId: string, sessionId: string, lock = false) {
  const result = await client.query(`SELECT s.id,s.shared FROM date_sessions s
    JOIN couple_members m ON m.couple_id=s.couple_id AND m.user_id=$2
    WHERE s.id=$1${lock ? ' FOR UPDATE OF s' : ''}`, [sessionId, userId]);
  if (!result.rowCount) throw new ApiError(404, 'NOT_FOUND');
  return result.rows[0];
}

async function requireConsent(client: PoolClient, userId: string, remembered: boolean) {
  const accepted = await client.query(
    'SELECT 1 FROM terms_acceptances WHERE user_id=$1 AND terms_version=$2',
    [userId, CURRENT_TERMS_VERSION],
  );
  if (!accepted.rowCount) throw new ApiError(409, 'TERMS_REQUIRED');
  const preference = await client.query(`SELECT personalization_enabled FROM consent_preferences
    WHERE user_id=$1 AND terms_version=$2 FOR SHARE`, [userId, CURRENT_TERMS_VERSION]);
  if (remembered && (!preference.rowCount || !preference.rows[0].personalization_enabled)) {
    throw new ApiError(409, 'PERSONALIZATION_REQUIRED');
  }
}

function privateView(row: Record<string, unknown>) {
  return {
    inputId: row.id,
    sessionId: row.session_id,
    rawText: row.raw_text,
    tags: row.tags,
    visibility: row.visibility,
    parse: row.parser_output,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getOwnPrivateInput(userId: string, sessionId: string) {
  const result = await pool().query(`SELECT i.* FROM date_sessions s
    JOIN couple_members m ON m.couple_id=s.couple_id AND m.user_id=$2
    LEFT JOIN session_inputs i ON i.session_id=s.id AND i.user_id=$2
    WHERE s.id=$1`, [sessionId, userId]);
  if (!result.rowCount || !result.rows[0].id) throw new ApiError(404, 'NOT_FOUND');
  return privateView(result.rows[0]);
}

export async function putOwnPrivateInput(userId: string, sessionId: string, input: PrivateInput) {
  return transaction(async client => {
    await sessionForMember(client, userId, sessionId);
    await requireConsent(client, userId, input.visibility === 'private_remembered');
    const session = await sessionForMember(client, userId, sessionId, true);
    const parserOutput = parseWithRuleBaseline({
      sessionId, mode: session.shared?.mode ?? null, visibility: input.visibility,
      rawText: input.normalizedText ?? input.rawText,
    });
    const result = await client.query(`INSERT INTO session_inputs(
      id,session_id,user_id,raw_text,tags,visibility,parse_status,parser_output)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (session_id,user_id) DO UPDATE SET raw_text=EXCLUDED.raw_text,
        tags=EXCLUDED.tags,visibility=EXCLUDED.visibility,parse_status=EXCLUDED.parse_status,
        parser_output=EXCLUDED.parser_output,updated_at=clock_timestamp()
      RETURNING *`, [randomUUID(), sessionId, userId, input.rawText, input.tags,
      input.visibility, parserOutput.status, parserOutput]);
    await client.query('UPDATE date_sessions SET version=version+1 WHERE id=$1', [sessionId]);
    await client.query('DELETE FROM session_confirmations WHERE session_id=$1', [sessionId]);
    return privateView(result.rows[0]);
  });
}

export async function deleteOwnPrivateInput(userId: string, sessionId: string) {
  await transaction(async client => {
    await sessionForMember(client, userId, sessionId, true);
    const result = await client.query(
      'DELETE FROM session_inputs WHERE session_id=$1 AND user_id=$2', [sessionId, userId],
    );
    if (!result.rowCount) throw new ApiError(404, 'NOT_FOUND');
    await client.query('UPDATE date_sessions SET version=version+1 WHERE id=$1', [sessionId]);
    await client.query('DELETE FROM session_confirmations WHERE session_id=$1', [sessionId]);
  });
}
