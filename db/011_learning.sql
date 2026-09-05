CREATE TABLE IF NOT EXISTS learning_participants (
  user_id uuid PRIMARY KEY REFERENCES anonymous_users(id) ON DELETE CASCADE,
  participant_key text NOT NULL UNIQUE
    CHECK (participant_key ~ '^participant_[a-f0-9]{32}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS learning_candidates (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES anonymous_users(id) ON DELETE CASCADE,
  participant_key text NOT NULL REFERENCES learning_participants(participant_key),
  candidate_kind text NOT NULL
    CHECK (candidate_kind IN ('requirement_text', 'ranking_preference')),
  venue_feedback_id uuid REFERENCES venue_feedback(id) ON DELETE RESTRICT,
  preference_feedback_event_id uuid REFERENCES preference_feedback_events(id) ON DELETE RESTRICT,
  corrected_text text CHECK (corrected_text IS NULL OR char_length(corrected_text) BETWEEN 1 AND 500),
  annotation_targets jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(annotation_targets) = 'array'),
  expected_constraints jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(expected_constraints) = 'array'),
  structured_target jsonb,
  needs_clarification boolean NOT NULL DEFAULT false,
  clarification_reason text CHECK (clarification_reason IS NULL OR char_length(clarification_reason) BETWEEN 1 AND 240),
  deidentified_by text CHECK (deidentified_by IS NULL OR deidentified_by ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  deidentified_at timestamptz,
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected', 'disputed')),
  reviewer text CHECK (reviewer IS NULL OR reviewer ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  reviewed_at timestamptz,
  split text NOT NULL DEFAULT 'unassigned'
    CHECK (split IN ('unassigned', 'train', 'validation', 'test')),
  taxonomy_version text NOT NULL
    CHECK (taxonomy_version ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  consent_terms_version text NOT NULL,
  consent_checked_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (needs_clarification = (clarification_reason IS NOT NULL)),
  CHECK ((review_status = 'pending' AND reviewer IS NULL AND reviewed_at IS NULL)
    OR (review_status IN ('approved', 'rejected', 'disputed') AND reviewer IS NOT NULL AND reviewed_at IS NOT NULL)),
  CHECK (review_status = 'approved' OR split = 'unassigned'),
  CHECK (
    (candidate_kind = 'requirement_text'
      AND venue_feedback_id IS NOT NULL AND preference_feedback_event_id IS NULL
      AND corrected_text IS NOT NULL AND deidentified_by IS NOT NULL AND deidentified_at IS NOT NULL
      AND structured_target IS NULL)
    OR
    (candidate_kind = 'ranking_preference'
      AND venue_feedback_id IS NULL AND preference_feedback_event_id IS NOT NULL
      AND corrected_text IS NULL AND deidentified_by IS NULL AND deidentified_at IS NULL
      AND annotation_targets = '[]'::jsonb AND expected_constraints = '[]'::jsonb
      AND structured_target IS NOT NULL AND split = 'unassigned')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS learning_candidate_requirement_source
  ON learning_candidates (venue_feedback_id) WHERE venue_feedback_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS learning_candidate_ranking_source
  ON learning_candidates (preference_feedback_event_id) WHERE preference_feedback_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS learning_candidates_exportable
  ON learning_candidates (candidate_kind, review_status, taxonomy_version, split)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS learning_dataset_exports (
  version text PRIMARY KEY CHECK (version ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  corpus_kind text NOT NULL CHECK (corpus_kind IN ('requirement_text', 'ranking_preference')),
  taxonomy_version text NOT NULL CHECK (taxonomy_version ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  candidate_count integer NOT NULL CHECK (candidate_count > 0),
  status text NOT NULL DEFAULT 'frozen' CHECK (status IN ('frozen', 'withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_dataset_members (
  dataset_version text NOT NULL REFERENCES learning_dataset_exports(version) ON DELETE RESTRICT,
  candidate_id uuid NOT NULL REFERENCES learning_candidates(id) ON DELETE RESTRICT,
  PRIMARY KEY (dataset_version, candidate_id)
);

CREATE TABLE IF NOT EXISTS venue_recommendation_indexes (
  version text PRIMARY KEY CHECK (version ~ '^[a-z0-9][a-z0-9._-]{0,79}$'),
  dataset_version text NOT NULL REFERENCES venue_datasets(version) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('active', 'stale')),
  record_count integer NOT NULL CHECK (record_count > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_venue_recommendation_index
  ON venue_recommendation_indexes ((status)) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS venue_recommendation_index_entries (
  index_version text NOT NULL REFERENCES venue_recommendation_indexes(version) ON DELETE CASCADE,
  venue_id text NOT NULL CHECK (venue_id ~ '^venue_[a-z0-9_-]{1,120}$'),
  record_sha256 text NOT NULL CHECK (record_sha256 ~ '^[a-f0-9]{64}$'),
  category text NOT NULL,
  district text NOT NULL,
  price_min_twd integer NOT NULL CHECK (price_min_twd >= 0),
  price_max_twd integer NOT NULL CHECK (price_max_twd >= price_min_twd),
  price_basis text NOT NULL CHECK (price_basis IN ('person', 'couple', 'entry')),
  approved_attributes jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(approved_attributes) = 'object'),
  PRIMARY KEY (index_version, venue_id)
);
