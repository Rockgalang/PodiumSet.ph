export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addWorkingDays(from: Date, n: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

/** Today + n working days as a YYYY-MM-DD string, for <input type="date">. */
export function targetDateValue(from = new Date(), n = 2): string {
  const d = addWorkingDays(from, n);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export type DueTag = "overdue" | "due_today" | "due_tomorrow" | null;

export function dueTag(target: string | null, now = new Date()): DueTag {
  if (!target) return null;
  const t = startOfDay(new Date(target));
  const today = startOfDay(now);
  const diff = Math.round((t.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return "overdue";
  if (diff === 0) return "due_today";
  if (diff === 1) return "due_tomorrow";
  return null;
}

export const DUE_TAG_LABEL: Record<NonNullable<DueTag>, string> = {
  overdue: "Overdue",
  due_today: "Due Today",
  due_tomorrow: "Due Tomorrow",
};
