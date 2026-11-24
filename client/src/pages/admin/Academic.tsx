import { useState, type FormEvent } from "react";
import {
  Alert,
  Badge,
  Button,
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
import { api } from "../../lib/api";
import type { Session, Term } from "../../lib/types";
import { useAction, useFetch } from "../../lib/useFetch";
import { useTranslation } from "react-i18next";

export default function Academic() {
  const { t } = useTranslation("admin");
  const sessions = useFetch<Session[]>("/academic/sessions");
  const [picked, setPicked] = useState("");
  const sid =
    picked ||
    sessions.data?.find((s) => s.isCurrent)?.id ||
    sessions.data?.[0]?.id ||
    "";
  const terms = useFetch<Term[]>(
    sid ? `/academic/terms?sessionId=${sid}` : null,
  );

  const addSession = useAction();
  const [sf, setSf] = useState({ name: "", startDate: "", endDate: "" });
  const rowAction = useAction();
  const addTerm = useAction();
  const [tf, setTf] = useState({ termNumber: "1", startDate: "", endDate: "" });

  async function submitSession(e: FormEvent) {
    e.preventDefault();
    if (await addSession.run(() => api("/academic/sessions", { body: sf }))) {
      setSf({ name: "", startDate: "", endDate: "" });
      sessions.reload();
    }
  }
  async function submitTerm(e: FormEvent) {
    e.preventDefault();
    if (
      await addTerm.run(() =>
        api("/academic/terms", {
          body: {
            sessionId: sid,
            termNumber: Number(tf.termNumber),
            startDate: tf.startDate,
            endDate: tf.endDate,
          },
        }),
      )
    ) {
      setTf({ termNumber: "1", startDate: "", endDate: "" });
      terms.reload();
    }
  }
  async function makeCurrent(path: string) {
    if (await rowAction.run(() => api(path, { method: "POST", body: {} }))) {
      sessions.reload();
      terms.reload();
    }
  }

  return (
    <>
      <PageHeader title={t("academic.title")} intro={t("academic.intro")} />
      {rowAction.error && (
        <div className="mb-4">
          <Alert tone="error">{rowAction.error}</Alert>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={t("academic.sessions")}>
          <DataState loading={sessions.loading} error={sessions.error}>
            {sessions.data?.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th>{t("academic.session")}</Th>
                    <Th>{t("academic.runs")}</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {sessions.data.map((s) => (
                    <tr key={s.id}>
                      <Td>
                        {s.name}{" "}
                        {s.isCurrent && (
                          <Badge tone="good">{t("academic.current")}</Badge>
                        )}
                      </Td>
                      <Td>
                        {s.startDate} – {s.endDate}
                      </Td>
                      <Td>
                        {!s.isCurrent && (
                          <SmallButton
                            onClick={() =>
                              makeCurrent(
                                `/academic/sessions/${s.id}/set-current`,
                              )
                            }
                          >
                            {t("academic.makeCurrent")}
                          </SmallButton>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Empty>{t("academic.noSessions")}</Empty>
            )}
          </DataState>
          <form
            onSubmit={submitSession}
            className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-3"
            noValidate
          >
            <Field
              label={t("academic.sessionName")}
              placeholder="2026/2027"
              value={sf.name}
              error={addSession.fields.name}
              onChange={(e) => setSf({ ...sf, name: e.target.value })}
            />
            <Field
              label={t("academic.starts")}
              type="date"
              value={sf.startDate}
              error={addSession.fields.startDate}
              onChange={(e) => setSf({ ...sf, startDate: e.target.value })}
            />
            <Field
              label={t("academic.ends")}
              type="date"
              value={sf.endDate}
              error={addSession.fields.endDate}
              onChange={(e) => setSf({ ...sf, endDate: e.target.value })}
            />
            <div className="sm:col-span-3">
              {addSession.error && (
                <div className="mb-3">
                  <Alert tone="error">{addSession.error}</Alert>
                </div>
              )}
              <Button type="submit" loading={addSession.busy}>
                {t("academic.addSession")}
              </Button>
            </div>
          </form>
        </Card>

        <Card title={t("academic.terms")}>
          <Select
            label={t("academic.session")}
            value={sid}
            onChange={(e) => setPicked(e.target.value)}
            disabled={!sessions.data?.length}
          >
            {sessions.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <div className="mt-4">
            <DataState loading={terms.loading} error={terms.error}>
              {!sid ? (
                <Empty>{t("academic.addSessionFirst")}</Empty>
              ) : terms.data?.length ? (
                <Table>
                  <thead>
                    <tr>
                      <Th>{t("academic.term")}</Th>
                      <Th>{t("academic.runs")}</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {terms.data.map((term) => (
                      <tr key={term.id}>
                        <Td>
                          {term.name}{" "}
                          {term.isCurrent && (
                            <Badge tone="good">{t("academic.current")}</Badge>
                          )}
                        </Td>
                        <Td>
                          {term.startDate} – {term.endDate}
                        </Td>
                        <Td>
                          {!term.isCurrent && (
                            <SmallButton
                              onClick={() =>
                                makeCurrent(
                                  `/academic/terms/${term.id}/set-current`,
                                )
                              }
                            >
                              {t("academic.makeCurrent")}
                            </SmallButton>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <Empty>{t("academic.noTerms")}</Empty>
              )}
            </DataState>
          </div>
          {sid && (
            <form
              onSubmit={submitTerm}
              className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-3"
              noValidate
            >
              <Select
                label={t("academic.term")}
                value={tf.termNumber}
                onChange={(e) => setTf({ ...tf, termNumber: e.target.value })}
              >
                {Array.from({ length: 3 }, (_, i) => {
                  const keys = [
                    "academic.firstTerm",
                    "academic.secondTerm",
                    "academic.thirdTerm",
                  ];
                  return (
                    <option key={i + 1} value={i + 1}>
                      {t(keys[i])}
                    </option>
                  );
                })}
              </Select>
              <Field
                label={t("academic.starts")}
                type="date"
                value={tf.startDate}
                error={addTerm.fields.startDate}
                onChange={(e) => setTf({ ...tf, startDate: e.target.value })}
              />
              <Field
                label={t("academic.ends")}
                type="date"
                value={tf.endDate}
                error={addTerm.fields.endDate}
                onChange={(e) => setTf({ ...tf, endDate: e.target.value })}
              />
              <div className="sm:col-span-3">
                {addTerm.error && (
                  <div className="mb-3">
                    <Alert tone="error">{addTerm.error}</Alert>
                  </div>
                )}
                <Button type="submit" loading={addTerm.busy}>
                  {t("academic.addTerm")}
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
