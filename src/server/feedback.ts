import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool, transaction } from './db';
import {
  ApiError, CURRENT_TERMS_VERSION, type FeedbackInput, type FeedbackPatch,
} from './contracts';
import { publicProjection } from './privacy';

async function requireTerms(client: PoolClient, userId: string) {
  const accepted = await client.query(
    'SELECT 1 FROM terms_acceptances WHERE user_id=$1 AND terms_version=$2',
    [userId, CURRENT_TERMS_VERSION],
  );
  if (!accepted.rowCount) throw new ApiError(409, 'TERMS_REQUIRED');
}

function consentView(row?: Record<string, unknown>) {
  return {
    requiredTermsVersion: CURRENT_TERMS_VERSION,
    termsAccepted: Boolean(row),
    acceptedAt: row?.accepted_at ?? null,
    personalizationEnabled: row?.personalization_enabled ?? false,
    modelImprovementOptIn: row?.model_improvement_opt_in ?? false,
    updatedAt: row?.updated_at ?? null,
  };
}

export async function getConsents(userId: string) {
  const result = await pool().query(`SELECT a.accepted_at,p.personalization_enabled,
    p.model_improvement_opt_in,p.updated_at FROM terms_acceptances a
    LEFT JOIN consent_preferences p ON p.user_id=a.user_id AND p.terms_version=a.terms_version
    WHERE a.user_id=$1 AND a.terms_version=$2`, [userId, CURRENT_TERMS_VERSION]);
  return consentView(result.rows[0]);
}

export async function updateConsents(
  userId: string,
  input: { termsVersion: string; personalizationEnabled: boolean; modelImprovementOptIn: boolean },
) {
  return transaction(async client => {
    await client.query(`INSERT INTO terms_acceptances(user_id,terms_version) VALUES ($1,$2)
      ON CONFLICT (user_id,terms_version) DO NOTHING`, [userId, input.termsVersion]);
    const result = await client.query(`INSERT INTO consent_preferences(
      user_id,terms_version,personalization_enabled,model_improvement_opt_in)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (user_id) DO UPDATE SET terms_version=EXCLUDED.terms_version,
        personalization_enabled=EXCLUDED.personalization_enabled,
        model_improvement_opt_in=EXCLUDED.model_improvement_opt_in,updated_at=clock_timestamp()
      RETURNING personalization_enabled,model_improvement_opt_in,updated_at`,
    [userId, input.termsVersion, input.personalizationEnabled, input.modelImprovementOptIn]);
    const accepted = await client.query(
      'SELECT accepted_at FROM terms_acceptances WHERE user_id=$1 AND terms_version=$2',
      [userId, input.termsVersion],
    );
    if (!input.personalizationEnabled) {
      const changed = await client.query(`UPDATE session_inputs SET visibility='private_session',
        parser_output=CASE WHEN parser_output->>'status'='parsed'
          THEN jsonb_set(parser_output,'{result,visibility}',to_jsonb('private_session'::text),false)
          ELSE parser_output END,
        updated_at=clock_timestamp()
        WHERE user_id=$1 AND visibility='private_remembered' RETURNING session_id`, [userId]);
      const sessionIds = changed.rows.map(row => row.session_id);
      if (sessionIds.length) {
        await client.query('UPDATE date_sessions SET version=version+1 WHERE id=ANY($1::uuid[])', [sessionIds]);
        await client.query('DELETE FROM session_confirmations WHERE session_id=ANY($1::uuid[])', [sessionIds]);
      }
    }
    return consentView({ ...accepted.rows[0], ...result.rows[0] });
  });
}

function privateView(row: Record<string, unknown>) {
  return {
    feedbackId: row.id,
    venueId: row.venue_id,
    noteText: row.note_text,
    userTags: row.user_tags,
    rating: row.rating_1_to_5,
    visitState: row.visit_state,
    visibility: row.visibility,
    moderationStatus: row.moderation_status,
    preferenceVersion: row.preference_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getOwnFeedback(userId: string, venueId: string) {
  const result = await pool().query(
    'SELECT * FROM venue_feedback WHERE user_id=$1 AND venue_id=$2 AND deleted_at IS NULL',
    [userId, venueId],
  );
  if (!result.rowCount) throw new ApiError(404, 'NOT_FOUND');
  return privateView(result.rows[0]);
}

export async function putOwnFeedback(userId: string, venueId: string, input: FeedbackInput) {
  return transaction(async client => {
    await requireTerms(client, userId);
    const result = await client.query(`INSERT INTO venue_feedback(
      id,user_id,venue_id,note_text,user_tags,rating_1_to_5,visit_state)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (user_id,venue_id) DO UPDATE SET note_text=EXCLUDED.note_text,
        user_tags=EXCLUDED.user_tags,rating_1_to_5=EXCLUDED.rating_1_to_5,
        visit_state=EXCLUDED.visit_state,
        moderation_status=CASE WHEN venue_feedback.visibility='public' THEN 'pending' ELSE 'none' END,
        updated_at=clock_timestamp(),deleted_at=NULL
      RETURNING *`, [randomUUID(), userId, venueId, input.noteText, input.userTags, input.rating, input.visitState]);
    return privateView(result.rows[0]);
  });
}

export async function patchOwnFeedback(userId: string, feedbackId: string, input: FeedbackPatch) {
  return transaction(async client => {
    const current = await client.query(
      'SELECT * FROM venue_feedback WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',
      [feedbackId, userId],
    );
    if (!current.rowCount) throw new ApiError(404, 'NOT_FOUND');
    const row = current.rows[0];
    const visibility = input.visibility ?? row.visibility;
    const changesContent = ['noteText', 'userTags', 'rating', 'visitState']
      .some(key => Object.prototype.hasOwnProperty.call(input, key));
    if (visibility === 'public' || changesContent) await requireTerms(client, userId);
    const value = <K extends keyof FeedbackPatch>(key: K, fallback: unknown) =>
      Object.prototype.hasOwnProperty.call(input, key) ? input[key] : fallback;
    const result = await client.query(`UPDATE venue_feedback SET note_text=$3,user_tags=$4,
      rating_1_to_5=$5,visit_state=$6,visibility=$7,
      moderation_status=CASE WHEN $7='public' THEN 'pending' ELSE 'none' END,
      updated_at=clock_timestamp() WHERE id=$1 AND user_id=$2 RETURNING *`, [
      feedbackId, userId, value('noteText', row.note_text), value('userTags', row.user_tags),
      value('rating', row.rating_1_to_5), value('visitState', row.visit_state), visibility,
    ]);
    return privateView(result.rows[0]);
  });
}

export async function deleteOwnFeedback(userId: string, feedbackId: string) {
  const result = await pool().query(`UPDATE venue_feedback SET visibility='private',
    moderation_status='deleted',deleted_at=clock_timestamp(),updated_at=clock_timestamp()
    WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`, [feedbackId, userId]);
  if (!result.rowCount) throw new ApiError(404, 'NOT_FOUND');
}

export async function listPublicReviews(venueId: string, limit: number, offset: number) {
  const result = await pool().query(`SELECT id,venue_id,note_text,user_tags,rating_1_to_5,created_at
    FROM venue_feedback WHERE venue_id=$1 AND visibility='public'
      AND moderation_status='approved' AND deleted_at IS NULL
    ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`, [venueId, limit + 1, offset]);
  const more = result.rows.length > limit;
  return publicProjection({
    reviews: result.rows.slice(0, limit).map(row => ({
      feedbackId: row.id,
      venueId: row.venue_id,
      noteText: row.note_text,
      userTags: row.user_tags,
      rating: row.rating_1_to_5,
      authorAlias: 'Sideby 使用者',
      createdAt: row.created_at,
    })),
    nextCursor: more ? String(offset + limit) : null,
  });
}
