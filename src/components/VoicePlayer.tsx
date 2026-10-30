// Listen to a voice note and follow it: the words light up as they are read, with a progress bar,
// pause and stop. Only one note plays at a time, and it stops if you leave the page.
import { Loader2, Pause, Play, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getPasscode } from "../lib/api";
import { usePrefs, useT } from "../lib/prefs";
import { speak, stopSpeaking } from "../lib/speech";
import { cx } from "./ui";

let current: { stop: () => void } | null = null;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function VoicePlayer({ text, lang = "hi", className }: { text: string; lang?: "hi" | "en"; className?: string }) {
  const t = useT();
  const { lang: ui } = usePrefs();
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  const me = useRef({ stop: () => {} });
  // Words light up in proportion to where the audio is: spoken pace is close to even across a note.
  const words = useMemo(() => text.split(/(\s+)/), [text]);
  const total = useMemo(() => text.replace(/\s+/g, "").length || 1, [text]);
  const reached = length ? (time / length) * total : 0;

  const stop = () => {
    const a = audio.current;
    if (a) {
      a.pause();
      a.src = "";
      audio.current = null;
    }
    stopSpeaking();
    setState("idle");
    setTime(0);
  };
  me.current.stop = stop;
  useEffect(
    () => () => {
      me.current.stop();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );

  const play = async () => {
    if (state === "paused" && audio.current) {
      void audio.current.play();
      setState("playing");
      return;
    }
    if (current && current !== me.current) current.stop();
    current = me.current;
    setState("loading");
    try {
      const p = getPasscode();
      const res = await fetch("/api/voice/tts", { method: "POST", headers: { "Content-Type": "application/json", ...(p ? { "x-jugnu-pass": p } : {}) }, body: JSON.stringify({ text, lang }) });
      if (!res.ok) throw new Error(String(res.status));
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(await res.blob());
      const a = new Audio(url.current);
      audio.current = a;
      a.onloadedmetadata = () => setLength(Number.isFinite(a.duration) ? a.duration : 0);
      a.ontimeupdate = () => setTime(a.currentTime);
      a.onended = () => {
        setState("idle");
        setTime(0);
      };
      await a.play();
      setState("playing");
    } catch {
      // No cloud voice here: the browser's own voice still reads it, without the progress.
      setState("playing");
      void speak(text, lang === "hi" ? "hi-IN" : "en-IN").then(() => setState("idle"));
    }
  };
  const pause = () => {
    audio.current?.pause();
    setState("paused");
  };
  const seek = (v: number) => {
    if (audio.current && length) {
      audio.current.currentTime = v * length;
      setTime(v * length);
    }
  };

  let seen = 0;
  const on = state !== "idle";
  return (
    <div className={className}>
      <p className={cx("text-[15px] leading-relaxed", lang === "hi" && "font-deva")}>
        {words.map((w, i) => {
          if (!w.trim()) return w;
          seen += w.length;
          const read = on && length > 0 && seen <= reached;
          const now = on && length > 0 && !read && seen - w.length <= reached;
          return (
            <span key={i} className={cx("rounded-[0.2em] transition-colors duration-150", now ? "bg-[color-mix(in_srgb,var(--st-bright)_38%,transparent)] text-[var(--color-ink)]" : read ? "text-[var(--color-ink)]" : on && length > 0 ? "text-[var(--color-ink-3)]" : undefined)}>
              {w}
            </span>
          );
        })}
      </p>
      <div className="mt-3 flex items-center gap-2">
        {state === "playing" ? (
          <button className="btn btn-glass !px-3 !py-1.5" onClick={pause} aria-label={t("Pause", "रोकें")}>
            <Pause size={14} /> {t("Pause", "रोकें")}
          </button>
        ) : (
          <button className="btn btn-glass !px-3 !py-1.5" onClick={play} disabled={state === "loading"}>
            {state === "loading" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} {state === "paused" ? t("Continue", "जारी रखें") : t("Listen", "सुनें")}
          </button>
        )}
        {on && state !== "loading" && (
          <button className="btn btn-glass btn-icon !p-2" onClick={stop} aria-label={t("Stop", "बंद करें")} title={t("Stop", "बंद करें")}>
            <Square size={13} />
          </button>
        )}
        {on && length > 0 && (
          <>
            <input
              type="range"
              min={0}
              max={1000}
              value={length ? Math.round((time / length) * 1000) : 0}
              onChange={(e) => seek(Number(e.target.value) / 1000)}
              className="voice-range min-w-0 flex-1"
              aria-label={t("Position in the voice note", "वॉइस नोट में स्थिति")}
            />
            <span className={cx("shrink-0 text-xs tabular-nums text-[var(--color-ink-2)]", ui === "hi" && "font-deva")}>
              {clock(time)} / {clock(length)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
