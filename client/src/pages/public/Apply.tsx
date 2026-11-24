import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Page } from "./Shared";
import { Alert, Button, Field, Select, TextArea } from "../../components/ui";
import { api } from "../../lib/api";
import { usePageTitle } from "../../lib/usePageTitle";
import { useAction } from "../../lib/useFetch";
import { useTranslation } from "react-i18next";

const EMPTY = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  klass: "JSS|1",
  previousSchool: "",
  guardianName: "",
  guardianPhone: "",
  guardianEmail: "",
  address: "",
  message: "",
  consent: false,
  website: "",
};
const CLASSES = ["JSS|1", "JSS|2", "JSS|3", "SSS|1", "SSS|2", "SSS|3"];

// A short form that asks only for what the school needs to consider the application.
export default function Apply() {
  const { t } = useTranslation("public");
  usePageTitle(t("apply.title"));
  const [f, setF] = useState(EMPTY);
  const act = useAction();
  const [done, setDone] = useState<{
    reference: string | null;
    emailAccepted: boolean;
    duplicate: boolean;
  } | null>(null);
  const set = (k: keyof typeof EMPTY, v: string | boolean) =>
    setF({ ...f, [k]: v });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const [classStage, year] = f.klass.split("|");
    const body: Record<string, unknown> = {
      firstName: f.firstName,
      lastName: f.lastName,
      dateOfBirth: f.dateOfBirth,
      classStage,
      classYear: Number(year),
      guardianName: f.guardianName,
      guardianPhone: f.guardianPhone,
      guardianEmail: f.guardianEmail,
      consent: f.consent,
      website: f.website,
    };
    for (const k of ["previousSchool", "address", "message"] as const)
      if (f[k].trim()) body[k] = f[k].trim();
    let r: typeof done = null;
    if (
      await act.run(async () => {
        r = await api("/public/admissions/apply", { body, auth: false });
      })
    )
      setDone(r);
  }

  if (done) {
    return (
      <Page title={t("apply.received")}>
        <div className="max-w-2xl space-y-4">
          {done.reference ? (
            <>
              <Alert tone="success">
                {done.duplicate ? t("apply.duplicate") : t("apply.thankYou")}
              </Alert>
              <p>
                {t("apply.referencePrefix")}{" "}
                <strong className="text-xl">{done.reference}</strong>.{" "}
                {t("apply.referenceHelp")}
              </p>
              <p className="text-muted">
                {done.emailAccepted
                  ? t("apply.emailSent")
                  : t("apply.emailNotSent")}
              </p>
              <p>
                <Link
                  className="font-medium text-brand-700 underline"
                  to="/admissions/status"
                >
                  {t("apply.check")}
                </Link>
              </p>
            </>
          ) : (
            <Alert tone="success">{t("apply.thankYou")}</Alert>
          )}
        </div>
      </Page>
    );
  }
  const er = act.fields;
  return (
    <Page title={t("apply.title")} intro={t("apply.intro")}>
      <form onSubmit={submit} className="grid max-w-3xl gap-5" noValidate>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 font-display text-xl font-bold">
            {t("apply.child")}
          </legend>
          <Field
            label={t("apply.firstName")}
            autoComplete="off"
            value={f.firstName}
            error={er.firstName}
            onChange={(e) => set("firstName", e.target.value)}
          />
          <Field
            label={t("apply.lastName")}
            autoComplete="off"
            value={f.lastName}
            error={er.lastName}
            onChange={(e) => set("lastName", e.target.value)}
          />
          <Field
            label={t("apply.dob")}
            type="date"
            value={f.dateOfBirth}
            error={er.dateOfBirth}
            onChange={(e) => set("dateOfBirth", e.target.value)}
          />
          <Select
            label={t("apply.class")}
            value={f.klass}
            error={er.classStage ?? er.classYear}
            onChange={(e) => set("klass", e.target.value)}
          >
            {CLASSES.map((c) => (
              <option key={c} value={c}>
                {c.replace("|", " ")}
              </option>
            ))}
          </Select>
          <div className="sm:col-span-2">
            <Field
              label={t("apply.previousSchool")}
              value={f.previousSchool}
              error={er.previousSchool}
              onChange={(e) => set("previousSchool", e.target.value)}
            />
          </div>
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 font-display text-xl font-bold">
            {t("apply.guardian")}
          </legend>
          <Field
            label={t("apply.fullName")}
            autoComplete="name"
            value={f.guardianName}
            error={er.guardianName}
            onChange={(e) => set("guardianName", e.target.value)}
          />
          <Field
            label={t("apply.phone")}
            type="tel"
            autoComplete="tel"
            value={f.guardianPhone}
            error={er.guardianPhone}
            onChange={(e) => set("guardianPhone", e.target.value)}
          />
          <div className="sm:col-span-2">
            <Field
              label={t("apply.email")}
              type="email"
              autoComplete="email"
              value={f.guardianEmail}
              error={er.guardianEmail}
              hint={t("apply.emailHint")}
              onChange={(e) => set("guardianEmail", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Field
              label={t("apply.address")}
              autoComplete="street-address"
              value={f.address}
              error={er.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </div>
        </fieldset>
        <TextArea
          label={t("apply.message")}
          rows={4}
          value={f.message}
          error={er.message}
          onChange={(e) => set("message", e.target.value)}
        />
        <div
          aria-hidden="true"
          className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
        >
          <label>
            {t("apply.leaveEmpty")}
            <input
              tabIndex={-1}
              autoComplete="off"
              value={f.website}
              onChange={(e) => set("website", e.target.value)}
            />
          </label>
        </div>
        <div>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 accent-brand-500"
              checked={f.consent}
              onChange={(e) => set("consent", e.target.checked)}
              aria-invalid={!!er.consent}
            />
            <span>
              {t("apply.consent")}{" "}
              <Link
                className="font-medium text-brand-700 underline"
                to="/privacy"
                target="_blank"
              >
                {t("apply.privacy")}
              </Link>
              .
            </span>
          </label>
          {er.consent && (
            <p className="mt-1.5 text-sm text-red-700">{er.consent}</p>
          )}
        </div>
        {act.error && <Alert tone="error">{act.error}</Alert>}
        <div className="max-w-xs">
          <Button type="submit" loading={act.busy}>
            {t("apply.send")}
          </Button>
        </div>
      </form>
    </Page>
  );
}
