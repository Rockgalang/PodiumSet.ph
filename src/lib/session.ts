import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import type {
  SessionUser,
  SessionBundle,
  PlanRow,
  SubscriptionRow,
  SubscriptionAddonRow,
  AddonRow,
} from "./types";

const COOKIE = "ps_session";
const SECRET = process.env.SESSION_SECRET || "insecure-dev-secret-change-me";
const MAX_AGE_SEC = 60 * 60 * 24 * 7;

function b64url(s: string): string {
  return Buffer.from(s).toString("base64url");
}

export function signSession(payload: SessionUser): string {
  const body = JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SEC,
  });
  const sig = createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${b64url(body)}.${sig}`;
}

export function verifySession(token: string): SessionUser | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", SECRET)
    .update(Buffer.from(body, "base64url").toString())
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof data.exp !== "number" || data.exp < Math.floor(Date.now() / 1000))
      return null;
    return {
      user_id: data.user_id,
      account_id: data.account_id,
      email: data.email,
      role: data.role,
    } as SessionUser;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function setSessionCookie(u: SessionUser): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, await signSession(u), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export interface SubscriptionBundle extends SubscriptionRow {
  plan: PlanRow | null;
  addons: AddonRow[];
}

export async function getSessionBundle(): Promise<SessionBundle | null> {
  const u = await getSessionUser();
  if (!u) return null;
  const account = await db
    .prepare("SELECT * FROM account WHERE id = ?")
    .get(u.account_id) as SessionBundle["account"] | undefined;
  if (!account) return null;
  const subscription = await getSubscriptionBundle(u.account_id);
  return { ...u, account, subscription };
}

export async function getSubscriptionBundle(
  accountId: number
): Promise<SubscriptionBundle | null> {
  const row = await db
    .prepare(
      `SELECT s.*, p.id AS plan_id_, p.name AS plan_name, p.price_php AS plan_price_php,
        p.active_slots AS plan_slots, p.includes_video AS plan_video,
        p.consult_hours AS plan_consult, p.shoot_hours AS plan_shoot,
        p.includes_ads AS plan_ads, p.priority_queue AS plan_priority,
        p.tagline AS plan_tagline, p.description AS plan_description, p.featured AS plan_featured
       FROM subscription s
       LEFT JOIN plan p ON p.id = s.plan_id
       WHERE s.account_id = ?`
    )
    .get(accountId) as
    | (SubscriptionRow & {
        plan_id_: number | null;
        plan_name: string | null;
        plan_price_php: number | null;
        plan_slots: number | null;
        plan_video: number | null;
        plan_consult: number | null;
        plan_shoot: number | null;
        plan_ads: number | null;
        plan_priority: number | null;
        plan_tagline: string | null;
        plan_description: string | null;
        plan_featured: number | null;
      })
    | undefined;
  if (!row) return null;
  const addonRows = await db
    .prepare(
      `SELECT a.* FROM subscription_addon sa
       JOIN addon a ON a.id = sa.addon_id
       WHERE sa.subscription_id = ? AND sa.active = 1`
    )
    .all(row.id) as AddonRow[];
  const plan: PlanRow | null = row.plan_id_
    ? {
        id: row.plan_id_,
        name: row.plan_name!,
        price_php: row.plan_price_php!,
        active_slots: row.plan_slots!,
        includes_video: row.plan_video!,
        consult_hours: row.plan_consult!,
        shoot_hours: row.plan_shoot!,
        includes_ads: row.plan_ads!,
        priority_queue: row.plan_priority!,
        featured: row.plan_featured!,
        tagline: row.plan_tagline || "",
        description: row.plan_description || "",
        sort_order: 0,
      }
    : null;
  const { plan_id_, plan_name, ...sub } = row as unknown as Record<
    string,
    unknown
  >;
  return {
    ...(sub as unknown as SubscriptionRow),
    plan,
    addons: addonRows,
  };
}
