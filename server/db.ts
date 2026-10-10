// System of record for the live pilot: interviews (web + phone), transcripts, AI codings, the
// human review queue, user-testing sessions/feedback, and a trace of every AI call.
// node:sqlite ships with Node ≥ 22.13 — no native build step, works on Railway and Windows.
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DB_PATH = process.env.JUGNU_DB || path.resolve("data/runtime/jugnu.db");
if (DB_PATH !== ":memory:") fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS interviews (
  id           TEXT PRIMARY KEY,
  token        TEXT NOT NULL UNIQUE,
  school_name  TEXT,
  teacher_name TEXT,
  grp          TEXT NOT NULL DEFAULT 'live',      -- bright | comparison | live
  channel      TEXT NOT NULL,                     -- web | phone | phone-sim
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
`);

export const now = () => new Date().toISOString();

export function json<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
