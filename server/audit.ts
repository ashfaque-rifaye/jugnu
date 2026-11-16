// The audit log: who came into Jugnu (as which role, on what device, from which city), which pages they
// used and for how long, what they changed, and how much they leaned on Jugnu's AI, voice and calls.
// No names, phone numbers or IP addresses are kept: a visit is a random id, a place is a city.
import express from "express";
import { z } from "zod";
import { rateLimit } from "./auth";
import { db, now } from "./db";

export const audit = express.Router();

const Kind = z.enum(["page", "role", "change", "ai", "voice", "call", "action"]);
const Track = z.object({
  visit: z.object({
    id: z.string().min(8).max(64),
    role: z.string().max(20).nullable().optional(),
    name: z.string().max(80).nullable().optional(),
    lang: z.string().max(5).optional(),
    entry: z.string().max(120).optional(),
    referrer: z.string().max(200).optional(),
    screen: z.string().max(20).optional(),
  }),
  events: z
    .array(z.object({ at: z.string().max(40), kind: Kind, name: z.string().min(1).max(80), detail: z.string().max(200).optional(), ms: z.number().int().min(0).max(86_400_000).optional() }))
    .max(60),
});

/** Phone or laptop, which browser, which system: from the browser's own description of itself. */
export function describeDevice(ua: string, screen?: string) {
  const width = Number(screen?.split("x")[0]) || 0;
  const tablet = /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  const device = tablet ? "Tablet" : /Mobi|iPhone|Android/i.test(ua) || (width && width < 700) ? "Phone" : "Laptop";
  const browser = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Other";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad|iOS/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Other";
  const bot = /HeadlessChrome|Playwright|Puppeteer|bot\b|crawler|spider|curl|node-fetch|undici|Lighthouse/i.test(ua);
  return { device, browser, os, bot };
}

const header = (req: express.Request, name: string) => {
  const v = req.get(name);
  if (!v) return null;
  try {
    return decodeURIComponent(v).slice(0, 60);
  } catch {
    return v.slice(0, 60);
  }
};

audit.post("/track", rateLimit("audit", 240, 600000), async (req, res) => {
  // sendBeacon may send the JSON as plain text
  const raw = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
  const body = Track.safeParse(raw);
  if (!body.success) return res.status(400).json({ error: "visit and events are required" });
  const { visit, events } = body.data;
  const d = describeDevice(String(req.get("user-agent") ?? ""), visit.screen);
  const t = now();
  const count = (k: string) => events.filter((e) => e.kind === k && e.detail !== "again").length;
  const active = events.filter((e) => e.kind === "page").reduce((a, e) => a + (e.ms ?? 0), 0);
  await db.batch([
    {
      sql: `INSERT INTO visits (id, started_at, last_at, role, name, device, browser, os, city, region, country, lang, entry, referrer, bot, pages, actions, changes, active_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0)
            ON CONFLICT(id) DO NOTHING`,
      args: [visit.id, t, t, visit.role ?? null, visit.name ?? null, d.device, d.browser, d.os, header(req, "x-vercel-ip-city"), header(req, "x-vercel-ip-country-region"), header(req, "x-vercel-ip-country"), visit.lang ?? null, visit.entry ?? null, visit.referrer || null, d.bot ? 1 : 0],
    },
    {
      sql: `UPDATE visits SET last_at = ?, role = COALESCE(?, role), name = COALESCE(?, name), lang = COALESCE(?, lang),
              pages = pages + ?, changes = changes + ?, actions = actions + ?, active_ms = active_ms + ? WHERE id = ?`,
      args: [t, visit.role ?? null, visit.name ?? null, visit.lang ?? null, count("page"), count("change"), events.filter((e) => e.kind !== "page").length, active, visit.id],
    },
    ...events.map((e) => ({
      sql: `INSERT INTO visit_events (visit_id, at, kind, name, detail, ms) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [visit.id, e.at, e.kind, e.name, e.detail ?? null, e.ms ?? null],
    })),
  ]);
  res.json({ ok: true });
});

interface VisitRow {
  id: string;
  started_at: string;
  last_at: string;
  role: string | null;
  name: string | null;
  device: string;
  browser: string;
  os: string;
  city: string | null;
  region: string | null;
  country: string | null;
  lang: string | null;
  entry: string | null;
  bot: number;
  pages: number;
  actions: number;
  changes: number;
  active_ms: number;
}

/** Everything the Audit page shows, for the last `days` days. */
audit.get("/", rateLimit("read", 240, 60000), async (req, res) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
  const bots = req.query.bots === "1";
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const visits = await db.all<VisitRow>(`SELECT * FROM visits WHERE last_at >= ? ${bots ? "" : "AND bot = 0"} ORDER BY last_at DESC LIMIT 2000`, since);
  const ids = new Set(visits.map((v) => v.id));
  const events = (
    await db.all<{ visit_id: string; at: string; kind: string; name: string; detail: string | null; ms: number | null }>(
      `SELECT visit_id, at, kind, name, detail, ms FROM visit_events WHERE at >= ? ORDER BY id DESC LIMIT 20000`,
      since,
    )
  ).filter((e) => ids.has(e.visit_id));

  const tally = (xs: (string | null | undefined)[]) => {
    const m = new Map<string, number>();
    for (const x of xs) if (x) m.set(x, (m.get(x) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n }));
  };
  // Days and hours in India time, which is where the people using it are.
  const ist = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3_600_000);
  const byDay = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) byDay.set(ist(new Date(Date.now() - i * 86_400_000).toISOString()).toISOString().slice(0, 10), 0);
  for (const v of visits) {
    const k = ist(v.started_at).toISOString().slice(0, 10);
    if (byDay.has(k)) byDay.set(k, byDay.get(k)! + 1);
  }
  const byHour = Array.from({ length: 24 }, () => 0);
  for (const e of events) byHour[ist(e.at).getUTCHours()]++;

  const pageEvents = events.filter((e) => e.kind === "page");
  const views = pageEvents.filter((e) => e.detail !== "again");
  const pages = new Map<string, { n: number; ms: number }>();
  for (const e of pageEvents) {
    const p = pages.get(e.name) ?? { n: 0, ms: 0 };
    if (e.detail !== "again") p.n++;
    p.ms += e.ms ?? 0;
    pages.set(e.name, p);
  }
  const withRole = visits.filter((v) => v.role);
  const timed = visits.filter((v) => v.active_ms > 0);
  const kinds = (k: string) => events.filter((e) => e.kind === k);
  const perVisit = new Map<string, typeof events>();
  for (const e of events) {
    const list = perVisit.get(e.visit_id) ?? [];
    if (list.length < 80) list.push(e);
    perVisit.set(e.visit_id, list);
  }

  res.json({
    days,
    summary: {
      visits: visits.length,
      signedIn: withRole.length,
      changes: kinds("change").length,
      // only what people asked for: the page guide and status reasons come by themselves
      ai: kinds("ai").filter((e) => e.name === "Asked Jugnu" || e.name === "Morning brief").length,
      voice: kinds("voice").length,
      calls: kinds("call").length,
      pages: views.length,
      avgMinutes: timed.length ? Math.round(timed.reduce((a, v) => a + v.active_ms, 0) / timed.length / 6000) / 10 : 0,
      liveNow: visits.filter((v) => Date.now() - new Date(v.last_at).getTime() < 3 * 60_000).length,
    },
    byDay: [...byDay].map(([day, n]) => ({ day, n })),
    byHour,
    pages: [...pages].map(([name, p]) => ({ name, n: p.n, avgSec: p.n ? Math.round(p.ms / p.n / 1000) : 0 })).sort((a, b) => b.n - a.n).slice(0, 12),
    roles: tally(visits.map((v) => v.role ?? "No role chosen")),
    devices: tally(visits.map((v) => v.device)),
    browsers: tally(visits.map((v) => v.browser)),
    places: tally(visits.map((v) => [v.city, v.region, v.country].filter(Boolean).join(", ") || null)).slice(0, 10),
    languages: tally(visits.map((v) => (v.lang === "hi" ? "Hindi" : v.lang === "en" ? "English" : null))),
    features: tally(events.filter((e) => e.kind !== "page" && e.kind !== "role").map((e) => `${e.kind}:${e.name}`)).slice(0, 14),
    visits: visits.slice(0, 60).map((v) => ({ ...v, place: [v.city, v.region, v.country].filter(Boolean).join(", ") || null, events: (perVisit.get(v.id) ?? []).slice().reverse() })),
  });
});
