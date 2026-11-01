// Renders the demo film from the edit (edit.json, beside the takes).
//   node demo/render.mjs                    the demo itself, to body.mp4 beside the takes
//   node demo/render.mjs --stills 3,20.5    single frames, still-<t>.jpg beside the takes
//   node demo/render.mjs --from 30 --to 45  a stretch, for checking motion
import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TAKES = process.env.DEMO_TAKES ?? "E:/jugnu-takes";
const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i > 0 ? process.argv[i + 1] : null;
};
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".woff": "font/woff" };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.startsWith("/takes/") ? join(TAKES, path.slice(7)) : join(ROOT, path);
  if (!existsSync(file) || !statSync(file).isFile()) return res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream", "Content-Length": statSync(file).size });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/video/demo.html`;

let browser;
let page;
async function open() {
  await browser?.close();
  browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", userDataDir: join(TAKES, ".chrome-render"), protocolTimeout: 600000, defaultViewport: { width: 1920, height: 1080 }, args: ["--hide-scrollbars", "--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  page = await browser.newPage();
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction("window.__ready === true", { timeout: 120000 });
}
await open();
const { duration, fps } = await page.evaluate(() => ({ duration: window.__duration, fps: window.__fps }));

const stills = arg("--stills");
if (stills) {
  for (const s of stills.split(",")) {
    const b64 = await page.evaluate((i) => window.__frame(i), Math.round(Number(s) * fps));
    writeFileSync(join(TAKES, `still-${s}.jpg`), Buffer.from(b64, "base64"));
  }
  await browser.close();
  server.close();
  process.exit(0);
}

mkdirSync(join(ROOT, "video/out"), { recursive: true });
const from = Number(arg("--from") ?? 0);
const to = Number(arg("--to") ?? duration);
const partial = !!(arg("--from") || arg("--to"));
const silent = join(TAKES, partial ? "part.mp4" : "body.silent.mp4");
const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(fps), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", silent], { stdio: ["pipe", "inherit", "inherit"] });
const first = Math.round(from * fps);
const last = Math.round(to * fps);
const t0 = Date.now();
for (let i = first; i < last; i++) {
  if ((i - first) % 1500 === 1499) await open(); // a fresh browser now and then keeps memory steady
  const b64 = await page.evaluate((n) => window.__frame(n), i);
  if (!ff.stdin.write(Buffer.from(b64, "base64"))) await new Promise((r) => ff.stdin.once("drain", r));
  if ((i - first) % 300 === 0) console.log(`frame ${i}/${last} (${Math.round((Date.now() - t0) / 1000)} s)`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
server.close();
const mix = join(TAKES, "mix.wav");
const out = join(TAKES, partial ? "part-sound.mp4" : "body.mp4"); // demo/assemble.mjs adds the intro and outro
await new Promise((r) => {
  const args = ["-v", "error", "-y", "-i", silent];
  if (partial) args.push("-ss", String(from), "-t", String(to - from));
  args.push("-i", mix, "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", out);
  spawn("ffmpeg", args, { stdio: "inherit" }).on("close", r);
});
console.log("wrote", out, `${Math.round((Date.now() - t0) / 1000)} s`);
