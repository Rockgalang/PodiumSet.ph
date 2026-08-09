import path from "node:path";
import fs from "node:fs";
import { seedOnBoot } from "./seed";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

/* ------------------------------------------------------------------ */
/* SQL dialect bridge (SQLite -> Postgres):                            */
/*   ?  -> $n         @name -> $n (named params)                      */
/*   datetime('now') -> now()                                          */
/*   `user` table    -> "user" (reserved word in Postgres)             */
/* Quote-aware: never touches string literals or quoted identifiers.   */
/* ------------------------------------------------------------------ */

export interface Translated {
  sql: string;
  named: string[];
  isInsert: boolean;
}

export function translateSql(input: string): Translated {
  const sql0 = input.trimEnd().replace(/;+\s*$/, "");
  let out = "";
  let i = 0;
  let n = 0;
  const named: string[] = [];
  const len = sql0.length;

  while (i < len) {
    const ch = sql0[i];
    const nx = sql0[i + 1];

    if (ch === "'") {
      let j = i + 1;
      while (j < len) {
        if (sql0[j] === "'") {
          if (sql0[j + 1] === "'") {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      out += sql0.slice(i, Math.min(j + 1, len));
      i = j + 1;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      while (j < len && sql0[j] !== '"') j++;
      out += sql0.slice(i, Math.min(j + 1, len));
      i = j + 1;
      continue;
    }
    if (ch === "-" && nx === "-") {
      let j = i + 2;
      while (j < len && sql0[j] !== "\n") j++;
      out += sql0.slice(i, j);
      i = j;
      continue;
    }
    if (ch === "?") {
      n++;
      out += `$${n}`;
      i++;
      continue;
    }
    if (ch === "@") {
      let j = i + 1;
      while (j < len && /[A-Za-z0-9_]/.test(sql0[j])) j++;
      const name = sql0.slice(i + 1, j);
      if (name.length) {
        n++;
        named.push(name);
        out += `$${n}`;
        i = j;
        continue;
      }
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < len && /[A-Za-z0-9_$]/.test(sql0[j])) j++;
      const word = sql0.slice(i, j);
      if (word === "user" || word === "column") {
        out += `"${word}"`;
      } else if (word === "datetime") {
        const rest = sql0.slice(j, j + 14);
        const m = /^\s*\('now'\)/.exec(rest);
        if (m) {
          out += "now()";
          i = j + m[0].length;
          continue;
        }
        out += word;
      } else {
        out += word;
      }
      i = j;
      continue;
    }
    out += ch;
    i++;
  }

  const isInsert = /^\s*insert\b/i.test(out);
  let finalSql = out;
  if (isInsert && !/returning\b/i.test(out)) {
    finalSql = `${out} RETURNING id`;
  }
  return { sql: finalSql, named, isInsert };
}

/* ------------------------------------------------------------------ */
/* Backends: PGlite (local file) or node-pg Pool (Supabase/Vercel)     */
/* ------------------------------------------------------------------ */

/* `any` keeps existing `as SomeRow[]` casts working across the codebase
   (the row shape is validated by each query's typed cast, not here). */
type Row = any;

interface BackendConn {
  query(text: string, params: unknown[]): Promise<{ rows: Row[]; count: number }>;
  release(): void;
}

interface Backend {
  query(text: string, params: unknown[]): Promise<{ rows: Row[]; count: number }>;
  exec(text: string): Promise<void>;
  acquire(): Promise<BackendConn>;
}

let backend: Backend | null = null;
let readyPromise: Promise<Backend> | null = null;

function initBackend(): Promise<Backend> {
  if (backend) return Promise.resolve(backend);
  if (!readyPromise) {
    readyPromise = (async () => {
      if (process.env.DATABASE_URL) {
        const { Pool } = await import("pg");
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
        });
        const b: Backend = {
          async query(text, params) {
            const res = await pool.query(text, params);
            return { rows: (res.rows ?? []) as Row[], count: res.rowCount ?? 0 };
          },
          async exec(text) {
            await pool.query(text);
          },
          async acquire() {
            const client = await pool.connect();
            return {
              async query(text, params) {
                const res = await client.query(text, params);
                return {
                  rows: (res.rows ?? []) as Row[],
                  count: res.rowCount ?? 0,
                };
              },
              release() {
                client.release();
              },
            };
          },
        };
        await b.exec("SELECT 1");
        backend = b;
        return b;
      }
      const { PGlite } = await import("@electric-sql/pglite");
      const client = new PGlite(
        process.env.PGLITE_DIR ? path.join(dataDir, "podiumset-pglite") : undefined
      );
      await client.waitReady;
      const run = async (text: string, params: unknown[]) => {
        const res = (await client.query(text, params)) as {
          rows?: Row[];
          affectedRows?: number;
          rowCount?: number;
        };
        return {
          rows: (res.rows ?? []) as Row[],
          count:
            typeof res.affectedRows === "number"
              ? res.affectedRows
              : (res.rowCount ?? 0),
        };
      };
      const b: Backend = {
        async query(text, params) {
          return run(text, params);
        },
        async exec(text) {
          await client.exec(text);
        },
        async acquire() {
          return {
            query: run,
            release() {
              /* single shared client */
            },
          };
        },
      };
      backend = b;
      return b;
    })().catch((e) => {
      readyPromise = null;
      throw e;
    });
  }
  return readyPromise;
}

let schemaReady: Promise<void> | null = null;
let seedPromise: Promise<void> | null = null;
let seeding = false;
function ensureSchema(b: Backend): Promise<void> {
  if (!schemaReady) {
    schemaReady = b.exec(SCHEMA_PG).catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}
function ensureSeed(): Promise<void> {
  if (seeding) return Promise.resolve();
  if (!seedPromise) {
    seeding = true;
    seedPromise = seedOnBoot()
      .catch((e) => {
        seedPromise = null;
        throw e;
      })
      .finally(() => {
        seeding = false;
      });
  }
  return seedPromise;
}

/* ------------------------------------------------------------------ */
/* Public async API in better-sqlite3 shape                            */
/* ------------------------------------------------------------------ */

export interface PreparedResult {
  lastInsertRowid: number;
  changes: number;
}

export type PreparedStmt = {
  get(...args: unknown[]): Promise<Row | undefined>;
  all(...args: unknown[]): Promise<Row[]>;
  run(...args: unknown[]): Promise<PreparedResult>;
};

function toParams(t: Translated, args: unknown[]): unknown[] {
  if (args.length === 1 && isPlainObject(args[0]) && t.named.length > 0) {
    const obj = args[0] as Record<string, unknown>;
    return t.named.map((k) => (k in obj ? obj[k] : null));
  }
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return args;
}

/** Connection used inside an open transaction, if any. */
let txConn: BackendConn | null = null;

function conn(): Promise<BackendConn> {
  return initBackend().then(async (b) => {
    await ensureSchema(b);
    await ensureSeed();
    return txConn ?? (await b.acquire());
  });
}

export const db = {
  /** Synchronous stub — translation happens here; get/all/run are async. */
  prepare(sql: string): PreparedStmt {
    const t = translateSql(sql);
    return {
      async get(...args: unknown[]): Promise<Row | undefined> {
        const c = await conn();
        const res = await c.query(t.sql, toParams(t, args));
        if (!txConn) c.release();
        return res.rows[0];
      },
      async all(...args: unknown[]): Promise<Row[]> {
        const c = await conn();
        const res = await c.query(t.sql, toParams(t, args));
        if (!txConn) c.release();
        return res.rows;
      },
      async run(...args: unknown[]): Promise<PreparedResult> {
        const c = await conn();
        const res = await c.query(t.sql, toParams(t, args));
        if (!txConn) c.release();
        const idRow = res.rows[0] as { id?: number } | undefined;
        return {
          lastInsertRowid: t.isInsert ? Number(idRow?.id ?? 0) : 0,
          changes: res.count,
        };
      },
    };
  },

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (txConn) throw new Error("Nested db.transaction is not supported");
    const c = await conn();
    txConn = c;
    try {
      await c.query("BEGIN", []);
      const out = await fn();
      await c.query("COMMIT", []);
      return out;
    } catch (e) {
      await c.query("ROLLBACK", []).catch(() => {});
      throw e;
    } finally {
      txConn = null;
      c.release();
    }
  },

  async exec(sql: string): Promise<void> {
    const c = await conn();
    await c.query(await translateSql(sql).sql, []);
    if (!txConn) c.release();
  },
};

export function nowIso(): string {
  return new Date().toISOString();
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/* ------------------------------------------------------------------ */
/* Postgres schema (SQLite schema ported 1:1)                          */
/* ------------------------------------------------------------------ */

const SCHEMA_PG = `
CREATE TABLE IF NOT EXISTS account (
  id               SERIAL PRIMARY KEY,
  business_name    TEXT NOT NULL,
  contact_name     TEXT NOT NULL,
  email            TEXT NOT NULL UNIQUE,
  mobile           TEXT NOT NULL,
  viber            TEXT NOT NULL DEFAULT '',
  industry         TEXT,
  city             TEXT NOT NULL DEFAULT '',
  drive_folder_id  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user" (
  id             SERIAL PRIMARY KEY,
  account_id     INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'client',
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_verify (
  id         SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_verify_token ON email_verify(token);

CREATE TABLE IF NOT EXISTS brand_profile (
  id          SERIAL PRIMARY KEY,
  account_id  INTEGER NOT NULL UNIQUE REFERENCES account(id) ON DELETE CASCADE,
  logo_urls   TEXT NOT NULL DEFAULT '[]',
  colors      TEXT NOT NULL DEFAULT '',
  fonts       TEXT NOT NULL DEFAULT '',
  tone        TEXT NOT NULL DEFAULT '',
  links       TEXT NOT NULL DEFAULT '',
  avoid_notes TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  price_php      INTEGER NOT NULL,
  active_slots   INTEGER NOT NULL DEFAULT 1,
  includes_video INTEGER NOT NULL DEFAULT 0,
  consult_hours  DOUBLE PRECISION NOT NULL DEFAULT 0,
  shoot_hours    DOUBLE PRECISION NOT NULL DEFAULT 0,
  includes_ads   INTEGER NOT NULL DEFAULT 0,
  priority_queue INTEGER NOT NULL DEFAULT 0,
  featured       INTEGER NOT NULL DEFAULT 0,
  tagline        TEXT NOT NULL DEFAULT '',
  description    TEXT NOT NULL DEFAULT '',
  sort_order     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS addon (
  id                SERIAL PRIMARY KEY,
  name              TEXT NOT NULL,
  price_php         INTEGER NOT NULL,
  bundled_price_php INTEGER NOT NULL,
  requires_plan     INTEGER NOT NULL DEFAULT 0,
  allowed_plans     TEXT NOT NULL DEFAULT '[]',
  description       TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS subscription (
  id                   SERIAL PRIMARY KEY,
  account_id           INTEGER NOT NULL UNIQUE REFERENCES account(id) ON DELETE CASCADE,
  plan_id              INTEGER REFERENCES plan(id),
  next_plan_id         INTEGER REFERENCES plan(id),
  status               TEXT NOT NULL DEFAULT 'draft',
  days_remaining       INTEGER NOT NULL DEFAULT 0,
  last_ticked_on       TIMESTAMPTZ,
  started_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  paused_at            TIMESTAMPTZ,
  expired_at           TIMESTAMPTZ,
  grace_until          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscription_addon (
  id              SERIAL PRIMARY KEY,
  subscription_id INTEGER NOT NULL REFERENCES subscription(id) ON DELETE CASCADE,
  addon_id        INTEGER NOT NULL REFERENCES addon(id),
  active          INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS payment (
  id               SERIAL PRIMARY KEY,
  account_id       INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  subscription_id  INTEGER REFERENCES subscription(id),
  amount_php       INTEGER NOT NULL,
  method           TEXT NOT NULL,
  reference_no     TEXT,
  proof_url        TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',
  verified_by      INTEGER,
  verified_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  days_granted     INTEGER NOT NULL DEFAULT 30,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_account ON payment(account_id);
CREATE INDEX IF NOT EXISTS idx_payment_status ON payment(status);

CREATE TABLE IF NOT EXISTS request_type (
  id              SERIAL PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  slot_consuming  INTEGER NOT NULL DEFAULT 1,
  brief_schema    TEXT NOT NULL DEFAULT '[]',
  sla_hours       INTEGER NOT NULL DEFAULT 48,
  available_rules TEXT NOT NULL DEFAULT '{}',
  sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS phase (
  id         SERIAL PRIMARY KEY,
  account_id INTEGER REFERENCES account(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_phase_account ON phase(account_id);

CREATE TABLE IF NOT EXISTS request (
  id                       SERIAL PRIMARY KEY,
  account_id               INTEGER REFERENCES account(id) ON DELETE CASCADE,
  request_type_id          INTEGER NOT NULL REFERENCES request_type(id),
  title                    TEXT NOT NULL,
  brief_answers            TEXT NOT NULL DEFAULT '{}',
  "column"               TEXT NOT NULL DEFAULT 'lineup',
  internal_status          TEXT,
  position                 INTEGER NOT NULL DEFAULT 0,
  phase_id                 INTEGER REFERENCES phase(id) ON DELETE SET NULL,
  revision_count           INTEGER NOT NULL DEFAULT 0,
  due_at                   TIMESTAMPTZ,
  target_completed_at      TIMESTAMPTZ,
  other_client_name        TEXT,
  other_client_email       TEXT,
  other_client_mobile      TEXT,
  other_client_viber       TEXT,
  approval_since           TIMESTAMPTZ,
  last_approval_reminder_at TIMESTAMPTZ,
  auto_approved            INTEGER NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_request_account ON request(account_id);
CREATE INDEX IF NOT EXISTS idx_request_column ON request("column");

CREATE TABLE IF NOT EXISTS subtask (
  id         SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES request(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subtask_request ON subtask(request_id);

CREATE TABLE IF NOT EXISTS deliverable (
  id             SERIAL PRIMARY KEY,
  request_id     INTEGER NOT NULL REFERENCES request(id) ON DELETE CASCADE,
  version        INTEGER NOT NULL DEFAULT 1,
  file_url       TEXT NOT NULL,
  uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  approval_state TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_deliverable_request ON deliverable(request_id);

CREATE TABLE IF NOT EXISTS comment (
  id            SERIAL PRIMARY KEY,
  request_id    INTEGER NOT NULL REFERENCES request(id) ON DELETE CASCADE,
  author_id     INTEGER NOT NULL REFERENCES "user"(id),
  body          TEXT NOT NULL,
  internal_only INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comment_request ON comment(request_id);

CREATE TABLE IF NOT EXISTS attachment (
  id          SERIAL PRIMARY KEY,
  request_id  INTEGER NOT NULL REFERENCES request(id) ON DELETE CASCADE,
  file_url    TEXT NOT NULL,
  uploaded_by INTEGER REFERENCES "user"(id),
  kind        TEXT NOT NULL DEFAULT 'reference',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attachment_request ON attachment(request_id);

CREATE TABLE IF NOT EXISTS entitlement_log (
  id            SERIAL PRIMARY KEY,
  account_id    INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,
  amount        DOUBLE PRECISION NOT NULL DEFAULT 0,
  note          TEXT NOT NULL DEFAULT '',
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  billing_month TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entitlement_account ON entitlement_log(account_id);

CREATE TABLE IF NOT EXISTS notification (
  id           SERIAL PRIMARY KEY,
  to_email     TEXT NOT NULL,
  to_name      TEXT NOT NULL DEFAULT '',
  subject      TEXT NOT NULL,
  body         TEXT NOT NULL DEFAULT '',
  kind         TEXT NOT NULL,
  related_type TEXT,
  related_id   INTEGER,
  status       TEXT NOT NULL DEFAULT 'sent',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_to ON notification(to_email);

CREATE TABLE IF NOT EXISTS ads_update (
  id              SERIAL PRIMARY KEY,
  subscription_id INTEGER NOT NULL REFERENCES subscription(id) ON DELETE CASCADE,
  month           TEXT NOT NULL,
  summary         TEXT NOT NULL DEFAULT '',
  notes           TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ads_sub ON ads_update(subscription_id);
`;

export { SCHEMA_PG };