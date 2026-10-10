// Access control for a public demo: the officer console needs a passcode (DEMO_PASSCODE) when one
// is set; teachers join an interview with an unguessable link token; AI routes are rate-limited
// so a public link cannot burn the Claude credits.
import type { NextFunction, Request, Response } from "express";

export const passcodeRequired = () => Boolean(process.env.DEMO_PASSCODE);

export function requireOfficer(req: Request, res: Response, next: NextFunction) {
  const pass = process.env.DEMO_PASSCODE;
  if (!pass || req.get("x-jugnu-pass") === pass) return next();
  res.status(401).json({ error: "Passcode required", passcode: true });
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
