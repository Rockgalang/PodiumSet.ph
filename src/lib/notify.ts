import { db } from "./db";
import { sendEmail, wrapEmail } from "./mailer";

export interface NotifyOpts {
  kind: string;
  to: string;
  toName?: string;
  subject: string;
  html: string;
  relatedType?: string;
  relatedId?: number;
}

export async function notify(opts: NotifyOpts) {
  const text = opts.html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  await db.prepare(
    `INSERT INTO notification (to_email, to_name, subject, body, kind, related_type, related_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    opts.to,
    opts.toName ?? "",
    opts.subject,
    text,
    opts.kind,
    opts.relatedType ?? null,
    opts.relatedId ?? null
  );
  void sendEmail({
    to: opts.to,
    toName: opts.toName,
    subject: opts.subject,
    html: wrapEmail(opts.subject, opts.html),
  });
}

export async function getAdminEmail(): Promise<string | null> {
  const row = await db
    .prepare("SELECT email FROM user WHERE role = 'admin' LIMIT 1")
    .get() as { email: string } | undefined;
  return row?.email ?? null;
}

export async function notifyAdmin(opts: {
  kind: string;
  subject: string;
  html: string;
  relatedType?: string;
  relatedId?: number;
}) {
  const adminEmail = await getAdminEmail();
  if (!adminEmail) {
    console.log("[notify] no admin email configured");
    return;
  }
  await notify({ ...opts, to: adminEmail, toName: "Jasper" });
}

export function clientLink(path: string): string {
  const base = process.env.APP_URL || "http://localhost:3000";
  return `${base}${path}`;
}
