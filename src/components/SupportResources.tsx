"use client";

import { CRISIS_RESOURCES, EATING_SUPPORT_RESOURCES } from "@/lib/safety";
import type { SafetyLevel } from "@/lib/types";

export default function SupportResources({ level }: { level: Exclude<SafetyLevel, "none"> }) {
  const crisis = level === "crisis";
  const resources = crisis ? [...CRISIS_RESOURCES, ...EATING_SUPPORT_RESOURCES] : EATING_SUPPORT_RESOURCES;
  return (
    <div className={`card ${crisis ? "danger" : "warn"}`} role={crisis ? "alert" : "note"}>
      <h2>{crisis ? "You don't have to go through this alone" : "Support is available"}</h2>
      <p className="small">
        {crisis
          ? "If you're thinking about hurting yourself, please reach out right now. If you're in immediate danger, call your local emergency number."
          : "Forrix is a coach for everyday eating struggles, not a replacement for professional care. What you've shared is worth talking through with someone trained to help."}
      </p>
      <ul className="stack small" style={{ margin: 0, paddingLeft: 18, gap: 4 }}>
        {resources.map((r) => (
          <li key={r.name}>
            <strong>{r.name}</strong>
            {" — "}
            {r.href ? <a href={r.href}>{r.detail}</a> : r.detail}
          </li>
        ))}
      </ul>
    </div>
  );
}
