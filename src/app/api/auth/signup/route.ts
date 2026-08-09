import bcrypt from "bcryptjs";
import { err, ok } from "@/lib/route-auth";
import { getUserByEmail, createAccountAndUser, createEmailVerification } from "@/lib/queries";
import { setSessionCookie } from "@/lib/session";
import { notify, clientLink } from "@/lib/notify";

export async function POST(req: Request) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }
  const {
    business_name,
    contact_name,
    email,
    mobile,
    viber,
    viber_same,
    industry,
    city,
    password,
  } = body;
  if (!business_name || !contact_name || !email || !mobile || !password)
    return err("All fields are required.");
  if (!viber && viber_same !== "1" && viber_same !== "true")
    return err("Viber number is required (or tick “same as mobile”).");
  const emailClean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean))
    return err("Please enter a valid email address.");
  if (password.length < 8)
    return err("Password must be at least 8 characters.");
  if (await getUserByEmail(emailClean))
    return err("An account with this email already exists.");

  const hash = bcrypt.hashSync(password, 10);
  const effectiveViber =
    viber_same === "1" || viber_same === "true"
      ? mobile.trim()
      : (viber ?? "").trim();
  const { account_id, user_id } = await createAccountAndUser({
    business_name: business_name.trim(),
    contact_name: contact_name.trim(),
    email: emailClean,
    mobile: mobile.trim(),
    viber: effectiveViber,
    industry: (industry ?? "").trim(),
    city: (city ?? "").trim(),
    password_hash: hash,
  });

  await setSessionCookie({
    user_id,
    account_id,
    email: emailClean,
    role: "client",
  });

  const token = await createEmailVerification(account_id);
  await notify({
    kind: "email_verify",
    to: emailClean,
    toName: contact_name,
    subject: "Verify your email — PodiumSet",
    html: `Welcome aboard, ${contact_name}! Confirm your email to finish setting up.<br/>
      <a href="${await clientLink(`/verify-email?token=${encodeURIComponent(token)}`)}">Verify my email</a>`,
  });

  return ok({ ok: true });
}
