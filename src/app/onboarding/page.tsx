"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setState } from "@/lib/store";
import { track } from "@/lib/analytics";
import { DIFFICULT_MOMENTS, GOALS, type Profile } from "@/lib/types";

const STEPS = 5;

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<string[]>([]);
  const [goalOther, setGoalOther] = useState("");
  const [moments, setMoments] = useState<string[]>([]);
  const [motivation, setMotivation] = useState("");

  function finish() {
    const profile: Profile = {
      goals,
      goalOther: goals.includes("Something else") && goalOther.trim() ? goalOther.trim() : undefined,
      difficultMoments: moments,
      motivation: motivation.trim(),
      createdAt: new Date().toISOString(),
      preferences: { coachingNotes: "" },
      nudges: { enabled: true, quietStart: 22, quietEnd: 8 },
      safetyMode: false,
    };
    setState((s) => ({ ...s, profile }));
    track("onboarding_completed", { goals: goals.length, moments: moments.length, motivation: !!profile.motivation });
    router.replace("/");
  }

  const next = () => setStep((s) => Math.min(STEPS - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <main className="page" style={{ paddingBottom: 24 }}>
      <div className="progress-dots" aria-hidden>
        {Array.from({ length: STEPS }, (_, i) => (
          <span key={i} data-active={i <= step} />
        ))}
      </div>

      {step === 0 && (
        <section className="stack" style={{ flex: 1, justifyContent: "center", gap: 16 }}>
          <h1>Cravings happen. Forrix helps you through them.</h1>
          <p className="muted">
            Talk through cravings, emotional eating, and difficult food decisions with an AI coach that learns what
            works for you.
          </p>
          <button className="btn primary block" onClick={next} style={{ marginTop: 16 }}>
            Get started
          </button>
        </section>
      )}

      {step === 1 && (
        <section className="stack" style={{ gap: 16 }}>
          <h1>What&apos;s your main goal right now?</h1>
          <p className="muted small">Pick as many as fit.</p>
          <div className="chips">
            {GOALS.map((g) => (
              <button key={g} className="chip" aria-pressed={goals.includes(g)} onClick={() => setGoals(toggle(goals, g))}>
                {g}
              </button>
            ))}
          </div>
          {goals.includes("Something else") && (
            <input
              className="textarea"
              style={{ minHeight: 0 }}
              placeholder="What is it?"
              value={goalOther}
              onChange={(e) => setGoalOther(e.target.value)}
            />
          )}
        </section>
      )}

      {step === 2 && (
        <section className="stack" style={{ gap: 16 }}>
          <h1>When is eating hardest for you?</h1>
          <p className="muted small">Select all that apply.</p>
          <div className="chips">
            {DIFFICULT_MOMENTS.map((m) => (
              <button
                key={m}
                className="chip"
                aria-pressed={moments.includes(m)}
                onClick={() => setMoments(toggle(moments, m))}
              >
                {m}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="stack" style={{ gap: 16 }}>
          <h1>Why does changing this matter to you?</h1>
          <p className="muted small">In your own words. Forrix will remember this.</p>
          <textarea
            className="textarea"
            style={{ minHeight: 140 }}
            placeholder="I want to lose 25 pounds and feel like I'm actually in control of my eating."
            value={motivation}
            onChange={(e) => setMotivation(e.target.value)}
          />
        </section>
      )}

      {step === 4 && (
        <section className="stack" style={{ flex: 1, justifyContent: "center", gap: 16 }}>
          <h1>You&apos;re ready.</h1>
          <p className="muted">Next time a craving hits, open Forrix before deciding what to do.</p>
          <button className="btn primary block" onClick={finish} style={{ marginTop: 16 }}>
            Go to Forrix
          </button>
        </section>
      )}

      {step > 0 && step < 4 && (
        <div className="row" style={{ marginTop: "auto" }}>
          <button className="btn ghost" onClick={back}>
            Back
          </button>
          <button
            className="btn primary"
            style={{ flex: 1 }}
            onClick={next}
            disabled={(step === 1 && goals.length === 0) || (step === 2 && moments.length === 0)}
          >
            {step === 3 && !motivation.trim() ? "Skip for now" : "Continue"}
          </button>
        </div>
      )}
    </main>
  );
}
