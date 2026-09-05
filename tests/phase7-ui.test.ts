import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path: string) => readFile(path, 'utf8');

test('Phase 7 mobile UI keeps honest states and private boundaries visible', async () => {
  const [page, css] = await Promise.all([read('app/page.tsx'), read('app/globals.css')]);
  for (const text of [
    '正在確認資料模式', '不會載入展示資料或假推薦', '尚無行程', '不會用假卡片',
    '在 Google Maps 查看', '僅本人可見', '不會自動發布成公開評論',
    'Sideby 不保證座位，也不代付款', '贊助內容', '外部服務或網路不可用',
    'SESSION_NOT_READY', 'RECOMMENDATION_DATA_UNAVAILABLE', 'SERVICE_UNAVAILABLE', 'VERSION_CONFLICT',
  ]) assert.ok(page.includes(text), `missing honest Phase 7 UI contract: ${text}`);
  assert.match(css, /:focus-visible/);
  assert.match(css, /button:disabled/);
  assert.match(css, /@media \(max-width: 560px\)/);
});

test('synthetic demo is explicit and isolated from standard local data', async () => {
  const [local, seed, page] = await Promise.all([
    read('scripts/local.ts'), read('scripts/seed-demo.ts'), read('app/page.tsx'),
  ]);
  assert.match(local, /\.local\/demo-postgres/);
  assert.match(local, /\.local\/dev-postgres/);
  assert.match(local, /SIDEBY_DATA_MODE: demo \? 'synthetic_demo' : 'standard'/);
  assert.match(seed, /synthetic_demo/);
  assert.match(page, /if \(value\.mode === 'synthetic_demo'\)/);
  assert.match(page, /useState\(''\)/);
});

test('Google Maps remains keyless click-out using the shared URL builder', async () => {
  const [page, maps] = await Promise.all([read('app/page.tsx'), read('src/venues/maps.ts')]);
  assert.match(page, /href=\{stop\.google_maps_url\}/);
  assert.match(page, /target="_blank"/);
  assert.doesNotMatch(page + maps, /AIza[0-9A-Za-z_-]{20,}/);
  assert.match(maps, /url\.searchParams\.set\('query', venueName\)/);
  assert.match(maps, /if \(placeId\) url\.searchParams\.set\('query_place_id', placeId\)/);
});
