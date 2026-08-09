import bcrypt from "bcryptjs";
import { err, ok } from "@/lib/route-auth";
import { getUserByEmail } from "@/lib/queries";
import { setSessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) return err("Email and password are required.");
  const user = await getUserByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return err("Invalid email or password.", 401);

  await setSessionCookie({
    user_id: user.id,
    account_id: user.account_id,
    email: user.email,
    role: user.role,
  });
  return ok({ ok: true, role: user.role });
}
