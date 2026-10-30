// Things a block office can take away without learning Jugnu: the plan board as a spreadsheet (opens in
// Excel or Google Sheets, Hindi intact) and a calendar invite for each peer visit. Both read the same
// state the console shows: the block's plan with every action event from the shared log applied.
import express from "express";
import { z } from "zod";
import { PRACTICES } from "../src/engine/practices";
import type { Action } from "../src/engine/types";
import { requireOfficer } from "./auth";
import { pipelineFor } from "./blocks";
import { db, json } from "./db";

export const exportsRouter = express.Router();
exportsRouter.use(requireOfficer);

const Query = z.object({ block: z.string().regex(/^seed:\d{1,9}$/, "Only blocks Jugnu generates can be exported here"), track: z.enum(["0", "1"]).optional() });

/** Latest status and note per action ref, from the block's log. */
async function actionState(block: string): Promise<Map<string, { status: Action["status"]; note?: string; at: string; actor: string | null }>> {
  const rows = await db.all<{ ref: string; payload: string; actor: string | null; created_at: string }>(
    `SELECT ref, payload, actor, created_at FROM events WHERE block = ? AND kind = 'action' ORDER BY id`,
    block,
  );
  const out = new Map<string, { status: Action["status"]; note?: string; at: string; actor: string | null }>();
  for (const r of rows) {
    const p = json(r.payload, {}) as { status?: Action["status"]; note?: string };
    if (p.status) out.set(r.ref, { status: p.status, note: p.note, at: r.created_at, actor: r.actor });
  }
  return out;
}

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function actionsCsv(block: string, track: boolean): Promise<string> {
  const st = pipelineFor({ seed: Number(block.slice(5)), track });
  const byId = new Map(st.block.schools.map((s) => [s.id, s]));
  const live = await actionState(block);
  const head = ["School", "UDISE", "Cluster", "CRP", "Teacher", "Method", "तरीका", "Group", "Step", "Owner", "Status", "Due (day)", "Teacher who can show it (school)", "Distance (km)", "Note", "Last update", "Updated by"];
  const lines = [head.map(cell).join(",")];
  for (const r of st.recs) {
    const s = byId.get(r.schoolId)!;
    const demo = byId.get(r.demonstratorId);
    for (const a of r.actions) {
      const now = live.get(a.id);
      lines.push(
        [s.name, s.udise ?? "", s.clusterName, s.crp, s.teacher, PRACTICES[r.practice].label, PRACTICES[r.practice].labelHi, r.wave, a.id.split("-").pop(), a.owner, now?.status ?? a.status, a.due, demo?.name ?? "", r.distanceKm, now?.note ?? a.note ?? "", now?.at ?? "", now?.actor ?? ""]
          .map(cell)
          .join(","),
      );
    }
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n"; // BOM so Excel reads UTF-8 (Devanagari)
}

const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** A calendar invite for one school's peer visit: the CRP takes the teacher to the demonstrator. */
export function visitIcs(block: string, schoolId: string, start: Date, track = false): string | null {
  const st = pipelineFor({ seed: Number(block.slice(5)), track });
  const rec = st.recs.find((r) => r.schoolId === schoolId);
  if (!rec) return null;
  const s = st.block.schools.find((x) => x.id === schoolId)!;
  const demo = st.block.schools.find((x) => x.id === rec.demonstratorId)!;
  const end = new Date(start.getTime() + 3 * 3_600_000);
  const practice = PRACTICES[rec.practice];
  const where = demo.lat != null && demo.lon != null ? `${demo.name} (${demo.lat.toFixed(5)}, ${demo.lon.toFixed(5)})` : demo.name;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Jugnu//Peer visit//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${block}-${schoolId}-visit@jugnu`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(`Peer visit: ${s.teacher} (${s.name}) watches ${demo.teacher} at ${demo.name}`)}`,
    `LOCATION:${icsText(where)}`,
    ...(demo.lat != null && demo.lon != null ? [`GEO:${demo.lat.toFixed(6)};${demo.lon.toFixed(6)}`] : []),
    `DESCRIPTION:${icsText(`${practice.label} / ${practice.labelHi}\n${practice.what}\nAbout ${rec.distanceKm} km. CRP: ${s.crp}. Mark the visit done or stuck in Jugnu afterwards.`)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT12H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(`Tomorrow: peer visit to ${demo.name}`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

exportsRouter.get("/actions.csv", async (req, res) => {
  const q = Query.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: q.error.issues[0]?.message ?? "block is required" });
  const csv = await actionsCsv(q.data.block, q.data.track === "1");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="jugnu-plan-${q.data.block.slice(5)}.csv"`);
  res.send(csv);
});

exportsRouter.get("/visit.ics", (req, res) => {
  const q = Query.extend({ school: z.string().max(40), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "block and school are required" });
  // Default: a week from today, 10:00 IST (04:30 UTC).
  const day = q.data.date ? new Date(`${q.data.date}T04:30:00Z`) : new Date(new Date().toISOString().slice(0, 10) + "T04:30:00Z");
  if (!q.data.date) day.setUTCDate(day.getUTCDate() + 7);
  const ics = visitIcs(q.data.block, q.data.school, day, q.data.track === "1");
  if (!ics) return res.status(404).json({ error: "That school has no peer visit in the plan" });
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="jugnu-visit-${q.data.school}.ics"`);
  res.send(ics);
});
