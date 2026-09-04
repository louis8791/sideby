import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { freePort, localPostgres } from '../scripts/postgres';
import { migrate } from '../scripts/migrate';
import type { PublicState } from '../src/server/contracts';

const shared = {
  mode: 'future', startsAt: '2026-10-10T12:00:00+08:00', endsAt: '2026-10-10T18:00:00+08:00',
  meetingPoint: { label: '合成測試集合點', latitude: 25.04, longitude: 121.52 },
  budgetTwdTotal: 1800, transport: ['transit', 'walk'], stops: 3,
  outdoorAllowed: true, bookingAllowed: false,
};

test('Phase 1B: real PostgreSQL + built Next.js over HTTP', { timeout: 120000 }, async t => {
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
    return { status: response.status, data: await response.json() };
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
  async function stream(token: string) {
    const controller = new AbortController();
    const response = await fetch(base + main + '/events', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
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
  await t.test('migration retry and application restart retain session version and conditions', async () => {
    await migrate(url);
    const stopped = once(app!, 'exit'); app!.kill(); await stopped;
    await start();
    const state = (await call('GET', main, b)).data;
    assert.equal(state.version, 3); assert.equal(state.shared.stops, 4);
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
    for (const secret of [a, b, c, mainRoom.inviteCode, 'private-canary', url]) assert.ok(!logs.includes(secret));
  });
});
