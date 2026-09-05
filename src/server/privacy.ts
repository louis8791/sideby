import { ApiError } from './contracts';

const forbiddenPublicKeys = new Set([
  'rawText', 'raw_text', 'structuredInput', 'structured_input', 'parserOutput', 'parser_output',
  'clarification', 'clarificationQuestion', 'clarification_question', 'userId', 'user_id',
  'token', 'tokenHash', 'token_hash', 'inviteCode', 'invite_code',
  'environment',
]);

function inspect(value: unknown): void {
  if (Array.isArray(value)) return value.forEach(inspect);
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenPublicKeys.has(key)) throw new ApiError(500, 'PRIVACY_GUARD_REJECTED');
    inspect(child);
  }
}

export function publicProjection<T>(value: T): T {
  inspect(value);
  return value;
}

const normalize = (value: string) => value.toLocaleLowerCase('zh-TW').replace(/\s+/gu, '');

export function safePublicReason(reason: string, privateTexts: string[]): string | null {
  const normalized = normalize(reason);
  if (/(?:partner\s*[ab]|伴侶\s*[ab]|其中一方|[AB]\s*(?:說|想|不想|要求))/iu.test(reason)) return null;
  if (privateTexts.some(text => {
    const privateNormalized = normalize(text);
    return privateNormalized.length >= 4 && normalized.includes(privateNormalized);
  })) return null;
  return reason;
}
