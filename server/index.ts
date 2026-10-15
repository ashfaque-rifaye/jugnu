// Jugnu on an ordinary server (development, or one long-running host such as Railway): the API,
// plus the built web app in production.
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "./app";
import { claudeAvailable, MODEL } from "./claude";
import { storage } from "./db";
import { ivrConfigured } from "./ivr";

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
app.listen(port, () =>
  console.log(
    `Jugnu API on http://localhost:${port} — Claude ${claudeAvailable() ? `connected (${MODEL})` : "not connected (offline engine)"} · phone line ${ivrConfigured() ? "on" : "simulator only"} · data in ${storage() === "turso" ? "Turso" : "local SQLite"}`,
  ),
);
