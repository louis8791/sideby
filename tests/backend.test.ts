import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { freePort, localPostgres } from '../scripts/postgres';
import { migrate } from '../scripts/migrate';
import { CURRENT_TERMS_VERSION, type PublicState } from '../src/server/contracts';
import {
  recommendationLegs, recommendationRecord, recommendationShared,
  recommendationSlot,
} from './recommendation-fixtures';

const shared = {
  mode: 'future', startsAt: '2026-10-10T12:00:00+08:00', endsAt: '2026-10-10T18:00:00+08:00',
  meetingPoint: { label: '合成測試集合點', latitude: 25.04, longitude: 121.52 },
  budgetTwdTotal: 1800, transport: ['transit', 'walk'], stops: 3,
  outdoorAllowed: true, bookingAllowed: false,
};

test('Phase 2 + Phase 3 + Phase 5 + Phase 6 backend: real PostgreSQL + built Next.js over HTTP', { timeout: 120000 }, async t => {
  const { postgres, url } = await localPostgres(`.local/tests/${Date.now()}`);
  const db = new Pool({ connectionString: url });
  let app: ChildProcess | undefined;
  let logs = '';
  let port = 0;
  let base = '';

  async function waitForExit(child: ChildProcess, timeoutMs: number) {
    if (child.exitCode !== null) return true;
    return new Promise<boolean>(resolveExit => {
      const finished = () => { clearTimeout(timer); resolveExit(true); };
      const timer = setTimeout(() => {
        child.off('exit', finished);
        resolveExit(false);
      }, timeoutMs);
      child.once('exit', finished);
    });
  }

  async function stop() {
    const child = app;
    if (!child) return;
    app = undefined;
    if (child.exitCode !== null) return;

    if (process.platform === 'win32' && child.pid) {
      const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore', windowsHide: true,
      });
      await new Promise<void>(done => {
        let settled = false;
        const finish = () => { if (!settled) { settled = true; done(); } };
        killer.once('error', finish);
        killer.once('exit', finish);
      });
    } else {
      child.kill('SIGTERM');
    }

    if (!(await waitForExit(child, 5000))) {
      child.kill('SIGKILL');
      if (!(await waitForExit(child, 5000))) throw new Error(`Built backend process ${child.pid ?? 'unknown'} did not stop`);
    }
  }

  t.after(async () => {
    await stop();
    await db.end();
    await postgres.stop();
  });
  async function start() {
    await stop();
    const previousPort = port;
    do { port = await freePort(); } while (port === previousPort);
    base = `http://127.0.0.1:${port}`;
    const logStart = logs.length;
    const child = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', String(port)], {
      env: { ...process.env, DATABASE_URL: url, NEXT_TELEMETRY_DISABLED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    app = child;
    child.stdout?.on('data', chunk => { logs += chunk.toString(); });
    child.stderr?.on('data', chunk => { logs += chunk.toString(); });
    child.on('error', error => { logs += `APP_SPAWN_FAILED: ${error.message}`; });
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(`${base}/api/sessions`, { signal: AbortSignal.timeout(1000) })).status === 401) return; }
      catch { /* Application is still starting. */ }
      if (child.exitCode !== null) break;
      await delay(100);
    }
    const detail = logs.slice(logStart).trim().slice(-2000) || 'no application output';
    await stop().catch(() => {});
    throw new Error(`Built backend did not start on port ${port} (exit ${child.exitCode}). ${detail}`);
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
    const sameOrigin = await fetch(base + main, { headers: { Authorization: `Bearer ${a}`, Origin: base } });
    assert.equal(sameOrigin.status, 200);
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
      rawText: privateCanary,
      normalizedText: '明亮、可愛、不要幼稚、少走路、浪漫',
      environment: { setting: 'outdoor', airConditioning: 'excluded' },
      tags: ['secret-desire-canary'], visibility: 'private_session',
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.rawText, privateCanary);
    assert.equal(saved.data.parse.status, 'parsed');
    assert.equal(saved.data.parse.externalModelApiCalls, 0);
    assert.deepEqual(saved.data.parse.result.hard_constraints.environment, { setting: 'outdoor', airConditioning: 'excluded' });
    assert.deepEqual((await call('GET', privatePath, privateA)).data.parse.result.hard_constraints.environment,
      { setting: 'outdoor', airConditioning: 'excluded' });
    assert.deepEqual(saved.data.parse.result.preferences.map((item: { attribute: string }) => item.attribute), ['bright', 'cute', 'romantic']);
    assert.deepEqual(saved.data.parse.result.avoid.map((item: { attribute: string }) => item.attribute), ['childish', 'walking']);
    assert.ok(!JSON.stringify(saved.data).includes('normalizedText'));
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
    assert.ok(!JSON.stringify(publicState.data).includes('environment'));
    assert.ok(!JSON.stringify(realtimeState).includes('environment'));
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
  await t.test('Phase 5 generation and Phase 6 reaction, replan and finalize fail closed', async () => {
    const phase5A = (await call('POST', '/api/auth/anonymous', undefined, {})).data.token;
    const phase5B = (await call('POST', '/api/auth/anonymous', undefined, {})).data.token;
    const phase5Room = (await call('POST', '/api/couples', phase5A, {})).data;
    await call('POST', '/api/couples/join', phase5B, { inviteCode: phase5Room.inviteCode });
    const phase5Id = (await call('POST', '/api/sessions', phase5A, { coupleId: phase5Room.coupleId })).data.sessionId;
    const phase5Path = `/api/sessions/${phase5Id}`;
    await call('PUT', phase5Path + '/shared', phase5A, { version: 0, shared: recommendationShared });
    for (const token of [phase5A, phase5B]) await call('PUT', '/api/me/consents', token, {
      termsVersion: CURRENT_TERMS_VERSION, acceptTerms: true,
      personalizationEnabled: false, modelImprovementOptIn: false,
    });
    await call('POST', phase5Path + '/private-inputs', phase5A, {
      rawText: '希望明亮。', tags: ['phase5-a-secret'], visibility: 'private_session',
    });
    await call('POST', phase5Path + '/private-inputs', phase5B, {
      rawText: '想安靜聊天。', tags: ['phase5-b-secret'], visibility: 'private_session',
    });
    assert.deepEqual((await call('GET', phase5Path + '/itineraries', phase5A)).data.itineraries, []);
    assert.equal((await call('POST', phase5Path + '/generate', c, { version: 3 })).status, 404);
    assert.equal((await call('POST', phase5Path + '/generate', phase5A, { version: 3, userId: 'B' })).status, 400);
    assert.equal((await call('POST', phase5Path + '/generate', phase5A, { version: 3 })).data.error.code, 'SESSION_NOT_READY');
    await call('POST', phase5Path + '/confirm', phase5A, { version: 3 });
    await call('POST', phase5Path + '/confirm', phase5B, { version: 3 });
    assert.equal((await call('POST', phase5Path + '/generate', phase5A, { version: 3 })).data.error.code, 'RECOMMENDATION_DATA_UNAVAILABLE');

    await db.query("INSERT INTO venue_datasets(version,status,approved_at) VALUES ('test-v1','active',now())");
    await db.query("INSERT INTO travel_matrix_versions(version,status,checked_at) VALUES ('matrix-v1','active',now())");
    for (let index = 1; index <= 8; index++) {
      const record = recommendationRecord(index), slot = recommendationSlot(index);
      await db.query('INSERT INTO venue_records(venue_id,dataset_version,record) VALUES ($1,$2,$3)', [record.venueId, 'test-v1', record]);
      await db.query('INSERT INTO venue_execution_slots(id,dataset_version,venue_id,execution) VALUES ($1,$2,$3,$4)', [slot.slotId, 'test-v1', slot.venueId, slot]);
    }
    for (const leg of recommendationLegs()) await db.query(`INSERT INTO travel_matrix(
      matrix_version,from_key,to_key,mode,minutes) VALUES ($1,$2,$3,$4,$5)`,
      [leg.matrixVersion, leg.fromKey, leg.toKey, leg.mode, leg.minutes]);

    const generated = await call('POST', phase5Path + '/generate', phase5A, { version: 3 });
    assert.equal(generated.status, 200);
    assert.equal(generated.data.itineraries.length, 3);
    assert.ok(generated.data.itineraries.every((item: { data_mode: string }) => item.data_mode === 'synthetic_demo'));
    const serialized = JSON.stringify(generated.data);
    for (const secret of ['希望明亮', '想安靜聊天', 'phase5-a-secret', 'phase5-b-secret', phase5A, phase5B]) {
      assert.ok(!serialized.includes(secret));
    }
    for (const itinerary of generated.data.itineraries) {
      assert.equal(itinerary.validation.hard_constraints_passed, true);
      assert.ok(itinerary.total_cost <= recommendationShared.budgetTwdTotal);
      assert.equal(itinerary.stops.length, 2);
    }
    const partnerView = await call('GET', phase5Path + '/itineraries', phase5B);
    assert.deepEqual(partnerView.data.itineraries, generated.data.itineraries);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM session_itineraries WHERE session_id=$1', [phase5Id])).rows[0].n, 3);

    await db.query(`UPDATE session_itineraries SET payload=payload || '{"private_note":"must not leave JSONB"}'::jsonb
      WHERE session_id=$1 AND rank_no=1`, [phase5Id]);
    assert.equal((await call('GET', phase5Path + '/itineraries', phase5A)).data.error.code, 'RECOMMENDATION_DATA_INVALID');
    const restored = await call('POST', phase5Path + '/generate', phase5A, { version: 3 });
    assert.equal(restored.status, 200);

    const immediateSource = restored.data.itineraries[0];
    const immediate = await call('POST', `/api/itineraries/${immediateSource.itinerary_id}/preference-feedback`, phase5A, {
      version: 3, stopId: immediateSource.stops[0].stop_id, signal: 'too_noisy',
    });
    assert.equal(immediate.data.sessionApplied, true);
    assert.equal(immediate.data.longTermPreferenceVersion, null);
    await call('POST', `/api/itineraries/${immediateSource.itinerary_id}/preference-feedback`, phase5A, {
      version: 3, stopId: immediateSource.stops[0].stop_id, signal: 'too_noisy',
    });
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM preference_feedback_events
      WHERE itinerary_id=$1 AND signal='too_noisy'`, [immediateSource.itinerary_id])).rows[0].n, 1);
    const regenerated = await call('POST', phase5Path + '/generate', phase5A, { version: 3 });
    assert.equal(regenerated.status, 200);
    assert.equal(regenerated.data.itineraries.length, 3);

    const target = regenerated.data.itineraries[0];
    const other = regenerated.data.itineraries[1];
    const lockedStop = target.stops[0];
    const rejectedStop = target.stops[1];
    const reactionPath = `/api/itineraries/${target.itinerary_id}/reactions`;
    const replanPath = `/api/itineraries/${target.itinerary_id}/replan`;
    assert.equal((await call('POST', reactionPath, c, {
      version: 3, stopId: lockedStop.stop_id, reaction: 'like',
    })).status, 404);
    assert.equal((await call('POST', reactionPath, phase5A, {
      version: 2, stopId: lockedStop.stop_id, reaction: 'like',
    })).data.error.code, 'VERSION_CONFLICT');
    assert.equal((await call('POST', replanPath, phase5A, { version: 2 })).data.error.code, 'VERSION_CONFLICT');
    assert.equal((await call('POST', phase5Path + '/finalize', phase5A, {
      version: 2, itineraryId: target.itinerary_id,
    })).data.error.code, 'VERSION_CONFLICT');

    assert.equal((await call('POST', reactionPath, phase5A, {
      version: 3, reaction: 'replace',
    })).status, 400);
    const singleLike = await call('POST', reactionPath, phase5A, {
      version: 3, stopId: lockedStop.stop_id, reaction: 'like',
    });
    assert.equal(singleLike.data.itinerary.stops.find((stop: { stop_id: string }) => stop.stop_id === lockedStop.stop_id).locked, false);
    assert.equal('reaction' in singleLike.data, false);
    await call('POST', reactionPath, phase5A, { version: 3, stopId: lockedStop.stop_id, reaction: 'like' });
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM itinerary_reactions
      WHERE itinerary_id=$1 AND user_id=(SELECT id FROM anonymous_users WHERE token_hash=$2)`,
    [target.itinerary_id, createHash('sha256').update(phase5A).digest('hex')])).rows[0].n, 1);
    assert.equal((await call('POST', phase5Path + '/generate', phase5A, { version: 3 })).data.error.code, 'DECISION_IN_PROGRESS');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM itinerary_reactions WHERE itinerary_id=$1',
      [target.itinerary_id])).rows[0].n, 1);
    const lockedResponse = await call('POST', reactionPath, phase5B, {
      version: 3, stopId: lockedStop.stop_id, reaction: 'like',
    });
    assert.equal(lockedResponse.data.itinerary.stops.find((stop: { stop_id: string }) => stop.stop_id === lockedStop.stop_id).locked, true);
    assert.equal((await call('POST', reactionPath, phase5A, {
      version: 3, stopId: lockedStop.stop_id, reaction: 'replace',
    })).data.error.code, 'LOCKED_STOP_CONFLICT');
    await call('POST', reactionPath, phase5A, { version: 3, stopId: rejectedStop.stop_id, reaction: 'replace' });
    const replanned = await call('POST', replanPath, phase5A, { version: 3 });
    assert.equal(replanned.status, 200);
    assert.equal(replanned.data.itinerary.itinerary_id, target.itinerary_id);
    assert.ok(replanned.data.itinerary.stops.some((stop: { stop_id: string; venue_id: string; order_no: number; locked: boolean }) =>
      stop.stop_id === lockedStop.stop_id && stop.venue_id === lockedStop.venue_id
      && stop.order_no === lockedStop.order_no && stop.locked));
    assert.ok(!replanned.data.itinerary.stops.some((stop: { venue_id: string }) => stop.venue_id === rejectedStop.venue_id));
    assert.equal(replanned.data.itinerary.validation.hard_constraints_passed, true);
    assert.ok(replanned.data.itinerary.total_cost <= recommendationShared.budgetTwdTotal);

    assert.equal((await call('POST', phase5Path + '/finalize', c, {
      version: 3, itineraryId: target.itinerary_id,
    })).status, 404);
    const firstChoice = await call('POST', phase5Path + '/finalize', phase5A, {
      version: 3, itineraryId: target.itinerary_id,
    });
    assert.equal(firstChoice.data.status, 'pending_partner');
    assert.equal((await call('POST', phase5Path + '/generate', phase5A, { version: 3 })).data.error.code, 'DECISION_IN_PROGRESS');
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM session_finalize_choices
      WHERE session_id=$1 AND session_version=3`, [phase5Id])).rows[0].n, 1);
    const conflict = await call('POST', phase5Path + '/finalize', phase5B, {
      version: 3, itineraryId: other.itinerary_id,
    });
    assert.equal(conflict.data.status, 'choice_conflict');
    const finalized = await call('POST', phase5Path + '/finalize', phase5B, {
      version: 3, itineraryId: target.itinerary_id,
    });
    assert.equal(finalized.data.status, 'finalized');
    assert.equal(finalized.data.finalizedItineraryId, target.itinerary_id);
    assert.equal((await call('GET', phase5Path + '/itineraries', phase5A)).data.finalizedItineraryId, target.itinerary_id);
    assert.equal((await call('POST', phase5Path + '/finalize', phase5A, {
      version: 3, itineraryId: target.itinerary_id,
    })).data.status, 'finalized');
    assert.equal((await call('POST', phase5Path + '/finalize', phase5A, {
      version: 3, itineraryId: other.itinerary_id,
    })).data.error.code, 'SESSION_FINALIZED');
    assert.equal((await call('POST', reactionPath, phase5A, {
      version: 3, stopId: lockedStop.stop_id, reaction: 'like',
    })).data.error.code, 'SESSION_FINALIZED');
    assert.equal((await call('POST', replanPath, phase5A, { version: 3 })).data.error.code, 'SESSION_FINALIZED');
    assert.equal((await call('POST', phase5Path + '/generate', phase5A, { version: 3 })).data.error.code, 'SESSION_FINALIZED');

    const preferencePath = `/api/itineraries/${target.itinerary_id}/preference-feedback`;
    assert.equal((await call('POST', preferencePath, phase5A, {
      version: 3, stopId: lockedStop.stop_id, signal: 'unknown_signal',
    })).status, 400);
    assert.equal((await call('POST', preferencePath, c, {
      version: 3, stopId: lockedStop.stop_id, signal: 'too_dark',
    })).status, 404);
    const sessionOnly = await call('POST', preferencePath, phase5A, {
      version: 3, stopId: lockedStop.stop_id, signal: 'too_dark',
    });
    assert.equal(sessionOnly.data.error.code, 'PERSONALIZATION_REQUIRED');
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM preference_feedback_events
      WHERE itinerary_id=$1 AND user_id=(SELECT id FROM anonymous_users WHERE token_hash=$2)`,
    [target.itinerary_id, createHash('sha256').update(phase5A).digest('hex')])).rows[0].n, 0);
    await call('PUT', '/api/me/consents', phase5B, {
      termsVersion: CURRENT_TERMS_VERSION, acceptTerms: true,
      personalizationEnabled: true, modelImprovementOptIn: false,
    });
    const remembered = await call('POST', preferencePath, phase5B, {
      version: 3, stopId: lockedStop.stop_id, signal: 'too_dark',
    });
    assert.equal(remembered.data.longTermPreferenceVersion, 1);
    assert.equal((await call('POST', preferencePath, phase5B, {
      version: 3, stopId: lockedStop.stop_id, signal: 'too_dark',
    })).data.longTermPreferenceVersion, 1);
    assert.equal('signal' in remembered.data, false);
    assert.ok(!JSON.stringify(await call('GET', phase5Path + '/itineraries', phase5B)).includes('too_dark'));
    const learningRows = await db.query(`SELECT signal,long_term_applied,preference_version_after
      FROM preference_feedback_events WHERE itinerary_id=$1 ORDER BY long_term_applied,signal`, [target.itinerary_id]);
    assert.deepEqual(learningRows.rows, [
      { signal: 'too_dark', long_term_applied: true, preference_version_after: 1 },
    ]);

    await db.query("UPDATE venue_datasets SET status='stale' WHERE version='test-v1'");
    await db.query("INSERT INTO venue_datasets(version,status,approved_at) VALUES ('test-v2','active',now())");
    const versionedRecord = { ...recommendationRecord(1), datasetVersion: 'test-v2' };
    const versionedSlot = { ...recommendationSlot(1), slotId: '20000000-0000-4000-8000-999999999999' };
    await db.query('INSERT INTO venue_records(venue_id,dataset_version,record) VALUES ($1,$2,$3)', [versionedRecord.venueId, 'test-v2', versionedRecord]);
    await db.query('INSERT INTO venue_execution_slots(id,dataset_version,venue_id,execution) VALUES ($1,$2,$3,$4)', [versionedSlot.slotId, 'test-v2', versionedSlot.venueId, versionedSlot]);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM venue_records WHERE venue_id='venue_test_1'")).rows[0].n, 2);

    await call('PUT', phase5Path + '/shared', phase5B, { version: 3, shared: recommendationShared });
    assert.deepEqual((await call('GET', phase5Path + '/itineraries', phase5A)).data.itineraries, []);
    assert.equal((await call('POST', phase5Path + '/generate', phase5A, { version: 3 })).data.error.code, 'VERSION_CONFLICT');
    assert.equal((await call('POST', reactionPath, phase5A, {
      version: 3, stopId: lockedStop.stop_id, reaction: 'like',
    })).data.error.code, 'VERSION_CONFLICT');
    assert.equal((await call('POST', replanPath, phase5A, { version: 3 })).data.error.code, 'VERSION_CONFLICT');
  });
  await t.test('migration retry and application restart retain session version and conditions', async () => {
    await migrate(url);
    const previousPort = port;
    await stop();
    await start();
    assert.notEqual(port, previousPort);
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
    const ownList = await call('GET', '/api/me/venue-feedback', a);
    assert.equal(ownList.status, 200);
    assert.deepEqual(ownList.data.items.map((item: { venueId: string }) => item.venueId), ['venue_example_001']);
    assert.deepEqual((await call('GET', '/api/me/venue-feedback', b)).data.items, []);
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
