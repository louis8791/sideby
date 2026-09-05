// Shared, client-safe preference types.
export type PreferenceProfile = {
  moods: string[];
  preferred_place_types: string[];
  preferred_activities: string[];
  soft_preferences: string[];
  hard_exclusions: string[];
  energy_level: "low" | "medium" | "high" | "unspecified";
  walking_preference: "low" | "medium" | "high" | "unspecified";
  indoor_outdoor: "indoor" | "outdoor" | "either" | "unspecified";
  food_preferences: string[];
  other_constraints: string[];
};
