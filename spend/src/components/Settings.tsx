import { useState } from "react";
import { download, toCSV } from "../lib/export";
import type { Settings as S, Txn } from "../lib/types";

interface Props {
  settings: S;
  txns: Txn[];
  saveError: boolean;
  setSettings: (patch: Partial<S>) => void;
  clearAll: () => void;
}

export default function Settings({ settings, txns, saveError, setSettings, clearAll }: Props) {
  const [income, setIncome] = useState(settings.monthlyIncome?.toString() ?? "");
  const [confirming, setConfirming] = useState(false);

  const commitIncome = () => {
    const n = parseFloat(income);
    setSettings({ monthlyIncome: Number.isFinite(n) && n >= 0 ? n : null });
    if (!Number.isFinite(n) || n < 0) setIncome("");
  };

  return (
    <>
      {saveError && <p className="error" role="alert">Your browser blocked saving, so changes will be lost when you close this tab. Export a backup below.</p>}
      <section className="card">
        <h3>Your budget</h3>
        <label className="field">
          Monthly income
          <input inputMode="decimal" placeholder="Detected from your deposits" value={income} onChange={(e) => setIncome(e.target.value)} onBlur={commitIncome} />
          <small>Leave blank to use the deposits found in your statements.</small>
        </label>
        <label className="field">
          Savings goal: {settings.savingsPct}% of income
          <input type="range" min={0} max={60} step={5} value={settings.savingsPct} onChange={(e) => setSettings({ savingsPct: Number(e.target.value) })} />
          <small>Set aside before your daily budget is calculated.</small>
        </label>
      </section>

      <section className="card">
        <h3>Your data</h3>
        <p className="muted">Everything lives in this browser on this device. There's no account and no server, so nothing can leak from one. Clearing your browser data erases it, so export a backup now and then.</p>
        <div className="actions">
          <button className="btn" disabled={txns.length === 0} onClick={() => download("landing-transactions.csv", toCSV(txns))}>
            Export CSV
          </button>
          {confirming ? (
            <>
              <button
                className="btn danger"
                onClick={() => {
                  clearAll();
                  setIncome("");
                  setConfirming(false);
                }}
              >
                Yes, delete everything
              </button>
              <button className="btn" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button className="btn danger-outline" disabled={txns.length === 0} onClick={() => setConfirming(true)}>
              Delete all data
            </button>
          )}
        </div>
      </section>
    </>
  );
}
