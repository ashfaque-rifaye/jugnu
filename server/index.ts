// Jugnu on an ordinary long-running server (development, or any free-tier host that keeps a process
// alive): the API, the telephony WebSocket streams, plus the built web app in production.
// Serverless hosts (Vercel) run the API via api/[...all].ts but cannot hold the phone-call WebSocket.
import express from "express";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { watchAI } from "./ai/health";
import { app } from "./app";
import { claudeAvailable, MODEL } from "./claude";
import { storage } from "./db";
import { tick } from "./scheduler";
import { attachTelephony, telephonyStatus } from "./telephony";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "../dist");

if (process.env.NODE_ENV === "production" && fs.existsSync(dist)) {
  // The service worker and the shell must always revalidate so a new deploy reaches phones.
  app.get(["/sw.js", "/manifest.webmanifest"], (req, res) => res.set("Cache-Control", "no-cache").sendFile(path.join(dist, req.path)));
  app.use("/assets", express.static(path.join(dist, "assets"), { maxAge: "365d", immutable: true }));
  app.use(express.static(dist, { maxAge: "1d", index: false }));
  app.get(/^(?!\/api).*/, (_req, res) => res.set("Cache-Control", "no-cache").sendFile(path.join(dist, "index.html")));
}

const port = process.env.NODE_ENV === "production" ? Number(process.env.PORT || 8080) : Number(process.env.API_PORT || 8788);
const server = http.createServer(app);
attachTelephony(server);
// Jugnu's own clock: due follow-ups, reminders and escalations run once a minute.
// The phone server on Cloud Run shares this database and sleeps when idle, so it leaves the clock and the AI check to the main server.
const phoneServer = Boolean(process.env.K_SERVICE);
if (!phoneServer) setInterval(() => tick().catch((e) => console.error("scheduler tick failed", e)), 60_000).unref();
server.listen(port, () => {
  const t = telephonyStatus();
  const phone = t.active ? `${t.active} via ${t.publicUrl}` : "off (set TELEPHONY_PROVIDER + PUBLIC_URL)";
  console.log(
    `Jugnu API on http://localhost:${port} — Claude ${claudeAvailable() ? `key set (${MODEL})` : "no key (offline engine)"} · phone line ${phone} · data in ${storage() === "turso" ? "Turso" : "local SQLite"}`,
  );
  if (!phoneServer) watchAI();
});
