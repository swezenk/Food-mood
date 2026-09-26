"use client";

import { useEffect } from "react";
import { useAppState } from "@/lib/store";
import { refreshObservations } from "@/lib/actions";
import {
  activeMemories,
  computePatterns,
  computeProgress,
  cravingConversations,
  MIN_EVENTS_FOR_PATTERNS,
} from "@/lib/patterns";

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="stat">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

function Ranked({ items }: { items: { value: string; count: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="stack" style={{ gap: 8 }}>
      {items.map((i) => (
        <div key={i.value} className="stack" style={{ gap: 4 }}>
          <div className="row small" style={{ justifyContent: "space-between" }}>
            <span>{i.value}</span>
            <span className="muted">{i.count}</span>
          </div>
          <div className="bar">
            <div style={{ width: `${(i.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Patterns() {
  const state = useAppState();
  const extracted = cravingConversations(state.conversations).filter((c) => c.extraction).length;
  const week = computePatterns(state, 7);
  const progress = computeProgress(state);
  const memories = activeMemories(state.memories).filter((m) => m.kind === "persistent");
  const lastControl = state.controlRatings.at(-1);

  useEffect(() => {
    void refreshObservations();
  }, [extracted]);

  return (
    <main className="page">
      <h1>My Patterns</h1>

      {extracted < MIN_EVENTS_FOR_PATTERNS ? (
        <div className="card">
          <p>
            Patterns show up after a few craving check-ins. You&apos;ve done {extracted} so far —{" "}
            {MIN_EVENTS_FOR_PATTERNS - extracted} more and Forrix will start noticing what&apos;s going on.
          </p>
        </div>
      ) : (
        <>
          <section className="stack">
            <h3>This week</h3>
            <div className="stats">
              <Stat value={week.checkIns} label="craving check-ins" />
              <Stat value={week.averageUrge != null ? `${week.averageUrge} / 10` : "—"} label="average urge" />
              <Stat value={week.topTrigger ?? "—"} label="most common trigger" />
              <Stat value={week.topWindow ?? "—"} label="most common time" />
              <Stat value={week.topCraving ?? "—"} label="most common craving" />
            </div>
          </section>

          {state.observations && state.observations.items.length > 0 && (
            <section className="stack">
              <h3>Something I&apos;m noticing</h3>
              {state.observations.items.map((o, i) => (
                <div key={i} className="card">
                  <p>{o.text}</p>
                </div>
              ))}
            </section>
          )}

          {week.triggers.length > 0 && (
            <section className="stack">
              <h3>Triggers</h3>
              <Ranked items={week.triggers} />
            </section>
          )}

          {week.cravings.length > 0 && (
            <section className="stack">
              <h3>Cravings</h3>
              <Ranked items={week.cravings} />
            </section>
          )}

          {week.strategies.length > 0 && (
            <section className="stack">
              <h3>Strategies</h3>
              {week.strategies.map((s) => (
                <div key={s.strategy} className="row small" style={{ justifyContent: "space-between" }}>
                  <span>{s.strategy}</span>
                  <span className="muted">
                    helped {s.helped} of {s.tried}
                  </span>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      <section className="stack">
        <h3>This month</h3>
        <div className="stats">
          <Stat value={progress.checkIns} label="craving check-ins" />
          <Stat value={progress.intentionalDecisions} label="intentional decisions" />
          <Stat value={progress.patternsDiscovered} label="patterns discovered" />
          <Stat value={progress.strategiesThatHelped} label="strategies that helped" />
        </div>
        {lastControl && (
          <p className="small muted">
            Feeling in control: {lastControl.value}/10 (
            {new Date(lastControl.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })})
          </p>
        )}
      </section>

      {memories.length > 0 && (
        <section className="stack">
          <h3>What Forrix has learned</h3>
          <ul className="stack" style={{ margin: 0, paddingLeft: 18, gap: 6 }}>
            {memories.map((m) => (
              <li key={m.id}>{m.text}</li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
