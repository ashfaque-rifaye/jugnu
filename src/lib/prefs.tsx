// Two user preferences that matter in the field:
// - language: the whole console in Hindi or English (teacher pages default to Hindi);
// - low-data mode: no background video, no 3D, no blur — switched on automatically on slow
//   connections, data-saver, or low-memory phones, and always available as a toggle.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "hi";

interface Prefs {
  lang: Lang;
  setLang: (l: Lang) => void;
  lite: boolean;
  setLite: (v: boolean) => void;
  liteReason: string | null;
}

const Ctx = createContext<Prefs>({ lang: "en", setLang: () => {}, lite: false, setLite: () => {}, liteReason: null });

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
};

function detectLite(): string | null {
  if (typeof navigator === "undefined") return null;
  const c = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (c?.saveData) return "Data saver is on";
  if (c?.effectiveType && ["slow-2g", "2g", "3g"].includes(c.effectiveType)) return `Slow network (${c.effectiveType})`;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  if (mem && mem <= 2) return `Low-memory phone (${mem} GB)`;
  return null;
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (read("jugnu-lang") === "hi" ? "hi" : "en"));
  const liteReason = useMemo(detectLite, []);
  const [lite, setLiteState] = useState<boolean>(() => {
    const saved = read("jugnu-lite");
    return saved === null ? liteReason !== null : saved === "1";
  });
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    write("jugnu-lang", l);
  }, []);
  const setLite = useCallback((v: boolean) => {
    setLiteState(v);
    write("jugnu-lite", v ? "1" : "0");
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang === "hi" ? "hi" : "en";
    document.documentElement.dataset.lite = lite ? "1" : "0";
  }, [lang, lite]);
  return <Ctx.Provider value={{ lang, setLang, lite, setLite, liteReason }}>{children}</Ctx.Provider>;
}

export const usePrefs = () => useContext(Ctx);

/** t("English", "हिंदी") — inline translations keep both languages next to each other in the code. */
export function useT() {
  const { lang } = usePrefs();
  return useCallback((en: string, hi: string) => (lang === "hi" ? hi : en), [lang]);
}
