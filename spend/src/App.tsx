import { useState } from "react";
import Import from "./components/Import";
import Overview from "./components/Overview";
import Settings from "./components/Settings";
import Transactions from "./components/Transactions";
import { useStore } from "./lib/store";

type Tab = "overview" | "transactions" | "import" | "settings";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "transactions", label: "Activity", icon: "🧾" },
  { id: "import", label: "Import", icon: "⬆️" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

export default function App() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>("overview");
  const { state } = store;

  return (
    <div className="app">
      <header>
        <h1>Landing</h1>
        <span>where your money lands</span>
      </header>
      <main>
        {tab === "overview" && <Overview txns={state.txns} settings={state.settings} goTo={setTab} />}
        {tab === "transactions" && <Transactions txns={state.txns} setCategory={store.setCategory} deleteTxn={store.deleteTxn} />}
        {tab === "import" && <Import importRows={store.importRows} onDone={() => setTab("overview")} />}
        {tab === "settings" && <Settings settings={state.settings} txns={state.txns} saveError={store.saveError} setSettings={store.setSettings} clearAll={store.clearAll} />}
      </main>
      <nav aria-label="Main">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "on" : ""} aria-current={tab === t.id ? "page" : undefined} onClick={() => setTab(t.id)}>
            <span aria-hidden>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
