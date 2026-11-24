// Profile pictures, ID cards, scanning, and editing classes and subjects.
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx tests/phase19.test.ts   (API on :4000, migration 018 applied)
import sharp from "sharp";
import crypto from "crypto";
const B = "http://localhost:4000/api";
const sfx = Date.now().toString(36);
let pass = 0,
  fail = 0;
async function call(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
) {
  const res = await fetch(B + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, data: json.data, error: json.error };
}
async function raw(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
) {
  const res = await fetch(B + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: res.status,
    type: res.headers.get("content-type") ?? "",
    buf: Buffer.from(await res.arrayBuffer()),
  };
}
async function upload(
  path: string,
  token: string,
  buf: Buffer,
  name: string,
  mime: string,
  method = "POST",
) {
  const f = new FormData();
  f.append("file", new Blob([new Uint8Array(buf)], { type: mime }), name);
  const res = await fetch(B + path, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: f,
  });
  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, data: json.data, error: json.error };
}
function check(name: string, got: unknown, want: unknown) {
  const okk = JSON.stringify(got) === JSON.stringify(want);
  console.log(
    `${okk ? "PASS" : "FAIL"}  ${name}${okk ? "" : `  (expected ${JSON.stringify(want)}, got ${JSON.stringify(got)})`}`,
  );
  okk ? pass++ : fail++;
}
const PW = "Sup3rSecret99";
async function newUser(
  adminT: string,
  role: string,
  extra: Record<string, string> = {},
) {
  const email = `${role}.${sfx}.${Math.random().toString(36).slice(2, 6)}@example.com`;
  const r = await call("POST", "/users", adminT, {
    email,
    role,
    firstName: role,
    lastName: sfx,
    ...extra,
  });
  await call("POST", "/auth/activate", undefined, {
    token: r.data.activationLink.split("token=")[1],
    password: PW,
  });
  const l = await call("POST", "/auth/login", undefined, {
    email,
    password: PW,
  });
  return {
    id: r.data.user.id as string,
    email,
    token: l.data.accessToken as string,
    login: l.data,
  };
}
const png = (w = 300, h = 200) =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#3a7" } })
    .png()
    .toBuffer();

(async () => {
  const { query, pool } = await import("../src/db/pool");
  const A = (
    await call("POST", "/auth/login", undefined, {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    })
  ).data.accessToken as string;
  const stu = await newUser(A, "student", {
    admissionNumber: `PD-${sfx}`,
    phone: "08030000000",
  });
  const stu2 = await newUser(A, "student", { admissionNumber: `PE-${sfx}` });
  const tch = await newUser(A, "teacher", { staffNumber: `PT-${sfx}` });
  const par = await newUser(A, "parent");
  await call("POST", "/parent-links", A, {
    parentId: par.id,
    studentId: stu.id,
    relationship: "mother",
  });
  const y = 2100 + (parseInt(sfx, 36) % 800);
  const sess = (
    await call("POST", "/academic/sessions", A, {
      name: `${y}/${y + 1}`,
      startDate: "2100-01-01",
      endDate: "2100-12-31",
    })
  ).data;
  await call("POST", `/academic/sessions/${sess.id}/set-current`, A);
  const tag =
    "Q" +
    sfx
      .slice(-3)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "X");
  const cls = (
    await call("POST", "/academic/classes", A, {
      stage: "JSS",
      year: 1,
      arm: tag,
    })
  ).data;
  await call(
    "POST",
    "/enrolments".replace("/enrolments", "/academic/enrolments"),
    A,
    { studentId: stu.id, classId: cls.id, sessionId: sess.id },
  );
  await call("POST", "/academic/enrolments", A, {
    studentId: stu2.id,
    classId: cls.id,
    sessionId: sess.id,
  });

  console.log("\n-- profile pictures");
  const p1 = await upload(
    "/profile/avatar",
    stu.token,
    await png(),
    "me.png",
    "image/png",
  );
  check(
    "student uploads a PNG",
    [p1.status, p1.data?.hasAvatar, typeof p1.data?.avatarVersion],
    [200, true, "number"],
  );
  const g1 = await raw("GET", `/profile/users/${stu.id}/avatar`, stu.token);
  check(
    "own picture is served as JPEG",
    [g1.status, g1.type, g1.buf.subarray(0, 3).toString("hex")],
    [200, "image/jpeg", "ffd8ff"],
  );
  const meta = await sharp(g1.buf).metadata();
  check(
    "picture is normalised to 512x512",
    [meta.width, meta.height],
    [512, 512],
  );
  const bad = await upload(
    "/profile/avatar",
    stu.token,
    Buffer.from("<html>not an image</html>"),
    "x.png",
    "image/png",
  );
  check(
    "text renamed .png is rejected",
    [bad.status, bad.error?.code],
    [400, "BAD_FILE_TYPE"],
  );
  const svg = await upload(
    "/profile/avatar",
    stu.token,
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
    ),
    "x.png",
    "image/png",
  );
  check(
    "SVG is rejected even when labelled PNG",
    [svg.status, svg.error?.code],
    [400, "BAD_FILE_TYPE"],
  );
  const big = await upload(
    "/profile/avatar",
    stu.token,
    crypto.randomBytes(6 * 1024 * 1024),
    "big.png",
    "image/png",
  );
  check(
    "file over 5 MB is rejected",
    [big.status, big.error?.code],
    [413, "FILE_TOO_LARGE"],
  );
  const webp = await upload(
    "/profile/avatar",
    stu.token,
    await sharp(await png())
      .webp()
      .toBuffer(),
    "a.webp",
    "image/webp",
  );
  check("WebP is accepted", [webp.status, webp.data?.hasAvatar], [200, true]);
  const jpg = await upload(
    "/profile/avatar",
    stu.token,
    await sharp(await png())
      .jpeg()
      .toBuffer(),
    "a.jpg",
    "image/jpeg",
  );
  check(
    "JPEG replaces the picture",
    [jpg.status, jpg.data?.hasAvatar],
    [200, true],
  );
  check(
    "another student cannot read it",
    (await raw("GET", `/profile/users/${stu.id}/avatar`, stu2.token)).status,
    404,
  );
  check(
    "the linked parent can read it",
    (await raw("GET", `/profile/users/${stu.id}/avatar`, par.token)).status,
    200,
  );
  check(
    "a teacher can read it",
    (await raw("GET", `/profile/users/${stu.id}/avatar`, tch.token)).status,
    200,
  );
  check(
    "no sign-in: refused",
    (await raw("GET", `/profile/users/${stu.id}/avatar`)).status,
    401,
  );
  check(
    "a student cannot set another user's picture",
    (
      await upload(
        `/profile/users/${stu2.id}/avatar`,
        stu.token,
        await png(),
        "a.png",
        "image/png",
      )
    ).status,
    403,
  );
  check(
    "admin sets a teacher's picture",
    (
      await upload(
        `/profile/users/${tch.id}/avatar`,
        A,
        await png(),
        "a.png",
        "image/png",
      )
    ).data?.hasAvatar,
    true,
  );
  const relog = await call("POST", "/auth/login", undefined, {
    email: stu.email,
    password: PW,
  });
  check(
    "sign-in payload carries avatarVersion",
    typeof relog.data.user.avatarVersion,
    "number",
  );
  const prof = await call("GET", "/profile/me", stu.token);
  check(
    "student profile shows admission number and class",
    [prof.data.admissionNumber, prof.data.className],
    [`PD-${sfx}`, `Ihdaady Awwal${tag}`],
  );
  check(
    "profile does not expose a password hash",
    JSON.stringify(prof.data).includes("password"),
    false,
  );
  check(
    "phone can be updated",
    (await call("PATCH", "/profile/me", stu.token, { phone: "08031112222" }))
      .data?.phone,
    "08031112222",
  );
  const rm = await call("DELETE", "/profile/avatar", stu.token);
  check(
    "picture can be removed",
    [rm.status, rm.data?.hasAvatar],
    [200, false],
  );
  check(
    "removed picture is gone",
    (await raw("GET", `/profile/users/${stu.id}/avatar`, stu.token)).status,
    404,
  );

  console.log("\n-- ID cards: access");
  check(
    "student cannot list cards",
    (await call("GET", "/admin/id-cards/users", stu.token)).status,
    403,
  );
  check(
    "student cannot scan",
    (await call("POST", "/admin/id-cards/scan", stu.token, { code: "x" }))
      .status,
    403,
  );
  check(
    "no sign-in: refused",
    (await call("GET", "/admin/id-cards/users")).status,
    401,
  );

  console.log("\n-- ID cards: generate");
  await upload(
    "/profile/avatar",
    stu.token,
    await png(),
    "me.png",
    "image/png",
  );
  const g = await call("POST", "/admin/id-cards/generate", A, {
    userIds: [stu.id],
  });
  check(
    "generate one student card",
    [
      g.status,
      g.data.issued.length,
      /^ID-S-\d{6}$/.test(g.data.issued[0]?.cardNumber),
    ],
    [201, 1, true],
  );
  const again = await call("POST", "/admin/id-cards/generate", A, {
    userIds: [stu.id],
  });
  check(
    "second generate skips (already has a card)",
    [again.data.issued.length, again.data.skipped[0]?.reason],
    [0, "Already has a card"],
  );
  const bulk = await call("POST", "/admin/id-cards/generate", A, {
    filter: { classId: cls.id, sessionId: sess.id },
  });
  check(
    "bulk by class issues the missing student only",
    [bulk.data.issued.length, bulk.data.skipped.length],
    [1, 1],
  );
  const others = await call("POST", "/admin/id-cards/generate", A, {
    userIds: [tch.id, par.id],
  });
  check(
    "teacher and parent cards",
    others.data.issued.map((i: any) => i.cardNumber.split("-")[1]).sort(),
    ["P", "T"],
  );
  const noOne = await call("POST", "/admin/id-cards/generate", A, {
    filter: { classId: cls.id, sessionId: sess.id, q: "zzzznomatch" },
  });
  check(
    "empty selection is a clear error",
    [noOne.status, noOne.error?.code],
    [400, "NOTHING_SELECTED"],
  );
  const list = await call(
    "GET",
    `/admin/id-cards/users?role=student&classId=${cls.id}&card=has`,
    A,
  );
  check(
    "list: students of the class with a card",
    [
      list.data.total,
      list.data.items.every((i: any) => i.cardState === "active"),
    ],
    [2, true],
  );
  const miss = await call(
    "GET",
    `/admin/id-cards/users?q=${sfx}&card=missing`,
    A,
  );
  check(
    "list: people still without a card (admin + stu none created)",
    miss.data.items.some((i: any) => i.cardState === "none"),
    false,
  );
  const cardId = g.data.issued[0].cardId as string;
  const pv = await call("GET", `/admin/id-cards/${cardId}/preview`, A);
  check(
    "preview has a QR image and no token",
    [
      pv.data.qr.startsWith("data:image/png;base64,"),
      "token" in pv.data && pv.data.token !== undefined,
    ],
    [true, false],
  );
  const pre = await call("POST", "/admin/id-cards/preview", A, {
    userId: tch.id,
  });
  check(
    "preview before generating works",
    [pre.status, pre.data.state, pre.data.role],
    [200, "preview", "teacher"],
  );

  console.log("\n-- ID cards: PDF");
  const pdf1 = await raw("GET", `/admin/id-cards/${cardId}/pdf`, A);
  check(
    "single PDF",
    [pdf1.status, pdf1.type, pdf1.buf.subarray(0, 5).toString()],
    [200, "application/pdf", "%PDF-"],
  );
  const ids = [
    ...g.data.issued,
    ...bulk.data.issued,
    ...others.data.issued,
  ].map((i: any) => i.cardId);
  const pdf2 = await raw("POST", "/admin/id-cards/pdf", A, {
    cardIds: ids,
    layout: "sheet",
  });
  check(
    "bulk sheet PDF",
    [pdf2.status, pdf2.buf.subarray(0, 5).toString()],
    [200, "%PDF-"],
  );
  require("fs").writeFileSync("/tmp/sample-cards.pdf", pdf2.buf);
  require("fs").writeFileSync("/tmp/sample-single.pdf", pdf1.buf);
  check(
    "PDF for an unknown card is a 404",
    (await raw("GET", `/admin/id-cards/${crypto.randomUUID()}/pdf`, A)).status,
    404,
  );

  console.log("\n-- ID cards: scanning");
  const tokOf = async (id: string) =>
    (await query("select token from id_cards where id = $1", [id])).rows[0]
      .token as string;
  const tok = await tokOf(cardId);
  const s1 = await call("POST", "/admin/id-cards/scan", A, {
    code: `http://localhost:5173/id/${tok}`,
    method: "qr",
  });
  check(
    "valid student scan (QR link)",
    [
      s1.data.outcome,
      s1.data.person?.admissionNumber,
      s1.data.person?.className,
    ],
    ["valid", `PD-${sfx}`, `Ihdaady Awwal${tag}`],
  );
  const body = JSON.stringify(s1.data);
  check(
    "scan returns no email, phone, or hash",
    [
      body.includes("@example.com"),
      body.includes("0803"),
      body.includes("hash"),
    ],
    [false, false, false],
  );
  check(
    "valid scan by bare token",
    (await call("POST", "/admin/id-cards/scan", A, { code: tok })).data.outcome,
    "valid",
  );
  check(
    "manual admission number",
    (
      await call("POST", "/admin/id-cards/scan", A, {
        code: `pd-${sfx}`,
        method: "manual",
      })
    ).data.outcome,
    "valid",
  );
  const tcard = others.data.issued.find((i: any) => i.userId === tch.id);
  const st = await call("POST", "/admin/id-cards/scan", A, {
    code: tcard.cardNumber,
    method: "manual",
  });
  check(
    "valid teacher scan (card number)",
    [st.data.outcome, st.data.person?.staffNumber, st.data.person?.role],
    ["valid", `PT-${sfx}`, "teacher"],
  );
  const pcard = others.data.issued.find((i: any) => i.userId === par.id);
  const sp = await call("POST", "/admin/id-cards/scan", A, {
    code: await tokOf(pcard.cardId),
  });
  check(
    "valid parent scan lists the child",
    [sp.data.outcome, sp.data.person?.children?.length],
    ["valid", 1],
  );
  const ad = await call("POST", "/admin/id-cards/generate", A, {
    userIds: [
      (
        await query("select id from users where email = $1", [
          (process.env.ADMIN_EMAIL ?? "").toLowerCase(),
        ])
      ).rows[0].id,
    ],
    mode: "replace",
  });
  const sa = await call("POST", "/admin/id-cards/scan", A, {
    code: await tokOf(ad.data.issued[0].cardId),
  });
  check(
    "valid administrator scan",
    [sa.data.outcome, sa.data.person?.role],
    ["valid", "admin"],
  );
  check(
    "some other QR code",
    (
      await call("POST", "/admin/id-cards/scan", A, {
        code: "https://example.com/hello",
        method: "qr",
      })
    ).data.outcome,
    "invalid",
  );
  check(
    "unknown token",
    (
      await call("POST", "/admin/id-cards/scan", A, {
        code: crypto.randomBytes(24).toString("base64url"),
      })
    ).data.outcome,
    "unknown",
  );
  check(
    "unknown manual number",
    (
      await call("POST", "/admin/id-cards/scan", A, {
        code: "NOPE-123",
        method: "manual",
      })
    ).data.outcome,
    "unknown",
  );

  console.log("\n-- ID cards: regenerate, revoke, expire, suspend");
  const re = await call("POST", "/admin/id-cards/generate", A, {
    userIds: [stu.id],
    mode: "replace",
  });
  check(
    "regenerate issues a new card",
    [re.data.issued.length, re.data.issued[0].replacedCardId],
    [1, cardId],
  );
  const old = await call("POST", "/admin/id-cards/scan", A, { code: tok });
  check(
    'old code is now "replaced" and shows no personal data',
    [old.data.outcome, old.data.person],
    ["replaced", undefined],
  );
  const newTok = await tokOf(re.data.issued[0].cardId);
  check(
    "new code is valid",
    (await call("POST", "/admin/id-cards/scan", A, { code: newTok })).data
      .outcome,
    "valid",
  );
  check(
    "regenerating leaves exactly one live card",
    (
      await query(
        `select count(*)::int n from id_cards where user_id = $1 and status in ('active','suspended')`,
        [stu.id],
      )
    ).rows[0].n,
    1,
  );
  const sus = await call(
    "POST",
    `/admin/id-cards/${re.data.issued[0].cardId}/suspend`,
    A,
  );
  check(
    "suspend a card",
    [
      sus.status,
      (await call("POST", "/admin/id-cards/scan", A, { code: newTok })).data
        .outcome,
    ],
    [200, "suspended"],
  );
  await call(
    "POST",
    `/admin/id-cards/${re.data.issued[0].cardId}/reactivate`,
    A,
  );
  await query(
    "update id_cards set expires_at = now() - interval '1 day' where id = $1",
    [re.data.issued[0].cardId],
  );
  check(
    "expired card",
    (await call("POST", "/admin/id-cards/scan", A, { code: newTok })).data
      .outcome,
    "expired",
  );
  await query(
    "update id_cards set expires_at = now() + interval '1 day' where id = $1",
    [re.data.issued[0].cardId],
  );
  const rv = await call(
    "POST",
    `/admin/id-cards/${re.data.issued[0].cardId}/revoke`,
    A,
    { reason: "lost" },
  );
  const rs = await call("POST", "/admin/id-cards/scan", A, { code: newTok });
  check(
    "revoke, then scan says revoked with no personal data",
    [rv.status, rs.data.outcome, rs.data.person],
    [200, "revoked", undefined],
  );
  check(
    "revoking twice is refused",
    (
      await call(
        "POST",
        `/admin/id-cards/${re.data.issued[0].cardId}/revoke`,
        A,
        {},
      )
    ).status,
    409,
  );
  const re2 = await call("POST", "/admin/id-cards/generate", A, {
    userIds: [stu.id],
  });
  check(
    "a person with only a revoked card can get a new one",
    re2.data.issued.length,
    1,
  );
  await call("PATCH", `/users/${stu.id}/status`, A, { status: "suspended" });
  check(
    "inactive account",
    (
      await call("POST", "/admin/id-cards/scan", A, {
        code: await tokOf(re2.data.issued[0].cardId),
      })
    ).data.outcome,
    "inactive",
  );
  await call("PATCH", `/users/${stu.id}/status`, A, { status: "active" });
  let dupErr = "";
  try {
    await query(
      `insert into id_cards (user_id, card_number, token, category) values ($1,'X-1',$2,'student')`,
      [stu2.id, await tokOf(re2.data.issued[0].cardId)],
    );
  } catch (e: any) {
    dupErr = e.code;
  }
  check("database refuses a duplicate live token", dupErr, "23505");
  const hist = await call("GET", `/admin/id-cards/history?userId=${stu.id}`, A);
  check(
    "history keeps every card",
    [hist.data.total, hist.data.items.map((i: any) => i.state).sort()],
    [3, ["active", "replaced", "revoked"]],
  );
  check(
    "scan log records attempts",
    (await call("GET", "/admin/id-cards/scans", A)).data.length > 5,
    true,
  );

  console.log("\n-- ID card template");
  const t0 = (await call("GET", "/admin/id-cards/template", A)).data;
  const t1 = await call("PUT", "/admin/id-cards/template", A, {
    ...t0,
    schoolName: "Edited Name",
    primaryColor: "#112233",
    validityMonths: 6,
  });
  check(
    "template saved",
    [t1.data?.schoolName, t1.data?.validityMonths],
    ["Edited Name", 6],
  );
  check(
    "bad colour rejected",
    (
      await call("PUT", "/admin/id-cards/template", A, {
        ...t0,
        primaryColor: "green",
      })
    ).status,
    400,
  );
  check(
    "non-admin cannot change template",
    (await call("PUT", "/admin/id-cards/template", tch.token, t0)).status,
    403,
  );
  const lg = await upload(
    "/admin/id-cards/template/logo",
    A,
    await png(200, 200),
    "logo.png",
    "image/png",
  );
  check("logo upload", [lg.status, !!lg.data?.logoKey], [200, true]);
  check(
    "PDF still renders with a custom logo",
    (
      await raw(
        "GET",
        `/admin/id-cards/${(await call("GET", `/admin/id-cards/history?userId=${tch.id}`, A)).data.items[0].id}/pdf`,
        A,
      )
    ).buf
      .subarray(0, 5)
      .toString(),
    "%PDF-",
  );
  await call("DELETE", "/admin/id-cards/template/logo", A);
  await call("PUT", "/admin/id-cards/template", A, t0);

  console.log("\n-- editing classes and subjects");
  const tag2 =
    "R" +
    sfx
      .slice(-3)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "X");
  await query(
    "update classes set arm = 'OLD' || substr(md5(random()::text), 1, 4) where stage = 'SSS' and year = 2 and arm is null and id <> $1",
    [cls.id],
  ); // leftovers of an earlier run
  const e1 = await call("PATCH", `/academic/classes/${cls.id}`, A, {
    stage: "SSS",
    year: 2,
    arm: tag2,
  });
  check(
    "edit class stage, year and arm",
    [e1.status, e1.data?.name],
    [200, `SSS 2${tag2}`],
  );
  const e2 = await call("PATCH", `/academic/classes/${cls.id}`, A, {
    arm: null,
  });
  check("clear the arm", e2.data?.name, "SSS 2");
  const other = (
    await call("POST", "/academic/classes", A, {
      stage: "SSS",
      year: 3,
      arm: tag2,
    })
  ).data;
  check(
    "renaming into an existing class is a clear 409",
    (
      await call("PATCH", `/academic/classes/${other.id}`, A, {
        stage: "SSS",
        year: 2,
        arm: null,
      })
    ).status,
    409,
  );
  check(
    "empty class edit refused",
    (await call("PATCH", `/academic/classes/${cls.id}`, A, {})).status,
    400,
  );
  check(
    "a teacher cannot edit a class",
    (
      await call("PATCH", `/academic/classes/${cls.id}`, tch.token, {
        arm: "Z",
      })
    ).status,
    403,
  );
  const sb = (
    await call("POST", "/academic/subjects", A, {
      name: `Subj ${sfx}`,
      code: `S${sfx.slice(-4)}`,
    })
  ).data;
  const sb2 = (
    await call("POST", "/academic/subjects", A, { name: `Subj2 ${sfx}` })
  ).data;
  const s1e = await call("PATCH", `/academic/subjects/${sb.id}`, A, {
    name: `Renamed ${sfx}`,
  });
  check(
    "rename subject keeps its code",
    [s1e.data?.name, s1e.data?.code],
    [`Renamed ${sfx}`, `S${sfx.slice(-4)}`],
  );
  check(
    "clear subject code",
    (await call("PATCH", `/academic/subjects/${sb.id}`, A, { code: null })).data
      ?.code,
    null,
  );
  check(
    "duplicate subject name is a clear 409",
    (
      await call("PATCH", `/academic/subjects/${sb2.id}`, A, {
        name: `renamed ${sfx}`,
      })
    ).status,
    409,
  );
  await call("PUT", `/academic/classes/${cls.id}/subjects`, A, {
    subjectIds: [sb.id],
  });
  check(
    "subject taken by a class cannot be deleted",
    (await call("DELETE", `/academic/subjects/${sb.id}`, A)).status,
    409,
  );
  check(
    "unused subject can be deleted",
    (await call("DELETE", `/academic/subjects/${sb2.id}`, A)).status,
    200,
  );
  check(
    "class with students cannot be deleted",
    (await call("DELETE", `/academic/classes/${cls.id}`, A)).status,
    409,
  );
  check(
    "unused class can be deleted",
    (await call("DELETE", `/academic/classes/${other.id}`, A)).status,
    200,
  );

  await pool.end();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
