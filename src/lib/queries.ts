import { db } from "./db";
import { todayStr, addDays, diffDays, businessDaysBetween, billingMonth } from "./dates";
import { addWorkingDays } from "./workdays";
import { canPromoteToOngoing, slotsInUse } from "./state";
import { notify, notifyAdmin, clientLink } from "./notify";
import { deleteDriveFile, isDriveUrl } from "./drive";
import { peso } from "./format";
import * as fs from "node:fs";
import * as path from "node:path";
import type {
  AccountRow,
  UserRow,
  PlanRow,
  AddonRow,
  RequestTypeRow,
  RequestRow,
  PhaseRow,
  BrandProfileRow,
  PaymentRow,
  EntitlementLogRow,
  AdsUpdateRow,
  BriefField,
  AvailableRules,
  Column,
  InternalStatus,
} from "./types";

export { getSubscriptionBundle } from "./session";

/* ============================= Catalog ============================= */

export async function getPlans(): Promise<PlanRow[]> {
  return await db
    .prepare("SELECT * FROM plan ORDER BY sort_order")
    .all() as PlanRow[];
}

export async function getPlan(id: number): Promise<PlanRow | undefined> {
  return await db.prepare("SELECT * FROM plan WHERE id = ?").get(id) as
    | PlanRow
    | undefined;
}

export async function getAddons(): Promise<AddonRow[]> {
  return await db.prepare("SELECT * FROM addon ORDER BY id").all() as AddonRow[];
}

export interface ParsedRequestType
  extends Omit<RequestTypeRow, "brief_schema" | "available_rules"> {
  brief_schema: BriefField[];
  available_rules: AvailableRules;
}

export async function getRequestTypes(): Promise<ParsedRequestType[]> {
  const rows = await db
    .prepare("SELECT * FROM request_type ORDER BY sort_order")
    .all() as RequestTypeRow[];
  return rows.map((r) => ({
    ...r,
    brief_schema: JSON.parse(r.brief_schema) as BriefField[],
    available_rules: JSON.parse(r.available_rules) as AvailableRules,
  }));
}

export async function getRequestType(id: number): Promise<ParsedRequestType | undefined> {
  const r = await db.prepare("SELECT * FROM request_type WHERE id = ?").get(id) as
    | RequestTypeRow
    | undefined;
  if (!r) return undefined;
  return {
    ...r,
    brief_schema: JSON.parse(r.brief_schema) as BriefField[],
    available_rules: JSON.parse(r.available_rules) as AvailableRules,
  };
}

export async function addonsForSubscription(subscriptionId: number): Promise<AddonRow[]> {
  return await db
    .prepare(
      `SELECT a.* FROM subscription_addon sa
       JOIN addon a ON a.id = sa.addon_id
       WHERE sa.subscription_id = ? AND sa.active = 1`
    )
    .all(subscriptionId) as AddonRow[];
}

export async function totalDue(
  plan: PlanRow | null,
  addons: AddonRow[]
): Promise<number> {
  let total = plan?.price_php ?? 0;
  for (const a of addons) {
    total += plan ? a.bundled_price_php : a.price_php;
  }
  return total;
}

export async function requestTypeAvailableOn(
  rt: ParsedRequestType,
  plan: PlanRow | null,
  addons: AddonRow[]
): Promise<{ available: boolean; reason?: string }> {
  const rules = rt.available_rules;
  if (rules.requires_video && !plan?.includes_video)
    return {
      available: false,
      reason: "Video editing requires the Multimedia package or above.",
    };
  if (rules.requires_consult && !plan?.consult_hours)
    return {
      available: false,
      reason: "Consultancy is included in the Multimedia package or above.",
    };
  if (rules.requires_shoot && !plan?.shoot_hours)
    return {
      available: false,
      reason: "Shoot hours are included in the Marketing package or above.",
    };
  if (rules.requires_ads && !plan?.includes_ads)
    return {
      available: false,
      reason: "Ad campaign setup requires Advertising Management.",
    };
  if (rules.requires_addon) {
    const key = rules.requires_addon.toLowerCase().replace(/[^a-z0-9]/g, "");
    const has = addons.some(
      (a) => a.name.toLowerCase().replace(/[^a-z0-9]/g, "") === key
    );
    if (!has)
      return {
        available: false,
        reason: "This request type requires the AI Creative add-on.",
      };
  }
  return { available: true };
}

export async function addonBySlug(slug: string): Promise<AddonRow | undefined> {
  return await db
    .prepare("SELECT * FROM addon WHERE name = ?")
    .get(slug) as AddonRow | undefined;
}

/* ============================= Auth / accounts ============================= */

export async function getUserByEmail(email: string): Promise<UserRow | undefined> {
  return await db.prepare("SELECT * FROM user WHERE email = ?").get(email) as
    | UserRow
    | undefined;
}

export async function getAccount(id: number): Promise<AccountRow | undefined> {
  return await db.prepare("SELECT * FROM account WHERE id = ?").get(id) as
    | AccountRow
    | undefined;
}

export async function createAccountAndUser(data: {
  business_name: string;
  contact_name: string;
  email: string;
  mobile: string;
  viber: string;
  industry: string;
  city?: string;
  password_hash: string;
}): Promise<{ account_id: number; user_id: number }> {
  return await db.transaction(async () => {
    const info = await db
      .prepare(
        `INSERT INTO account (business_name, contact_name, email, mobile, viber, industry, city)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.business_name,
        data.contact_name,
        data.email,
        data.mobile,
        data.viber || "",
        data.industry || null,
        data.city?.trim() || ""
      );
    const account_id = Number(info.lastInsertRowid);
    const u = await db
      .prepare(
        `INSERT INTO user (account_id, email, password_hash, role)
         VALUES (?, ?, ?, 'client')`
      )
      .run(account_id, data.email, data.password_hash);
    await db.prepare(
      "INSERT INTO subscription (account_id, status) VALUES (?, 'draft')"
    ).run(account_id);
    return { account_id, user_id: Number(u.lastInsertRowid) };
  });
}

export async function createEmailVerification(accountId: number): Promise<string> {
  const token =
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const expires = addDays(todayStr(), 7);
  await db.prepare(
    "INSERT INTO email_verify (account_id, token, expires_at) VALUES (?, ?, ?)"
  ).run(accountId, token, expires);
  return token;
}

export async function verifyEmail(token: string): Promise<{ ok: boolean; message?: string }> {
  const row = await db
    .prepare(
      "SELECT * FROM email_verify WHERE token = ? AND used = 0 AND expires_at >= ?"
    )
    .get(token, todayStr()) as
    | { id: number; account_id: number }
    | undefined;
  if (!row)
    return { ok: false, message: "Link is invalid or has expired." };
  await db.transaction(async () => {
    await db.prepare("UPDATE email_verify SET used = 1 WHERE id = ?").run(row.id);
    await db.prepare(
      "UPDATE user SET email_verified = 1 WHERE account_id = ?"
    ).run(row.account_id);
  });
  return { ok: true };
}

/* ============================= Brand profile ============================= */

export async function getBrandProfile(accountId: number): Promise<BrandProfileRow | null> {
  const row = await db
    .prepare("SELECT * FROM brand_profile WHERE account_id = ?")
    .get(accountId) as BrandProfileRow | undefined;
  return row ?? null;
}

export async function upsertBrandProfile(
  accountId: number,
  data: {
    logo_urls: string;
    colors: string;
    fonts: string;
    tone: string;
    links: string;
    avoid_notes: string;
  }
) {
  const existing = await db
    .prepare("SELECT id FROM brand_profile WHERE account_id = ?")
    .get(accountId);
  const values = [
    data.colors,
    data.fonts,
    data.tone,
    data.links,
    data.avoid_notes,
    data.logo_urls,
  ];
  if (existing) {
    await db.prepare(
      `UPDATE brand_profile SET colors=?, fonts=?, tone=?, links=?, avoid_notes=?, logo_urls=?, updated_at=datetime('now')
       WHERE account_id = ?`
    ).run(...values, accountId);
  } else {
    await db.prepare(
      `INSERT INTO brand_profile (account_id, logo_urls, colors, fonts, tone, links, avoid_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(accountId, ...values);
  }
}

/* ============================= Subscription / payments ============================= */

export async function getSubscription(accountId: number) {
  return await db
    .prepare("SELECT * FROM subscription WHERE account_id = ?")
    .get(accountId);
}

export async function setSubscriptionPlan(
  accountId: number,
  planId: number,
  addonIds: number[]
) {
  await db.transaction(async () => {
    await db.prepare("UPDATE subscription SET plan_id = ? WHERE account_id = ?").run(
      planId,
      accountId
    );
    const sub = await getSubscription(accountId) as { id: number };
    await db.prepare("DELETE FROM subscription_addon WHERE subscription_id = ?").run(
      sub.id
    );
    const ins = await db.prepare(
      "INSERT INTO subscription_addon (subscription_id, addon_id) VALUES (?, ?)"
    );
    for (const id of addonIds) ins.run(sub.id, id);
  });
}

export async function createPayment(data: {
  account_id: number;
  amount_php: number;
  method: string;
  reference_no: string | null;
  proof_url: string | null;
}) {
  const info = await db
    .prepare(
      `INSERT INTO payment (account_id, amount_php, method, reference_no, proof_url, status)
       VALUES (@account_id, @amount_php, @method, @reference_no, @proof_url, 'pending')`
    )
    .run(data);
  return Number(info.lastInsertRowid);
}

export async function getPaymentsForAccount(accountId: number): Promise<PaymentRow[]> {
  return await db
    .prepare("SELECT * FROM payment WHERE account_id = ? ORDER BY created_at DESC")
    .all(accountId) as PaymentRow[];
}

export async function getPayment(id: number): Promise<PaymentRow | undefined> {
  return await db.prepare("SELECT * FROM payment WHERE id = ?").get(id) as
    | PaymentRow
    | undefined;
}

export async function verifyPayment(
  paymentId: number,
  actorId: number,
  daysGranted?: number
) {
  const payment = await getPayment(paymentId);
  if (!payment || payment.status !== "pending")
    throw new Error("Payment not pending");
  const granted = daysGranted ?? 30;
  await db.transaction(async () => {
    await db.prepare(
      `UPDATE payment SET status='approved', verified_by=?, verified_at=datetime('now'), days_granted=?
       WHERE id=?`
    ).run(actorId, granted, paymentId);
    const sub = await db
      .prepare("SELECT * FROM subscription WHERE account_id = ?")
      .get(payment.account_id) as {
      id: number;
      plan_id: number | null;
      next_plan_id: number | null;
      status: string;
      days_remaining: number;
      started_at: string;
    };
    // Package changes take effect at next renewal (open decision #7).
    const newPlan = sub.next_plan_id ?? sub.plan_id;
    await db.prepare(
      `UPDATE subscription SET
         plan_id = ?,
         next_plan_id = NULL,
         status = CASE WHEN days_remaining + ? <= 5 THEN 'expiring_soon' ELSE 'active' END,
         days_remaining = days_remaining + ?,
         last_ticked_on = ?,
         expired_at = NULL,
         grace_until = NULL,
         paused_at = NULL
       WHERE id = ?`
    ).run(newPlan, granted, granted, todayStr(), sub.id);
    const account = await getAccount(payment.account_id);
    const plan = newPlan ? await getPlan(newPlan) : null;
    if (account)
      await notify({
        kind: "payment_approved",
        to: account.email,
        toName: account.contact_name,
        subject: "Payment approved — your subscription is active",
        html: `Your payment of <strong>${peso(payment.amount_php)}</strong> has been approved.
          ${granted} days were added to your subscription${
            plan ? ` (${plan.name})` : ""
          }. You can now submit requests from your board. <br/><br/>
          <a href="${await clientLink("/board")}">Open your board</a>`,
        relatedType: "payment",
        relatedId: paymentId,
      });
  });
  return payment;
}

export async function rejectPayment(
  paymentId: number,
  actorId: number,
  reason: string
) {
  const payment = await getPayment(paymentId);
  if (!payment || payment.status !== "pending")
    throw new Error("Payment not pending");
  await db.transaction(async () => {
    await db.prepare(
      `UPDATE payment SET status='rejected', verified_by=?, verified_at=datetime('now'), rejection_reason=?
       WHERE id=?`
    ).run(actorId, reason, paymentId);
    const sub = await db
      .prepare("SELECT status FROM subscription WHERE account_id = ?")
      .get(payment.account_id) as { status: string };
    if (sub.status === "pending_payment") {
      await db.prepare(
        "UPDATE subscription SET status = 'rejected' WHERE account_id = ?"
      ).run(payment.account_id);
    }
    const account = await getAccount(payment.account_id);
    if (account)
      await notify({
        kind: "payment_rejected",
        to: account.email,
        toName: account.contact_name,
        subject: "Payment proof needs attention",
        html: `We couldn't verify your payment of <strong>${peso(
          payment.amount_php
        )}</strong>. <br/>
          Reason: <em>${reason}</em>.<br/><br/>
          Please re-upload your proof of payment or get in touch.`,
        relatedType: "payment",
        relatedId: paymentId,
      });
  });
}

export async function subscriptionAction(
  accountId: number,
  action: string,
  payload: Record<string, unknown>,
  actorId: number
) {
  const sub = await getSubscription(accountId) as {
    id: number;
    status: string;
    days_remaining: number;
    plan_id: number | null;
  };
  if (!sub) throw new Error("No subscription");

  switch (action) {
    case "pause": {
      if (sub.status !== "active" && sub.status !== "expiring_soon")
        throw new Error("Subscription is not active");
      await db.prepare(
        "UPDATE subscription SET status='paused', paused_at=datetime('now') WHERE id=?"
      ).run(sub.id);
      const account = await getAccount(accountId);
      if (account)
        await notify({
          kind: "subscription_paused",
          to: account.email,
          toName: account.contact_name,
          subject: "Your subscription is paused",
          html: `Your subscription is paused with <strong>${sub.days_remaining} days</strong> remaining.
            Your remaining days are frozen — they don't expire while paused.`,
          relatedType: "subscription",
          relatedId: sub.id,
        });
      break;
    }
    case "resume": {
      if (sub.status !== "paused") throw new Error("Subscription is not paused");
      await db.prepare(
        `UPDATE subscription SET status = CASE WHEN days_remaining <= 5 THEN 'expiring_soon' ELSE 'active' END,
         paused_at = NULL, last_ticked_on = ? WHERE id = ?`
      ).run(todayStr(), sub.id);
      break;
    }
    case "add_days": {
      const n = Math.max(1, Math.round(Number(payload.days) || 0));
      await db.prepare(
        `UPDATE subscription SET days_remaining = days_remaining + ?,
           status = CASE
             WHEN status = 'expired' THEN (CASE WHEN days_remaining + ? <= 5 THEN 'expiring_soon' ELSE 'active' END)
             WHEN status = 'rejected' THEN 'active'
             ELSE status END,
           expired_at = NULL,
           grace_until = NULL,
           paused_at = NULL,
           last_ticked_on = CASE WHEN status IN ('active','expiring_soon') THEN last_ticked_on ELSE ? END
         WHERE id = ?`
      ).run(n, n, todayStr(), sub.id);
      break;
    }
    case "change_plan": {
      const planId = Number(payload.plan_id);
      if (!await getPlan(planId)) throw new Error("Unknown plan");
      await db.prepare(
        "UPDATE subscription SET next_plan_id = ? WHERE id = ?"
      ).run(planId, sub.id);
      break;
    }
    case "apply_plan_now": {
      const planId = Number(payload.plan_id);
      if (!await getPlan(planId)) throw new Error("Unknown plan");
      await db.prepare(
        "UPDATE subscription SET plan_id = ?, next_plan_id = NULL WHERE id = ?"
      ).run(planId, sub.id);
      break;
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/* ============================= Requests ============================= */

export interface RequestWithMeta extends RequestRow {
  type_name: string;
  type_slug: string;
  slot_consuming: number;
  sla_hours: number;
  phase_name: string | null;
  latest_deliverable: string | null;
  latest_deliverable_at: string | null;
  comment_count: number;
}

function requestSelect(
  accountId?: number
): { sql: string; params: (string | number)[] } {
  let sql = `
    SELECT r.*, t.name AS type_name, t.slug AS type_slug, t.slot_consuming, t.sla_hours,
      ph.name AS phase_name,
      (SELECT file_url FROM deliverable d WHERE d.request_id = r.id ORDER BY version DESC LIMIT 1) AS latest_deliverable,
      (SELECT uploaded_at FROM deliverable d WHERE d.request_id = r.id ORDER BY version DESC LIMIT 1) AS latest_deliverable_at,
      (SELECT COUNT(*) FROM comment c WHERE c.request_id = r.id AND c.internal_only = 0) AS comment_count
    FROM request r
    JOIN request_type t ON t.id = r.request_type_id
    LEFT JOIN phase ph ON ph.id = r.phase_id
  `;
  const params: (string | number)[] = [];
  if (accountId !== undefined) {
    sql += " WHERE r.account_id = ?";
    params.push(accountId);
  }
  sql += " ORDER BY r.created_at";
  return { sql, params };
}

export async function listRequests(accountId: number): Promise<RequestWithMeta[]> {
  const { sql, params } = requestSelect(accountId);
  return await db.prepare(sql).all(...params) as RequestWithMeta[];
}

export async function getRequest(requestId: number, accountId?: number | null) {
  const row = await db
    .prepare(
      `SELECT r.*, t.name AS type_name, t.slug AS type_slug, t.slot_consuming, t.sla_hours,
        t.brief_schema, a.business_name, a.contact_name, a.email, a.mobile AS account_mobile,
        a.viber AS account_viber
       FROM request r
       JOIN request_type t ON t.id = r.request_type_id
       LEFT JOIN account a ON a.id = r.account_id
       WHERE r.id = ?`
    )
    .get(requestId) as
    | (RequestRow & {
        type_name: string;
        type_slug: string;
        slot_consuming: number;
        sla_hours: number;
        brief_schema: string;
        business_name: string | null;
        contact_name: string | null;
        email: string | null;
        account_mobile: string | null;
        account_viber: string | null;
      })
    | undefined;
  if (!row) return undefined;
  if (accountId != null && row.account_id !== accountId) return undefined;
  const deliverables = await db
    .prepare(
      "SELECT * FROM deliverable WHERE request_id = ? ORDER BY version ASC"
    )
    .all(requestId) as RequestRow["id"][];
  const comments = await db
    .prepare(
      `SELECT c.*, u.email AS author_email, u.role AS author_role, u.account_id AS author_account_id
       FROM comment c JOIN user u ON u.id = c.author_id
       WHERE c.request_id = ? ORDER BY c.created_at ASC`
    )
    .all(requestId) as Array<
    Record<string, unknown> & { internal_only: number }
  >;
  const attachments = await db
    .prepare("SELECT * FROM attachment WHERE request_id = ? ORDER BY created_at")
    .all(requestId) as RequestRow["id"][];
  return {
    ...row,
    business_name: row.business_name ?? row.other_client_name ?? "Other",
    brief_schema_parsed: JSON.parse(row.brief_schema),
    brief_answers_parsed: JSON.parse(row.brief_answers),
    deliverables,
    comments,
    attachments,
  };
}

export async function createRequest(
  accountId: number,
  userId: number,
  data: {
    request_type_id: number;
    title: string;
    brief_answers: Record<string, unknown>;
    attachmentUrls: string[];
    phase_id?: number | null;
  }
) {
  const info = await db.transaction(async () => {
    const posRow = await db
      .prepare(
        "SELECT COALESCE(MAX(position), 0) + 1 AS p FROM request WHERE account_id = ? AND column = 'lineup'"
      )
      .get(accountId) as { p: number };
    const r = await db
      .prepare(
        `INSERT INTO request (account_id, request_type_id, title, brief_answers, column, position, phase_id)
         VALUES (?, ?, ?, ?, 'lineup', ?, ?)`
      )
      .run(
        accountId,
        data.request_type_id,
        data.title,
        JSON.stringify(data.brief_answers),
        posRow.p,
        data.phase_id ?? null
      );
    const requestId = Number(r.lastInsertRowid);
    const ins = await db.prepare(
      "INSERT INTO attachment (request_id, file_url, uploaded_by, kind) VALUES (?, ?, ?, 'reference')"
    );
    for (const url of data.attachmentUrls) ins.run(requestId, url, userId);
    return requestId;
  });
  const account = await getAccount(accountId);
  await notifyAdmin({
    kind: "new_request",
    subject: `New request: ${data.title}`,
    html: `<strong>${account?.business_name}</strong> submitted a new request: <strong>${data.title}</strong>.<br/>
      <a href="${await clientLink("/admin/board")}">Open admin board</a>`,
    relatedType: "request",
    relatedId: info,
  });
  return info;
}

export async function reorderLineup(accountId: number, orderedIds: number[]) {
  await db.transaction(async () => {
    for (const [idx, id] of orderedIds.entries()) {
      await db.prepare(
        "UPDATE request SET position = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ? AND column = 'lineup'"
      ).run(idx + 1, id, accountId);
    }
  });
}

export async function createManualRequest(data: {
  account_id: number | null;
  other_client_name?: string;
  other_client_email?: string;
  other_client_mobile?: string;
  other_client_viber?: string;
  request_type_id: number;
  title: string;
  brief_answers: Record<string, unknown>;
  target_completed_at?: string | null;
  phase_id?: number | null;
}) {
  const accountId = data.account_id;
  const posRow = accountId != null
    ? (await db
        .prepare(
          "SELECT COALESCE(MAX(position), 0) + 1 AS p FROM request WHERE account_id = ? AND column = 'lineup'"
        )
        .get(accountId) as { p: number })
    : { p: 1 };
  const info = await db
    .prepare(
      `INSERT INTO request (account_id, request_type_id, title, brief_answers, column, position,
         target_completed_at, phase_id, other_client_name, other_client_email, other_client_mobile, other_client_viber)
       VALUES (?, ?, ?, ?, 'lineup', ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      accountId,
      data.request_type_id,
      data.title,
      JSON.stringify(data.brief_answers),
      posRow.p,
      data.target_completed_at ?? null,
      data.phase_id ?? null,
      accountId == null ? data.other_client_name ?? null : null,
      accountId == null ? data.other_client_email ?? null : null,
      accountId == null ? data.other_client_mobile ?? null : null,
      accountId == null ? data.other_client_viber ?? null : null
    );
  const requestId = Number(info.lastInsertRowid);
  if (accountId != null) {
    const account = await getAccount(accountId);
    await notify({
      kind: "new_request",
      to: account?.email ?? "",
      toName: account?.contact_name ?? "",
      subject: "New project on your PodiumSet board",
      html: `A project was added to your queue: <strong>${data.title}</strong>.`,
      relatedType: "request",
      relatedId: requestId,
    });
  }
  return requestId;
}

export async function setTargetDate(requestId: number, targetDate: string) {
  const req = await db
    .prepare("SELECT * FROM request WHERE id = ?")
    .get(requestId) as RequestRow | undefined;
  if (!req) throw new Error("Request not found");
  await db.prepare(
    "UPDATE request SET target_completed_at = ?, due_at = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(targetDate, targetDate, requestId);
  return req;
}

export async function listPhases(accountId: number): Promise<PhaseRow[]> {
  return await db
    .prepare(
      "SELECT * FROM phase WHERE account_id = ? ORDER BY position ASC, id ASC"
    )
    .all(accountId) as PhaseRow[];
}

export async function createPhase(accountId: number, name: string): Promise<number> {
  const pRow = await db
    .prepare("SELECT COALESCE(MAX(position), 0) + 1 AS p FROM phase WHERE account_id = ?")
    .get(accountId) as { p: number };
  const info = await db
    .prepare("INSERT INTO phase (account_id, name, position) VALUES (?, ?, ?)")
    .run(accountId, name, pRow.p);
  return Number(info.lastInsertRowid);
}

export async function renamePhase(phaseId: number, name: string) {
  const res = await db
    .prepare("UPDATE phase SET name = ? WHERE id = ?")
    .run(name, phaseId);
  if (res.changes === 0) throw new Error("Phase not found");
}

export async function deletePhase(phaseId: number) {
  const phase = await db.prepare("SELECT * FROM phase WHERE id = ?").get(phaseId) as
    | PhaseRow
    | undefined;
  if (!phase) throw new Error("Phase not found");
  await db.transaction(async () => {
    await db.prepare("UPDATE request SET phase_id = NULL, updated_at = datetime('now') WHERE phase_id = ?").run(
      phaseId
    );
    await db.prepare("DELETE FROM phase WHERE id = ?").run(phaseId);
  });
}

// Persist the full per-client board: phase order, phase names, and request
// membership/order. `phases` is the dashboard's phase display order; each entry
// carries the ordered request ids it contains. Requests for this client not
// listed under any phase are cleared to unassigned. Admin-only tool, so a
// full-state save is acceptable.
export async function saveClientBoard(
  accountId: number,
  phases: Array<{ id: number; name?: string; request_ids: number[] }>
) {
  await db.transaction(async () => {
    const ownPhases = new Set(
      (await listPhases(accountId) as PhaseRow[]).map((p) => p.id)
    );
    const ownReqs = new Set(
      (await listRequests(accountId) as RequestRow[]).map((r) => r.id)
    );
    for (const [pi, ph] of phases.entries()) {
      if (!ownPhases.has(ph.id)) throw new Error("Phase not found");
      await db.prepare("UPDATE phase SET position = ? WHERE id = ?").run(pi + 1, ph.id);
      if (ph.name != null && ph.name.trim()) {
        await db.prepare("UPDATE phase SET name = ? WHERE id = ?").run(
          ph.name.trim(),
          ph.id
        );
      }
      for (const [ri, rid] of ph.request_ids.entries()) {
        if (!ownReqs.has(rid)) throw new Error("Request not found");
        await db.prepare(
          "UPDATE request SET phase_id = ?, position = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(ph.id, ri + 1, rid);
      }
    }
    const covered = new Set(phases.flatMap((ph) => ph.request_ids));
    const unassigned = (await listRequests(accountId) as RequestRow[]).filter(
      (r) => !covered.has(r.id)
    );
    for (const r of unassigned) {
      await db.prepare(
        "UPDATE request SET phase_id = NULL, position = 0, updated_at = datetime('now') WHERE id = ?"
      ).run(r.id);
    }
  });
}

/** Full per-client kanban save: column → ordered request ids. Admin-only. */
export async function saveClientKanban(
  accountId: number,
  columns: Record<string, number[]>
) {
  const valid = ["lineup", "ongoing", "for_approval", "done"];
  const ownReqs = new Set(
    (await listRequests(accountId) as RequestRow[]).map((r) => r.id)
  );
  await db.transaction(async () => {
    for (const col of valid) {
      const ids = columns[col] ?? [];
      for (const [ri, rid] of ids.entries()) {
        if (!ownReqs.has(rid)) throw new Error("Request not found");
        await db.prepare(
          "UPDATE request SET column = ?, position = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(col, ri + 1, rid);
      }
    }
  });
}

/** Kanban data for one client: requests with subtask counts. */
export async function getKanbanRequests(accountId: number) {
  return await db
    .prepare(
      `SELECT r.id, r.title, r.column, r.position, r.target_completed_at, r.due_at,
        r.phase_id, t.name AS type_name, ph.name AS phase_name,
        (SELECT COUNT(*) FROM subtask s WHERE s.request_id = r.id) AS subtask_total,
        (SELECT COUNT(*) FROM subtask s WHERE s.request_id = r.id AND s.done = 1) AS subtask_done
       FROM request r
       JOIN request_type t ON t.id = r.request_type_id
       LEFT JOIN phase ph ON ph.id = r.phase_id
       WHERE r.account_id = ?
       ORDER BY r.column, r.position`
    )
    .all(accountId) as Array<{
    id: number;
    title: string;
    column: string;
    target_completed_at: string | null;
    due_at: string | null;
    phase_id: number | null;
    type_name: string;
    phase_name: string | null;
    subtask_total: number;
    subtask_done: number;
  }>;
}

export async function listSubtasks(requestId: number) {
  return await db
    .prepare(
      "SELECT * FROM subtask WHERE request_id = ? ORDER BY position ASC, id ASC"
    )
    .all(requestId) as Array<{
    id: number;
    request_id: number;
    title: string;
    done: number;
    position: number;
    created_at: string;
  }>;
}

export async function createSubtask(requestId: number, title: string): Promise<number> {
  const pRow = await db
    .prepare(
      "SELECT COALESCE(MAX(position), 0) + 1 AS p FROM subtask WHERE request_id = ?"
    )
    .get(requestId) as { p: number };
  const info = await db
    .prepare("INSERT INTO subtask (request_id, title, position) VALUES (?, ?, ?)")
    .run(requestId, title, pRow.p);
  return Number(info.lastInsertRowid);
}

export async function updateSubtask(
  subtaskId: number,
  data: { title?: string; done?: boolean }
) {
  const existing = await db
    .prepare("SELECT * FROM subtask WHERE id = ?")
    .get(subtaskId) as { title: string; done: number } | undefined;
  if (!existing) throw new Error("Subtask not found");
  const title =
    data.title != null && data.title.trim() ? data.title.trim() : existing.title;
  const done = data.done != null ? (data.done ? 1 : 0) : existing.done;
  const res = await db
    .prepare("UPDATE subtask SET title = ?, done = ? WHERE id = ?")
    .run(title, done, subtaskId);
  if (res.changes === 0) throw new Error("Subtask not found");
}

export async function deleteSubtask(subtaskId: number) {
  await db.prepare("DELETE FROM subtask WHERE id = ?").run(subtaskId);
}

export async function deleteRequest(requestId: number) {
  const req = await db
    .prepare("SELECT * FROM request WHERE id = ?")
    .get(requestId) as RequestRow | undefined;
  if (!req) throw new Error("Request not found");
  const files = new Set<string>();
  const delivers = await db
    .prepare("SELECT file_url FROM deliverable WHERE request_id = ?")
    .all(requestId) as Array<{ file_url: string }>;
  const attachs = await db
    .prepare("SELECT file_url FROM attachment WHERE request_id = ?")
    .all(requestId) as Array<{ file_url: string }>;
  for (const d of delivers) if (d.file_url) files.add(d.file_url);
  for (const a of attachs) if (a.file_url) files.add(a.file_url);
  await db.transaction(async () => {
    await db.prepare("DELETE FROM comment WHERE request_id = ?").run(requestId);
    await db.prepare("DELETE FROM deliverable WHERE request_id = ?").run(requestId);
    await db.prepare("DELETE FROM attachment WHERE request_id = ?").run(requestId);
    await db.prepare("DELETE FROM subtask WHERE request_id = ?").run(requestId);
    await db.prepare("DELETE FROM request WHERE id = ?").run(requestId);
  });
  for (const url of files) {
    if (isDriveUrl(url)) {
      const fileId = decodeURIComponent(url.slice("/drive/".length));
      await deleteDriveFile(fileId).catch(() => {});
      continue;
    }
    try {
      const abs = path.join(
        process.cwd(),
        "public",
        url.replace(/^\//, "")
      );
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch {
      /* ignore unlink errors */
    }
  }
  return req;
}

export async function promoteToOngoing(
  requestId: number,
  opts: {
    actorId: number;
    accountId?: number | null;
    targetDate?: string;
    bypassSlots?: boolean;
  }
) {
  const req = await db
    .prepare("SELECT * FROM request WHERE id = ?")
    .get(requestId) as RequestRow | undefined;
  if (!req) throw new Error("Request not found");
  if (opts.accountId != null && req.account_id !== opts.accountId)
    throw new Error("Request not found");
  if (req.column !== "lineup")
    throw new Error("Only Project Lineup cards can be promoted");

  if (!opts.bypassSlots && req.account_id != null) {
    const sub = await getSubscription(req.account_id) as {
      plan_id: number | null;
      status: string;
    };
    const plan = sub.plan_id ? await getPlan(sub.plan_id) : null;
    const requests = await listRequests(req.account_id);
    if (!plan || !canPromoteToOngoing(plan.active_slots, requests))
      throw new Error(
        `All slots are full (${slotsInUse(requests)} of ${plan?.active_slots} in use).`
      );
  }
  const existingTarget = req.target_completed_at
    ? new Date(req.target_completed_at).toISOString()
    : null;
  const target =
    opts.targetDate ??
    existingTarget ??
    addWorkingDays(new Date(), 2).toISOString();
  await db.prepare(
    `UPDATE request SET column='ongoing', internal_status='in_progress', position=0,
       due_at=?, target_completed_at=?, approval_since=NULL, updated_at=datetime('now')
     WHERE id=?`
  ).run(target, target, requestId);
  return req;
}

export async function moveToForApproval(
  accountId: number | null,
  requestId: number,
  opts: { deliverableUrl: string; actorId: number; note?: string }
) {
  const req = await db
    .prepare("SELECT * FROM request WHERE id = ?")
    .get(requestId) as RequestRow | undefined;
  if (!req) throw new Error("Request not found");
  if (accountId != null && req.account_id !== accountId)
    throw new Error("Request not found");
  if (req.column !== "ongoing") throw new Error("Only Ongoing cards can move to For Approval");
  await db.transaction(async () => {
    const vRow = await db
      .prepare("SELECT COALESCE(MAX(version), 0) + 1 AS v FROM deliverable WHERE request_id = ?")
      .get(requestId) as { v: number };
    await db.prepare(
      "INSERT INTO deliverable (request_id, version, file_url, approval_state) VALUES (?, ?, ?, 'pending')"
    ).run(requestId, vRow.v, opts.deliverableUrl);
    await db.prepare(
      `UPDATE request SET column='for_approval', internal_status=NULL, due_at=NULL, approval_since=?, updated_at=datetime('now')
       WHERE id=?`
    ).run(todayStr(), requestId);
    if (opts.note) {
      await db.prepare(
        "INSERT INTO comment (request_id, author_id, body, internal_only) VALUES (?, ?, ?, 1)"
      ).run(requestId, opts.actorId, `Deliverable v${vRow.v} uploaded: ${opts.note}`);
    }
  });
  let to = "";
  let toName = "";
  if (req.account_id != null) {
    const account = await getAccount(req.account_id);
    if (account) {
      to = account.email;
      toName = account.contact_name;
    }
  } else {
    to = req.other_client_email ?? "";
    toName = req.other_client_name ?? "";
  }
  if (to)
    await notify({
      kind: "deliverable_ready",
      to,
      toName,
      subject: `"${req.title}" is ready for review`,
      html: `A new deliverable is waiting for your review.<br/>
        <a href="${await clientLink("/board")}">Review it on your board</a><br/><br/>
        <span style="font-size:13px;color:#9a978e">
          Items move to Done automatically after 3 business days without a response.</span>`,
      relatedType: "request",
      relatedId: requestId,
    });
}

export async function approveRequest(
  accountId: number,
  requestId: number,
  opts: { actorId: number; auto?: boolean; note?: string }
) {
  const req = await db
    .prepare("SELECT * FROM request WHERE id = ? AND account_id = ?")
    .get(requestId, accountId) as RequestRow | undefined;
  if (!req) throw new Error("Request not found");
  if (req.column !== "for_approval") throw new Error("Not awaiting approval");

  await db.transaction(async () => {
    await db.prepare(
      `UPDATE request SET column='done', internal_status=NULL, auto_approved=?, approval_since=NULL, due_at=NULL, updated_at=datetime('now')
       WHERE id=? AND account_id=?`
    ).run(opts.auto ? 1 : 0, requestId, accountId);
    await db.prepare(
      `INSERT INTO comment (request_id, author_id, body, internal_only) VALUES (?, ?, ?, 0)`
    ).run(
      requestId,
      opts.actorId,
      opts.auto ? "Auto-approved after 3 business days with no response." : (opts.note ?? "Approved.")
    );
  });

  return req;
}

export async function requestRevision(
  accountId: number,
  requestId: number,
  opts: { actorId: number; note: string; isClient: boolean }
) {
  const req = await db
    .prepare("SELECT * FROM request WHERE id = ? AND account_id = ?")
    .get(requestId, accountId) as RequestRow | undefined;
  if (!req) throw new Error("Request not found");
  if (req.column !== "for_approval")
    throw new Error("Only For Approval cards can be revised");
  const rt = await getRequestType(req.request_type_id);
  const due = rt
    ? new Date(Date.now() + rt.sla_hours * 3600000).toISOString()
    : null;
  await db.transaction(async () => {
    await db.prepare(
      `UPDATE request SET column='ongoing', internal_status='in_progress', revision_count = revision_count + 1,
         approval_since=NULL, due_at=?, updated_at=datetime('now')
       WHERE id=? AND account_id=?`
    ).run(due, requestId, accountId);
    await db.prepare(
      "INSERT INTO comment (request_id, author_id, body, internal_only) VALUES (?, ?, ?, 0)"
    ).run(requestId, opts.actorId, `Revision requested (rev ${req.revision_count + 1}): ${opts.note}`);
  });
  if (opts.isClient) {
    const account = await getAccount(accountId);
    await notifyAdmin({
      kind: "revision_requested",
      subject: `Revision ${req.revision_count + 1} on "${req.title}"`,
      html: `<strong>${account?.business_name}</strong> requested revision ${req.revision_count + 1} on <strong>${req.title}</strong>.<br/>
        <em>${opts.note}</em>`,
      relatedType: "request",
      relatedId: requestId,
    });
  }
  return req;
}

export async function addComment(
  accountId: number,
  requestId: number,
  authorId: number,
  body: string,
  internalOnly: boolean,
  callerRole: string
) {
  if (callerRole !== "admin" && internalOnly)
    throw new Error("Clients cannot post internal notes");
  const req =
    callerRole === "admin"
      ? (await db
          .prepare("SELECT * FROM request WHERE id = ?")
          .get(requestId) as RequestRow | undefined)
      : (await db
          .prepare("SELECT * FROM request WHERE id = ? AND account_id = ?")
          .get(requestId, accountId) as RequestRow | undefined);
  if (!req) throw new Error("Request not found");
  await db.prepare(
    "INSERT INTO comment (request_id, author_id, body, internal_only) VALUES (?, ?, ?, ?)"
  ).run(requestId, authorId, body, internalOnly ? 1 : 0);
  return req;
}

export async function addAttachment(
  accountId: number,
  requestId: number,
  fileUrl: string,
  uploadedBy: number
) {
  const req = await db
    .prepare("SELECT * FROM request WHERE id = ? AND account_id = ?")
    .get(requestId, accountId) as RequestRow | undefined;
  if (!req) throw new Error("Request not found");
  await db.prepare(
    "INSERT INTO attachment (request_id, file_url, uploaded_by, kind) VALUES (?, ?, ?, 'reference')"
  ).run(requestId, fileUrl, uploadedBy);
}

export async function setInternalStatus(
  requestId: number,
  status: InternalStatus | null
) {
  const req = await db
    .prepare("SELECT * FROM request WHERE id = ?")
    .get(requestId) as RequestRow | undefined;
  if (!req) throw new Error("Request not found");
  await db.prepare(
    "UPDATE request SET internal_status = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(status, requestId);
}

export async function listClientAccounts(): Promise<
  Array<{
    id: number;
    business_name: string;
    contact_name: string;
  }>
> {
  return await db
    .prepare(
      "SELECT id, business_name, contact_name FROM account ORDER BY LOWER(business_name)"
    )
    .all() as Array<{
    id: number;
    business_name: string;
    contact_name: string;
  }>;
}

/* ============================= Admin views ============================= */

export interface AccountSummary {
  account: AccountRow;
  subscription: {
    id: number;
    status: string;
    days_remaining: number;
    last_ticked_on: string | null;
    plan_name: string | null;
    plan_price_php: number | null;
    next_plan_name: string | null;
    started_at: string;
  };
  pending_payments: number;
  active_requests: number;
  unfinished_requests: number;
  last_payment_at: string | null;
}

export async function getAccountSummaries(): Promise<AccountSummary[]> {
  const rows = await db
    .prepare(
      `SELECT a.*, s.id AS sub_id, s.status AS sub_status, s.days_remaining, s.last_ticked_on,
        s.started_at AS sub_started_at, s.next_plan_id,
        p.name AS plan_name, p.price_php AS plan_price_php,
        np.name AS next_plan_name,
        (SELECT COUNT(*) FROM payment pp WHERE pp.account_id = a.id AND pp.status='pending') AS pending_payments,
        (SELECT COUNT(*) FROM request rr WHERE rr.account_id = a.id AND rr.column IN ('ongoing','for_approval')) AS active_requests,
        (SELECT COUNT(*) FROM request rr WHERE rr.account_id = a.id AND rr.column != 'done') AS unfinished_requests,
        (SELECT MAX(created_at) FROM payment pp WHERE pp.account_id = a.id AND pp.status='approved') AS last_payment_at
       FROM account a
       JOIN subscription s ON s.account_id = a.id
       LEFT JOIN plan p ON p.id = s.plan_id
       LEFT JOIN plan np ON np.id = s.next_plan_id
       WHERE NOT EXISTS (SELECT 1 FROM user u WHERE u.account_id = a.id AND u.role='admin')
       ORDER BY CASE s.status WHEN 'pending_payment' THEN 0 WHEN 'expiring_soon' THEN 1 WHEN 'active' THEN 2 ELSE 3 END, a.created_at`
    )
    .all() as Array<
    AccountRow & {
      sub_id: number;
      sub_status: string;
      days_remaining: number;
      last_ticked_on: string | null;
      sub_started_at: string;
      next_plan_id: number | null;
      plan_name: string | null;
      plan_price_php: number | null;
      next_plan_name: string | null;
      pending_payments: number;
      active_requests: number;
      unfinished_requests: number;
      last_payment_at: string | null;
    }
  >;
  return rows.map((r) => {
    const { sub_id, sub_status, sub_started_at, next_plan_id, ...rest } = r;
    return {
      account: {
        id: r.id,
        business_name: r.business_name,
        contact_name: r.contact_name,
        email: r.email,
        mobile: r.mobile,
        viber: r.viber,
        city: r.city,
        drive_folder_id: r.drive_folder_id,
        industry: r.industry,
        created_at: r.created_at,
      },
      subscription: {
        id: sub_id,
        status: sub_status,
        days_remaining: r.days_remaining,
        last_ticked_on: r.last_ticked_on,
        plan_name: r.plan_name,
        plan_price_php: r.plan_price_php,
        next_plan_name: r.next_plan_name,
        started_at: sub_started_at,
      },
      pending_payments: r.pending_payments,
      active_requests: r.active_requests,
      unfinished_requests: r.unfinished_requests,
      last_payment_at: r.last_payment_at,
    };
  });
}

export async function getPendingPayments(): Promise<
  Array<PaymentRow & { business_name: string }>
> {
  return await db
    .prepare(
      `SELECT p.*, a.business_name FROM payment p
       JOIN account a ON a.id = p.account_id
       WHERE p.status = 'pending' ORDER BY p.created_at ASC`
    )
    .all() as Array<PaymentRow & { business_name: string }>;
}

export interface AdminBoardRow extends RequestWithMeta {
  business_name: string;
  contact_name: string | null;
  account_email: string | null;
  priority_queue: number;
  plan_name: string | null;
  slots: number;
}

export async function getAdminBoard(filters?: {
  account_id?: number;
  request_type_id?: number;
  column?: string;
  overdue?: boolean;
}): Promise<AdminBoardRow[]> {
  let sql = `
    SELECT r.*, t.name AS type_name, t.slug AS type_slug, t.slot_consuming, t.sla_hours,
      ph.name AS phase_name,
      (SELECT file_url FROM deliverable d WHERE d.request_id = r.id ORDER BY version DESC LIMIT 1) AS latest_deliverable,
      (SELECT uploaded_at FROM deliverable d WHERE d.request_id = r.id ORDER BY version DESC LIMIT 1) AS latest_deliverable_at,
      (SELECT COUNT(*) FROM comment c WHERE c.request_id = r.id AND c.internal_only = 0) AS comment_count,
      COALESCE(a.business_name, r.other_client_name, 'Other') AS business_name,
      a.contact_name, a.email AS account_email,
      p.priority_queue, p.name AS plan_name, p.active_slots AS slots
    FROM request r
    JOIN request_type t ON t.id = r.request_type_id
    LEFT JOIN phase ph ON ph.id = r.phase_id
    LEFT JOIN account a ON a.id = r.account_id
    LEFT JOIN subscription s ON s.account_id = a.id
    LEFT JOIN plan p ON p.id = s.plan_id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];
  if (filters?.account_id) {
    sql += " AND r.account_id = ?";
    params.push(filters.account_id);
  }
  if (filters?.request_type_id) {
    sql += " AND r.request_type_id = ?";
    params.push(filters.request_type_id);
  }
  if (filters?.column) {
    sql += " AND r.column = ?";
    params.push(filters.column);
  }
  if (filters?.overdue) {
    sql += " AND r.column = 'ongoing' AND r.target_completed_at < datetime('now')";
  }
  sql +=
    " ORDER BY p.priority_queue DESC, r.created_at ASC, r.position ASC";
  return await db.prepare(sql).all(...params) as AdminBoardRow[];
}

export async function listUnfinishedRequests(accountId: number) {
  return await db
    .prepare(
      `SELECT r.id, r.title, r.column, r.due_at, r.target_completed_at, r.created_at,
         t.name AS type_name, ph.name AS phase_name
       FROM request r
       JOIN request_type t ON t.id = r.request_type_id
       LEFT JOIN phase ph ON ph.id = r.phase_id
       WHERE r.account_id = ? AND r.column != 'done'
       ORDER BY r.created_at DESC`
    )
    .all(accountId) as Array<{
    id: number;
    title: string;
    column: string;
    due_at: string | null;
    target_completed_at: string | null;
    created_at: string;
    type_name: string;
    phase_name: string | null;
  }>;
}

export async function getDashboard() {
  const counts = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM payment WHERE status='pending') AS pending_payments,
        (SELECT COUNT(*) FROM request WHERE column='ongoing') AS ongoing,
        (SELECT COUNT(*) FROM subscription WHERE status='expiring_soon') AS expiring,
        (SELECT COUNT(*) FROM request WHERE column='ongoing' AND due_at < datetime('now')) AS overdue,
        (SELECT COUNT(*) FROM request WHERE column='for_approval') AS for_approval,
        (SELECT COUNT(*) FROM subscription WHERE status='active') AS active_subs,
        (SELECT COUNT(*) FROM subscription WHERE status='pending_payment') AS pending_subs`
    )
    .get() as Record<string, number>;
  return counts;
}

/* ============================= Entitlements ============================= */

export async function getEntitlementUsage(accountId: number, month?: string): Promise<Record<string, number>> {
  const m = month ?? billingMonth();
  const rows = await db
    .prepare(
      "SELECT kind, SUM(amount) AS total FROM entitlement_log WHERE account_id = ? AND billing_month = ? GROUP BY kind"
    )
    .all(accountId, m) as Array<{ kind: string; total: number }>;
  const out: Record<string, number> = {};
  for (const r of rows) out[r.kind] = r.total;
  return out;
}

export async function getEntitlementLogs(accountId: number): Promise<EntitlementLogRow[]> {
  return await db
    .prepare("SELECT * FROM entitlement_log WHERE account_id = ? ORDER BY logged_at DESC")
    .all(accountId) as EntitlementLogRow[];
}

export async function logEntitlement(data: {
  account_id: number;
  kind: string;
  amount: number;
  note: string;
  month?: string;
}) {
  await db.prepare(
    "INSERT INTO entitlement_log (account_id, kind, amount, note, billing_month) VALUES (?, ?, ?, ?, ?)"
  ).run(data.account_id, data.kind, data.amount, data.note, data.month ?? billingMonth());
}

/* ============================= Ads management ============================= */

export async function listAdUpdates(subscriptionId: number): Promise<AdsUpdateRow[]> {
  return await db
    .prepare("SELECT * FROM ads_update WHERE subscription_id = ? ORDER BY created_at DESC")
    .all(subscriptionId) as AdsUpdateRow[];
}

export async function addAdUpdate(
  subscriptionId: number,
  month: string,
  summary: string,
  notes: string
) {
  await db.prepare(
    "INSERT INTO ads_update (subscription_id, month, summary, notes) VALUES (?, ?, ?, ?)"
  ).run(subscriptionId, month, summary, notes);
}

/* ============================= Notifications list ============================= */

export async function getRecentNotifications(limit = 30) {
  return await db
    .prepare("SELECT * FROM notification ORDER BY created_at DESC LIMIT ?")
    .all(limit);
}

/* ============================= Daily tick ============================= */

export async function runDailyTick() {
  const today = todayStr();
  const summary = {
    decremented: 0,
    expired: 0,
    expiring_now: 0,
    auto_approved: 0,
    reminders: 0,
    paused_ads_tasks: 0,
  };

  // 1) Days-remaining decrement for active / expiring_soon subscriptions.
  const subs = await db
    .prepare(
      "SELECT * FROM subscription WHERE status IN ('active','expiring_soon')"
    )
    .all() as Array<{
    id: number;
    account_id: number;
    status: string;
    days_remaining: number;
    last_ticked_on: string | null;
    plan_id: number | null;
  }>;

  for (const sub of subs) {
    const lastTick = sub.last_ticked_on ?? sub.last_ticked_on ?? addDays(today, -1);
    const elapsed = diffDays(lastTick, today);
    if (elapsed <= 0) continue;
    const daysLeft = Math.max(0, sub.days_remaining - elapsed);
    let newStatus = sub.status;
    let graceUntil: string | null = null;
    let expiredAt: string | null = null;

    if (daysLeft === 0) {
      newStatus = "expired";
      expiredAt = today;
      graceUntil = addDays(today, 14);
    } else if (daysLeft <= 5) {
      newStatus = "expiring_soon";
      summary.expiring_now += 1;
    }

    await db.prepare(
      `UPDATE subscription SET days_remaining = ?, status = ?, last_ticked_on = ?,
         expired_at = COALESCE(?, expired_at), grace_until = COALESCE(?, grace_until)
       WHERE id = ?`
    ).run(daysLeft, newStatus, today, expiredAt, graceUntil, sub.id);
    summary.decremented += 1;

    if (newStatus === "expired") {
      summary.expired += 1;
      const account = await getAccount(sub.account_id);
      const plan = sub.plan_id ? await getPlan(sub.plan_id) : null;
      if (account)
        await notify({
          kind: "subscription_expired",
          to: account.email,
          toName: account.contact_name,
          subject: "Your subscription has ended",
          html: `Your subscription has reached 0 days. Your board is now read-only for a 14-day download window.
            <a href="${await clientLink("/board")}">Download your deliverables</a>, or renew anytime.`,
          relatedType: "subscription",
          relatedId: sub.id,
        });
      if (plan?.includes_ads) {
        await notifyAdmin({
          kind: "pause_ads_task",
          subject: `Pause ad campaigns for ${account?.business_name ?? `account #${sub.account_id}`}`,
          html: `Subscription expired. Remember to pause this client's ad campaigns on the ad platforms (manual action).`,
          relatedType: "subscription",
          relatedId: sub.id,
        });
        summary.paused_ads_tasks += 1;
      }
    } else if (newStatus === "expiring_soon" && sub.status !== "expiring_soon") {
      // Just crossed into expiring_soon — 5-day warning.
      const account = await getAccount(sub.account_id);
      if (account)
        await notify({
          kind: "expiring_soon",
          to: account.email,
          toName: account.contact_name,
          subject: "5 days left on your subscription",
          html: `You have <strong>${daysLeft} days</strong> remaining. Renew now to keep your queue running.
            <a href="${await clientLink("/board")}">Go to your board</a>`,
          relatedType: "subscription",
          relatedId: sub.id,
        });
    }
  }

  // 2) Auto-approve pass: reminders on business day 1 & 2, auto-approve on day 3.
  const approvalCards = await db
    .prepare("SELECT * FROM request WHERE column = 'for_approval'")
    .all() as Array<{
    id: number;
    account_id: number;
    title: string;
    auto_approved: number;
    approval_since: string | null;
    last_approval_reminder_at: string | null;
  }>;

  for (const card of approvalCards) {
    if (!card.approval_since) continue;
    const biz = businessDaysBetween(card.approval_since, today);
    const parsed = parseReminder(card.last_approval_reminder_at);
    if (biz >= 3 && !card.auto_approved) {
      try {
        await approveRequest(card.account_id, card.id, { actorId: -1, auto: true });
        summary.auto_approved += 1;
      } catch {
        /* skip */
      }
      continue;
    }
    if (biz >= 1 && parsed.count < 1) {
      const account = await getAccount(card.account_id);
      if (account)
        await notify({
          kind: "approval_reminder",
          to: account.email,
          toName: account.contact_name,
          subject: `"${card.title}" is waiting for your review`,
          html: `Reminder: this item will auto-approve after 3 business days. Review it now.
            <a href="${await clientLink("/board")}">Open board</a>`,
          relatedType: "request",
          relatedId: card.id,
        });
      setReminder(card.id, 1, today);
      summary.reminders += 1;
    } else if (biz >= 2 && parsed.count < 2) {
      const account = await getAccount(card.account_id);
      if (account)
        await notify({
          kind: "approval_reminder",
          to: account.email,
          toName: account.contact_name,
          subject: `Final reminder: "${card.title}" auto-approves tomorrow`,
          html: `This item auto-approves after 3 business days of no response. If you want changes, request them now.
            <a href="${await clientLink("/board")}">Open board</a>`,
          relatedType: "request",
          relatedId: card.id,
        });
      setReminder(card.id, 2, today);
      summary.reminders += 1;
    }
  }

  return summary;
}

function parseReminder(v: string | null): { count: number; date: string | null } {
  if (!v) return { count: 0, date: null };
  const [count, date] = v.split(":");
  return { count: Number(count) || 0, date: date ?? null };
}

async function setReminder(requestId: number, count: number, date: string) {
  await db.prepare(
    "UPDATE request SET last_approval_reminder_at = ? WHERE id = ?"
  ).run(`${count}:${date}`, requestId);
}

export async function getMrr() {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(p.price_php), 0) AS mrr FROM subscription s
       JOIN plan p ON p.id = s.plan_id
       WHERE s.status IN ('active','expiring_soon')`
    )
    .get() as { mrr: number };
  return row.mrr;
}
