import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, DataState, Empty, Field, PageHeader, Select, SmallButton, Table, Td, Th } from '../../components/ui';
import Dialog from '../../components/Dialog';
import { api } from '../../lib/api';
import type { SchoolClass, Subject } from '../../lib/types';
import { useAction, useFetch } from '../../lib/useFetch';

function EditClass({ cls, onClose, onDone }: { cls: SchoolClass; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('classes');
  const [f, setF] = useState({ stage: cls.stage as string, year: String(cls.year), arm: cls.arm ?? '' });
  const act = useAction();
  async function save(e: FormEvent) {
    e.preventDefault();
    if (await act.run(() => api(`/academic/classes/${cls.id}`, { method: 'PATCH', body: { stage: f.stage, year: Number(f.year), arm: f.arm.trim() || null } }))) onDone();
  }
  async function del() {
    if (!window.confirm(t('confirmDeleteClass', { name: cls.name }))) return;
    if (await act.run(() => api(`/academic/classes/${cls.id}`, { method: 'DELETE' }))) onDone();
  }
  return (
    <Dialog title={t('editClass', { name: cls.name })} onClose={onClose}>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-3" noValidate>
        <Select label={t('stage')} value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}><option value="JSS">JSS</option><option value="SSS">SSS</option></Select>
        <Select label={t('year')} value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })}><option>1</option><option>2</option><option>3</option></Select>
        <Field label={t('arm')} dir="ltr" value={f.arm} error={act.fields.arm} onChange={(e) => setF({ ...f, arm: e.target.value })} />
        <p className="text-sm text-muted sm:col-span-3">{t('changeNote')}</p>
        {act.error && <div className="sm:col-span-3"><Alert tone="error">{act.error}</Alert></div>}
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-3">
          <div className="w-full sm:w-auto sm:min-w-40"><Button type="submit" loading={act.busy}>{t('saveChanges')}</Button></div>
          <SmallButton type="button" tone="danger" disabled={act.busy} onClick={del}>{t('deleteClass')}</SmallButton>
        </div>
      </form>
    </Dialog>
  );
}

function EditSubject({ subject, onClose, onDone }: { subject: Subject; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('classes');
  const [f, setF] = useState({ name: subject.name, code: subject.code ?? '' });
  const act = useAction();
  async function save(e: FormEvent) {
    e.preventDefault();
    if (await act.run(() => api(`/academic/subjects/${subject.id}`, { method: 'PATCH', body: { name: f.name.trim(), code: f.code.trim() || null } }))) onDone();
  }
  async function del() {
    if (!window.confirm(t('confirmDeleteSubject', { name: subject.name }))) return;
    if (await act.run(() => api(`/academic/subjects/${subject.id}`, { method: 'DELETE' }))) onDone();
  }
  return (
    <Dialog title={t('editSubject', { name: subject.name })} onClose={onClose}>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label={t('subjectName')} value={f.name} error={act.fields.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Field label={t('codeOptional')} dir="ltr" value={f.code} error={act.fields.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
        {act.error && <div className="sm:col-span-2"><Alert tone="error">{act.error}</Alert></div>}
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
          <div className="w-full sm:w-auto sm:min-w-40"><Button type="submit" loading={act.busy}>{t('saveChanges')}</Button></div>
          <SmallButton type="button" tone="danger" disabled={act.busy} onClick={del}>{t('deleteSubject')}</SmallButton>
        </div>
      </form>
    </Dialog>
  );
}

export default function Classes() {
  const { t } = useTranslation('classes');
  const classes = useFetch<SchoolClass[]>('/academic/classes');
  const subjects = useFetch<Subject[]>('/academic/subjects');
  const [classId, setClassId] = useState('');
  const activeId = classes.data?.some((c) => c.id === classId) ? classId : classes.data?.[0]?.id || '';
  const offered = useFetch<Subject[]>(activeId ? `/academic/classes/${activeId}/subjects` : null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  useEffect(() => { setChecked(new Set(offered.data?.map((s) => s.id) ?? [])); }, [offered.data]);

  const [editCls, setEditCls] = useState<SchoolClass | null>(null);
  const [editSub, setEditSub] = useState<Subject | null>(null);
  const [notice, setNotice] = useState('');

  const addClass = useAction(); const [cf, setCf] = useState({ stage: 'JSS', year: '1', arm: '' });
  const addSubject = useAction(); const [sf, setSf] = useState({ name: '', code: '' });
  const save = useAction(); const [saved, setSaved] = useState(false);

  async function submitClass(e: FormEvent) {
    e.preventDefault();
    if (await addClass.run(() => api('/academic/classes', { body: { stage: cf.stage, year: Number(cf.year), arm: cf.arm.trim() || null } }))) {
      setCf({ ...cf, arm: '' }); classes.reload();
    }
  }
  async function submitSubject(e: FormEvent) {
    e.preventDefault();
    if (await addSubject.run(() => api('/academic/subjects', { body: { name: sf.name, ...(sf.code.trim() ? { code: sf.code.trim() } : {}) } }))) {
      setSf({ name: '', code: '' }); subjects.reload();
    }
  }
  async function saveSubjects() {
    setSaved(false);
    if (await save.run(() => api(`/academic/classes/${activeId}/subjects`, { method: 'PUT', body: { subjectIds: [...checked] } }))) { setSaved(true); offered.reload(); }
  }
  const toggle = (id: string) => { setSaved(false); setChecked((c) => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const done = (msg: string) => { setEditCls(null); setEditSub(null); setNotice(msg); classes.reload(); subjects.reload(); offered.reload(); };

  return (
    <>
      <PageHeader title={t('title')} intro={t('intro')} />
      {notice && <div className="mb-4"><Alert tone="success">{notice}</Alert></div>}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={t('classes')}>
          <DataState loading={classes.loading} error={classes.error}>
            {classes.data?.length ? (
              <ul className="flex flex-wrap gap-2">
                {classes.data.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => { setNotice(''); setEditCls(c); }} aria-label={t('editClass', { name: c.name })}
                      className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-900 hover:bg-brand-100">
                      <bdi>{c.name}</bdi> <span aria-hidden="true">✎</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <Empty>{t('noClasses')}</Empty>}
          </DataState>
          <form onSubmit={submitClass} className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-3" noValidate>
            <Select label={t('stage')} value={cf.stage} onChange={(e) => setCf({ ...cf, stage: e.target.value })}><option value="JSS">JSS</option><option value="SSS">SSS</option></Select>
            <Select label={t('year')} value={cf.year} onChange={(e) => setCf({ ...cf, year: e.target.value })}><option>1</option><option>2</option><option>3</option></Select>
            <Field label={t('arm')} dir="ltr" placeholder="A" value={cf.arm} error={addClass.fields.arm} onChange={(e) => setCf({ ...cf, arm: e.target.value })} />
            <div className="sm:col-span-3">
              {addClass.error && <div className="mb-3"><Alert tone="error">{addClass.error}</Alert></div>}
              <Button type="submit" loading={addClass.busy}>{t('addClass')}</Button>
            </div>
          </form>
        </Card>

        <Card title={t('subjects')}>
          <DataState loading={subjects.loading} error={subjects.error}>
            {subjects.data?.length ? (
              <Table><thead><tr><Th>{t('subject')}</Th><Th>{t('code')}</Th><Th /></tr></thead>
                <tbody>{subjects.data.map((s) => (
                  <tr key={s.id}><Td>{s.name}</Td><Td><bdi>{s.code ?? '-'}</bdi></Td>
                    <Td className="text-end"><SmallButton type="button" aria-label={t('editSubject', { name: s.name })} onClick={() => { setNotice(''); setEditSub(s); }}>{t('common:actions.edit')}</SmallButton></Td></tr>
                ))}</tbody></Table>
            ) : <Empty>{t('noSubjects')}</Empty>}
          </DataState>
          <form onSubmit={submitSubject} className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-2" noValidate>
            <Field label={t('subjectName')} value={sf.name} error={addSubject.fields.name} onChange={(e) => setSf({ ...sf, name: e.target.value })} />
            <Field label={t('codeOptional')} dir="ltr" value={sf.code} error={addSubject.fields.code} onChange={(e) => setSf({ ...sf, code: e.target.value })} />
            <div className="sm:col-span-2">
              {addSubject.error && <div className="mb-3"><Alert tone="error">{addSubject.error}</Alert></div>}
              <Button type="submit" loading={addSubject.busy}>{t('addSubject')}</Button>
            </div>
          </form>
        </Card>

        <div className="xl:col-span-2">
          <Card title={t('takenBy')}>
            {!classes.data?.length || !subjects.data?.length ? <Empty>{t('addFirst')}</Empty> : (
              <>
                <div className="max-w-xs"><Select label={t('classLabel')} value={activeId} onChange={(e) => { setClassId(e.target.value); setSaved(false); }}>
                  {classes.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select></div>
                <fieldset className="mt-5">
                  <legend className="mb-2 text-sm font-medium">{t('subjectsFor')}</legend>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {subjects.data.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                        <input type="checkbox" checked={checked.has(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4 accent-[#438f17]" />
                        {s.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="mt-5 max-w-xs space-y-3">
                  {save.error && <Alert tone="error">{save.error}</Alert>}
                  {saved && <Alert tone="success">{t('subjectsSaved')}</Alert>}
                  <Button type="button" loading={save.busy} onClick={saveSubjects}>{t('saveSubjects')}</Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
      {editCls && <EditClass cls={editCls} onClose={() => setEditCls(null)} onDone={() => done(t('updated'))} />}
      {editSub && <EditSubject subject={editSub} onClose={() => setEditSub(null)} onDone={() => done(t('updated'))} />}
    </>
  );
}
