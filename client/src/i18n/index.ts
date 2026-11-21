import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enCommon from "../locales/en/common.json";
import enNav from "../locales/en/nav.json";
import enAuth from "../locales/en/auth.json";
import enProfile from "../locales/en/profile.json";
import enIdcards from "../locales/en/idcards.json";
import enClasses from "../locales/en/classes.json";
import arCommon from "../locales/ar/common.json";
import arNav from "../locales/ar/nav.json";
import arAuth from "../locales/ar/auth.json";
import arProfile from "../locales/ar/profile.json";
import arIdcards from "../locales/ar/idcards.json";
import arClasses from "../locales/ar/classes.json";

export const LANGS = ["en", "ar"] as const;
export type Lang = (typeof LANGS)[number];
const KEY = "mr_lang"; // independent of the theme setting (mr_theme)
export const dirOf = (l: string) => (l === "ar" ? "rtl" : "ltr");

const stored = (): Lang => {
  try {
    const v = localStorage.getItem(KEY);
    return v === "ar" || v === "en" ? v : "en"; // English for first-time visitors
  } catch {
    return "en";
  }
};

// Sets <html lang> and <html dir>. Everything that needs to flip for Arabic (the layout, the sidebar, forms, tables) follows dir="rtl".
function applyDocument(l: string) {
  const root = document.documentElement;
  root.lang = l;
  root.dir = dirOf(l);
}

void i18n.use(initReactI18next).init({
  lng: stored(),
  fallbackLng: "en",
  ns: ["common", "nav", "auth", "profile", "idcards", "classes"],
  defaultNS: "common",
  resources: {
    en: { common: enCommon, nav: enNav, auth: enAuth, profile: enProfile, idcards: enIdcards, classes: enClasses },
    ar: { common: arCommon, nav: arNav, auth: arAuth, profile: arProfile, idcards: arIdcards, classes: arClasses },
  },
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
});
applyDocument(i18n.language);
i18n.on("languageChanged", applyDocument);

export function setLanguage(l: Lang) {
  try { localStorage.setItem(KEY, l); } catch { /* private mode */ }
  void i18n.changeLanguage(l);
}

export default i18n;

/** Translation key for a navigation label written in English, e.g. "Sessions and terms" -> "nav:sessions_and_terms". */
export const navKey = (label: string) => `nav:${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
