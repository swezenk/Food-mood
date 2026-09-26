"use client";

import Link from "next/link";
import { useState } from "react";
import { resetState, setState, useAppState } from "@/lib/store";
import { GOALS, DIFFICULT_MOMENTS, type Profile } from "@/lib/types";
import { activeMemories } from "@/lib/patterns";

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function updateProfile(fn: (p: Profile) => Profile) {
  setState((s) => (s.profile ? { ...s, profile: fn(s.profile) } : s));
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: "numeric" });

export default function Me() {
  const state = useAppState();
  const profile = state.profile!;
  const [motivation, setMotivation] = useState(profile.motivation);
  const [notes, setNotes] = useState(profile.preferences.coachingNotes);
  const memories = activeMemories(state.memories);
  const history = [...state.conversations]
    .filter((c) => c.messages.some((m) => m.role === "user"))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  return (
    <main className="page">
      <h1>Me</h1>

      <section className="stack">
        <h3>Goals</h3>
        <div className="chips">
          {GOALS.map((g) => (
            <button
              key={g}
              className="chip small"
              aria-pressed={profile.goals.includes(g)}
              onClick={() => updateProfile((p) => ({ ...p, goals: toggle(p.goals, g) }))}
            >
              {g}
            </button>
          ))}
        </div>
      </section>

      <section className="stack">
        <h3>Hardest moments</h3>
        <div className="chips">
          {DIFFICULT_MOMENTS.map((m) => (
            <button
              key={m}
              className="chip small"
              aria-pressed={profile.difficultMoments.includes(m)}
              onClick={() => updateProfile((p) => ({ ...p, difficultMoments: toggle(p.difficultMoments, m) }))}
            >
              {m}
            </button>
          ))}
        </div>
      </section>

      <section className="stack">
        <h3>Motivation</h3>
        <textarea
          className="textarea"
          value={motivation}
          onChange={(e) => setMotivation(e.target.value)}
          onBlur={() => updateProfile((p) => ({ ...p, motivation: motivation.trim() }))}
          placeholder="Why does changing this matter to you?"
        />
      </section>

      <section className="stack">
        <h3>Preferences</h3>
        <textarea
          className="textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => updateProfile((p) => ({ ...p, preferences: { ...p.preferences, coachingNotes: notes.trim() } }))}
          placeholder="How do you like to be talked to? e.g. Keep it short. Don't tell me what I should do."
        />
      </section>

      <section className="stack">
        <h3>Nudges</h3>
        <label className="row">
          <input
            type="checkbox"
            checked={profile.nudges.enabled}
            onChange={(e) => updateProfile((p) => ({ ...p, nudges: { ...p.nudges, enabled: e.target.checked } }))}
          />
          <span>Let Forrix check in when it notices a pattern (at most once a day)</span>
        </label>
        {profile.nudges.enabled && (
          <div className="row small">
            <span className="muted">Quiet from</span>
            <select
              value={profile.nudges.quietStart}
              onChange={(e) =>
                updateProfile((p) => ({ ...p, nudges: { ...p.nudges, quietStart: Number(e.target.value) } }))
              }
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
            <span className="muted">to</span>
            <select
              value={profile.nudges.quietEnd}
              onChange={(e) =>
                updateProfile((p) => ({ ...p, nudges: { ...p.nudges, quietEnd: Number(e.target.value) } }))
              }
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      {profile.safetyMode && (
        <section className="card warn">
          <h2>Supportive mode is on</h2>
          <p className="small">
            Forrix noticed something in a past conversation that&apos;s worth talking through with a professional, so
            it&apos;s focusing on support rather than weight-loss coaching and has paused nudges.
          </p>
          <button
            className="btn"
            onClick={() => {
              if (confirm("Turn off supportive mode? Forrix will return to regular coaching.")) {
                updateProfile((p) => ({ ...p, safetyMode: false }));
              }
            }}
          >
            Turn off
          </button>
        </section>
      )}

      <section className="stack">
        <h3>What Forrix remembers</h3>
        {memories.length === 0 && <p className="small muted">Nothing yet. Forrix learns from your check-ins.</p>}
        {memories.map((m) => (
          <div key={m.id} className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div>{m.text}</div>
              <div className="small muted">{m.kind === "persistent" ? "Pattern" : "For now"}</div>
            </div>
            <button
              className="btn ghost small"
              style={{ minHeight: 0, padding: "4px 8px" }}
              aria-label={`Forget: ${m.text}`}
              onClick={() => setState((s) => ({ ...s, memories: s.memories.filter((x) => x.id !== m.id) }))}
            >
              Forget
            </button>
          </div>
        ))}
      </section>

      <section className="stack">
        <h3>History</h3>
        {history.length === 0 && <p className="small muted">No conversations yet.</p>}
        {history.map((c) => (
          <Link key={c.id} href={`/chat?id=${c.id}`} className="list-btn">
            <div className="small muted">
              {new Date(c.startedAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              {c.mode === "talk" ? " · Talk" : " · Craving"}
            </div>
            <div>{c.extraction?.summary ?? c.messages.find((m) => m.role === "user")?.text.slice(0, 80)}</div>
          </Link>
        ))}
      </section>

      <section className="stack">
        <Link href="/metrics" className="btn ghost block small">
          Usage metrics
        </Link>
        <button
          className="btn ghost block small"
          onClick={() => {
            if (confirm("Delete all your Forrix data from this device? This can't be undone.")) resetState();
          }}
        >
          Delete my data
        </button>
      </section>
    </main>
  );
}
