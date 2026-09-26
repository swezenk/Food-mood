"use client";

import { setState } from "./store";
import type { AnalyticsEvent } from "./types";

// Event names instrumented from day one (spec §19). Metrics are derived from
// these plus conversation records in metrics.ts.
export type EventName =
  | "onboarding_completed"
  | "conversation_started"
  | "conversation_ended"
  | "decision_recorded"
  | "followup_completed"
  | "helpful_rated"
  | "nudge_shown"
  | "nudge_opened"
  | "nudge_dismissed"
  | "safety_flagged"
  | "control_rated";

const MAX_LOCAL_EVENTS = 2000;

export function track(name: EventName, props?: AnalyticsEvent["props"]) {
  const event: AnalyticsEvent = { name, at: new Date().toISOString(), props };
  setState((s) => ({ ...s, events: [...s.events, event].slice(-MAX_LOCAL_EVENTS) }));
  // Best-effort server copy so metrics survive across devices/clears.
  fetch("/api/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...event, installId: installId() }),
    keepalive: true,
  }).catch(() => {});
}

function installId(): string {
  try {
    let id = localStorage.getItem("forrix:install");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("forrix:install", id);
    }
    return id;
  } catch {
    return "unknown";
  }
}
