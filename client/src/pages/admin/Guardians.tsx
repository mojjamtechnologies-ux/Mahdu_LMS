import { useState, type FormEvent } from "react";
import {
  Alert,
  Badge,
  Button,
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
import type { Account, GuardianLink, Paged, StudentRow } from "../../lib/types";
import { useAction, useFetch } from "../../lib/useFetch";
import { useTranslation } from "react-i18next";

export default function Guardians() {
  const { t } = useTranslation("admin");
  const links = useFetch<GuardianLink[]>("/parent-links");
  const parents = useFetch<Paged<Account>>("/users?role=parent&pageSize=100");
  const students = useFetch<Paged<StudentRow>>("/students?pageSize=100");
  const [f, setF] = useState({
    parentId: "",
    studentId: "",
    relationship: "mother",
    isPrimary: false,
  });
  const add = useAction();
  const del = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (await add.run(() => api("/parent-links", { body: f }))) {
      setF({ ...f, parentId: "", studentId: "", isPrimary: false });
      links.reload();
    }
  }
  async function remove(l: GuardianLink) {
    if (
      !window.confirm(
        t("guardians.confirmRemove", {
          parent: l.parentName,
          student: l.studentName,
        }),
      )
    )
      return;
    if (
      await del.run(() =>
        api(`/parent-links/${l.parentId}/${l.studentId}`, { method: "DELETE" }),
      )
    )
      links.reload();
  }

  return (
    <>
      <PageHeader title={t("guardians.title")} intro={t("guardians.intro")} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title={t("guardians.linked")}>
          {del.error && (
            <div className="mb-3">
              <Alert tone="error">{del.error}</Alert>
            </div>
          )}
          <DataState loading={links.loading} error={links.error}>
            {links.data?.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th>{t("guardians.student")}</Th>
                    <Th>{t("guardians.guardian")}</Th>
                    <Th>{t("guardians.relationship")}</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {links.data.map((l) => (
                    <tr key={`${l.parentId}-${l.studentId}`}>
                      <Td>{l.studentName}</Td>
                      <Td>
                        <div>{l.parentName}</div>
                        <div className="text-muted">{l.parentEmail}</div>
                      </Td>
                      <Td className="capitalize">
                        {t(
                          `guardians.${l.relationship === "guardian" ? "guardianRole" : l.relationship}`,
                        )}{" "}
                        {l.isPrimary && (
                          <Badge tone="good">{t("guardians.primary")}</Badge>
                        )}
                      </Td>
                      <Td className="text-right">
                        <SmallButton
                          tone="danger"
                          onClick={() => remove(l)}
                          disabled={del.busy}
                        >
                          {t("guardians.remove")}
                        </SmallButton>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Empty>{t("guardians.none")}</Empty>
            )}
          </DataState>
        </Card>
        <Card title={t("guardians.link")}>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Select
              label={t("guardians.student")}
              value={f.studentId}
              onChange={(e) => setF({ ...f, studentId: e.target.value })}
            >
              <option value="">{t("guardians.chooseStudent")}</option>
              {students.data?.items.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} ({s.admissionNumber})
                </option>
              ))}
            </Select>
            <Select
              label={t("guardians.parentOrGuardian")}
              value={f.parentId}
              onChange={(e) => setF({ ...f, parentId: e.target.value })}
            >
              <option value="">{t("guardians.chooseAccount")}</option>
              {parents.data?.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName} ({p.email})
                </option>
              ))}
            </Select>
            <Select
              label={t("guardians.relationship")}
              value={f.relationship}
              onChange={(e) => setF({ ...f, relationship: e.target.value })}
            >
              <option value="mother">{t("guardians.mother")}</option>
              <option value="father">{t("guardians.father")}</option>
              <option value="guardian">{t("guardians.guardianRole")}</option>
              <option value="other">{t("guardians.other")}</option>
            </Select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-500"
                checked={f.isPrimary}
                onChange={(e) => setF({ ...f, isPrimary: e.target.checked })}
              />
              {t("guardians.primaryContact")}
            </label>
            {add.error && <Alert tone="error">{add.error}</Alert>}
            <Button
              type="submit"
              loading={add.busy}
              disabled={!f.parentId || !f.studentId}
            >
              {t("guardians.linkGuardian")}
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
