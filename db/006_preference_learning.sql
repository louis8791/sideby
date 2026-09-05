ALTER TABLE venue_datasets
  ADD COLUMN IF NOT EXISTS data_mode text NOT NULL DEFAULT 'synthetic_demo'
  CHECK (data_mode IN ('approved_dataset', 'synthetic_demo'));

ALTER TABLE travel_matrix_versions
  ADD COLUMN IF NOT EXISTS data_mode text NOT NULL DEFAULT 'synthetic_demo'
  CHECK (data_mode IN ('approved_dataset', 'synthetic_demo'));

CREATE TABLE IF NOT EXISTS user_preference_versions (
  user_id uuid PRIMARY KEY REFERENCES anonymous_users(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS preference_feedback_events (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES anonymous_users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES date_sessions(id) ON DELETE CASCADE,
  session_version integer NOT NULL CHECK (session_version > 0),
  itinerary_id uuid NOT NULL REFERENCES session_itineraries(id) ON DELETE RESTRICT,
  stop_id uuid NOT NULL,
  venue_id text NOT NULL,
  signal text NOT NULL CHECK (signal = 'too_dark'),
  attribute text NOT NULL CHECK (attribute = 'bright'),
  target_min_delta numeric(3,2) NOT NULL CHECK (target_min_delta = 0.10),
  long_term_applied boolean NOT NULL DEFAULT false,
  terms_version text,
  preference_version_after integer CHECK (preference_version_after > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, itinerary_id, stop_id, signal),
  CHECK ((long_term_applied AND terms_version IS NOT NULL AND preference_version_after IS NOT NULL)
    OR (NOT long_term_applied AND terms_version IS NULL AND preference_version_after IS NULL))
);

CREATE INDEX IF NOT EXISTS preference_feedback_events_user_session_idx
  ON preference_feedback_events(user_id, session_id);
