// Access control. The app is open to everyone, with no login or passcode; teachers join an interview
// with an unguessable link token; AI routes are rate-limited so a public link cannot burn the Claude
// credits; and a call can only ring the demo phones (CALL_ONLY_TO), never a stranger.
import type { NextFunction, Request, Response } from "express";

const hits = new Map<string, number[]>();

/** At most `max` requests per `windowMs` per client IP (and route key). */
export function rateLimit(key: string, max: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = `${key}:${req.ip}`;
    const t = Date.now();
    const list = (hits.get(id) ?? []).filter((x) => t - x < windowMs);
    if (list.length >= max) return res.status(429).json({ error: "Too many requests — please wait a minute." });
    list.push(t);
    hits.set(id, list);
    next();
  };
}
