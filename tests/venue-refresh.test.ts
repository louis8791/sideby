import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Pool } from 'pg';
import { localPostgres } from '../scripts/postgres';
import { buildTourismVenueBatch, stageTourismVenueBatch } from '../src/venues/tourism-open-data';

const payloads = {
  attraction: {
    UpdateTime: '2026-09-06T01:00:00+08:00',
    Attractions: [
      { AttractionID: 'a-1', AttractionName: '臺北測試景點', Description: '授權景點介紹', PositionLat: 25.04, PositionLon: 121.52,
        PostalAddress: { City: '台北市', Town: '中山區', StreetAddress: '測試路1號' }, Telephones: [{ Tel: '02-12345678' }],
        WebsiteURL: 'https://example.gov.tw/a-1', ServiceTimeInfo: '10:00-18:00' },
      { AttractionID: 'a-2', AttractionName: '範圍外景點', Description: '不匯入', PositionLat: 24.14, PositionLon: 120.68,
        PostalAddress: { City: '臺中市', Town: '西區', StreetAddress: '測試路2號' } },
      { AttractionID: 'a-3', AttractionName: '缺街道景點', Description: '應保留並明示缺值', PositionLat: 25.06, PositionLon: 121.55,
        PostalAddress: { City: '臺北市', Town: '大安區', StreetAddress: '' } },
      { AttractionID: 'a-4', AttractionName: '錯誤座標景點', Description: '應拒絕', PositionLat: 0, PositionLon: 0,
        PostalAddress: { City: '臺北市', Town: '大安區', StreetAddress: '測試路4號' } },
    ],
  },
  restaurant: {
    UpdateTime: '2026-09-06T01:05:00+08:00',
    Restaurants: [
      { RestaurantID: 'r-1', RestaurantName: '新北測試餐廳', Description: '授權餐飲介紹', PositionLat: 25.01, PositionLon: 121.46,
        PostalAddress: { City: '新北市', Town: '板橋區', StreetAddress: '測試路3號' }, Telephones: [], WebsiteURL: '',
        ServiceTimeInfo: '11:00-21:00' },
    ],
  },
};

test('tourism open data creates Taipei/New Taipei draft candidates without inferred labels', () => {
  const batch = buildTourismVenueBatch(payloads);
  assert.equal(batch.sourceRecordCount, 5);
  assert.equal(batch.scopedRecordCount, 4);
  assert.equal(batch.records.length, 3);
  assert.equal(batch.rejectedRecordCount, 1);
  assert.deepEqual(batch.scopeCities, ['臺北市', '新北市']);
  assert.match(batch.datasetVersion, /^tourism-tpe-ntpc-2026-09-06-[a-f0-9]{10}$/);
  assert.deepEqual(batch.records.map(item => item.review.status), ['draft', 'draft', 'draft']);
  assert.deepEqual(batch.records.map(item => item.attributes), [[], [], []]);
  assert.deepEqual(batch.records.map(item => item.category), ['other', 'other', 'restaurant']);
  assert.match(batch.records[1]!.location.address, /未提供街道地址/);
  assert.ok(batch.records.every(item => item.sources[0].rightsStatus === 'open_license_verified'));
  assert.ok(batch.records.every(item => !('google_place_id' in item)));
});

test('staging is transactional and idempotent without replacing the active dataset', { timeout: 60_000 }, async () => {
  const { postgres, url } = await localPostgres(`.local/tests/venue-refresh-${Date.now()}`);
  const db = new Pool({ connectionString: url });
  try {
    await db.query(`INSERT INTO venue_datasets(version,status,approved_at,data_mode)
      VALUES ('existing-demo','active',now(),'synthetic_demo')`);
    const batch = buildTourismVenueBatch(payloads);
    const client = await db.connect();
    try {
      const first = await stageTourismVenueBatch(client, batch);
      const second = await stageTourismVenueBatch(client, batch);
      assert.equal(first.reused, false);
      assert.equal(second.reused, true);
      assert.equal(first.runId, second.runId);
    } finally { client.release(); }
    assert.equal((await db.query('SELECT count(*)::int n FROM venue_import_runs')).rows[0].n, 1);
    assert.equal((await db.query('SELECT count(*)::int n FROM venue_staging_records')).rows[0].n, 3);
    assert.equal((await db.query("SELECT version FROM venue_datasets WHERE status='active'")).rows[0].version, 'existing-demo');
    const staged = await db.query("SELECT record FROM venue_staging_records ORDER BY source_record_id");
    assert.ok(staged.rows.every(row => row.record.review.status === 'draft'));
    assert.ok(staged.rows.every(row => !('google_place_id' in row.record)));
  } finally { await db.end(); await postgres.stop(); }
});
