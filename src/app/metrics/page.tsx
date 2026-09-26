"use client";

import Link from "next/link";
import { useAppState } from "@/lib/store";
import { computeMetrics } from "@/lib/metrics";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

// Per-device view of the MVP metrics (spec §19). Cohort-level numbers come
// from the server event log (data/events.jsonl).
export default function MetricsPage() {
  const state = useAppState();
  const m = computeMetrics(state);
  const rows: [string, string][] = [
    ["Activated (first craving conversation reached a decision)", m.activated ? "Yes" : "No"],
    ["Craving conversations / week", String(m.cravingConversationsPerWeek)],
    ["Repeat craving use within 7 days", m.repeatWithin7Days ? "Yes" : "No"],
    ["Intervention completion (started → decision)", pct(m.interventionCompletion)],
    ["Follow-up completion (decision → outcome)", pct(m.followUpCompletion)],
    ["Helpful: yes / somewhat / no", `${m.helpful.yes} / ${m.helpful.somewhat} / ${m.helpful.no}`],
    ["Weeks since onboarding", String(m.weeksActive)],
    ["Active in week 4", m.retainedWeek4 ? "Yes" : "No"],
  ];
  return (
    <main className="page">
      <Link href="/me" className="btn ghost" style={{ alignSelf: "flex-start", paddingLeft: 0 }}>
        ← Me
      </Link>
      <h1>Usage metrics</h1>
      <div className="card">
        {rows.map(([k, v]) => (
          <div key={k} className="row small" style={{ justifyContent: "space-between", gap: 16 }}>
            <span className="muted">{k}</span>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <p className="small muted">{state.events.length} events logged on this device.</p>
    </main>
  );
}
