// Access control. The app is open to everyone, with no login; teachers join an interview with an
// unguessable link token; AI routes are rate-limited so a public link cannot burn the Claude credits.
// Only the separate phone server, a fixed public address that can place real calls, sets
// PHONE_SERVER_KEY, so strangers can't use its officer routes.
import type { NextFunction, Request, Response } from "express";

export function requireOfficer(req: Request, res: Response, next: NextFunction) {
  const key = process.env.PHONE_SERVER_KEY;
  if (!key || req.get("x-jugnu-key") === key) return next();
  res.status(401).json({ error: "Not allowed" });
}

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
