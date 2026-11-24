import { Link } from "react-router-dom";
import { Badge, Card, DataState, Empty, PageHeader } from "../../components/ui";
import { fmtDate, fmtDateTime, naira } from "../../lib/format";
import { useFetch } from "../../lib/useFetch";
import { useTranslation } from "react-i18next";

interface Overview {
  people: { students: number; teachers: number; parents: number };
  studentsByClass: { classId: string; name: string; students: number }[];
  work: {
    openAssignments: number;
    awaitingMarking: number;
    pastDueUnmarked: number;
  };
  applications: {
    waiting: number;
    recent: {
      id: string;
      reference: string;
      name: string;
      applyingFor: string;
      status: string;
      createdAt: string;
    }[];
  };
  fees: {
    term: string;
    billedKobo: number;
    collectedKobo: number;
    outstandingKobo: number;
    studentsOwing: number;
  } | null;
  announcements: {
    id: string;
    title: string;
    pinned: boolean;
    publishedAt: string | null;
  }[];
  recentActions: {
    id: string;
    action: string;
    entityType: string | null;
    createdAt: string;
    actor: string;
  }[];
  attention: { newEnquiries: number; reportedConversations: number | null };
}
const label = (s: string) => s.replace(/[._]/g, " ");
const Big = ({ children }: { children: React.ReactNode }) => (
  <p className="text-2xl font-semibold">{children}</p>
);

export default function AdminDashboard() {
  const { t } = useTranslation("admin");
  const d = useFetch<Overview>("/dashboard/admin");
  return (
    <>
      <PageHeader title={t("dashboard.title")} intro={t("dashboard.intro")} />
      <DataState loading={d.loading} error={d.error}>
        {d.data && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card title={t("dashboard.students")}>
                {<Big>{d.data.people.students}</Big>}
              </Card>
              <Card title={t("dashboard.teachers")}>
                {<Big>{d.data.people.teachers}</Big>}
              </Card>
              <Card title={t("dashboard.parents")}>
                {<Big>{d.data.people.parents}</Big>}
              </Card>
            </div>

            {(d.data.applications.waiting > 0 ||
              d.data.attention.newEnquiries > 0 ||
              (d.data.attention.reportedConversations ?? 0) > 0) && (
              <Card title={t("dashboard.needsAttention")}>
                <ul className="space-y-1 text-sm">
                  {d.data.applications.waiting > 0 && (
                    <li>
                      <Link
                        className="text-brand-700 underline"
                        to="/admin/applications"
                      >
                        {d.data.applications.waiting}{" "}
                        {d.data.applications.waiting === 1
                          ? t("dashboard.applicationToReview")
                          : t("dashboard.applicationsToReview")}
                      </Link>
                    </li>
                  )}
                  {d.data.attention.newEnquiries > 0 && (
                    <li>
                      {d.data.attention.newEnquiries}{" "}
                      {d.data.attention.newEnquiries === 1
                        ? t("dashboard.newWebsiteEnquiry")
                        : t("dashboard.newWebsiteEnquiries")}
                    </li>
                  )}
                  {(d.data.attention.reportedConversations ?? 0) > 0 && (
                    <li>
                      <Link
                        className="text-brand-700 underline"
                        to="/admin/messages/all"
                      >
                        {d.data.attention.reportedConversations}{" "}
                        {d.data.attention.reportedConversations === 1
                          ? t("dashboard.reportedConversation")
                          : t("dashboard.reportedConversations")}
                      </Link>
                    </li>
                  )}
                </ul>
              </Card>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <Card
                title={
                  d.data.fees
                    ? `${t("dashboard.tuition")}, ${d.data.fees.term}`
                    : t("dashboard.tuition")
                }
              >
                {d.data.fees ? (
                  <div className="space-y-2 text-sm">
                    <p>
                      {t("dashboard.billed")}:{" "}
                      <b>{naira(d.data.fees.billedKobo)}</b>
                    </p>
                    <p>
                      {t("dashboard.collected")}:{" "}
                      <b>{naira(d.data.fees.collectedKobo)}</b>
                    </p>
                    <p>
                      {t("dashboard.outstanding")}:{" "}
                      <b>{naira(d.data.fees.outstandingKobo)}</b> ·{" "}
                      {d.data.fees.studentsOwing}{" "}
                      {d.data.fees.studentsOwing === 1
                        ? t("dashboard.studentOwing")
                        : t("dashboard.studentsOwing")}
                    </p>
                    <div
                      className="h-2 overflow-hidden rounded bg-brand-50"
                      aria-hidden
                    >
                      <div
                        className="h-full bg-brand-700"
                        style={{
                          width: `${d.data.fees.billedKobo ? Math.min(100, Math.round((d.data.fees.collectedKobo / d.data.fees.billedKobo) * 100)) : 0}%`,
                        }}
                      />
                    </div>
                    <Link
                      className="text-brand-700 underline"
                      to="/admin/invoices"
                    >
                      {t("dashboard.openInvoices")}
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    {t("dashboard.noCurrentSemester")}
                  </p>
                )}
              </Card>
              <Card title={t("dashboard.assignments")}>
                <div className="space-y-1 text-sm">
                  <p>
                    <b>{d.data.work.openAssignments}</b>{" "}
                    {t("dashboard.openAssignments")}
                  </p>
                  <p>
                    <b>{d.data.work.awaitingMarking}</b>{" "}
                    {t("dashboard.awaitingMarking")}
                  </p>
                  {d.data.work.pastDueUnmarked > 0 && (
                    <p className="text-muted">
                      {d.data.work.pastDueUnmarked}{" "}
                      {d.data.work.pastDueUnmarked === 1
                        ? t("dashboard.pastDueOne")
                        : t("dashboard.pastDueMany")}
                    </p>
                  )}
                </div>
              </Card>
            </div>

            <Card title={t("dashboard.studentsByClass")}>
              {d.data.studentsByClass.length === 0 ? (
                <Empty>{t("dashboard.noClasses")}</Empty>
              ) : (
                <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  {d.data.studentsByClass.map((c) => (
                    <li
                      key={c.classId}
                      className="flex justify-between border-b border-line py-1"
                    >
                      <span>{c.name}</span>
                      <b>{c.students}</b>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card title={t("dashboard.recentApplications")}>
                {d.data.applications.recent.length === 0 ? (
                  <Empty>{t("dashboard.noApplications")}</Empty>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {d.data.applications.recent.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <span>
                          {a.name} · {a.applyingFor}{" "}
                          <span className="text-muted">
                            ({fmtDate(a.createdAt)})
                          </span>
                        </span>
                        <Badge>{label(a.status)}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title={t("dashboard.recentAnnouncements")}>
                {d.data.announcements.length === 0 ? (
                  <Empty>{t("dashboard.noAnnouncements")}</Empty>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {d.data.announcements.map((p) => (
                      <li key={p.id}>
                        {p.title}
                        {p.publishedAt && (
                          <span className="text-muted">
                            {" "}
                            · {fmtDate(p.publishedAt)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <Card title={t("dashboard.recentActions")}>
              {d.data.recentActions.length === 0 ? (
                <Empty>{t("dashboard.nothingRecorded")}</Empty>
              ) : (
                <ul className="space-y-1 text-sm">
                  {d.data.recentActions.map((a) => (
                    <li key={a.id}>
                      <b>{a.actor}</b> · {label(a.action)}{" "}
                      <span className="text-muted">
                        · {fmtDateTime(a.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-sm">
                <Link className="text-brand-700 underline" to="/admin/audit">
                  {t("dashboard.openAuditLog")}
                </Link>
              </p>
            </Card>
          </div>
        )}
      </DataState>
    </>
  );
}
