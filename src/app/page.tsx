"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getState, setState, useAppState } from "@/lib/store";
import { track } from "@/lib/analytics";
import { controlCheckDue, dueFollowUps, pickNudge } from "@/lib/patterns";
import Scale from "@/components/Scale";
import SupportResources from "@/components/SupportResources";

const TALK_PROMPTS = [
  "I ate way too much.",
  "I feel guilty about what I ate.",
  "I've been eating badly all week.",
  "I'm struggling today.",
];

export default function Home() {
  const state = useAppState();
  const [nudge, setNudge] = useState<string | null>(null);
  const [control, setControl] = useState<number | null>(null);

  // Pick at most one pattern-based nudge per day, when the app is opened.
  useEffect(() => {
    const text = pickNudge(getState());
    if (!text) return;
    setState((s) => ({ ...s, nudges: [...s.nudges, { text, at: new Date().toISOString() }] }));
    track("nudge_shown");
    setNudge(text);
  }, []);

  const followUps = dueFollowUps(state.conversations);
  const recent = [...state.conversations]
    .filter((c) => c.messages.some((m) => m.role === "user"))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 5);
  const showControl = controlCheckDue(state);

  function saveControl() {
    if (control == null) return;
    setState((s) => ({ ...s, controlRatings: [...s.controlRatings, { value: control, at: new Date().toISOString() }] }));
    track("control_rated", { value: control });
  }

  return (
    <main className="page">
      <header className="row" style={{ justifyContent: "space-between" }}>
        <h2>Forrix</h2>
      </header>

      {state.profile?.safetyMode && <SupportResources level="concern" />}

      {followUps.map((c) => (
        <Link key={c.id} href={`/checkin/${c.id}`} className="card" style={{ textDecoration: "none" }}>
          <h3>Checking back in</h3>
          <p>
            <strong>How did it go?</strong> <span className="muted">{c.decision?.summary}</span>
          </p>
        </Link>
      ))}

      {nudge && (
        <div className="card">
          <p>{nudge}</p>
          <div className="row">
            <Link
              href="/chat?mode=craving&source=nudge"
              className="btn primary"
              onClick={() => track("nudge_opened")}
            >
              Check in
            </Link>
            <button
              className="btn ghost"
              onClick={() => {
                track("nudge_dismissed");
                setNudge(null);
              }}
            >
              I&apos;m okay
            </button>
          </div>
        </div>
      )}

      <Link href="/chat?mode=craving&source=home" className="craving-btn">
        I&apos;m having a craving
        <span>Talk it through before deciding what to do.</span>
      </Link>

      <section className="stack">
        <Link href="/chat?mode=talk&source=home" className="btn block">
          Talk to Forrix
        </Link>
        <div className="chips">
          {TALK_PROMPTS.map((p) => (
            <Link
              key={p}
              href={`/chat?mode=talk&source=prompt&q=${encodeURIComponent(p)}`}
              className="chip small"
              style={{ textDecoration: "none" }}
            >
              {p}
            </Link>
          ))}
        </div>
        <Link href="/patterns" className="btn ghost block">
          My Patterns →
        </Link>
      </section>

      {showControl && (
        <div className="card">
          <h3>Weekly check</h3>
          <p>How in control have you felt around food this week?</p>
          <Scale min={1} max={10} value={control} onChange={setControl} labels={["Not at all", "Completely"]} />
          <button className="btn primary" disabled={control == null} onClick={saveControl}>
            Save
          </button>
        </div>
      )}

      {recent.length > 0 && (
        <section className="stack">
          <h3>Recent check-ins</h3>
          {recent.map((c) => (
            <Link key={c.id} href={`/chat?id=${c.id}`} className="list-btn">
              <div className="small muted">
                {new Date(c.startedAt).toLocaleString(undefined, {
                  weekday: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {c.mode === "talk" ? " · Talk" : ""}
              </div>
              <div>
                {c.extraction?.summary ??
                  c.messages.find((m) => m.role === "user")?.text.slice(0, 80) ??
                  "Conversation"}
              </div>
              {c.decision && c.decision.kind !== "undecided" && (
                <div className="small muted">Decided: {c.decision.summary}</div>
              )}
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
