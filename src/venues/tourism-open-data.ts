import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { importGovernmentRow } from './government-import';
import { assessVenue } from './policy';
import type { VenueRecord } from './schema';

export const tourismScopeCities = ['臺北市', '新北市'] as const;

export const tourismSources = {
  attraction: {
    sourceKey: 'tourism-attraction-v2',
    datasetName: '景點 - 觀光資訊資料庫',
    sourceUrl: 'https://media.taiwan.net.tw/XMLReleaseAll_public/v2.0/Zh_tw/AttractionList.json',
    arrayKey: 'Attractions', idKey: 'AttractionID', nameKey: 'AttractionName', category: 'other' as const,
  },
  restaurant: {
    sourceKey: 'tourism-restaurant-v2',
    datasetName: '餐飲 - 觀光資訊資料庫',
    sourceUrl: 'https://media.taiwan.net.tw/XMLReleaseAll_public/v2.0/Zh_tw/RestaurantList.json',
    arrayKey: 'Restaurants', idKey: 'RestaurantID', nameKey: 'RestaurantName', category: 'restaurant' as const,
  },
} as const;

const sourceOwner = '交通部觀光署';
const licenseName = '政府資料開放授權條款-第1版';
const licenseUrl = 'https://data.gov.tw/license';

type SourceKey = keyof typeof tourismSources;
type UnknownRecord = Record<string, unknown>;

export interface TourismSourceSnapshot {
  sourceKey: string;
  datasetName: string;
  sourceUrl: string;
  sourceUpdatedAt: string;
  sourceRecordCount: number;
  scopedRecordCount: number;
}

export interface TourismVenueBatch {
  datasetVersion: string;
  sourceBundleHash: string;
  sourceUpdatedAt: string;
  scopeCities: string[];
  sourceRecordCount: number;
  scopedRecordCount: number;
  records: VenueRecord[];
  rejectedRecordCount: number;
  rejectionSummary: Record<string, number>;
  sources: TourismSourceSnapshot[];
}

function object(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function firstTelephone(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    const telephone = text(object(item)?.Tel);
    if (telephone) return telephone;
  }
  return null;
}

function safeUrl(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch { return null; }
}

function normalizeCity(value: unknown): string | null {
  const city = text(value)?.replace(/^台北市$/, '臺北市');
  return city && tourismScopeCities.includes(city as typeof tourismScopeCities[number]) ? city : null;
}

function datasetDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) throw new Error('Tourism source has an invalid UpdateTime');
  return value.slice(0, 10);
}

function parsePayload(sourceKey: SourceKey, payload: unknown, datasetVersion: string) {
  const source = tourismSources[sourceKey];
  const root = object(payload);
  if (!root) throw new Error(`${source.sourceKey}: response must be an object`);
  const sourceUpdatedAt = text(root.UpdateTime);
  if (!sourceUpdatedAt || Number.isNaN(new Date(sourceUpdatedAt).valueOf())) {
    throw new Error(`${source.sourceKey}: missing valid UpdateTime`);
  }
  const items = root[source.arrayKey];
  if (!Array.isArray(items)) throw new Error(`${source.sourceKey}: missing ${source.arrayKey}`);

  const records: VenueRecord[] = [];
  const rejectionSummary: Record<string, number> = {};
  let scopedRecordCount = 0;
  const reject = (reason: string) => { rejectionSummary[reason] = (rejectionSummary[reason] ?? 0) + 1; };

  for (const raw of items) {
    const item = object(raw);
    const address = object(item?.PostalAddress);
    const city = normalizeCity(address?.City);
    if (!city) continue;
    scopedRecordCount += 1;
    const district = text(address?.Town);
    const streetAddress = text(address?.StreetAddress) ?? '（開放資料未提供街道地址）';
    const latitude = Number(item?.PositionLat);
    const longitude = Number(item?.PositionLon);
    if (!item || !district || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      reject('missing_required_location');
      continue;
    }

    try {
      const record = importGovernmentRow({
        datasetVersion,
        datasetName: source.datasetName,
        datasetUrl: source.sourceUrl,
        dataOwner: sourceOwner,
        licenseName,
        licenseUrl,
        recordId: text(item[source.idKey]),
        name: text(item[source.nameKey]),
        address: `${city}${district}${streetAddress}`,
        district,
        latitude,
        longitude,
        category: source.category,
        description: text(item.Description),
        phone: firstTelephone(item.Telephones),
        website: safeUrl(item.WebsiteURL),
        openingHours: text(item.ServiceTimeInfo),
        checkedAt: sourceUpdatedAt,
        licenseVerified: true,
        descriptionReuseAllowed: true,
      });
      // Preserve the government's explicit fee evidence; the earlier importer discarded it.
      record.facts.admissionText = text(item.FeeInfo)?.slice(0, 2000) ?? null;
      const assessment = assessVenue(record);
      if (!assessment.valid) { reject('policy_rejected'); continue; }
      records.push(record);
    } catch { reject('schema_rejected'); }
  }

  return {
    records, rejectionSummary, sourceUpdatedAt,
    sourceRecordCount: items.length, scopedRecordCount,
    source: {
      sourceKey: source.sourceKey, datasetName: source.datasetName, sourceUrl: source.sourceUrl,
      sourceUpdatedAt, sourceRecordCount: items.length, scopedRecordCount,
    } satisfies TourismSourceSnapshot,
  };
}

export function buildTourismVenueBatch(payloads: Record<SourceKey, unknown>, rawPayloads?: Record<SourceKey, string>): TourismVenueBatch {
  const updateTimes = (Object.keys(tourismSources) as SourceKey[]).map(key => {
    const value = text(object(payloads[key])?.UpdateTime);
    if (!value || Number.isNaN(new Date(value).valueOf())) throw new Error(`${key}: missing valid UpdateTime`);
    return value;
  });
  // Include mapping revision so new fields are not skipped when upstream data is unchanged.
  const sourceBundleHash = createHash('sha256').update('tourism-normalization-v2-admission\n').update(
    (Object.keys(tourismSources) as SourceKey[]).map(key => rawPayloads?.[key] ?? JSON.stringify(payloads[key])).join('\n'),
    'utf8',
  ).digest('hex');
  const sourceUpdatedAt = updateTimes.sort((a, b) => Date.parse(b) - Date.parse(a))[0]!;
  const datasetVersion = `tourism-tpe-ntpc-${datasetDate(sourceUpdatedAt)}-${sourceBundleHash.slice(0, 10)}`;
  const parsed = (Object.keys(tourismSources) as SourceKey[]).map(key => parsePayload(key, payloads[key], datasetVersion));
  const rejectionSummary: Record<string, number> = {};
  for (const result of parsed) for (const [reason, count] of Object.entries(result.rejectionSummary)) {
    rejectionSummary[reason] = (rejectionSummary[reason] ?? 0) + count;
  }
  const records = parsed.flatMap(result => result.records);
  return {
    datasetVersion, sourceBundleHash, sourceUpdatedAt, scopeCities: [...tourismScopeCities], records,
    sourceRecordCount: parsed.reduce((sum, item) => sum + item.sourceRecordCount, 0),
    scopedRecordCount: parsed.reduce((sum, item) => sum + item.scopedRecordCount, 0),
    rejectedRecordCount: Object.values(rejectionSummary).reduce((sum, count) => sum + count, 0),
    rejectionSummary, sources: parsed.map(item => item.source),
  };
}

export async function fetchTourismVenueBatch(fetcher: typeof fetch = fetch): Promise<TourismVenueBatch> {
  const entries = await Promise.all((Object.keys(tourismSources) as SourceKey[]).map(async key => {
    const response = await fetcher(tourismSources[key].sourceUrl, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`${tourismSources[key].sourceKey}: HTTP ${response.status}`);
    const raw = (await response.text()).replace(/^\uFEFF/, '');
    return [key, raw, JSON.parse(raw)] as const;
  }));
  const rawPayloads = Object.fromEntries(entries.map(([key, raw]) => [key, raw])) as Record<SourceKey, string>;
  const payloads = Object.fromEntries(entries.map(([key, , payload]) => [key, payload])) as Record<SourceKey, unknown>;
  return buildTourismVenueBatch(payloads, rawPayloads);
}

export async function stageTourismVenueBatch(client: PoolClient, batch: TourismVenueBatch) {
  const runId = randomUUID();
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock(738922)');
    const existing = await client.query<{ id: string }>(
      'SELECT id FROM venue_import_runs WHERE source_bundle_hash=$1', [batch.sourceBundleHash],
    );
    if (existing.rowCount) {
      await client.query('COMMIT');
      return { runId: existing.rows[0]!.id, reused: true, stagedRecordCount: batch.records.length };
    }
    for (const source of batch.sources) await client.query(`INSERT INTO venue_sources(
      source_key,dataset_name,source_url,data_owner,license_name,license_url,update_frequency,last_successful_at,updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,'daily',$7,now())
    ON CONFLICT (source_key) DO UPDATE SET dataset_name=EXCLUDED.dataset_name,source_url=EXCLUDED.source_url,
      data_owner=EXCLUDED.data_owner,license_name=EXCLUDED.license_name,license_url=EXCLUDED.license_url,
      update_frequency=EXCLUDED.update_frequency,last_successful_at=EXCLUDED.last_successful_at,updated_at=now()`, [
      source.sourceKey, source.datasetName, source.sourceUrl, sourceOwner, licenseName, licenseUrl, source.sourceUpdatedAt,
    ]);
    await client.query(`INSERT INTO venue_import_runs(
      id,dataset_version,source_bundle_hash,source_updated_at,scope_cities,source_record_count,scoped_record_count,
      staged_record_count,rejected_record_count,status,rejection_summary
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'staged',$10)`, [
      runId, batch.datasetVersion, batch.sourceBundleHash, batch.sourceUpdatedAt, batch.scopeCities,
      batch.sourceRecordCount, batch.scopedRecordCount, batch.records.length, batch.rejectedRecordCount,
      batch.rejectionSummary,
    ]);
    const stagingRecords = batch.records.map(record => {
      const source = record.sources[0]!;
      const sourceKey = batch.sources.find(item => item.sourceUrl === source.sourceUrl)?.sourceKey;
      if (!sourceKey || !source.sourceRecordId) throw new Error(`Missing source identity for ${record.venueId}`);
      return { venueId: record.venueId, sourceKey, sourceRecordId: source.sourceRecordId, record };
    });
    await client.query(`INSERT INTO venue_staging_records(run_id,venue_id,source_key,source_record_id,record)
      SELECT $1,item->>'venueId',item->>'sourceKey',item->>'sourceRecordId',item->'record'
      FROM jsonb_array_elements($2::jsonb) item`, [runId, JSON.stringify(stagingRecords)]);
    await client.query(`UPDATE venue_staging_records s SET
      record=jsonb_set(s.record,'{google_place_id}',to_jsonb(m.google_place_id),true)
      FROM venue_google_place_matches m
      WHERE s.run_id=$1 AND m.venue_id=s.venue_id AND m.status='matched'`, [runId]);
    await client.query('COMMIT');
    return { runId, reused: false, stagedRecordCount: batch.records.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
