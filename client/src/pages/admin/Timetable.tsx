import { useState, type FormEvent } from "react";
import {
  Alert,
  Badge,
  Card,
  DataState,
  Empty,
  Field,
  Button,
  PageHeader,
  Select,
  SmallButton,
} from "../../components/ui";
import { api } from "../../lib/api";
import type {
  SchoolClass,
  Session,
  Slot,
  Subject,
  TimetableConflict,
} from "../../lib/types";
import { useAction, useFetch } from "../../lib/useFetch";
import { useTranslation } from "react-i18next";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function Timetable() {
  const { t } = useTranslation("admin");
  const sessions = useFetch<Session[]>("/academic/sessions");
  const classes = useFetch<SchoolClass[]>("/academic/classes");
  const [pickedS, setPickedS] = useState("");
  const [pickedC, setPickedC] = useState("");
  const sid =
    pickedS ||
    sessions.data?.find((s) => s.isCurrent)?.id ||
    sessions.data?.[0]?.id ||
    "";
  const cid = pickedC || classes.data?.[0]?.id || "";
  const slots = useFetch<Slot[]>(
    sid && cid ? `/timetable?sessionId=${sid}&classId=${cid}` : null,
  );
  const subjects = useFetch<Subject[]>(
    cid ? `/academic/classes/${cid}/subjects` : null,
  );
  const conflicts = useFetch<TimetableConflict[]>(
    sid ? `/timetable/conflicts?sessionId=${sid}` : null,
  );

  const [subjectId, setSubjectId] = useState("");
  const [day, setDay] = useState("1");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("08:40");
  const [room, setRoom] = useState("");
  const add = useAction();
  const del = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await add.run(() =>
      api("/timetable", {
        body: {
          sessionId: sid,
          classId: cid,
          subjectId: subjectId || subjects.data?.[0]?.id,
          dayOfWeek: Number(day),
          startTime: start,
          endTime: end,
          room: room || null,
        },
      }),
    );
    if (ok) {
      setRoom("");
      slots.reload();
      conflicts.reload();
    }
  }
  async function remove(id: string) {
    if (await del.run(() => api(`/timetable/${id}`, { method: "DELETE" }))) {
      slots.reload();
      conflicts.reload();
    }
  }

  return (
    <>
      <PageHeader title={t("timetable.title")} intro={t("timetable.intro")} />
      <div className="mb-6 grid max-w-2xl gap-4 sm:grid-cols-2">
        <Select
          label={t("timetable.session")}
          value={sid}
          onChange={(e) => setPickedS(e.target.value)}
        >
          {sessions.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.isCurrent ? ` (${t("timetable.current")})` : ""}
            </option>
          ))}
        </Select>
        <Select
          label={t("timetable.class")}
          value={cid}
          onChange={(e) => setPickedC(e.target.value)}
        >
          {classes.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      {!!conflicts.data?.length && (
        <div className="mb-6">
          <Alert tone="error">
            <p className="font-semibold">{t("timetable.clashes")}</p>
            <ul className="mt-1 list-disc pl-5">
              {conflicts.data.map((c, i) => {
                const dayKey = [
                  "timetable.monday",
                  "timetable.tuesday",
                  "timetable.wednesday",
                  "timetable.thursday",
                  "timetable.friday",
                ].includes(`timetable.${c.dayName.toLowerCase()}`)
                  ? `timetable.${c.dayName.toLowerCase()}`
                  : c.dayName;
                return (
                  <li key={i}>
                    {t("timetable.clashLine", {
                      teacher: c.teacher,
                      day: t(dayKey),
                      firstClass: c.first.className,
                      firstTime: `${c.first.startTime}-${c.first.endTime}`,
                      secondClass: c.second.className,
                      secondTime: `${c.second.startTime}-${c.second.endTime}`,
                    })}
                  </li>
                );
              })}
            </ul>
          </Alert>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card title={t("timetable.lessons")}>
          <DataState loading={slots.loading && !slots.data} error={slots.error}>
            {slots.data?.length ? (
              DAYS.map((d, i) => {
                const daySlots = slots.data!.filter(
                  (s) => s.dayOfWeek === i + 1,
                );
                const dayKeys = [
                  "timetable.monday",
                  "timetable.tuesday",
                  "timetable.wednesday",
                  "timetable.thursday",
                  "timetable.friday",
                ];
                return daySlots.length ? (
                  <div key={d} className="mb-4">
                    <h3 className="mb-1 font-semibold">{t(dayKeys[i] ?? d)}</h3>
                    <ul className="divide-y divide-line rounded-lg border border-line">
                      {daySlots.map((s) => (
                        <li
                          key={s.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                        >
                          <span>
                            <span className="font-medium">{s.subjectName}</span>{" "}
                            <span className="text-sm text-muted">
                              {s.startTime} – {s.endTime}
                              {s.room ? ` · ${s.room}` : ""}
                            </span>
                            <br />
                            <span className="text-sm text-muted">
                              {s.teachers.length ? (
                                s.teachers.join(", ")
                              ) : (
                                <Badge tone="warn">
                                  {t("timetable.noTeacher")}
                                </Badge>
                              )}
                            </span>
                          </span>
                          <SmallButton
                            tone="danger"
                            onClick={() => remove(s.id)}
                            disabled={del.busy}
                          >
                            {t("timetable.remove")}
                          </SmallButton>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null;
              })
            ) : (
              <Empty>{t("timetable.noLessons")}</Empty>
            )}
            {del.error && <Alert tone="error">{del.error}</Alert>}
          </DataState>
        </Card>
        <Card title={t("timetable.addLesson")}>
          {subjects.data && !subjects.data.length ? (
            <Empty>{t("timetable.noSubjects")}</Empty>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Select
                label={t("timetable.subject")}
                value={subjectId || subjects.data?.[0]?.id || ""}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                {subjects.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Select
                label={t("timetable.day")}
                value={day}
                onChange={(e) => setDay(e.target.value)}
              >
                {DAYS.map((d, i) => (
                  <option key={d} value={i + 1}>
                    {t(
                      [
                        "timetable.monday",
                        "timetable.tuesday",
                        "timetable.wednesday",
                        "timetable.thursday",
                        "timetable.friday",
                      ][i] ?? d,
                    )}
                  </option>
                ))}
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={t("timetable.starts")}
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  required
                />
                <Field
                  label={t("timetable.ends")}
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  required
                />
              </div>
              <Field
                label={t("timetable.room")}
                value={room}
                maxLength={40}
                onChange={(e) => setRoom(e.target.value)}
              />
              {add.error && <Alert tone="error">{add.error}</Alert>}
              <Button loading={add.busy} disabled={!sid || !cid}>
                {t("timetable.add")}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
