// Renders a film page to MP4, one exact frame at a time, and adds its score.
// Usage: node video/render.mjs intro [fromSeconds] [toSeconds]
import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const name = process.argv[2] ?? "intro";
const stills = process.argv[3] === "--stills";
const from = stills ? 0 : Number(process.argv[3] ?? 0);
const to = !stills && process.argv[4] ? Number(process.argv[4]) : null;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".woff": "font/woff", ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4" };

// A small static server (with byte ranges, so <video> can seek); public/ is served at the root as in the app.
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = [join(ROOT, path), join(ROOT, "public", path)].find((f) => existsSync(f) && statSync(f).isFile());
  if (!file) return res.writeHead(404).end();
  const size = statSync(file).size;
  const type = MIME[extname(file)] ?? "application/octet-stream";
  const m = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? "");
  if (m) {
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : size - 1;
    res.writeHead(206, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Range": `bytes ${a}-${b}/${size}`, "Content-Length": b - a + 1 });
    return createReadStream(file, { start: a, end: b }).pipe(res);
  }
  res.writeHead(200, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": size });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--autoplay-policy=no-user-gesture-required", "--force-color-profile=srgb", "--hide-scrollbars"] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
page.on("pageerror", (e) => console.error("page error:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
await page.goto(`http://127.0.0.1:${port}/video/${name}.html?render`, { waitUntil: "load" });
await page.waitForFunction("window.__ready === true", { timeout: 120000 });
const { duration, fps } = await page.evaluate(() => ({ duration: window.__duration, fps: window.__fps }));
const first = Math.floor(from * fps);
const last = Math.ceil((to ?? duration) * fps);

mkdirSync(join(ROOT, "video/out"), { recursive: true });

// node video/render.mjs intro --stills 1.5,3.2 writes single frames for checking the look.
if (process.argv[3] === "--stills") {
  for (const s of process.argv[4].split(",")) {
    await page.evaluate((f) => window.__frame(f), Math.round(Number(s) * fps));
    await page.screenshot({ path: join(ROOT, `video/out/${name}-${s}.png`) });
  }
  await browser.close();
  server.close();
  process.exit(0);
}

const silent = join(ROOT, `video/out/${name}.silent.mp4`);
const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", silent], { stdio: ["pipe", "inherit", "inherit"] });
const started = Date.now();
for (let i = first; i < last; i++) {
  await page.evaluate((f) => window.__frame(f), i);
  const png = await page.screenshot({ type: "png", optimizeForSpeed: true });
  if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
  if ((i - first) % 60 === 0) console.log(`frame ${i}/${last} (${((Date.now() - started) / 1000).toFixed(0)} s)`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
server.close();

// Add the score when this is a full render.
const wav = join(ROOT, `video/out/${name}.wav`);
if (from === 0 && to === null && existsSync(wav)) {
  const out = join(ROOT, `video/out/jugnu-${name}.mp4`);
  await new Promise((r) => spawn("ffmpeg", ["-v", "error", "-y", "-i", silent, "-i", wav, "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", out], { stdio: "inherit" }).on("close", r));
  console.log("wrote", out);
} else console.log("wrote", silent);
