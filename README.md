# Forrix

Forrix is the AI coach you open when you're about to eat in a way that conflicts with your goals. V1 tests one hypothesis: **will people reach for Forrix when a craving hits?**

The core loop: **urge → Forrix → conversation → decision → outcome → learning → better future intervention.**

## Running it

```bash
npm install
cp .env.example .env.local   # then set ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

The app is mobile-first; open it at phone width.

```bash
npm test          # unit tests (patterns, nudges, metrics, memory, safety screen)
npm run typecheck
npm run build
```

## What's in V1

| Spec area | Where |
| --- | --- |
| Onboarding (welcome, goals, difficult moments, motivation, finish) | `src/app/onboarding/page.tsx` |
| Home: "I'm having a craving", Talk to Forrix, My Patterns, recent check-ins | `src/app/page.tsx` |
| Craving conversation (understand → driver → reflect → decide → capture) | `src/app/chat/page.tsx`, `src/app/api/chat/route.ts`, `src/lib/server/prompts.ts` |
| Follow-up (outcome, 1–5 feeling, notes, "did this help?") | `src/app/checkin/[id]/page.tsx` |
| Structured craving record + memory extraction | `src/app/api/extract/route.ts`, `applyMemoryOps` in `src/lib/actions.ts` |
| My Patterns (weekly stats, triggers, cravings, strategies, AI observations) and monthly progress | `src/app/patterns/page.tsx`, `src/lib/patterns.ts`, `src/app/api/insights/route.ts` |
| Nudges (max 1/day, only from observed patterns, quiet hours) | `pickNudge` in `src/lib/patterns.ts` |
| "Feeling in control" weekly 1–10 check | Home screen, `controlCheckDue` |
| Me: goals, motivation, preferences, nudge settings, memories, history | `src/app/me/page.tsx` |
| Safety boundary | `src/lib/safety.ts`, safety section of the coach prompt, `flag_safety_concern` tool |
| MVP metrics instrumentation | `src/lib/analytics.ts`, `src/lib/metrics.ts`, `/metrics`, `data/events.jsonl` |

Nothing from the "don't build" list is here: no calorie tracking, macros, weight graphs, meal plans, integrations, or gamification.

## How it works

**The conversation.** Tapping "I'm having a craving" opens the chat immediately with the spec's opener ("What's going on? What are you wanting right now?"). There is no questionnaire and no model call for that first line. Each reply streams from `/api/chat`, which calls Claude with:

- a stable, cached system prompt holding the personality, the five loose phases, the decision paths, and the safety rules;
- a per-request context block holding the person's goals, hardest moments, motivation, coaching preferences, active memories, recent check-ins, and local time.

The model has two tools. `record_decision` captures the decision (intentional / wait / alternative / undecided) and sets the follow-up delay. `flag_safety_concern` switches the app into supportive mode. The route runs the tool loop server-side and streams newline-delimited JSON events (`text`, `decision`, `safety`, `error`, `done`) to the client.

**What gets stored.** When a conversation ends (Done, leaving the screen, or closing the page), `/api/extract` turns the transcript into the structured record from spec §10: craving, category, hunger, urge 1–10, trigger, driver, emotion, context, and strategy. It also returns memory operations (`add` / `reinforce` / `retire`). Temporary memories expire after 14 days. Persistent ones count as "patterns discovered". Extraction runs again after a follow-up, so memories learn from what actually happened.

**Follow-ups.** A decision schedules a check-in, usually 10 minutes for a wait and about 30 otherwise. It appears inside the chat if the person is still there, and as a "How did it go?" card on Home.

**Safety.** Two layers:

1. A deterministic regex screen on every user message catches explicit mentions of purging, laxatives, starving oneself, self-harm, or suicidal thoughts. It shows resources right away without waiting on the model.
2. The model flags subtler signals, such as frequent loss-of-control bingeing or severe guilt, through `flag_safety_concern`. Extraction also classifies safety.

Once anything is flagged, `profile.safetyMode` turns on. The coach drops all weight-loss framing and points toward professional support. Nudges stop, and support resources stay visible. The person can turn supportive mode off from Me.

**Model.** The model is `claude-opus-5` with adaptive thinking. You can override it with `FORRIX_MODEL`. Chat runs at medium effort, extraction at low, and insights at medium. Requests opt into server-side refusal fallbacks (`fallbacks: "default"`).

## V1 limitations (deliberate)

- **Data lives on the device** (localStorage via `src/lib/store.ts`). There are no accounts. The API routes are stateless. Swapping in a server store only touches `store.ts`.
- **Nudges and follow-ups show up in the app**, when it's opened. Real push notifications need a PWA service worker or a native shell.
- **Event logging** appends to `data/events.jsonl` via `/api/track`, which is enough for a small pilot. Replace it with a real analytics pipeline before a wider rollout.
- Support resources are US-centric, with a generic note for other countries.
