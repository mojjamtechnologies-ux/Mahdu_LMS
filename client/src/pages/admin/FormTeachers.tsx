import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Card,
  DataState,
  Empty,
  PageHeader,
  Select,
  SmallButton,
  Table,
  Td,
  Th,
} from "../../components/ui";
import { api } from "../../lib/api";
import type { Account, Paged, Session } from "../../lib/types";
import { useAction, useFetch } from "../../lib/useFetch";
import { useTranslation } from "react-i18next";

interface FormTeacherRow {
  classId: string;
  className: string;
  teacherId: string | null;
  teacherName: string | null;
}

// One row per class: shows the current form teacher and lets the administrator set, change or remove them.
function Row({
  row,
  sessionId,
  teachers,
  onChanged,
}: {
  row: FormTeacherRow;
  sessionId: string;
  teachers: Account[];
  onChanged: () => void;
}) {
  const { t } = useTranslation("admin");
  const [pick, setPick] = useState(row.teacherId ?? "");
  const act = useAction();
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setPick(row.teacherId ?? "");
  }, [row.teacherId]);

  async function save(teacherId: string | null) {
    setSaved(false);
    if (
      await act.run(() =>
        api("/attendance/form-teachers", {
          method: "PUT",
          body: { classId: row.classId, sessionId, teacherId },
        }),
      )
    ) {
      setSaved(true);
      onChanged();
    }
  }
  const dirty = pick !== (row.teacherId ?? "");
  return (
    <tr>
      <Td>
        <div className="font-medium">{row.className}</div>
      </Td>
      <Td>
        {row.teacherName ? (
          row.teacherName
        ) : (
          <Badge tone="warn">{t("formTeachers.noTeacherYet")}</Badge>
        )}
      </Td>
      <Td>
        <div className="min-w-[11rem]">
          <Select
            label={t("formTeachers.formTeacher")}
            value={pick}
            onChange={(e) => {
              setSaved(false);
              setPick(e.target.value);
            }}
          >
            <option value="">{t("formTeachers.chooseTeacher")}</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.firstName} {t.lastName}
              </option>
            ))}
          </Select>
          {act.error && (
            <p className="mt-1.5 text-sm text-red-700">{act.error}</p>
          )}
          {saved && !dirty && (
            <p className="mt-1.5 text-sm text-brand-700">
              {t("formTeachers.saved")}
            </p>
          )}
        </div>
      </Td>
      <Td className="whitespace-nowrap text-right">
        <span className="inline-flex gap-2">
          <SmallButton
            onClick={() => save(pick)}
            disabled={act.busy || !pick || !dirty}
          >
            {t("formTeachers.save")}
          </SmallButton>
          {row.teacherId && (
            <SmallButton
              tone="danger"
              onClick={() => {
                setPick("");
                save(null);
              }}
              disabled={act.busy}
            >
              {t("formTeachers.remove")}
            </SmallButton>
          )}
        </span>
      </Td>
    </tr>
  );
}

export default function FormTeachers() {
  const { t } = useTranslation("admin");
  const sessions = useFetch<Session[]>("/academic/sessions");
  const [picked, setPicked] = useState("");
  const sid =
    picked ||
    sessions.data?.find((s) => s.isCurrent)?.id ||
    sessions.data?.[0]?.id ||
    "";
  const list = useFetch<FormTeacherRow[]>(
    sid ? `/attendance/form-teachers?sessionId=${sid}` : null,
  );
  const teachers = useFetch<Paged<Account>>("/users?role=teacher&pageSize=100");
  const open =
    teachers.data?.items.filter((t) => t.status !== "suspended") ?? [];

  return (
    <>
      <PageHeader
        title={t("formTeachers.title")}
        intro={t("formTeachers.intro")}
      />
      {!sessions.loading && !sessions.data?.length ? (
        <Card>
          <Empty>{t("formTeachers.noSession")}</Empty>
        </Card>
      ) : (
        <>
          <div className="mb-6 max-w-xs">
            <Select
              label={t("formTeachers.session")}
              value={sid}
              onChange={(e) => setPicked(e.target.value)}
            >
              {sessions.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isCurrent ? ` (${t("formTeachers.current")})` : ""}
                </option>
              ))}
            </Select>
          </div>
          <Card>
            <DataState
              loading={(list.loading && !list.data) || teachers.loading}
              error={list.error || teachers.error}
            >
              {!open.length && (
                <div className="mb-4">
                  <Alert tone="error">{t("formTeachers.noTeachers")}</Alert>
                </div>
              )}
              {list.data?.length ? (
                <Table>
                  <thead>
                    <tr>
                      <Th>{t("formTeachers.class")}</Th>
                      <Th>{t("formTeachers.currentTeacher")}</Th>
                      <Th>{t("formTeachers.change")}</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.map((r) => (
                      <Row
                        key={r.classId}
                        row={r}
                        sessionId={sid}
                        teachers={open}
                        onChanged={list.reload}
                      />
                    ))}
                  </tbody>
                </Table>
              ) : (
                <Empty>{t("formTeachers.noClasses")}</Empty>
              )}
            </DataState>
          </Card>
        </>
      )}
    </>
  );
}
