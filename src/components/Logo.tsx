// The Jugnu mark: a glass firefly carrying its own warm light, on a midnight tile — learning that
// carries its own light. Rendered with Gemini 3 Pro Image; same artwork as the app icons in public/.
import { cx } from "./ui";

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return <img src="/logo-mark.png" width={size} height={size} alt="" aria-hidden draggable={false} className={cx("shrink-0 select-none", className)} />;
}

export function Wordmark({ size = 34, sub, className }: { size?: number; sub?: string; className?: string }) {
  return (
    <span className={cx("flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <span className="leading-none">
        <span className="font-display text-[1.15rem] font-bold tracking-tight">
          Jugnu <span className="font-deva text-sm font-semibold text-[var(--color-ink-3)]">जुगनू</span>
        </span>
        {sub && <span className="mt-1 block text-[11px] font-medium text-[var(--color-ink-3)]">{sub}</span>}
      </span>
    </span>
  );
}
