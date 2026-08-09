import { err, ok } from "@/lib/route-auth";
import { verifyEmail } from "@/lib/queries";

export async function POST(req: Request) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }
  if (!body.token) return err("Missing token");
  const res = await verifyEmail(body.token);
  if (!res.ok) return err(res.message ?? "Verification failed.");
  return ok({ ok: true });
}
