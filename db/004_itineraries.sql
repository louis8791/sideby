CREATE TABLE IF NOT EXISTS venue_datasets (
  version text PRIMARY KEY CHECK (version ~ '^[a-z0-9._-]{1,80}$'),
  status text NOT NULL CHECK (status IN ('active', 'stale')),
  approved_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_venue_dataset
  ON venue_datasets ((status)) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS venue_records (
  venue_id text PRIMARY KEY CHECK (venue_id ~ '^venue_[a-z0-9_-]{1,120}$'),
  dataset_version text NOT NULL REFERENCES venue_datasets(version),
  record jsonb NOT NULL,
  inserted_at timestamptz NOT NULL DEFAULT now(),
  CHECK (record->>'venueId' = venue_id),
  CHECK (record->>'datasetVersion' = dataset_version)
);

CREATE TABLE IF NOT EXISTS venue_execution_slots (
  id uuid PRIMARY KEY,
  venue_id text NOT NULL REFERENCES venue_records(venue_id) ON DELETE CASCADE,
  execution jsonb NOT NULL,
  CHECK (execution->>'venueId' = venue_id)
);

CREATE TABLE IF NOT EXISTS travel_matrix_versions (
  version text PRIMARY KEY CHECK (version ~ '^[a-z0-9._-]{1,80}$'),
  status text NOT NULL CHECK (status IN ('active', 'stale')),
  checked_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_travel_matrix
  ON travel_matrix_versions ((status)) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS travel_matrix (
  matrix_version text NOT NULL REFERENCES travel_matrix_versions(version) ON DELETE CASCADE,
  from_key text NOT NULL CHECK (char_length(from_key) BETWEEN 1 AND 160),
  to_key text NOT NULL CHECK (char_length(to_key) BETWEEN 1 AND 160),
  mode text NOT NULL CHECK (mode IN ('walk', 'metro', 'bus', 'scooter', 'car', 'taxi')),
  minutes integer NOT NULL CHECK (minutes BETWEEN 0 AND 240),
  PRIMARY KEY (matrix_version, from_key, to_key, mode)
);

CREATE TABLE IF NOT EXISTS session_itineraries (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES date_sessions(id) ON DELETE CASCADE,
  session_version integer NOT NULL CHECK (session_version > 0),
  rank_no smallint NOT NULL CHECK (rank_no BETWEEN 1 AND 3),
  payload jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, session_version, rank_no)
);

CREATE INDEX IF NOT EXISTS session_itineraries_current
  ON session_itineraries (session_id, session_version, rank_no);
