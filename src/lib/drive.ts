import crypto from "node:crypto";
import { db } from "./db";
import { getAccount } from "./queries";

/**
 * Google Drive sync for deliverables.
 *
 * Fully optional: if GOOGLE_DRIVE_SERVICE_ACCOUNT (JSON) and
 * GOOGLE_DRIVE_FOLDER_ID (a shared Drive folder) are not configured,
 * every function is a safe no-op and files simply stay in local uploads.
 *
 * When configured, each client gets a folder named after their business,
 * created on onboarding (payment verification) and reused afterwards.
 * Every deliverable upload is mirrored into that folder.
 */

function serviceAccount(): {
  client_email: string;
  private_key: string;
  token_uri: string;
} | null {
  const raw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.client_email || !parsed.private_key) return null;
    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
      token_uri: parsed.token_uri || "https://oauth2.googleapis.com/token",
    };
  } catch {
    return null;
  }
}

export function driveConfigured(): boolean {
  return !!serviceAccount() && !!process.env.GOOGLE_DRIVE_FOLDER_ID;
}

function signJwt(payload: Record<string, unknown>, privateKey: string): string {
  const header = { alg: "RS256", typ: "JWT" };
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const data = `${enc(header)}.${enc(payload)}`;
  const sig = crypto.sign("RSA-SHA256", Buffer.from(data), privateKey);
  return `${data}.${sig.toString("base64url")}`;
}

async function getAccessToken(): Promise<string | null> {
  const sa = serviceAccount();
  if (!sa) return null;
  const now = Math.floor(Date.now() / 1000);
  const jwt = signJwt(
    {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/drive.file",
      aud: sa.token_uri,
      iat: now,
      exp: now + 3600,
    },
    sa.private_key
  );
  try {
    const res = await fetch(sa.token_uri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch (e) {
    console.error("[drive] token exchange failed:", e);
    return null;
  }
}

async function api(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

async function createFolder(
  token: string,
  name: string,
  parentId: string
): Promise<string | null> {
  const data = await api(token, "/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  return typeof data.id === "string" ? data.id : null;
}

async function findFolderByName(
  token: string,
  name: string,
  parentId: string
): Promise<string | null> {
  const q = `name = '${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const data = await api(token, `/files?q=${encodeURIComponent(q)}&pageSize=1&fields=files(id,name)`);
  const files = (data.files ?? []) as Array<{ id?: string }>;
  return files.length ? (files[0].id ?? null) : null;
}

/** Creates (or reuses) the client's Drive folder and persists its id. */
export async function ensureClientFolder(
  accountId: number
): Promise<string | null> {
  const account = await getAccount(accountId);
  if (!account || !await driveConfigured()) return null;
  if (account.drive_folder_id) return account.drive_folder_id;

  const token = await getAccessToken();
  const parentId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!token || !parentId) return null;

  try {
    let folderId = await findFolderByName(token, account.business_name, parentId);
    if (!folderId) folderId = await createFolder(token, account.business_name, parentId);
    if (folderId) {
      await db.prepare("UPDATE account SET drive_folder_id = ? WHERE id = ?").run(
        folderId,
        accountId
      );
    }
    return folderId;
  } catch (e) {
    console.error("[drive] ensure folder failed:", e);
    return null;
  }
}

async function uploadFile(
  token: string,
  fileName: string,
  mime: string,
  buf: Buffer,
  folderId: string
): Promise<string | null> {
  const fd = new FormData();
  fd.append(
    "metadata",
    new Blob([JSON.stringify({ name: fileName, parents: [folderId] })], {
      type: "application/json",
    })
  );
  fd.append("file", new Blob([new Uint8Array(buf)], { type: mime }), fileName);
  try {
    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      }
    );
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return data.id ?? null;
  } catch (e) {
    console.error("[drive] upload failed:", e);
    return null;
  }
}

/** Mirrors a deliverable into the client's Drive folder (no-op if not configured). */
export async function pushDeliverableToDrive(opts: {
  accountId: number | null;
  otherClientName?: string | null;
  fileName: string;
  mime: string;
  buf: Buffer;
}): Promise<string | null> {
  if (!await driveConfigured()) return null;
  const token = await getAccessToken();
  const parentId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!token || !parentId) return null;

  try {
    let folderId: string | null = null;
    if (opts.accountId != null) {
      folderId = await ensureClientFolder(opts.accountId);
    } else {
      const otherRoot = (await findFolderByName(token, "Others", parentId)) ??
        (await createFolder(token, "Others", parentId));
      if (otherRoot && opts.otherClientName) {
        folderId = (await findFolderByName(token, opts.otherClientName, otherRoot)) ??
          (await createFolder(token, opts.otherClientName, otherRoot));
      } else {
        folderId = otherRoot;
      }
    }
    if (!folderId) return null;
    return await uploadFile(token, opts.fileName, opts.mime, opts.buf, folderId);
  } catch (e) {
    console.error("[drive] push failed:", e);
    return null;
  }
}

/** Deletes a Drive file by id (no-op if not configured or already gone). */
export async function deleteDriveFile(fileId: string): Promise<void> {
  if (!driveConfigured()) return;
  const token = await getAccessToken();
  if (!token) return;
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    console.error("[drive] delete failed:", e);
  }
}

/** Browser-facing URL for a Drive-file deliverable (served via our proxy). */
export function driveFileUrl(fileId: string): string {
  return `/drive/${encodeURIComponent(fileId)}`;
}

/** True when a stored file_url points at a Drive file behind the proxy. */
export function isDriveUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && /^\/drive\/[^/]+$/.test(url);
}
