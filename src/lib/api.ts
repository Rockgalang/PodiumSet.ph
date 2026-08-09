export async function api<T = unknown>(
  url: string,
  opts?: RequestInit & { json?: unknown }
): Promise<T> {
  const { json, ...rest } = opts ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: {
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(rest.headers ?? {}),
    },
    body: json ? JSON.stringify(json) : rest.body,
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) {
    const msg =
      (data as { error?: string })?.error ?? `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}
