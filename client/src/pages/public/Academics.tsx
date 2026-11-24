import { Block, Loading, Page } from "./Shared";
import { Paragraphs } from "../../components/Paragraphs";
import type { PubAcademics, SiteData } from "../../lib/types";
import { usePageTitle } from "../../lib/usePageTitle";
import { usePublic } from "../../lib/useFetch";
import { useTranslation } from "react-i18next";

export default function Academics() {
  const { t } = useTranslation("public");
  usePageTitle(t("academics.title"));
  const s = usePublic<SiteData>("/public/site");
  const ac = usePublic<PubAcademics>("/public/academics");
  if (!s.data) return <Loading loading={s.loading} error={s.error} />;
  const c = s.data.content.academics;
  const STAGE = {
    JSS: t("academics.jss"),
    SSS: t("academics.sss"),
  } as const;
  return (
    <Page title={t("academics.title")} intro={c.intro}>
      <div className="grid gap-6 md:grid-cols-2">
        {ac.data?.stages.map((st) => (
          <section
            key={st.stage}
            className="rounded-xl border border-line bg-white p-5"
          >
            <h2 className="font-display text-xl font-bold">
              {STAGE[st.stage]}
            </h2>
            <ul className="mt-3 space-y-3">
              {st.levels.map((l) => (
                <li key={l.year}>
                  <p className="font-semibold">{l.name}</p>
                  {l.subjects.length ? (
                    <p className="text-sm text-muted">
                      {l.subjects.join(", ")}
                    </p>
                  ) : (
                    <p className="text-sm text-muted">
                      {t("academics.noSubjects")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <Block title={t("academics.curriculum")}>
        <Paragraphs text={c.curriculum} />
      </Block>
      <Block title={t("academics.programmes")}>
        <Paragraphs text={c.programmes} />
      </Block>
    </Page>
  );
}
