import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transporter;
}

export interface SendEmailOpts {
  to: string;
  toName?: string;
  subject: string;
  html: string;
}

export async function sendEmail(opts: SendEmailOpts) {
  const t = getTransporter();
  if (!t) {
    console.log(
      `[mail:dry-run] To: ${opts.to}${opts.toName ? ` (${opts.toName})` : ""} — ${opts.subject}`
    );
    return { ok: true, dryRun: true };
  }
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || "PodiumSet <noreply@podiumset.ph>",
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    return { ok: true };
  } catch (e) {
    console.error("[mail] send failed:", e);
    return { ok: false };
  }
}

export function wrapEmail(title: string, bodyHtml: string): string {
  return `
<!doctype html>
<html><body style="margin:0;padding:0;background:#0b0b0d;color:#f5f3ee;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0d">
    <tr><td align="center" style="padding:32px 16px">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#17171b;border:1px solid #2b2b32;border-radius:14px">
        <tr><td style="padding:24px 28px 0">
          <div style="font-weight:700;font-size:18px;color:#e0b44d;letter-spacing:0.5px">PodiumSet.ph</div>
        </td></tr>
        <tr><td style="padding:20px 28px">
          <div style="font-size:20px;font-weight:700;margin-bottom:12px;color:#f5f3ee">${title}</div>
          <div style="font-size:15px;line-height:1.6;color:#c9c6bc">${bodyHtml}</div>
        </td></tr>
        <tr><td style="padding:8px 28px 24px;font-size:12px;color:#9a978e">
          PodiumSet.ph · Unlimited designs, unlimited opportunities. Reply to this email or open your portal to respond.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
