import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { composeItineraries } from '../recommendations/engine';
import { ApiError, type SharedConditions } from './contracts';
import { pool, transaction } from './db';
import { publicProjection, safePublicReason } from './privacy';

async function memberSession(client: PoolClient, userId: string, sessionId: string, lock = false) {
  const result = await client.query(`SELECT s.* FROM date_sessions s
    JOIN couple_members m ON m.couple_id=s.couple_id AND m.user_id=$2
    WHERE s.id=$1${lock ? ' FOR UPDATE OF s' : ''}`, [sessionId, userId]);
  if (!result.rowCount) throw new ApiError(404, 'NOT_FOUND');
  return result.rows[0];
}

export async function generate(userId: string, sessionId: string, expectedVersion: number) {
  return transaction(async client => {
    const session = await memberSession(client, userId, sessionId, true);
    if (session.version !== expectedVersion) throw new ApiError(409, 'VERSION_CONFLICT');
    if (!session.shared) throw new ApiError(409, 'SHARED_REQUIRED');
    const ready = await client.query(`SELECT count(*)::int AS members,
      count(*) FILTER (WHERE c.version=$2)::int AS confirmed
      FROM couple_members m LEFT JOIN session_confirmations c
        ON c.session_id=$1 AND c.user_id=m.user_id WHERE m.couple_id=$3`,
      [sessionId, expectedVersion, session.couple_id]);
    if (ready.rows[0].members !== 2 || ready.rows[0].confirmed !== 2) throw new ApiError(409, 'SESSION_NOT_READY');
    const inputs = await client.query(`SELECT i.raw_text,i.parser_output FROM session_inputs i
      JOIN couple_members m ON m.user_id=i.user_id AND m.couple_id=$2
      WHERE i.session_id=$1 ORDER BY m.role`, [sessionId, session.couple_id]);
    if (inputs.rowCount !== 2 || inputs.rows.some(row => row.parser_output?.status !== 'parsed')) {
      throw new ApiError(422, 'PRIVATE_INPUT_UNRESOLVED');
    }
    const dataset = await client.query("SELECT version FROM venue_datasets WHERE status='active'");
    const matrix = await client.query("SELECT version FROM travel_matrix_versions WHERE status='active'");
    if (dataset.rowCount !== 1 || matrix.rowCount !== 1) throw new ApiError(503, 'RECOMMENDATION_DATA_UNAVAILABLE');
    const venues = await client.query(`SELECT r.record,s.execution FROM venue_records r
      JOIN venue_execution_slots s ON s.venue_id=r.venue_id
      WHERE r.dataset_version=$1 ORDER BY r.venue_id LIMIT 16`, [dataset.rows[0].version]);
    const legs = await client.query(`SELECT matrix_version AS "matrixVersion",from_key AS "fromKey",
      to_key AS "toKey",mode,minutes FROM travel_matrix WHERE matrix_version=$1`, [matrix.rows[0].version]);
    const itineraries = composeItineraries({
      sessionId, version: expectedVersion, shared: session.shared as SharedConditions,
      parserOutputs: inputs.rows.map(row => row.parser_output), venues: venues.rows, legs: legs.rows,
    });
    if (itineraries.length !== 3) throw new ApiError(422, 'NO_FEASIBLE_ITINERARIES');
    const privateTexts = inputs.rows.map(row => String(row.raw_text));
    if (itineraries.some(item => !safePublicReason(item.public_reason, privateTexts))) {
      throw new ApiError(500, 'PRIVACY_GUARD_REJECTED');
    }
    await client.query('DELETE FROM session_itineraries WHERE session_id=$1 AND session_version=$2', [sessionId, expectedVersion]);
    for (const [index, itinerary] of itineraries.entries()) {
      await client.query(`INSERT INTO session_itineraries(id,session_id,session_version,rank_no,payload)
        VALUES ($1,$2,$3,$4,$5)`, [randomUUID(), sessionId, expectedVersion, index + 1, itinerary]);
    }
    return publicProjection({ sessionId, version: expectedVersion, itineraries });
  });
}

export async function list(userId: string, sessionId: string) {
  const result = await pool().query(`SELECT s.version,i.payload FROM date_sessions s
    JOIN couple_members m ON m.couple_id=s.couple_id AND m.user_id=$2
    LEFT JOIN session_itineraries i ON i.session_id=s.id AND i.session_version=s.version
    WHERE s.id=$1 ORDER BY i.rank_no`, [sessionId, userId]);
  if (!result.rowCount) throw new ApiError(404, 'NOT_FOUND');
  return publicProjection({ sessionId, version: result.rows[0].version,
    itineraries: result.rows.filter(row => row.payload).map(row => row.payload) });
}
