import { useCallback, useEffect, useState } from "react";
import { categorize, merchantKey } from "./categorize";
import type { ParsedRow, Settings, State, Txn } from "./types";

export const STORAGE_KEY = "landing:v1";

export const emptyState = (): State => ({
  txns: [],
  settings: { monthlyIncome: null, savingsPct: 0 },
  rules: {},
});

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);

const keyOf = (r: { date: string; amount: number; description: string }) => `${r.date}|${r.amount}|${r.description.toLowerCase()}`;

/**
 * Add parsed rows, skipping ones we already have. Identical rows within one file
 * (two coffees, same price, same day) are kept; re-importing the same file adds nothing.
 */
export function importRows(state: State, rows: ParsedRow[]): { state: State; added: number; duplicates: number } {
  const existing = new Map<string, number>();
  for (const t of state.txns) existing.set(keyOf(t), (existing.get(keyOf(t)) ?? 0) + 1);
  const seen = new Map<string, number>();
  const fresh: Txn[] = [];
  for (const r of rows) {
    const k = keyOf(r);
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    if (n <= (existing.get(k) ?? 0)) continue;
    fresh.push({ id: newId(), ...r, category: categorize(r.description, r.amount, state.rules) });
  }
  return { state: { ...state, txns: [...state.txns, ...fresh] }, added: fresh.length, duplicates: rows.length - fresh.length };
}

/** Recategorize one transaction, remember the choice, and apply it to the same merchant elsewhere. */
export function recategorize(state: State, id: string, category: string): State {
  const target = state.txns.find((t) => t.id === id);
  if (!target) return state;
  const key = merchantKey(target.description);
  return {
    ...state,
    rules: { ...state.rules, [key]: category },
    txns: state.txns.map((t) => (t.id === id || merchantKey(t.description) === key ? { ...t, category } : t)),
  };
}

function isTxn(x: unknown): x is Txn {
  const t = x as Txn;
  return !!t && typeof t.id === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.date) && typeof t.description === "string" && Number.isFinite(t.amount) && typeof t.category === "string";
}

export function loadState(raw: string | null): State {
  const base = emptyState();
  if (!raw) return base;
  try {
    const p = JSON.parse(raw);
    return {
      txns: Array.isArray(p.txns) ? p.txns.filter(isTxn) : [],
      settings: {
        monthlyIncome: Number.isFinite(p.settings?.monthlyIncome) ? p.settings.monthlyIncome : null,
        savingsPct: Number.isFinite(p.settings?.savingsPct) ? p.settings.savingsPct : 0,
      },
      rules: p.rules && typeof p.rules === "object" ? (Object.fromEntries(Object.entries(p.rules).filter(([, v]) => typeof v === "string")) as Record<string, string>) : {},
    };
  } catch {
    return base;
  }
}

function readStorage(): State {
  try {
    return loadState(localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptyState();
  }
}

export function useStore() {
  const [state, setState] = useState<State>(readStorage);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, [state]);

  const doImport = useCallback(
    (rows: ParsedRow[]) => {
      const res = importRows(state, rows);
      setState(res.state);
      return { added: res.added, duplicates: res.duplicates };
    },
    [state],
  );

  return {
    state,
    saveError,
    importRows: doImport,
    setCategory: (id: string, category: string) => setState((s) => recategorize(s, id, category)),
    deleteTxn: (id: string) => setState((s) => ({ ...s, txns: s.txns.filter((t) => t.id !== id) })),
    setSettings: (patch: Partial<Settings>) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
    clearAll: () => setState(emptyState()),
  };
}
