import { err, ok, apiRequireClient } from "@/lib/route-auth";
import {
  getSubscriptionBundle,
  totalDue,
  createPayment,
  getPlan,
} from "@/lib/queries";
import { saveFile } from "@/lib/upload";
import { notifyAdmin, clientLink } from "@/lib/notify";
import { peso } from "@/lib/format";
import { db } from "@/lib/db";

const ALLOWED = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"];

export async function POST(req: Request) {
  const s = await apiRequireClient();
  if (!s) return err("Not signed in", 401);
  const sub = s.subscription;
  if (!sub) return err("No subscription found", 404);
  if (["active", "expiring_soon", "paused"].includes(sub.status))
    return err("Your subscription is already active.");

  const fd = await req.formData().catch(() => null);
  if (!fd) return err("Invalid form");
  const method = String(fd.get("method") ?? "");
  const reference_no = String(fd.get("reference_no") ?? "").trim() || null;
  const proof = fd.get("proof");

  if (!["GCash", "BDO", "GoTyme"].includes(method))
    return err("Choose a payment method.");
  if (!(proof instanceof File) || proof.size === 0)
    return err("Upload proof of payment.");

  const bundle = await getSubscriptionBundle(s.account_id);
  if (!bundle?.plan) return err("Choose a package before paying.");
  const amount = await totalDue(bundle.plan, bundle.addons);

  let saved;
  try {
    saved = await saveFile(proof, "proofs", {
      maxBytes: 10 * 1024 * 1024,
      allowed: ALLOWED,
    });
  } catch (e) {
    return err((e as Error).message);
  }

  const paymentId = await createPayment({
    account_id: s.account_id,
    amount_php: amount,
    method,
    reference_no,
    proof_url: saved.url,
  });

  if (sub.status !== "pending_payment") {
    await db.prepare(
      "UPDATE subscription SET status = 'pending_payment' WHERE account_id = ?"
    ).run(s.account_id);
  }

  const plan = await getPlan(bundle.plan.id);
  await notifyAdmin({
    kind: "payment_submitted",
    subject: `Payment proof from ${s.account?.business_name ?? s.email}`,
    html: `<strong>${s.account?.business_name ?? s.email}</strong> uploaded proof of payment.<br/>
      Amount expected: <strong>${peso(amount)}</strong> (${plan?.name ?? "—"}) via ${method}${
        reference_no ? `<br/>Reference: ${reference_no}` : ""
      }.<br/>
      <a href="${await clientLink("/admin/payments")}">Review payment</a>`,
    relatedType: "payment",
    relatedId: paymentId,
  });

  return ok({ ok: true, payment_id: paymentId });
}
