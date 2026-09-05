import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { localPostgres } from '../scripts/postgres';
import { seedShowcase } from '../scripts/seed-showcase';
import { CURRENT_TERMS_VERSION } from '../src/server/contracts';
import {
  buildAndActivateVenueRecommendationIndex, buildVenueRecommendationIndex, collectRankingPreferenceCandidates,
  exportRankingPreferenceDataset, exportRequirementDataset, getActiveVenueRecommendationIndex,
  reviewLearningCandidate, revokeLearningCandidatesForUser, revokeLearningCandidatesForFeedback, submitRequirementCandidate,
} from '../src/server/learning';
import { parseRequirementJsonl, validateRequirementDataset } from '../src/model/requirements';

async function userWithConsent(db: Pool) {
  const userId = randomUUID();
  await db.query('INSERT INTO anonymous_users(id,token_hash,expires_at) VALUES ($1,$2,now()+interval \'1 day\')', [userId, randomUUID()]);
  await db.query('INSERT INTO terms_acceptances(user_id,terms_version) VALUES ($1,$2)', [userId, CURRENT_TERMS_VERSION]);
  await db.query(`INSERT INTO consent_preferences(user_id,terms_version,model_improvement_opt_in)
    VALUES ($1,$2,true)`, [userId, CURRENT_TERMS_VERSION]);
  return userId;
}

async function requirement(db: Pool, userId: string, split: 'train' | 'validation' | 'test', suffix: string) {
  const feedbackId = randomUUID();
  await db.query(`INSERT INTO venue_feedback(id,user_id,venue_id,visit_state)
    VALUES ($1,$2,$3,'saved')`, [feedbackId, userId, `venue_learning_${suffix}`]);
  const client = await db.connect();
  try {
    const created = await submitRequirementCandidate(client, {
      userId, sourceFeedbackId: feedbackId, correctedText: `希望場地明亮一點${suffix}`,
      annotations: [{ attribute: 'bright', direction: 'prefer', degree: 'high', evidenceText: '明亮一點' }],
      expectedConstraints: [], needsClarification: false, clarificationReason: null,
      deidentifiedBy: 'human_reviewer', taxonomyVersion: 'adjective_v1',
    });
    await reviewLearningCandidate(client, { candidateId: created.candidateId, reviewer: 'human_reviewer', decision: 'approved', split });
    return created;
  } finally { client.release(); }
}

test('requirement exports need current consent, human de-identification review, and remain withdrawable', { timeout: 60_000 }, async () => {
  const { postgres, url } = await localPostgres(`.local/tests/learning-requirements-${Date.now()}`);
  const db = new Pool({ connectionString: url });
  try {
    const trainUserId = await userWithConsent(db);
    const validationUserId = await userWithConsent(db);
    const testUserId = await userWithConsent(db);
    await requirement(db, trainUserId, 'train', 'a');
    await requirement(db, validationUserId, 'validation', 'b');
    await requirement(db, testUserId, 'test', 'c');
    const client = await db.connect();
    try {
      const exported = await exportRequirementDataset(client, 'requirements_real_v1', 'adjective_v1');
      const parsed = parseRequirementJsonl(exported.jsonl);
      assert.deepEqual(parsed.errors, []);
      assert.deepEqual(validateRequirementDataset(parsed.samples).errors, []);
      assert.ok(parsed.samples.every(sample => sample.sourceType === 'consented_feedback'));
      assert.ok(parsed.samples.every(sample => sample.groupId.startsWith('participant_')));
      assert.ok(!exported.jsonl.includes(trainUserId));
      await revokeLearningCandidatesForUser(client, trainUserId);
      await assert.rejects(() => exportRequirementDataset(client, 'requirements_real_v2', 'adjective_v1'), /split is empty/);
    } finally { client.release(); }
    assert.equal((await db.query("SELECT status FROM learning_dataset_exports WHERE version='requirements_real_v1'")).rows[0].status, 'withdrawn');
  } finally { await db.end(); await postgres.stop(); }
});

test('five allowlist events produce ranking candidates, never requirement text corpus', { timeout: 60_000 }, async () => {
  const { postgres, url } = await localPostgres(`.local/tests/learning-ranking-${Date.now()}`);
  const db = new Pool({ connectionString: url });
  try {
    const userId = await userWithConsent(db), coupleId = randomUUID(), sessionId = randomUUID(), itineraryId = randomUUID();
    await db.query('INSERT INTO couples(id,invite_hash,invite_expires_at) VALUES ($1,$2,now()+interval \'1 day\')', [coupleId, randomUUID()]);
    await db.query('INSERT INTO date_sessions(id,couple_id,version) VALUES ($1,$2,1)', [sessionId, coupleId]);
    await db.query(`INSERT INTO session_itineraries(id,session_id,session_version,rank_no,payload)
      VALUES ($1,$2,1,1,'{}')`, [itineraryId, sessionId]);
    await db.query(`INSERT INTO preference_feedback_events(id,user_id,session_id,session_version,itinerary_id,stop_id,
      venue_id,signal,attribute,target_delta,target_bound)
      VALUES ($1,$2,$3,1,$4,$5,'venue_learning_rank','too_noisy','quiet',0.10,'min')`,
    [randomUUID(), userId, sessionId, itineraryId, randomUUID()]);
    const client = await db.connect();
    try {
      assert.equal((await collectRankingPreferenceCandidates(client)).created, 1);
      const row = (await client.query("SELECT id,corrected_text FROM learning_candidates WHERE candidate_kind='ranking_preference'")).rows[0];
      assert.equal(row.corrected_text, null);
      await reviewLearningCandidate(client, { candidateId: row.id, reviewer: 'human_reviewer', decision: 'approved', split: 'unassigned' });
      const exported = await exportRankingPreferenceDataset(client, 'ranking_real_v1');
      assert.match(exported.json, /ranking_preference_events_not_text_classification/);
      assert.doesNotMatch(exported.json, /correctedText|annotations/);
      await reviewLearningCandidate(client, { candidateId: row.id, reviewer: 'human_reviewer', decision: 'approved', split: 'unassigned' });
      await assert.rejects(() => exportRankingPreferenceDataset(client, 'ranking_real_v1'), /DATASET_VERSION_WITHDRAWN/);
      await client.query('UPDATE learning_candidates SET consent_terms_version=$1 WHERE id=$2', ['old-terms', row.id]);
      await assert.rejects(() => exportRankingPreferenceDataset(client, 'ranking_real_v2'), /RANKING_DATASET_EMPTY/);
    } finally { client.release(); }
  } finally { await db.end(); await postgres.stop(); }
});

test('changed source feedback withdraws its approved learning candidate and frozen export', { timeout: 60_000 }, async () => {
  const { postgres, url } = await localPostgres(`.local/tests/learning-source-${Date.now()}`);
  const db = new Pool({ connectionString: url });
  try {
    const users = await Promise.all([userWithConsent(db), userWithConsent(db), userWithConsent(db)]);
    const sample = await requirement(db, users[0], 'train', 'd');
    await requirement(db, users[1], 'validation', 'e');
    await requirement(db, users[2], 'test', 'f');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await exportRequirementDataset(client, 'source_snapshot_v1', 'adjective_v1');
      const row = (await client.query('SELECT venue_feedback_id FROM learning_candidates WHERE id=$1', [sample.candidateId])).rows[0];
      await revokeLearningCandidatesForFeedback(client, row.venue_feedback_id);
      assert.equal((await client.query("SELECT status FROM learning_dataset_exports WHERE version='source_snapshot_v1'")).rows[0].status, 'withdrawn');
      await assert.rejects(() => reviewLearningCandidate(client, { candidateId: sample.candidateId, reviewer: 'human_reviewer', decision: 'approved', split: 'train' }), /REVOKED/);
      await client.query('COMMIT');
    } finally { client.release(); }
  } finally { await db.end(); await postgres.stop(); }
});

test('active venue index contains only policy-eligible facts from the active approved dataset', { timeout: 60_000 }, async () => {
  const { postgres, url } = await localPostgres(`.local/tests/learning-venue-index-${Date.now()}`);
  const db = new Pool({ connectionString: url });
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = url;
  try {
    await seedShowcase(url);
    const built = await buildAndActivateVenueRecommendationIndex('approved_index_v1');
    assert.equal(built.recordCount, 13);
    assert.equal(built.reused, false);
    assert.equal((await buildAndActivateVenueRecommendationIndex('approved_index_v1')).reused, true);
    const client = await db.connect();
    try {
      const active = await getActiveVenueRecommendationIndex(client);
      assert.equal(active?.indexVersion, 'approved_index_v1');
      assert.equal(active?.entries.length, 13);
      assert.ok(active?.entries.every(entry => !('google_place_id' in entry)));
      assert.ok(active?.entries.every(entry => entry.price_min_twd <= entry.price_max_twd));
      await client.query('BEGIN');
      await buildVenueRecommendationIndex(client, 'approved_index_v2');
      await client.query('ROLLBACK');
      assert.equal((await getActiveVenueRecommendationIndex(client))?.indexVersion, 'approved_index_v1');
    } finally { client.release(); }
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
    await db.end(); await postgres.stop();
  }
});
