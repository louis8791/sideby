ALTER TABLE preference_feedback_events
  DROP CONSTRAINT IF EXISTS preference_feedback_events_signal_check,
  DROP CONSTRAINT IF EXISTS preference_feedback_events_attribute_check,
  DROP CONSTRAINT IF EXISTS preference_feedback_events_target_min_delta_check;

ALTER TABLE preference_feedback_events
  RENAME COLUMN target_min_delta TO target_delta;

ALTER TABLE preference_feedback_events
  ADD COLUMN target_bound text NOT NULL DEFAULT 'min';

ALTER TABLE preference_feedback_events
  ADD CONSTRAINT preference_feedback_events_mapping_check CHECK (
    (signal = 'too_dark' AND attribute = 'bright' AND target_bound = 'min' AND target_delta = 0.10)
    OR (signal = 'too_noisy' AND attribute = 'quiet' AND target_bound = 'min' AND target_delta = 0.10)
    OR (signal = 'too_childish' AND attribute = 'childish' AND target_bound = 'max' AND target_delta = -0.10)
    OR (signal = 'too_formal' AND attribute = 'formal' AND target_bound = 'max' AND target_delta = -0.10)
    OR (signal = 'too_much_walking' AND attribute = 'walking' AND target_bound = 'max' AND target_delta = -0.10)
  );
