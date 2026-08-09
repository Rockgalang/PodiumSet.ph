import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export interface SavedFile {
  url: string;
  name: string;
  ext: string;
  size: number;
}

export interface SaveOpts {
  maxBytes?: number;
  allowed?: string[];
}

export async function saveFile(
  file: File,
  folder: string,
  opts?: SaveOpts
): Promise<SavedFile> {
  const maxBytes = opts?.maxBytes ?? 25 * 1024 * 1024;
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) throw new Error("Empty file");
  if (buf.length > maxBytes)
    throw new Error(
      `File too large (max ${Math.round(maxBytes / 1024 / 1024)} MB)`
    );
  const ext = path.extname(file.name).toLowerCase() || "";
  if (opts?.allowed?.length) {
    const ok = opts.allowed.some((e) =>
      e.startsWith(".") ? ext === e.toLowerCase() : file.type === e
    );
    if (!ok)
      throw new Error(
        `File type not allowed (${file.type || ext || "unknown"})`
      );
  }
  const name = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
  const dir = path.join(UPLOAD_ROOT, folder);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, name), buf);
  return { url: `/uploads/${folder}/${name}`, name: file.name, ext, size: buf.length };
}

export function publicUploadsDir(): string {
  return path.dirname(UPLOAD_ROOT);
}
