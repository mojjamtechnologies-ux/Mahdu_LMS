import { Fragment, useState } from "react";
import {
  Badge,
  Card,
  DataState,
  Empty,
  Field,
  PageHeader,
  Select,
  SmallButton,
  Table,
  Td,
  Th,
} from "../../components/ui";
import { fmtDateTime } from "../../lib/format";
import type { AuditEntry, Paged } from "../../lib/types";
import { useFetch } from "../../lib/useFetch";
import { useTranslation } from "react-i18next";

export default function AuditLog() {
  const { t } = useTranslation("admin");
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const actions = useFetch<string[]>("/admin/audit-logs/actions");
  const qs = new URLSearchParams({
    page: String(page),
    pageSize: "50",
    ...(q.trim() && { q: q.trim() }),
    ...(action && { action }),
    ...(from && { from }),
    ...(to && { to }),
  });
  const log = useFetch<Paged<AuditEntry>>(`/admin/audit-logs?${qs}`);
  const [open, setOpen] = useState("");
  const reset =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v);
      setPage(1);
    };
  const pages = log.data
    ? Math.max(1, Math.ceil(log.data.total / log.data.pageSize))
    : 1;
  return (
    <>
      <PageHeader title={t("audit.title")} intro={t("audit.intro")} />
      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label={t("audit.search")}
            placeholder={t("audit.searchHint")}
            value={q}
            onChange={(e) => reset(setQ)(e.target.value)}
          />
          <Select
            label={t("audit.action")}
            value={action}
            onChange={(e) => reset(setAction)(e.target.value)}
          >
            <option value="">{t("audit.anyAction")}</option>
            {actions.data?.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
          <Field
            label={t("audit.from")}
            type="date"
            value={from}
            onChange={(e) => reset(setFrom)(e.target.value)}
          />
          <Field
            label={t("audit.to")}
            type="date"
            value={to}
            onChange={(e) => reset(setTo)(e.target.value)}
          />
        </div>
        <DataState loading={log.loading && !log.data} error={log.error}>
          {log.data?.items.length ? (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>{t("audit.when")}</Th>
                    <Th>{t("audit.who")}</Th>
                    <Th>{t("audit.action")}</Th>
                    <Th>{t("audit.about")}</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {log.data.items.map((e) => (
                    <Fragment key={e.id}>
                      <tr>
                        <Td>{fmtDateTime(e.createdAt)}</Td>
                        <Td>
                          {e.actorName ?? (
                            <span className="text-muted">
                              {t("audit.systemOrPublic")}
                            </span>
                          )}
                          {e.actorEmail && (
                            <div className="text-xs text-muted">
                              {e.actorEmail}
                            </div>
                          )}
                        </Td>
                        <Td>
                          <Badge>{e.action}</Badge>
                        </Td>
                        <Td className="text-sm text-muted">
                          {e.entityType}
                          {e.entityId ? ` · ${e.entityId.slice(0, 8)}` : ""}
                        </Td>
                        <Td className="text-right">
                          {e.metadata && Object.keys(e.metadata).length > 0 && (
                            <SmallButton
                              onClick={() => setOpen(open === e.id ? "" : e.id)}
                            >
                              {open === e.id
                                ? t("audit.hide")
                                : t("audit.details")}
                            </SmallButton>
                          )}
                        </Td>
                      </tr>
                      {open === e.id && (
                        <tr>
                          <td colSpan={5} className="bg-brand-50 px-3 py-2">
                            <pre className="overflow-x-auto whitespace-pre-wrap text-xs">
                              {JSON.stringify(e.metadata, null, 2)}
                              {e.ip ? `\n${t("audit.fromIp")} ${e.ip}` : ""}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </Table>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-muted">
                  {log.data.total} entr{log.data.total === 1 ? "y" : "ies"} ·{" "}
                  {t("audit.page")} {page} {t("common:pagination.of")} {pages}
                </span>
                <span className="flex gap-2">
                  <SmallButton
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    {t("audit.newer")}
                  </SmallButton>
                  <SmallButton
                    disabled={page >= pages}
                    onClick={() => setPage(page + 1)}
                  >
                    {t("audit.older")}
                  </SmallButton>
                </span>
              </div>
            </>
          ) : (
            <Empty>{t("audit.noEntries")}</Empty>
          )}
        </DataState>
      </Card>
    </>
  );
}
