/* End-to-end API smoke against the Postgres/PGlite stack. */
const BASE = process.env.SMOKE_BASE || "http://localhost:3100";
const ADMIN_EMAIL = "admin@podiumset.ph";
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || "podiumset2026";
const fs = await import("node:fs");

let pass = 0;
let fail = 0;
function check(name, cond, extra = "") {
  if (cond) {
    pass++;
    console.log(`PASS  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}${extra ? "  >> " + extra : ""}`);
  }
}

let cookie = "";
async function req(path, { method = "GET", json, form } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (json !== undefined) {
    headers["content-type"] = "application/json";
  }
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: json !== undefined ? JSON.stringify(json) : form,
    redirect: "manual",
  });
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, data, text };
}

/* 1. admin login */
let r = await req("/api/auth/login", {
  method: "POST",
  json: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
});
check("admin login", r.status === 200 && r.data?.ok === true, r.text);

/* 2. admin payments overview */
r = await req("/api/admin/payments");
check("GET /api/admin/payments", r.status === 200 && Array.isArray(r.data?.payments), r.text.slice(0, 120));

/* 4. client signup */
const email = `smoke${Date.now()}@example.com`;
r = await req("/api/auth/signup", {
  method: "POST",
  json: {
    business_name: "Smoke Studio",
    contact_name: "Smoke Tester",
    email,
    mobile: "09170000000",
    viber_same: "true",
    industry: "Retail",
    city: "Makati",
    password: "testpass1234",
  },
});
check("client signup", r.status === 200 && r.data?.ok === true, r.text);

/* 5. package */
r = await req("/api/onboarding/package", {
  method: "POST",
  json: { plan_id: 2, addon_ids: [] },
});
check("choose package (plan 2)", r.status === 200 && typeof r.data?.total_due === "number", r.text);

/* 6. submit payment proof */
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);
const fd = new FormData();
fd.append("method", "GCash");
fd.append("reference_no", "REF-SMOKE-1");
fd.append("proof", new Blob([png], { type: "image/png" }), "proof.png");
r = await req("/api/onboarding/payment", { method: "POST", form: fd });
check("submit payment", r.status === 200 && r.data?.ok === true, r.text);
const paymentId = r.data?.payment_id;

/* 7. admin: re-login, list payments, find ours, verify */
r = await req("/api/auth/login", {
  method: "POST",
  json: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
});
check("admin re-login", r.status === 200 && r.data?.ok === true, r.text);
r = await req("/api/admin/payments");
const found = (r.data?.payments ?? []).find((p) => p.id === paymentId);
check("payment appears pending for admin", !!found && found.status === "pending");
r = await req(`/api/admin/payments/${paymentId}/verify`, {
  method: "POST",
  json: { days_granted: 30 },
});
check("admin verifies payment", r.status === 200 && r.data?.ok === true, r.text);

/* 8. client logs back in, creates request */
r = await req("/api/auth/login", {
  method: "POST",
  json: { email, password: "testpass1234" },
});
check("client re-login", r.status === 200 && r.data?.ok === true, r.text);
const fd2 = new FormData();
fd2.append("request_type_id", "1");
fd2.append("title", "Smoke poster design");
fd2.append("deliverable", "Facebook post 1080x1080");
fd2.append("dimensions", "1080x1080");
r = await req("/api/board/requests", { method: "POST", form: fd2 });
check("client creates request", r.status === 200 && r.data?.ok === true, r.text);
const requestId = r.data?.id;
check("request id returned", typeof requestId === "number");

/* 9. client reorder */
r = await req("/api/board/requests/reorder", {
  method: "POST",
  json: { ids: [requestId] },
});
check("client reorder lineup", r.status === 200 && r.data?.ok === true, r.text);

/* 10. admin re-login; kanban GET shows it in lineup */
r = await req("/api/auth/login", {
  method: "POST",
  json: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
});
check("admin re-login #3", r.status === 200, r.text);
const accountId = found.account_id;
r = await req(`/api/admin/clients/${accountId}/kanban`);
const reqs = r.data?.requests ?? [];
const mine = reqs.find((x) => x.id === requestId);
check("kanban shows new request", !!mine && mine.column === "lineup", JSON.stringify(mine));

/* 11. admin status: to_ongoing */
r = await req(`/api/board/requests/${requestId}/status`, {
  method: "POST",
  json: { action: "to_ongoing", target_date: "2026-08-20" },
});
check("admin promotes to ongoing", r.status === 200 && r.data?.ok === true, r.text);

/* 12. admin kanban: move to for_approval */
r = await req(`/api/admin/clients/${accountId}/kanban`, {
  method: "POST",
  json: { columns: { lineup: [], ongoing: [], for_approval: [requestId], done: [] } },
});
check("admin kanban save to for_approval", r.status === 200 && r.data?.ok === true, r.text);

/* 13. admin kanban GET reflects for_approval */
r = await req(`/api/admin/clients/${accountId}/kanban`);
const kanbanReq = (r.data?.requests ?? []).find((x) => x.id === requestId);
check("kanban GET shows for_approval", !!kanbanReq && kanbanReq.column === "for_approval", JSON.stringify(kanbanReq));

/* 14. client re-login, approves own request */
r = await req("/api/auth/login", {
  method: "POST",
  json: { email, password: "testpass1234" },
});
check("client re-login #2", r.status === 200, r.text);
r = await req(`/api/board/requests/${requestId}/approve`, {
  method: "POST",
  json: { note: "Looks good!" },
});
check("client approves", r.status === 200 && r.data?.ok === true, r.text);

/* 15. comment thread */
r = await req(`/api/board/requests/${requestId}/comments`, {
  method: "POST",
  json: { body: "Nice work!" },
});
check("client adds comment", r.status === 200, r.text);

/* 16. admin detail shows comment */
r = await req(`/api/board/requests/${requestId}`);
const detail = r.data;
check("request detail ok", r.status === 200 && detail?.id === requestId);
check("detail has comments", Array.isArray(detail?.comments), JSON.stringify(detail?.comments));
check(
  "detail comment matches",
  Array.isArray(detail?.comments) && detail.comments.some((c) => c.body === "Nice work!"),
  JSON.stringify(detail?.comments)
);

/* 17. admin re-login; account detail reflects subscription */
r = await req("/api/auth/login", {
  method: "POST",
  json: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
});
check("admin re-login #4", r.status === 200, r.text);
r = await req(`/api/admin/accounts/${accountId}`);
check("admin account detail", r.status === 200 && !!r.data?.account, r.text.slice(0, 150));

/* 18. client re-login; brand profile upsert */
r = await req("/api/auth/login", {
  method: "POST",
  json: { email, password: "testpass1234" },
});
check("client re-login #3", r.status === 200, r.text);
r = await req("/api/account/brand", {
  method: "POST",
  json: { colors: "#A11", tone: "confident" },
});
check("brand profile upsert", r.status === 200 && r.data?.ok === true, r.text);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);