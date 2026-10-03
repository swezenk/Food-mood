# Landing

A super simple spending app: upload a bank statement, see where the money went, and see where you land each day, week, month and year.

```bash
cd spend
npm install
npm run dev        # http://localhost:5173
npm test           # parser, categorizer, stats, store
npm run build      # type-checks, then builds to dist/
```

## How it works

- **Import**: drop a CSV exported from your bank. Handles signed amounts or debit/credit columns, US/EU dates and number formats, preamble lines, headerless files, and credit-card exports that list charges as positive. Re-importing overlapping files skips duplicates. "Load sample data" fills the app with made-up transactions.
- **Categories**: keyword rules (`src/lib/categorize.ts`) plus your corrections. Changing one transaction's category is remembered for that merchant.
- **Daily budget**: `(income − savings goal − fixed bills) ÷ days in month`. Fixed bills (Housing, Utilities, Subscriptions, Insurance) are set aside first so rent doesn't blow up a single day. Income comes from your deposits, or the override in Settings.
- **Landing**: how far under or over the budget you are so far in the day/week/month/year. Streaks, no-spend days and badges are the gamification.

## Security model (v1)

There is no backend. Statements are parsed in the browser and stored in `localStorage` on the user's device, so there is no server-side data to breach and no account to take over. Production builds ship a strict CSP (`connect-src 'none'`), CSV exports neutralise spreadsheet formula injection, uploads are size-limited, and stored data is validated on load.

Trade-offs: data isn't synced across devices and is lost if the browser's site data is cleared (Settings → Export CSV is the backup). Anyone with access to the unlocked device/browser profile can read it.

## Next steps

1. Automatic bank sync via Plaid (or Teller/MX): needs a small backend, encrypted token storage, managed auth with MFA, and an independent security review before launch.
2. Sync/backup across devices (end-to-end encrypted).
3. Custom categories and budgets per category; PDF statement parsing.
