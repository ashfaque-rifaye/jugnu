// Jugnu, the assistant: a glowing orb (tap to talk) and a chat panel. Both drive the same agent —
// it briefs the officer (each line appears as it is read aloud), answers from the block's data
// and works the console: goes to pages, opens schools, flies the map, clicks, fills and records.
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, MessageCircle, Mic, MicOff, Newspaper, Send, Square, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DAMOH } from "../engine/district";
import { buildBriefing, clickByLabel, fillField, findSchool, parseCommand, readScreen, TOOL_LABEL } from "../lib/agent";
import { postJSON, useStatus } from "../lib/api";
import { usePrefs, useT } from "../lib/prefs";
import { useRole } from "../lib/role";
import { canListen, listen, stopSpeaking } from "../lib/speech";
import { usePipeline } from "../lib/store";
import { useTheme } from "../lib/theme";
import { fieldBase } from "./kit";

export type Mode = "off" | "listening" | "thinking" | "working" | "speaking" | "error";

// ---------------------------------------------------------------- the orb (WebGL)

type RGB = [number, number, number];
// Firefly light: warm amber and lime glow over deep teal and indigo.
const PALETTE: Record<Mode, [RGB, RGB, RGB]> = {
  off: [[1, 0.78, 0.3], [0.36, 0.84, 0.72], [0.55, 0.6, 1]],
  listening: [[0.84, 1, 0.3], [0.39, 0.82, 1], [1, 0.78, 0.3]],
  thinking: [[0.62, 0.55, 1], [0.39, 0.82, 1], [1, 0.78, 0.3]],
  working: [[1, 0.66, 0.3], [0.84, 1, 0.3], [0.39, 0.82, 1]],
  speaking: [[1, 0.8, 0.32], [0.84, 1, 0.3], [0.39, 0.82, 1]],
  error: [[1, 0.42, 0.42], [1, 0.7, 0.36], [0.6, 0.62, 1]],
};

const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uT; uniform float uAmp; uniform float uSpin; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 tis(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 nr=tis(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=nr.x; p1*=nr.y; p2*=nr.z; p3*=nr.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
mat3 rY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
mat3 rX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
void main(){
  vec2 uv=(gl_FragCoord.xy*2.-uRes)/min(uRes.x,uRes.y);
  float R=.6+uAmp*.07+sin(uT*1.3)*.008;
  float r=length(uv);
  vec3 glowCol=mix(uA,uB,.5+.5*sin(uT*.5));
  float g=exp(-max(r-R,0.)*8.)*(.18+uAmp*.6);
  if(r>=R){ gl_FragColor=vec4(glowCol*g,g*.85); return; }
  float z=sqrt(max(0.,1.-(r*r)/(R*R)));
  vec3 n=vec3(uv/R,z);
  vec3 q=rY(uSpin)*rX(uSpin*.55)*n;
  float t=uT*(.22+uAmp*.8);
  float n1=snoise(q*1.5+vec3(0.,t,t*.3));
  float n2=snoise(q*3.2-vec3(t*.6,-t*.2,t*.4)+n1*.7);
  float f=.5+.5*n1; float h=.5+.5*n2;
  vec3 base=mix(uA,uB,smoothstep(.15,.85,f));
  base=mix(base,uC,smoothstep(.5,.95,h)*.85);
  float fil=pow(1.-abs(n2),10.)*(.45+uAmp*1.5);
  vec3 inner=base*(.18+.7*pow(z,.8))+fil*mix(uB,vec3(1.),.4);
  vec3 core=vec3(.015,.04,.05);
  vec3 col=mix(core,inner,.35+.65*smoothstep(.0,.9,f*.6+h*.4+uAmp*.3));
  float fres=pow(1.-z,2.6);
  col+=mix(uC,vec3(1.),.35)*fres*.95;
  vec3 L=normalize(vec3(-.45,.6,.65));
  col+=pow(max(dot(reflect(-L,n),vec3(0.,0.,1.)),0.),40.)*.9;
  col+=pow(max(dot(reflect(-normalize(vec3(.5,-.6,.6)),n),vec3(0.,0.,1.)),0.),18.)*.12*uB;
  float edge=smoothstep(R,R-.015,r);
  gl_FragColor=vec4(col*edge+glowCol*g*(1.-edge),max(edge,g*.85));
}`;

/** A small sphere of moving light: breathes when idle, leans in while listening, swirls while
 *  thinking and pulses with each spoken word. Falls back to a soft CSS orb without WebGL. */
export function OrbGL({ mode, level, size }: { mode: Mode; level: MutableRefObject<number>; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const c = ref.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.height = Math.round(size * dpr);
    const gl = c.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: true });
    if (!gl) return setFallback(true);
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}"));
    const fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) return setFallback(true);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl.getUniformLocation(prog, n);
    const [uRes, uT, uAmp, uSpin, uA, uB, uC] = ["uRes", "uT", "uAmp", "uSpin", "uA", "uB", "uC"].map(U);
    gl.uniform2f(uRes, c.width, c.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const cols = PALETTE[modeRef.current].map((x) => [...x]);
    let amp = 0;
    let spin = 0;
    let raf = 0;
    const t0 = performance.now();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      const m = modeRef.current;
      level.current *= 0.9;
      const target = m === "listening" || m === "speaking" ? 0.18 + Math.min(0.8, level.current) : m === "thinking" || m === "working" ? 0.32 : 0.06;
      amp += (target - amp) * 0.16;
      spin += reduced ? 0.002 : m === "thinking" || m === "working" ? 0.028 : 0.006 + amp * 0.02;
      const goal = PALETTE[m];
      for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) cols[k][j] += (goal[k][j] - cols[k][j]) * 0.06;
      gl.viewport(0, 0, c.width, c.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uT, reduced ? t * 0.2 : t);
      gl.uniform1f(uAmp, amp);
      gl.uniform1f(uSpin, spin);
      gl.uniform3fv(uA, cols[0]);
      gl.uniform3fv(uB, cols[1]);
      gl.uniform3fv(uC, cols[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, level]);
  if (fallback) return <span className="block rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff6c8,#f5b942_45%,#1d6b62)] shadow-[0_0_24px_#f5b94288]" style={{ width: size * 0.62, height: size * 0.62 }} aria-hidden />;
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />;
}

// ---------------------------------------------------------------- speaking, word by word

function pickVoice(lang: string) {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === lang && /google|natural|online/i.test(v.name)) ?? voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang.startsWith(lang.slice(0, 2)));
}

/** Read a line aloud; onWord fires at each word so the text and the orb keep pace with the voice. */
function sayLine(text: string, lang: string, onWord: (charIndex: number) => void): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = lang.startsWith("hi") ? 0.98 : 1.04;
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.onboundary = (e) => onWord(e.charIndex);
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

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
  const [handsFree, setHandsFree] = useState(false);
  const [heard, setHeard] = useState("");
  const level = useRef(0);
  const history = useRef<ApiMessage[]>([]);
  const busy = useRef(false);
  const stopRef = useRef<(() => void) | null>(null);
  const cancelled = useRef(false);
  const nextId = useRef(1);
  // Live values for async loops (the conversation outlives a render).
  const live = useRef({ state, events, allActions, lang, voice, location, seed, role });
  live.current = { state, events, allActions, lang, voice, location, seed, role };
  const speechLang = () => (live.current.lang === "hi" ? "hi-IN" : "en-IN");

  const patch = (id: number, f: (l: Line) => Line) => setLines((ls) => ls.map((l) => (l.id === id ? f(l) : l)));
  const add = (l: Omit<Line, "id">) => {
    const id = nextId.current++;
    setLines((ls) => [...ls.slice(-60), { ...l, id }]);
    return id;
  };

  /** Show a line of Jugnu's, streaming it in as it is read aloud (or typed out when muted). */
  const speakOut = useCallback(async (text: string, extra: Partial<Line> = {}) => {
    const id = add({ who: "jugnu", text, shown: 0, tools: [], ...extra });
    if (cancelled.current) return patch(id, (l) => ({ ...l, shown: text.length }));
    setMode("speaking");
    if (live.current.voice && "speechSynthesis" in window) {
      let last = 0;
      const typing = setInterval(() => patch(id, (l) => ({ ...l, shown: Math.min(text.length, Math.max(l.shown, last + 6)) })), 120);
      await sayLine(text, speechLang(), (i) => {
        last = i;
        level.current = 0.55 + Math.random() * 0.35;
        const end = text.indexOf(" ", i + 1);
        patch(id, (l) => ({ ...l, shown: Math.max(l.shown, end < 0 ? text.length : end) }));
      });
      clearInterval(typing);
    } else {
      for (let i = 0; i <= text.length && !cancelled.current; i += 3) {
        patch(id, (l) => ({ ...l, shown: i }));
        level.current = 0.4;
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
                return fail("A spot check needs 5–40 children sampled, and how many of them read and subtracted.");
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

  const brief = useCallback(async () => {
    const { state: st, events: ev, lang: l } = live.current;
    const hi = l === "hi";
    const text = buildBriefing(st, ev, t, hi);
    for (const [i, line] of text.entries()) {
      if (cancelled.current) break;
      await speakOut(line, { brief: true, tools: i === 0 ? [{ name: "briefing", ok: true }] : [] });
    }
    history.current.push({ role: "user", content: "Brief me." }, { role: "assistant", content: `${text.join(" ")}
[briefing built from the block's live data]` });
  }, [speakOut, t]);

  /** The officer said or typed something: answer it, doing whatever it takes on screen. */
  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy.current) return;
      busy.current = true;
      cancelled.current = false;
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
            role: r?.kind === "crp" ? "cluster coordinator" : r?.kind === "beo" ? "block officer" : "guest",
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
          const basis = tools.length ? `
[done with tools: ${[...new Set(tools.map((x) => x.name))].join(", ")}]` : "";
          if (said) history.current = [...history.current, { role: "user" as const, content: q }, { role: "assistant" as const, content: said + basis }].slice(-16);
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

  const listenOnce = useCallback(async () => {
    if (!canListen()) {
      setMode("error");
      return null;
    }
    stopSpeaking();
    setMode("listening");
    setHeard("");
    const h = listen(speechLang(), (txt) => {
      setHeard(txt);
      level.current = 0.6;
    });
    stopRef.current = h.stop;
    try {
      return await h.promise;
    } catch {
      return null;
    } finally {
      stopRef.current = null;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Tap the orb: talk, hands-free — it listens again after each answer until you tap to stop. */
  const talk = useCallback(async () => {
    if (handsFree) {
      cancelled.current = true;
      setHandsFree(false);
      stopRef.current?.();
      stopSpeaking();
      setMode("off");
      return;
    }
    setHandsFree(true);
    cancelled.current = false;
    for (let i = 0; i < 12; i++) {
      const said = await listenOnce();
      if (cancelled.current) break;
      if (!said) break;
      await send(said);
      if (cancelled.current) break;
    }
    setHandsFree(false);
    setMode("off");
  }, [handsFree, listenOnce, send]);

  const stop = useCallback(() => {
    cancelled.current = true;
    setHandsFree(false);
    stopRef.current?.();
    stopSpeaking();
    setMode("off");
  }, []);

  const startBrief = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    cancelled.current = false;
    try {
      await brief();
    } finally {
      busy.current = false;
      setMode("off");
    }
  }, [brief]);

  return { mode, lines, voice, setVoice, handsFree, heard, level, send, talk, stop, brief: startBrief, listenOnce, clear: () => (setLines([]), (history.current = [])) };
}

// ---------------------------------------------------------------- the dock and the panel

const MODE_LABEL: Record<Mode, [string, string]> = {
  off: ["Talk", "बोलें"],
  listening: ["Listening", "सुन रहा हूँ"],
  thinking: ["Thinking", "सोच रहा हूँ"],
  working: ["Working", "काम कर रहा हूँ"],
  speaking: ["Speaking", "बोल रहा हूँ"],
  error: ["Paused", "रुका"],
};

const SUGGEST: [string, string][] = [
  ["Brief me", "ब्रीफ़ करो"],
  ["Which schools need help with maths, and who nearby can show them?", "किन स्कूलों को गणित में मदद चाहिए, और पास में कौन दिखा सकता है?"],
  ["Which school has the lowest attendance? Show it on the map.", "सबसे कम उपस्थिति किस स्कूल में है? नक्शे पर दिखाओ।"],
  ["Which actions are stuck, and who owns them?", "कौन-से काम अटके हैं, और किसकी ज़िम्मेदारी है?"],
  ["Open the plan", "योजना खोलो"],
];

function Chips({ tools }: { tools: Line["tools"] }) {
  const t = useT();
  if (!tools.length) return null;
  const seen = new Set<string>();
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {tools
        .filter((x) => (seen.has(x.name + x.ok) ? false : (seen.add(x.name + x.ok), true)))
        .map((x, i) => (
          <span key={i} className={`chip !gap-1 !px-1.5 !py-0 !text-[10px] ${x.ok ? "" : "!text-rose-300"}`}>
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
  const lastJ = useMemo(() => [...a.lines].reverse().find((l) => l.who === "jugnu"), [a.lines]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [a.lines, open]);
  // Other parts of the console can ask Jugnu something ("jugnu:ask" with the question as detail).
  useEffect(() => {
    const h = (e: Event) => {
      const q = (e as CustomEvent<string>).detail;
      onOpen();
      if (q === "brief") a.brief();
      else if (q) a.send(q);
    };
    window.addEventListener("jugnu:ask", h);
    return () => window.removeEventListener("jugnu:ask", h);
  });
  const caption = a.mode === "listening" ? a.heard || t("I'm listening…", "सुन रहा हूँ…") : lastJ && active ? lastJ.text.slice(0, lastJ.shown) : "";
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
            <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-display text-base font-bold leading-tight">{t("Jugnu", "जुगनू")}</div>
                <div className="text-xs text-[var(--color-ink-3)]">{t("Ask, or tell me what to do — I can open, show, fill and record.", "पूछें, या बताएँ क्या करना है — मैं खोल, दिखा, भर और दर्ज कर सकता हूँ।")}</div>
              </div>
              <button className="btn btn-glass btn-icon !p-2" onClick={() => a.setVoice(!a.voice)} aria-label={a.voice ? t("Mute voice", "आवाज़ बंद") : t("Read replies aloud", "जवाब बोलकर सुनाएँ")} title={a.voice ? t("Mute voice", "आवाज़ बंद") : t("Read replies aloud", "जवाब बोलकर सुनाएँ")}>
                {a.voice ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
              <button className="btn btn-glass btn-icon !p-2" onClick={onClose} aria-label={t("Close", "बंद करें")}>
                <X size={15} />
              </button>
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
              {(a.mode === "thinking" || a.mode === "working") && (
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
                value={a.mode === "listening" ? a.heard : text}
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
              {canListen() && (
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

      <div className="fixed bottom-[calc(92px+env(safe-area-inset-bottom))] right-3 z-[62] flex flex-col items-end gap-2 lg:bottom-5 lg:right-5">
        <AnimatePresence>
          {!open && caption && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="glass-strong max-w-[min(340px,calc(100vw-90px))] rounded-2xl px-3.5 py-2.5 text-sm leading-snug" aria-live="polite">
              {a.mode === "listening" ? <span className="italic text-[var(--color-ink-2)]">“{caption}”</span> : caption}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="glass-strong flex items-center gap-1 rounded-full p-1 sm:pl-2">
          {active ? (
            <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-[rgb(var(--fg)/0.08)]" onClick={a.stop} aria-label={t("Stop", "रोकें")} title={t("Stop", "रोकें")}>
              {a.mode === "listening" ? <MicOff size={16} /> : <Square size={14} />}
            </button>
          ) : (
            <button className="hidden h-9 w-9 place-items-center rounded-full hover:bg-[rgb(var(--fg)/0.08)] sm:grid" onClick={a.brief} aria-label={t("Brief me", "ब्रीफ़ करो")} title={t("Brief me", "ब्रीफ़ करो")}>
              <Newspaper size={16} />
            </button>
          )}
          <button className="hidden h-9 w-9 place-items-center rounded-full hover:bg-[rgb(var(--fg)/0.08)] sm:grid" onClick={open ? onClose : onOpen} aria-label={open ? t("Close chat", "चैट बंद") : t("Chat with Jugnu", "जुगनू से चैट")} title={open ? t("Close chat", "चैट बंद") : t("Chat with Jugnu", "जुगनू से चैट")}>
            <MessageCircle size={16} />
          </button>
          <button
            className="relative grid h-14 w-14 place-items-center rounded-full"
            onClick={canListen() ? a.talk : open ? onClose : onOpen}
            aria-label={a.handsFree ? t("Stop talking to Jugnu", "जुगनू से बात बंद करें") : t("Talk to Jugnu", "जुगनू से बात करें")}
            title={t(...MODE_LABEL[a.handsFree && a.mode === "off" ? "listening" : a.mode])}
          >
            <OrbGL mode={a.mode} level={a.level} size={56} />
          </button>
        </div>
      </div>
    </div>
  );
}
