// Request/response shapes shared by the client and the API routes.

import type {
  ChatMessage,
  ConversationMode,
  Decision,
  DecisionKind,
  Extraction,
  FollowUp,
  MemoryKind,
  SafetyLevel,
} from "./types";

// What the coach knows about the person, assembled client-side from the store.
export interface CoachContext {
  goals: string[];
  difficultMoments: string[];
  motivation: string;
  coachingNotes: string;
  safetyMode: boolean;
  memories: string[];
  recentCheckIns: string[]; // short summaries of the last few conversations
  localTime: string; // "Tuesday 9:14 PM"
}

export interface ChatRequest {
  mode: ConversationMode;
  messages: Pick<ChatMessage, "role" | "text">[];
  context: CoachContext;
  decision?: Decision;
  // Set when the chat is resumed for a scheduled check-in.
  checkIn?: boolean;
}

// Newline-delimited JSON events streamed back from /api/chat.
export type ChatStreamEvent =
  | { type: "text"; text: string }
  | { type: "decision"; kind: DecisionKind; summary: string; followUpMinutes: number }
  | { type: "safety"; level: Exclude<SafetyLevel, "none">; reason: string }
  | { type: "error"; message: string }
  | { type: "done" };

export interface ExtractRequest {
  mode: ConversationMode;
  messages: Pick<ChatMessage, "role" | "text">[];
  decision?: Decision;
  followUp?: FollowUp;
  memories: { id: string; text: string; kind: MemoryKind }[];
  localTime: string;
}

export interface MemoryOp {
  op: "add" | "reinforce" | "retire";
  id: string | null;
  text: string;
  kind: MemoryKind;
}

export interface ExtractResponse {
  extraction: Extraction;
  memoryOps: MemoryOp[];
  safety: SafetyLevel;
}

export interface InsightsRequest {
  checkIns: string[];
  strategies: { strategy: string; tried: number; helped: number }[];
  memories: string[];
  safetyMode: boolean;
}

export interface InsightsResponse {
  observations: string[];
}
