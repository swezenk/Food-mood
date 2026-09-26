import type { AppState, Conversation, Profile } from "./types";
import { EMPTY_STATE } from "./store";

export const profile = (over: Partial<Profile> = {}): Profile => ({
  goals: ["Lose weight"],
  difficultMoments: ["Stress"],
  motivation: "Feel in control",
  createdAt: "2026-09-01T12:00:00",
  preferences: { coachingNotes: "" },
  nudges: { enabled: true, quietStart: 23, quietEnd: 7 },
  safetyMode: false,
  ...over,
});

let n = 0;
export const convo = (startedAt: string, over: Partial<Conversation> = {}): Conversation => ({
  id: `c${n++}`,
  mode: "craving",
  startedAt,
  messages: [{ role: "user", text: "hi", at: startedAt }],
  ...over,
});

export const state = (over: Partial<AppState> = {}): AppState => ({ ...EMPTY_STATE, profile: profile(), ...over });

export const extraction = (over: Partial<NonNullable<Conversation["extraction"]>> = {}) => ({
  craving: "donuts",
  cravingCategory: "sweet",
  hunger: "low" as const,
  urgeIntensity: 8,
  trigger: "work stress",
  driver: "emotional" as const,
  emotion: "exhausted",
  context: "home",
  strategy: "tea + wait",
  summary: "Evening donut craving after work",
  ...over,
});
