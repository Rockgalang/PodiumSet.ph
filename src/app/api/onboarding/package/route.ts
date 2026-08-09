import { err, ok, apiRequireClient } from "@/lib/route-auth";
import { getAddons, setSubscriptionPlan, getSubscriptionBundle, totalDue } from "@/lib/queries";

export async function POST(req: Request) {
  const s = await apiRequireClient();
  if (!s) return err("Not signed in", 401);
  const sub = s.subscription;
  if (!sub) return err("No subscription found", 404);
  if (["active", "expiring_soon", "paused"].includes(sub.status))
    return err("Your subscription is already set up.");

  let body: { plan_id?: number; addon_ids?: number[] };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }
  const planId = Number(body.plan_id);
  if (!planId) return err("Choose a package.");

  const addons = await getAddons();
  const addonIds = Array.isArray(body.addon_ids) ? body.addon_ids : [];
  const validAddonIds = new Set(addons.map((a) => a.id));
  for (const id of addonIds) {
    if (!validAddonIds.has(Number(id))) return err("Unknown add-on.");
    const addon = addons.find((a) => a.id === Number(id))!;
    if (addon.requires_plan) {
      const allowed: number[] = JSON.parse(addon.allowed_plans || "[]");
      if (allowed.length > 0 && !allowed.includes(planId))
        return err(`The ${addon.name} add-on is not available on that package.`);
    }
  }

  await setSubscriptionPlan(s.account_id, planId, addonIds.map(Number));
  const bundle = (await getSubscriptionBundle(s.account_id))!;
  const total = await totalDue(bundle.plan, bundle.addons);
  return ok({ ok: true, total_due: total });
}
