import { Contrast, Palette } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "vibrant" | "mono";
const KEY = "jugnu-theme";

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({ theme: "vibrant", setTheme: () => {} });

export function ThemeProvider({ children, fallback = "vibrant" }: { children: ReactNode; fallback?: Theme }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(KEY);
      return saved === "mono" || saved === "vibrant" ? saved : fallback;
    } catch {
      return fallback;
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* private mode — fine */
    }
  }, [theme]);
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex items-center rounded-full border border-white/12 bg-black/30 p-0.5" role="radiogroup" aria-label="Colour theme">
      {(
        [
          ["vibrant", "Vibrant", Palette],
          ["mono", "Black & white", Contrast],
        ] as const
      ).map(([t, label, Icon]) => (
        <button
          key={t}
          role="radio"
          aria-checked={theme === t}
          title={label}
          onClick={() => setTheme(t)}
          className={`grid h-7 w-7 place-items-center rounded-full transition ${theme === t ? "bg-white/20 text-white" : "text-[var(--color-ink-3)] hover:text-white"}`}
        >
          <Icon size={14} aria-hidden />
        </button>
      ))}
    </div>
  );
}
