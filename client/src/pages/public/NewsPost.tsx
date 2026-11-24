import { Link, useParams } from "react-router-dom";
import { Loading } from "./Shared";
import { Paragraphs } from "../../components/Paragraphs";
import { mediaSrc } from "../../lib/api";
import { fmtDateTime } from "../../lib/format";
import type { PubPost } from "../../lib/types";
import { usePageTitle } from "../../lib/usePageTitle";
import { usePublic } from "../../lib/useFetch";
import { useTranslation } from "react-i18next";

export default function NewsPost() {
  const { t } = useTranslation("public");
  const { slug = "" } = useParams();
  const p = usePublic<PubPost>(`/public/news/${slug}`);
  usePageTitle(p.data?.title ?? t("newsPost.title"));
  if (p.error)
    return (
      <div className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-lg">{t("newsPost.notFound")}</p>
        <p className="mt-3">
          <Link className="font-medium text-brand-700 underline" to="/news">
            {t("Back to news and events")}
          </Link>
        </p>
      </div>
    );
  if (!p.data) return <Loading loading={p.loading} error="" />;
  const d = p.data;
  return (
    <article className="mx-auto max-w-3xl px-5 py-10">
      <p className="mb-3 text-sm">
        <Link className="font-medium text-brand-700 underline" to="/news">
          {t("newsPost.all")}
        </Link>
      </p>
      <h1 className="font-display text-4xl font-bold">{d.title}</h1>
      <p className="mt-2 text-sm text-muted">{fmtDateTime(d.publishedAt)}</p>
      {d.imageUrl && (
        <img
          src={mediaSrc(d.imageUrl)}
          alt={d.imageAlt}
          className="mt-6 w-full rounded-xl object-cover"
        />
      )}
      <div className="mt-6 space-y-4 text-lg leading-relaxed">
        <Paragraphs text={d.body ?? ""} />
      </div>
    </article>
  );
}
