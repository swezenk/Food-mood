import { useMemo, useState } from "react";
import { categoryInfo } from "../lib/categorize";
import { todayISO } from "../lib/dates";
import { money, shortDate } from "../lib/format";
import { badges, bucketsFor, makeBudget, noSpendDays, paceFor, periodRange, shiftAnchor, summarize, underBudgetStreak, type Period } from "../lib/stats";
import type { Settings, Txn } from "../lib/types";

const PERIODS: { id: Period; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
];

interface Props {
  txns: Txn[];
  settings: Settings;
  goTo: (tab: "import" | "settings") => void;
}

export default function Overview({ txns, settings, goTo }: Props) {
  const today = todayISO();
  const [period, setPeriod] = useState<Period>("month");
  const [anchor, setAnchor] = useState(today);

  const budgetFor = useMemo(() => makeBudget(txns, settings, today), [txns, settings, today]);
  const range = periodRange(period, anchor);
  const summary = useMemo(() => summarize(txns, range.start, range.end), [txns, range.start, range.end]);
  const pace = paceFor(range, today, budgetFor, summary.flexible);
  const bars = useMemo(() => bucketsFor(period, range, txns, budgetFor, today), [period, range.start, txns, budgetFor, today]);
  const streak = underBudgetStreak(txns, today, budgetFor);
  const quiet = noSpendDays(txns, today, today);
  const earned = useMemo(() => badges(txns, settings, today), [txns, settings, today]);

  if (txns.length === 0) {
    return (
      <div className="card empty">
        <h2>See where your money lands</h2>
        <p>Upload a bank statement (CSV) and Landing breaks your spending down by category, then shows how you're doing every day, week, month and year.</p>
        <button className="btn primary" onClick={() => goTo("import")}>
          Add your first statement
        </button>
      </div>
    );
  }

  const hasBudget = pace.periodBudget > 0;
  const under = pace.landing >= 0;
  const tone = !hasBudget ? "neutral" : under ? "good" : "bad";
  const fill = hasBudget ? Math.min(summary.flexible / pace.periodBudget, 1) : 0;
  const marker = hasBudget ? Math.min(pace.elapsedBudget / pace.periodBudget, 1) : 0;
  const unit = period === "day" ? "today" : `this ${period}`;
  const maxBar = Math.max(1, ...bars.map((b) => Math.max(b.spent, b.budget)));
  const nextDisabled = range.end >= today;

  return (
    <>
      <div className="seg" role="tablist" aria-label="Period">
        {PERIODS.map((p) => (
          <button key={p.id} role="tab" aria-selected={period === p.id} className={period === p.id ? "on" : ""} onClick={() => setPeriod(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="nav">
        <button className="icon" aria-label="Previous" onClick={() => setAnchor(shiftAnchor(period, anchor, -1))}>
          ‹
        </button>
        <strong>{range.label}</strong>
        <button className="icon" aria-label="Next" disabled={nextDisabled} onClick={() => setAnchor(shiftAnchor(period, anchor, 1))}>
          ›
        </button>
      </div>

      <section className={`card hero ${tone}`}>
        {hasBudget ? (
          <>
            <div className="eyebrow">{pace.isFuture ? "Upcoming" : under ? (pace.isCurrent ? "You're under budget" : "You landed under budget") : pace.isCurrent ? "You're over budget" : "You landed over budget"}</div>
            <div className="big">{money(Math.abs(pace.landing), period === "day")}</div>
            <div className="bar" aria-hidden>
              <span style={{ width: `${fill * 100}%` }} />
              {pace.isCurrent && <i style={{ left: `${marker * 100}%` }} />}
            </div>
            <div className="sub">
              Everyday spending {money(summary.flexible, period === "day")} of {money(pace.isCurrent ? pace.elapsedBudget : pace.periodBudget, period === "day")} {pace.isCurrent ? `budgeted so far ${unit}` : "budgeted"}
            </div>
            {summary.fixed > 0 && <div className="sub">Bills ({money(summary.fixed)}) are set aside first</div>}
          </>
        ) : (
          <>
            <div className="eyebrow">Spent</div>
            <div className="big">{money(summary.spent, period === "day")}</div>
            <div className="sub">
              No income found yet, so there's no daily budget.{" "}
              <button className="link" onClick={() => goTo("settings")}>
                Set your monthly income
              </button>
            </div>
          </>
        )}
      </section>

      <div className="tiles">
        <div className="card tile">
          <span>Income</span>
          <strong className="pos">{money(summary.income)}</strong>
        </div>
        <div className="card tile">
          <span>Spent</span>
          <strong>{money(summary.spent)}</strong>
        </div>
        <div className="card tile">
          <span>Kept</span>
          <strong className={summary.net >= 0 ? "pos" : "neg"}>{money(summary.net)}</strong>
        </div>
      </div>

      {bars.length > 0 && (
        <section className="card">
          <h3>{period === "year" ? "Everyday spending by month" : "Everyday spending by day"}</h3>
          <div className="chart" role="img" aria-label={`Spending per ${period === "year" ? "month" : "day"} against budget`}>
            {bars.map((b) => (
              <div key={b.start} className="col" title={`${shortDate(b.start)}: ${money(b.spent, true)} of ${money(b.budget, true)}`}>
                <div className="barwrap">
                  {b.budget > 0 && <em style={{ bottom: `${(b.budget / maxBar) * 100}%` }} />}
                  <span className={b.future ? "future" : b.budget > 0 && b.spent > b.budget ? "over" : ""} style={{ height: `${(b.spent / maxBar) * 100}%` }} />
                </div>
                <small className={period === "month" && Number(b.label) % 5 !== 1 ? "hide" : ""}>{b.label}</small>
              </div>
            ))}
          </div>
          <div className="legend">
            <span className="dot" /> under budget <span className="dot over" /> over <span className="line" /> daily budget
          </div>
        </section>
      )}

      <section className="card">
        <h3>Where it went</h3>
        {summary.byCategory.length === 0 ? (
          <p className="muted">No spending in this period.</p>
        ) : (
          <ul className="cats">
            {summary.byCategory.map((c) => {
              const info = categoryInfo(c.category);
              return (
                <li key={c.category}>
                  <div className="row">
                    <span>
                      {info.emoji} {c.category}
                    </span>
                    <span>
                      {money(c.amount)} <small>{Math.round(c.pct * 100)}%</small>
                    </span>
                  </div>
                  <div className="meter">
                    <span style={{ width: `${c.pct * 100}%`, background: info.color }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {period === "day" && summary.txns.length > 0 && (
        <section className="card">
          <h3>Transactions</h3>
          <ul className="list">
            {summary.txns.map((t) => (
              <li key={t.id}>
                <span>
                  {categoryInfo(t.category).emoji} {t.description}
                </span>
                <b className={t.amount > 0 ? "pos" : ""}>{money(t.amount, true)}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h3>Streaks &amp; badges</h3>
        <div className="streaks">
          <div>
            <strong>🔥 {streak}</strong>
            <span>day{streak === 1 ? "" : "s"} under budget</span>
          </div>
          <div>
            <strong>🧘 {quiet}</strong>
            <span>no-spend day{quiet === 1 ? "" : "s"} this month</span>
          </div>
        </div>
        <div className="badges">
          {earned.map((b) => (
            <div key={b.id} className={`badge ${b.earned ? "earned" : ""}`} title={b.hint}>
              <span>{b.emoji}</span>
              <small>{b.title}</small>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
