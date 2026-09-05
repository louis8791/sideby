CREATE TABLE IF NOT EXISTS venue_google_place_matches (
  venue_id text PRIMARY KEY CHECK (venue_id ~ '^venue_[a-z0-9_-]{1,120}$'),
  source_key text NOT NULL REFERENCES venue_sources(source_key),
  source_record_id text NOT NULL CHECK (char_length(source_record_id) BETWEEN 1 AND 200),
  google_place_id text CHECK (char_length(google_place_id) BETWEEN 1 AND 300 AND google_place_id ~ '^[A-Za-z0-9_-]+$'),
  status text NOT NULL CHECK (status IN ('matched', 'not_found', 'retry')),
  match_method text NOT NULL DEFAULT 'text_query_coordinate_bias'
    CHECK (match_method = 'text_query_coordinate_bias'),
  matched_at timestamptz,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  next_retry_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  CHECK ((status = 'matched') = (google_place_id IS NOT NULL)),
  CHECK ((status = 'matched') = (matched_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS venue_google_place_matches_status
  ON venue_google_place_matches (status, next_retry_at, last_checked_at);

CREATE OR REPLACE VIEW venue_candidate_review_queue AS
WITH latest AS (
  SELECT id,dataset_version FROM venue_import_runs
  WHERE status='staged' ORDER BY source_updated_at DESC,created_at DESC LIMIT 1
)
SELECT latest.dataset_version,s.venue_id,s.source_key,s.source_record_id,
  s.record->>'name' AS name,s.record->'location'->>'district' AS district,
  s.record->>'category' AS category,m.google_place_id,
  ((s.record->'facts'->>'description' IS NOT NULL)::int
    +(s.record->'facts'->>'phone' IS NOT NULL)::int
    +(s.record->'facts'->>'website' IS NOT NULL)::int
    +(s.record->'facts'->'openingHours'->>'rawText' IS NOT NULL)::int
    +(position('未提供街道地址' in s.record->'location'->>'address')=0)::int
    +COALESCE((m.status='matched')::int,0)) AS completeness_score
FROM venue_staging_records s JOIN latest ON latest.id=s.run_id
LEFT JOIN venue_google_place_matches m ON m.venue_id=s.venue_id
WHERE s.review_status='draft';
