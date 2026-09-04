CREATE TABLE IF NOT EXISTS anonymous_users (
  id uuid PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS couples (
  id uuid PRIMARY KEY,
  invite_hash text NOT NULL UNIQUE,
  invite_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS couple_members (
  couple_id uuid NOT NULL REFERENCES couples(id),
  user_id uuid NOT NULL REFERENCES anonymous_users(id),
  role text NOT NULL CHECK (role IN ('A', 'B')),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (couple_id, user_id),
  UNIQUE (couple_id, role)
);
CREATE TABLE IF NOT EXISTS date_sessions (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL UNIQUE REFERENCES couples(id),
  shared jsonb,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS session_confirmations (
  session_id uuid NOT NULL REFERENCES date_sessions(id),
  user_id uuid NOT NULL REFERENCES anonymous_users(id),
  version integer NOT NULL CHECK (version > 0),
  PRIMARY KEY (session_id, user_id)
);
