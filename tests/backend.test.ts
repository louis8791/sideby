import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { freePort, localPostgres } from '../scripts/postgres';
import { migrate } from '../scripts/migrate';
import { CURRENT_TERMS_VERSION, type PublicState } from '../src/server/contracts';

const shared = {
  mode: 'future', startsAt: '2026-10-10T12:00:00+08:00', endsAt: '2026-10-10T18:00:00+08:00',
  meetingPoint: { label: '合成測試集合點', latitude: 25.04, longitude: 121.52 },
  budgetTwdTotal: 1800, transport: ['transit', 'walk'], stops: 3,
  outdoorAllowed: true, bookingAllowed: false,
};

test('Phase 1B + Phase 2: real PostgreSQL + built Next.js over HTTP', { timeout: 120000 }, async t => {
  const { postgres, url } = await localPostgres(`.local/tests/${Date.now()}`);
  const db = new Pool({ connectionString: url });
  let app: ChildProcess | undefined;
  let logs = '';
  t.after(async () => {
    if (app && app.exitCode === null) { const stopped = once(app, 'exit'); app.kill(); await stopped; }
    await db.end();
    await postgres.stop();
  });
  const port = await freePort(), base = `http://127.0.0.1:${port}`;
  async function start() {
    app = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', String(port)], {
      env: { ...process.env, DATABASE_URL: url, NEXT_TELEMETRY_DISABLED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    app.stdout?.on('data', chunk => { logs += chunk.toString(); });
    app.stderr?.on('data', chunk => { logs += chunk.toString(); });
    app.on('error', () => { logs += 'APP_SPAWN_FAILED'; });
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(`${base}/api/sessions`, { signal: AbortSignal.timeout(1000) })).status === 401) return; }
      catch { /* Application is still starting. */ }
      if (app.exitCode !== null) break;
      await delay(100);
    }
    throw new Error('Built backend did not start');
  }
  await start();
  async function call(method: string, path: string, token?: string, data?: unknown) {
    const response = await fetch(base + path, {
      method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const responseText = await response.text();
    return { status: response.status, data: responseText ? JSON.parse(responseText) : null };
  }
  const a = (await call('POST', '/api/auth/anonymous', undefined, {})).data.token;
  const b = (await call('POST', '/api/auth/anonymous', undefined, {})).data.token;
  const c = (await call('POST', '/api/auth/anonymous', undefined, {})).data.token;
  assert.ok(a && b && c);
  const room = (await call('POST', '/api/couples', a, {})).data;
  const sessionId = (await call('POST', '/api/sessions', a, { coupleId: room.coupleId })).data.sessionId;
  const path = `/api/sessions/${sessionId}`;

  await t.test('anonymous identity, protected endpoints and hashed credentials', async () => {
    assert.equal((await call('GET', path)).status, 401);
    assert.equal((await call('GET', path, 'invalid')).status, 401);
    const users = await db.query('SELECT token_hash FROM anonymous_users');
    assert.equal(users.rows.length, 3);
    for (const row of users.rows) { assert.match(row.token_hash, /^[a-f0-9]{64}$/); assert.notEqual(row.token_hash, a); }
    assert.equal((await call('GET', path, a)).data.status, 'waiting_partner');
  });
  await t.test('two concurrent joiners: exactly one joins, retries are idempotent', async () => {
    const results = await Promise.all([b, c].map(token => call('POST', '/api/couples/join', token, { inviteCode: room.inviteCode })));
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
    // Keep the main A/B flow deterministic even when C wins the race: use another room below.
    const winner = results[0].status === 200 ? b : c;
    assert.equal((await call('POST', '/api/couples/join', winner, { inviteCode: room.inviteCode })).status, 200);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM couple_members WHERE couple_id=$1', [room.coupleId])).rows[0].n, 2);
  });
  const mainRoom = (await call('POST', '/api/couples', a, {})).data;
  await call('POST', '/api/couples/join', b, { inviteCode: mainRoom.inviteCode });
  const mainId = (await call('POST', '/api/sessions', a, { coupleId: mainRoom.coupleId })).data.sessionId;
  const main = `/api/sessions/${mainId}`;
  let privateA = '', privateB = '', privateSessionId = '', privateMain = '';
  await t.test('nonmember cannot read, write, confirm, stream or create a session', async () => {
    for (const [method, endpoint, data] of [
      ['GET', main, undefined], ['PUT', main + '/shared', { version: 0, shared }],
      ['POST', main + '/confirm', { version: 0 }], ['GET', main + '/events', undefined],
      ['POST', '/api/sessions', { coupleId: mainRoom.coupleId }],
    ] as const) assert.equal((await call(method, endpoint, c, data)).status, 404);
    assert.equal((await call('POST', '/api/couples/join', c, { inviteCode: mainRoom.inviteCode })).data.error.code, 'ROOM_FULL');
    assert.equal((await call('POST', '/api/sessions', b, { coupleId: mainRoom.coupleId })).data.sessionId, mainId);
  });
  await t.test('strict input rejects private/identity fields, oversized body and overnight trips', async () => {
    for (const invalid of [
      { ...shared, raw_text: 'private-canary' },
      { ...shared, endsAt: '2026-10-11T01:00:00+08:00' },
      { ...shared, budgetTwdTotal: -1 },
    ]) assert.equal((await call('PUT', main + '/shared', a, { version: 0, shared: invalid })).status, 400);
    assert.equal((await call('POST', main + '/confirm', a, { version: 0, userId: 'B' })).status, 400);
    assert.equal((await call('POST', '/api/couples', a, { text: 'x'.repeat(9000) })).status, 413);
    assert.equal((await call('POST', main + '/confirm', a, { version: 0 })).data.error.code, 'SHARED_REQUIRED');
    const crossOrigin = await fetch(base + main, { headers: { Authorization: `Bearer ${a}`, Origin: 'https://untrusted.example' } });
    assert.equal(crossOrigin.status, 403);
  });
  await t.test('concurrent shared edits reject stale version without losing the accepted update', async () => {
    const results = await Promise.all([a, b].map((token, i) => call('PUT', main + '/shared', token, { version: 0, shared: { ...shared, budgetTwdTotal: 1800 + i } })));
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
    const current = (await call('GET', main, a)).data;
    assert.equal(current.version, 1);
    assert.equal(current.shared.budgetTwdTotal, results[0].status === 200 ? 1800 : 1801);
  });
  await t.test('independent confirmations and subsequent edits invalidate both', async () => {
    let result = await call('POST', main + '/confirm', a, { version: 1 });
    assert.deepEqual(result.data.members.map((m: { confirmed: boolean }) => m.confirmed), [true, false]);
    assert.equal((await call('POST', main + '/confirm', a, { version: 1 })).data.status, 'editing');
    assert.equal((await call('POST', main + '/confirm', b, { version: 1 })).data.status, 'ready');
    result = await call('PUT', main + '/shared', b, { version: 1, shared });
    assert.equal(result.data.version, 2);
    assert.deepEqual(result.data.members.map((m: { confirmed: boolean }) => m.confirmed), [false, false]);
    assert.equal((await call('POST', main + '/confirm', a, { version: 1 })).data.error.code, 'VERSION_CONFLICT');
  });
  async function stream(token: string, sessionPath = main) {
    const controller = new AbortController();
    const response = await fetch(base + sessionPath + '/events', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('content-type')?.includes('text/event-stream'));
    const reader = response.body!.getReader(), decoder = new TextDecoder();
    let buffer = '';
    return {
      async nextState(): Promise<PublicState> {
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
          for (;;) {
            const boundary = buffer.indexOf('\n\n');
            if (boundary >= 0) {
              const event = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
              if (event.startsWith('event: state\n')) return JSON.parse(event.slice('event: state\ndata: '.length));
              continue;
            }
            const { value, done } = await reader.read();
            if (done) throw new Error('Stream ended without expected state');
            buffer += decoder.decode(value, { stream: true });
          }
        } finally { clearTimeout(timer); }
      },
      close: async () => { controller.abort(); await reader.cancel().catch(() => {}); },
    };
  }
  await t.test('SSE synchronizes two subscribers and reconnect returns latest safe state', async () => {
    const sa = await stream(a), sb = await stream(b);
    try {
      assert.equal((await sa.nextState()).version, 2);
      assert.equal((await sb.nextState()).version, 2);
      const started = performance.now();
      await call('PUT', main + '/shared', a, { version: 2, shared: { ...shared, stops: 4 } });
      const states = await Promise.all([sa.nextState(), sb.nextState()]);
      const elapsed = Math.round(performance.now() - started);
      assert.ok(elapsed < 2000, `Local sync exceeded target: ${elapsed}ms`);
      t.diagnostic(`Local two-subscriber sync: ${elapsed} ms (single synthetic sample)`);
      for (const state of states) {
        assert.equal(state.version, 3); assert.equal(state.shared?.stops, 4);
        assert.deepEqual(Object.keys(state).sort(), ['coupleId', 'members', 'sessionId', 'shared', 'status', 'version']);
        for (const member of state.members) assert.deepEqual(Object.keys(member).sort(), ['confirmed', 'online', 'role']);
        for (const secret of [a, b, c, mainRoom.inviteCode, 'private-canary', 'token_hash']) assert.ok(!JSON.stringify(state).includes(secret));
      }
    } finally { await sa.close(); await sb.close(); }
    const reconnected = await stream(b);
    try { assert.equal((await reconnected.nextState()).version, 3); }
    finally { await reconnected.close(); }
  });
  await t.test('presence expires and returns on authenticated activity', async () => {
    await db.query("UPDATE couple_members SET last_seen_at=now()-interval '31 seconds' WHERE couple_id=$1 AND role='B'", [mainRoom.coupleId]);
    assert.equal((await call('GET', main, a)).data.members[1].online, false);
    assert.equal((await call('GET', main, b)).data.members[1].online, true);
  });
  await t.test('private inputs stay owner-only and supported wording is parsed without an external model API', async () => {
    privateA = (await call('POST', '/api/auth/anonymous', undefined, {})).data.token;
    privateB = (await call('POST', '/api/auth/anonymous', undefined, {})).data.token;
    const privateRoom = (await call('POST', '/api/couples', privateA, {})).data;
    await call('POST', '/api/couples/join', privateB, { inviteCode: privateRoom.inviteCode });
    privateSessionId = (await call('POST', '/api/sessions', privateA, { coupleId: privateRoom.coupleId })).data.sessionId;
    privateMain = `/api/sessions/${privateSessionId}`;
    await call('PUT', privateMain + '/shared', privateA, { version: 0, shared });
    const privatePath = privateMain + '/private-inputs';
    const privateCanary = '想找明亮、可愛但不要太幼稚，也不要走太多路。';
    assert.equal((await call('POST', privatePath, privateA, {
      rawText: privateCanary, tags: ['secret-desire-canary'], visibility: 'private_session',
    })).data.error.code, 'TERMS_REQUIRED');
    await call('PUT', '/api/me/consents', privateA, {
      termsVersion: CURRENT_TERMS_VERSION, acceptTerms: true,
      personalizationEnabled: false, modelImprovementOptIn: false,
    });
    const privateStream = await stream(privateB, privateMain);
    assert.equal((await privateStream.nextState()).version, 1);
    const saved = await call('POST', privatePath, privateA, {
      rawText: privateCanary, tags: ['secret-desire-canary'], visibility: 'private_session',
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.rawText, privateCanary);
    assert.equal(saved.data.parse.status, 'parsed');
    assert.equal(saved.data.parse.externalModelApiCalls, 0);
    assert.deepEqual(saved.data.parse.result.preferences.map((item: { attribute: string }) => item.attribute), ['bright', 'cute']);
    assert.deepEqual(saved.data.parse.result.avoid.map((item: { attribute: string }) => item.attribute), ['childish', 'walking']);
    assert.deepEqual(Object.keys(saved.data).sort(), [
      'createdAt', 'inputId', 'parse', 'rawText', 'sessionId', 'tags', 'updatedAt', 'visibility',
    ]);
    assert.equal((await call('GET', privatePath, privateA)).data.inputId, saved.data.inputId);
    assert.equal((await call('GET', privatePath, privateB)).status, 404);
    assert.equal((await call('GET', privatePath, c)).status, 404);
    assert.equal((await call('POST', privatePath, privateA, {
      rawText: privateCanary, tags: ['secret-desire-canary'], visibility: 'private_session', userId: 'B',
    })).status, 400);
    const publicState = await call('GET', privateMain, privateB);
    const realtimeState = await privateStream.nextState();
    await privateStream.close();
    assert.equal(publicState.data.version, 2);
    assert.equal(realtimeState.version, 2);
    assert.ok(!JSON.stringify(publicState.data).includes('secret-desire-canary'));
    assert.ok(!JSON.stringify(realtimeState).includes('secret-desire-canary'));
    assert.equal((await db.query(
      'SELECT count(*)::int AS n FROM session_inputs WHERE session_id=$1', [privateSessionId],
    )).rows[0].n, 1);
  });
  await t.test('remembered visibility follows personalization consent and ambiguous wording asks the owner', async () => {
    const privatePath = privateMain + '/private-inputs';
    assert.equal((await call('POST', privatePath, privateA, {
      rawText: '想安靜聊天。', tags: [], visibility: 'private_remembered',
    })).data.error.code, 'PERSONALIZATION_REQUIRED');
    await call('PUT', '/api/me/consents', privateA, {
      termsVersion: CURRENT_TERMS_VERSION, acceptTerms: true,
      personalizationEnabled: true, modelImprovementOptIn: false,
    });
    let remembered = await call('POST', privatePath, privateA, {
      rawText: '想安靜聊天。', tags: [], visibility: 'private_remembered',
    });
    assert.equal(remembered.data.visibility, 'private_remembered');
    assert.equal(remembered.data.parse.result.visibility, 'private_remembered');
    assert.equal(remembered.data.parse.result.context.remember, true);
    const withdrawal = await Promise.all([
      call('PUT', '/api/me/consents', privateA, {
        termsVersion: CURRENT_TERMS_VERSION, acceptTerms: true,
        personalizationEnabled: false, modelImprovementOptIn: false,
      }),
      call('POST', privatePath, privateA, {
        rawText: '想安靜聊天。', tags: [], visibility: 'private_session',
      }),
    ]);
    assert.deepEqual(withdrawal.map(result => result.status), [200, 200]);
    remembered = await call('GET', privatePath, privateA);
    assert.equal(remembered.data.visibility, 'private_session');
    assert.equal(remembered.data.parse.result.visibility, 'private_session');

    await call('PUT', '/api/me/consents', privateB, {
      termsVersion: CURRENT_TERMS_VERSION, acceptTerms: true,
      personalizationEnabled: false, modelImprovementOptIn: false,
    });
    const ambiguous = await call('POST', privatePath, privateB, {
      rawText: '想去有氣氛的地方。', tags: [], visibility: 'private_session',
    });
    assert.equal(ambiguous.data.parse.status, 'needs_clarification');
    assert.match(ambiguous.data.parse.clarification, /浪漫/);

    const currentVersion = (await call('GET', privateMain, privateA)).data.version;
    await call('POST', privateMain + '/confirm', privateA, { version: currentVersion });
    assert.equal((await call('POST', privateMain + '/confirm', privateB, { version: currentVersion })).data.status, 'ready');
    await call('POST', privatePath, privateA, {
      rawText: '希望明亮。', tags: [], visibility: 'private_session',
    });
    assert.equal((await call('GET', privateMain, privateB)).data.status, 'editing');
    assert.equal((await call('POST', privateMain + '/confirm', privateB, {
      version: currentVersion,
    })).data.error.code, 'VERSION_CONFLICT');
    assert.equal((await call('DELETE', privatePath, privateA)).status, 204);
    assert.equal((await call('GET', privatePath, privateA)).status, 404);
    assert.equal((await call('DELETE', privatePath, privateA)).status, 404);
  });
  await t.test('migration retry and application restart retain session version and conditions', async () => {
    await migrate(url);
    const stopped = once(app!, 'exit'); app!.kill(); await stopped;
    await start();
    const state = (await call('GET', main, b)).data;
    assert.equal(state.version, 3); assert.equal(state.shared.stops, 4);
  });
  await t.test('versioned consent is persistent and private feedback stays owner-only', async () => {
    const consentPath = '/api/me/consents';
    const before = await call('GET', consentPath, a);
    assert.deepEqual(before.data, {
      requiredTermsVersion: CURRENT_TERMS_VERSION, termsAccepted: false, acceptedAt: null,
      personalizationEnabled: false, modelImprovementOptIn: false, updatedAt: null,
    });
    const venuePath = '/api/me/venues/venue_example_001/feedback';
    const feedback = {
      noteText: '下午窗邊很明亮', userTags: ['明亮', '約會'], rating: 4, visitState: 'visited',
    };
    assert.equal((await call('PUT', venuePath, a, feedback)).data.error.code, 'TERMS_REQUIRED');
    assert.equal((await call('PUT', consentPath, a, {
      termsVersion: 'outdated', acceptTerms: true,
      personalizationEnabled: true, modelImprovementOptIn: false,
    })).status, 400);
    const accepted = await call('PUT', consentPath, a, {
      termsVersion: CURRENT_TERMS_VERSION, acceptTerms: true,
      personalizationEnabled: true, modelImprovementOptIn: false,
    });
    assert.equal(accepted.data.termsAccepted, true);
    assert.equal(accepted.data.personalizationEnabled, true);
    assert.equal(accepted.data.modelImprovementOptIn, false);
    assert.equal((await call('PUT', venuePath, a, { ...feedback, visibility: 'public' })).status, 400);
    const saved = await call('PUT', venuePath, a, feedback);
    assert.equal(saved.status, 200);
    assert.equal(saved.data.visibility, 'private');
    assert.equal(saved.data.moderationStatus, 'none');
    assert.deepEqual((await call('GET', venuePath, a)).data.userTags, ['明亮', '約會']);
    assert.equal((await call('GET', venuePath, b)).status, 404);
    assert.equal((await call('PUT', '/api/me/venues/venue_example_002/feedback', b, feedback)).data.error.code, 'TERMS_REQUIRED');
    const legacyId = '00000000-0000-4000-8000-000000000099';
    await db.query(`INSERT INTO venue_feedback(id,user_id,venue_id,visit_state)
      SELECT $1,id,'venue_legacy_001','saved' FROM anonymous_users WHERE token_hash=$2`, [
      legacyId, createHash('sha256').update(b).digest('hex'),
    ]);
    assert.equal((await call('PATCH', `/api/me/venue-feedback/${legacyId}`, b, { rating: 3 })).data.error.code, 'TERMS_REQUIRED');
    assert.equal((await call('DELETE', `/api/me/venue-feedback/${legacyId}`, b)).status, 204);
    assert.equal((await call('PUT', venuePath, a, { ...feedback, noteText: '<script>alert(1)</script>' })).status, 400);
    assert.equal((await call('PUT', venuePath, a, { ...feedback, noteText: '詳情 https://example.test' })).status, 400);
  });
  await t.test('public reviews require explicit publication and approval, and can be withdrawn', async () => {
    const own = (await call('GET', '/api/me/venues/venue_example_001/feedback', a)).data;
    const publicPath = '/api/venues/venue_example_001/public-reviews';
    assert.equal((await call('PATCH', `/api/me/venue-feedback/${own.feedbackId}`, b, { visibility: 'public' })).status, 404);
    assert.equal((await call('DELETE', `/api/me/venue-feedback/${own.feedbackId}`, b)).status, 404);
    let published = await call('PATCH', `/api/me/venue-feedback/${own.feedbackId}`, a, { visibility: 'public' });
    assert.equal(published.data.moderationStatus, 'pending');
    assert.deepEqual((await call('GET', publicPath, b)).data.reviews, []);
    await db.query("UPDATE venue_feedback SET moderation_status='approved' WHERE id=$1", [own.feedbackId]);
    const publicResult = await call('GET', publicPath + '?limit=1&cursor=0', b);
    assert.equal(publicResult.data.reviews.length, 1);
    assert.deepEqual(Object.keys(publicResult.data.reviews[0]).sort(), [
      'authorAlias', 'createdAt', 'feedbackId', 'noteText', 'rating', 'userTags', 'venueId',
    ]);
    const serialized = JSON.stringify(publicResult.data);
    for (const secret of [a, b, own.userId, 'personalizationEnabled', 'modelImprovementOptIn']) {
      if (secret) assert.ok(!serialized.includes(secret));
    }
    published = await call('PATCH', `/api/me/venue-feedback/${own.feedbackId}`, a, { visibility: 'private' });
    assert.equal(published.data.moderationStatus, 'none');
    assert.deepEqual((await call('GET', publicPath, b)).data.reviews, []);
    await call('PATCH', `/api/me/venue-feedback/${own.feedbackId}`, a, { visibility: 'public' });
    await db.query("UPDATE venue_feedback SET moderation_status='approved' WHERE id=$1", [own.feedbackId]);
    assert.equal((await call('DELETE', `/api/me/venue-feedback/${own.feedbackId}`, a)).status, 204);
    assert.equal((await call('GET', '/api/me/venues/venue_example_001/feedback', a)).status, 404);
    assert.deepEqual((await call('GET', publicPath, b)).data.reviews, []);
    assert.equal((await call('GET', publicPath + '?cursor=-1', b)).status, 400);
  });
  await t.test('model improvement consent changes independently from publication', async () => {
    const result = await call('PUT', '/api/me/consents', a, {
      termsVersion: CURRENT_TERMS_VERSION, acceptTerms: true,
      personalizationEnabled: false, modelImprovementOptIn: true,
    });
    assert.equal(result.data.personalizationEnabled, false);
    assert.equal(result.data.modelImprovementOptIn, true);
    const stored = await call('GET', '/api/me/consents', a);
    assert.equal(stored.data.personalizationEnabled, false);
    assert.equal(stored.data.modelImprovementOptIn, true);
    assert.equal((await db.query(
      'SELECT count(*)::int AS n FROM venue_feedback WHERE visibility=\'public\' AND deleted_at IS NULL',
    )).rows[0].n, 0);
  });
  await t.test('database query failure returns a safe 503 instead of a fake success or SQL details', async () => {
    await db.query('ALTER TABLE anonymous_users RENAME TO unavailable_users');
    try {
      const result = await call('GET', main, a);
      assert.equal(result.status, 503);
      assert.deepEqual(result.data, { error: { code: 'SERVICE_UNAVAILABLE' } });
    } finally { await db.query('ALTER TABLE unavailable_users RENAME TO anonymous_users'); }
    assert.equal((await call('GET', main, a)).status, 200);
  });
  await t.test('expired identity and expired invite fail closed', async () => {
    const expiredRoom = (await call('POST', '/api/couples', a, {})).data;
    await db.query("UPDATE couples SET invite_expires_at=now()-interval '1 second' WHERE id=$1", [expiredRoom.coupleId]);
    assert.equal((await call('POST', '/api/couples/join', c, { inviteCode: expiredRoom.inviteCode })).data.error.code, 'INVITE_UNAVAILABLE');
    await db.query("UPDATE anonymous_users SET expires_at=now()-interval '1 second'");
    assert.equal((await call('GET', main, a)).status, 401);
    assert.equal((await call('GET', main + '/events', b)).status, 401);
    for (const secret of [a, b, c, privateA, privateB, mainRoom.inviteCode, 'private-canary', 'secret-desire-canary', url]) assert.ok(!logs.includes(secret));
  });
});
