// Video building blocks: cinematic hero backgrounds. Every clip degrades gracefully: if a file
// is missing, the gradient/3D background shows instead — the page never breaks. The film lives in Film.tsx.
import { useEffect, useState, type ReactNode } from "react";
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
    <section className={cx("glass-strong on-dark relative overflow-hidden", className)}>
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
