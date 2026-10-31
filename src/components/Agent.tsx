// Jugnu, the assistant. Its face is a living orb of light (Orb.tsx) that ripples with the voice;
// a swarm of fireflies stands in where WebGL is missing. Tap it for a full-screen voice
// conversation (Google Chirp 3 hears Hindi, English, Tamil and more; Chirp 3 HD voices answer),
// or open the chat panel. Both drive the same agent — it briefs the officer in their language,
// answers from the block's data and works the console: pages, schools, the map, forms, records.
import { cx } from "./ui";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Compass, Loader2, MessageCircle, Mic, MicOff, Newspaper, Send, Square, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DAMOH } from "../engine/district";
import { briefingFacts, buildBriefing, clickByLabel, fillField, findSchool, HUSH_EVENT, isHushed, parseCommand, readScreen, TOOL_LABEL } from "../lib/agent";
import { postJSON, useStatus } from "../lib/api";
import { usePrefs, useT } from "../lib/prefs";
import { useRole } from "../lib/role";
import { canListen, listen, stopSpeaking } from "../lib/speech";
import { usePipeline } from "../lib/store";
import { useTheme } from "../lib/theme";
import { audio, fetchSpeech, openMic, outLevel, play, stopPlayback, transcribe, type Mic as MicHandle } from "../lib/voice";
import { fieldBase } from "./kit";
import { Orb } from "./Orb";

export type Mode = "off" | "listening" | "hearing" | "thinking" | "working" | "speaking" | "error";

// ---------------------------------------------------------------- the swarm (canvas)

type RGB = [number, number, number];
const AMBER: RGB = [255, 213, 107];
const LIME: RGB = [198, 243, 107];
const TEAL: RGB = [127, 227, 208];
const ROSE: RGB = [255, 120, 120];
const VIOLET: RGB = [170, 160, 255];

/** How the swarm behaves in each mode: spread (how far out), swirl (speed), ring (pull onto a circle), glow. */
const MOTION: Record<Mode, { spread: number; swirl: number; ring: number; glow: number; tint: RGB }> = {
  off: { spread: 1, swirl: 0.22, ring: 0, glow: 0.5, tint: AMBER },
  listening: { spread: 0.62, swirl: 0.35, ring: 0.35, glow: 0.65, tint: LIME },
  hearing: { spread: 0.5, swirl: 1.4, ring: 0.85, glow: 0.7, tint: TEAL },
  thinking: { spread: 0.55, swirl: 1.9, ring: 0.9, glow: 0.7, tint: VIOLET },
  working: { spread: 0.6, swirl: 1.6, ring: 0.75, glow: 0.75, tint: TEAL },
  speaking: { spread: 0.7, swirl: 0.5, ring: 0.2, glow: 0.85, tint: AMBER },
  error: { spread: 0.8, swirl: 0.15, ring: 0, glow: 0.45, tint: ROSE },
};

function sprite(c: RGB) {
  const s = document.createElement("canvas");
  s.width = s.height = 64;
  const g = s.getContext("2d")!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,245,1)");
  r.addColorStop(0.18, `rgba(${c.join(",")},0.95)`);
  r.addColorStop(0.45, `rgba(${c.join(",")},0.28)`);
  r.addColorStop(1, `rgba(${c.join(",")},0)`);
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return s;
}

/** Jugnu's face: a few dozen fireflies around a warm core, moved by the voice (mic or speaker). */
export function Swarm({ mode, level, size, count }: { mode: Mode; level: () => number; size: number; count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const levelRef = useRef(level);
  levelRef.current = level;
  useEffect(() => {
    const c = ref.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.height = Math.round(size * dpr);
    const g = c.getContext("2d")!;
    const sprites = [AMBER, LIME, TEAL, ROSE, VIOLET].map(sprite);
    const pick = (k: RGB) => sprites[[AMBER, LIME, TEAL, ROSE, VIOLET].indexOf(k)];
    const n = count ?? (size > 140 ? 64 : 22);
    const flies = Array.from({ length: n }, (_, i) => ({
      a: (i / n) * Math.PI * 2 + Math.random(),
      r: 0.28 + Math.random() * 0.68,
      w: (0.5 + Math.random()) * (Math.random() < 0.5 ? -1 : 1),
      ph: Math.random() * 10,
      blink: 0.6 + Math.random() * 1.6,
      s: 0.6 + Math.random() * 0.8,
      col: i % 5 === 0 ? TEAL : i % 3 === 0 ? LIME : AMBER,
      x: 0,
      y: 0,
    }));
    const R = (c.width / 2) * 0.92;
    const cx = c.width / 2;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const st = { ...MOTION.off, amp: 0, t: 0 };
    let raf = 0;
    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000) * (reduced ? 0.3 : 1);
      last = now;
      st.t += dt;
      const m = MOTION[modeRef.current];
      const live = modeRef.current === "listening" || modeRef.current === "speaking" ? Math.min(1, levelRef.current()) : 0;
      st.amp += (live - st.amp) * (live > st.amp ? 0.35 : 0.08);
      for (const k of ["spread", "swirl", "ring", "glow"] as const) st[k] += (m[k] - st[k]) * 0.05;
      g.clearRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = "lighter";
      const coreR = R * (0.22 + st.amp * 0.16 + Math.sin(st.t * 1.4) * 0.012);
      const core = g.createRadialGradient(cx, cx, 0, cx, cx, coreR);
      const tc = m.tint.join(",");
      core.addColorStop(0, `rgba(255,250,230,${0.16 * st.glow + st.amp * 0.18})`);
      core.addColorStop(0.35, `rgba(${tc},${0.1 * st.glow + st.amp * 0.12})`);
      core.addColorStop(1, `rgba(${tc},0)`);
      g.fillStyle = core;
      g.fillRect(0, 0, c.width, c.height);
      if (st.amp > 0.05) {
        g.strokeStyle = `rgba(${tc},${st.amp * 0.16})`;
        g.lineWidth = 1.2 * dpr;
        g.beginPath();
        g.arc(cx, cx, R * (0.55 + st.amp * 0.4), 0, Math.PI * 2);
        g.stroke();
      }
      for (const f of flies) {
        f.a += dt * f.w * st.swirl;
        const ringR = 0.62 + Math.sin(f.ph) * 0.05;
        const rr = (f.r * (1 - st.ring) + ringR * st.ring) * st.spread * (1 + st.amp * 0.45) + Math.sin(st.t * 1.7 + f.ph) * 0.05;
        const wob = Math.sin(st.t * 0.9 + f.ph * 2) * 0.06 * (1 - st.ring);
        const tx = cx + Math.cos(f.a + wob) * rr * R;
        const ty = cx + Math.sin(f.a + wob) * rr * R * 0.92;
        f.x = f.x ? f.x + (tx - f.x) * 0.2 : tx;
        f.y = f.y ? f.y + (ty - f.y) * 0.2 : ty;
        const blink = Math.pow(0.5 + 0.5 * Math.sin(st.t * f.blink * 2 + f.ph), 3);
        const alpha = Math.min(1, 0.18 + blink * 0.82 + st.amp * 0.3);
        const s = R * (size > 140 ? 0.065 : 0.11) * f.s * (0.75 + blink * 0.55 + st.amp * 0.7);
        g.globalAlpha = alpha;
        g.drawImage(modeRef.current === "error" ? pick(ROSE) : modeRef.current === "thinking" && f.col === AMBER ? pick(VIOLET) : pick(f.col), f.x - s, f.y - s, s * 2, s * 2);
      }
      g.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, count]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />;
}

// ---------------------------------------------------------------- speaking

/** Read a line aloud with the browser's own voice (when Google voices are not configured). */
function sayLine(text: string, lang: string, onWord: (charIndex: number) => void): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = lang.startsWith("hi") ? 0.98 : 1.04;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find((x) => x.lang === lang && /google|natural|online/i.test(x.name)) ?? voices.find((x) => x.lang === lang);
    if (v) u.voice = v;
    u.onboundary = (e) => onWord(e.charIndex);
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

/** Sentences, merged so very short ones travel with the next (fewer voice requests, natural pacing). */
function sentences(text: string): string[] {
  const parts = text.match(/[^.!?।]+[.!?।]*["”’)]*\s*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
  const out: string[] = [];
  for (const p of parts) {
    if (out.length && (out[out.length - 1].length < 40 || p.length < 12)) out[out.length - 1] += " " + p;
    else out.push(p);
  }
  return out.length ? out : [text];
}

export const VOICE_CHOICES: { id: string; en: string; hi: string }[] = [
  { id: "Aoede", en: "Warm · woman", hi: "गर्मजोशी · महिला" },
  { id: "Kore", en: "Clear · woman", hi: "साफ़ · महिला" },
  { id: "Leda", en: "Gentle · woman", hi: "कोमल · महिला" },
  { id: "Zephyr", en: "Bright · woman", hi: "चमकदार · महिला" },
  { id: "Charon", en: "Calm · man", hi: "शांत · पुरुष" },
  { id: "Puck", en: "Lively · man", hi: "जोशीला · पुरुष" },
  { id: "Orus", en: "Steady · man", hi: "स्थिर · पुरुष" },
  { id: "Fenrir", en: "Deep · man", hi: "गहरा · पुरुष" },
];
const VOICE_KEY = "jugnu-voice";
const savedVoice = () => {
  try {
    return localStorage.getItem(VOICE_KEY) || "Aoede";
  } catch {
    return "Aoede";
  }
};

// ---------------------------------------------------------------- the agent

export interface Line {
  id: number;
  who: "you" | "jugnu";
  text: string;
  /** How much of the text is revealed (streams in as it is spoken). */
  shown: number;
  tools: { name: string; ok: boolean; note?: string }[];
  brief?: boolean;
}

type ApiMessage = { role: "user" | "assistant"; content: unknown };
interface Turn {
  messages: ApiMessage[];
  calls: { id: string; name: string; input: Record<string, unknown> }[];
  results: unknown[];
  looked: string[];
  say: string | null;
  source: "claude" | "offline";
  error?: string;
}

const PAGE_PATH: Record<string, string> = {
  today: "/today",
  schools: "/schools",
  map: "/schools?view=map",
  plan: "/plan",
  approvals: "/review",
  results: "/results",
  practices: "/practices",
  interviews: "/interviews",
  district: "/district",
  ai: "/ai",
  method: "/method",
  about: "/about",
  home: "/",
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The page guide: a spoken word of help the first time each page opens in a session.
const GUIDE_KEY = "jugnu-guide";
const guideSaved = () => {
  try {
    return localStorage.getItem(GUIDE_KEY) !== "off";
  } catch {
    return true;
  }
};
/** Which page a path is, in words Claude understands ("schools", "school page", …). */
function pageOf(path: string, search: string) {
  if (/^\/schools\/./.test(path)) return "school page";
  if (path === "/schools" && search.includes("view=map")) return "map";
  const hit = Object.entries(PAGE_PATH).find(([, p]) => p === path);
  return hit ? hit[0] : path.replace(/^\//, "").split("/")[0] || "home";
}
const guided = new Set<string>();

export function useAgent() {
  const t = useT();
  const { lang, setLang } = usePrefs();
  const { setMode: setTheme } = useTheme();
  const [role] = useRole();
  const status = useStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const { state, seed, events, allActions, regenerate, record, select } = usePipeline();
  const [mode, setMode] = useState<Mode>("off");
  const [lines, setLines] = useState<Line[]>([]);
  const [voice, setVoice] = useState(true);
  const [guideOn, setGuideOnState] = useState(guideSaved);
  const [voiceName, setVoiceNameState] = useState(savedVoice);
  const [handsFree, setHandsFree] = useState(false);
  const [heard, setHeard] = useState("");
  const [engine, setEngine] = useState<string | null>(null);
  const fake = useRef(0);
  const mic = useRef<MicHandle | null>(null);
  const history = useRef<ApiMessage[]>([]);
  const busy = useRef(false);
  const stopRef = useRef<(() => void) | null>(null);
  const cancelled = useRef(false);
  const hush = useRef(false);
  const nextId = useRef(1);
  // Live values for async loops (the conversation outlives a render).
  const live = useRef({ state, events, allActions, lang, voice, voiceName, location, seed, role, cloud: status.voice, mode });
  live.current = { state, events, allActions, lang, voice, voiceName, location, seed, role, cloud: status.voice, mode };
  const speechLang = () => (live.current.lang === "hi" ? "hi-IN" : "en-IN");

  const setVoiceName = (v: string) => {
    setVoiceNameState(v);
    try {
      localStorage.setItem(VOICE_KEY, v);
    } catch {
      /* ignore */
    }
  };

  /** 0–1 loudness for the swarm: the microphone while listening, the voice while speaking. */
  const levelNow = useCallback(() => {
    const m = live.current.mode;
    if (m === "listening") return mic.current?.level() ?? 0;
    fake.current *= 0.92;
    return Math.max(outLevel(), fake.current);
  }, []);

  const patch = (id: number, f: (l: Line) => Line) => setLines((ls) => ls.map((l) => (l.id === id ? f(l) : l)));
  const add = (l: Omit<Line, "id">) => {
    const id = nextId.current++;
    setLines((ls) => [...ls.slice(-60), { ...l, id }]);
    return id;
  };

  const speechFor = (text: string) => sentences(text).map((p) => ({ p, b: fetchSpeech(p, live.current.voiceName).catch(() => null) }));

  /** Show a line of Jugnu's, revealing it as it is spoken (Google voice, else the browser's, else typed). */
  const speakOut = useCallback(async (text: string, extra: Partial<Line> = {}, pre?: { p: string; b: Promise<AudioBuffer | null> }[]) => {
    const id = add({ who: "jugnu", text, shown: 0, tools: [], ...extra });
    if (cancelled.current) return patch(id, (l) => ({ ...l, shown: text.length }));
    setMode("speaking");
    hush.current = false;
    const v = live.current;
    if (v.voice && v.cloud) {
      const parts = pre ?? speechFor(text);
      let cursor = 0;
      for (const { p, b } of parts) {
        const start = Math.max(cursor, text.indexOf(p.slice(0, 12), cursor));
        const end = Math.min(text.length, start + p.length);
        const buf = await b;
        if (cancelled.current || hush.current) break;
        if (buf) {
          const t0 = performance.now();
          const dur = buf.duration * 1000;
          const tick = setInterval(() => patch(id, (l) => ({ ...l, shown: Math.max(l.shown, Math.round(start + (end - start) * Math.min(1, (performance.now() - t0) / dur))) })), 60);
          await play(buf);
          clearInterval(tick);
        } else {
          await sayLine(p, speechLang(), () => (fake.current = 0.7));
        }
        cursor = end;
        patch(id, (l) => ({ ...l, shown: Math.max(l.shown, end) }));
      }
    } else if (v.voice && "speechSynthesis" in window) {
      let last = 0;
      const typing = setInterval(() => patch(id, (l) => ({ ...l, shown: Math.min(text.length, Math.max(l.shown, last + 6)) })), 120);
      await sayLine(text, speechLang(), (i) => {
        last = i;
        fake.current = 0.55 + Math.random() * 0.35;
        const end = text.indexOf(" ", i + 1);
        patch(id, (l) => ({ ...l, shown: Math.max(l.shown, end < 0 ? text.length : end) }));
      });
      clearInterval(typing);
    } else {
      for (let i = 0; i <= text.length && !cancelled.current; i += 3) {
        patch(id, (l) => ({ ...l, shown: i }));
        fake.current = 0.4;
        await wait(14);
      }
    }
    patch(id, (l) => ({ ...l, shown: text.length }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Run one UI tool in the browser; returns what happened, for Claude. */
  const runTool = useCallback(
    async (name: string, input: Record<string, unknown>): Promise<{ ok: boolean; out: string }> => {
      const { state: st, allActions: acts } = live.current;
      const school = (n: unknown) => (typeof n === "string" ? findSchool(st.block.schools, n) : null);
      const fail = (out: string) => ({ ok: false, out });
      switch (name) {
        case "go_to": {
          const path = PAGE_PATH[String(input.page)];
          if (!path) return fail(`Unknown page ${input.page}`);
          navigate(path);
          await wait(450);
          return { ok: true, out: `Opened ${input.page}.` };
        }
        case "open_school":
        case "show_on_map": {
          const s = school(input.name);
          if (!s) return fail(`No school called "${input.name}" in ${st.block.name}.`);
          select(s.id);
          navigate(name === "open_school" ? `/schools/${s.id}` : `/schools?focus=${s.id}`);
          await wait(600);
          return { ok: true, out: `${name === "open_school" ? "Opened" : "Showing on the map"}: ${s.name} (${s.clusterName} cluster).` };
        }
        case "switch_block": {
          const b = DAMOH.find((p) => p.block.toLowerCase() === String(input.block).toLowerCase().replace(/ block$/, ""));
          if (!b) return fail(`Damoh has no block called ${input.block}.`);
          regenerate(b.code);
          await wait(500);
          return { ok: true, out: `Now working in ${b.block} block.` };
        }
        case "search":
          navigate(`/schools?q=${encodeURIComponent(String(input.query ?? ""))}`);
          await wait(450);
          return { ok: true, out: `Searching schools for "${input.query}".` };
        case "read_screen":
          return { ok: true, out: readScreen() };
        case "click": {
          const out = clickByLabel(String(input.label ?? ""));
          await wait(400);
          return { ok: out.startsWith("Clicked"), out };
        }
        case "fill": {
          const out = fillField(String(input.field ?? ""), String(input.value ?? ""));
          return { ok: !out.startsWith("No ") && !out.includes("not an option"), out };
        }
        case "set_preference":
          if (input.language === "en" || input.language === "hi") setLang(input.language);
          if (input.theme === "dark" || input.theme === "light") setTheme(input.theme);
          return { ok: true, out: "Done." };
        case "record": {
          const s = school(input.school);
          if (!s) return fail(`No school called "${input.school}".`);
          const n = (k: string) => Math.round(Number(input[k]));
          try {
            if (input.kind === "note") {
              if (!input.text) return fail("A note needs text.");
              await record("note", s.id, { text: String(input.text).slice(0, 1000) });
            } else if (input.kind === "spot_check") {
              const sampled = n("sampled");
              if (!(sampled >= 5 && sampled <= 40) || !(n("read") >= 0 && n("read") <= sampled) || !(n("subtract") >= 0 && n("subtract") <= sampled))
                return fail("A confirmation visit needs 5–40 children sampled, and how many of them read and subtracted.");
              await record("spotcheck", s.id, { sampled, proficient: n("read"), numeracyProficient: n("subtract") });
            } else if (input.kind === "follow_up") {
              if (!["adopted", "trying", "barrier", "no_answer"].includes(String(input.outcome))) return fail("Say how the call went: adopted, trying, barrier or no answer.");
              await record("followup", s.id, { outcome: input.outcome, said: input.said ? String(input.said).slice(0, 2000) : undefined });
            } else if (input.kind === "action") {
              const mine = acts.filter((a) => a.schoolId === s.id);
              const words = String(input.task ?? "").toLowerCase().split(/\s+/).filter((w) => w.length > 2);
              const a = mine.find((x) => words.length && words.every((w) => x.task.toLowerCase().includes(w))) ?? mine.find((x) => words.some((w) => x.task.toLowerCase().includes(w))) ?? (mine.length === 1 ? mine[0] : undefined);
              if (!a) return fail(`Which task at ${s.name}? Options: ${mine.map((x) => x.task).join(" | ") || "none"}.`);
              if (!["todo", "scheduled", "done", "stuck"].includes(String(input.status))) return fail("Status must be to do, scheduled, done or stuck.");
              await record("action", a.id, { status: input.status, note: input.note ? String(input.note).slice(0, 500) : undefined });
            } else return fail("Unknown record kind.");
          } catch (e) {
            return fail(`Could not save: ${(e as Error).message}`);
          }
          return { ok: true, out: `Saved to ${s.name}'s shared log.` };
        }
        default:
          return fail(`Unknown tool ${name}`);
      }
    },
    [navigate, regenerate, record, select, setLang, setTheme],
  );

  /** The spoken briefing: Claude retells the block's facts in the console's language; the built-in lines are the fallback. */
  const brief = useCallback(async () => {
    const { state: st, events: ev, lang: l, role: r } = live.current;
    setMode("thinking");
    let text: string[] = [];
    const by = "briefing";
    if (status.claude) {
      try {
        const res = await postJSON<{ lines: string[]; source: string }>("/api/agent/brief", { facts: briefingFacts(st, ev), lang: l, name: r?.kind === "crp" ? "cluster coordinator" : r?.kind === "beo" ? "Block Education Officer" : undefined });
        text = res.lines;
      } catch {
        /* fall back below */
      }
    }
    if (!text.length) {
      text = buildBriefing(st, ev, t, l === "hi");
    }
    // Ask for every line's voice at once, then speak them in turn.
    const pre = live.current.voice && live.current.cloud ? text.map(speechFor) : [];
    for (const [i, line] of text.entries()) {
      if (cancelled.current) break;
      await speakOut(line, { brief: true, tools: i === 0 ? [{ name: by, ok: true }] : [] }, pre[i]);
    }
    history.current.push({ role: "user", content: "Brief me." }, { role: "assistant", content: `${text.join(" ")}\n[briefing built from the block's live data]` });
  }, [speakOut, status.claude, t]); // eslint-disable-line react-hooks/exhaustive-deps

  /** The officer said or typed something: answer it, doing whatever it takes on screen. */
  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy.current) return;
      busy.current = true;
      cancelled.current = false;
      stopPlayback();
      stopSpeaking();
      add({ who: "you", text: q, shown: q.length, tools: [] });
      setMode("thinking");
      const tools: Line["tools"] = [];
      try {
        const intent = parseCommand(q, live.current.state.block.schools, DAMOH.map((b) => b.block));
        if (intent && "brief" in intent) {
          await brief();
          return;
        }
        let said: string | null = null;
        if (status.claude) {
          const { state: st, seed: sd, location: loc, lang: l, role: r } = live.current;
          const ctx = {
            page: loc.pathname + loc.search,
            school: loc.pathname.startsWith("/schools/") ? (st.block.schools.find((s) => loc.pathname.endsWith(s.id))?.name ?? null) : null,
            lang: l,
            role: r?.kind === "crp" ? "cluster coordinator" : r?.kind === "beo" ? "block officer" : r?.kind === "head" ? "school head" : "guest",
            // Same key the store polls with, so what the agent writes shows up on screen within seconds.
            block: st.block.source === "simulated" ? `seed:${st.block.seed}` : `import:${st.block.name}:${st.block.schools.length}`,
          };
          const base = st.block.source === "imported" ? { block: st.block } : { seed: sd, track: !!st.track };
          let messages: ApiMessage[] = [...history.current.slice(-16), { role: "user", content: q }];
          for (let round = 0; round < 6 && !cancelled.current; round++) {
            // The context stays the same for the whole turn (Claude's reasoning is tied to it); tool results report page changes.
            const turn = await postJSON<Turn>("/api/agent", { ...base, messages, context: ctx });
            if (turn.source === "offline") break;
            messages = turn.messages;
            for (const n of turn.looked ?? []) tools.push({ name: n, ok: true });
            if (!turn.calls.length) {
              said = turn.say;
              break;
            }
            setMode("working");
            const results: unknown[] = [...turn.results];
            for (const c of turn.calls) {
              const r = await runTool(c.name, c.input);
              tools.push({ name: c.name, ok: r.ok });
              results.push({ type: "tool_result", tool_use_id: c.id, content: r.out, ...(r.ok ? {} : { is_error: true }) });
            }
            messages = [...messages, { role: "user", content: results }];
          }
          // Carry only the plain words forward (tool blocks would need their pairs); Claude can look things up again.
          const basis = tools.length ? `\n[done with tools: ${[...new Set(tools.map((x) => x.name))].join(", ")}]` : "";
          if (said) history.current = [...history.current, { role: "user" as const, content: q }, { role: "assistant" as const, content: said + basis }].slice(-16);
        }
        // Claude did not answer, and this is a question: the rule-based answer is better than only opening a page.
        if (!said && /\?|^(which|who|what|why|how|where|when|did|are|is|do)\b|कौन|किन|क्या|क्यों|कैसे|कहाँ/i.test(q.trim())) {
          const { state: st, seed: sd } = live.current;
          const r = await postJSON<{ answer: string; next_step: string | null }>("/api/ask", { question: q, ...(st.block.source === "imported" ? { block: st.block } : { seed: sd, track: !!st.track }) }).catch(() => null);
          if (r) {
            said = [r.answer, r.next_step].filter(Boolean).join(" ");
            tools.push({ name: "block_overview", ok: true });
          }
        }
        if (!said) {
          // Offline: a few commands still work.
          if (intent && "tool" in intent) {
            const r = await runTool(intent.tool, intent.input);
            tools.push({ name: intent.tool, ok: r.ok });
            said = r.ok ? t(`Done — ${r.out}`, `हो गया — ${r.out}`) : r.out;
          } else
            said = t(
              "I can brief you, open a page or a school, show a school on the map, or switch block. Try “Brief me” or “Show Sasna Kalan on the map”.",
              "मैं ब्रीफ़ कर सकता हूँ, पेज या स्कूल खोल सकता हूँ, स्कूल नक्शे पर दिखा सकता हूँ, या ब्लॉक बदल सकता हूँ। कहें “ब्रीफ़ करो”।",
            );
        }
        await speakOut(said, { tools });
      } catch (e) {
        setMode("error");
        await speakOut(t(`Something went wrong: ${(e as Error).message}`, `कुछ गड़बड़ हुई: ${(e as Error).message}`), { tools });
      } finally {
        busy.current = false;
        setMode("off");
      }
    },
    [brief, runTool, speakOut, status.claude, t],
  );

  /** Hear one turn. Google Chirp 3 when voice is configured (any Indian language); the browser's recogniser otherwise. */
  const listenOnce = useCallback(async (): Promise<string | null> => {
    stopPlayback();
    stopSpeaking();
    setHeard("");
    if (live.current.cloud && typeof MediaRecorder !== "undefined" && navigator.mediaDevices) {
      try {
        audio();
        mic.current ??= await openMic();
      } catch {
        setMode("error");
        setHeard(t("I can't reach the microphone — allow it in the browser, or type.", "माइक्रोफ़ोन नहीं मिल रहा — ब्राउज़र में अनुमति दें, या लिखें।"));
        return null;
      }
      setMode("listening");
      // Words appear live as the officer speaks (the browser's quick recogniser, where it has one);
      // the recording then goes to Chirp 3 for the accurate version, which replaces them.
      const quick = canListen() ? listen(speechLang(), (txt) => setHeard(txt)) : null;
      quick?.promise.catch(() => {});
      stopRef.current = () => mic.current?.stopTurn();
      const blob = await mic.current.turn({ waitMs: 12000, maxMs: 40000 });
      stopRef.current = null;
      quick?.stop();
      if (!blob || cancelled.current) return null;
      setMode("hearing");
      try {
        const r = await transcribe(blob, live.current.lang, live.current.seed);
        setEngine(r.engine);
        if (r.text) setHeard(r.text);
        // A short beat with the final words on screen before Jugnu answers.
        await wait(500);
        return r.text || null;
      } catch (e) {
        setMode("error");
        setHeard((e as Error).message);
        return null;
      }
    }
    if (!canListen()) {
      setMode("error");
      return null;
    }
    setMode("listening");
    const h = listen(speechLang(), (txt) => {
      setHeard(txt);
      fake.current = 0.6;
    });
    stopRef.current = h.stop;
    try {
      return await h.promise;
    } catch {
      return null;
    } finally {
      stopRef.current = null;
    }
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps

  /** A spoken conversation: listen, answer, listen again — until silence, or the officer ends it. */
  const converse = useCallback(async () => {
    if (handsFree) return;
    setHandsFree(true);
    cancelled.current = false;
    try {
      for (let i = 0; i < 20; i++) {
        const said = await listenOnce();
        if (cancelled.current || !said) break;
        await send(said);
        if (cancelled.current) break;
      }
    } finally {
      setHandsFree(false);
      if (!cancelled.current) setMode((m) => (m === "error" ? m : "off"));
    }
  }, [handsFree, listenOnce, send]);

  /** Cut Jugnu off mid-sentence (the conversation carries on and listens). */
  const interrupt = useCallback(() => {
    hush.current = true;
    stopPlayback();
    stopSpeaking();
  }, []);

  const stop = useCallback(() => {
    cancelled.current = true;
    setHandsFree(false);
    stopRef.current?.();
    stopPlayback();
    stopSpeaking();
    setMode("off");
  }, []);

  /** Close the microphone (end of a voice session). */
  const hangUp = useCallback(() => {
    stop();
    mic.current?.close();
    mic.current = null;
  }, [stop]);

  useEffect(() => () => mic.current?.close(), []);

  useEffect(() => {
    const onHush = () => isHushed() && stop();
    window.addEventListener(HUSH_EVENT, onHush);
    return () => window.removeEventListener(HUSH_EVENT, onHush);
  }, [stop]);

  /** A spoken word of help for the page just opened: what it is for, and the one thing to do here now. */
  const guide = useCallback(async (page: string) => {
    if (busy.current || live.current.mode !== "off" || !status.claude || isHushed()) return;
    busy.current = true;
    cancelled.current = false;
    try {
      const { state: st, events: ev, lang: l } = live.current;
      const res = await postJSON<{ text: string }>("/api/agent/page", { page, screen: readScreen().slice(0, 3800), facts: briefingFacts(st, ev).slice(0, 14), lang: l }).catch(() => null);
      if (!res?.text || cancelled.current || live.current.mode !== "off" || isHushed()) return;
      if (pageOf(window.location.pathname, window.location.search) !== page) return; // they have moved on
      // Browsers only play sound after the person has tapped something; until then the guide is a bubble.
      const canPlay = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? false;
      if (canPlay) {
        audio();
        await speakOut(res.text, { tools: [{ name: "guide", ok: true }] });
      } else add({ who: "jugnu", text: res.text, shown: res.text.length, tools: [{ name: "guide", ok: true }] });
      history.current.push({ role: "user", content: `(I opened the ${page} page.)` }, { role: "assistant", content: `${res.text}
[page guide]` });
    } finally {
      busy.current = false;
      setMode((m) => (m === "speaking" ? "off" : m));
    }
  }, [speakOut, status.claude]); // eslint-disable-line react-hooks/exhaustive-deps

  const setGuideOn = (on: boolean) => {
    setGuideOnState(on);
    try {
      localStorage.setItem(GUIDE_KEY, on ? "on" : "off");
    } catch {
      /* ignore */
    }
  };

  // When a page opens (once per page per session), let it settle, then guide.
  useEffect(() => {
    if (!guideOn) return;
    const page = pageOf(location.pathname, location.search);
    const key = `${page}|${lang}`;
    if (page === "home" || guided.has(key)) return;
    const id = setTimeout(() => {
      if (live.current.mode !== "off" || busy.current || guided.has(key) || isHushed()) return;
      guided.add(key);
      void guide(page);
    }, 1800);
    return () => clearTimeout(id);
  }, [location.pathname, location.search, lang, guideOn, guide]);

  const startBrief = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    cancelled.current = false;
    audio();
    try {
      await brief();
    } finally {
      busy.current = false;
      setMode("off");
    }
  }, [brief]);

  return {
    mode,
    lines,
    voice,
    setVoice,
    voiceName,
    setVoiceName,
    cloud: status.voice,
    engine,
    handsFree,
    heard,
    levelNow,
    send,
    converse,
    interrupt,
    stop,
    hangUp,
    brief: startBrief,
    guideOn,
    setGuideOn,
    listenOnce,
    clear: () => (setLines([]), (history.current = [])),
  };
}

// ---------------------------------------------------------------- the dock, the voice stage and the panel

const MODE_LABEL: Record<Mode, [string, string]> = {
  off: ["Tap to talk", "बात करने के लिए छुएँ"],
  listening: ["Listening", "सुन रहा हूँ"],
  hearing: ["Understanding", "समझ रहा हूँ"],
  thinking: ["Thinking", "सोच रहा हूँ"],
  working: ["Working on it", "काम कर रहा हूँ"],
  speaking: ["Speaking — tap to cut in", "बोल रहा हूँ — बीच में बोलने के लिए छुएँ"],
  error: ["Paused", "रुका"],
};

const SUGGEST: [string, string][] = [
  ["Brief me", "ब्रीफ़ करो"],
  ["Which schools need help with maths, and who nearby can show them?", "किन स्कूलों को गणित में मदद चाहिए, और पास में कौन दिखा सकता है?"],
  ["Which school has the lowest attendance? Show it on the map.", "सबसे कम उपस्थिति किस स्कूल में है? नक्शे पर दिखाओ।"],
  ["Which actions are stuck, and who owns them?", "कौन-से काम अटके हैं, और किसकी ज़िम्मेदारी है?"],
  ["Open the plan", "योजना खोलो"],
];

function Chips({ tools, dark }: { tools: Line["tools"]; dark?: boolean }) {
  const t = useT();
  if (!tools.length) return null;
  const seen = new Set<string>();
  return (
    <div className={`mt-1.5 flex flex-wrap gap-1 ${dark ? "justify-center" : ""}`}>
      {tools
        .filter((x) => (seen.has(x.name + x.ok) ? false : (seen.add(x.name + x.ok), true)))
        .map((x, i) => (
          <span key={i} className={dark ? `inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs ${x.ok ? "text-white/70" : "text-rose-300"}` : `chip !gap-1 !px-1.5 !py-0 !text-xs ${x.ok ? "" : "!text-rose-300"}`}>
            {x.ok ? <Check size={10} /> : <X size={10} />}
            {x.name === "briefing" ? t("Briefing", "ब्रीफ़िंग") : TOOL_LABEL[x.name] ? t(...TOOL_LABEL[x.name]) : x.name}
          </span>
        ))}
    </div>
  );
}

export function AgentDock({ open, onOpen, onClose }: { open: boolean; onOpen: () => void; onClose: () => void }) {
  const t = useT();
  const a = useAgent();
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const active = a.mode !== "off" || a.handsFree;
  const canTalk = a.cloud || canListen();
  const lastJ = useMemo(() => [...a.lines].reverse().find((l) => l.who === "jugnu"), [a.lines]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [a.lines, open]);
  // Other parts of the console can ask Jugnu something ("jugnu:ask" with the question as detail).
  useEffect(() => {
    const h = (e: Event) => {
      const q = (e as CustomEvent<string>).detail;
      if (q === "brief") a.brief();
      else if (q) {
        onOpen();
        a.send(q);
      }
    };
    window.addEventListener("jugnu:ask", h);
    return () => window.removeEventListener("jugnu:ask", h);
  });
  // The orb stays put: tap to talk (it keeps listening after each answer), tap while it speaks to
  // cut in, tap while it listens to stop.
  const onOrb = () => {
    audio();
    if (!canTalk) return open ? onClose() : onOpen();
    if (a.mode === "speaking") a.interrupt();
    else if (a.handsFree || a.mode === "listening") a.hangUp();
    else if (a.mode === "off" || a.mode === "error") a.converse();
  };
  // The bubble lingers a few seconds after Jugnu stops talking, so the last words can be read.
  const [linger, setLinger] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (active) {
      setLinger(true);
      setHidden(false);
      return;
    }
    const id = setTimeout(() => setLinger(false), 9000);
    return () => clearTimeout(id);
  }, [active]);
  // A page guide that arrives silently (before any tap, when the browser blocks sound) still shows as a bubble.
  const guideLine = !active && lastJ?.tools?.some((x) => x.name === "guide") ? lastJ.id : null;
  useEffect(() => {
    if (guideLine == null) return;
    setLinger(true);
    setHidden(false);
    const id = setTimeout(() => setLinger(false), 14000);
    return () => clearTimeout(id);
  }, [guideLine]);
  const lastYou = useMemo(() => [...a.lines].reverse().find((l) => l.who === "you"), [a.lines]);
  const youLast = !!lastYou && (!lastJ || lastYou.id > lastJ.id);
  const ears = a.mode === "listening" || a.mode === "hearing";
  const bubble: { who: "you" | "jugnu"; text: string; rest?: string; note?: string } | null = hidden
    ? null
    : ears
      ? { who: "you", text: a.heard, note: a.mode === "hearing" ? t("Understanding…", "समझ रहा हूँ…") : a.heard ? undefined : t("Listening — speak in any language", "सुन रहा हूँ — किसी भी भाषा में बोलें") }
      : (a.mode === "thinking" || a.mode === "working") && youLast && lastYou
        ? { who: "you", text: lastYou.text, note: a.mode === "working" ? t("Working on it…", "काम कर रहा हूँ…") : t("Thinking…", "सोच रहा हूँ…") }
        : lastJ && !youLast && (active || linger)
          ? { who: "jugnu", text: lastJ.text.slice(0, lastJ.shown), rest: lastJ.text.slice(lastJ.shown) }
          : a.mode === "error" && a.heard
            ? { who: "jugnu", text: a.heard }
            : null;
  const submit = () => {
    const q = text;
    setText("");
    a.send(q);
  };
  return (
    <div data-agent className="no-print">
      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="glass-strong fixed bottom-[168px] right-3 top-3 z-[61] flex w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden lg:bottom-24"
            aria-label={t("Jugnu assistant", "जुगनू सहायक")}
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-4 py-3">
              <div className="min-w-0 flex-1 font-display text-base font-bold leading-tight">{t("Jugnu", "जुगनू")}</div>
              {a.cloud && (
                <select value={a.voiceName} onChange={(e) => a.setVoiceName(e.target.value)} className={`${fieldBase} !h-8 !w-auto !max-w-[150px] !py-0 text-xs`} aria-label={t("Voice", "आवाज़")} title={t("Voice", "आवाज़")}>
                  {VOICE_CHOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {t(v.en, v.hi)}
                    </option>
                  ))}
                </select>
              )}
              <button className={`btn btn-glass btn-icon !p-2 ${a.guideOn ? "text-[var(--st-bright)]" : ""}`} onClick={() => a.setGuideOn(!a.guideOn)} aria-pressed={a.guideOn} aria-label={t("Page guide", "पेज गाइड")} title={a.guideOn ? t("Page guide on — I speak up when you open a page", "पेज गाइड चालू — पेज खुलने पर बताता हूँ") : t("Page guide off", "पेज गाइड बंद")}>
                <Compass size={15} />
              </button>
              <button className="btn btn-glass btn-icon !p-2" onClick={() => a.setVoice(!a.voice)} aria-label={a.voice ? t("Mute voice", "आवाज़ बंद") : t("Read replies aloud", "जवाब बोलकर सुनाएँ")} title={a.voice ? t("Mute voice", "आवाज़ बंद") : t("Read replies aloud", "जवाब बोलकर सुनाएँ")}>
                {a.voice ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
              <button className="btn btn-glass btn-icon !p-2" onClick={onClose} aria-label={t("Close", "बंद करें")}>
                <X size={15} />
              </button>
              <div className="w-full text-xs text-[var(--color-ink-3)]">{t("Ask, or tell me what to do — I can open, show, fill and record.", "पूछें, या बताएँ क्या करना है — मैं खोल, दिखा, भर और दर्ज कर सकता हूँ।")}</div>
            </div>
            <div ref={listRef} className="scroll-thin flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
              {!a.lines.length && (
                <div className="space-y-3 pt-2">
                  <button className="btn btn-primary w-full justify-center" onClick={a.brief}>
                    <Newspaper size={15} /> {t("Brief me on today", "आज की ब्रीफ़िंग सुनें")}
                  </button>
                  <div className="text-xs text-[var(--color-ink-3)]">{t("Or try", "या आज़माएँ")}</div>
                  <div className="flex flex-col gap-1.5">
                    {SUGGEST.slice(1).map(([en, hi]) => (
                      <button key={en} className="rounded-xl bg-[rgb(var(--fg)/0.05)] px-3 py-2 text-left text-sm hover:bg-[rgb(var(--fg)/0.09)]" onClick={() => a.send(t(en, hi))}>
                        {t(en, hi)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {a.lines.map((l) =>
                l.who === "you" ? (
                  <div key={l.id} className="ml-10 rounded-2xl rounded-br-md bg-[color-mix(in_srgb,var(--st-bright)_16%,transparent)] px-3 py-2 text-sm">
                    {l.text}
                  </div>
                ) : (
                  <div key={l.id} className={`mr-6 text-sm leading-relaxed ${l.brief ? "border-l-2 border-[var(--st-bright)] pl-3" : ""}`}>
                    <span>{l.text.slice(0, l.shown)}</span>
                    {l.shown < l.text.length && <span className="text-[var(--color-ink-3)]">{l.text.slice(l.shown)}</span>}
                    <Chips tools={l.tools} />
                  </div>
                ),
              )}
              {(a.mode === "thinking" || a.mode === "working" || a.mode === "hearing") && (
                <div className="flex items-center gap-2 text-xs text-[var(--color-ink-3)]">
                  <Loader2 size={13} className="animate-spin" /> {t(...MODE_LABEL[a.mode])}…
                </div>
              )}
            </div>
            <form
              className="flex items-end gap-2 border-t border-[var(--line)] p-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <textarea
                value={a.mode === "listening" || a.mode === "hearing" ? a.heard : text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={1}
                placeholder={t("Ask or tell Jugnu…", "जुगनू से पूछें या कहें…")}
                aria-label={t("Message to Jugnu", "जुगनू के लिए संदेश")}
                className={`${fieldBase} max-h-28 min-h-[40px] min-w-0 flex-1 resize-none !py-2 text-sm`}
              />
              {canTalk && (
                <button
                  type="button"
                  className="btn btn-glass btn-icon !p-2.5"
                  aria-label={t("Speak", "बोलें")}
                  onClick={async () => {
                    const said = await a.listenOnce();
                    if (said) a.send(said);
                  }}
                >
                  <Mic size={16} />
                </button>
              )}
              <button type="submit" className="btn btn-primary btn-icon !p-2.5" disabled={!text.trim()} aria-label={t("Send", "भेजें")}>
                <Send size={16} />
              </button>
            </form>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className={cx("fixed bottom-[calc(92px+env(safe-area-inset-bottom))] right-3 z-[62] flex flex-col items-end gap-2 lg:bottom-5 lg:right-5", !open && !active && !linger && "max-lg:hidden")}>
        <AnimatePresence>
          {!open && bubble && (
            <motion.div
              key={bubble.who}
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className="glass-strong relative mr-1 max-w-[min(320px,calc(100vw-40px))] rounded-2xl rounded-br-md px-3.5 py-2.5 text-[14px] leading-snug shadow-xl"
              aria-live="polite"
            >
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-3)]">
                <span className={`h-1.5 w-1.5 rounded-full ${bubble.who === "you" ? "bg-[#9cf06b]" : "bg-[#ffd56b]"} ${active ? "animate-pulse" : ""}`} />
                {bubble.who === "you" ? t("You", "आप") : t("Jugnu", "जुगनू")}
                <button className="-mr-1 ml-auto rounded p-0.5 hover:bg-[rgb(var(--fg)/0.08)]" onClick={() => setHidden(true)} aria-label={t("Hide", "छिपाएँ")}>
                  <X size={12} />
                </button>
              </div>
              {bubble.text && (
                <p className={bubble.who === "you" ? "italic text-[var(--color-ink-2)]" : ""}>
                  {bubble.who === "you" ? `“${bubble.text}”` : bubble.text}
                  {bubble.rest && <span className="text-[var(--color-ink-3)] opacity-60">{bubble.rest}</span>}
                </p>
              )}
              {bubble.note && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-ink-3)]">
                  {(a.mode === "hearing" || a.mode === "thinking" || a.mode === "working") && <Loader2 size={12} className="animate-spin" />}
                  {bubble.note}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {/* just the orb, with two small helpers beside it — no pill, no ring. On a phone it only appears
            while Jugnu is in use, so it never sits on the cards; the top bar's Ask button opens Jugnu there. */}
        <div className="group flex items-center gap-1.5">
          {active ? (
            <button className="dock-mini" onClick={a.hangUp} aria-label={t("Stop", "रोकें")} title={t("Stop", "रोकें")}>
              {a.mode === "listening" ? <MicOff size={16} /> : <Square size={14} />}
            </button>
          ) : (
            <button className={cx("dock-mini !hidden sm:!grid", !open && "lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:focus-visible:opacity-100")} onClick={a.brief} aria-label={t("Brief me", "ब्रीफ़ करो")} title={t("Brief me", "ब्रीफ़ करो")}>
              <Newspaper size={16} />
            </button>
          )}
          <button className={cx("dock-mini !hidden sm:!grid", !open && !active && "lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:focus-visible:opacity-100")} onClick={open ? onClose : onOpen} aria-label={open ? t("Close chat", "चैट बंद") : t("Chat with Jugnu", "जुगनू से चैट")} title={open ? t("Close chat", "चैट बंद") : t("Chat with Jugnu", "जुगनू से चैट")}>
            <MessageCircle size={16} />
          </button>
          <button
            className="dock-orb relative grid h-[60px] w-[60px] place-items-center rounded-full"
            onClick={onOrb}
            aria-label={a.handsFree ? t("Stop talking to Jugnu", "जुगनू से बात बंद करें") : a.mode === "speaking" ? t("Cut in", "बीच में बोलें") : t("Talk to Jugnu", "जुगनू से बात करें")}
            title={t(...MODE_LABEL[a.handsFree && a.mode === "off" ? "listening" : a.mode])}
          >
            <Orb mode={a.mode} level={a.levelNow} size={72} fallback={<Swarm mode={a.mode} level={a.levelNow} size={60} />} />
          </button>
        </div>
      </div>
    </div>
  );
}
