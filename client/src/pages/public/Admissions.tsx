import { Link } from "react-router-dom";
import { Block, Loading, Page } from "./Shared";
import { Paragraphs } from "../../components/Paragraphs";
import type { SiteData } from "../../lib/types";
import { usePageTitle } from "../../lib/usePageTitle";
import { usePublic } from "../../lib/useFetch";
import { useTranslation } from "react-i18next";

export default function Admissions() {
  const { t } = useTranslation("public");
  usePageTitle(t("admissions.title"));
  const s = usePublic<SiteData>("/public/site");
  if (!s.data) return <Loading loading={s.loading} error={s.error} />;
  const a = s.data.content.admissions;
  return (
    <Page title={t("admissions.title")} intro={a.openNote}>
      <Block title={t("admissions.how")}>
        <Paragraphs text={a.intro} />
      </Block>
      <Block title={t("admissions.need")}>
        <ul className="list-disc space-y-1 pl-6">
          {a.requirements.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </Block>
      <Block title={t("admissions.after")}>
        <Paragraphs text={a.process} />
      </Block>
      <div className="flex flex-wrap gap-3">
        <Link
          to="/admissions/apply"
          className="rounded-lg bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600"
        >
          {t("admissions.applyOnline")}
        </Link>
        <Link
          to="/admissions/status"
          className="rounded-lg border border-line px-6 py-3 font-semibold hover:bg-brand-50"
        >
          {t("admissions.check")}
        </Link>
      </div>
    </Page>
  );
}
