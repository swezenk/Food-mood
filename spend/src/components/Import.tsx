import { useRef, useState } from "react";
import { parseStatement, type ParseResult } from "../lib/csv";
import { shortDate } from "../lib/format";
import { sampleRows } from "../lib/sample";
import type { ParsedRow } from "../lib/types";

const MAX_BYTES = 5 * 1024 * 1024;

interface Props {
  importRows: (rows: ParsedRow[]) => { added: number; duplicates: number };
  onDone: () => void;
}

export default function Import({ importRows, onDone }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [flip, setFlip] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ added: number; duplicates: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const parsed: ParseResult | null = text === null ? null : parseStatement(text, { flipSigns: flip });

  async function readFile(file: File | undefined) {
    setError("");
    setResult(null);
    if (!file) return;
    if (file.size > MAX_BYTES) return setError("That file is over 5 MB. Export a shorter date range and try again.");
    if (!/\.(csv|txt|tsv)$/i.test(file.name) && !file.type.startsWith("text/")) return setError("Please choose a .csv file. PDF statements aren't supported yet.");
    setFlip(false);
    setName(file.name);
    setText(await file.text());
  }

  function confirm() {
    if (!parsed) return;
    setResult(importRows(parsed.rows));
    setText(null);
  }

  const dates = parsed?.rows.map((r) => r.date).sort();

  return (
    <>
      <section className="card">
        <h3>Upload a statement</h3>
        <p className="muted">Download a CSV from your bank's website (usually under "Download transactions" or "Export") and drop it here. Re-uploading overlapping files is safe: duplicates are skipped.</p>
        <div
          className={`drop ${drag ? "drag" : ""}`}
          onDragOver={(e) => (e.preventDefault(), setDrag(true))}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => (e.preventDefault(), setDrag(false), readFile(e.dataTransfer.files[0]))}
          onClick={() => input.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && input.current?.click()}
        >
          <strong>Drop a CSV here or tap to choose</strong>
          <small>Read on this device only. Nothing is uploaded anywhere.</small>
          <input ref={input} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" hidden onChange={(e) => (readFile(e.target.files?.[0]), (e.target.value = ""))} />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {parsed && (
        <section className="card">
          <h3>Preview: {name}</h3>
          {parsed.rows.length > 0 ? (
            <>
              <p>
                <b>{parsed.rows.length}</b> transactions, {shortDate(dates![0])} – {shortDate(dates![dates!.length - 1])}
              </p>
              <ul className="list">
                {parsed.rows.slice(0, 5).map((r, i) => (
                  <li key={i}>
                    <span>
                      {shortDate(r.date)} · {r.description}
                    </span>
                    <b className={r.amount > 0 ? "pos" : ""}>{r.amount.toFixed(2)}</b>
                  </li>
                ))}
              </ul>
              <label className="check">
                <input type="checkbox" checked={flip} onChange={(e) => setFlip(e.target.checked)} /> Amounts look backwards (spending shows as positive) – flip signs
              </label>
            </>
          ) : null}
          {parsed.warnings.map((w) => (
            <p key={w} className="warn">
              {w}
            </p>
          ))}
          <div className="actions">
            <button className="btn primary" disabled={parsed.rows.length === 0} onClick={confirm}>
              Import {parsed.rows.length || ""}
            </button>
            <button className="btn" onClick={() => setText(null)}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {result && (
        <section className="card good">
          <h3>Imported {result.added} transactions</h3>
          {result.duplicates > 0 && <p className="muted">{result.duplicates} duplicates skipped.</p>}
          <button className="btn primary" onClick={onDone}>
            See my overview
          </button>
        </section>
      )}

      <section className="card">
        <h3>Just exploring?</h3>
        <p className="muted">Load four months of made-up transactions to try the app. You can delete them in Settings.</p>
        <button className="btn" onClick={() => setResult(importRows(sampleRows()))}>
          Load sample data
        </button>
      </section>
    </>
  );
}
