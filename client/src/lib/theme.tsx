import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemePref = "light" | "dark" | "system";
const KEY = "mr_theme"; // independent of the language setting (mr_lang)

const read = (): ThemePref => {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "system";
  } catch {
    return "system";
  }
};
const systemDark = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
export const resolveTheme = (p: ThemePref): "light" | "dark" => (p === "system" ? (systemDark() ? "dark" : "light") : p);

// The same logic runs in index.html before the page paints, so there is no flash of the wrong theme. This keeps it in step afterwards.
function apply(p: ThemePref) {
  const t = resolveTheme(p);
  const root = document.documentElement;
  root.classList.toggle("dark", t === "dark");
  root.style.colorScheme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "dark" ? "#0f1510" : "#438f17");
}

interface ThemeState {
  pref: ThemePref;
  resolved: "light" | "dark";
  setPref: (p: ThemePref) => void;
}
const Ctx = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(read);
  const [resolved, setResolved] = useState<"light" | "dark">(() => resolveTheme(read()));

  useEffect(() => {
    apply(pref);
    setResolved(resolveTheme(pref));
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => { apply("system"); setResolved(resolveTheme("system")); };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [pref]);

  // Another tab changed the theme.
  useEffect(() => {
    const on = (e: StorageEvent) => { if (e.key === KEY) setPrefState(read()); };
    window.addEventListener("storage", on);
    return () => window.removeEventListener("storage", on);
  }, []);

  const setPref = useCallback((p: ThemePref) => {
    try { localStorage.setItem(KEY, p); } catch { /* private mode: the choice still applies for this visit */ }
    setPrefState(p);
  }, []);

  const value = useMemo(() => ({ pref, resolved, setPref }), [pref, resolved, setPref]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be used inside ThemeProvider");
  return v;
}
