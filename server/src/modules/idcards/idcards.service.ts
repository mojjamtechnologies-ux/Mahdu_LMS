import crypto from "crypto";
import QRCode from "qrcode";
import { query, withTransaction } from "../../db/pool";
import { AppError } from "../../utils/AppError";
import { audit } from "../../services/audit";
import type { Role } from "../users/roles";
import { cardUrl, getTemplate, type CardTemplate } from "./idcards.template";

const CLASS_NAME = `class_label(c.stage, c.year, c.arm)`;
const PREFIX: Record<Role, string> = {
  student: "S",
  teacher: "T",
  parent: "P",
  admin: "A",
};
const MAX_BULK = 1000;
const notFound = (what = "ID card") =>
  new AppError(404, `${what} not found`, "NOT_FOUND");

export type CardState =
  | "active"
  | "suspended"
  | "revoked"
  | "replaced"
  | "expired";
const stateSql = (a = "ic") =>
  `case when ${a}.status = 'active' and ${a}.expires_at is not null and ${a}.expires_at < now() then 'expired' else ${a}.status end`;

export const newToken = () => crypto.randomBytes(24).toString("base64url"); // 192 bits from the system's secure random source

// ---------------------------------------------------------------- who can have a card
export interface UserFilter {
  role?: Role;
  classId?: string;
  sessionId?: string;
  q?: string;
  card?: "any" | "has" | "missing" | "expired" | "revoked" | "suspended";
}

function userWhere(f: UserFilter) {
  const params = [
    f.sessionId ?? null,
    f.classId ?? null,
    f.role ?? null,
    f.q ? `%${f.q.replace(/[%_\\]/g, "\\$&")}%` : null,
  ];
  const needsEnrolment = !!(
    f.classId ||
    (f.sessionId && (!f.role || f.role === "student"))
  );
  const card = f.card ?? "any";
  const from = `
    from users u
    left join student_profiles sp on sp.user_id = u.id
    left join teacher_profiles tp on tp.user_id = u.id
    left join academic_sessions s on (($1::uuid is null and s.is_current) or s.id = $1)
    left join enrolments e on e.student_id = u.id and e.session_id = s.id and e.status = 'active'
    left join classes c on c.id = e.class_id
    left join lateral (
      select ic.id, ic.card_number, ic.status, ic.issued_at, ic.expires_at from id_cards ic where ic.user_id = u.id
       order by (ic.status in ('active', 'suspended')) desc, ic.issued_at desc limit 1) lc on true
    where u.status in ('active', 'pending')
      and ($3::user_role is null or u.role = $3)
      and ($2::uuid is null or e.class_id = $2)
      ${needsEnrolment ? "and e.id is not null" : ""}
      and ($4::text is null or u.first_name || ' ' || u.last_name ilike $4 escape '\\' or u.email ilike $4 escape '\\'
           or sp.admission_number ilike $4 escape '\\' or tp.staff_number ilike $4 escape '\\' or lc.card_number ilike $4 escape '\\')
      ${card === "has" ? `and lc.status in ('active','suspended') and not (lc.status = 'active' and lc.expires_at < now())` : ""}
      ${card === "missing" ? `and (lc.id is null or lc.status in ('revoked','replaced'))` : ""}
      ${card === "expired" ? `and lc.status = 'active' and lc.expires_at < now()` : ""}
      ${card === "revoked" ? `and lc.status = 'revoked'` : ""}
      ${card === "suspended" ? `and lc.status = 'suspended'` : ""}`;
  return { from, params };
}

export async function listUsers(
  f: UserFilter & { page: number; pageSize: number },
) {
  const { from, params } = userWhere(f);
  const total = (await query(`select count(*)::int as n ${from}`, params))
    .rows[0].n as number;
  const { rows } = await query(
    `select u.id, u.role, u.first_name, u.last_name, u.status as account_status, sp.admission_number, tp.staff_number,
            case when u.avatar_key is null then null else (extract(epoch from u.avatar_updated_at) * 1000)::bigint end as avatar_version,
            ${CLASS_NAME} as class_name, lc.id as card_id, lc.card_number, lc.issued_at, lc.expires_at,
            case when lc.id is null then 'none' else ${stateSql("lc")} end as card_state
       ${from} order by u.role, u.last_name, u.first_name limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`,
    params,
  );
  return {
    items: rows.map((r) => ({
      id: r.id,
      role: r.role as Role,
      name: `${r.first_name} ${r.last_name}`,
      accountStatus: r.account_status,
      admissionNumber: r.admission_number ?? null,
      staffNumber: r.staff_number ?? null,
      className: r.class_name ?? null,
      avatarVersion: r.avatar_version == null ? null : Number(r.avatar_version),
      cardId: r.card_id ?? null,
      cardNumber: r.card_number ?? null,
      cardState: r.card_state as CardState | "none",
      issuedAt: r.issued_at ?? null,
      expiresAt: r.expires_at ?? null,
    })),
    page: f.page,
    pageSize: f.pageSize,
    total,
  };
}

async function selectUserIds(f: UserFilter): Promise<string[]> {
  const { from, params } = userWhere(f);
  const { rows } = await query(
    `select u.id ${from} order by u.last_name, u.first_name limit ${MAX_BULK + 1}`,
    params,
  );
  if (rows.length > MAX_BULK)
    throw new AppError(
      400,
      `That selection has more than ${MAX_BULK} people. Narrow it down (for example by class) and try again.`,
      "TOO_MANY",
    );
  return rows.map((r) => r.id as string);
}

// ---------------------------------------------------------------- issuing, replacing, revoking
const addMonths = (months: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d;
};

export async function generate(
  input: {
    userIds?: string[];
    filter?: UserFilter;
    mode: "missing" | "replace";
  },
  actorId: string,
  ip?: string,
) {
  const ids = [
    ...new Set(
      input.userIds?.length
        ? input.userIds
        : await selectUserIds(input.filter ?? {}),
    ),
  ];
  if (!ids.length)
    throw new AppError(
      400,
      "No people match this selection.",
      "NOTHING_SELECTED",
    );
  if (ids.length > MAX_BULK)
    throw new AppError(
      400,
      `Select at most ${MAX_BULK} people at a time.`,
      "TOO_MANY",
    );
  const tpl = await getTemplate();
  const expires = tpl.validityMonths > 0 ? addMonths(tpl.validityMonths) : null;

  return withTransaction(async (c) => {
    const users = (
      await c.query(
        `select id, role, status from users where id = any($1::uuid[]) for update`,
        [ids],
      )
    ).rows as { id: string; role: Role; status: string }[];
    const byId = new Map(users.map((u) => [u.id, u]));
    const issued: {
      userId: string;
      cardId: string;
      cardNumber: string;
      replacedCardId: string | null;
    }[] = [];
    const skipped: { userId: string; reason: string }[] = [];

    for (const id of ids) {
      const u = byId.get(id);
      if (!u) {
        skipped.push({ userId: id, reason: "Person not found" });
        continue;
      }
      if (u.status === "suspended") {
        skipped.push({ userId: id, reason: "Account is suspended" });
        continue;
      }
      const live = (
        await c.query(
          `select id from id_cards where user_id = $1 and status in ('active','suspended') for update`,
          [id],
        )
      ).rows[0];
      if (live && input.mode === "missing") {
        skipped.push({ userId: id, reason: "Already has a card" });
        continue;
      }
      // The old card stops being live first (the database allows only one live card per person), then the new one is linked to it.
      if (live)
        await c.query(`update id_cards set status = 'replaced' where id = $1`, [
          live.id,
        ]);
      const n = (await c.query(`select nextval('id_card_number_seq') as n`))
        .rows[0].n;
      const number = `${tpl.cardPrefix.toUpperCase()}-${PREFIX[u.role]}-${String(n).padStart(6, "0")}`;
      const ins = (
        await c.query(
          `insert into id_cards (user_id, card_number, token, category, expires_at, issued_by) values ($1,$2,$3,$4,$5,$6) returning id`,
          [id, number, newToken(), u.role, expires, actorId],
        )
      ).rows[0];
      if (live)
        await c.query("update id_cards set replaced_by = $2 where id = $1", [
          live.id,
          ins.id,
        ]);
      issued.push({
        userId: id,
        cardId: ins.id,
        cardNumber: number,
        replacedCardId: live?.id ?? null,
      });
      await audit(
        {
          actorId,
          action: live ? "idcard.regenerated" : "idcard.generated",
          entityType: "id_card",
          entityId: ins.id,
          metadata: {
            userId: id,
            cardNumber: number,
            replaced: live?.id ?? null,
          },
          ip,
        },
        c,
      );
    }
    return { issued, skipped };
  });
}

async function liveCard(cardId: string, c = { query }) {
  const row = (
    await c.query("select id, status, user_id from id_cards where id = $1", [
      cardId,
    ])
  ).rows[0];
  if (!row) throw notFound();
  return row as { id: string; status: string; user_id: string };
}

export async function revoke(
  cardId: string,
  reason: string | undefined,
  actorId: string,
  ip?: string,
) {
  const card = await liveCard(cardId);
  if (!["active", "suspended"].includes(card.status))
    throw new AppError(
      409,
      "This card is already revoked or replaced.",
      "NOT_ACTIVE",
    );
  await query(
    `update id_cards set status = 'revoked', revoked_at = now(), revoked_by = $2, revoke_reason = $3 where id = $1`,
    [cardId, actorId, reason ?? null],
  );
  await audit({
    actorId,
    action: "idcard.revoked",
    entityType: "id_card",
    entityId: cardId,
    metadata: { userId: card.user_id, reason: reason ?? null },
    ip,
  });
  return { revoked: true };
}

export async function setSuspended(
  cardId: string,
  suspended: boolean,
  actorId: string,
  ip?: string,
) {
  const card = await liveCard(cardId);
  const from = suspended ? "active" : "suspended";
  if (card.status !== from)
    throw new AppError(
      409,
      suspended
        ? "Only an active card can be suspended."
        : "Only a suspended card can be reactivated.",
      "BAD_STATE",
    );
  await query("update id_cards set status = $2 where id = $1", [
    cardId,
    suspended ? "suspended" : "active",
  ]);
  await audit({
    actorId,
    action: suspended ? "idcard.suspended" : "idcard.reactivated",
    entityType: "id_card",
    entityId: cardId,
    metadata: { userId: card.user_id },
    ip,
  });
  return { updated: true };
}

export async function history(f: {
  userId?: string;
  status?: string;
  page: number;
  pageSize: number;
}) {
  const params = [f.userId ?? null, f.status ?? null];
  const where = `where ($1::uuid is null or ic.user_id = $1) and ($2::text is null or ${stateSql()} = $2)`;
  const total = (
    await query(`select count(*)::int as n from id_cards ic ${where}`, params)
  ).rows[0].n as number;
  const { rows } = await query(
    `select ic.id, ic.card_number, ic.category, ic.issued_at, ic.expires_at, ic.revoked_at, ic.revoke_reason, ${stateSql()} as state,
            u.id as user_id, u.first_name, u.last_name, ib.first_name as ib_f, ib.last_name as ib_l, rb.first_name as rb_f, rb.last_name as rb_l,
            (select count(*)::int from id_card_scans sc where sc.card_id = ic.id) as scans
       from id_cards ic join users u on u.id = ic.user_id
       left join users ib on ib.id = ic.issued_by left join users rb on rb.id = ic.revoked_by
       ${where} order by ic.issued_at desc limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`,
    params,
  );
  return {
    items: rows.map((r) => ({
      id: r.id,
      cardNumber: r.card_number,
      category: r.category as Role,
      state: r.state as CardState,
      issuedAt: r.issued_at,
      expiresAt: r.expires_at,
      revokedAt: r.revoked_at,
      revokeReason: r.revoke_reason,
      userId: r.user_id,
      userName: `${r.first_name} ${r.last_name}`,
      issuedBy: r.ib_f ? `${r.ib_f} ${r.ib_l}` : null,
      revokedBy: r.rb_f ? `${r.rb_f} ${r.rb_l}` : null,
      scans: r.scans,
    })),
    page: f.page,
    pageSize: f.pageSize,
    total,
  };
}

// ---------------------------------------------------------------- what is printed on a card
export interface CardFace {
  cardId: string | null;
  userId: string;
  cardNumber: string;
  token: string;
  role: Role;
  name: string;
  idLabel: string;
  idValue: string;
  line1: string | null;
  line2: string | null;
  issuedAt: string;
  expiresAt: string | null;
  state: CardState | "preview";
  hasPhoto: boolean;
  avatarVersion: number | null;
}

// The printed fields only. No email, phone, date of birth or home address ever goes on a card.
async function faceRows(where: string, params: unknown[]): Promise<CardFace[]> {
  const { rows } = await query(
    `select ic.id as card_id, ic.card_number, ic.token, ic.category, ic.issued_at, ic.expires_at, ${stateSql()} as state,
            u.id as user_id, u.first_name, u.last_name, u.avatar_key,
            case when u.avatar_key is null then null else (extract(epoch from u.avatar_updated_at) * 1000)::bigint end as avatar_version,
            sp.admission_number, tp.staff_number, ${CLASS_NAME} as class_name, s.name as session_name
       from id_cards ic join users u on u.id = ic.user_id
       left join student_profiles sp on sp.user_id = u.id left join teacher_profiles tp on tp.user_id = u.id
       left join academic_sessions s on s.is_current
       left join enrolments e on e.student_id = u.id and e.session_id = s.id and e.status = 'active'
       left join classes c on c.id = e.class_id
      where ${where} order by u.role, u.last_name, u.first_name`,
    params,
  );
  return rows.map((r) => toFace(r));
}

function toFace(r: any, preview = false): CardFace {
  const role = r.category as Role;
  const base = {
    cardId: preview ? null : r.card_id,
    userId: r.user_id,
    cardNumber: r.card_number,
    token: r.token,
    role,
    name: `${r.first_name} ${r.last_name}`,
    issuedAt: r.issued_at,
    expiresAt: r.expires_at,
    state: (preview ? "preview" : r.state) as CardFace["state"],
    hasPhoto: !!r.avatar_key,
    avatarVersion: r.avatar_version == null ? null : Number(r.avatar_version),
  };
  if (role === "student")
    return {
      ...base,
      idLabel: "Admission No.",
      idValue: r.admission_number ?? r.card_number,
      line1: r.class_name ?? null,
      line2: r.session_name ?? null,
    };
  if (role === "teacher")
    return {
      ...base,
      idLabel: "Staff No.",
      idValue: r.staff_number ?? r.card_number,
      line1: "Teacher",
      line2: null,
    };
  if (role === "parent")
    return {
      ...base,
      idLabel: "Guardian ID",
      idValue: r.card_number,
      line1: "Parent / Guardian",
      line2: null,
    };
  return {
    ...base,
    idLabel: "Staff ID",
    idValue: r.card_number,
    line1: "Administrator",
    line2: null,
  };
}

export async function facesByCardIds(ids: string[]): Promise<CardFace[]> {
  if (!ids.length)
    throw new AppError(400, "Choose at least one card.", "NOTHING_SELECTED");
  if (ids.length > 200)
    throw new AppError(400, "Choose at most 200 cards per PDF.", "TOO_MANY");
  const faces = await faceRows("ic.id = any($1::uuid[])", [ids]);
  if (!faces.length) throw notFound();
  return faces;
}

/** The card as it will look, before anything is issued. The token is a throwaway, so the QR in a preview opens nothing. */
export async function previewForUser(userId: string): Promise<CardFace> {
  const tpl = await getTemplate();
  const r = (
    await query(
      `select u.id as user_id, u.first_name, u.last_name, u.avatar_key, u.role as category, now() as issued_at,
            case when u.avatar_key is null then null else (extract(epoch from u.avatar_updated_at) * 1000)::bigint end as avatar_version,
            sp.admission_number, tp.staff_number, ${CLASS_NAME} as class_name, s.name as session_name
       from users u left join student_profiles sp on sp.user_id = u.id left join teacher_profiles tp on tp.user_id = u.id
       left join academic_sessions s on s.is_current
       left join enrolments e on e.student_id = u.id and e.session_id = s.id and e.status = 'active'
       left join classes c on c.id = e.class_id where u.id = $1`,
      [userId],
    )
  ).rows[0];
  if (!r) throw notFound("Person");
  const face = toFace(
    {
      ...r,
      card_number: `${tpl.cardPrefix.toUpperCase()}-${PREFIX[r.category as Role]}-000000`,
      token: "PREVIEW",
      expires_at: tpl.validityMonths > 0 ? addMonths(tpl.validityMonths) : null,
    },
    true,
  );
  return face;
}

export const qrPng = (token: string) =>
  QRCode.toBuffer(cardUrl(token), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 600,
    type: "png",
  });
export const qrDataUrl = (token: string) =>
  QRCode.toDataURL(cardUrl(token), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 300,
  });

export async function faceWithQr(face: CardFace) {
  return {
    ...face,
    qr: await qrDataUrl(face.token === "PREVIEW" ? "PREVIEW" : face.token),
    token: undefined,
  };
}

// ---------------------------------------------------------------- scanning
export type ScanOutcome =
  | "valid"
  | "invalid"
  | "unknown"
  | "revoked"
  | "expired"
  | "replaced"
  | "suspended"
  | "inactive";

// A scan may carry a full link (what the QR holds), a bare token, a card number, or (typed by hand) an admission or staff number.
function parseCode(raw: string): {
  token?: string;
  number?: string;
  plain: string;
} {
  const code = raw.trim();
  const m = code.match(/\/id\/([A-Za-z0-9_-]{20,64})\/?(?:[?#].*)?$/);
  if (m) return { token: m[1], plain: code };
  if (/^[A-Za-z0-9_-]{30,64}$/.test(code)) return { token: code, plain: code };
  return { number: code.toUpperCase(), plain: code };
}

export async function scan(
  raw: string,
  method: "qr" | "manual",
  scannerId: string,
  ip?: string,
) {
  const p = parseCode(raw);
  if (!p.plain || p.plain.length > 300)
    return finish("invalid", null, method, scannerId, ip);

  let card: any;
  if (p.token) {
    card = (await query("select * from id_cards where token = $1", [p.token]))
      .rows[0];
  } else if (method === "manual") {
    card = (
      await query("select * from id_cards where card_number = $1", [p.number])
    ).rows[0];
    if (!card) {
      // Typed admission or staff number: use that person's most relevant card.
      card = (
        await query(
          `select ic.* from id_cards ic join users u on u.id = ic.user_id
           left join student_profiles sp on sp.user_id = u.id left join teacher_profiles tp on tp.user_id = u.id
          where upper(sp.admission_number) = $1 or upper(tp.staff_number) = $1
          order by (ic.status in ('active','suspended')) desc, ic.issued_at desc limit 1`,
          [p.number],
        )
      ).rows[0];
    }
  } else {
    // A camera read something that is not one of our links or tokens: some other QR code or barcode.
    return finish("invalid", null, method, scannerId, ip);
  }
  if (!card) return finish("unknown", null, method, scannerId, ip);

  const user = (
    await query(
      "select id, role, status, first_name, last_name from users where id = $1",
      [card.user_id],
    )
  ).rows[0];
  let outcome: ScanOutcome = "valid";
  if (card.status === "revoked") outcome = "revoked";
  else if (card.status === "replaced") outcome = "replaced";
  else if (card.status === "suspended") outcome = "suspended";
  else if (card.expires_at && new Date(card.expires_at) < new Date())
    outcome = "expired";
  else if (!user || user.status !== "active") outcome = "inactive";
  return finish(outcome, card, method, scannerId, ip);
}

async function finish(
  outcome: ScanOutcome,
  card: any,
  method: "qr" | "manual",
  scannerId: string,
  ip?: string,
) {
  await query(
    "insert into id_card_scans (card_id, scanned_by, method, outcome, ip) values ($1,$2,$3,$4,$5)",
    [card?.id ?? null, scannerId, method, outcome, ip ?? null],
  );
  if (outcome !== "valid" || !card) {
    // Nothing about the person is returned for a card that must not be accepted.
    return {
      outcome,
      cardNumber:
        outcome === "invalid" || outcome === "unknown"
          ? null
          : (card?.card_number ?? null),
    };
  }
  return {
    outcome,
    cardNumber: card.card_number,
    expiresAt: card.expires_at,
    issuedAt: card.issued_at,
    person: await personFor(card.user_id),
  };
}

// Only the fields the scanner screen shows. Never the email, phone number, date of birth, address or any password data.
async function personFor(userId: string) {
  const u = (
    await query(
      `select u.id, u.role, u.status, u.first_name, u.last_name,
            case when u.avatar_key is null then null else (extract(epoch from u.avatar_updated_at) * 1000)::bigint end as avatar_version,
            sp.admission_number, tp.staff_number
       from users u left join student_profiles sp on sp.user_id = u.id left join teacher_profiles tp on tp.user_id = u.id where u.id = $1`,
      [userId],
    )
  ).rows[0];
  const role = u.role as Role;
  const out: Record<string, unknown> = {
    id: u.id,
    role,
    name: `${u.first_name} ${u.last_name}`,
    accountStatus: u.status,
    avatarVersion: u.avatar_version == null ? null : Number(u.avatar_version),
  };
  if (role === "student") {
    const cls = (
      await query(
        `select ${CLASS_NAME} as class_name, s.name as session_name from enrolments e join academic_sessions s on s.id = e.session_id and s.is_current
         join classes c on c.id = e.class_id where e.student_id = $1 and e.status = 'active'`,
        [userId],
      )
    ).rows[0];
    const att = (
      await query(
        `select count(*) filter (where ar.status = 'present')::int as present, count(*) filter (where ar.status = 'late')::int as late,
              count(*) filter (where ar.status = 'absent')::int as absent
         from attendance_records ar join attendance_registers r on r.id = ar.register_id join terms t on t.id = r.term_id and t.is_current
        where ar.student_id = $1`,
        [userId],
      )
    ).rows[0];
    Object.assign(out, {
      admissionNumber: u.admission_number,
      className: cls?.class_name ?? null,
      sessionName: cls?.session_name ?? null,
      attendance: att && att.present + att.late + att.absent > 0 ? att : null,
    });
  } else if (role === "teacher") {
    const cl = (
      await query(
        `select distinct ${CLASS_NAME} as class_name from teaching_assignments ta join academic_sessions s on s.id = ta.session_id and s.is_current
         join classes c on c.id = ta.class_id where ta.teacher_id = $1 order by 1`,
        [userId],
      )
    ).rows;
    Object.assign(out, {
      staffNumber: u.staff_number,
      designation: "Teacher",
      classes: cl.map((r) => r.class_name),
    });
  } else if (role === "parent") {
    const kids = (
      await query(
        `select ch.first_name, ch.last_name, ps.relationship, ${CLASS_NAME} as class_name
         from parent_students ps join users ch on ch.id = ps.student_id left join academic_sessions s on s.is_current
         left join enrolments e on e.student_id = ch.id and e.session_id = s.id and e.status = 'active' left join classes c on c.id = e.class_id
        where ps.parent_id = $1 order by ch.first_name`,
        [userId],
      )
    ).rows;
    Object.assign(out, {
      designation: "Parent / Guardian",
      children: kids.map((k) => ({
        name: `${k.first_name} ${k.last_name}`,
        relationship: k.relationship,
        className: k.class_name,
      })),
    });
  } else {
    Object.assign(out, { designation: "Administrator" });
  }
  return out;
}

export async function recentScans(limit = 20) {
  const { rows } = await query(
    `select sc.id, sc.method, sc.outcome, sc.created_at, ic.card_number, u.first_name, u.last_name, sb.first_name as sf, sb.last_name as sl
       from id_card_scans sc left join id_cards ic on ic.id = sc.card_id left join users u on u.id = ic.user_id left join users sb on sb.id = sc.scanned_by
      order by sc.created_at desc limit $1`,
    [limit],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    method: r.method,
    outcome: r.outcome,
    at: r.created_at,
    cardNumber: r.card_number ?? null,
    person: r.first_name ? `${r.first_name} ${r.last_name}` : null,
    scannedBy: r.sf ? `${r.sf} ${r.sl}` : null,
  }));
}

export type { CardTemplate };
