import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Badge, Card, DataState, Empty, Field, PageHeader, Select, SmallButton, Table, Td, Th } from "../../components/ui";
import Dialog from "../../components/Dialog";
import Avatar from "../../components/Avatar";
import { CardBack, CardFront } from "../../components/idcards/IdCardPreview";
import type { CardFace, CardState, CardTemplate, HistoryRow, Page, PersonRow, Role } from "../../components/idcards/types";
import { api, fetchApiBlob, printBlob, saveBlob, uploadWithProgress } from "../../lib/api";
import { messageOf } from "../../lib/forms";
import { useAction, useFetch } from "../../lib/useFetch";
import type { SchoolClass, Session } from "../../lib/types";

type Tab = "people" | "history" | "template";
const TONE: Record<string, "neutral" | "good" | "warn" | "bad"> = { none: "neutral", active: "good", suspended: "warn", revoked: "bad", replaced: "neutral", expired: "bad", preview: "neutral" };
const ROLES: Role[] = ["student", "teacher", "parent", "admin"];

const StateBadge = ({ s }: { s: string }) => {
  const { t } = useTranslation("idcards");
  return <Badge tone={TONE[s] ?? "neutral"}>{t(`state.${s}`)}</Badge>;
};
const when = (d: string | null, lang: string) => (d ? new Date(d).toLocaleDateString(lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-");

// ---------------------------------------------------------------- preview dialog
function PreviewDialog({ person, tpl, onClose, onGenerate, onChanged }: { person: PersonRow; tpl: CardTemplate; onClose: () => void; onGenerate: (p: PersonRow) => void; onChanged: (msg: string) => void }) {
  const { t } = useTranslation("idcards");
  const hasLive = person.cardId && ["active", "suspended", "expired"].includes(person.cardState);
  const [data, setData] = useState<CardFace | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    (hasLive ? api<CardFace>(`/admin/id-cards/${person.cardId}/preview`) : api<CardFace>("/admin/id-cards/preview", { body: { userId: person.id } }))
      .then((d) => live && setData(d)).catch((e) => live && setErr(messageOf(e)));
    return () => { live = false; };
  }, [person.id, person.cardId, hasLive]);

  async function pdf(print: boolean) {
    if (!person.cardId) return;
    setBusy(true); setErr("");
    try {
      const b = await fetchApiBlob(`/admin/id-cards/${person.cardId}/pdf`);
      print ? printBlob(b) : saveBlob(b, `id-card-${person.cardNumber}.pdf`);
    } catch (e) { setErr(messageOf(e)); } finally { setBusy(false); }
  }
  return (
    <Dialog title={`${t("preview.title")}: ${person.name}`} onClose={onClose} wide>
      {err && <Alert tone="error">{err}</Alert>}
      {!data && !err && <p className="py-6 text-sm text-muted">{t("common:states.loading")}</p>}
      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div><p className="mb-1 text-sm font-medium text-muted">{t("preview.front")}</p><CardFront face={data} tpl={tpl} /></div>
            <div><p className="mb-1 text-sm font-medium text-muted">{t("preview.back")}</p><CardBack face={data} tpl={tpl} /></div>
          </div>
          {!hasLive && <p className="mt-3 text-sm text-muted">{t("preview.sampleNote")}</p>}
          <p className="mt-3 text-sm text-muted">{t("preview.printTip")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {hasLive ? (
              <>
                <button type="button" disabled={busy} onClick={() => pdf(false)} className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">{t("preview.downloadPdf")}</button>
                <SmallButton type="button" disabled={busy} onClick={() => pdf(true)}>{t("preview.printCard")}</SmallButton>
              </>
            ) : (
              <button type="button" onClick={() => onGenerate(person)} className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">{t("preview.generateThis")}</button>
            )}
          </div>
        </>
      )}
    </Dialog>
  );
}

// ---------------------------------------------------------------- confirmation (regenerate / revoke)
function Confirm({ title, body, action, withReason, danger, onCancel, onConfirm }: {
  title: string; body: string; action: string; withReason?: boolean; danger?: boolean; onCancel: () => void; onConfirm: (reason?: string) => Promise<void>;
}) {
  const { t } = useTranslation("idcards");
  const [reason, setReason] = useState("");
  const act = useAction();
  return (
    <Dialog title={title} onClose={onCancel}>
      <p className="text-sm">{body}</p>
      {withReason && <div className="mt-4"><Field label={t("confirm.reason")} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} /></div>}
      {act.error && <div className="mt-3"><Alert tone="error">{act.error}</Alert></div>}
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" disabled={act.busy} onClick={async () => { await act.run(() => onConfirm(reason.trim() || undefined)); }}
          className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${danger ? "bg-red-700 hover:bg-red-800" : "bg-brand-500 hover:bg-brand-600"}`}>
          {act.busy ? t("common:states.pleaseWait") : action}
        </button>
        <SmallButton type="button" onClick={onCancel}>{t("common:actions.cancel")}</SmallButton>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- people tab
function PeopleTab({ tpl, notify }: { tpl: CardTemplate; notify: (m: string, tone?: "success" | "error") => void }) {
  const { t, i18n } = useTranslation("idcards");
  const classes = useFetch<SchoolClass[]>("/academic/classes");
  const sessions = useFetch<Session[]>("/academic/sessions");
  const [f, setF] = useState({ q: "", role: "", classId: "", sessionId: "", card: "any" });
  const [qInput, setQInput] = useState("");
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<Map<string, PersonRow>>(new Map());
  const [preview, setPreview] = useState<PersonRow | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: "regen" | "revoke" | "bulkRegen"; person?: PersonRow }>(null);
  const [busy, setBusy] = useState(false);

  const qs = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: "25", card: f.card });
    if (f.q) p.set("q", f.q); if (f.role) p.set("role", f.role); if (f.classId) p.set("classId", f.classId); if (f.sessionId) p.set("sessionId", f.sessionId);
    return p;
  }, [f, page]);
  const list = useFetch<Page<PersonRow>>(`/admin/id-cards/users?${qs}`);
  const setFilter = (patch: Partial<typeof f>) => { setF((o) => ({ ...o, ...patch })); setPage(1); setSel(new Map()); };
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;
  const rows = list.data?.items ?? [];
  const allOnPage = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const toggle = (r: PersonRow) => setSel((m) => { const n = new Map(m); n.has(r.id) ? n.delete(r.id) : n.set(r.id, r); return n; });
  const toggleAll = () => setSel((m) => { const n = new Map(m); allOnPage ? rows.forEach((r) => n.delete(r.id)) : rows.forEach((r) => n.set(r.id, r)); return n; });
  const selected = [...sel.values()];
  const liveIds = selected.filter((p) => p.cardId && ["active", "suspended", "expired"].includes(p.cardState)).map((p) => p.cardId!) ;

  async function generate(body: { userIds?: string[]; filter?: object; mode: "missing" | "replace" }) {
    const r = await api<{ issued: unknown[]; skipped: unknown[] }>("/admin/id-cards/generate", { body });
    notify(t("bulk.result", { issued: r.issued.length, skipped: r.skipped.length }));
    setSel(new Map()); list.reload();
  }
  async function bulkPdf(print: boolean) {
    if (!liveIds.length) { notify(t("bulk.noSelection"), "error"); return; }
    setBusy(true);
    try {
      const b = await fetchApiBlob("/admin/id-cards/pdf", { body: { cardIds: liveIds.slice(0, 200), layout: "sheet" } });
      print ? printBlob(b) : saveBlob(b, `id-cards-${liveIds.length}.pdf`);
    } catch (e) { notify(messageOf(e), "error"); } finally { setBusy(false); }
  }
  async function rowPdf(p: PersonRow, print: boolean) {
    try { const b = await fetchApiBlob(`/admin/id-cards/${p.cardId}/pdf`); print ? printBlob(b) : saveBlob(b, `id-card-${p.cardNumber}.pdf`); } catch (e) { notify(messageOf(e), "error"); }
  }
  async function simple(path: string, msg?: string) { try { await api(path, { method: "POST", body: {} }); if (msg) notify(msg); list.reload(); } catch (e) { notify(messageOf(e), "error"); } }

  const search = (e: FormEvent) => { e.preventDefault(); setFilter({ q: qInput.trim() }); };
  const idOf = (r: PersonRow) => r.admissionNumber ?? r.staffNumber ?? "-";
  const live = (r: PersonRow) => ["active", "suspended", "expired"].includes(r.cardState);

  return (
    <>
      <Card>
        <form onSubmit={search} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6" noValidate>
          <div className="sm:col-span-2"><Field label={t("filters.search")} placeholder={t("filters.searchHint")} value={qInput} onChange={(e) => setQInput(e.target.value)} /></div>
          <Select label={t("filters.role")} value={f.role} onChange={(e) => setFilter({ role: e.target.value })}>
            <option value="">{t("filters.allRoles")}</option>{ROLES.map((r) => <option key={r} value={r}>{t(`common:roles.${r}`)}</option>)}
          </Select>
          <Select label={t("filters.class")} value={f.classId} onChange={(e) => setFilter({ classId: e.target.value })}>
            <option value="">{t("filters.allClasses")}</option>{classes.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select label={t("filters.session")} value={f.sessionId} onChange={(e) => setFilter({ sessionId: e.target.value })}>
            <option value="">{t("filters.currentSession")}</option>{sessions.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Select label={t("filters.card")} value={f.card} onChange={(e) => setFilter({ card: e.target.value })}>
            {["any", "has", "missing", "expired", "revoked", "suspended"].map((c) => <option key={c} value={c}>{t(`filters.${c}`)}</option>)}
          </Select>
          <div className="flex items-end"><button type="submit" className="w-full rounded-lg border border-line px-4 py-2.5 text-sm font-semibold hover:bg-brand-50">{t("common:actions.search")}</button></div>
        </form>
      </Card>

      <div className="mt-4 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="me-2 text-sm font-medium">{t("bulk.selected", { count: selected.length })}</span>
          <button type="button" disabled={!selected.length || busy} onClick={() => generate({ userIds: selected.map((p) => p.id), mode: "missing" }).catch((e) => notify(messageOf(e), "error"))}
            className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{t("bulk.generate")}</button>
          <SmallButton type="button" disabled={!selected.length || busy} onClick={() => setConfirm({ kind: "bulkRegen" })}>{t("bulk.regenerate")}</SmallButton>
          <SmallButton type="button" disabled={!liveIds.length || busy} onClick={() => bulkPdf(false)}>{t("bulk.pdf")}</SmallButton>
          <SmallButton type="button" disabled={!liveIds.length || busy} onClick={() => bulkPdf(true)}>{t("bulk.print")}</SmallButton>
        </div>
        {!!list.data?.total && (
          <div className="mt-3 border-t border-line pt-3">
            <SmallButton type="button" disabled={busy} onClick={() => generate({ filter: { role: f.role || undefined, classId: f.classId || undefined, sessionId: f.sessionId || undefined, q: f.q || undefined, card: "missing" }, mode: "missing" }).catch((e) => notify(messageOf(e), "error"))}>
              {t("bulk.generateAll", { count: list.data.total })}
            </SmallButton>
            <p className="mt-2 text-xs text-muted">{t("bulk.onlyMissing")}</p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <Card>
          <DataState loading={list.loading} error={list.error}>
            {rows.length === 0 ? <Empty>{t("table.empty")}</Empty> : (
              <Table>
                <thead><tr>
                  <Th><input type="checkbox" aria-label={t("table.selectAll")} checked={allOnPage} onChange={toggleAll} className="h-4 w-4 accent-[#438f17]" /></Th>
                  <Th>{t("table.person")}</Th><Th>{t("table.id")}</Th><Th>{t("table.card")}</Th><Th>{t("table.actions")}</Th>
                </tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <Td><input type="checkbox" aria-label={t("table.select", { name: r.name })} checked={sel.has(r.id)} onChange={() => toggle(r)} className="h-4 w-4 accent-[#438f17]" /></Td>
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar userId={r.id} name={r.name} version={r.avatarVersion} size={36} />
                          <div className="min-w-0"><p className="font-medium">{r.name}</p><p className="text-xs text-muted">{t(`common:roles.${r.role}`)}{r.className ? <> · <bdi>{r.className}</bdi></> : null}</p></div>
                        </div>
                      </Td>
                      <Td><bdi>{idOf(r)}</bdi></Td>
                      <Td>
                        <StateBadge s={r.cardState} />
                        {r.cardNumber && <p className="mt-1 text-xs text-muted"><bdi>{r.cardNumber}</bdi>{r.expiresAt ? <> · {when(r.expiresAt, i18n.language)}</> : null}</p>}
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1.5">
                          <SmallButton type="button" onClick={() => setPreview(r)}>{t("row.preview")}</SmallButton>
                          {!live(r) && <SmallButton type="button" onClick={() => generate({ userIds: [r.id], mode: "missing" }).catch((e) => notify(messageOf(e), "error"))}>{t("row.generate")}</SmallButton>}
                          {live(r) && <>
                            <SmallButton type="button" onClick={() => rowPdf(r, false)}>{t("row.download")}</SmallButton>
                            <SmallButton type="button" onClick={() => rowPdf(r, true)}>{t("row.print")}</SmallButton>
                            <SmallButton type="button" onClick={() => setConfirm({ kind: "regen", person: r })}>{t("row.regenerate")}</SmallButton>
                            {r.cardState === "suspended"
                              ? <SmallButton type="button" onClick={() => simple(`/admin/id-cards/${r.cardId}/reactivate`)}>{t("row.reactivate")}</SmallButton>
                              : r.cardState === "active" && <SmallButton type="button" onClick={() => simple(`/admin/id-cards/${r.cardId}/suspend`)}>{t("row.suspend")}</SmallButton>}
                            <SmallButton type="button" tone="danger" onClick={() => setConfirm({ kind: "revoke", person: r })}>{t("row.revoke")}</SmallButton>
                          </>}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </DataState>
          {list.data && list.data.total > list.data.pageSize && (
            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
              <SmallButton type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("common:actions.previous")}</SmallButton>
              <span>{t("common:pagination.page", { page, pages })}</span>
              <SmallButton type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t("common:actions.next")}</SmallButton>
            </div>
          )}
        </Card>
      </div>

      {preview && <PreviewDialog person={preview} tpl={tpl} onClose={() => setPreview(null)} onChanged={() => list.reload()}
        onGenerate={(p) => { setPreview(null); generate({ userIds: [p.id], mode: "missing" }).catch((e) => notify(messageOf(e), "error")); }} />}
      {confirm?.kind === "regen" && confirm.person && (
        <Confirm title={t("confirm.regenerateTitle")} body={t("confirm.regenerateBody")} action={t("confirm.regenerateAction")} onCancel={() => setConfirm(null)}
          onConfirm={async () => { await generate({ userIds: [confirm.person!.id], mode: "replace" }); setConfirm(null); }} />
      )}
      {confirm?.kind === "bulkRegen" && (
        <Confirm title={t("confirm.bulkRegenerateTitle", { count: selected.length })} body={t("confirm.bulkRegenerateBody")} action={t("confirm.regenerateAction")} onCancel={() => setConfirm(null)}
          onConfirm={async () => { await generate({ userIds: selected.map((p) => p.id), mode: "replace" }); setConfirm(null); }} />
      )}
      {confirm?.kind === "revoke" && confirm.person && (
        <Confirm danger withReason title={t("confirm.revokeTitle")} body={t("confirm.revokeBody")} action={t("confirm.revokeAction")} onCancel={() => setConfirm(null)}
          onConfirm={async (reason) => { await api(`/admin/id-cards/${confirm.person!.cardId}/revoke`, { body: { reason } }); notify(t("state.revoked")); setConfirm(null); list.reload(); }} />
      )}
    </>
  );
}

// ---------------------------------------------------------------- history tab
function HistoryTab() {
  const { t, i18n } = useTranslation("idcards");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const h = useFetch<Page<HistoryRow>>(`/admin/id-cards/history?page=${page}&pageSize=25${status ? `&status=${status}` : ""}`);
  const scans = useFetch<{ id: number; method: string; outcome: string; at: string; cardNumber: string | null; person: string | null; scannedBy: string | null }[]>("/admin/id-cards/scans");
  const pages = h.data ? Math.max(1, Math.ceil(h.data.total / h.data.pageSize)) : 1;
  return (
    <div className="grid gap-6">
      <Card title={t("history.title")}>
        <div className="mb-4 max-w-xs">
          <Select label={t("history.filterStatus")} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">{t("filters.any")}</option>
            {["active", "suspended", "revoked", "replaced", "expired"].map((s) => <option key={s} value={s}>{t(`state.${s}`)}</option>)}
          </Select>
        </div>
        <DataState loading={h.loading} error={h.error}>
          {h.data?.items.length ? (
            <Table>
              <thead><tr><Th>{t("history.card")}</Th><Th>{t("history.person")}</Th><Th>{t("history.issued")}</Th><Th>{t("history.expires")}</Th><Th>{t("history.status")}</Th><Th>{t("history.scans")}</Th></tr></thead>
              <tbody>
                {h.data.items.map((r) => (
                  <tr key={r.id}>
                    <Td><bdi>{r.cardNumber}</bdi></Td>
                    <Td>{r.userName}<p className="text-xs text-muted">{t(`common:roles.${r.category}`)}</p></Td>
                    <Td>{when(r.issuedAt, i18n.language)}{r.issuedBy && <p className="text-xs text-muted">{t("history.by")}: {r.issuedBy}</p>}</Td>
                    <Td>{when(r.expiresAt, i18n.language)}</Td>
                    <Td><StateBadge s={r.state} />
                      {r.revokedAt && <p className="mt-1 text-xs text-muted">{t("history.revokedOn", { date: when(r.revokedAt, i18n.language) })}{r.revokeReason ? ` · ${t("history.reason", { reason: r.revokeReason })}` : ""}</p>}</Td>
                    <Td>{r.scans}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : <Empty>{t("history.empty")}</Empty>}
        </DataState>
        {h.data && h.data.total > h.data.pageSize && (
          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <SmallButton type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("common:actions.previous")}</SmallButton>
            <span>{t("common:pagination.page", { page, pages })}</span>
            <SmallButton type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t("common:actions.next")}</SmallButton>
          </div>
        )}
      </Card>
      <Card title={t("history.recentScans")}>
        <DataState loading={scans.loading} error={scans.error}>
          {scans.data?.length ? (
            <ul className="divide-y divide-line text-sm">
              {scans.data.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span><Badge tone={s.outcome === "valid" ? "good" : "bad"}>{t(`scanner.outcome.${s.outcome}`)}</Badge> <bdi>{s.cardNumber ?? ""}</bdi> {s.person ?? ""}</span>
                  <span className="text-xs text-muted">{new Date(s.at).toLocaleString(i18n.language === "ar" ? "ar-EG-u-nu-latn" : "en-GB")}{s.scannedBy ? ` · ${s.scannedBy}` : ""}</span>
                </li>
              ))}
            </ul>
          ) : <Empty>{t("history.noScans")}</Empty>}
        </DataState>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- design (template) tab
function TemplateTab({ tpl, onSaved }: { tpl: CardTemplate; onSaved: () => void }) {
  const { t } = useTranslation("idcards");
  const [f, setF] = useState<CardTemplate>(tpl);
  const [role, setRole] = useState<Role>("student");
  const [sample, setSample] = useState<CardFace | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  useEffect(() => setF(tpl), [tpl]);

  useEffect(() => {
    let live = true;
    api<Page<PersonRow>>(`/admin/id-cards/users?role=${role}&pageSize=1`).then((p) => {
      const u = p.items[0];
      if (!u) { if (live) setSample(null); return; }
      return api<CardFace>("/admin/id-cards/preview", { body: { userId: u.id } }).then((d) => live && setSample(d));
    }).catch(() => live && setSample(null));
    return () => { live = false; };
  }, [role]);

  const set = <K extends keyof CardTemplate>(k: K, v: CardTemplate[K]) => setF((o) => ({ ...o, [k]: v }));
  const setShow = (k: keyof CardTemplate["show"], v: boolean) => setF((o) => ({ ...o, show: { ...o.show, [k]: v } }));

  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const { logoKey: _l, ...body } = f; void _l;
      await api("/admin/id-cards/template", { method: "PUT", body: { ...body, validityMonths: Number(f.validityMonths) } });
      setMsg({ tone: "success", text: t("template.saved") }); onSaved();
    } catch (err) { setMsg({ tone: "error", text: messageOf(err) }); } finally { setBusy(false); }
  }
  async function logo(file: File | undefined) {
    if (!file) return; setBusy(true); setMsg(null); setPct(0);
    try { await uploadWithProgress("/admin/id-cards/template/logo", file, setPct); onSaved(); } catch (err) { setMsg({ tone: "error", text: messageOf(err) }); } finally { setBusy(false); }
  }
  async function dropLogo() { setBusy(true); try { await api("/admin/id-cards/template/logo", { method: "DELETE" }); onSaved(); } catch (err) { setMsg({ tone: "error", text: messageOf(err) }); } finally { setBusy(false); } }

  const toggles: [keyof CardTemplate["show"], string][] = [["photo", "photo"], ["number", "number"], ["classInfo", "classInfo"], ["session", "session"], ["issueDate", "issueDate"], ["expiry", "expiry"]];
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card title={t("template.title")}>
        <p className="mb-4 text-sm text-muted">{t("template.intro")}</p>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label={t("template.schoolName")} value={f.schoolName} onChange={(e) => set("schoolName", e.target.value)} />
          <Field label={t("template.prefix")} hint={t("template.prefixHint")} dir="ltr" value={f.cardPrefix} maxLength={6} onChange={(e) => set("cardPrefix", e.target.value)} />
          <div className="sm:col-span-2"><Field label={t("template.address")} value={f.address} onChange={(e) => set("address", e.target.value)} /></div>
          <Field label={t("template.phone")} dir="ltr" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
          <Field label={t("template.email")} dir="ltr" value={f.email} onChange={(e) => set("email", e.target.value)} />
          <label className="block text-sm font-medium">{t("template.primary")}
            <input type="color" value={f.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} className="mt-1.5 block h-11 w-full cursor-pointer rounded-lg border border-line bg-surface p-1" /></label>
          <label className="block text-sm font-medium">{t("template.accent")}
            <input type="color" value={f.accentColor} onChange={(e) => set("accentColor", e.target.value)} className="mt-1.5 block h-11 w-full cursor-pointer rounded-lg border border-line bg-surface p-1" /></label>
          <div className="sm:col-span-2"><Field label={t("template.footer")} value={f.footerText} maxLength={80} onChange={(e) => set("footerText", e.target.value)} /></div>
          <div className="sm:col-span-2"><Field label={t("template.backText")} value={f.backText} maxLength={240} onChange={(e) => set("backText", e.target.value)} /></div>
          <Field label={t("template.validity")} hint={t("template.validityHint")} type="number" min={0} max={120} value={String(f.validityMonths)} onChange={(e) => set("validityMonths", Number(e.target.value))} />
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-medium">{t("template.show")}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {toggles.map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                  <input type="checkbox" checked={f.show[k]} onChange={(e) => setShow(k, e.target.checked)} className="h-4 w-4 accent-[#438f17]" />{t(`template.${label}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-sm font-medium">{t("template.logo")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:bg-brand-50">{t("template.uploadLogo")}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => { void logo(e.target.files?.[0]); e.target.value = ""; }} /></label>
              {tpl.logoKey && <SmallButton type="button" tone="danger" disabled={busy} onClick={dropLogo}>{t("template.removeLogo")}</SmallButton>}
              {busy && pct > 0 && pct < 100 && <span className="text-xs text-muted">{pct}%</span>}
            </div>
            <p className="mt-1 text-xs text-muted">{t("template.logoHint")}</p>
          </div>
          <p className="text-xs text-muted sm:col-span-2">{t("template.latinNote")}</p>
          {msg && <div className="sm:col-span-2"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
          <div className="sm:col-span-2"><button type="submit" disabled={busy} className="w-full rounded-lg bg-brand-500 px-4 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-60 sm:w-auto">{t("template.saveDesign")}</button></div>
        </form>
      </Card>
      <Card title={t("template.preview")}>
        <div className="mb-4 max-w-xs">
          <Select label={t("template.previewPerson")} value={role} onChange={(e) => setRole(e.target.value as Role)}>{ROLES.map((r) => <option key={r} value={r}>{t(`common:roles.${r}`)}</option>)}</Select>
        </div>
        {sample ? (
          <div className="space-y-4">
            <div><p className="mb-1 text-sm font-medium text-muted">{t("preview.front")}</p><CardFront face={sample} tpl={f} /></div>
            <div><p className="mb-1 text-sm font-medium text-muted">{t("preview.back")}</p><CardBack face={sample} tpl={f} /></div>
          </div>
        ) : <Empty>{t("table.empty")}</Empty>}
        <p className="mt-3 text-sm text-muted">{t("preview.sampleNote")}</p>
      </Card>
    </div>
  );
}

export default function IdCards() {
  const { t } = useTranslation("idcards");
  const [tab, setTab] = useState<Tab>("people");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const tpl = useFetch<CardTemplate>("/admin/id-cards/template");
  const notify = (text: string, tone: "success" | "error" = "success") => setNotice({ tone, text });
  const tabs: Tab[] = ["people", "history", "template"];
  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <div role="tablist" aria-label={t("title")} className="mb-5 flex flex-wrap gap-2">
        {tabs.map((k) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => { setTab(k); setNotice(null); }}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold ${tab === k ? "border-brand-500 bg-brand-500 text-white" : "border-line hover:bg-brand-50"}`}>{t(`tabs.${k}`)}</button>
        ))}
      </div>
      {notice && <div className="mb-4"><Alert tone={notice.tone}>{notice.text}</Alert></div>}
      <DataState loading={tpl.loading && !tpl.data} error={tpl.error}>
        {tpl.data && (tab === "people" ? <PeopleTab tpl={tpl.data} notify={notify} /> : tab === "history" ? <HistoryTab /> : <TemplateTab tpl={tpl.data} onSaved={tpl.reload} />)}
      </DataState>
    </>
  );
}

export type { CardState };
