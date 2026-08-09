/*
 * One-time migration: SQLite (data/podiumset.db) -> Supabase/Postgres.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/import-sqlite-to-pg.mjs
 *
 * Reads every table from the SQLite file, re-inserts rows with the same
 * ids into Postgres, then fixes the serial sequences.
 */
import Database from "better-sqlite3";
import fs from "node:fs";

const SQLITE_PATH =
  process.env.SQLITE_PATH || "data/podiumset.db";

if (!fs.existsSync(SQLITE_PATH)) {
  console.error(`SQLite file not found: ${SQLITE_PATH}`);
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = new Database(SQLITE_PATH, { readonly: true });
const { Pool } = await import("pg");
let pool;
try {
  pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  await pool.query("SELECT 1");
  console.log("Connected to Postgres.");
} catch (e) {
  console.error("Cannot connect to Postgres:", e.message);
  process.exit(1);
}

// Topological order: parents first so FK references resolve.
const TABLES = [
  "plan",
  "addon",
  "request_type",
  "account",
  "user",
  "phase",
  "subscription",
  "subscription_addon",
  "payment",
  "request",
  "subtask",
  "deliverable",
  "comment",
  "attachment",
  "brand_profile",
  "email_verify",
  "entitlement_log",
  "notification",
  "ads_update",
];

let total = 0;
for (const table of TABLES) {
  const cols = sql
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((c) => c.name);
  if (cols.length === 0) {
    console.log(`skip ${table}: not present`);
    continue;
  }
  const rows = sql.prepare(`SELECT * FROM ${table}`).all();
  if (rows.length === 0) {
    console.log(`${table}: 0 rows (skip)`);
    continue;
  }

  for (const r of rows) {
    const vals = cols.map((c) => {
      let v = r[c];
      if (v == null) return null;
      if (typeof v === "bigint") return Number(v);
      if (Buffer.isBuffer(v)) return String(v);
      return v;
    });
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    const q = `INSERT INTO public."${table}" (${cols
      .map((c) => `"${c}"`)
      .join(", ")}) VALUES (${placeholders})`;
    try {
      await pool.query(q, vals);
      total++;
    } catch (e) {
      console.error(`FAIL ${table} id=${r.id}: ${e.message}`);
    }
  }

  const { rows: mx } = await pool.query(
    `SELECT COALESCE(MAX(id), 0) AS m FROM public."${table}"`
  );
  const maxId = Number(mx[0]?.m ?? 0);
  if (maxId > 0) {
    await pool.query(
      `SELECT setval(pg_get_serial_sequence('public."${table}"', 'id'), $1)`,
      [maxId]
    );
  }
  console.log(`${table}: ${rows.length} imported, max id ${maxId}`);
}

await pool.end();
console.log(`\nDONE — ${total} rows imported.`);