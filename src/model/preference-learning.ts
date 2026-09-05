import { acceptParserOutput } from './preference-query';

export function applyBrightPreferenceDelta(candidate: unknown, delta: number): unknown {
  const envelope = acceptParserOutput(candidate);
  if (envelope.status !== 'parsed' || delta <= 0) return envelope;
  let updated = false;
  const preferences = envelope.result.preferences.map(item => {
    if (item.attribute !== 'bright') return item;
    updated = true;
    return {
      ...item,
      target_min: Math.min(1, (item.target_min ?? 0.6) + delta),
      source: 'feedback' as const,
      scope: 'session' as const,
    };
  });
  if (!updated) {
    preferences.push({
      attribute: 'bright', target_min: Math.min(1, 0.6 + delta),
      importance: 0.9, confidence: 1, scope: 'session', source: 'feedback',
    });
  }
  return { ...envelope, result: { ...envelope.result, preferences } };
}
