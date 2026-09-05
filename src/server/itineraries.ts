import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { applyBrightPreferenceDelta } from '../model/preference-learning';
import { composeItineraries, publicItinerarySchema, type PublicItinerary } from '../recommendations/engine';
import { ApiError, CURRENT_TERMS_VERSION, type ItineraryReaction, type PreferenceFeedback, type SharedConditions } from './contracts';
import { pool, transaction } from './db';
import { publicProjection, safePublicReason } from './privacy';

type SessionRow = Record<string, any>;

async function memberSession(client: PoolClient, userId: string, sessionId: string, lock = false) {
  const result = await client.query(`SELECT s.* FROM date_sessions s
    JOIN couple_members m ON m.couple_id=s.couple_id AND m.user_id=$2
    WHERE s.id=$1${lock ? ' FOR UPDATE OF s' : ''}`, [sessionId, userId]);
  if (!result.rowCount) throw new ApiError(404, 'NOT_FOUND');
  return result.rows[0] as SessionRow;
}

async function currentItinerary(client: PoolClient, userId: string, itineraryId: string, lock = false) {
  const result = await client.query(`SELECT s.*,i.session_version AS itinerary_session_version,i.rank_no,i.payload FROM session_itineraries i
    JOIN date_sessions s ON s.id=i.session_id
    JOIN couple_members m ON m.couple_id=s.couple_id AND m.user_id=$2
    WHERE i.id=$1${lock ? ' FOR UPDATE OF s,i' : ''}`, [itineraryId, userId]);
  if (!result.rowCount) throw new ApiError(404, 'NOT_FOUND');
  if (result.rows[0].version !== result.rows[0].itinerary_session_version) throw new ApiError(409, 'VERSION_CONFLICT');
  const itinerary = publicItinerarySchema.safeParse(result.rows[0].payload);
  if (!itinerary.success) throw new ApiError(503, 'RECOMMENDATION_DATA_INVALID');
  return { session: result.rows[0] as SessionRow, itinerary: itinerary.data };
}

async function assertNotFinalized(client: PoolClient, sessionId: string, version: number) {
  const result = await client.query(
    'SELECT itinerary_id FROM session_finalizations WHERE session_id=$1 AND session_version=$2',
    [sessionId, version],
  );
  if (result.rowCount) throw new ApiError(409, 'SESSION_FINALIZED');
}

async function recommendationContext(client: PoolClient, session: SessionRow) {
  if (!session.shared) throw new ApiError(409, 'SHARED_REQUIRED');
  const ready = await client.query(`SELECT count(*)::int AS members,
    count(*) FILTER (WHERE c.version=$2)::int AS confirmed
    FROM couple_members m LEFT JOIN session_confirmations c
      ON c.session_id=$1 AND c.user_id=m.user_id WHERE m.couple_id=$3`,
    [session.id, session.version, session.couple_id]);
  if (ready.rows[0].members !== 2 || ready.rows[0].confirmed !== 2) throw new ApiError(409, 'SESSION_NOT_READY');
  const inputs = await client.query(`SELECT i.user_id,i.raw_text,i.parser_output FROM session_inputs i
    JOIN couple_members m ON m.user_id=i.user_id AND m.couple_id=$2
    WHERE i.session_id=$1 ORDER BY m.role`, [session.id, session.couple_id]);
  if (inputs.rowCount !== 2 || inputs.rows.some(row => row.parser_output?.status !== 'parsed')) {
    throw new ApiError(422, 'PRIVATE_INPUT_UNRESOLVED');
  }
  const dataset = await client.query("SELECT version,data_mode FROM venue_datasets WHERE status='active'");
  const matrix = await client.query("SELECT version,data_mode FROM travel_matrix_versions WHERE status='active'");
  if (dataset.rowCount !== 1 || matrix.rowCount !== 1) throw new ApiError(503, 'RECOMMENDATION_DATA_UNAVAILABLE');
  if (dataset.rows[0].data_mode !== matrix.rows[0].data_mode) throw new ApiError(503, 'RECOMMENDATION_DATA_UNAVAILABLE');
  const venues = await client.query(`SELECT r.record,s.execution FROM venue_records r
    JOIN venue_execution_slots s ON s.dataset_version=r.dataset_version AND s.venue_id=r.venue_id
    WHERE r.dataset_version=$1 ORDER BY r.venue_id LIMIT 16`, [dataset.rows[0].version]);
  const legs = await client.query(`SELECT matrix_version AS "matrixVersion",from_key AS "fromKey",
    to_key AS "toKey",mode,minutes FROM travel_matrix WHERE matrix_version=$1`, [matrix.rows[0].version]);
  const deltas = await client.query(`SELECT e.user_id,sum(e.target_min_delta)::float AS bright_delta
    FROM preference_feedback_events e
    WHERE e.user_id=ANY($1::uuid[]) AND (
      e.session_id=$2 OR (
        e.session_id<>$2 AND e.long_term_applied AND EXISTS (
          SELECT 1 FROM consent_preferences p
          WHERE p.user_id=e.user_id AND p.terms_version=$3 AND p.personalization_enabled
        )
      )
    ) GROUP BY e.user_id`, [inputs.rows.map(row => row.user_id), session.id, CURRENT_TERMS_VERSION]);
  const deltaByUser = new Map(deltas.rows.map(row => [row.user_id, Number(row.bright_delta)]));
  return {
    shared: session.shared as SharedConditions,
    parserOutputs: inputs.rows.map(row => applyBrightPreferenceDelta(row.parser_output, deltaByUser.get(row.user_id) ?? 0)),
    privateTexts: inputs.rows.map(row => String(row.raw_text)),
    venues: venues.rows,
    legs: legs.rows,
    dataMode: dataset.rows[0].data_mode as 'approved_dataset' | 'synthetic_demo',
    datasetVersion: String(dataset.rows[0].version),
    routeMatrixVersion: String(matrix.rows[0].version),
  };
}

function safeItineraries(itineraries: PublicItinerary[], privateTexts: string[]) {
  if (itineraries.some(item => !safePublicReason(item.public_reason, privateTexts))) {
    throw new ApiError(500, 'PRIVACY_GUARD_REJECTED');
  }
  return itineraries;
}

export async function generate(userId: string, sessionId: string, expectedVersion: number) {
  return transaction(async client => {
    const session = await memberSession(client, userId, sessionId, true);
    if (session.version !== expectedVersion) throw new ApiError(409, 'VERSION_CONFLICT');
    await assertNotFinalized(client, sessionId, expectedVersion);
    const context = await recommendationContext(client, session);
    const itineraries = safeItineraries(composeItineraries({
      sessionId, version: expectedVersion, shared: context.shared,
      parserOutputs: context.parserOutputs, venues: context.venues, legs: context.legs,
      dataMode: context.dataMode, datasetVersion: context.datasetVersion, routeMatrixVersion: context.routeMatrixVersion,
    }), context.privateTexts);
    if (itineraries.length !== 3) throw new ApiError(422, 'NO_FEASIBLE_ITINERARIES');
    await client.query('DELETE FROM session_itineraries WHERE session_id=$1 AND session_version=$2', [sessionId, expectedVersion]);
    for (const [index, itinerary] of itineraries.entries()) {
      await client.query(`INSERT INTO session_itineraries(id,session_id,session_version,rank_no,payload)
        VALUES ($1,$2,$3,$4,$5)`, [itinerary.itinerary_id, sessionId, expectedVersion, index + 1, itinerary]);
    }
    return publicProjection({ sessionId, version: expectedVersion, itineraries });
  });
}

export async function react(userId: string, itineraryId: string, input: ItineraryReaction) {
  return transaction(async client => {
    const current = await currentItinerary(client, userId, itineraryId, true);
    if (current.session.version !== input.version) throw new ApiError(409, 'VERSION_CONFLICT');
    await assertNotFinalized(client, current.session.id, input.version);
    const stop = input.stopId ? current.itinerary.stops.find(item => item.stop_id === input.stopId) : undefined;
    if (input.stopId && !stop) throw new ApiError(404, 'NOT_FOUND');
    if (stop?.locked && input.reaction !== 'like') throw new ApiError(409, 'LOCKED_STOP_CONFLICT');
    const venueId = stop?.venue_id ?? null;
    const targetKey = input.stopId ?? '__itinerary__';
    await client.query(`INSERT INTO itinerary_reactions(
      itinerary_id,session_version,user_id,target_key,stop_id,venue_id,reaction)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (itinerary_id,user_id,target_key) DO UPDATE SET
        reaction=EXCLUDED.reaction,updated_at=clock_timestamp()`,
    [itineraryId, input.version, userId, targetKey, input.stopId ?? null, venueId, input.reaction]);
    const likes = await client.query(`SELECT target_key,count(*) FILTER (WHERE reaction='like')::int AS likes
      FROM itinerary_reactions WHERE itinerary_id=$1 GROUP BY target_key`, [itineraryId]);
    const liked = new Map(likes.rows.map(row => [row.target_key, row.likes]));
    const itinerary = publicItinerarySchema.parse({
      ...current.itinerary,
      stops: current.itinerary.stops.map(item => ({
        ...item,
        locked: item.locked || liked.get(item.stop_id) === 2,
      })),
    });
    await client.query('UPDATE session_itineraries SET payload=$2 WHERE id=$1', [itineraryId, itinerary]);
    return publicProjection({ sessionId: current.session.id, version: input.version, itinerary });
  });
}

export async function recordPreferenceFeedback(userId: string, itineraryId: string, input: PreferenceFeedback) {
  return transaction(async client => {
    const current = await currentItinerary(client, userId, itineraryId, true);
    if (current.session.version !== input.version) throw new ApiError(409, 'VERSION_CONFLICT');
    const stop = current.itinerary.stops.find(item => item.stop_id === input.stopId);
    if (!stop) throw new ApiError(404, 'NOT_FOUND');
    const consent = await client.query(`SELECT p.personalization_enabled FROM terms_acceptances a
      LEFT JOIN consent_preferences p ON p.user_id=a.user_id AND p.terms_version=a.terms_version
      WHERE a.user_id=$1 AND a.terms_version=$2`, [userId, CURRENT_TERMS_VERSION]);
    if (!consent.rowCount) throw new ApiError(409, 'TERMS_REQUIRED');
    const inserted = await client.query(`INSERT INTO preference_feedback_events(
      id,user_id,session_id,session_version,itinerary_id,stop_id,venue_id,signal,attribute,target_min_delta)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'bright',0.10)
      ON CONFLICT (user_id,itinerary_id,stop_id,signal) DO NOTHING
      RETURNING id`, [randomUUID(), userId, current.session.id, input.version, itineraryId, input.stopId, stop.venue_id, input.signal]);
    let longTermPreferenceVersion: number | null = null;
    if (inserted.rowCount && consent.rows[0].personalization_enabled) {
      const preference = await client.query(`INSERT INTO user_preference_versions(user_id,version)
        VALUES ($1,1) ON CONFLICT (user_id) DO UPDATE SET
        version=user_preference_versions.version+1,updated_at=clock_timestamp()
        RETURNING version`, [userId]);
      longTermPreferenceVersion = preference.rows[0].version;
      await client.query(`UPDATE preference_feedback_events SET long_term_applied=true,
        terms_version=$2,preference_version_after=$3 WHERE id=$1`,
      [inserted.rows[0].id, CURRENT_TERMS_VERSION, longTermPreferenceVersion]);
    } else if (!inserted.rowCount) {
      const existing = await client.query(`SELECT preference_version_after FROM preference_feedback_events
        WHERE user_id=$1 AND itinerary_id=$2 AND stop_id=$3 AND signal=$4`,
      [userId, itineraryId, input.stopId, input.signal]);
      longTermPreferenceVersion = existing.rows[0]?.preference_version_after ?? null;
    }
    return publicProjection({
      sessionId: current.session.id, version: input.version, sessionApplied: true, longTermPreferenceVersion,
    });
  });
}

export async function replan(userId: string, itineraryId: string, expectedVersion: number) {
  return transaction(async client => {
    const current = await currentItinerary(client, userId, itineraryId, true);
    if (current.session.version !== expectedVersion) throw new ApiError(409, 'VERSION_CONFLICT');
    await assertNotFinalized(client, current.session.id, expectedVersion);
    const reactions = await client.query(
      'SELECT target_key,stop_id,venue_id,reaction FROM itinerary_reactions WHERE itinerary_id=$1', [itineraryId],
    );
    const locked = current.itinerary.stops.filter(stop => stop.locked);
    const wholeConflict = reactions.rows.some(row => row.target_key === '__itinerary__'
      && (row.reaction === 'dislike' || row.reaction === 'replace'));
    const excluded = new Set<string>(wholeConflict
      ? current.itinerary.stops.filter(stop => !stop.locked).map(stop => stop.venue_id)
      : reactions.rows.filter(row => row.venue_id && (row.reaction === 'dislike' || row.reaction === 'replace'))
        .map(row => row.venue_id));
    for (const stop of locked) excluded.delete(stop.venue_id);
    if (!excluded.size) throw new ApiError(409, 'REACTION_REQUIRED');
    const context = await recommendationContext(client, current.session);
    const replanned = safeItineraries(composeItineraries({
      sessionId: current.session.id,
      version: expectedVersion,
      shared: context.shared,
      parserOutputs: context.parserOutputs,
      venues: context.venues,
      legs: context.legs,
      dataMode: context.dataMode, datasetVersion: context.datasetVersion, routeMatrixVersion: context.routeMatrixVersion,
      requiredVenueIds: locked.map(stop => stop.venue_id),
      excludedVenueIds: [...excluded],
      resultLimit: 1,
      itineraryId,
      lockedStopIdsByVenue: Object.fromEntries(locked.map(stop => [stop.venue_id, stop.stop_id])),
      lockedOrderByVenue: Object.fromEntries(locked.map(stop => [stop.venue_id, stop.order_no])),
      lockedSlotIdsByVenue: Object.fromEntries(locked.flatMap(stop => stop.execution_slot_id
        ? [[stop.venue_id, stop.execution_slot_id]] : [])),
    }), context.privateTexts);
    if (replanned.length !== 1) throw new ApiError(422, 'NO_FEASIBLE_REPLAN');
    const lockedBefore = new Set(locked.map(stop => `${stop.stop_id}:${stop.venue_id}:${stop.order_no}`));
    if ([...lockedBefore].some(key => !replanned[0].stops.some(stop => `${stop.stop_id}:${stop.venue_id}:${stop.order_no}` === key && stop.locked))) {
      throw new ApiError(500, 'LOCKED_STOP_CHANGED');
    }
    if (locked.some(before => before.execution_slot_id && !replanned[0].stops.some(after =>
      after.stop_id === before.stop_id && after.execution_slot_id === before.execution_slot_id))) {
      throw new ApiError(500, 'LOCKED_STOP_CHANGED');
    }
    await client.query('UPDATE session_itineraries SET payload=$2 WHERE id=$1', [itineraryId, replanned[0]]);
    await client.query(`DELETE FROM itinerary_reactions WHERE itinerary_id=$1
      AND (venue_id IS NULL OR NOT (venue_id=ANY($2::text[])))`, [itineraryId, replanned[0].stops.map(stop => stop.venue_id)]);
    await client.query('DELETE FROM session_finalize_choices WHERE itinerary_id=$1', [itineraryId]);
    return publicProjection({ sessionId: current.session.id, version: expectedVersion, itinerary: replanned[0] });
  });
}

export async function finalize(userId: string, sessionId: string, expectedVersion: number, itineraryId: string) {
  return transaction(async client => {
    const session = await memberSession(client, userId, sessionId, true);
    if (session.version !== expectedVersion) throw new ApiError(409, 'VERSION_CONFLICT');
    const existing = await client.query(
      'SELECT itinerary_id FROM session_finalizations WHERE session_id=$1 AND session_version=$2',
      [sessionId, expectedVersion],
    );
    if (existing.rowCount) {
      if (existing.rows[0].itinerary_id !== itineraryId) throw new ApiError(409, 'SESSION_FINALIZED');
      return publicProjection({ sessionId, version: expectedVersion, status: 'finalized', finalizedItineraryId: itineraryId, selections: 2 });
    }
    const selected = await client.query(`SELECT 1 FROM session_itineraries
      WHERE id=$1 AND session_id=$2 AND session_version=$3`, [itineraryId, sessionId, expectedVersion]);
    if (!selected.rowCount) throw new ApiError(404, 'NOT_FOUND');
    await client.query(`INSERT INTO session_finalize_choices(session_id,session_version,user_id,itinerary_id)
      VALUES ($1,$2,$3,$4) ON CONFLICT (session_id,session_version,user_id) DO UPDATE SET
      itinerary_id=EXCLUDED.itinerary_id,selected_at=clock_timestamp()`,
    [sessionId, expectedVersion, userId, itineraryId]);
    const choices = await client.query(`SELECT count(*)::int AS selections,
      count(DISTINCT itinerary_id)::int AS distinct_choices,min(itinerary_id::text)::uuid AS itinerary_id
      FROM session_finalize_choices c JOIN couple_members m ON m.user_id=c.user_id AND m.couple_id=$3
      WHERE c.session_id=$1 AND c.session_version=$2`, [sessionId, expectedVersion, session.couple_id]);
    const state = choices.rows[0];
    if (state.selections === 2 && state.distinct_choices === 1) {
      await client.query(`INSERT INTO session_finalizations(session_id,session_version,itinerary_id)
        VALUES ($1,$2,$3)`, [sessionId, expectedVersion, state.itinerary_id]);
      return publicProjection({ sessionId, version: expectedVersion, status: 'finalized',
        finalizedItineraryId: state.itinerary_id, selections: 2 });
    }
    return publicProjection({ sessionId, version: expectedVersion,
      status: state.selections === 2 ? 'choice_conflict' : 'pending_partner',
      finalizedItineraryId: null, selections: state.selections });
  });
}

export async function list(userId: string, sessionId: string) {
  const result = await pool().query(`SELECT s.version,i.payload,f.itinerary_id AS finalized_itinerary_id FROM date_sessions s
    JOIN couple_members m ON m.couple_id=s.couple_id AND m.user_id=$2
    LEFT JOIN session_itineraries i ON i.session_id=s.id AND i.session_version=s.version
    LEFT JOIN session_finalizations f ON f.session_id=s.id AND f.session_version=s.version
    WHERE s.id=$1 ORDER BY i.rank_no`, [sessionId, userId]);
  if (!result.rowCount) throw new ApiError(404, 'NOT_FOUND');
  const itineraries = result.rows.filter(row => row.payload).map(row => publicItinerarySchema.safeParse(row.payload));
  if (itineraries.some(item => !item.success)) throw new ApiError(503, 'RECOMMENDATION_DATA_INVALID');
  const payloads = itineraries.map(item => item.success ? item.data : null).filter(item => item !== null);
  if (payloads.some(item => !safePublicReason(item.public_reason, []))) {
    throw new ApiError(503, 'RECOMMENDATION_DATA_INVALID');
  }
  return publicProjection({ sessionId, version: result.rows[0].version,
    finalizedItineraryId: result.rows[0].finalized_itinerary_id ?? null, itineraries: payloads });
}
