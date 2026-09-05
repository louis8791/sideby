import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertLocalMapsRequest, autocomplete, searchVenue, resolveVenueQueries, placeDetails, computeLeg, travelLegs, geocode } from '../src/lib/google-maps.server.ts';

const KEY = 'synthetic-server-key-for-offline-tests';
const point = { label: 'synthetic point', lat: 25, lng: 121 };
const place = { id: 'example-id', displayName: { text: 'Synthetic venue' }, formattedAddress: 'Synthetic address', location: { latitude: 25, longitude: 121 } };

test('Google direct integration (offline; no real Google calls)', async t => {
  const original = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  t.after(() => { if (original === undefined) delete process.env.GOOGLE_MAPS_SERVER_API_KEY; else process.env.GOOGLE_MAPS_SERVER_API_KEY = original; });
  process.env.GOOGLE_MAPS_SERVER_API_KEY = KEY;
  let calls = [];
  let response = {};
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url: new URL(url), init });
    if (response instanceof Error) throw response;
    return response instanceof Response ? response : Response.json(response);
  });
  await t.test('missing key fails before any outbound call', async () => {
    delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
    await assert.rejects(() => searchVenue('example'), /GOOGLE_MAPS_SERVER_API_KEY/);
    assert.equal(fetchMock.mock.callCount(), 0);
    process.env.GOOGLE_MAPS_SERVER_API_KEY = KEY;
  });
  await t.test('local and same-origin guard rejects production, public host and cross-origin', () => {
    const request = (host, origin = host) => new Request(`${host}/_serverFn/example`, { headers: { origin } });
    assert.doesNotThrow(() => assertLocalMapsRequest(request('http://127.0.0.1:5173'), 'development'));
    assert.throws(() => assertLocalMapsRequest(request('http://127.0.0.1:5173'), 'production'));
    assert.throws(() => assertLocalMapsRequest(request('https://public.example'), 'development'));
    assert.throws(() => assertLocalMapsRequest(request('http://127.0.0.1:5173', 'https://other.example'), 'development'));
    assert.throws(() => assertLocalMapsRequest(new Request('http://localhost:5173/'), 'development'));
  });
  await t.test('Places search uses official endpoint, header key and bounded field mask', async () => {
    response = { places: [place] };
    assert.equal((await searchVenue('synthetic')).name, 'Synthetic venue');
    const { url, init } = calls.at(-1);
    assert.equal(url.href, 'https://places.googleapis.com/v1/places:searchText');
    assert.equal(init.headers.get('X-Goog-Api-Key'), KEY);
    assert.equal(init.headers.has('Authorization'), false);
    assert.equal(init.cache, 'no-store');
    assert.equal(init.redirect, 'error');
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(JSON.parse(init.body).pageSize, 1);
    assert.ok(init.headers.get('X-Goog-FieldMask').includes('places.photos.authorAttributions'));
    assert.equal(JSON.stringify(await searchVenue('synthetic')).includes(KEY), false);
  });
  await t.test('no global venue cache and request-local dedup only', async () => {
    const before = calls.length;
    await resolveVenueQueries(['repeat', 'repeat']); await resolveVenueQueries(['repeat']);
    assert.equal(calls.length - before, 2);
  });
  await t.test('autocomplete and details use direct Places with encoded input', async () => {
    response = { suggestions: [{ placePrediction: { placeId: 'id', text: { text: 'Synthetic' } } }] };
    assert.equal((await autocomplete('x')).suggestions[0].name, 'Synthetic');
    assert.equal(calls.at(-1).url.pathname, '/v1/places:autocomplete');
    response = place;
    assert.equal((await placeDetails('x/y')).venue.placeId, place.id);
    assert.equal(calls.at(-1).url.pathname, '/v1/places/x%2Fy');
  });
  await t.test('Routes WALK and TRANSIT request and duration conversion', async () => {
    response = { routes: [{ duration: '120.5s', distanceMeters: 420 }] };
    const { legs } = await travelLegs([point, { ...point, label: 'destination' }]);
    assert.deepEqual(legs[0], { from: point.label, to: 'destination', walkMinutes: 2, transitMinutes: 2, distanceKm: 0.4 });
    assert.equal(calls.at(-1).url.href, 'https://routes.googleapis.com/directions/v2:computeRoutes');
    assert.deepEqual(calls.slice(-2).map(c => JSON.parse(c.init.body).travelMode), ['WALK', 'TRANSIT']);
    response = { routes: [] };
    assert.equal((await computeLeg(point, point, 'WALK')).minutes, undefined);
  });
  await t.test('Geocoding keeps key server-side and preserves partial precision', async () => {
    response = { status: 'OK', results: [{ formatted_address: 'Synthetic address', place_id: 'test', partial_match: true,
      geometry: { location: { lat: 25, lng: 121 }, location_type: 'APPROXIMATE' } }] };
    const data = await geocode('地址 & # 測試');
    assert.equal(calls.at(-1).url.origin, 'https://maps.googleapis.com');
    assert.equal(calls.at(-1).url.searchParams.get('address'), '地址 & # 測試');
    assert.equal(calls.at(-1).url.searchParams.get('key'), KEY);
    assert.equal(JSON.stringify(data).includes(KEY), false);
    assert.equal(data.location.partialMatch, true);
    assert.equal(data.location.precision, 'APPROXIMATE');
    response = { status: 'ZERO_RESULTS' };
    assert.deepEqual(await geocode('none'), { location: null });
  });
  await t.test('denial, quota, body parse and network errors never expose secrets', async () => {
    const secret = `provider-raw-private ${KEY}`;
    const safe = error => !error.message.includes(secret) && !error.message.includes(KEY);
    for (const status of [403, 429, 500]) {
      response = new Response(secret, { status });
      await assert.rejects(() => autocomplete('private input'), safe);
      response = new Response(secret, { status });
      await assert.rejects(() => computeLeg(point, point, 'WALK'), safe);
    }
    response = new Error(secret);
    await assert.rejects(() => geocode('private address'), safe);
    response = { status: 'REQUEST_DENIED', error_message: secret };
    await assert.rejects(() => geocode('private address'), safe);
    response = new Response(secret, { status: 200 });
    await assert.rejects(() => placeDetails('id'), safe);
  });
  await t.test('photo author attribution travels with the photo', async () => {
    const authors = [{ displayName: 'Synthetic author', uri: 'https://example.com/author' }];
    fetchMock.mock.mockImplementation(async url => new URL(url).pathname.endsWith('/media')
      ? Response.json({ photoUri: 'https://example.com/synthetic-photo' })
      : Response.json({ places: [{ ...place, photos: [{ name: 'places/test/photos/photo', authorAttributions: authors }] }] }));
    const venue = await searchVenue('synthetic');
    assert.deepEqual(venue.photoAttributions, authors);
    assert.equal(venue.photoUri, 'https://example.com/synthetic-photo');
  });
  await t.test('browser loader uses only browser key; docs do not restore gateway', () => {
    const loader = readFileSync(new URL('../src/lib/google-maps-loader.ts', import.meta.url), 'utf8');
    assert.ok(loader.includes('VITE_GOOGLE_MAPS_API_KEY'));
    assert.equal(loader.includes('GOOGLE_MAPS_SERVER_API_KEY'), false);
    const server = readFileSync(new URL('../src/lib/google-maps.server.ts', import.meta.url), 'utf8');
    assert.equal(server.includes('connector-gateway.lovable.dev'), false);
    assert.equal(server.includes('console.'), false);
  });
});
