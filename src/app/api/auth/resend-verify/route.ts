import { err, ok } from "@/lib/route-auth";
import { apiRequireClient } from "@/lib/route-auth";
import { createEmailVerification } from "@/lib/queries";
import { notify, clientLink } from "@/lib/notify";

export async function POST() {
  const s = await apiRequireClient();
  if (!s) return err("Not signed in", 401);
  const token = await createEmailVerification(s.account_id);
  await notify({
    kind: "email_verify",
    to: s.email,
    toName: s.account?.contact_name ?? s.email,
    subject: "Verify your email — PodiumSet",
    html: `Confirm your email to finish setting up your account.<br/>
      <a href="${await clientLink(`/verify-email?token=${encodeURIComponent(token)}`)}">Verify my email</a>`,
  });
  return ok({ ok: true });
}
