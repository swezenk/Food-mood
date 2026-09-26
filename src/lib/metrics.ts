// MVP metrics (spec §19), computed from local conversation records. The same
// definitions apply to the server-side event log in data/events.jsonl.

import type { AppState, HelpfulRating } from "./types";
import { cravingConversations } from "./patterns";

const DAY = 24 * 60 * 60 * 1000;

export interface Metrics {
  activated: boolean; // completed a first craving conversation (reached a decision)
  cravingConversationsPerWeek: number;
  repeatWithin7Days: boolean;
  interventionCompletion: number | null; // started → decision
  followUpCompletion: number | null; // decision → reported outcome
  helpful: Record<HelpfulRating, number>;
  weeksActive: number;
  retainedWeek4: boolean;
}

const ratio = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 100) / 100);

export function computeMetrics(state: AppState, now = new Date()): Metrics {
  const cravings = cravingConversations(state.conversations).sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  );
  const decided = cravings.filter((c) => c.decision && c.decision.kind !== "undecided");
  const followed = decided.filter((c) => c.followUp);

  const start = state.profile ? new Date(state.profile.createdAt).getTime() : now.getTime();
  const weeks = Math.max(1, (now.getTime() - start) / (7 * DAY));

  const first = decided[0];
  const repeat =
    !!first &&
    cravings.some(
      (c) =>
        c.id !== first.id &&
        new Date(c.startedAt).getTime() > new Date(first.startedAt).getTime() &&
        new Date(c.startedAt).getTime() - new Date(first.startedAt).getTime() <= 7 * DAY,
    );

  const helpful: Record<HelpfulRating, number> = { yes: 0, somewhat: 0, no: 0 };
  for (const c of state.conversations) if (c.followUp?.helpful) helpful[c.followUp.helpful]++;

  const week4Start = start + 21 * DAY;
  const week4End = start + 28 * DAY;

  return {
    activated: !!first,
    cravingConversationsPerWeek: Math.round((cravings.length / weeks) * 10) / 10,
    repeatWithin7Days: repeat,
    interventionCompletion: ratio(decided.length, cravings.length),
    followUpCompletion: ratio(followed.length, decided.length),
    helpful,
    weeksActive: Math.floor(weeks),
    retainedWeek4: state.conversations.some((c) => {
      const t = new Date(c.startedAt).getTime();
      return t >= week4Start && t < week4End;
    }),
  };
}
