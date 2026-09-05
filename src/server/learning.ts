import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { PoolClient } from 'pg';
import { CURRENT_TERMS_VERSION } from './contracts';
import { pool, transaction } from './db';
import {
  learningReviewInput, learningVersion, requirementCandidateInput,
  type LearningReviewInput, type RequirementCandidateInput,
} from '../model/learning';
import {
  requirementSampleSchema, validateRequirementDataset, type RequirementSample,
} from '../model/requirements';
import { assessVenue } from '../venues/policy';

type Client = Pick<PoolClient, 'query'>;

// Serialize consent/source changes and export snapshots inside their transactions.
export async function lockLearningChanges(client: Client) {
  await client.query('SELECT pg_advisory_xact_lock(738923)');
}

function compactUuid(value: string) { return value.replaceAll('-', ''); }
function candidateKey(id: string) { return `candidate_${compactUuid(id)}`; }
function sha256(value: string) { return createHash('sha256').update(value).digest('hex'); }

async function requireCurrentModelConsent(client: Client, userId: string) {
  const result = await client.query(`SELECT p.terms_version FROM consent_preferences p
    JOIN terms_acceptances a ON a.user_id=p.user_id AND a.terms_version=p.terms_version
    WHERE p.user_id=$1 AND p.terms_version=$2 AND p.model_improvement_opt_in=true`,
  [userId, CURRENT_TERMS_VERSION]);
  if (!result.rowCount) throw new Error('CURRENT_MODEL_IMPROVEMENT_CONSENT_REQUIRED');
  return result.rows[0].terms_version as string;
}

async function participantKey(client: Client, userId: string) {
  const key = `participant_${compactUuid(randomUUID())}`;
  const result = await client.query(`INSERT INTO learning_participants(user_id,participant_key,revoked_at)
    VALUES ($1,$2,NULL) ON CONFLICT (user_id) DO UPDATE SET revoked_at=NULL
    RETURNING participant_key`, [userId, key]);
  return result.rows[0].participant_key as string;
}

export async function submitRequirementCandidate(client: Client, raw: RequirementCandidateInput) {
  await lockLearningChanges(client);
  const input = requirementCandidateInput.parse(raw);
  const termsVersion = await requireCurrentModelConsent(client, input.userId);
  const source = await client.query(`SELECT 1 FROM venue_feedback
    WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`, [input.sourceFeedbackId, input.userId]);
  if (!source.rowCount) throw new Error('SOURCE_FEEDBACK_NOT_FOUND');
  const id = randomUUID();
  const pseudonymousKey = await participantKey(client, input.userId);
  await client.query(`INSERT INTO learning_candidates(
    id,user_id,participant_key,candidate_kind,venue_feedback_id,corrected_text,
    annotation_targets,expected_constraints,needs_clarification,clarification_reason,
    deidentified_by,deidentified_at,taxonomy_version,consent_terms_version)
    VALUES ($1,$2,$3,'requirement_text',$4,$5,$6,$7,$8,$9,$10,clock_timestamp(),$11,$12)`, [
    id, input.userId, pseudonymousKey, input.sourceFeedbackId, input.correctedText,
    JSON.stringify(input.annotations), JSON.stringify(input.expectedConstraints), input.needsClarification,
    input.clarificationReason, input.deidentifiedBy, input.taxonomyVersion, termsVersion,
  ]);
  return { candidateId: id, participantKey: pseudonymousKey, status: 'pending' as const };
}

export async function collectRankingPreferenceCandidates(client: Client) {
  await lockLearningChanges(client);
  const rows = await client.query(`SELECT e.id,e.user_id,e.signal,e.attribute,e.target_bound,e.target_delta,p.terms_version
    FROM preference_feedback_events e
    JOIN consent_preferences p ON p.user_id=e.user_id
      AND p.terms_version=$1 AND p.model_improvement_opt_in=true
    JOIN terms_acceptances a ON a.user_id=p.user_id AND a.terms_version=p.terms_version
    LEFT JOIN learning_candidates c ON c.preference_feedback_event_id=e.id
    WHERE c.id IS NULL ORDER BY e.created_at,e.id`, [CURRENT_TERMS_VERSION]);
  let created = 0;
  for (const row of rows.rows) {
    const key = await participantKey(client, row.user_id);
    const inserted = await client.query(`INSERT INTO learning_candidates(
      id,user_id,participant_key,candidate_kind,preference_feedback_event_id,
      structured_target,taxonomy_version,consent_terms_version)
      VALUES ($1,$2,$3,'ranking_preference',$4,$5,'ranking_feedback_v1',$6)
      ON CONFLICT (preference_feedback_event_id) WHERE preference_feedback_event_id IS NOT NULL DO NOTHING
      RETURNING id`, [
      randomUUID(), row.user_id, key, row.id,
      JSON.stringify({ signal: row.signal, attribute: row.attribute, bound: row.target_bound, delta: Number(row.target_delta) }),
      row.terms_version,
    ]);
    created += inserted.rowCount ?? 0;
  }
  return { eligible: rows.rowCount ?? 0, created };
}

export async function reviewLearningCandidate(client: Client, raw: LearningReviewInput) {
  await lockLearningChanges(client);
  const input = learningReviewInput.parse(raw);
  const candidate = await client.query(
    'SELECT candidate_kind,user_id,revoked_at FROM learning_candidates WHERE id=$1 FOR UPDATE',
    [input.candidateId],
  );
  if (!candidate.rowCount) throw new Error('LEARNING_CANDIDATE_NOT_FOUND');
  if (candidate.rows[0].revoked_at) throw new Error('LEARNING_CANDIDATE_REVOKED');
  await requireCurrentModelConsent(client, candidate.rows[0].user_id);
  if (candidate.rows[0].candidate_kind === 'ranking_preference' && input.split !== 'unassigned') {
    throw new Error('RANKING_PREFERENCE_IS_NOT_TEXT_CORPUS');
  }
  await client.query(`UPDATE learning_dataset_exports SET status='withdrawn'
    WHERE version IN (SELECT dataset_version FROM learning_dataset_members WHERE candidate_id=$1)`, [input.candidateId]);
  await client.query(`UPDATE learning_candidates SET review_status=$2,reviewer=$3,
    reviewed_at=clock_timestamp(),split=$4 WHERE id=$1`,
  [input.candidateId, input.decision, input.reviewer, input.split]);
}

function requirementSample(row: Record<string, any>, datasetVersion: string): RequirementSample {
  return requirementSampleSchema.parse({
    schemaVersion: '1.0', sampleId: candidateKey(row.id), text: row.corrected_text,
    groupId: row.participant_key, sourceType: 'consented_feedback', sourceRef: candidateKey(row.id),
    annotations: row.annotation_targets, expectedConstraints: row.expected_constraints,
    needsClarification: row.needs_clarification, clarificationReason: row.clarification_reason,
    reviewer: row.reviewer, reviewStatus: 'approved', split: row.split,
    taxonomyVersion: row.taxonomy_version, datasetVersion,
  });
}

async function exportableCandidates(client: Client, kind: 'requirement_text' | 'ranking_preference', taxonomyVersion: string) {
  return client.query(`SELECT c.* FROM learning_candidates c
    JOIN learning_participants lp ON lp.user_id=c.user_id AND lp.participant_key=c.participant_key
    JOIN consent_preferences p ON p.user_id=c.user_id
      AND p.terms_version=$1 AND p.model_improvement_opt_in=true
    JOIN terms_acceptances a ON a.user_id=p.user_id AND a.terms_version=p.terms_version
    WHERE c.candidate_kind=$2 AND c.taxonomy_version=$3 AND c.review_status='approved'
      AND c.revoked_at IS NULL AND lp.revoked_at IS NULL AND c.consent_terms_version=$1
      AND (c.venue_feedback_id IS NULL OR EXISTS (
        SELECT 1 FROM venue_feedback f WHERE f.id=c.venue_feedback_id AND f.user_id=c.user_id AND f.deleted_at IS NULL))
    ORDER BY c.id`, [CURRENT_TERMS_VERSION, kind, taxonomyVersion]);
}

export async function exportRequirementDataset(
  client: Client, rawVersion: string, rawTaxonomyVersion: string,
) {
  const version = learningVersion.parse(rawVersion);
  await lockLearningChanges(client);
  const taxonomyVersion = learningVersion.parse(rawTaxonomyVersion);
  const rows = await exportableCandidates(client, 'requirement_text', taxonomyVersion);
  const samples = rows.rows.map(row => requirementSample(row, version));
  const validation = validateRequirementDataset(samples);
  if (validation.errors.length) throw new Error(`REQUIREMENT_DATASET_INVALID: ${validation.errors.join('; ')}`);
  const jsonl = `${samples.map(sample => JSON.stringify(sample)).join('\n')}\n`;
  const hash = sha256(jsonl);
  const existing = await client.query('SELECT content_sha256,status FROM learning_dataset_exports WHERE version=$1', [version]);
  if (existing.rowCount) {
    if (existing.rows[0].status !== 'frozen') throw new Error('DATASET_VERSION_WITHDRAWN');
    if (existing.rows[0].content_sha256 !== hash) throw new Error('DATASET_VERSION_ALREADY_FROZEN');
    return { version, jsonl, sha256: hash, count: samples.length, reused: true };
  }
  await client.query(`INSERT INTO learning_dataset_exports(
    version,corpus_kind,taxonomy_version,content_sha256,candidate_count)
    VALUES ($1,'requirement_text',$2,$3,$4)`, [version, taxonomyVersion, hash, samples.length]);
  for (const row of rows.rows) await client.query(
    'INSERT INTO learning_dataset_members(dataset_version,candidate_id) VALUES ($1,$2)', [version, row.id],
  );
  return { version, jsonl, sha256: hash, count: samples.length, reused: false };
}

export async function exportRankingPreferenceDataset(client: Client, rawVersion: string) {
  await lockLearningChanges(client);
  const version = learningVersion.parse(rawVersion);
  const rows = await exportableCandidates(client, 'ranking_preference', 'ranking_feedback_v1');
  if (!rows.rowCount) throw new Error('RANKING_DATASET_EMPTY');
  const events = rows.rows.map(row => ({
    candidateId: candidateKey(row.id), participantKey: row.participant_key,
    target: row.structured_target, reviewer: row.reviewer,
  }));
  const payload = { schemaVersion: '1.0', datasetVersion: version,
    corpusKind: 'ranking_preference_events_not_text_classification', events };
  const json = `${JSON.stringify(payload, null, 2)}\n`, hash = sha256(json);
  const existing = await client.query('SELECT content_sha256,status FROM learning_dataset_exports WHERE version=$1', [version]);
  if (existing.rowCount) {
    if (existing.rows[0].status !== 'frozen') throw new Error('DATASET_VERSION_WITHDRAWN');
    if (existing.rows[0].content_sha256 !== hash) throw new Error('DATASET_VERSION_ALREADY_FROZEN');
    return { version, json, sha256: hash, count: events.length, reused: true };
  }
  await client.query(`INSERT INTO learning_dataset_exports(
    version,corpus_kind,taxonomy_version,content_sha256,candidate_count)
    VALUES ($1,'ranking_preference','ranking_feedback_v1',$2,$3)`, [version, hash, events.length]);
  for (const row of rows.rows) await client.query(
    'INSERT INTO learning_dataset_members(dataset_version,candidate_id) VALUES ($1,$2)', [version, row.id],
  );
  return { version, json, sha256: hash, count: events.length, reused: false };
}

export async function revokeLearningCandidatesForUser(client: Client, userId: string) {
  await lockLearningChanges(client);
  await client.query('UPDATE learning_participants SET revoked_at=clock_timestamp() WHERE user_id=$1', [userId]);
  const revoked = await client.query(`UPDATE learning_candidates SET revoked_at=clock_timestamp()
    WHERE user_id=$1 AND revoked_at IS NULL RETURNING id`, [userId]);
  await client.query(`UPDATE learning_dataset_exports d SET status='withdrawn'
    WHERE d.status='frozen' AND EXISTS (SELECT 1 FROM learning_dataset_members m
      JOIN learning_candidates c ON c.id=m.candidate_id WHERE m.dataset_version=d.version AND c.user_id=$1)`, [userId]);
  return { revoked: revoked.rowCount ?? 0 };
}

export async function revokeLearningCandidatesForFeedback(client: Client, feedbackId: string) {
  await lockLearningChanges(client);
  await client.query(`UPDATE learning_candidates SET revoked_at=clock_timestamp()
    WHERE venue_feedback_id=$1 AND revoked_at IS NULL`, [feedbackId]);
  await client.query(`UPDATE learning_dataset_exports SET status='withdrawn' WHERE version IN (
    SELECT m.dataset_version FROM learning_dataset_members m JOIN learning_candidates c ON c.id=m.candidate_id
    WHERE c.venue_feedback_id=$1)`, [feedbackId]);
}

export async function buildVenueRecommendationIndex(client: Client, rawVersion: string) {
  const version = zVenueIndexVersion(rawVersion);
  const active = await client.query(`SELECT version FROM venue_datasets
    WHERE status='active' AND data_mode='approved_dataset' FOR UPDATE`);
  if (active.rowCount !== 1) throw new Error('ACTIVE_APPROVED_DATASET_REQUIRED');
  const datasetVersion = active.rows[0].version as string;
  const records = await client.query('SELECT venue_id,record FROM venue_records WHERE dataset_version=$1 ORDER BY venue_id', [datasetVersion]);
  const entries = records.rows.map(row => {
    const assessment = assessVenue(row.record);
    if (!assessment.itineraryEligible) throw new Error(`VENUE_NOT_RECOMMENDATION_ELIGIBLE: ${row.venue_id}`);
    const price = row.record.facts.price;
    const attributes = Object.fromEntries(assessment.approvedAttributes.filter(item => item.scope === 'general').map(item => [item.attribute, item.value]));
    return { venueId: row.venue_id as string, hash: sha256(JSON.stringify(row.record)),
      category: row.record.category as string, district: row.record.location.district as string,
      min: price.minTwd as number | null, max: price.maxTwd as number | null, basis: price.basis as string, attributes };
  });
  if (!entries.length) throw new Error('VENUE_RECOMMENDATION_INDEX_EMPTY');
  const existing = await client.query(`SELECT dataset_version,record_count
    FROM venue_recommendation_indexes WHERE version=$1 FOR UPDATE`, [version]);
  if (existing.rowCount) {
    const saved = await client.query(`SELECT venue_id,record_sha256,category,district,
      price_min_twd,price_max_twd,price_basis,approved_attributes
      FROM venue_recommendation_index_entries WHERE index_version=$1 ORDER BY venue_id`, [version]);
    const same = existing.rows[0].dataset_version === datasetVersion
      && existing.rows[0].record_count === entries.length
      && saved.rows.length === entries.length
      && entries.every((entry, index) => {
        const row = saved.rows[index];
        return row?.venue_id === entry.venueId && row.record_sha256 === entry.hash
          && row.category === entry.category && row.district === entry.district
          && row.price_min_twd === entry.min && row.price_max_twd === entry.max
          && row.price_basis === entry.basis
          && isDeepStrictEqual(row.approved_attributes, entry.attributes);
      });
    if (!same) throw new Error('VENUE_INDEX_VERSION_ALREADY_FROZEN');
    await client.query("UPDATE venue_recommendation_indexes SET status='stale' WHERE status='active' AND version<>$1", [version]);
    await client.query("UPDATE venue_recommendation_indexes SET status='active' WHERE version=$1", [version]);
    return { version, datasetVersion, recordCount: entries.length, reused: true };
  }
  await client.query("UPDATE venue_recommendation_indexes SET status='stale' WHERE status='active'");
  await client.query(`INSERT INTO venue_recommendation_indexes(version,dataset_version,status,record_count,activated_at)
    VALUES ($1,$2,'active',$3,clock_timestamp())`, [version, datasetVersion, entries.length]);
  await client.query(`INSERT INTO venue_recommendation_index_entries(
    index_version,venue_id,record_sha256,category,district,price_min_twd,price_max_twd,price_basis,approved_attributes)
    SELECT $1,item->>'venueId',item->>'hash',item->>'category',item->>'district',
      (item->>'min')::integer,(item->>'max')::integer,item->>'basis',item->'attributes'
    FROM jsonb_array_elements($2::jsonb) item`, [version, JSON.stringify(entries)]);
  return { version, datasetVersion, recordCount: entries.length, reused: false };
}

export async function buildAndActivateVenueRecommendationIndex(rawVersion: string) {
  return transaction(client => buildVenueRecommendationIndex(client, rawVersion));
}

function zVenueIndexVersion(value: string) {
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(value)) throw new Error('INVALID_VENUE_INDEX_VERSION');
  return value;
}

export async function getActiveVenueRecommendationIndex(client: Client = pool()) {
  const index = await client.query(`SELECT i.version,i.dataset_version,i.record_count,i.activated_at
    FROM venue_recommendation_indexes i JOIN venue_datasets d ON d.version=i.dataset_version
    WHERE i.status='active' AND d.status='active' AND d.data_mode='approved_dataset'`);
  if (!index.rowCount) return null;
  const entries = await client.query(`SELECT venue_id,record_sha256,category,district,
    price_min_twd,price_max_twd,price_basis,approved_attributes
    FROM venue_recommendation_index_entries WHERE index_version=$1 ORDER BY venue_id`, [index.rows[0].version]);
  return { indexVersion: index.rows[0].version, datasetVersion: index.rows[0].dataset_version,
    recordCount: index.rows[0].record_count, activatedAt: index.rows[0].activated_at, entries: entries.rows };
}

export async function withLearningTransaction<T>(run: (client: PoolClient) => Promise<T>) {
  return transaction(run);
}
