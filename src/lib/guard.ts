import { redirect } from "next/navigation";
import { getSessionBundle } from "./session";
import type { SessionBundle } from "./types";

export async function requireAuth(): Promise<SessionBundle> {
  const s = await getSessionBundle();
  if (!s) redirect("/login");
  return s;
}

export async function requireClient(): Promise<SessionBundle> {
  const s = await requireAuth();
  if (s.role === "admin") redirect("/admin");
  return s;
}

export async function requireAdmin(): Promise<SessionBundle> {
  const s = await requireAuth();
  if (s.role !== "admin") redirect("/board");
  return s;
}

export async function redirectIfAuthed(): Promise<SessionBundle | null> {
  const s = await getSessionBundle();
  if (!s) return null;
  if (s.role === "admin") redirect("/admin");
  if (s.subscription?.status === "draft") redirect("/onboarding");
  if (s.subscription?.status === "pending_payment") redirect("/onboarding?step=2");
  redirect("/board");
}
