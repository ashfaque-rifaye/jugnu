// Records a take of the real app for the demo film: the real agent, the real microphone pipeline fed
// with a recorded voice, in light mode, at double resolution so the edit can zoom in without blur.
// Writes demo/takes/<name>/ : frames/*.jpg, frames.json (time of each frame), audio.webm, events.json.
//   node demo/capture.mjs <scenario> [--probe]
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.DEMO_BASE ?? "http://localhost:5190";
const W = 1600;
const H = 900;
// 1.5x keeps zooms sharp in a 1080p film without exhausting a busy computer's memory.
const SCALE = Number(process.env.DEMO_SCALE ?? 1.5);
const scenarioName = process.argv[2] ?? "probe";
const probe = process.argv.includes("--probe");
const { scenarios } = await import("./scenarios.mjs");
const scenario = scenarios[scenarioName];
if (!scenario) throw new Error(`No scenario ${scenarioName}: ${Object.keys(scenarios).join(", ")}`);

const TAKES = process.env.DEMO_TAKES ?? "E:/jugnu-takes"; // outside the project: the dev server watches everything inside
const out = join(TAKES, scenarioName);
mkdirSync(join(out, "frames"), { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  userDataDir: join(TAKES, ".chrome"),
  defaultViewport: { width: W, height: H, deviceScaleFactor: SCALE },
  protocolTimeout: 120000,
  args: ["--autoplay-policy=no-user-gesture-required", "--hide-scrollbars", "--use-angle=d3d11", "--enable-gpu-rasterization", "--ignore-gpu-blocklist", "--window-size=1600,900", "--disable-features=Translate"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
// Anything stuck on the network is printed with the log, since a stuck page ruins a take.
const open = new Map();
page.on("request", (r) => open.set(r, Date.now()));
page.on("requestfinished", (r) => open.delete(r));
page.on("requestfailed", (r) => {
  if (!r.url().includes("googleapis")) console.log("request failed", r.url().slice(0, 110), r.failure()?.errorText);
  open.delete(r);
});
const hung = () => [...open.entries()].filter(([, t]) => Date.now() - t > 4000).map(([r, t]) => `${r.url().replace(BASE, "").slice(0, 60)} ${Math.round((Date.now() - t) / 1000)}s`);

// Runs in the page before the app: settings, the microphone and speaker taps, the cursor and the action log.
await page.evaluateOnNewDocument(
  (theme) => {
    localStorage.setItem("jugnu-role", JSON.stringify({ kind: "beo" }));
    localStorage.setItem(theme, "light");
    localStorage.setItem("jugnu-guide", "off");
    localStorage.setItem("jugnu-voice", "Kore");
    localStorage.setItem("jugnu-welcomed", "1");
    window.__events = [];
    const note = (kind, data) => window.__events.push({ kind, at: Date.now(), ...data });

    // One AudioContext is the app's; keep hold of it, so the "microphone" can be fed and the speaker heard.
    const Real = window.AudioContext;
    window.AudioContext = class extends Real {
      constructor(...a) {
        super(...a);
        window.__ctx = this;
        this.__tap = this.createMediaStreamDestination();
        this.__mic = this.createMediaStreamDestination();
        // The film's sound starts with the app's audio, and must be the same context the app plays through.
        window.__startTape(this);
      }
    };
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (dest instanceof AudioDestinationNode && dest.context.__tap) connect.call(this, dest.context.__tap);
      return connect.call(this, dest, ...rest);
    };
    // A copy each time: the app stops its tracks when a voice session ends.
    navigator.mediaDevices.getUserMedia = async () => window.__ctx.__mic.stream.clone();
    // Plays a recorded line into the microphone. The app hears it as speech, and the film hears it too.
    window.__speak = async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const buf = await window.__ctx.decodeAudioData(bytes.buffer);
      const src = window.__ctx.createBufferSource();
      src.__mine = true;
      src.buffer = buf;
      src.connect(window.__ctx.__mic);
      connect.call(src, window.__ctx.__tap);
      note("speak", { ms: buf.duration * 1000 });
      src.start();
      return buf.duration * 1000;
    };
    // The app's voice replies, so the edit knows when someone is speaking.
    const startPlay = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a) {
      if (this.context === window.__ctx && !this.__mine) note("play", { ms: (this.buffer?.duration ?? 0) * 1000 });
      return startPlay.apply(this, a);
    };
    window.__startTape = (ctx) => {
      const rec = new MediaRecorder(ctx.__tap.stream, { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 192000 });
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.start(1000);
      window.__tapStarted = Date.now();
      window.__stopTape = () =>
        new Promise((res) => {
          rec.onstop = async () => {
            const b = new Uint8Array(await new Blob(chunks).arrayBuffer());
            let s = "";
            for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
            res(btoa(s));
          };
          rec.stop();
        });
    };

    addEventListener("DOMContentLoaded", () => {
      // A smooth pointer, since a screen capture shows none. Real moves, so real hover states fire.
      const c = document.createElement("div");
      c.id = "__cursor";
      c.innerHTML = `<svg width="30" height="30" viewBox="0 0 24 24" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))"><path d="M4 2 L4 19 L8.6 14.8 L11.6 21.6 L14.4 20.4 L11.4 13.8 L18 13.6 Z" fill="#111827" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
      c.style.cssText = "position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-60px,-60px);transition:scale .12s";
      document.documentElement.append(c);
      addEventListener("mousemove", (e) => (c.style.transform = `translate(${e.clientX - 4}px,${e.clientY - 2}px)`), true);
      addEventListener(
        "mousedown",
        (e) => {
          c.style.scale = ".8";
          const r = document.createElement("div");
          r.style.cssText = `position:fixed;left:${e.clientX - 22}px;top:${e.clientY - 22}px;width:44px;height:44px;border-radius:50%;background:rgba(245,165,36,.35);z-index:2147483646;pointer-events:none;transition:transform .45s ease-out,opacity .45s ease-out`;
          document.documentElement.append(r);
          r.getBoundingClientRect();
          r.style.transform = "scale(1.8)";
          r.style.opacity = "0";
          setTimeout(() => r.remove(), 500);
        },
        true,
      );
      addEventListener("mouseup", () => (c.style.scale = "1"), true);
      // Everything the agent lights up is logged, so the edit can zoom in on it.
      new MutationObserver((list) => {
        for (const m of list)
          for (const n of m.addedNodes) {
            if (n.nodeType === 1 && n.hasAttribute("data-agent") && n.style?.border?.includes("2px")) {
              note("light", { x: parseFloat(n.style.left), y: parseFloat(n.style.top), w: parseFloat(n.style.width), h: parseFloat(n.style.height) });
            }
          }
      }).observe(document.body, { childList: true });
    });
  },
  "jugnu-mode",
);

// ---------------------------------------------------------------- the screen

const cdp = await page.createCDPSession();
const frames = [];
let frameNo = 0;
let filming = false;
cdp.on("Page.screencastFrame", async (f) => {
  cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  if (!filming) return;
  const file = `${String(frameNo++).padStart(6, "0")}.jpg`;
  writeFileSync(join(out, "frames", file), Buffer.from(f.data, "base64"));
  frames.push({ file, at: Math.round(f.metadata.timestamp * 1000) });
});

// ---------------------------------------------------------------- what a take can do

let mouse = { x: W / 2, y: H / 2 };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
async function glide(x, y, ms = 750) {
  const from = { ...mouse };
  const steps = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const k = ease(i / steps);
    await page.mouse.move(from.x + (x - from.x) * k, from.y + (y - from.y) * k);
    await wait(ms / steps);
  }
  mouse = { x, y };
}
const events = [];
const log = (kind, data = {}) => {
  events.push({ kind, at: Date.now(), ...data });
  const stuck = hung();
  console.log(`${((Date.now() - started) / 1000).toFixed(1).padStart(6)}s ${kind} ${JSON.stringify(data).slice(0, 160)}${stuck.length ? ` STUCK ${stuck.length}: ${stuck.slice(0, 4).join(" | ")}` : ""}`);
};
const rectOf = (selector, text) =>
  page.evaluate(
    (s, t) => {
      const seen = (e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
      };
      // Searching words goes through the text itself: reading innerText of every cell on a long table freezes the page.
      if (s === "main *" && t) {
        const walker = document.createTreeWalker(document.querySelector("main"), NodeFilter.SHOW_TEXT);
        const want = t.toLowerCase();
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.nodeValue.toLowerCase().includes(want)) continue;
          const el = node.parentElement;
          if (!seen(el)) continue;
          const row = el.closest("button, a, li, tr") ?? el;
          const r = row.getBoundingClientRect();
          return r.height < 160 ? { x: r.left, y: r.top, w: r.width, h: r.height } : (() => {
            const q = el.getBoundingClientRect();
            return { x: q.left, y: q.top, w: q.width, h: q.height };
          })();
        }
        return null;
      }
      const all = [...document.querySelectorAll(s)].filter(seen);
      // The smallest thing showing the words: a label or row, not the page around it.
      const size = (x) => {
        const r = x.getBoundingClientRect();
        return r.width * r.height;
      };
      const e = t ? all.filter((x) => (x.getAttribute("aria-label") || x.innerText || "").toLowerCase().includes(t.toLowerCase())).sort((p, q) => size(p) - size(q))[0] : all[0];
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    },
    selector,
    text,
  );
const agentState = () =>
  page.evaluate(() => {
    const orb = document.querySelector("[data-agent] .dock-orb");
    return { title: orb?.title ?? "" };
  });
const idle = async (timeoutMs = 90000) => {
  const t0 = Date.now();
  await wait(1200);
  let calm = 0;
  while (Date.now() - t0 < timeoutMs) {
    const { title } = await agentState();
    calm = /tap to talk|बात करने/i.test(title) ? calm + 1 : 0;
    if (calm >= 3) return;
    await wait(400);
  }
  log("idle-timeout");
};
const api = {
  page,
  wait,
  glide,
  log,
  mark: (name) => log("mark", { name }),
  rectOf,
  idle,
  go: async (path, settle = 1500) => {
    await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
    await wait(settle);
  },
  /** Wait until a page has drawn, so a take never moves on from a half-loaded screen. */
  ready: async (title, timeoutMs = 40000) => {
    const t0 = Date.now();
    await page
      .waitForFunction((x) => (document.querySelector("main")?.textContent ?? "").toLowerCase().includes(x.toLowerCase()), { timeout: timeoutMs, polling: 250 }, title)
      .catch(() => log("not-ready", { title }));
    log("ready", { title, ms: Date.now() - t0 });
  },
  /** Move the pointer to something and rest on it, so its hover state shows. */
  hover: async (selector, text, ms = 800) => {
    const r = await rectOf(selector, text);
    if (!r) return log("hover-miss", { selector, text });
    await glide(r.x + r.w / 2, r.y + r.h / 2);
    log("focus", { x: r.x, y: r.y, w: r.w, h: r.h });
    await wait(ms);
  },
  click: async (selector, text, after = 700) => {
    const r = await rectOf(selector, text);
    if (!r) return log("click-miss", { selector, text });
    await glide(r.x + r.w / 2, r.y + r.h / 2);
    log("focus", { x: r.x, y: r.y, w: r.w, h: r.h });
    await wait(180);
    await page.mouse.down();
    await wait(70);
    await page.mouse.up();
    await wait(after);
  },
  scroll: async (px, ms = 1100) => {
    const steps = Math.round(ms / 16);
    let done = 0;
    for (let i = 1; i <= steps; i++) {
      const to = Math.round(px * ease(i / steps));
      await page.mouse.wheel({ deltaY: to - done });
      done = to;
      await wait(16);
    }
  },
  /** Speak a recorded line to the orb: tap it, play the voice into the microphone, let the agent work. */
  say: async (clip, { tap = true } = {}) => {
    const file = [".wav", ".m4a", ".mp3", ".ogg", ".aac", ".webm"].map((e) => join(ROOT, "demo/voice", clip + e)).find(existsSync) ?? join(ROOT, "demo/voice/placeholder", clip + ".mp3");
    if (tap) {
      const r = await rectOf("[data-agent] .dock-orb");
      await glide(r.x + r.w / 2, r.y + r.h / 2);
      await wait(150);
      await page.mouse.down();
      await wait(60);
      await page.mouse.up();
    }
    await wait(900);
    log("say", { clip });
    const ms = await page.evaluate((b) => window.__speak(b), readFileSync(file).toString("base64"));
    await wait(ms);
    await idleOrListening();
  },
  /** Type to the chat panel, then let the agent work. */
  type: async (text) => {
    log("type", { text });
    const box = 'textarea[aria-label="Message to Jugnu"]';
    const r = await rectOf(box);
    if (!r) return log("type-miss");
    await glide(r.x + r.w / 2, r.y + r.h / 2);
    await page.mouse.down();
    await page.mouse.up();
    for (const ch of text) {
      await page.keyboard.type(ch);
      await wait(18 + Math.random() * 30);
    }
    await wait(350);
    await page.keyboard.press("Enter");
    await idle();
  },
  /** End the voice conversation (the stop button beside the orb). */
  stopVoice: async () => {
    await page.evaluate(() => document.querySelector('[data-agent] button[aria-label="Stop"]')?.click());
    await wait(400);
  },
  lastWords: () => page.evaluate(() => [...document.querySelectorAll("[data-agent]")].map((d) => d.innerText).join(" | ").slice(0, 500)),
  /** Place a call straight through the phone line, to the number on file. It never appears on screen. */
  dial: async (body) => {
    const to = readFileSync(join(ROOT, ".env"), "utf8").match(/^DEMO_TEACHER_PHONE=(.*)$/m)?.[1].trim();
    const r = await fetch(`${process.env.DEMO_API ?? "http://localhost:8788"}/api/ivr/call`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to, ...body }) });
    const d = await r.json();
    log("dial", { ok: r.ok, provider: d.provider, error: d.error });
  },
  /** Stay on the phone line while the call runs, keeping the live words in view, until it ends and is read. */
  followCall: async (limitMs = 720000) => {
    const t0 = Date.now();
    const api = process.env.DEMO_API ?? "http://localhost:8788";
    let seen = "";
    let id = null;
    while (Date.now() - t0 < limitMs) {
      await page.evaluate(() => {
        const list = [...document.querySelectorAll("main .scroll-thin")].at(-1);
        if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
      });
      const rows = await fetch(`${api}/api/interviews`).then((r) => r.json()).catch(() => []);
      const row = rows.find((r) => r.channel === "phone" && Date.parse(r.created_at) >= started - 2000);
      if (!row && Date.now() - t0 > 45000) {
        log("no-call-placed");
        break;
      }
      if (row) {
        id = row.id;
        const now = `${row.call_status} ${row.status} ${row.language} ${row.turns}`;
        if (now !== seen) log("call", { id: row.id, call_status: row.call_status, status: row.status, language: row.language, turns: row.turns });
        seen = now;
        if (row.status === "completed" || row.status === "declined") break;
        if (["no-answer", "busy", "failed", "completed", "NO_ANSWER", "BUSY", "FAILED", "ORIGINATOR_CANCEL", "NORMAL_CLEARING"].includes(row.call_status)) break;
      }
      await wait(1000);
    }
    // The methods are read just after the call: stay until they are on screen.
    for (let i = 0; id && i < 30; i++) {
      const d = await fetch(`${api}/api/interviews/${id}`).then((r) => r.json()).catch(() => ({}));
      if (d.codings?.length) {
        log("coded", { methods: d.codings.length });
        break;
      }
      await wait(1000);
    }
    await wait(4500);
  },
  shot: async (name) => {
    if (probe) await page.screenshot({ path: join(out, `${name}.jpg`), type: "jpeg", quality: 70 });
  },
  transcript: () => page.evaluate(() => [...document.querySelectorAll("[data-agent] aside [aria-live=polite] > div")].map((d) => d.innerText).slice(-12)),
};
/** After speaking, the orb stays in conversation; wait until the agent has answered and is listening again. */
async function idleOrListening(timeoutMs = 90000) {
  const t0 = Date.now();
  await wait(1500);
  let calm = 0;
  while (Date.now() - t0 < timeoutMs) {
    const { title } = await agentState();
    calm = /listening|सुन रहा|tap to talk/i.test(title) ? calm + 1 : 0;
    if (calm >= 2) return;
    await wait(400);
  }
  log("listen-timeout");
}

if (scenario.reset) {
  const r = spawnSync("npx", ["tsx", "--env-file=.env", "demo/reset.ts"], { cwd: ROOT, shell: true, encoding: "utf8" });
  console.log((r.stdout || r.stderr).trim().split("\n").at(-1));
}
const started = Date.now();
await cdp.send("Page.enable");
await scenario.before?.(api);
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 82, maxWidth: W * SCALE, maxHeight: H * SCALE, everyNthFrame: 2 });
filming = true;
log("rolling");
try {
  await scenario.run(api);
} catch (e) {
  log("error", { message: e.message });
}
await wait(800);
filming = false;
await cdp.send("Page.stopScreencast").catch(() => {});
const b64 = await page.evaluate(() => window.__stopTape?.() ?? "");
if (b64) writeFileSync(join(out, "audio.webm"), Buffer.from(b64, "base64"));
const pageEvents = await page.evaluate(() => window.__events ?? []);
const tapStarted = await page.evaluate(() => window.__tapStarted ?? null);
writeFileSync(join(out, "frames.json"), JSON.stringify(frames));
writeFileSync(join(out, "events.json"), JSON.stringify({ scale: SCALE, tapStarted, events, pageEvents }, null, 1));
const span = frames.length > 1 ? (frames.at(-1).at - frames[0].at) / 1000 : 0;
console.log(`frames ${frames.length} over ${span.toFixed(1)} s = ${(frames.length / Math.max(1, span)).toFixed(1)} fps; audio ${Math.round(b64.length / 1400)} KB; page errors ${errors.length}`, errors.slice(0, 3));
await browser.close();
