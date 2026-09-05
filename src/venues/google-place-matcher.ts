import type { PoolClient } from 'pg';
import { z } from 'zod';

const placeIdResponse = z.object({ places: z.array(z.object({ id: z.string().min(1).max(300) })).optional() });

export type MatchCandidate = {
  venueId: string;
  sourceKey: string;
  sourceRecordId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

export async function findGooglePlaceId(
  candidate: MatchCandidate,
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  const response = await fetcher('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id',
    },
    body: JSON.stringify({
      textQuery: `${candidate.name} ${candidate.address}`,
      languageCode: 'zh-TW',
      regionCode: 'TW',
      pageSize: 1,
      locationBias: {
        circle: {
          center: { latitude: candidate.latitude, longitude: candidate.longitude },
          radius: 500,
        },
      },
    }),
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status >= 300 && response.status < 400) throw new Error('GOOGLE_REDIRECT_REJECTED');
  if (!response.ok) throw new Error(`GOOGLE_HTTP_${response.status}`);
  const parsed = placeIdResponse.parse(await response.json());
  return parsed.places?.[0]?.id ?? null;
}

export async function listMatchCandidates(client: PoolClient, limit: number, refresh = false): Promise<MatchCandidate[]> {
  const result = await client.query(`WITH latest AS (
      SELECT id FROM venue_import_runs WHERE status='staged' ORDER BY source_updated_at DESC,created_at DESC LIMIT 1
    )
    SELECT s.venue_id AS "venueId",s.source_key AS "sourceKey",s.source_record_id AS "sourceRecordId",
      s.record->>'name' AS name,s.record->'location'->>'address' AS address,
      (s.record->'location'->>'latitude')::float AS latitude,
      (s.record->'location'->>'longitude')::float AS longitude
    FROM venue_staging_records s JOIN latest ON latest.id=s.run_id
    LEFT JOIN venue_google_place_matches m ON m.venue_id=s.venue_id
    WHERE $2::boolean OR m.venue_id IS NULL OR (m.status<>'matched' AND (m.next_retry_at IS NULL OR m.next_retry_at<=now()))
    ORDER BY s.source_key,s.source_record_id LIMIT $1`, [limit, refresh]);
  return result.rows;
}

export async function saveGooglePlaceMatch(
  client: PoolClient,
  candidate: MatchCandidate,
  placeId: string | null,
  retry = false,
) {
  const status = retry ? 'retry' : placeId ? 'matched' : 'not_found';
  await client.query(`INSERT INTO venue_google_place_matches(
      venue_id,source_key,source_record_id,google_place_id,status,matched_at,last_checked_at,next_retry_at
    ) VALUES ($1,$2,$3,$4,$5,CASE WHEN $5='matched' THEN now() END,now(),
      CASE WHEN $5='matched' THEN NULL ELSE now()+CASE WHEN $5='retry' THEN interval '1 day' ELSE interval '30 days' END END)
    ON CONFLICT (venue_id) DO UPDATE SET source_key=EXCLUDED.source_key,source_record_id=EXCLUDED.source_record_id,
      google_place_id=CASE WHEN EXCLUDED.status='matched' THEN EXCLUDED.google_place_id ELSE venue_google_place_matches.google_place_id END,
      status=CASE WHEN EXCLUDED.status='matched' OR venue_google_place_matches.status<>'matched'
        THEN EXCLUDED.status ELSE venue_google_place_matches.status END,
      matched_at=CASE WHEN EXCLUDED.status='matched' THEN now() ELSE venue_google_place_matches.matched_at END,
      last_checked_at=now(),next_retry_at=EXCLUDED.next_retry_at,
      attempt_count=venue_google_place_matches.attempt_count+1`, [
    candidate.venueId, candidate.sourceKey, candidate.sourceRecordId, placeId, status,
  ]);
  if (placeId) await client.query(`UPDATE venue_staging_records SET
      record=jsonb_set(record,'{google_place_id}',to_jsonb($2::text),true)
    WHERE venue_id=$1`, [candidate.venueId, placeId]);
}
