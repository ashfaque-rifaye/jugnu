// System of record for the live pilot: interviews (web + phone), transcripts, AI codings, the
// human review queue, user-testing sessions/feedback, and a trace of every AI call.
// It is SQLite either way: a local file through node:sqlite (development, tests, one long-running
// server such as Railway), or Turso — SQLite over HTTPS — when TURSO_DATABASE_URL is set (Vercel,
// where a function's disk does not survive). Every call is async so both behave the same.
import fs from "node:fs";
import path from "node:path";
import type { Client, ResultSet } from "@libsql/client/web";

export type Arg = string | number | null;
export interface Stmt {
  sql: string;
  args?: Arg[];
}

type Row = Record<string, unknown>;

export interface Store {
  all<T = Row>(sql: string, ...args: Arg[]): Promise<T[]>;
  get<T = Row>(sql: string, ...args: Arg[]): Promise<T | undefined>;
  run(sql: string, ...args: Arg[]): Promise<void>;
  /** Several writes in one transaction — one round trip on Turso. */
  batch(stmts: Stmt[]): Promise<void>;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS interviews (
  id           TEXT PRIMARY KEY,
  token        TEXT NOT NULL UNIQUE,
  school_name  TEXT,
  teacher_name TEXT,
  grp          TEXT NOT NULL DEFAULT 'live',      -- bright | comparison | live
  channel      TEXT NOT NULL,                     -- web | phone (real Exotel/Plivo call)
  language     TEXT NOT NULL DEFAULT 'hi',
  consent      INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'invited',   -- invited | in_progress | completed | declined
  phone_hash   TEXT,
  call_sid     TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS turns (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  interview_id TEXT NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  idx          INTEGER NOT NULL,
  speaker      TEXT NOT NULL,                     -- jugnu | teacher
  text         TEXT NOT NULL,
  text_en      TEXT,
  kind         TEXT,                              -- consent | question | follow_up | clarify | closing | answer
  topic        TEXT,
  source       TEXT,                              -- claude | offline | asr | typed
  confidence   REAL,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS turns_by_interview ON turns(interview_id, idx);

CREATE TABLE IF NOT EXISTS codings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  interview_id TEXT NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  practice     TEXT,
  new_name     TEXT,
  quote        TEXT NOT NULL,
  specificity  INTEGER NOT NULL,
  grounded     INTEGER NOT NULL,
  coder        TEXT NOT NULL,                     -- claude | offline
  note         TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS codings_by_interview ON codings(interview_id);

CREATE TABLE IF NOT EXISTS reviews (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL,                     -- practice_card | voice_note | barrier
  ref          TEXT,
  payload      TEXT NOT NULL,
  checks       TEXT NOT NULL DEFAULT '[]',
  status       TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected
  reviewer     TEXT,
  note         TEXT,
  created_at   TEXT NOT NULL,
  decided_at   TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,
  role         TEXT NOT NULL,                     -- teacher | crp | beo | other
  place        TEXT,
  device       TEXT,
  consent      INTEGER NOT NULL DEFAULT 0,
  sus          TEXT,
  created_at   TEXT NOT NULL,
  ended_at     TEXT
);

CREATE TABLE IF NOT EXISTS feedback (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT,
  role         TEXT,
  page         TEXT,
  kind         TEXT NOT NULL,                     -- rating | comment | task | bug
  task         TEXT,
  rating       INTEGER,
  text         TEXT,
  lang         TEXT,
  created_at   TEXT NOT NULL
);

-- What people did in the console: action status changes, spot checks, follow-up calls, notes.
-- The block's state is the simulated (or imported) baseline with these events applied in order.
CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  block        TEXT NOT NULL,                     -- e.g. seed:2024
  kind         TEXT NOT NULL,                     -- action | spotcheck | followup | note
  ref          TEXT NOT NULL,                     -- action id or school id
  payload      TEXT NOT NULL,
  actor        TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_by_block ON events(block, id);

CREATE TABLE IF NOT EXISTS ai_calls (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  task          TEXT NOT NULL,
  ref           TEXT,
  source        TEXT NOT NULL,                    -- claude | offline
  model         TEXT,
  latency_ms    INTEGER,
  input_tokens  INTEGER,
  output_tokens INTEGER,
  checks        TEXT NOT NULL DEFAULT '[]',
  ok            INTEGER NOT NULL,
  error         TEXT,
  created_at    TEXT NOT NULL
);
`;

/** turso: lasting · sqlite: a local file that lasts · temporary: Vercel without Turso — lost on restart. */
/** Columns added after the first deploy: applied once, ignored if they already exist. */
const MIGRATIONS = [
  `ALTER TABLE interviews ADD COLUMN school_id TEXT`,
  `ALTER TABLE interviews ADD COLUMN call_status TEXT`, // dialing | in-call | completed | busy | no-answer | failed …
];

export const storage = (): "turso" | "sqlite" | "temporary" =>
  process.env.TURSO_DATABASE_URL ? "turso" : process.env.VERCEL && !process.env.JUGNU_DB ? "temporary" : "sqlite";

async function openSqlite(): Promise<Store> {
  const { DatabaseSync } = await import("node:sqlite");
  const file = process.env.JUGNU_DB || (storage() === "temporary" ? "/tmp/jugnu.db" : path.resolve("data/runtime/jugnu.db"));
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const d = new DatabaseSync(file);
  d.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  d.exec(SCHEMA);
  for (const m of MIGRATIONS)
    try {
      d.exec(m);
    } catch {
      /* already applied */
    }
  return {
    all: async (sql, ...args) => d.prepare(sql).all(...args) as never,
    get: async (sql, ...args) => d.prepare(sql).get(...args) as never,
    run: async (sql, ...args) => {
      d.prepare(sql).run(...args);
    },
    batch: async (stmts) => {
      d.exec("BEGIN");
      try {
        for (const s of stmts) d.prepare(s.sql).run(...(s.args ?? []));
        d.exec("COMMIT");
      } catch (error) {
        d.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

async function openTurso(): Promise<Store> {
  const { createClient } = await import("@libsql/client/web");
  return libsqlStore(createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN }));
}

/** The Turso adapter, for any libSQL client: HTTPS in production, a local libSQL file in the tests. */
export async function libsqlStore(c: Pick<Client, "execute" | "batch" | "executeMultiple">): Promise<Store> {
  await c.executeMultiple(SCHEMA);
  for (const m of MIGRATIONS) await c.execute(m).catch(() => undefined); // already applied
  const objects = (rs: ResultSet) => rs.rows.map((r) => Object.fromEntries(rs.columns.map((col, i) => [col, r[i]])));
  return {
    all: async (sql, ...args) => objects(await c.execute({ sql, args })) as never,
    get: async (sql, ...args) => objects(await c.execute({ sql, args }))[0] as never,
    run: async (sql, ...args) => {
      await c.execute({ sql, args });
    },
    batch: async (stmts) => {
      await c.batch(stmts.map((s) => ({ sql: s.sql, args: s.args ?? [] })), "write");
    },
  };
}

let opening: Promise<Store> | null = null;
const store = () =>
  (opening ??= (storage() === "turso" ? openTurso() : openSqlite()).catch((error) => {
    opening = null; // try again on the next request
    throw error;
  }));

/** Tests: run everything against the given store. */
export function useStore(s: Store) {
  opening = Promise.resolve(s);
}

export const db: Store = {
  all: async (sql, ...args) => (await store()).all(sql, ...args),
  get: async (sql, ...args) => (await store()).get(sql, ...args),
  run: async (sql, ...args) => (await store()).run(sql, ...args),
  batch: async (stmts) => (stmts.length ? (await store()).batch(stmts) : undefined),
};

export const now = () => new Date().toISOString();

export function json<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
