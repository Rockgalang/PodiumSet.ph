import { err, ok, apiRequireClient } from "@/lib/route-auth";
import { upsertBrandProfile } from "@/lib/queries";

export async function POST(req: Request) {
  const s = await apiRequireClient();
  if (!s) return err("Not signed in", 401);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  await upsertBrandProfile(s.account_id, {
    logo_urls: JSON.stringify(Array.isArray(body.logo_urls) ? body.logo_urls : []),
    colors: str(body.colors),
    fonts: str(body.fonts),
    tone: str(body.tone),
    links: str(body.links),
    avoid_notes: str(body.avoid_notes),
  });
  return ok({ ok: true });
}
