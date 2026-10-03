const whole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const exact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export const money = (n: number, withCents = false) => (withCents ? exact : whole).format(Math.abs(n) < 0.005 ? 0 : n);

export const shortDate = (iso: string) =>
  new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8)).toLocaleDateString("en-US", { month: "short", day: "numeric" });
