import { acceptParserOutput } from './preference-query';

export const preferenceFeedbackSignals = [
  'too_dark', 'too_noisy', 'too_childish', 'too_formal', 'too_much_walking',
] as const;
export type PreferenceFeedbackSignal = typeof preferenceFeedbackSignals[number];
export type PreferenceAdjustment = {
  attribute: 'bright' | 'quiet' | 'childish' | 'formal' | 'walking';
  bound: 'min' | 'max';
  delta: number;
};

export const preferenceAdjustmentBySignal: Record<PreferenceFeedbackSignal, PreferenceAdjustment> = {
  too_dark: { attribute: 'bright', bound: 'min', delta: 0.1 },
  too_noisy: { attribute: 'quiet', bound: 'min', delta: 0.1 },
  too_childish: { attribute: 'childish', bound: 'max', delta: -0.1 },
  too_formal: { attribute: 'formal', bound: 'max', delta: -0.1 },
  too_much_walking: { attribute: 'walking', bound: 'max', delta: -0.1 },
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function applyPreferenceFeedback(candidate: unknown, adjustments: PreferenceAdjustment[]): unknown {
  const envelope = acceptParserOutput(candidate);
  if (envelope.status !== 'parsed' || !adjustments.length) return envelope;
  const preferences = [...envelope.result.preferences];
  const avoid = [...envelope.result.avoid];
  for (const adjustment of adjustments) {
    if (adjustment.bound === 'min') {
      const index = preferences.findIndex(item => item.attribute === adjustment.attribute);
      const current = index >= 0 ? preferences[index] : null;
      const updated = {
        ...(current ?? { attribute: adjustment.attribute, importance: 0.9, confidence: 1 }),
        target_min: clamp((current?.target_min ?? 0.6) + adjustment.delta),
        source: 'feedback' as const,
        scope: 'session' as const,
      };
      if (index >= 0) preferences[index] = updated;
      else preferences.push(updated);
      continue;
    }
    const index = avoid.findIndex(item => item.attribute === adjustment.attribute);
    const current = index >= 0 ? avoid[index] : null;
    const updated = {
      ...(current ?? { attribute: adjustment.attribute, importance: 0.9, hard: false }),
      target_max: clamp((current?.target_max ?? 0.4) + adjustment.delta),
      scope: 'session' as const,
    };
    if (index >= 0) avoid[index] = updated;
    else avoid.push(updated);
  }
  return { ...envelope, result: { ...envelope.result, preferences, avoid } };
}
