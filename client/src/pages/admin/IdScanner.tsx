import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Alert, Badge, Card, Field, PageHeader } from "../../components/ui";
import Avatar from "../../components/Avatar";
import CameraScanner from "../../components/idcards/CameraScanner";
import { api } from "../../lib/api";
import { messageOf } from "../../lib/forms";

type Outcome = "valid" | "invalid" | "unknown" | "revoked" | "expired" | "replaced" | "suspended" | "inactive";
interface Person {
  id: string; role: "admin" | "teacher" | "student" | "parent"; name: string; accountStatus: string; avatarVersion: number | null;
  admissionNumber?: string; className?: string | null; sessionName?: string | null; attendance?: { present: number; late: number; absent: number } | null;
  staffNumber?: string | null; designation?: string; classes?: string[]; children?: { name: string; relationship: string; className: string | null }[];
}
interface ScanResult { outcome: Outcome; cardNumber: string | null; expiresAt?: string | null; person?: Person }

const Field2 = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><dt className="text-xs uppercase text-muted">{label}</dt><dd className="text-sm font-semibold">{children}</dd></div>
);

function Result({ r, onAgain }: { r: ScanResult; onAgain: () => void }) {
  const { t, i18n } = useTranslation("idcards");
  const good = r.outcome === "valid";
  const p = r.person;
  return (
    <div role="status" aria-live="polite" className={`rounded-xl border-2 p-4 ${good ? "border-brand-500 bg-brand-50" : "border-red-300 bg-red-50"}`}>
      <p className={`flex items-center gap-2 text-lg font-bold ${good ? "text-brand-900" : "text-red-900"}`}><span aria-hidden="true">{good ? "✔" : "✖"}</span>{t(`scanner.outcome.${r.outcome}`)}</p>
      {!good && <p className="mt-1 text-sm text-red-900">{t(`scanner.outcomeHelp.${r.outcome}`)}</p>}
      {!good && r.cardNumber && <p className="mt-1 text-sm text-red-900">{t("scanner.field.cardNo")}: <bdi>{r.cardNumber}</bdi></p>}
      {good && p && (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
          <Avatar userId={p.id} name={p.name} version={p.avatarVersion} size={96} className="border-4 border-gold-400" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl font-bold">{p.name}</p>
            <p className="mt-0.5"><Badge tone="good">{t(`common:roles.${p.role}`)}</Badge> <Badge tone={p.accountStatus === "active" ? "good" : "warn"}>{p.accountStatus}</Badge></p>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              {p.admissionNumber && <Field2 label={t("scanner.field.admission")}><bdi>{p.admissionNumber}</bdi></Field2>}
              {p.staffNumber && <Field2 label={t("scanner.field.staff")}><bdi>{p.staffNumber}</bdi></Field2>}
              {p.role === "student" && <Field2 label={t("scanner.field.class")}>{p.className ? <bdi>{p.className}</bdi> : "-"}</Field2>}
              {p.sessionName && <Field2 label={t("scanner.field.session")}><bdi>{p.sessionName}</bdi></Field2>}
              {p.designation && <Field2 label={t("scanner.field.designation")}>{p.designation}</Field2>}
              {p.classes && p.classes.length > 0 && <Field2 label={t("scanner.field.classes")}>{p.classes.map((c) => <bdi key={c} className="me-2 inline-block">{c}</bdi>)}</Field2>}
              {r.cardNumber && <Field2 label={t("scanner.field.cardNo")}><bdi>{r.cardNumber}</bdi></Field2>}
              {r.expiresAt && <Field2 label={t("scanner.field.expires")}>{new Date(r.expiresAt).toLocaleDateString(i18n.language === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { day: "2-digit", month: "short", year: "numeric" })}</Field2>}
            </dl>
            {p.role === "student" && (
              <div className="mt-3 text-sm"><p className="text-xs uppercase text-muted">{t("scanner.field.attendance")}</p>
                {p.attendance ? <p className="font-semibold">{t("scanner.field.present")}: {p.attendance.present} · {t("scanner.field.late")}: {p.attendance.late} · {t("scanner.field.absent")}: {p.attendance.absent}</p> : <p className="text-muted">{t("scanner.field.noAttendance")}</p>}</div>
            )}
            {p.children && p.children.length > 0 && (
              <div className="mt-3"><p className="text-xs uppercase text-muted">{t("scanner.field.children")}</p>
                <ul className="mt-1 space-y-0.5 text-sm font-semibold">{p.children.map((c, i) => <li key={i}>{c.name}{c.className ? <> · <bdi>{c.className}</bdi></> : null}</li>)}</ul></div>
            )}
          </div>
        </div>
      )}
      <div className="mt-4"><button type="button" onClick={onAgain} className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">{t("scanner.scanAgain")}</button></div>
    </div>
  );
}

export default function IdScanner() {
  const { t } = useTranslation("idcards");
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [manual, setManual] = useState("");
  const busy = useRef(false); // a code being processed is never processed twice

  const lookup = useCallback(async (code: string, method: "qr" | "manual") => {
    if (busy.current) return;
    busy.current = true; setChecking(true); setError("");
    try {
      const r = await api<ScanResult>("/admin/id-cards/scan", { body: { code, method } });
      setResult(r);
      navigator.vibrate?.(r.outcome === "valid" ? 80 : [80, 60, 80]);
    } catch (e) { setError(messageOf(e)); } finally { busy.current = false; setChecking(false); }
  }, []);

  // Arriving from a scanned card link (/id/<code>) as an administrator: look it up straight away, then drop the code from the address.
  useEffect(() => {
    const c = params.get("code");
    if (c) { void lookup(c, "qr"); setParams({}, { replace: true }); }
  }, [params, lookup, setParams]);

  function again() { setResult(null); setError(""); setManual(""); document.getElementById('scan-manual')?.focus(); }
  function submit(e: FormEvent) { e.preventDefault(); if (manual.trim()) void lookup(manual.trim(), "manual"); }

  return (
    <>
      <PageHeader title={t("scanner.title")} intro={t("scanner.intro")} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CameraScanner paused={checking || !!result} onCode={(c) => void lookup(c, "qr")} />
        </Card>
        <div className="space-y-6">
          <Card title={t("scanner.manual")}>
            <form onSubmit={submit} className="flex flex-wrap items-end gap-3" noValidate>
              <div className="min-w-0 flex-1"><Field id="scan-manual" label={t("scanner.manualHint")} dir="ltr" autoComplete="off" autoCapitalize="characters" value={manual} onChange={(e) => setManual(e.target.value)} hint={t("scanner.manualHelp")} /></div>
              <button type="submit" disabled={checking || !manual.trim()} className="mb-7 rounded-lg bg-brand-500 px-4 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-60">{checking ? t("scanner.checking") : t("scanner.lookup")}</button>
            </form>
          </Card>
          {error && <Alert tone="error">{error}</Alert>}
          {checking && !result && <p className="text-sm text-muted">{t("scanner.checking")}</p>}
          {result && <Result r={result} onAgain={again} />}
        </div>
      </div>
    </>
  );
}
