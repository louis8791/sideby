import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceptParserOutput, parseWithRuleBaseline } from '../src/model/preference-query';
import { publicProjection, safePublicReason } from '../src/server/privacy';

test('supported private wording becomes a schema-safe calculable query', () => {
  const parsed = parseWithRuleBaseline({
    sessionId: '00000000-0000-4000-8000-000000000001', mode: 'future',
    visibility: 'private_session', rawText: '想找明亮、可愛但不要太幼稚，也不要走太多路。',
  });
  assert.equal(parsed.status, 'parsed');
  if (parsed.status !== 'parsed') return;
  assert.deepEqual(parsed.result.preferences.map(item => item.attribute), ['bright', 'cute']);
  assert.deepEqual(parsed.result.avoid.map(item => item.attribute), ['childish', 'walking']);
  assert.equal(parsed.result.visibility, 'private_session');
  assert.equal(parsed.externalModelApiCalls, 0);
});

test('allowlisted Gemini-normalized wording stays calculable', () => {
  const parsed = parseWithRuleBaseline({
    sessionId: '00000000-0000-4000-8000-000000000001', mode: 'future',
    visibility: 'private_session', rawText: '浪漫、放鬆、一起體驗、新鮮。',
  });
  assert.equal(parsed.status, 'parsed');
  if (parsed.status !== 'parsed') return;
  assert.deepEqual(parsed.result.preferences.map(item => item.attribute), [
    'romantic', 'relaxing', 'interactive', 'freshness',
  ]);
  assert.equal(parsed.externalModelApiCalls, 0);
});

test('ambiguous wording requests clarification and invalid parser output fails closed', () => {
  const ambiguous = parseWithRuleBaseline({
    sessionId: '00000000-0000-4000-8000-000000000001', mode: 'future',
    visibility: 'private_session', rawText: '想去有氣氛的地方。',
  });
  assert.equal(ambiguous.status, 'needs_clarification');
  const mixedConstraint = parseWithRuleBaseline({
    sessionId: '00000000-0000-4000-8000-000000000001', mode: 'future',
    visibility: 'private_session', rawText: '希望明亮，但我不能吃花生。',
  });
  assert.equal(mixedConstraint.status, 'needs_clarification');
  const invalid = acceptParserOutput({ status: 'parsed', result: { invented: true } });
  assert.deepEqual(invalid, {
    status: 'unavailable', engine: 'local_parser', result: null, clarification: null,
    code: 'PARSER_OUTPUT_INVALID', externalModelApiCalls: 0,
  });
});

test('public projection and public reason reject private fields and source clues', () => {
  assert.throws(() => publicProjection({ sessionId: 'safe', rawText: 'private-canary' }));
  assert.equal(safePublicReason('其中一方不想吃拉麵', ['不想吃拉麵']), null);
  assert.equal(safePublicReason('本次提高料理多樣性。', ['不想吃拉麵']), '本次提高料理多樣性。');
});
