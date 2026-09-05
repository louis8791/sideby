CREATE TABLE IF NOT EXISTS venue_sources (
  source_key text PRIMARY KEY CHECK (source_key ~ '^[a-z0-9_-]{1,80}$'),
  dataset_name text NOT NULL CHECK (char_length(dataset_name) BETWEEN 1 AND 160),
  source_url text NOT NULL CHECK (source_url LIKE 'https://%'),
  data_owner text NOT NULL CHECK (char_length(data_owner) BETWEEN 1 AND 120),
  license_name text NOT NULL CHECK (char_length(license_name) BETWEEN 1 AND 200),
  license_url text NOT NULL CHECK (license_url LIKE 'https://%'),
  update_frequency text NOT NULL CHECK (update_frequency IN ('daily', 'weekly', 'monthly', 'manual')),
  enabled boolean NOT NULL DEFAULT true,
  last_successful_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS venue_import_runs (
  id uuid PRIMARY KEY,
  dataset_version text NOT NULL UNIQUE CHECK (dataset_version ~ '^[a-z0-9._-]{1,80}$'),
  source_bundle_hash text NOT NULL UNIQUE CHECK (source_bundle_hash ~ '^[a-f0-9]{64}$'),
  source_updated_at timestamptz NOT NULL,
  scope_cities text[] NOT NULL CHECK (cardinality(scope_cities) BETWEEN 1 AND 10),
  source_record_count integer NOT NULL CHECK (source_record_count >= 0),
  scoped_record_count integer NOT NULL CHECK (scoped_record_count >= 0),
  staged_record_count integer NOT NULL CHECK (staged_record_count >= 0),
  rejected_record_count integer NOT NULL CHECK (rejected_record_count >= 0),
  status text NOT NULL CHECK (status IN ('staged', 'rejected')),
  rejection_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (staged_record_count + rejected_record_count = scoped_record_count)
);

CREATE TABLE IF NOT EXISTS venue_staging_records (
  run_id uuid NOT NULL REFERENCES venue_import_runs(id) ON DELETE CASCADE,
  venue_id text NOT NULL CHECK (venue_id ~ '^venue_[a-z0-9_-]{1,120}$'),
  source_key text NOT NULL REFERENCES venue_sources(source_key),
  source_record_id text NOT NULL CHECK (char_length(source_record_id) BETWEEN 1 AND 200),
  record jsonb NOT NULL,
  review_status text NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'approved', 'rejected')),
  inserted_at timestamptz NOT NULL DEFAULT now(),
  CHECK (record->>'venueId' = venue_id),
  CHECK (record->'review'->>'status' = 'draft'),
  PRIMARY KEY (run_id, venue_id)
);

CREATE INDEX IF NOT EXISTS venue_staging_records_review
  ON venue_staging_records (run_id, review_status, source_key);
