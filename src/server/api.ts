import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import {
  ApiError, consentUpdate, feedbackInput, feedbackPatch, id, sharedConditions, venueId, version,
  type PublicState,
} from './contracts';
import * as feedback from './feedback';
import * as rooms from './rooms';

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
const empty = z.strictObject({});

async function body<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    throw new ApiError(415, 'JSON_REQUIRED');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'INVALID_INPUT');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new ApiError(413, 'BODY_TOO_LARGE'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ApiError(400, 'INVALID_INPUT'); }
  return schema.parse(parsed);
}

function events(request: Request, userId: string, sessionId: string, initial: PublicState) {
  const stop = new AbortController();
  const onAbort = () => stop.abort();
  request.signal.addEventListener('abort', onAbort, { once: true });
  if (request.signal.aborted) stop.abort();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let last = JSON.stringify(initial), lastTouch = Date.now();
      const deadline = Date.now() + 60000;
      const send = (event: string, data: string) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      try {
        if (stop.signal.aborted) return;
        send('state', last);
        while (!stop.signal.aborted && Date.now() < deadline) {
          await delay(500, undefined, { signal: stop.signal });
          await rooms.identify(request); // Recheck expiration; never place bearer tokens in URLs.
          const touch = Date.now() - lastTouch >= 10000;
          const state = JSON.stringify(await rooms.publicState(userId, sessionId, touch));
          if (touch) { lastTouch = Date.now(); send('heartbeat', '{}'); }
          if (state !== last) { send('state', state); last = state; }
        }
      } catch (error) {
        if (!stop.signal.aborted) send('error', JSON.stringify({
          code: error instanceof ApiError ? error.code : 'SERVICE_UNAVAILABLE',
        }));
      } finally {
        request.signal.removeEventListener('abort', onAbort);
        if (!stop.signal.aborted) controller.close();
      }
    },
    cancel() { stop.abort(); },
  });
  return new Response(stream, { headers: {
    ...headers, 'Content-Type': 'text/event-stream', 'X-Accel-Buffering': 'no',
  } });
}

export async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    // UI and application API share an origin. Do not enable wildcard credentialed CORS.
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) throw new ApiError(403, 'ORIGIN_DENIED');
    const path = url.pathname;
    if (path === '/api/auth/anonymous' && request.method === 'POST') {
      await body(request, empty);
      return json(await rooms.anonymous(), 201);
    }
    const userId = await rooms.identify(request);
    if (path === '/api/me/consents') {
      if (request.method === 'GET') return json(await feedback.getConsents(userId));
      if (request.method === 'PUT') {
        const input = await body(request, consentUpdate);
        return json(await feedback.updateConsents(userId, input));
      }
      throw new ApiError(405, 'METHOD_NOT_ALLOWED');
    }
    const ownVenueFeedback = path.match(/^\/api\/me\/venues\/([^/]+)\/feedback$/);
    if (ownVenueFeedback) {
      const selectedVenueId = venueId.parse(ownVenueFeedback[1]);
      if (request.method === 'GET') return json(await feedback.getOwnFeedback(userId, selectedVenueId));
      if (request.method === 'PUT') {
        const input = await body(request, feedbackInput);
        return json(await feedback.putOwnFeedback(userId, selectedVenueId, input));
      }
      throw new ApiError(405, 'METHOD_NOT_ALLOWED');
    }
    const ownFeedback = path.match(/^\/api\/me\/venue-feedback\/([^/]+)$/);
    if (ownFeedback) {
      const feedbackId = id.parse(ownFeedback[1]);
      if (request.method === 'PATCH') {
        const input = await body(request, feedbackPatch);
        return json(await feedback.patchOwnFeedback(userId, feedbackId, input));
      }
      if (request.method === 'DELETE') {
        await feedback.deleteOwnFeedback(userId, feedbackId);
        return new Response(null, { status: 204, headers });
      }
      throw new ApiError(405, 'METHOD_NOT_ALLOWED');
    }
    const publicReviews = path.match(/^\/api\/venues\/([^/]+)\/public-reviews$/);
    if (publicReviews) {
      if (request.method !== 'GET') throw new ApiError(405, 'METHOD_NOT_ALLOWED');
      const selectedVenueId = venueId.parse(publicReviews[1]);
      const limit = z.coerce.number().int().min(1).max(50).parse(url.searchParams.get('limit') ?? 20);
      const offset = z.coerce.number().int().min(0).max(100000).parse(url.searchParams.get('cursor') ?? 0);
      return json(await feedback.listPublicReviews(selectedVenueId, limit, offset));
    }
    if (path === '/api/couples' && request.method === 'POST') {
      await body(request, empty);
      return json(await rooms.createCouple(userId), 201);
    }
    if (path === '/api/couples/join' && request.method === 'POST') {
      const input = await body(request, z.strictObject({ inviteCode: z.string().regex(/^[A-Za-z0-9_-]{32}$/) }));
      return json(await rooms.joinCouple(userId, input.inviteCode));
    }
    if (path === '/api/sessions' && request.method === 'POST') {
      const input = await body(request, z.strictObject({ coupleId: id }));
      return json(await rooms.createSession(userId, input.coupleId));
    }
    const match = path.match(/^\/api\/sessions\/([^/]+)(?:\/(shared|confirm|events))?$/);
    if (match) {
      const sessionId = id.parse(match[1]), action = match[2];
      if (request.method === 'GET' && !action) return json(await rooms.publicState(userId, sessionId));
      if (request.method === 'GET' && action === 'events') {
        const state = await rooms.publicState(userId, sessionId);
        return events(request, userId, sessionId, state);
      }
      if (request.method === 'PUT' && action === 'shared') {
        const input = await body(request, z.strictObject({ version, shared: sharedConditions }));
        await rooms.updateShared(userId, sessionId, input.version, input.shared);
        return json(await rooms.publicState(userId, sessionId));
      }
      if (request.method === 'POST' && action === 'confirm') {
        const input = await body(request, z.strictObject({ version }));
        await rooms.confirm(userId, sessionId, input.version);
        return json(await rooms.publicState(userId, sessionId));
      }
      throw new ApiError(405, 'METHOD_NOT_ALLOWED');
    }
    throw new ApiError(404, 'NOT_FOUND');
  } catch (error) {
    if (error instanceof z.ZodError) return json({ error: { code: 'INVALID_INPUT' } }, 400);
    if (error instanceof ApiError) return json({ error: { code: error.code } }, error.status);
    // No request body, auth header, database URL or raw database error in responses/logs.
    console.error('Sideby request failed: SERVICE_UNAVAILABLE');
    return json({ error: { code: 'SERVICE_UNAVAILABLE' } }, 503);
  }
}
