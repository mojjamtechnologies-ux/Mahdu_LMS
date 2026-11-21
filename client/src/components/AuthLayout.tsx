import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PreferenceControls from "./PreferenceControls";
import Logo from "./Logo";

export function AuthLayout({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="flex flex-col justify-between bg-brand-500 p-8 text-white lg:p-14">
        <Link to="/" className="font-display text-2xl font-bold">
          <Logo size={56} />
        </Link>
        <div className="hidden lg:block">
          <p className="font-display text-4xl font-bold leading-tight">
            {t("auth:tagline")}
          </p>
          <div className="mt-8 h-1.5 w-24 rounded-full bg-gold-400" />
        </div>
        <address className="text-sm not-italic text-brand-100">
          [School Address]
        </address>
      </aside>
      <main className="relative flex items-center justify-center p-6 sm:p-12">
        <div className="absolute end-4 top-4"><PreferenceControls variant="compact" /></div>
        <div className="w-full max-w-md">
          <h1 className="font-display text-3xl font-bold">{title}</h1>
          {intro && <p className="mt-2 text-muted">{intro}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
