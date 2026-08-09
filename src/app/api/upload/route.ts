import { err, ok, apiAuth } from "@/lib/route-auth";
import { saveFile } from "@/lib/upload";
import { pushDeliverableToDrive } from "@/lib/drive";

export async function POST(req: Request) {
  const s = await apiAuth();
  if (!s) return err("Not signed in", 401);
  const fd = await req.formData().catch(() => null);
  if (!fd) return err("Invalid form");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return err("No file uploaded.");
  const folder = String(fd.get("folder") ?? "misc");
  try {
    const saved = await saveFile(file, folder, { maxBytes: 25 * 1024 * 1024 });
    // Mirror every creative upload (brand logos, payment proofs, brief
    // attachments) into the client's Google Drive folder (no-op unless
    // configured).
    const buf = Buffer.from(await file.arrayBuffer());
void await pushDeliverableToDrive({
      accountId: s.account_id,
      fileName: file.name,
      mime: file.type || "application/octet-stream",
      buf,
    }).catch(() => null);
    return ok({ ok: true, url: saved.url, name: saved.name });
  } catch (e) {
    return err((e as Error).message);
  }
}
