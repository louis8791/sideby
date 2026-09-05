CREATE TABLE IF NOT EXISTS terms_acceptances (
  user_id uuid NOT NULL REFERENCES anonymous_users(id) ON DELETE CASCADE,
  terms_version text NOT NULL CHECK (terms_version ~ '^[a-z0-9._-]{1,40}$'),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, terms_version)
);

CREATE TABLE IF NOT EXISTS consent_preferences (
  user_id uuid PRIMARY KEY REFERENCES anonymous_users(id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  personalization_enabled boolean NOT NULL DEFAULT false,
  model_improvement_opt_in boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id, terms_version)
    REFERENCES terms_acceptances(user_id, terms_version)
);

CREATE TABLE IF NOT EXISTS venue_feedback (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES anonymous_users(id) ON DELETE CASCADE,
  venue_id text NOT NULL CHECK (venue_id ~ '^venue_[a-z0-9_-]{1,120}$'),
  note_text text CHECK (note_text IS NULL OR char_length(note_text) BETWEEN 1 AND 300),
  user_tags text[] NOT NULL DEFAULT '{}',
  rating_1_to_5 smallint CHECK (rating_1_to_5 BETWEEN 1 AND 5),
  visit_state text NOT NULL CHECK (visit_state IN ('saved', 'want_to_go', 'visited')),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  moderation_status text NOT NULL DEFAULT 'none'
    CHECK (moderation_status IN ('none', 'pending', 'approved', 'rejected', 'hidden', 'deleted')),
  preference_version integer NOT NULL DEFAULT 0 CHECK (preference_version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (user_id, venue_id),
  CHECK (cardinality(user_tags) <= 8),
  CHECK (visibility = 'public' OR moderation_status IN ('none', 'deleted'))
);

CREATE INDEX IF NOT EXISTS venue_feedback_public_list
  ON venue_feedback (venue_id, created_at DESC, id DESC)
  WHERE visibility = 'public' AND moderation_status = 'approved' AND deleted_at IS NULL;
