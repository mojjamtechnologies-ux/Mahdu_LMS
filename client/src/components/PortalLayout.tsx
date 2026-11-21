import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { useUnreadCount } from "../lib/useUnread";
import PortalFooter from "./PortalFooter";
import Logo from "./Logo";
import Avatar from "./Avatar";
import PreferenceControls from "./PreferenceControls";
import { navKey } from "../i18n";

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  badge?: number;
}

function Badge({ n }: { n?: number }) {
  const { t } = useTranslation();
  if (!n) return null;
  return (
    <span
      aria-label={t("shell.unread", { count: n })}
      className="ms-2 inline-block min-w-[1.4rem] rounded-full bg-gold-400 px-1.5 py-0.5 text-center text-xs font-bold text-brand-900"
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

export default function PortalLayout({
  roleLabel,
  nav,
  notificationsPath,
}: {
  roleLabel: string;
  nav: NavItem[];
  notificationsPath?: string;
}) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount(!!notificationsPath);
  const items: NavItem[] = notificationsPath
    ? [...nav, { to: notificationsPath, label: "Notifications", badge: unread }]
    : nav;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <header className="flex items-center justify-between gap-2 border-b-4 border-gold-400 bg-brand-500 px-4 py-3 text-white lg:hidden">
        <span className="min-w-0 font-display text-base font-bold leading-tight">
          [School Name]
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <PreferenceControls variant="compact" onDark />
          {notificationsPath && (
            <NavLink
              to={notificationsPath}
              className="whitespace-nowrap rounded-md border border-white/60 px-3 py-1.5 text-sm font-medium"
            >
              {t("shell.notices")}
              <Badge n={unread} />
            </NavLink>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="portal-nav"
            className="whitespace-nowrap rounded-md border border-white/60 px-3 py-1.5 text-sm font-medium"
          >
            {open ? t("actions.close") : t("actions.menu")}
          </button>
        </div>
      </header>

      <aside
        id="portal-nav"
        className={`${open ? "block" : "hidden"} flex-col bg-brand-700 text-white lg:sticky lg:top-0 lg:flex lg:h-screen`}
      >
        <div className="hidden border-b-4 border-gold-400 px-5 py-5 lg:block">
          <p className="font-display text-xl font-bold leading-tight">
            <Logo size={32} />
          </p>
          <p className="mt-1 text-sm text-brand-100">{t(`roles.${user?.role ?? "admin"}`, { defaultValue: roleLabel })}</p>
        </div>
        <nav aria-label={t("shell.mainMenu")} className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium ${isActive ? "bg-gold-400 text-brand-900" : "text-brand-100 hover:bg-white/10"}`
              }
            >
              <span>{t(navKey(n.label), { defaultValue: n.label })}</span>
              {n.badge ? (
                <span
                  aria-label={t("shell.unread", { count: n.badge })}
                  className="min-w-[1.4rem] rounded-full bg-gold-400 px-1.5 py-0.5 text-center text-xs font-bold text-brand-900"
                >
                  {n.badge > 99 ? "99+" : n.badge}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/20 p-4 text-sm">
          {user && (
            <NavLink to={`/${user.role}/profile`} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-md p-1 hover:bg-white/10">
              <Avatar userId={user.id} name={`${user.firstName} ${user.lastName}`} version={user.avatarVersion} size={40} className="border-2 border-gold-400" />
              <span className="min-w-0">
                <span className="block truncate font-medium">{user.firstName} {user.lastName}</span>
                <span className="block truncate text-xs text-brand-100">{t(navKey("My profile"))}</span>
              </span>
            </NavLink>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            <button onClick={logout} className="rounded-md border border-white/60 px-3 py-1.5 font-medium hover:bg-white/10">
              {t("actions.signOut")}
            </button>
            <PreferenceControls variant="compact" onDark />
          </div>
        </div>
      </aside>

      <main className="min-w-0 p-5 sm:p-8">
        <Outlet />
        <PortalFooter />
      </main>
    </div>
  );
}
