export interface Txn {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  description: string;
  /** Positive = money in, negative = money out. */
  amount: number;
  category: string;
}

export interface Settings {
  /** Overrides income detected from deposits. */
  monthlyIncome: number | null;
  /** Percent of income to set aside before the daily budget is computed. */
  savingsPct: number;
}

export interface State {
  txns: Txn[];
  settings: Settings;
  /** merchant key -> category the user chose */
  rules: Record<string, string>;
}

export interface ParsedRow {
  date: string;
  description: string;
  amount: number;
}
