CREATE TABLE IF NOT EXISTS itinerary_reactions (
  itinerary_id uuid NOT NULL REFERENCES session_itineraries(id) ON DELETE CASCADE,
  session_version integer NOT NULL CHECK (session_version > 0),
  user_id uuid NOT NULL REFERENCES anonymous_users(id) ON DELETE CASCADE,
  target_key text NOT NULL CHECK (char_length(target_key) BETWEEN 1 AND 140),
  stop_id uuid,
  venue_id text,
  reaction text NOT NULL CHECK (reaction IN ('like', 'dislike', 'replace')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (target_key = COALESCE(stop_id::text, '__itinerary__')),
  CHECK ((stop_id IS NULL) = (venue_id IS NULL)),
  PRIMARY KEY (itinerary_id, user_id, target_key)
);

CREATE TABLE IF NOT EXISTS session_finalize_choices (
  session_id uuid NOT NULL REFERENCES date_sessions(id) ON DELETE CASCADE,
  session_version integer NOT NULL CHECK (session_version > 0),
  user_id uuid NOT NULL REFERENCES anonymous_users(id) ON DELETE CASCADE,
  itinerary_id uuid NOT NULL REFERENCES session_itineraries(id) ON DELETE CASCADE,
  selected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, session_version, user_id)
);

CREATE TABLE IF NOT EXISTS session_finalizations (
  session_id uuid PRIMARY KEY REFERENCES date_sessions(id) ON DELETE CASCADE,
  session_version integer NOT NULL CHECK (session_version > 0),
  itinerary_id uuid NOT NULL REFERENCES session_itineraries(id) ON DELETE RESTRICT,
  finalized_at timestamptz NOT NULL DEFAULT now()
);
