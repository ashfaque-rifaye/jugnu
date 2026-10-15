// Work that may finish after the response has been sent (e.g. coding a finished interview while the
// teacher already hears the thank-you). On Vercel the function is kept alive for it via waitUntil;
// on an ordinary server it simply keeps running.
import { waitUntil } from "@vercel/functions";

export function later(work: Promise<unknown>) {
  const safe = work.catch((error) => console.error("Background task failed:", error));
  waitUntil(safe);
}
