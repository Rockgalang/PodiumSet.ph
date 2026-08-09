import { err, ok, apiRequireAdmin } from "@/lib/route-auth";
import { moveToForApproval } from "@/lib/queries";
import { saveFile } from "@/lib/upload";
import {
  driveConfigured,
  driveFileUrl,
  pushDeliverableToDrive,
} from "@/lib/drive";
import { db } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await apiRequireAdmin();
  if (!s) return err("Admin only", 401);
  const { id } = await params;
  const row = await db
    .prepare(
      "SELECT account_id, other_client_name, column FROM request WHERE id = ?"
    )
    .get(Number(id)) as
    | {
        account_id: number | null;
        other_client_name: string | null;
        column: string;
      }
    | undefined;
  if (!row) return err("Request not found", 404);
  if (row.column !== "ongoing")
    return err("Only Ongoing cards can receive a deliverable.");

  const fd = await req.formData().catch(() => null);
  if (!fd) return err("Invalid form");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0)
    return err("Upload the deliverable file.");
  const note = String(fd.get("note") ?? "");

  const buf = Buffer.from(await file.arrayBuffer());

  // Preferred path: upload straight to the client's Drive folder and point the
  // board at our /drive proxy. Falls back to local uploads when Drive is not
  // configured or the push fails.
  let deliverableUrl: string | null = null;
  if (driveConfigured()) {
    try {
      const fileId = await pushDeliverableToDrive({
        accountId: row.account_id,
        otherClientName: row.other_client_name,
        fileName: file.name,
        mime: file.type || "application/octet-stream",
        buf,
      });
      if (fileId) deliverableUrl = driveFileUrl(fileId);
    } catch (e) {
      console.error("[deliverable] drive push failed, falling back to local:", e);
    }
  }
  if (!deliverableUrl) {
    const local = await saveFile(
      {
        name: file.name,
        type: file.type,
        size: file.size,
        arrayBuffer: async () => buf,
      } as unknown as File,
      "deliverables",
      { maxBytes: 200 * 1024 * 1024 }
    );
    deliverableUrl = local.url;
  }

  try {
    await moveToForApproval(row.account_id, Number(id), {
      deliverableUrl,
      actorId: s.user_id,
      note: note.trim() || undefined,
    });
  } catch (e) {
    return err((e as Error).message);
  }

  return ok({ ok: true });
}
