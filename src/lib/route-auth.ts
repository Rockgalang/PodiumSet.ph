import { getSessionBundle } from "./session";
import type { SessionBundle } from "./types";

export async function apiAuth(): Promise<SessionBundle | null> {
  return getSessionBundle();
}

export async function apiRequireClient(): Promise<SessionBundle | null> {
  const s = await getSessionBundle();
  if (!s || s.role !== "client") return null;
  return s;
}

export async function apiRequireAdmin(): Promise<SessionBundle | null> {
  const s = await getSessionBundle();
  if (!s || s.role !== "admin") return null;
  return s;
}

export function err(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function ok(data: unknown = { ok: true }) {
  return Response.json(data);
}
