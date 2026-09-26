// Pure pattern/progress/nudge logic over stored conversations (spec §12–14).
// No I/O here so it is straightforward to unit test.

import type {
  AppState,
  Conversation,
  Memory,
  NudgeRecord,
  Profile,
} from "./types";

const DAY = 24 * 60 * 60 * 1000;

export const MIN_EVENTS_FOR_PATTERNS = 3;

export function cravingConversations(convos: Conversation[]): Conversation[] {
  return convos.filter((c) => c.mode === "craving");
}

export function withinDays(convos: Conversation[], days: number, now = new Date()) {
  const cutoff = now.getTime() - days * DAY;
  return convos.filter((c) => new Date(c.startedAt).getTime() >= cutoff);
}

function mostCommon(values: (string | null | undefined)[]): { value: string; count: number } | null {
  const counts = new Map<string, { value: string; count: number }>();
  for (const v of values) {
    if (!v) continue;
    const key = v.trim().toLowerCase();
    if (!key) continue;
    const entry = counts.get(key) ?? { value: v.trim(), count: 0 };
    entry.count++;
    counts.set(key, entry);
  }
  let best: { value: string; count: number } | null = null;
  for (const e of counts.values()) if (!best || e.count > best.count) best = e;
  return best;
}

// Two-hour windows read naturally ("8–10 PM") and smooth out small samples.
export function timeWindowLabel(startHour: number): string {
  const fmt = (h: number) => {
    const hh = ((h + 11) % 12) + 1;
    return { hh, ampm: h % 24 < 12 ? "AM" : "PM" };
  };
  const a = fmt(startHour);
  const b = fmt((startHour + 2) % 24);
  return a.ampm === b.ampm ? `${a.hh}–${b.hh} ${b.ampm}` : `${a.hh} ${a.ampm}–${b.hh} ${b.ampm}`;
}

export function mostCommonWindow(convos: Conversation[]): { label: string; startHour: number; count: number } | null {
  if (convos.length === 0) return null;
  const buckets = new Array(12).fill(0);
  for (const c of convos) buckets[Math.floor(new Date(c.startedAt).getHours() / 2)]++;
  let best = 0;
  for (let i = 1; i < 12; i++) if (buckets[i] > buckets[best]) best = i;
  return { label: timeWindowLabel(best * 2), startHour: best * 2, count: buckets[best] };
}

export interface StrategyStat {
  strategy: string;
  tried: number;
  helped: number;
}

// A strategy "helped" when the person didn't end up eating the thing they were
// fighting with, or felt good (4–5) about how it went.
export function strategyStats(convos: Conversation[]): StrategyStat[] {
  const map = new Map<string, StrategyStat>();
  for (const c of convos) {
    const s = c.extraction?.strategy ?? (c.decision && c.decision.kind !== "undecided" ? c.decision.summary : null);
    if (!s || !c.followUp) continue;
    const key = s.trim().toLowerCase();
    const stat = map.get(key) ?? { strategy: s.trim(), tried: 0, helped: 0 };
    stat.tried++;
    const f = c.followUp;
    if (f.outcome === "didnt_eat" || f.outcome === "chose_else" || f.satisfaction >= 4) stat.helped++;
    map.set(key, stat);
  }
  return [...map.values()].sort((a, b) => b.helped - a.helped || b.tried - a.tried);
}

export interface WeeklyPatterns {
  checkIns: number;
  topTrigger: string | null;
  topWindow: string | null;
  topCraving: string | null;
  averageUrge: number | null;
  triggers: { value: string; count: number }[];
  cravings: { value: string; count: number }[];
  strategies: StrategyStat[];
}

function ranked(values: (string | null | undefined)[]): { value: string; count: number }[] {
  const counts = new Map<string, { value: string; count: number }>();
  for (const v of values) {
    if (!v) continue;
    const key = v.trim().toLowerCase();
    const e = counts.get(key) ?? { value: v.trim(), count: 0 };
    e.count++;
    counts.set(key, e);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

export function computePatterns(state: AppState, days = 7, now = new Date()): WeeklyPatterns {
  const all = cravingConversations(state.conversations);
  const recent = withinDays(all, days, now);
  const urges = recent.map((c) => c.extraction?.urgeIntensity).filter((u): u is number => typeof u === "number");
  return {
    checkIns: recent.length,
    topTrigger: mostCommon(recent.map((c) => c.extraction?.trigger))?.value ?? null,
    topWindow: mostCommonWindow(recent)?.label ?? null,
    topCraving:
      mostCommon(recent.map((c) => c.extraction?.cravingCategory ?? c.extraction?.craving))?.value ?? null,
    averageUrge: urges.length ? Math.round((urges.reduce((a, b) => a + b, 0) / urges.length) * 10) / 10 : null,
    triggers: ranked(all.map((c) => c.extraction?.trigger)).slice(0, 5),
    cravings: ranked(all.map((c) => c.extraction?.cravingCategory ?? c.extraction?.craving)).slice(0, 5),
    strategies: strategyStats(all).slice(0, 5),
  };
}

export interface MonthlyProgress {
  checkIns: number;
  intentionalDecisions: number;
  patternsDiscovered: number;
  strategiesThatHelped: number;
}

export function computeProgress(state: AppState, now = new Date()): MonthlyProgress {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const month = state.conversations.filter((c) => new Date(c.startedAt).getTime() >= monthStart);
  return {
    checkIns: month.filter((c) => c.mode === "craving").length,
    // Any explicit decision counts — having the donut on purpose is a win too.
    intentionalDecisions: month.filter((c) => c.decision && c.decision.kind !== "undecided").length,
    patternsDiscovered: state.memories.filter((m) => m.kind === "persistent").length,
    strategiesThatHelped: strategyStats(state.conversations).filter((s) => s.helped > 0).length,
  };
}

export function activeMemories(memories: Memory[], now = new Date()): Memory[] {
  return memories.filter((m) => !m.expiresAt || new Date(m.expiresAt).getTime() > now.getTime());
}

// ---------- Follow-ups ----------

export function dueFollowUps(convos: Conversation[], now = new Date()): Conversation[] {
  return convos.filter((c) => {
    if (!c.decision || c.followUp || c.decision.kind === "undecided") return false;
    const due = new Date(c.decision.at).getTime() + c.decision.followUpMinutes * 60 * 1000;
    // Stop asking after two days; a stale "how did it go?" feels robotic.
    return due <= now.getTime() && now.getTime() - due < 2 * DAY;
  });
}

// ---------- Nudges (spec §13) ----------

export const MAX_NUDGES_PER_DAY = 1;

export function nudgesToday(nudges: NudgeRecord[], now = new Date()): number {
  return nudges.filter((n) => new Date(n.at).toDateString() === now.toDateString()).length;
}

function inQuietHours(profile: Profile, hour: number): boolean {
  const { quietStart, quietEnd } = profile.nudges;
  if (quietStart === quietEnd) return false;
  return quietStart < quietEnd
    ? hour >= quietStart && hour < quietEnd
    : hour >= quietStart || hour < quietEnd;
}

// Returns a pattern-grounded nudge if one is warranted right now, else null.
// Nudges only come from observed behavior, never generic reminders, and we
// skip them entirely while the person is in supportive (safety) mode.
export function pickNudge(state: AppState, now = new Date()): string | null {
  const profile = state.profile;
  if (!profile || !profile.nudges.enabled || profile.safetyMode) return null;
  if (nudgesToday(state.nudges, now) >= MAX_NUDGES_PER_DAY) return null;
  if (inQuietHours(profile, now.getHours())) return null;

  const cravings = withinDays(cravingConversations(state.conversations), 21, now);
  if (cravings.length < MIN_EVENTS_FOR_PATTERNS) return null;

  // Don't nudge someone who already checked in today.
  if (cravings.some((c) => new Date(c.startedAt).toDateString() === now.toDateString())) return null;

  const window = mostCommonWindow(cravings);
  const hour = now.getHours();
  if (window && window.count >= MIN_EVENTS_FOR_PATTERNS) {
    // Surface it in the hour or two before the hard window starts.
    const lead = (window.startHour - hour + 24) % 24;
    if (lead <= 2) {
      const part = window.startHour >= 17 || window.startHour < 4 ? "Evenings" : window.startHour >= 12 ? "Afternoons" : "Mornings";
      return `${part} have been the hardest part of the day lately. How are you doing ${window.startHour >= 17 ? "tonight" : "today"}?`;
    }
  }

  const trigger = mostCommon(cravings.map((c) => c.extraction?.trigger));
  if (trigger && trigger.count >= MIN_EVENTS_FOR_PATTERNS && /stress|work/i.test(trigger.value) && hour >= 16 && hour <= 19) {
    return "Long day? You've noticed stress tends to make cravings stronger. Worth checking in with yourself before tonight gets going.";
  }
  return null;
}

// ---------- Weekly "feeling in control" check (spec §14) ----------

export function controlCheckDue(state: AppState, now = new Date()): boolean {
  if (!state.profile) return false;
  const last = state.controlRatings.at(-1);
  const since = last ? new Date(last.at) : new Date(state.profile.createdAt);
  return now.getTime() - since.getTime() >= 7 * DAY;
}
