import { err, ok, apiRequireClient } from "@/lib/route-auth";
import { addAttachment } from "@/lib/queries";
import { saveFile } from "@/lib/upload";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await apiRequireClient();
  if (!s) return err("Not signed in", 401);
  const { id } = await params;
  const fd = await req.formData().catch(() => null);
  if (!fd) return err("Invalid form");
  const files = fd.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return err("No files uploaded.");
  try {
    for (const f of files) {
      const saved = await saveFile(f, "briefs", { maxBytes: 25 * 1024 * 1024 });
      await addAttachment(s.account_id, Number(id), saved.url, s.user_id);
    }
  } catch (e) {
    return err((e as Error).message);
  }
  return ok({ ok: true });
}
