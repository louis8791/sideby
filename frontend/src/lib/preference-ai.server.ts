// Server-only AI provider for structuring private date preferences.
// Isolated + modular: swap `analyzeWithGemini` for another provider without
// touching callers. The API key never leaves the server.

import type { PreferenceProfile } from "./preference-types";
export type { PreferenceProfile };

export type PreferenceInput = {
  moods: string[];
  freeText: string;
  hardNo: string;
};

const MODEL = "gemini-3.6-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_PROMPT = `你是一個偏好結構化引擎，只負責把使用者的私密約會偏好整理成結構化資料。
規則：
- 只輸出 JSON，不要說明文字。
- 絕對不要推薦、發明或提及任何實際餐廳、店名、地點或地址。
- 只做合理推論，不要過度解讀含糊的敘述；無法判斷時使用 "unspecified" 或空陣列。
- 使用繁體中文（台灣用語）填寫文字欄位。
- hard_exclusions 必須完整包含使用者明確拒絕的項目。`;

const SCHEMA = {
  type: "object",
  properties: {
    moods: { type: "array", items: { type: "string" } },
    preferred_place_types: { type: "array", items: { type: "string" } },
    preferred_activities: { type: "array", items: { type: "string" } },
    soft_preferences: { type: "array", items: { type: "string" } },
    hard_exclusions: { type: "array", items: { type: "string" } },
    energy_level: { type: "string", enum: ["low", "medium", "high", "unspecified"] },
    walking_preference: { type: "string", enum: ["low", "medium", "high", "unspecified"] },
    indoor_outdoor: { type: "string", enum: ["indoor", "outdoor", "either", "unspecified"] },
    food_preferences: { type: "array", items: { type: "string" } },
    other_constraints: { type: "array", items: { type: "string" } },
  },
  required: [
    "moods",
    "preferred_place_types",
    "preferred_activities",
    "soft_preferences",
    "hard_exclusions",
    "energy_level",
    "walking_preference",
    "indoor_outdoor",
    "food_preferences",
    "other_constraints",
  ],
} as const;

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

// Validation gate: anything unexpected from the model is normalized away.
export function normalizeProfile(raw: unknown, input: PreferenceInput): PreferenceProfile {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const moods = strings(obj['moods']);
  const exclusions = strings(obj['hard_exclusions']);
  const fallbackExclusions = input.hardNo
    .split(/[,、,\n;；]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    moods: moods.length ? moods : input.moods,
    preferred_place_types: strings(obj['preferred_place_types']),
    preferred_activities: strings(obj['preferred_activities']),
    soft_preferences: strings(obj['soft_preferences']),
    hard_exclusions: exclusions.length ? exclusions : fallbackExclusions,
    energy_level: pick(obj['energy_level'], ["low", "medium", "high", "unspecified"], "unspecified"),
    walking_preference: pick(
      obj['walking_preference'],
      ["low", "medium", "high", "unspecified"],
      "unspecified",
    ),
    indoor_outdoor: pick(
      obj['indoor_outdoor'],
      ["indoor", "outdoor", "either", "unspecified"],
      "unspecified",
    ),
    food_preferences: strings(obj['food_preferences']),
    other_constraints: strings(obj['other_constraints']),
  };
}

export async function analyzePreferences(input: PreferenceInput): Promise<PreferenceProfile> {
  const apiKey = process.env['GEMINI_API_KEY'] ?? process.env['gemini_api_key'];
  if (!apiKey) throw new Error("AI provider is not configured");

  const userPrompt = [
    `心情標籤：${input.moods.length ? input.moods.join("、") : "（未選）"}`,
    `自由描述：${input.freeText.trim() || "（無）"}`,
    `絕對不要：${input.hardNo.trim() || "（無）"}`,
  ].join("\n");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
      },
    }),
  });

  if (!res.ok) {
    // Never surface raw provider output to the client.
    console.error("[preference-ai] provider error", res.status, await res.text());
    throw new Error("AI analysis failed");
  }

  const payload = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error("[preference-ai] malformed model output");
      throw new Error("AI analysis failed");
    }
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      console.error("[preference-ai] malformed model output");
      throw new Error("AI analysis failed");
    }
  }

  return normalizeProfile(parsed, input);
}
