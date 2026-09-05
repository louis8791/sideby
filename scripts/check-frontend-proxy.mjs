import assert from 'node:assert/strict';

// Run against Vite or the built Cloudflare Worker while the demo backend is running.
// This creates one anonymous identity and test room; no provider credentials are used.
const base = new URL(process.argv[2] || 'http://127.0.0.1:5173');
assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname) && base.protocol === 'http:');
assert.ok(!base.username && !base.password && base.pathname === '/' && !base.search && !base.hash);
const origin = base.origin;

async function call(path, body, token, requestOrigin = origin) {
  return fetch(origin + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Origin: requestOrigin,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(8000),
  });
}

const runtime = await call('/api/runtime');
assert.equal(runtime.status, 200, 'runtime must come from the backend');
assert.equal((await runtime.json()).mode, 'synthetic_demo', 'use demo:local, not a real data environment');
for (let attempt = 0; attempt < 3; attempt++) {
  const denied = await call('/api/auth/anonymous', {}, undefined, 'https://invalid.example');
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).error.code, 'ORIGIN_DENIED');
  const alive = await call('/api/runtime');
  assert.equal(alive.status, 200, 'worker must survive rejected POST bodies');
  assert.equal((await alive.json()).mode, 'synthetic_demo');
}
const identity = await call('/api/auth/anonymous', {});
assert.equal(identity.status, 201);
const { token } = await identity.json();
const room = await call('/api/couples', {}, token);
assert.equal(room.status, 201, 'Authorization must reach the backend');
const { coupleId } = await room.json();
const session = await call('/api/sessions', { coupleId }, token);
assert.equal(session.status, 200);
const { sessionId } = await session.json();
const stream = await call(`/api/sessions/${sessionId}/events`, undefined, token);
assert.equal(stream.status, 200);
assert.ok(stream.headers.get('content-type')?.includes('text/event-stream'));
const reader = stream.body.getReader();
let frame = '';
try {
  while (!frame.includes('\n\n')) {
    const { value, done } = await reader.read();
    assert.ok(!done, 'SSE must deliver a complete frame');
    frame += new TextDecoder().decode(value);
  }
  assert.ok(frame.includes('event: state\n'), 'SSE initial state must not be buffered');
} finally {
  await reader.cancel();
}
const home = await fetch(origin, { signal: AbortSignal.timeout(8000) });
assert.equal(home.status, 200, 'homepage must still render after API and SSE requests');
const html = await home.text();
assert.match(html, /sideby/iu);
const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"<>]+)"/gu)].map(match => match[1]))];
for (const path of assets) {
  const asset = await fetch(origin + path, { signal: AbortSignal.timeout(8000) });
  assert.equal(asset.status, 200, `built asset must be available: ${path}`);
  assert.match(asset.headers.get('content-type') ?? '', /javascript|css/iu);
  await asset.arrayBuffer();
}
console.log(`PASS: API, Authorization, SSE, repeated cross-origin denial, homepage and ${assets.length} built assets.`);
