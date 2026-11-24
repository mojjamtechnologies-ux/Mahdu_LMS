import { useState } from "react";
import {
  Alert,
  Badge,
  Card,
  DataState,
  Empty,
  Field,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
} from "../../components/ui";
import { api } from "../../lib/api";
import Avatar from "../../components/Avatar";
import type { Paged, SchoolClass, Session, StudentRow } from "../../lib/types";
import { useAction, useFetch } from "../../lib/useFetch";
import { useTranslation } from "react-i18next";

export default function Students() {
  const { t } = useTranslation("admin");
  const [q, setQ] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const sessions = useFetch<Session[]>("/academic/sessions");
  const classes = useFetch<SchoolClass[]>("/academic/classes");
  const current = sessions.data?.find((s) => s.isCurrent);
  const qs = new URLSearchParams({
    pageSize: "100",
    ...(q.trim() && { q: q.trim() }),
    ...(classFilter && { classId: classFilter }),
  });
  const students = useFetch<Paged<StudentRow>>(`/students?${qs}`);
  const action = useAction();

  async function setClass(s: StudentRow, classId: string) {
    if (!classId || !current) return;
    if (
      await action.run(() =>
        api("/academic/enrolments", {
          body: { studentId: s.id, classId, sessionId: current.id },
        }),
      )
    )
      students.reload();
  }

  return (
    <>
      <PageHeader
        title={t("students.title")}
        intro={
          current
            ? t("students.introWithSession", { session: current.name })
            : t("students.intro")
        }
      />
      {!sessions.loading && !current && (
        <div className="mb-4">
          <Alert tone="error">{t("students.noSession")}</Alert>
        </div>
      )}
      {action.error && (
        <div className="mb-4">
          <Alert tone="error">{action.error}</Alert>
        </div>
      )}
      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
          <Field
            label={t("students.search")}
            placeholder={t("students.searchPlaceholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select
            label={t("students.class")}
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          >
            <option value="">{t("students.allClasses")}</option>
            {classes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <DataState loading={students.loading} error={students.error}>
          {students.data?.items.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>{t("students.student")}</Th>
                  <Th>{t("students.admissionNo")}</Th>
                  <Th>{t("students.classThisSession")}</Th>
                  <Th>{t("students.setClass")}</Th>
                </tr>
              </thead>
              <tbody>
                {students.data.items.map((s) => (
                  <tr key={s.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar
                          userId={s.id}
                          name={`${s.firstName} ${s.lastName}`}
                          version={
                            (s as { avatarVersion?: number | null })
                              .avatarVersion
                          }
                          size={36}
                        />
                        <div className="font-medium">
                          {s.firstName} {s.lastName}
                        </div>
                      </div>
                      {s.accountStatus !== "active" && (
                        <Badge tone="warn">
                          {s.accountStatus === "pending"
                            ? t("students.notActivated")
                            : t("students.suspended")}
                        </Badge>
                      )}
                    </Td>
                    <Td>{s.admissionNumber}</Td>
                    <Td>
                      {s.className ?? (
                        <span className="text-muted">
                          {t("students.notPlaced")}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <select
                        aria-label={t("students.setClassFor", {
                          name: `${s.firstName} ${s.lastName}`,
                        })}
                        value=""
                        disabled={!current || action.busy}
                        onChange={(e) => setClass(s, e.target.value)}
                        className="rounded-md border border-line bg-white px-2 py-1.5 text-sm"
                      >
                        <option value="">{t("students.choose")}</option>
                        {classes.data?.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Empty>{t("students.noStudents")}</Empty>
          )}
          {students.data &&
            students.data.total > students.data.items.length && (
              <p className="mt-3 text-sm text-muted">
                {t("students.showing", {
                  shown: students.data.items.length,
                  total: students.data.total,
                })}
              </p>
            )}
        </DataState>
      </Card>
    </>
  );
}
