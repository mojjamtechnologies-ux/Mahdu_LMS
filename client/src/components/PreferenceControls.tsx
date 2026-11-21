import { useTranslation } from "react-i18next";
import { useTheme, type ThemePref } from "../lib/theme";
import { setLanguage, type Lang } from "../i18n";

const THEMES: ThemePref[] = ["light", "dark", "system"];
const LANGS: Lang[] = ["en", "ar"];

// Theme and language are two separate settings: changing one never touches the other.
export default function PreferenceControls({ variant = "full", onDark = false }: { variant?: "full" | "compact"; onDark?: boolean }) {
  const { t, i18n } = useTranslation();
  const { pref, setPref } = useTheme();
  const base = onDark
    ? "border-white/40 text-white hover:bg-white/10"
    : "border-line bg-surface text-ink hover:bg-brand-50";
  const on = onDark ? "bg-gold-400 text-brand-900 border-gold-400" : "bg-brand-500 text-white border-brand-500";
  const lang = i18n.language as Lang;

  if (variant === "compact") {
    // Two small buttons for headers: cycle the theme, switch the language.
    const next = THEMES[(THEMES.indexOf(pref) + 1) % THEMES.length]!;
    return (
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setPref(next)} aria-label={`${t("theme.label")}: ${t(`theme.${pref}`)}`} title={`${t("theme.label")}: ${t(`theme.${pref}`)}`}
          className={`rounded-md border px-2 py-1 text-xs font-medium ${base}`}>
          {pref === "dark" ? "☾" : pref === "light" ? "☀" : "Auto"}
        </button>
        <button type="button" onClick={() => setLanguage(lang === "ar" ? "en" : "ar")} aria-label={t("language.label")}
          className={`rounded-md border px-2 py-1 text-xs font-medium ${base}`}>
          {lang === "ar" ? "EN" : "ع"}
        </button>
      </div>
    );
  }

  const group = (label: string, children: React.ReactNode) => (
    <div role="group" aria-label={label} className="min-w-0">
      <p className={`mb-1 text-xs font-medium ${onDark ? "text-brand-100" : "text-muted"}`}>{label}</p>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
  const btn = (active: boolean, label: string, click: () => void, key: string) => (
    <button key={key} type="button" aria-pressed={active} onClick={click}
      className={`rounded-md border px-2.5 py-1 text-xs font-medium ${active ? on : base}`}>
      {label}
    </button>
  );
  return (
    <div className="space-y-3">
      {group(t("theme.label"), THEMES.map((m) => btn(pref === m, t(`theme.${m}`), () => setPref(m), m)))}
      {group(t("language.label"), LANGS.map((l) => btn(lang === l, t(`language.${l}`), () => setLanguage(l), l)))}
    </div>
  );
}
