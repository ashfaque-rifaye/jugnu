// The Jugnu film: one Veo 3.1 cut with the music and ambient sound inside the video, and the
// narration as a separate track per language, kept in step with the picture. Captions come
// from the same timings, so switching English ↔ Hindi never reloads the film.
import { AnimatePresence, motion } from "framer-motion";
import { Captions, CaptionsOff, Pause, Play, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { hushJugnu } from "../lib/agent";
import { usePrefs, useT } from "../lib/prefs";
import { cx } from "./ui";

export const FILM = { video: "/film/jugnu-film.mp4", poster: "/film/poster.jpg", cues: "/film/cues.json" };
type Voice = "en" | "hi" | "off";
type Cue = [number, number, string];

/** Chapters start where their shot does (8 s shots, 0.6 s crossfades). */
export const CHAPTERS: { at: number; thumb: string; en: string; hi: string }[] = [
  { at: 0, thumb: "/film/ch-1.jpg", en: "Schools doing well exist", hi: "अच्छे स्कूल हैं" },
  { at: 14.8, thumb: "/film/ch-2.jpg", en: "The officer's problem", hi: "अधिकारी की मुश्किल" },
  { at: 22.2, thumb: "/film/ch-3.jpg", en: "Find", hi: "खोजें" },
  { at: 37, thumb: "/film/ch-4.jpg", en: "Verify", hi: "जाँचें" },
  { at: 44.4, thumb: "/film/ch-5.jpg", en: "Ask the teachers", hi: "शिक्षकों से पूछें" },
  { at: 59.2, thumb: "/film/ch-6.jpg", en: "Spread", hi: "फैलाएँ" },
  { at: 74, thumb: "/film/ch-7.jpg", en: "Track", hi: "ट्रैक करें" },
];

let cueCache: Promise<Record<"en" | "hi", Cue[]>> | null = null;
const loadCues = () =>
  (cueCache ??= fetch(FILM.cues)
    .then((r) => r.json())
    .then((j: { cues: Record<"en" | "hi", Cue[]> }) => j.cues)
    .catch(() => ({ en: [], hi: [] })));

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function FilmPlayer({ open, onClose, start = 0 }: { open: boolean; onClose: () => void; start?: number }) {
  const t = useT();
  const { lang } = usePrefs();
  const video = useRef<HTMLVideoElement>(null);
  const voiceEl = useRef<HTMLAudioElement>(null);
  const [voice, setVoice] = useState<Voice>(lang);
  const [cc, setCc] = useState(true);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [now, setNow] = useState(0);
  const [length, setLength] = useState(101.3);
  const [cues, setCues] = useState<Record<"en" | "hi", Cue[]>>({ en: [], hi: [] });

  useEffect(() => {
    if (open) void loadCues().then(setCues);
  }, [open]);
  useEffect(() => setVoice(lang), [lang, open]);

  // Keep the narration on the picture's clock: follow play, pause, seeks and stalls; correct drift.
  const follow = useCallback(
    (force = false) => {
      const v = video.current;
      const a = voiceEl.current;
      if (!v || !a || voice === "off") return;
      if (force || Math.abs(a.currentTime - v.currentTime) > 0.25) a.currentTime = v.currentTime;
      if (v.paused || v.seeking || v.readyState < 3) a.pause();
      else if (a.paused) void a.play().catch(() => {});
    },
    [voice],
  );

  useEffect(() => {
    if (!open) return;
    hushJugnu(true);
    return () => hushJugnu(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const v = video.current;
    if (!v) return;
    v.currentTime = start;
    setEnded(false);
    void v.play().catch(() => setPlaying(false));
    return () => {
      v.pause();
      voiceEl.current?.pause();
    };
  }, [open, start]);

  // A new narration language picks up exactly where the film is.
  useEffect(() => {
    const a = voiceEl.current;
    if (!a) return;
    if (voice === "off") return a.pause();
    a.load();
    const go = () => follow(true);
    a.addEventListener("loadedmetadata", go, { once: true });
    return () => a.removeEventListener("loadedmetadata", go);
  }, [voice, follow]);

  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      if (v.ended || ended) v.currentTime = 0;
      setEnded(false);
      void v.play();
    } else v.pause();
  }, [ended]);

  const seek = (s: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(length - 0.1, s));
    setEnded(false);
    if (v.paused) void v.play().catch(() => {});
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === " " || e.key === "k") (e.preventDefault(), toggle());
      else if (e.key === "ArrowRight") seek(now + 5);
      else if (e.key === "ArrowLeft") seek(now - 5);
      else if (e.key === "c") setCc((x) => !x);
      else if (e.key === "m") setMuted((x) => !x);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const capLang: "en" | "hi" = voice === "off" ? lang : voice;
  const cue = cc ? cues[capLang].find(([a, b]) => now >= a - 0.1 && now <= b + 0.5) : undefined;
  const chapter = CHAPTERS.reduce((k, c, i) => (now >= c.at - 0.05 ? i : k), 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="on-dark fixed inset-0 z-[70] grid place-items-center bg-black/85 p-3 backdrop-blur-xl md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal
          aria-label={t("The Jugnu film", "जुगनू की फ़िल्म")}
        >
          <motion.div className="w-full max-w-6xl" initial={{ scale: 0.97, y: 10 }} animate={{ scale: 1, y: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="group relative aspect-video overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10">
              <video
                ref={video}
                src={FILM.video}
                poster={FILM.poster}
                playsInline
                preload="auto"
                muted={muted}
                className="h-full w-full object-cover"
                onClick={toggle}
                onPlay={() => (setPlaying(true), follow(true))}
                onPause={() => (setPlaying(false), follow())}
                onWaiting={() => voiceEl.current?.pause()}
                onPlaying={() => follow(true)}
                onSeeked={() => follow(true)}
                onTimeUpdate={(e) => (setNow(e.currentTarget.currentTime), follow())}
                onLoadedMetadata={(e) => setLength(e.currentTarget.duration || 101.3)}
                onEnded={() => (setEnded(true), voiceEl.current?.pause())}
              />
              {voice !== "off" && <audio ref={voiceEl} src={`/film/narration-${voice}.m4a`} preload="auto" muted={muted} />}

              <AnimatePresence mode="wait">
                {cue && (
                  <motion.p
                    key={cue[0] + capLang}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className={cx(
                      "pointer-events-none absolute inset-x-0 bottom-[8%] mx-auto max-w-[86%] text-balance text-center text-[13px] font-semibold leading-snug text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.9),0_0_18px_rgb(0_0_0/0.6)] sm:text-lg md:text-[22px]",
                      capLang === "hi" && "font-deva",
                    )}
                  >
                    {cue[2]}
                  </motion.p>
                )}
              </AnimatePresence>

              {(!playing || ended) && (
                <button className="absolute inset-0 grid place-items-center bg-black/25" onClick={toggle} aria-label={ended ? t("Watch again", "फिर से देखें") : t("Play", "चलाएँ")}>
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-white/15 ring-1 ring-white/30 backdrop-blur-md transition hover:scale-105 hover:bg-white/25">
                    {ended ? <RotateCcw size={26} /> : <Play size={28} className="translate-x-0.5" />}
                  </span>
                </button>
              )}
              <button className="btn btn-glass absolute right-3 top-3 !p-2 opacity-80 hover:opacity-100" onClick={onClose} aria-label={t("Close the film", "फ़िल्म बंद करें")}>
                <X size={16} />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-3 px-1">
              <button className="btn btn-glass !p-2" onClick={toggle} aria-label={playing ? t("Pause", "रोकें") : t("Play", "चलाएँ")}>
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <span className="w-10 text-right text-xs tabular-nums text-white/70">{clock(now)}</span>
              <div className="relative h-6 flex-1">
                <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/15">
                  <div className="h-full rounded-full bg-[var(--st-bright,#ffd56b)]" style={{ width: `${(now / length) * 100}%` }} />
                </div>
                {CHAPTERS.slice(1).map((c) => (
                  <span key={c.at} className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded bg-white/40" style={{ left: `${(c.at / length) * 100}%` }} />
                ))}
                <input
                  type="range"
                  min={0}
                  max={length}
                  step={0.1}
                  value={now}
                  onChange={(e) => seek(Number(e.target.value))}
                  className="absolute inset-0 w-full cursor-pointer opacity-0"
                  aria-label={t("Seek", "आगे-पीछे करें")}
                />
              </div>
              <span className="w-10 text-xs tabular-nums text-white/50">{clock(length)}</span>
              <button className="btn btn-glass !p-2" onClick={() => setMuted((m) => !m)} aria-label={muted ? t("Sound on", "आवाज़ चालू") : t("Mute", "आवाज़ बंद")}>
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <button className="btn btn-glass !p-2" onClick={() => setCc((c) => !c)} aria-pressed={cc} aria-label={t("Captions", "कैप्शन")}>
                {cc ? <Captions size={16} /> : <CaptionsOff size={16} />}
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 px-1">
              <div className="flex items-center gap-1 rounded-full bg-white/[0.07] p-1 text-xs" role="radiogroup" aria-label={t("Narration", "आवाज़")}>
                <span className="px-2 text-white/50">{t("Narration", "आवाज़")}</span>
                {(
                  [
                    ["en", "English"],
                    ["hi", "हिंदी"],
                    ["off", t("Off", "बंद")],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    role="radio"
                    aria-checked={voice === k}
                    onClick={() => setVoice(k)}
                    className={cx("rounded-full px-3 py-1 transition", voice === k ? "bg-white text-black" : "text-white/75 hover:bg-white/10", k === "hi" && "font-deva")}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="no-scrollbar -mx-1 flex flex-1 gap-1 overflow-x-auto px-1">
                {CHAPTERS.map((c, i) => (
                  <button
                    key={c.at}
                    onClick={() => seek(c.at)}
                    className={cx("shrink-0 rounded-full px-3 py-1 text-xs transition", i === chapter ? "bg-white/15 text-white" : "text-white/55 hover:bg-white/10 hover:text-white", lang === "hi" && "font-deva")}
                  >
                    {lang === "hi" ? c.hi : c.en}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** A poster card for pages: the film's frame with a play button and its chapters underneath. */
export function FilmCard({ onPlay }: { onPlay: (at?: number) => void }) {
  const t = useT();
  const { lang } = usePrefs();
  return (
    <div className="space-y-3">
      <button onClick={() => onPlay(0)} className="on-dark group relative block aspect-video w-full overflow-hidden rounded-[1.6rem] bg-black text-left ring-1 ring-white/10">
        <img src={FILM.poster} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <span className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/15 ring-1 ring-white/30 backdrop-blur-md transition group-hover:scale-105 group-hover:bg-white/25">
          <Play size={28} className="translate-x-0.5" aria-hidden />
        </span>
        <div className="absolute inset-x-0 bottom-0 p-5">
          <div className="font-display text-xl font-bold md:text-2xl">{t("Jugnu, in under two minutes", "दो मिनट से कम में जुगनू")}</div>
          <div className={cx("mt-1 text-sm text-white/75", lang === "hi" && "font-deva")}>{t("Narrated in English or Hindi · captions", "अंग्रेज़ी या हिंदी में आवाज़ · कैप्शन")}</div>
        </div>
      </button>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {CHAPTERS.map((c) => (
          <button key={c.at} onClick={() => onPlay(c.at)} className="group overflow-hidden rounded-xl bg-[var(--inset-bg)] text-left">
            <img src={c.thumb} alt="" loading="lazy" className="aspect-video w-full object-cover opacity-90 transition group-hover:opacity-100" />
            <div className={cx("truncate px-2 py-1.5 text-xs font-semibold", lang === "hi" && "font-deva")}>{lang === "hi" ? c.hi : c.en}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
