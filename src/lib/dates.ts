export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function toDateStr(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const s = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Calendar days from a to b (b - a). Uses UTC date boundaries. */
export function diffDays(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db2 = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db2 - da) / 86400000);
}

export function isBusinessDay(dateStr: string): boolean {
  const day = new Date(dateStr + "T00:00:00Z").getUTCDay();
  return day !== 0 && day !== 6;
}

export function addBusinessDays(dateStr: string, n: number): string {
  let d = dateStr;
  let remaining = n;
  while (remaining > 0) {
    d = addDays(d, 1);
    if (isBusinessDay(d)) remaining -= 1;
  }
  return d;
}

/** Business days between a and b, exclusive of a, inclusive of b. */
export function businessDaysBetween(a: string, b: string): number {
  if (b <= a) return 0;
  let count = 0;
  let d = addDays(a, 1);
  while (d <= b) {
    if (isBusinessDay(d)) count += 1;
    d = addDays(d, 1);
  }
  return count;
}

export function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3600000;
}

export function billingMonth(offsetMonths = 0): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + offsetMonths);
  return d.toISOString().slice(0, 7);
}
