// Two semesters a year, seven named classes, MREI references.
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx tests/phase20.test.ts   (API on :4000, migration 019 applied)
const B = 'http://localhost:4000/api';
const sfx = Date.now().toString(36);
let pass = 0, fail = 0;
async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(B + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, data: json.data, error: json.error, headers: res.headers };
}
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (expected ${JSON.stringify(want)}, got ${JSON.stringify(got)})`}`); ok ? pass++ : fail++;
}
(async () => {
  const { query, pool } = await import('../src/db/pool');
  const login = await call('POST', '/auth/login', undefined, { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
  const A = login.data.accessToken as string;
  check('refresh cookie is renamed to mrei_refresh', (login.headers.get('set-cookie') ?? '').startsWith('mrei_refresh='), true);

  console.log('\n-- semesters');
  const y = 2200 + (parseInt(sfx, 36) % 700);
  const sess = (await call('POST', '/academic/sessions', A, { name: `${y}/${y + 1}`, startDate: `${y}-01-01`, endDate: `${y}-12-31` })).data;
  const t1 = await call('POST', '/academic/terms', A, { sessionId: sess.id, termNumber: 1, startDate: `${y}-01-01`, endDate: `${y}-05-31` });
  const t2 = await call('POST', '/academic/terms', A, { sessionId: sess.id, termNumber: 2, startDate: `${y}-06-01`, endDate: `${y}-11-30` });
  check('first semester', [t1.status, t1.data?.name], [201, 'First Semester']);
  check('second semester', [t2.status, t2.data?.name], [201, 'Second Semester']);
  const t3 = await call('POST', '/academic/terms', A, { sessionId: sess.id, termNumber: 3, startDate: `${y}-12-01`, endDate: `${y}-12-30` });
  check('a third term is refused', t3.status, 400);
  check('listing shows two semesters', (await call('GET', `/academic/terms?sessionId=${sess.id}`, A)).data.map((t: any) => t.name), ['First Semester', 'Second Semester']);

  console.log('\n-- class names');
  const tag = 'M' + sfx.slice(-3).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
  const want: [string, number, string][] = [
    ['JSS', 1, 'Ihdaady Awwal'], ['JSS', 2, 'Ihdaady Thaany'], ['JSS', 3, 'Ihdaady Thaalith'], ['JSS', 4, 'Ihdaady Raabih'],
    ['SSS', 1, 'Thaanawiy Awwal'], ['SSS', 2, 'Thaanawiy Thaaniy'], ['SSS', 3, 'Thaanawiy Thaalith'],
  ];
  const ids: Record<string, string> = {};
  for (const [stage, year, name] of want) {
    const r = await call('POST', '/academic/classes', A, { stage, year, arm: tag });
    ids[name] = r.data?.id;
    check(`${name} ${tag}`, [r.status, r.data?.name], [201, `${name} ${tag}`]);
  }
  check('Thaanawiy has no fourth year', (await call('POST', '/academic/classes', A, { stage: 'SSS', year: 4, arm: tag })).status, 400);
  const mv = await call('PATCH', `/academic/classes/${ids['Ihdaady Awwal']}`, A, { year: 4 });
  check('moving a class to a level that already exists is refused', mv.status, 409);
  check('SSS 4 by editing is refused too', (await call('PATCH', `/academic/classes/${ids['Thaanawiy Awwal']}`, A, { year: 4 })).status, 400);
  check('class without an arm has no trailing space', (await query("select class_label('JSS', 1, null) as n")).rows[0].n, 'Ihdaady Awwal');

  console.log('\n-- promotion order');
  const s1 = (await call('POST', '/academic/sessions', A, { name: `${y + 1}/${y + 2}`, startDate: `${y + 1}-01-01`, endDate: `${y + 1}-12-31` })).data;
  const stu = await call('POST', '/users', A, { email: `s20.${sfx}@example.com`, role: 'student', firstName: 'Raabih', lastName: 'Test', admissionNumber: `MREI-${sfx}` });
  check('student created', stu.status, 201);
  await call('POST', `/academic/sessions/${sess.id}/set-current`, A);
  await call('POST', '/academic/enrolments', A, { studentId: stu.data.user.id, classId: ids['Ihdaady Raabih'], sessionId: sess.id });
  const prev = await call('POST', '/rollover/preview', A, { fromSessionId: sess.id, toSessionId: s1.id, createMissingClasses: true });
  check('rollover preview responds', prev.status, 200);
  const row = prev.data?.classes?.find((c: any) => c.fromClassName === `Ihdaady Raabih ${tag}`);
  check('Ihdaady Raabih moves up to Thaanawiy Awwal (same arm)', row?.target?.className, `Thaanawiy Awwal ${tag}`);
  const third = await call('POST', '/academic/enrolments', A, { studentId: stu.data.user.id, classId: ids['Thaanawiy Thaalith'], sessionId: s1.id });
  void third;

  console.log('\n-- application references and names');
  const ap = await call('POST', '/public/admissions/apply', undefined, {
    firstName: 'Zaid', lastName: 'Test', dateOfBirth: '2014-01-01', classStage: 'JSS', classYear: 4, guardianName: 'G Test',
    guardianPhone: '08030000000', guardianEmail: `g20.${sfx}@example.com`, consent: true, website: '',
  });
  check('Ihdaady Raabih applications are accepted', [ap.status, /^MREI-APP-\d{6}$/.test(ap.data?.reference ?? '')], [201, true]);
  const look = await call('POST', '/public/admissions/status', undefined, { reference: ap.data?.reference, email: `g20.${sfx}@example.com` });
  check('status lookup shows the new class name', [look.status, look.data?.applyingFor], [200, 'Ihdaady Raabih']);
  const bad = await call('POST', '/public/admissions/apply', undefined, { firstName: 'Zaid', lastName: 'Test', dateOfBirth: '2014-01-01', classStage: 'SSS', classYear: 4, guardianName: 'G Test', guardianPhone: '08030000000', guardianEmail: `g21.${sfx}@example.com`, consent: true, website: '' });
  check('Thaanawiy year 4 on the public form is a clear 400, not a server error', bad.status, 400);
  const old = await call('POST', '/public/admissions/status', undefined, { reference: 'KOK-APP-000001', email: 'nobody@example.com' });
  check('an old KOK- reference is still a valid format (not found, not a validation error)', old.status, 404);
  const acad = await call('GET', '/public/academics');
  check('public academics lists 4 + 3 levels', acad.data.stages.map((s: any) => s.levels.map((l: any) => l.name)), [
    ['Ihdaady Awwal', 'Ihdaady Thaany', 'Ihdaady Thaalith', 'Ihdaady Raabih'], ['Thaanawiy Awwal', 'Thaanawiy Thaaniy', 'Thaanawiy Thaalith'],
  ]);
  await pool.end();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
