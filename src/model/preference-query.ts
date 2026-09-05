import { z } from 'zod';
import { preferenceAttributes, selectablePreferenceLabels, targetsForLabel, type PreferenceLabel } from './preference-catalog';

const attributes = z.enum(preferenceAttributes);
const score = z.number().min(0).max(1);
const scope = z.enum(['session', 'long_term']);

const preference = z.strictObject({
  attribute: attributes,
  target_min: score.optional(),
  target_max: score.optional(),
  importance: score,
  confidence: score,
  scope,
  source: z.enum(['questionnaire', 'conversation', 'selection', 'feedback']),
});
const avoid = z.strictObject({
  attribute: attributes,
  target_max: score.optional(),
  importance: score,
  hard: z.boolean(),
  scope,
});
export const environmentRequirements = z.strictObject({
  setting: z.enum(['indoor', 'outdoor']).nullable(),
  airConditioning: z.enum(['required', 'excluded']).nullable(),
});
export type EnvironmentRequirements = z.infer<typeof environmentRequirements>;

const hardConstraints = z.strictObject({
  environment: environmentRequirements.optional(),
  date: z.iso.date().nullable(),
  start_time: z.string().regex(/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/).nullable(),
  end_time: z.string().regex(/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/).nullable(),
  meeting_point: z.string().nullable(),
  budget_scope: z.enum(['couple_total', 'per_person']),
  ideal_budget: z.number().min(0).nullable(),
  absolute_budget: z.number().min(0).nullable(),
  transport_modes: z.array(z.enum(['walk', 'metro', 'bus', 'scooter', 'car', 'taxi'])),
  max_walk_minutes: z.number().int().min(0).nullable(),
  max_total_travel_minutes: z.number().int().min(0).nullable(),
  outdoor_allowed: z.boolean().nullable(),
  booking_required: z.boolean().nullable(),
  dietary_restrictions: z.array(z.string()),
  accessibility_needs: z.array(z.string()),
  hard_no: z.array(z.string().min(1)),
  weather_required: z.enum(['clear', 'dry', 'any']).nullable(),
});

export const preferenceQuery = z.strictObject({
  session_id: z.uuid(),
  mode: z.enum(['now', 'future']),
  visibility: z.enum(['private_session', 'private_remembered']),
  preferences: z.array(preference),
  avoid: z.array(avoid),
  hard_constraints: hardConstraints,
  context: z.strictObject({
    mood: z.string().optional(),
    energy: z.enum(['low', 'medium', 'high', 'unknown']),
    remember: z.boolean(),
  }),
  parser_confidence: score,
});

const envelope = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('parsed'), engine: z.literal('rule_baseline_v1'),
    result: preferenceQuery, clarification: z.null(), externalModelApiCalls: z.literal(0),
  }),
  z.strictObject({
    status: z.literal('needs_clarification'), engine: z.literal('rule_baseline_v1'),
    result: z.null(), clarification: z.string().min(1).max(240), externalModelApiCalls: z.literal(0),
  }),
  z.strictObject({
    status: z.literal('unavailable'), engine: z.enum(['rule_baseline_v1', 'local_parser']),
    result: z.null(), clarification: z.null(), code: z.enum(['SHARED_REQUIRED', 'PARSER_OUTPUT_INVALID', 'PARSER_UNAVAILABLE']),
    externalModelApiCalls: z.literal(0),
  }),
]);

export type ParserEnvelope = z.infer<typeof envelope>;
type Visibility = 'private_session' | 'private_remembered';

const emptyHardConstraints = (): z.infer<typeof hardConstraints> => ({
  date: null, start_time: null, end_time: null, meeting_point: null,
  budget_scope: 'couple_total', ideal_budget: null, absolute_budget: null,
  transport_modes: [], max_walk_minutes: null, max_total_travel_minutes: null,
  outdoor_allowed: null, booking_required: null, dietary_restrictions: [],
  accessibility_needs: [], hard_no: [], weather_required: null,
});

export function acceptParserOutput(candidate: unknown): ParserEnvelope {
  const parsed = envelope.safeParse(candidate);
  return parsed.success ? parsed.data : {
    status: 'unavailable', engine: 'local_parser', result: null, clarification: null,
    code: 'PARSER_OUTPUT_INVALID', externalModelApiCalls: 0,
  };
}

export function parseWithRuleBaseline(input: {
  sessionId: string; mode: 'now' | 'future' | null; visibility: Visibility; rawText: string;
  environment?: EnvironmentRequirements;
  selectedPreferences?: PreferenceLabel[];
}): ParserEnvelope {
  if (!input.mode) return {
    status: 'unavailable', engine: 'rule_baseline_v1', result: null, clarification: null,
    code: 'SHARED_REQUIRED', externalModelApiCalls: 0,
  };
  // Only whole, explicit labels are consumed; negated or ambiguous sentences remain unresolved.
  const environment = environmentRequirements.parse(input.environment ?? { setting: null, airConditioning: null });
  let environmentConflict = false;
  let text = input.rawText.split(/[、，。,.]/u).filter(part => {
    const label = part.trim();
    const setting = label === '室內' ? 'indoor' : ['戶外', '戶外（含戶外區）'].includes(label) ? 'outdoor' : null;
    const cooling = label === '冷氣' ? 'required' : label === '無冷氣' ? 'excluded' : null;
    if (setting) {
      environmentConflict ||= environment.setting !== null && environment.setting !== setting;
      environment.setting = setting;
    }
    if (cooling) {
      environmentConflict ||= environment.airConditioning !== null && environment.airConditioning !== cooling;
      environment.airConditioning = cooling;
    }
    return !setting && !cooling;
  }).join('。');
  if (environmentConflict) return {
    status: 'needs_clarification', engine: 'rule_baseline_v1', result: null,
    clarification: '環境條件互相衝突，請在室內／戶外、冷氣／無冷氣各選一項或不限。', externalModelApiCalls: 0,
  };
  if (/有氣氛/u.test(text) && !/(浪漫|放鬆|熱鬧)/u.test(text)) return {
    status: 'needs_clarification', engine: 'rule_baseline_v1', result: null,
    clarification: '「有氣氛」是偏向浪漫、放鬆，還是熱鬧？', externalModelApiCalls: 0,
  };
  const itemScope = input.visibility === 'private_remembered' ? 'long_term' : 'session';
  const preferences: z.infer<typeof preference>[] = [];
  const avoids: z.infer<typeof avoid>[] = [];
  const labels = new Set<PreferenceLabel>(input.selectedPreferences ?? []);
  const negatedLabels: Array<{ label: PreferenceLabel; hard: boolean }> = [];
  // Consume complete clauses only: "不要浪漫" must never become "浪漫".
  text = text.split('。').filter(part => {
    const negative = part.trim().match(/^(絕對不要|不要|不想要|不喜歡)(.+)$/u);
    if (negative && selectablePreferenceLabels.includes(negative[2] as PreferenceLabel)) {
      negatedLabels.push({ label: negative[2] as PreferenceLabel, hard: negative[1] === '絕對不要' });
      return false;
    }
    const label = part.trim() as PreferenceLabel;
    if (!selectablePreferenceLabels.includes(label)) return true;
    labels.add(label);
    return false;
  }).join('。');
  if (/(明亮|採光好|亮一點)/u.test(text)) preferences.push({
    attribute: 'bright', target_min: 0.6, importance: 0.8, confidence: 1,
    scope: itemScope, source: 'conversation',
  });
  if (/可愛/u.test(text)) preferences.push({
    attribute: 'cute', target_min: 0.4, importance: 0.7, confidence: 1,
    scope: itemScope, source: 'conversation',
  });
  if (/(不要(?:太)?幼稚|不幼稚|幼稚感.{0,4}(?:低|少|不要))/u.test(text)) avoids.push({
    attribute: 'childish', target_max: 0.3, importance: 0.9, hard: false, scope: itemScope,
  });
  if (/(想安靜|安靜聊天|能聊天)/u.test(text) && !/(不用很安靜|不要太安靜)/u.test(text)) preferences.push({
    attribute: 'quiet', target_min: 0.5, importance: 0.7, confidence: 1,
    scope: itemScope, source: 'conversation',
  });
  if (/(不要走太多|少走(?:一點)?路?|不想走太多)/u.test(text)) avoids.push({
    attribute: 'walking', target_max: 0.4, importance: 0.8, hard: false, scope: itemScope,
  });
  if (/浪漫/u.test(text)) preferences.push({
    attribute: 'romantic', target_min: 0.5, importance: 0.7, confidence: 1,
    scope: itemScope, source: 'conversation',
  });
  if (/(放鬆|輕鬆)/u.test(text)) preferences.push({
    attribute: 'relaxing', target_min: 0.5, importance: 0.7, confidence: 1,
    scope: itemScope, source: 'conversation',
  });
  if (/(互動|一起體驗|動手做)/u.test(text)) preferences.push({
    attribute: 'interactive', target_min: 0.5, importance: 0.7, confidence: 1,
    scope: itemScope, source: 'conversation',
  });
  if (/(新鮮|特別)/u.test(text)) preferences.push({
    attribute: 'freshness', target_min: 0.5, importance: 0.6, confidence: 1,
    scope: itemScope, source: 'conversation',
  });
  for (const label of labels) for (const target of targetsForLabel(label)) {
    if (target.min !== undefined) preferences.push({
      attribute: target.attribute, target_min: target.min, importance: .7, confidence: 1,
      scope: itemScope, source: 'selection',
    });
    if (target.max !== undefined) avoids.push({
      attribute: target.attribute, target_max: target.max, importance: .7, hard: false, scope: itemScope,
    });
  }
  for (const { label, hard: isHard } of negatedLabels) for (const target of targetsForLabel(label)) {
    if (target.min !== undefined) avoids.push({ attribute: target.attribute, target_max: .3,
      importance: .8, hard: isHard, scope: itemScope });
    // A hard lower bound cannot be represented by the current avoid schema; ask instead.
    if (target.max !== undefined) return {
      status: 'needs_clarification', engine: 'rule_baseline_v1', result: null,
      clarification: '請直接選擇想要的狀態或提供明確限制。', externalModelApiCalls: 0,
    };
  }
  const hard = emptyHardConstraints();
  hard.environment = environment;
  const walk = text.match(/(?:最多|不要超過)\s*(\d{1,3})\s*分鐘/u);
  if (walk) hard.max_walk_minutes = Number(walk[1]);
  const budget = text.match(/(?:每人|一人)\s*(?:最多|上限)?\s*(\d{2,6})\s*元?/u);
  if (budget) {
    hard.budget_scope = 'per_person';
    hard.absolute_budget = Number(budget[1]);
  }
  const unrestricted = /^(?:不限|都可以|沒有其他需求|沒有特別偏好)$/u.test(text.trim());
  const residual = (unrestricted ? '' : text)
    .replace(/明亮|採光好|亮一點/gu, '')
    .replace(/可愛/gu, '')
    .replace(/不要(?:太)?幼稚|不幼稚|幼稚感.{0,4}(?:低|少|不要)/gu, '')
    .replace(/想安靜聊天|想安靜|安靜聊天|能聊天/gu, '')
    .replace(/不要走太多路?|少走(?:一點)?路?|不想走太多路?/gu, '')
    .replace(/浪漫|放鬆|輕鬆|互動|一起體驗|動手做|新鮮|特別/gu, '')
    .replace(/(?:最多|不要超過)\s*\d{1,3}\s*分鐘/gu, '')
    .replace(/(?:每人|一人)\s*(?:最多|上限)?\s*\d{2,6}\s*元?/gu, '')
    .replace(/想找|想去|希望|我|的地方|地方|有一點|可以|也|而且|但|今天|請|[\s，。！？、,.!?]/gu, '');
  if (/[\p{L}\p{N}]/u.test(residual)) return {
    status: 'needs_clarification', engine: 'rule_baseline_v1', result: null,
    clarification: '目前規則無法安全解析完整句子，請把每項需求分開說明。', externalModelApiCalls: 0,
  };
  if (!unrestricted && !preferences.length && !avoids.length && hard.max_walk_minutes === null && hard.absolute_budget === null
    && environment.setting === null && environment.airConditioning === null) {
    return {
      status: 'needs_clarification', engine: 'rule_baseline_v1', result: null,
      clarification: '請補充想要或不想要的氣氛、活動，或可量化限制。', externalModelApiCalls: 0,
    };
  }
  return acceptParserOutput({
    status: 'parsed', engine: 'rule_baseline_v1', clarification: null, externalModelApiCalls: 0,
    result: {
      session_id: input.sessionId, mode: input.mode, visibility: input.visibility,
      preferences, avoid: avoids, hard_constraints: hard,
      context: { energy: 'unknown', remember: input.visibility === 'private_remembered' },
      parser_confidence: 1,
    },
  });
}
