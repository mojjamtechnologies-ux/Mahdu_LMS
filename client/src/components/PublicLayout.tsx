import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PreferenceControls from "./PreferenceControls";
import { navKey } from "../i18n";
import { usePublic } from "../lib/useFetch";
import type { SiteData } from "../lib/types";
import PoweredBy from "./PoweredBy";
import Logo from "./Logo";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/about", label: "About us" },
  { to: "/academics", label: "Academics" },
  { to: "/facilities", label: "Facilities" },
  { to: "/admissions", label: "Admissions" },
  { to: "/news", label: "News and events" },
  { to: "/contact", label: "Contact us" },
];

export default function PublicLayout() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const site = usePublic<SiteData>("/public/site").data;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b-4 border-gold-400 bg-brand-500 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Link
            to="/"
            className="font-display text-xl font-bold leading-tight sm:text-2xl"
          >
            [School Name]
          </Link>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="public-nav"
            className="whitespace-nowrap rounded-md border border-white/60 px-3 py-1.5 text-sm font-medium lg:hidden"
          >
            {open ? t("actions.close") : t("actions.menu")}
          </button>
          <nav
            id="public-nav"
            aria-label={t("shell.mainMenu")}
            className={`${open ? "flex" : "hidden"} absolute inset-x-0 top-[3.6rem] z-20 flex-col gap-1 bg-brand-700 p-3 lg:static lg:flex lg:flex-row lg:items-center lg:bg-transparent lg:p-0`}
          >
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium ${isActive ? "bg-gold-400 text-brand-900" : "hover:bg-white/10"}`
                }
              >
                {t(navKey(n.label), { defaultValue: n.label })}
              </NavLink>
            ))}
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="rounded-md bg-gold-400 px-4 py-2 text-center text-sm font-semibold text-brand-900 hover:bg-gold-500 lg:ms-2"
            >
              {t("public.signIn")}
            </Link>
            <PreferenceControls variant="compact" onDark />
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="bg-brand-900 text-brand-100">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 text-sm sm:grid-cols-3">
          <div>
            <p className="font-display text-lg font-bold text-white">
              <Logo />
            </p>
            <address className="mt-2 not-italic">[School Address]</address>
            <PoweredBy className="mt-2" />
          </div>
          <div>
            <p className="font-semibold text-white">{t("public.getInTouch")}</p>
            <ul className="mt-2 space-y-1">
              {site?.contact.phone && <li>{t("public.phone")}: <bdi>{site.contact.phone}</bdi></li>}
              {site?.contact.email && <li>{t("public.email")}: <bdi>{site.contact.email}</bdi></li>}
              {site?.contact.officeHours && <li>{site.contact.officeHours}</li>}
              <li>
                <Link className="underline" to="/contact">
                  {t("public.contactPage")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white">{t("public.quickLinks")}</p>
            <ul className="mt-2 space-y-1">
              <li>
                <Link className="underline" to="/admissions/apply">
                  {t("public.apply")}
                </Link>
              </li>
              <li>
                <Link className="underline" to="/admissions/status">
                  {t("public.checkApplication")}
                </Link>
              </li>
              <li>
                <Link className="underline" to="/privacy">
                  {t("public.privacy")}
                </Link>
              </li>
              <li>
                <Link className="underline" to="/login">
                  {t("public.portalSignIn")}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
