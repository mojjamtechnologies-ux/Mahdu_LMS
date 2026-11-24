import crypto from "crypto";
import sharp from "sharp";
import { z } from "zod";
import { env } from "../../config/env";
import { query } from "../../db/pool";
import { audit } from "../../services/audit";
import { storage } from "../../services/storage";
import { AppError } from "../../utils/AppError";

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a colour such as #438F17");
export const templateSchema = z.object({
  schoolName: z.string().trim().min(2).max(80),
  address: z.string().trim().max(160).default(""),
  phone: z.string().trim().max(60).default(""),
  email: z.string().trim().max(120).default(""),
  primaryColor: hex,
  accentColor: hex,
  footerText: z.string().trim().max(80).default(""),
  backText: z.string().trim().max(240).default(""),
  cardPrefix: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{1,6}$/, "Use 1 to 6 letters or numbers")
    .default("ID"),
  validityMonths: z.number().int().min(0).max(120), // 0 = cards never expire
  show: z.object({
    photo: z.boolean(),
    number: z.boolean(),
    classInfo: z.boolean(),
    session: z.boolean(),
    issueDate: z.boolean(),
    expiry: z.boolean(),
  }),
});
export type CardTemplate = z.infer<typeof templateSchema> & {
  logoKey: string | null;
};

const KEY = "id_card_template";

// Defaults come from the same environment settings the PDF receipts use, so nothing school-specific is hard-coded here.
export const defaultTemplate = (): CardTemplate => ({
  schoolName: process.env.SCHOOL_NAME || "Mahdu Rahmah",
  address: process.env.SCHOOL_ADDRESS || "",
  phone: process.env.SCHOOL_PHONE || "",
  email: process.env.SCHOOL_EMAIL || "",
  primaryColor: "#438F17",
  accentColor: "#EED13F",
  footerText:
    "Property of the school. If found, please return it to the school office.",
  backText:
    "This card identifies the holder. It does not give access to any online account. Report a lost card to the school office immediately.",
  cardPrefix: "ID",
  validityMonths: 12,
  show: {
    photo: true,
    number: true,
    classInfo: true,
    session: true,
    issueDate: true,
    expiry: true,
  },
  logoKey: null,
});

export async function getTemplate(): Promise<CardTemplate> {
  const row = (await query("select value from settings where key = $1", [KEY]))
    .rows[0];
  const def = defaultTemplate();
  if (!row) return def;
  const v = row.value as Partial<CardTemplate>;
  return {
    ...def,
    ...v,
    show: { ...def.show, ...(v.show ?? {}) },
    logoKey: v.logoKey ?? null,
  };
}

async function save(t: CardTemplate, actorId: string) {
  await query(
    `insert into settings (key, value, updated_by, updated_at) values ($1, $2, $3, now())
     on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`,
    [KEY, JSON.stringify(t), actorId],
  );
}

export async function updateTemplate(
  input: z.infer<typeof templateSchema>,
  actorId: string,
  ip?: string,
) {
  const cur = await getTemplate();
  const next: CardTemplate = { ...input, logoKey: cur.logoKey };
  await save(next, actorId);
  await audit({
    actorId,
    action: "idcard.template_updated",
    entityType: "settings",
    entityId: KEY,
    ip,
  });
  return next;
}

export async function setLogo(buffer: Buffer, actorId: string, ip?: string) {
  if (buffer.length > 5 * 1024 * 1024)
    throw new AppError(413, "The logo is larger than 5 MB.", "FILE_TOO_LARGE");
  let png: Buffer;
  try {
    png = await sharp(buffer, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(600, 600, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    throw new AppError(
      400,
      "Please upload a JPG, PNG or WebP logo.",
      "BAD_FILE_TYPE",
    );
  }
  const key = `idcards/logo-${crypto.randomUUID()}.png`;
  await storage.put(key, png, "image/png");
  const cur = await getTemplate();
  await save({ ...cur, logoKey: key }, actorId);
  if (cur.logoKey) await storage.remove(cur.logoKey).catch(() => undefined);
  await audit({
    actorId,
    action: "idcard.logo_set",
    entityType: "settings",
    entityId: KEY,
    ip,
  });
  return getTemplate();
}

export async function removeLogo(actorId: string, ip?: string) {
  const cur = await getTemplate();
  await save({ ...cur, logoKey: null }, actorId);
  if (cur.logoKey) await storage.remove(cur.logoKey).catch(() => undefined);
  await audit({
    actorId,
    action: "idcard.logo_removed",
    entityType: "settings",
    entityId: KEY,
    ip,
  });
  return getTemplate();
}

export async function readLogo(t?: CardTemplate): Promise<Buffer | null> {
  const tpl = t ?? (await getTemplate());
  if (!tpl.logoKey) return null;
  try {
    return await storage.get(tpl.logoKey);
  } catch {
    return null;
  }
}

// Used only to build the QR link; the QR carries a link to the school's own site plus a random token, never personal data.
export const cardUrl = (token: string) => `${env.CLIENT_ORIGIN}/id/${token}`;
