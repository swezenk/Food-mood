import { useMemo, useState } from "react";
import { CATEGORIES, categoryInfo } from "../lib/categorize";
import { money, shortDate } from "../lib/format";
import type { Txn } from "../lib/types";

interface Props {
  txns: Txn[];
  setCategory: (id: string, category: string) => void;
  deleteTxn: (id: string) => void;
}

const PAGE = 100;

export default function Transactions({ txns, setCategory, deleteTxn }: Props) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return txns
      .filter((t) => (!cat || t.category === cat) && (!needle || t.description.toLowerCase().includes(needle)))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [txns, q, cat]);

  if (txns.length === 0) return <div className="card empty"><p>No transactions yet. Import a statement to get started.</p></div>;

  return (
    <>
      <div className="filters">
        <input type="search" placeholder="Search" value={q} onChange={(e) => (setQ(e.target.value), setLimit(PAGE))} aria-label="Search transactions" />
        <select value={cat} onChange={(e) => (setCat(e.target.value), setLimit(PAGE))} aria-label="Filter by category">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.name}>{c.name}</option>
          ))}
        </select>
      </div>
      <p className="muted small">Changing a category also updates (and remembers) other transactions from the same merchant.</p>
      <section className="card">
        <ul className="list tx">
          {rows.slice(0, limit).map((t) => (
            <li key={t.id}>
              <div className="meta">
                <span className="desc">{t.description}</span>
                <small>{shortDate(t.date)}</small>
              </div>
              <select value={t.category} onChange={(e) => setCategory(t.id, e.target.value)} aria-label={`Category for ${t.description}`} style={{ borderColor: categoryInfo(t.category).color }}>
                {CATEGORIES.map((c) => (
                  <option key={c.name}>{c.name}</option>
                ))}
              </select>
              <b className={t.amount > 0 ? "pos" : ""}>{money(t.amount, true)}</b>
              <button className="icon" aria-label={`Delete ${t.description}`} onClick={() => deleteTxn(t.id)}>
                ×
              </button>
            </li>
          ))}
        </ul>
        {rows.length === 0 && <p className="muted">Nothing matches.</p>}
        {rows.length > limit && (
          <button className="btn" onClick={() => setLimit(limit + PAGE)}>
            Show more ({rows.length - limit} left)
          </button>
        )}
      </section>
    </>
  );
}
