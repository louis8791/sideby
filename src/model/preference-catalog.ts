// Client-safe vocabulary: labels describe the user's wishes, never evidence about a venue.
export const preferenceAttributes = [
  'bright', 'cute', 'childish', 'quiet', 'romantic', 'formal',
  'interactive', 'relaxing', 'freshness', 'walking', 'food_variety',
  'fun', 'quality', 'privacy', 'cognitive_load', 'service',
  'food', 'culture', 'photography', 'alcohol', 'night_view',
] as const;
export type PreferenceAttribute = typeof preferenceAttributes[number];
type Target = { attribute: PreferenceAttribute; min?: number; max?: number };
export const preferenceLabels = {
  '浪漫': [{ attribute: 'romantic', min: .5 }],
  '放鬆': [{ attribute: 'relaxing', min: .5 }],
  '安靜': [{ attribute: 'quiet', min: .5 }],
  '有趣': [{ attribute: 'fun', min: .5 }],
  '有質感': [{ attribute: 'quality', min: .5 }],
  '療癒': [{ attribute: 'relaxing', min: .6 }],
  '有儀式感': [{ attribute: 'formal', min: .6 }],
  '新鮮感': [{ attribute: 'freshness', min: .5 }],
  '熱鬧': [{ attribute: 'quiet', max: .4 }],
  '私密感': [{ attribute: 'privacy', min: .6 }],
  '輕鬆隨性': [{ attribute: 'relaxing', min: .5 }, { attribute: 'formal', max: .4 }],
  '特別一點': [{ attribute: 'freshness', min: .6 }],
  '有點累': [{ attribute: 'walking', max: .3 }],
  '精神很好': [{ attribute: 'walking', min: .6 }],
  '不想動腦': [{ attribute: 'cognitive_load', max: .3 }],
  '想聊天': [{ attribute: 'quiet', min: .5 }],
  '想放空': [{ attribute: 'relaxing', min: .6 }],
  '想走走': [{ attribute: 'walking', min: .5 }],
  '想做點事情': [{ attribute: 'interactive', min: .5 }],
  '想被照顧': [{ attribute: 'service', min: .6 }],
  '好好聊天': [{ attribute: 'quiet', min: .6 }],
  '一起體驗': [{ attribute: 'interactive', min: .5 }],
  '一起吃東西': [{ attribute: 'food', min: 1 }],
  '散步': [{ attribute: 'walking', min: .5 }],
  '看展 / 看表演': [{ attribute: 'culture', min: 1 }],
  '一起拍照': [{ attribute: 'photography', min: .5 }],
  '動手做東西': [{ attribute: 'interactive', min: .6 }],
  '找新店': [{ attribute: 'freshness', min: .6 }],
  '小酌': [{ attribute: 'alcohol', min: 1 }],
  '看夜景': [{ attribute: 'night_view', min: 1 }],
} as const satisfies Record<string, readonly Target[]>;
export type PreferenceLabel = keyof typeof preferenceLabels;
export const selectablePreferenceLabels = Object.keys(preferenceLabels) as [PreferenceLabel, ...PreferenceLabel[]];
export function targetsForLabel(label: PreferenceLabel): readonly Target[] { return preferenceLabels[label]; }
