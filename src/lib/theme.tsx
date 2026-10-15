// Light and dark mode. Dark is the original look and the default; light is for daylight,
// projectors and printouts. index.html applies the saved mode before the first paint.
import { Moon, Sun } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Mode = "dark" | "light";
const KEY = "jugnu-mode";
const META = { dark: "#060b14", light: "#f6f5f0" };

const ThemeContext = createContext<{ mode: Mode; setMode: (m: Mode) => void }>({ mode: "dark", setMode: () => {} });

function saved(): Mode {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(saved);
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", META[mode]);
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      /* private mode — fine */
    }
  }, [mode]);
  return <ThemeContext.Provider value={{ mode, setMode }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

export function ThemeToggle({ labels }: { labels?: { dark: string; light: string } }) {
  const { mode, setMode } = useTheme();
  const names = labels ?? { dark: "Dark mode", light: "Light mode" };
  return (
    <div className="flex items-center rounded-full border border-[var(--chip-line)] bg-[var(--chip)] p-0.5" role="radiogroup" aria-label="Colour mode">
      {(
        [
          ["dark", names.dark, Moon],
          ["light", names.light, Sun],
        ] as const
      ).map(([m, label, Icon]) => (
        <button
          key={m}
          role="radio"
          aria-checked={mode === m}
          aria-label={label}
          title={label}
          onClick={() => setMode(m)}
          className={`grid h-7 w-7 place-items-center rounded-full transition ${mode === m ? "seg-on" : "text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"}`}
        >
          <Icon size={14} aria-hidden />
        </button>
      ))}
    </div>
  );
}
