import { err, ok, apiRequireClient } from "@/lib/route-auth";
import { upsertBrandProfile } from "@/lib/queries";

export async function POST(req: Request) {
  const s = await apiRequireClient();
  if (!s) return err("Not signed in", 401);
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }
  await upsertBrandProfile(s.account_id, {
    logo_urls: JSON.stringify(
      Array.isArray(body.logo_urls) ? body.logo_urls : []
    ),
    colors: body.colors ?? "",
    fonts: body.fonts ?? "",
    tone: body.tone ?? "",
    links: body.links ?? "",
    avoid_notes: body.avoid_notes ?? "",
  });
  return ok({ ok: true });
}
