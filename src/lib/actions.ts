"use client";

// Client-side actions: conversation lifecycle, calls to the API routes, and
// applying their results to the local store.

import { getState, newId, setState } from "./store";
import { track } from "./analytics";
import { activeMemories, computePatterns, cravingConversations, MIN_EVENTS_FOR_PATTERNS } from "./patterns";
import { maxLevel } from "./safety";
import type {
  ChatRequest,
  ChatStreamEvent,
  CoachContext,
  ExtractRequest,
  ExtractResponse,
  InsightsRequest,
  InsightsResponse,
  MemoryOp,
} from "./api-types";
import type {
  AppState,
  ChatMessage,
  Conversation,
  ConversationMode,
  Decision,
  FollowUp,
  Memory,
  SafetyLevel,
} from "./types";

const DAY = 24 * 60 * 60 * 1000;
const TEMP_MEMORY_DAYS = 14;

export const OPENERS: Record<ConversationMode, string> = {
  craving: "What's going on? What are you wanting right now?",
  talk: "I'm here. What's on your mind?",
};

export function localTimeLabel(d = new Date()): string {
  return d.toLocaleString(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" });
}

export function buildContext(state: AppState): CoachContext {
  const p = state.profile;
  const recent = [...state.conversations]
    .filter((c) => c.extraction)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 5)
    .map((c) => {
      const when = new Date(c.startedAt).toLocaleString(undefined, { weekday: "short", hour: "numeric" });
      const outcome = c.followUp ? ` Outcome: ${c.followUp.outcome.replace(/_/g, " ")}, felt ${c.followUp.satisfaction}/5.` : "";
      return `${when}: ${c.extraction!.summary}${outcome}`;
    });
  return {
    goals: p ? [...p.goals.filter((g) => g !== "Something else"), ...(p.goalOther ? [p.goalOther] : [])] : [],
    difficultMoments: p?.difficultMoments ?? [],
    motivation: p?.motivation ?? "",
    coachingNotes: p?.preferences.coachingNotes ?? "",
    safetyMode: p?.safetyMode ?? false,
    memories: activeMemories(state.memories).map((m) => m.text),
    recentCheckIns: recent,
    localTime: localTimeLabel(),
  };
}

// ---------- Conversation lifecycle ----------

export function startConversation(mode: ConversationMode, source: string): Conversation {
  const now = new Date().toISOString();
  const convo: Conversation = {
    id: newId(),
    mode,
    startedAt: now,
    messages: [{ role: "assistant", text: OPENERS[mode], at: now }],
  };
  setState((s) => ({ ...s, conversations: [...s.conversations, convo] }));
  track("conversation_started", { mode, source });
  return convo;
}

export function updateConversation(id: string, fn: (c: Conversation) => Conversation) {
  setState((s) => ({ ...s, conversations: s.conversations.map((c) => (c.id === id ? fn(c) : c)) }));
}

export function getConversation(id: string): Conversation | undefined {
  return getState().conversations.find((c) => c.id === id);
}

export function appendMessage(id: string, msg: ChatMessage) {
  updateConversation(id, (c) => ({ ...c, messages: [...c.messages, msg] }));
}

export function recordDecision(id: string, decision: Decision) {
  updateConversation(id, (c) => ({ ...c, decision }));
  track("decision_recorded", { kind: decision.kind, followUpMinutes: decision.followUpMinutes });
}

export function flagSafety(id: string | null, level: Exclude<SafetyLevel, "none">) {
  setState((s) => ({
    ...s,
    profile: s.profile ? { ...s.profile, safetyMode: true } : s.profile,
    conversations: s.conversations.map((c) =>
      c.id === id ? { ...c, safetyFlag: maxLevel(c.safetyFlag ?? "none", level) } : c,
    ),
  }));
  track("safety_flagged", { level });
}

// Ends the conversation (idempotent) and runs extraction in the background.
export async function endConversation(id: string) {
  const convo = getConversation(id);
  if (!convo || convo.endedAt) return;
  const userTurns = convo.messages.filter((m) => m.role === "user").length;
  updateConversation(id, (c) => ({ ...c, endedAt: new Date().toISOString() }));
  track("conversation_ended", { mode: convo.mode, userTurns, decided: !!convo.decision });
  if (userTurns > 0) await extract(id);
}

// ---------- Chat streaming ----------

export async function streamChat(
  req: ChatRequest,
  onEvent: (e: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) {
    let message = "Forrix couldn't respond. Try again in a moment.";
    try {
      message = ((await res.json()) as { error?: string }).error ?? message;
    } catch {}
    onEvent({ type: "error", message });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) onEvent(JSON.parse(line) as ChatStreamEvent);
    }
  }
}

// ---------- Extraction + memory ----------

export function applyMemoryOps(memories: Memory[], ops: MemoryOp[], now = new Date()): Memory[] {
  const iso = now.toISOString();
  const tempExpiry = new Date(now.getTime() + TEMP_MEMORY_DAYS * DAY).toISOString();
  let next = [...memories];
  for (const op of ops) {
    if (op.op === "add") {
      if (next.some((m) => m.text.trim().toLowerCase() === op.text.trim().toLowerCase())) continue;
      next.push({
        id: newId(),
        text: op.text,
        kind: op.kind,
        createdAt: iso,
        updatedAt: iso,
        expiresAt: op.kind === "temporary" ? tempExpiry : undefined,
        evidenceCount: 1,
      });
    } else if (op.op === "reinforce") {
      next = next.map((m) =>
        m.id === op.id
          ? {
              ...m,
              text: op.text || m.text,
              kind: m.kind === "persistent" ? "persistent" : op.kind,
              updatedAt: iso,
              expiresAt: (m.kind === "persistent" ? "persistent" : op.kind) === "temporary" ? tempExpiry : undefined,
              evidenceCount: m.evidenceCount + 1,
            }
          : m,
      );
    } else if (op.op === "retire") {
      next = next.filter((m) => m.id !== op.id);
    }
  }
  return next;
}

export async function extract(id: string): Promise<void> {
  const state = getState();
  const convo = state.conversations.find((c) => c.id === id);
  if (!convo) return;
  const body: ExtractRequest = {
    mode: convo.mode,
    messages: convo.messages.map(({ role, text }) => ({ role, text })),
    decision: convo.decision,
    followUp: convo.followUp,
    memories: activeMemories(state.memories).map(({ id, text, kind }) => ({ id, text, kind })),
    localTime: localTimeLabel(new Date(convo.startedAt)),
  };
  try {
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return;
    const data = (await res.json()) as ExtractResponse;
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) => (c.id === id ? { ...c, extraction: data.extraction } : c)),
      memories: applyMemoryOps(s.memories, data.memoryOps),
    }));
    if (data.safety !== "none") flagSafety(id, data.safety);
  } catch {
    // Extraction is best-effort; the conversation itself is already saved.
  }
}

// ---------- Follow-up ----------

export async function saveFollowUp(id: string, followUp: FollowUp) {
  updateConversation(id, (c) => ({ ...c, followUp }));
  track("followup_completed", { outcome: followUp.outcome, satisfaction: followUp.satisfaction });
  if (followUp.helpful) track("helpful_rated", { rating: followUp.helpful });
  // Re-extract so memories can learn from what actually happened.
  await extract(id);
}

// ---------- Insights ----------

export async function refreshObservations(force = false): Promise<void> {
  const state = getState();
  const cravings = cravingConversations(state.conversations).filter((c) => c.extraction);
  if (cravings.length < MIN_EVENTS_FOR_PATTERNS) return;
  const cached = state.observations;
  const fresh = cached && cached.basedOn === cravings.length && Date.now() - new Date(cached.at).getTime() < DAY;
  if (fresh && !force) return;

  const body: InsightsRequest = {
    checkIns: [...cravings]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 40)
      .map((c) => {
        const e = c.extraction!;
        const f = c.followUp;
        return [
          new Date(c.startedAt).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }),
          e.summary,
          e.urgeIntensity != null ? `urge ${e.urgeIntensity}/10` : null,
          e.hunger ? `hunger ${e.hunger}` : null,
          f ? `outcome: ${f.outcome.replace(/_/g, " ")}, felt ${f.satisfaction}/5` : null,
        ]
          .filter(Boolean)
          .join(" | ");
      }),
    strategies: computePatterns(state, 90).strategies,
    memories: activeMemories(state.memories).map((m) => m.text),
    safetyMode: state.profile?.safetyMode ?? false,
  };
  try {
    const res = await fetch("/api/insights", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return;
    const data = (await res.json()) as InsightsResponse;
    const at = new Date().toISOString();
    setState((s) => ({
      ...s,
      observations: { items: data.observations.map((text) => ({ text, at })), basedOn: cravings.length, at },
    }));
  } catch {}
}
