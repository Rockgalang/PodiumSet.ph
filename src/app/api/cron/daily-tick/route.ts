import { err, ok } from "@/lib/route-auth";
import { runDailyTick } from "@/lib/queries";

/**
 * Daily housekeeping job:
 *  - decrement days_remaining for active subscriptions
 *  - move subscriptions to expiring_soon / expired + grace window
 *  - send auto-approve reminders and auto-approve For Approval cards
 *
 * Call this once a day from a cron service (cron-job.org, GitHub Actions, etc.)
 * with header `x-cron-secret: <CRON_SECRET>`.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET)
    return err("Unauthorized", 401);
  try {
    const summary = await runDailyTick();
    return ok(summary);
  } catch (e) {
    return err((e as Error).message, 500);
  }
}
