import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { useFetch, useAction } from "../lib/useFetch";
import { api } from "../lib/api";
import { Alert, Badge, Card, DataState, Field } from "./ui";
import AvatarUploader from "./AvatarUploader";
import PreferenceControls from "./PreferenceControls";

interface Profile {
  id: string; email: string; role: "admin" | "teacher" | "student" | "parent"; status: string; firstName: string; lastName: string; phone: string | null;
  memberSince: string; hasAvatar: boolean; avatarVersion: number | null; designation: string | null; admissionNumber: string | null; staffNumber: string | null;
  className: string | null; sessionName: string | null; children: { id: string; name: string; relationship: string; className: string | null }[]; teaches: string[];
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid gap-0.5 border-b border-line/60 py-2.5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
    <dt className="text-sm text-muted">{label}</dt>
    <dd className="min-w-0 break-words text-sm font-medium">{children}</dd>
  </div>
);

/** Profile for the signed-in user: photograph, the details they are allowed to see, phone number, and display preferences. */
export default function ProfileCard() {
  const { t, i18n } = useTranslation("profile");
  const { refreshUser } = useAuth();
  const { data, error, loading, reload } = useFetch<Profile>("/profile/me");
  const [phone, setPhone] = useState("");
  const [saved, setSaved] = useState("");
  const act = useAction();
  useEffect(() => { if (data) setPhone(data.phone ?? ""); }, [data]);

  async function savePhone(e: FormEvent) {
    e.preventDefault(); setSaved("");
    if (await act.run(() => api("/profile/me", { method: "PATCH", body: { phone: phone.trim() || null } }))) { setSaved(t("details.phoneSaved")); reload(); }
  }
  const date = (d: string) => new Date(d).toLocaleDateString(i18n.language === "ar" ? "ar" : "en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <DataState loading={loading && !data} error={error}>
      {data && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={t("photo.title")}>
            <AvatarUploader userId={data.id} name={`${data.firstName} ${data.lastName}`} version={data.avatarVersion} hasPhoto={data.hasAvatar} base="/profile"
              onChanged={() => { reload(); void refreshUser(); }} />
          </Card>
          <Card title={t("preferences.title")}>
            <p className="mb-4 text-sm text-muted">{t("preferences.intro")}</p>
            <PreferenceControls />
          </Card>
          <div className="lg:col-span-2">
            <Card title={t("details.title")}>
              <dl>
                <Row label={t("details.name")}>{data.firstName} {data.lastName}</Row>
                <Row label={t("details.email")}><bdi>{data.email}</bdi></Row>
                <Row label={t("details.status")}><Badge tone={data.status === "active" ? "good" : "warn"}>{data.status}</Badge></Row>
                {data.admissionNumber && <Row label={t("details.admission")}><bdi>{data.admissionNumber}</bdi></Row>}
                {data.staffNumber && <Row label={t("details.staff")}><bdi>{data.staffNumber}</bdi></Row>}
                {data.className && <Row label={t("details.class")}><bdi>{data.className}</bdi></Row>}
                {data.sessionName && <Row label={t("details.session")}><bdi>{data.sessionName}</bdi></Row>}
                {data.designation && <Row label={t("details.designation")}>{t(`common:roles.${data.role}`)}</Row>}
                {data.teaches.length > 0 && <Row label={t("details.teaches")}>{data.teaches.map((c) => <bdi key={c} className="me-2 inline-block">{c}</bdi>)}</Row>}
                {data.children.length > 0 && (
                  <Row label={t("details.children")}>
                    <ul className="space-y-1">{data.children.map((c) => <li key={c.id}>{c.name}{c.className ? <> · <bdi>{c.className}</bdi></> : null}</li>)}</ul>
                  </Row>
                )}
                <Row label={t("details.memberSince")}>{date(data.memberSince)}</Row>
              </dl>
              <form onSubmit={savePhone} className="mt-5 max-w-sm space-y-3" noValidate>
                {act.error && <Alert tone="error">{act.error}</Alert>}
                {saved && <Alert tone="success">{saved}</Alert>}
                <Field label={t("details.phone")} type="tel" dir="ltr" autoComplete="tel" value={phone} error={act.fields.phone} onChange={(e) => setPhone(e.target.value)} />
                <button type="submit" disabled={act.busy} className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">{t("details.savePhone")}</button>
              </form>
              <p className="mt-4 text-sm text-muted">{t("details.nameNote")}</p>
            </Card>
          </div>
        </div>
      )}
    </DataState>
  );
}
