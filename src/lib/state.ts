import type {
  Column,
  InternalStatus,
  RequestRow,
  SubscriptionRow,
} from "./types";
import { todayStr, diffDays } from "./dates";

export const COLUMNS: Array<{ key: Column; label: string; clientLabel: string }> = [
  { key: "lineup", label: "Project Lineup", clientLabel: "Project Lineup" },
  { key: "ongoing", label: "Ongoing", clientLabel: "Ongoing" },
  { key: "for_approval", label: "For Approval", clientLabel: "For Approval" },
  { key: "done", label: "Done", clientLabel: "Done" },
];

export const INTERNAL_STATUSES: Record<InternalStatus, string> = {
  in_progress: "In progress",
  blocked_assets: "Blocked — need client assets",
  awaiting_partner: "Awaiting partner",
  qa: "Internal QA",
};

/** These columns occupy a plan's active slot. */
export const BUSY_COLUMNS: Column[] = ["ongoing", "for_approval"];

export function slotsInUse(requests: RequestRow[]): number {
  return requests.filter((r) => BUSY_COLUMNS.includes(r.column)).length;
}

export function freeSlots(slots: number, requests: RequestRow[]): number {
  return Math.max(0, slots - slotsInUse(requests));
}

export function canPromoteToOngoing(
  slots: number,
  requests: RequestRow[]
): boolean {
  return slotsInUse(requests) < slots;
}

/** Which auto-approve deadline applies to a card currently in For Approval. */
export function autoApproveDate(approvalSince: string): string {
  return addBusinessDaysLocal(approvalSince, 3);
}

function addBusinessDaysLocal(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  let remaining = n;
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return d.toISOString().slice(0, 10);
}

export type Access =
  | { level: "none"; reason: "draft" | "rejected" }
  | { level: "waiting"; reason: "pending_payment" }
  | { level: "full" }
  | { level: "readonly"; reason: "paused" | "expired_grace" }
  | { level: "locked"; reason: "expired_locked" };

/**
 * Effective board access for a subscription.
 * active / expiring_soon → full
 * paused → readonly
 * expired → readonly during the 14-day download grace window, then locked
 */
export function accessFor(sub: SubscriptionRow): Access {
  switch (sub.status) {
    case "draft":
      return { level: "none", reason: "draft" };
    case "rejected":
      return { level: "none", reason: "rejected" };
    case "pending_payment":
      return { level: "waiting", reason: "pending_payment" };
    case "active":
    case "expiring_soon":
      return { level: "full" };
    case "paused":
      return { level: "readonly", reason: "paused" };
    case "expired": {
      const today = todayStr();
      const graceEnd = sub.grace_until || sub.expired_at || today;
      if (today <= graceEnd) {
        return { level: "readonly", reason: "expired_grace" };
      }
      return { level: "locked", reason: "expired_locked" };
    }
  }
}

export function isOnGrace(sub: SubscriptionRow): boolean {
  return accessFor(sub).level === "readonly";
}

export function graceDaysLeft(sub: SubscriptionRow): number {
  if (sub.status !== "expired" || !sub.grace_until) return 0;
  return Math.max(0, diffDays(todayStr(), sub.grace_until));
}

export function dueStatus(dueAt: string | null): "none" | "soon" | "overdue" {
  if (!dueAt) return "none";
  const hrs = (new Date(dueAt).getTime() - Date.now()) / 3600000;
  if (hrs < 0) return "overdue";
  if (hrs <= 24) return "soon";
  return "none";
}

export function entitlementKinds(): Array<{
  key: string;
  label: string;
  unit: string;
}> {
  return [
    { key: "consult_hours", label: "Consultancy", unit: "hrs" },
    { key: "shoot_hours", label: "Shoot", unit: "hrs" },
  ];
}
