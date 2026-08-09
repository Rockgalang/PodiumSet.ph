import { ok } from "@/lib/route-auth";
import { clearSessionCookie } from "@/lib/session";

export async function POST() {
  await clearSessionCookie();
  return ok({ ok: true });
}
