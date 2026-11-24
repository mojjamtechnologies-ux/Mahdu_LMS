import { useState } from "react";
import { EventItem, Loading, Page, PostCard } from "./Shared";
import { Paragraphs } from "../../components/Paragraphs";
import { SmallButton } from "../../components/ui";
import type { PubEvent, PubPost } from "../../lib/types";
import { usePageTitle } from "../../lib/usePageTitle";
import { usePublic } from "../../lib/useFetch";
import { useTranslation } from "react-i18next";

export default function News() {
  const { t } = useTranslation("public");
  usePageTitle(t("news.title"));
  const [size, setSize] = useState(9);
  const [past, setPast] = useState(false);
  const ann = usePublic<(PubPost & { body: string })[]>(
    "/public/announcements",
  );
  const up = usePublic<PubEvent[]>("/public/events?when=upcoming");
  const old = usePublic<PubEvent[]>(past ? "/public/events?when=past" : null);
  const news = usePublic<{ items: PubPost[]; total: number }>(
    `/public/news?pageSize=${size}`,
  );
  if (!news.data) return <Loading loading={news.loading} error={news.error} />;
  return (
    <Page title={t("news.title")}>
      {!!ann.data?.length && (
        <section aria-labelledby="a-h">
          <h2 id="a-h" className="mb-3 font-display text-2xl font-bold">
            {t("news.announcements")}
          </h2>
          <ul className="space-y-3">
            {ann.data.map((a) => (
              <li
                key={a.slug}
                className="rounded-xl border-l-4 border-gold-500 bg-gold-100 p-4"
              >
                <p className="font-semibold">{a.title}</p>
                {a.body ? (
                  <Paragraphs text={a.body} />
                ) : (
                  a.summary && <p>{a.summary}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="e-h">
        <h2 id="e-h" className="mb-3 font-display text-2xl font-bold">
          {t("news.upcoming")}
        </h2>
        {up.data?.length ? (
          <ul className="space-y-3">
            {up.data.map((e, i) => (
              <EventItem key={i} e={e} />
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-line p-4 text-muted">
            {t("news.noUpcoming")}
          </p>
        )}
        <div className="mt-3">
          {!past ? (
            <SmallButton onClick={() => setPast(true)}>
              {t("news.showEarlierEvents")}
            </SmallButton>
          ) : (
            <>
              <h3 className="mb-2 mt-4 font-semibold">{t("news.earlier")}</h3>
              {old.data?.length ? (
                <ul className="space-y-3">
                  {old.data.map((e, i) => (
                    <EventItem key={i} e={e} />
                  ))}
                </ul>
              ) : (
                <p className="text-muted">{t("news.noEarlier")}</p>
              )}
            </>
          )}
        </div>
      </section>
      <section aria-labelledby="n-h">
        <h2 id="n-h" className="mb-3 font-display text-2xl font-bold">
          {t("news.news")}
        </h2>
        {news.data.items.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {news.data.items.map((p) => (
              <PostCard key={p.slug} p={p} />
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-line p-4 text-muted">
            {t("news.noNews")}
          </p>
        )}
        {news.data.total > news.data.items.length && (
          <div className="mt-4">
            <SmallButton onClick={() => setSize((s) => s + 9)}>
              {t("news.older")}
            </SmallButton>
          </div>
        )}
      </section>
    </Page>
  );
}
