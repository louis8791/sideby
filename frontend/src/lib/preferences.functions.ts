import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { PreferenceProfile } from "./preference-types";

const Input = z.object({
  moods: z.array(z.string().min(1)).max(20).default([]),
  freeText: z.string().max(2000).default(""),
  hardNo: z.string().max(500).default(""),
  visibility: z
    .enum(["private_session", "private_remembered", "shared"])
    .default("private_session"),
});

export type PreferenceAnalysis = {
  profile: PreferenceProfile;
  /** Normalized data may be kept for future personalization. */
  remember: boolean;
  /** Partner may see the normalized summary (never the raw paragraph). */
  shareableWithPartner: boolean;
};

export const analyzePreferenceInput = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<PreferenceAnalysis> => {
    const { analyzePreferences } = await import("./preference-ai.server");
    const profile = await analyzePreferences({
      moods: data.moods,
      freeText: data.freeText,
      hardNo: data.hardNo,
    });

    // Privacy: raw private text is never returned or stored; only the
    // normalized profile leaves this boundary.
    return {
      profile,
      remember: data.visibility === "private_remembered",
      shareableWithPartner: data.visibility === "shared",
    };
  });
