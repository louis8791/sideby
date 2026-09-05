CREATE TABLE IF NOT EXISTS session_inputs (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES date_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES anonymous_users(id) ON DELETE CASCADE,
  raw_text text NOT NULL CHECK (char_length(raw_text) BETWEEN 1 AND 1000),
  tags text[] NOT NULL DEFAULT '{}',
  visibility text NOT NULL DEFAULT 'private_session'
    CHECK (visibility IN ('private_session', 'private_remembered')),
  parse_status text NOT NULL CHECK (parse_status IN ('parsed', 'needs_clarification', 'unavailable')),
  parser_output jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id),
  CHECK (cardinality(tags) <= 12)
);

CREATE INDEX IF NOT EXISTS session_inputs_owner_lookup
  ON session_inputs (user_id, session_id);
