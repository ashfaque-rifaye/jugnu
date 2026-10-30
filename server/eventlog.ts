// One way to write to a block's activity log, shared by the HTTP route (officers and CRPs in the
// console), the scheduler (Jugnu's own follow-ups) and the agent's write tools. Everything is
// validated the same way and free text never keeps phone or ID numbers.
import { z } from "zod";
import { cleanAndLog } from "./safety";
import { db, now } from "./db";

export const BlockKey = z.string().min(1).max(80);
export const EventKind = z.enum(["action", "spotcheck", "followup", "note", "weekly"]);
export type EventKind = z.infer<typeof EventKind>;

export const Payloads = {
  action: z.object({ status: z.enum(["todo", "scheduled", "submitted", "done", "stuck"]), from: z.string().max(20).optional(), note: z.string().max(500).optional() }),
  // A school's weekly report, filed by its point of contact.
  weekly: z.object({
    method: z.string().max(40).optional(),
    teachersUsing: z.number().int().min(0).max(60),
    childrenReached: z.number().int().min(0).max(3000),
    classes: z.array(z.number().int().min(1).max(5)).max(5),
    going: z.enum(["well", "mixed", "hard"]),
    note: z.string().max(500).optional(),
  }),
  spotcheck: z.object({ sampled: z.number().int().min(5).max(40), proficient: z.number().int().min(0), numeracyProficient: z.number().int().min(0) }),
  followup: z.object({
    outcome: z.enum(["adopted", "trying", "barrier", "no_answer"]),
    said: z.string().max(2000).optional(),
    saidEn: z.string().max(2000).optional(),
    summary: z.tuple([z.string().max(200), z.string().max(200)]).optional(),
    insight: z.tuple([z.string().max(300), z.string().max(300)]).optional(),
    barrier: z.string().max(120).optional(),
    barrierOwner: z.string().max(80).optional(),
  }),
  note: z.object({ text: z.string().min(1).max(1000) }),
} as const;

export class EventError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export interface WrittenEvent {
  id: number | null;
  created_at: string;
  payload: Record<string, unknown>;
}

/** Validate, scrub and store one event. Throws EventError (400) when the payload is not valid. */
export async function writeEvent(block: string, kind: EventKind, ref: string, payload: Record<string, unknown>, actor?: string | null): Promise<WrittenEvent> {
  const b = BlockKey.safeParse(block);
  if (!b.success) throw new EventError("block is required");
  if (!ref || ref.length > 80) throw new EventError("ref is required");
  const parsed = Payloads[kind].safeParse(payload);
  if (!parsed.success) throw new EventError(`Invalid ${kind}`);
  const p = parsed.data as Record<string, unknown>;
  if (kind === "spotcheck" && (Number(p.proficient) > Number(p.sampled) || Number(p.numeracyProficient) > Number(p.sampled)))
    throw new EventError("More children passed than were checked");
  for (const k of ["note", "said", "saidEn", "text"]) if (typeof p[k] === "string") p[k] = cleanAndLog(p[k] as string, kind);
  const created = now();
  await db.run(`INSERT INTO events (block, kind, ref, payload, actor, created_at) VALUES (?, ?, ?, ?, ?, ?)`, b.data, kind, ref, JSON.stringify(p), actor?.slice(0, 80) ?? null, created);
  const row = await db.get<{ id: number }>(`SELECT MAX(id) id FROM events WHERE block = ?`, b.data);
  return { id: row?.id ?? null, created_at: created, payload: p };
}
