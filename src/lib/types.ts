// Core data model for Forrix V1. Everything here is persisted client-side
// (see store.ts); the server is stateless and receives what it needs per call.

export const GOALS = [
  "Lose weight",
  "Stop emotional eating",
  "Feel more in control around food",
  "Reduce cravings",
  "Stop overeating",
  "Something else",
] as const;

export const DIFFICULT_MOMENTS = [
  "Stress",
  "Boredom",
  "Late at night",
  "After work",
  "Social situations",
  "When I'm sad/upset",
  "When food is around",
  "Weekends",
  "After I've already eaten something unhealthy",
  "Strong cravings",
  "Other",
] as const;

export type DriverCategory =
  | "physical"
  | "emotional"
  | "environmental"
  | "habitual"
  | "reward"
  | "unknown";

// The three decision paths from the spec, plus "undecided".
export type DecisionKind = "intentional" | "wait" | "alternative" | "undecided";

export type Outcome =
  | "didnt_eat"
  | "ate_some"
  | "ate_original"
  | "chose_else"
  | "still_deciding";

export const OUTCOME_LABELS: Record<Outcome, string> = {
  didnt_eat: "I didn't eat it",
  ate_some: "I ate some",
  ate_original: "I ate what I originally wanted",
  chose_else: "I chose something else",
  still_deciding: "I'm still deciding",
};

export type HelpfulRating = "yes" | "somewhat" | "no";

export type ConversationMode = "craving" | "talk";

export interface Profile {
  goals: string[];
  goalOther?: string;
  difficultMoments: string[];
  motivation: string;
  createdAt: string;
  preferences: {
    // Free-text notes on how the user likes to be talked to.
    coachingNotes: string;
  };
  nudges: {
    enabled: boolean;
    quietStart: number; // hour 0-23
    quietEnd: number; // hour 0-23
  };
  // Set when a conversation surfaces possible disordered-eating or crisis
  // signals. Switches Forrix into supportive mode (no weight-loss coaching).
  safetyMode: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  at: string;
}

export interface Decision {
  kind: DecisionKind;
  summary: string; // "Tea + wait 10 minutes"
  followUpMinutes: number;
  at: string;
}

export interface FollowUp {
  outcome: Outcome;
  satisfaction: number; // 1-5
  note?: string;
  helpful?: HelpfulRating;
  at: string;
}

// Structured record extracted from a conversation (spec §10).
export interface Extraction {
  craving: string | null;
  cravingCategory: string | null; // "sweet", "salty", "fast food", ...
  hunger: "low" | "medium" | "high" | null;
  urgeIntensity: number | null; // 1-10
  trigger: string | null;
  driver: DriverCategory;
  emotion: string | null;
  context: string | null;
  strategy: string | null; // what they tried: "tea + wait", "walk"
  summary: string;
}

export interface Conversation {
  id: string;
  mode: ConversationMode;
  startedAt: string;
  endedAt?: string;
  messages: ChatMessage[];
  decision?: Decision;
  followUp?: FollowUp;
  extraction?: Extraction;
  safetyFlag?: SafetyLevel;
}

export type MemoryKind = "temporary" | "persistent";

export interface Memory {
  id: string;
  text: string;
  kind: MemoryKind;
  createdAt: string;
  updatedAt: string;
  // Temporary memories expire; persistent ones are durable patterns.
  expiresAt?: string;
  evidenceCount: number;
}

export interface ControlRating {
  value: number; // 1-10
  at: string;
}

export interface Observation {
  text: string;
  at: string;
}

export interface NudgeRecord {
  text: string;
  at: string;
  opened?: boolean;
}

export type SafetyLevel = "none" | "concern" | "crisis";

export interface AnalyticsEvent {
  name: string;
  at: string;
  props?: Record<string, string | number | boolean | null>;
}

export interface AppState {
  version: 1;
  profile: Profile | null;
  conversations: Conversation[];
  memories: Memory[];
  controlRatings: ControlRating[];
  observations: { items: Observation[]; basedOn: number; at: string } | null;
  nudges: NudgeRecord[];
  events: AnalyticsEvent[];
}
