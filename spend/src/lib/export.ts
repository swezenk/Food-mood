import type { Txn } from "./types";

// Spreadsheet apps run cells starting with = + - @ as formulas; neutralise them.
const cell = (s: string) => `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;

export function toCSV(txns: Txn[]): string {
  const lines = ["date,description,amount,category"];
  for (const t of [...txns].sort((a, b) => (a.date < b.date ? -1 : 1))) lines.push([t.date, cell(t.description), t.amount.toFixed(2), cell(t.category)].join(","));
  return lines.join("\n") + "\n";
}

export function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
