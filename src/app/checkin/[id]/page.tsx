"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/lib/store";
import { saveFollowUp } from "@/lib/actions";
import Scale from "@/components/Scale";
import { OUTCOME_LABELS, type HelpfulRating, type Outcome } from "@/lib/types";

const HELPFUL: { value: HelpfulRating; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "somewhat", label: "Somewhat" },
  { value: "no", label: "No" },
];

export default function CheckIn({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const state = useAppState();
  const convo = state.conversations.find((c) => c.id === id);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [helpful, setHelpful] = useState<HelpfulRating | null>(null);

  if (!convo) {
    return (
      <main className="page">
        <p>That check-in couldn&apos;t be found.</p>
        <Link href="/" className="btn">
          Home
        </Link>
      </main>
    );
  }

  if (convo.followUp) {
    return (
      <main className="page">
        <h1>Thanks for checking in.</h1>
        <Link href="/" className="btn primary">
          Home
        </Link>
      </main>
    );
  }

  function submit() {
    if (!outcome || satisfaction == null) return;
    void saveFollowUp(id, {
      outcome,
      satisfaction,
      note: note.trim() || undefined,
      helpful: helpful ?? undefined,
      at: new Date().toISOString(),
    });
    router.replace("/");
  }

  return (
    <main className="page">
      <Link href="/" className="btn ghost" style={{ alignSelf: "flex-start", paddingLeft: 0 }}>
        ← Home
      </Link>
      <div className="stack" style={{ gap: 4 }}>
        <h1>How did it go?</h1>
        {convo.decision && <p className="muted">You decided: {convo.decision.summary}</p>}
      </div>

      <section className="stack">
        {(Object.keys(OUTCOME_LABELS) as Outcome[]).map((o) => (
          <button key={o} className="chip" aria-pressed={outcome === o} onClick={() => setOutcome(o)}>
            {OUTCOME_LABELS[o]}
          </button>
        ))}
      </section>

      <section className="stack">
        <h3>How do you feel about the decision?</h3>
        <Scale min={1} max={5} value={satisfaction} onChange={setSatisfaction} labels={["Not great", "Really good"]} />
      </section>

      <section className="stack">
        <h3>Anything you noticed? (optional)</h3>
        <textarea
          className="textarea"
          placeholder="e.g. The craving faded after a few minutes"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </section>

      <section className="stack">
        <h3>Did this conversation help?</h3>
        <div className="chips">
          {HELPFUL.map((h) => (
            <button key={h.value} className="chip" aria-pressed={helpful === h.value} onClick={() => setHelpful(h.value)}>
              {h.label}
            </button>
          ))}
        </div>
      </section>

      <button className="btn primary block" disabled={!outcome || satisfaction == null} onClick={submit}>
        Save
      </button>
    </main>
  );
}
