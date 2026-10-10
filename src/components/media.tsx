// Video building blocks: cinematic hero backgrounds, hover-to-play video cards, and a guided
// tutorial player. Every clip degrades gracefully: if a file is missing, the gradient/3D
// background shows instead — the page never breaks.
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { speak, stopSpeaking } from "../lib/speech";
import { cx } from "./ui";

export function useVideoAvailable(src?: string) {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    if (!src) return setOk(false);
    let alive = true;
    fetch(src, { method: "HEAD" })
      .then((r) => alive && setOk(r.ok && (r.headers.get("content-type") ?? "").startsWith("video")))
      .catch(() => alive && setOk(false));
    return () => {
      alive = false;
    };
  }, [src]);
  return ok;
}

export function BackgroundVideo({ src, className, opacity = 0.62 }: { src: string; className?: string; opacity?: number }) {
  const ok = useVideoAvailable(src);
  if (!ok) return null;
  return <video className={cx("hero-video", className)} style={{ opacity }} src={src} autoPlay muted loop playsInline preload="auto" aria-hidden />;
}

/** Full-bleed cinematic hero: video + gradient shade + optional 3D layer + content. */
export function HeroMedia({ video, children, layer, className }: { video: string; children: ReactNode; layer?: ReactNode; className?: string }) {
  return (
    <section className={cx("glass-strong relative overflow-hidden", className)}>
      <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
        <div className="absolute inset-0" style={{ background: "var(--grad-soft)" }} />
        <BackgroundVideo src={video} />
        <div className="hero-shade" />
        {layer && <div className="absolute inset-0">{layer}</div>}
      </div>
      <div className="relative">{children}</div>
    </section>
  );
}

export interface Clip {
  src: string;
  title: string;
  caption: string;
  captionHi?: string;
}

export function VideoCard({ clip, index, onOpen }: { clip: Clip; index?: number; onOpen?: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const ok = useVideoAvailable(clip.src);
  return (
    <button
      className="glass glass-hover group block overflow-hidden text-left"
      onMouseEnter={() => ref.current?.play().catch(() => {})}
      onMouseLeave={() => ref.current?.pause()}
      onClick={onOpen}
    >
      <div className="relative aspect-video overflow-hidden rounded-t-[1.6rem]" style={{ background: "var(--grad-soft)" }}>
        {ok && <video ref={ref} src={clip.src} muted loop playsInline preload="metadata" className="mono-gray h-full w-full object-cover opacity-90 transition group-hover:scale-105" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        {index !== undefined && <span className="absolute left-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-xs font-bold backdrop-blur">{index + 1}</span>}
        <span className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur transition group-hover:bg-white/30">
          <Play size={15} aria-hidden />
        </span>
      </div>
      <div className="p-4">
        <div className="font-display font-bold">{clip.title}</div>
        <div className="mt-1 text-sm text-[var(--color-ink-2)]">{clip.caption}</div>
      </div>
    </button>
  );
}

/** Guided tutorial: plays the clips in order with captions (and optional Hindi narration). */
export function TutorialPlayer({ clips, open, onClose, start = 0 }: { clips: Clip[]; open: boolean; onClose: () => void; start?: number }) {
  const [i, setI] = useState(start);
  const [playing, setPlaying] = useState(true);
  const [narrate, setNarrate] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const clip = clips[i];
  const ok = useVideoAvailable(clip?.src);

  useEffect(() => setI(start), [start, open]);
  useEffect(() => {
    if (!open) return stopSpeaking();
    if (narrate && clip?.captionHi) speak(clip.captionHi, "hi-IN");
    else if (narrate) speak(clip.caption, "en-IN");
  }, [i, open, narrate, clip]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => Math.min(clips.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, clips.length, onClose]);
  // Without a video file, advance on a timer so the tour still works.
  useEffect(() => {
    if (!open || ok !== false || !playing) return;
    const t = window.setTimeout(() => setI((x) => (x + 1) % clips.length), 6000);
    return () => window.clearTimeout(t);
  }, [open, ok, playing, i, clips.length]);

  return (
    <AnimatePresence>
      {open && clip && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="glass-strong w-full max-w-5xl overflow-hidden" initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="relative aspect-video overflow-hidden rounded-t-[1.8rem]" style={{ background: "var(--grad-soft)" }}>
              {ok ? (
                <video
                  key={clip.src}
                  ref={video}
                  src={clip.src}
                  autoPlay
                  muted
                  playsInline
                  className="mono-gray h-full w-full object-cover"
                  onEnded={() => setI((x) => (x + 1 < clips.length ? x + 1 : x))}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                />
              ) : (
                <div className="grid h-full place-items-center text-sm text-[var(--color-ink-3)]">Video for this step is being generated — caption below.</div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-6 pt-20">
                <div className="label">
                  Step {i + 1} of {clips.length}
                </div>
                <div className="font-display text-2xl font-bold md:text-3xl">{clip.title}</div>
                <p className="mt-1 max-w-3xl text-sm text-white/85 md:text-base">{clip.caption}</p>
                {clip.captionHi && <p className="mt-1 max-w-3xl font-deva text-sm text-white/65">{clip.captionHi}</p>}
              </div>
              <button className="btn btn-glass absolute right-3 top-3 !p-2" onClick={onClose} aria-label="Close tutorial">
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 p-4">
              <button className="btn btn-glass" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}>
                <ChevronLeft size={16} /> Back
              </button>
              <button
                className="btn btn-glass"
                onClick={() => {
                  if (!video.current) return setPlaying((p) => !p);
                  if (video.current.paused) video.current.play();
                  else video.current.pause();
                }}
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button className="btn btn-primary" onClick={() => setI((x) => Math.min(clips.length - 1, x + 1))} disabled={i === clips.length - 1}>
                Next <ChevronRight size={16} />
              </button>
              <button className="btn btn-glass" onClick={() => setNarrate((n) => !n)} title="Read captions aloud">
                {narrate ? <Volume2 size={16} /> : <VolumeX size={16} />} Narration
              </button>
              <div className="ml-auto flex gap-1.5">
                {clips.map((_, k) => (
                  <button key={k} onClick={() => setI(k)} aria-label={`Step ${k + 1}`} className={cx("h-2 rounded-full transition-all", k === i ? "w-8 bg-white" : "w-2 bg-white/30 hover:bg-white/60")} />
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
