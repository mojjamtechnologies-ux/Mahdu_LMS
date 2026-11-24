import crypto from "crypto";
import sharp from "sharp";
import { query, withTransaction } from "../../db/pool";
import { AppError } from "../../utils/AppError";
import { audit } from "../../services/audit";
import { storage } from "../../services/storage";
import type { Role } from "../users/roles";

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);
const CLASS_NAME = `class_label(c.stage, c.year, c.arm)`;
const notFound = () => new AppError(404, "Not found", "NOT_FOUND");

type Viewer = { id: string; role: Role };

/**
 * Decodes the upload with sharp, so the real content decides whether it is an image (the file extension and the
 * browser-supplied type are never trusted). The result is re-encoded as a 512x512 JPEG: that strips EXIF/GPS data and any
 * embedded payload, and gives every picture the same small size (which is also what the ID card PDF needs: pdfkit cannot draw WebP).
 */
export async function normaliseImage(
  input: Buffer,
  size = 512,
): Promise<Buffer> {
  if (!input.length) throw new AppError(400, "The file is empty.", "BAD_FILE");
  if (input.length > AVATAR_MAX_BYTES)
    throw new AppError(
      413,
      "The picture is larger than 5 MB. Please choose a smaller one.",
      "FILE_TOO_LARGE",
    );
  try {
    const meta = await sharp(input, {
      limitInputPixels: 40_000_000,
    }).metadata();
    if (!meta.format || !ALLOWED_FORMATS.has(meta.format))
      throw new Error("format");
    return await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(size, size, { fit: "cover", position: "attention" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(
      400,
      "Please upload a JPG, PNG or WebP picture. This file is not a supported image.",
      "BAD_FILE_TYPE",
    );
  }
}

// ---------- reading a profile ----------
export async function getProfile(userId: string) {
  const u = (
    await query(
      `select u.id, u.email, u.role, u.status, u.first_name, u.last_name, u.phone, u.created_at, u.avatar_key,
            extract(epoch from u.avatar_updated_at) * 1000 as avatar_version,
            sp.admission_number, tp.staff_number
       from users u left join student_profiles sp on sp.user_id = u.id left join teacher_profiles tp on tp.user_id = u.id
      where u.id = $1`,
      [userId],
    )
  ).rows[0];
  if (!u) throw notFound();
  const role = u.role as Role;
  const base = {
    id: u.id,
    email: u.email,
    role,
    status: u.status,
    firstName: u.first_name,
    lastName: u.last_name,
    phone: u.phone,
    memberSince: u.created_at,
    hasAvatar: !!u.avatar_key,
    avatarVersion: u.avatar_key ? Math.round(Number(u.avatar_version)) : null,
    designation:
      role === "admin"
        ? "Administrator"
        : role === "teacher"
          ? "Teacher"
          : null,
    admissionNumber: u.admission_number ?? null,
    staffNumber: u.staff_number ?? null,
    className: null as string | null,
    sessionName: null as string | null,
    children: [] as {
      id: string;
      name: string;
      relationship: string;
      className: string | null;
    }[],
    teaches: [] as string[],
  };
  if (role === "student") {
    const c = (
      await query(
        `select ${CLASS_NAME} as class_name, s.name as session_name
         from enrolments e join academic_sessions s on s.id = e.session_id and s.is_current join classes c on c.id = e.class_id
        where e.student_id = $1 and e.status = 'active'`,
        [userId],
      )
    ).rows[0];
    base.className = c?.class_name ?? null;
    base.sessionName = c?.session_name ?? null;
  } else if (role === "parent") {
    const rows = (
      await query(
        `select ch.id, ch.first_name, ch.last_name, ps.relationship, ${CLASS_NAME} as class_name
         from parent_students ps join users ch on ch.id = ps.student_id
         left join academic_sessions s on s.is_current
         left join enrolments e on e.student_id = ch.id and e.session_id = s.id and e.status = 'active'
         left join classes c on c.id = e.class_id
        where ps.parent_id = $1 order by ch.first_name`,
        [userId],
      )
    ).rows;
    base.children = rows.map((r) => ({
      id: r.id,
      name: `${r.first_name} ${r.last_name}`,
      relationship: r.relationship,
      className: r.class_name,
    }));
  } else if (role === "teacher") {
    const rows = (
      await query(
        `select distinct ${CLASS_NAME} as class_name from teaching_assignments ta
         join academic_sessions s on s.id = ta.session_id and s.is_current join classes c on c.id = ta.class_id
        where ta.teacher_id = $1 order by 1`,
        [userId],
      )
    ).rows;
    base.teaches = rows.map((r) => r.class_name);
  }
  return base;
}

export async function updateOwnPhone(
  userId: string,
  phone: string | null,
  ip?: string,
) {
  await query("update users set phone = $2, updated_at = now() where id = $1", [
    userId,
    phone,
  ]);
  await audit({
    actorId: userId,
    action: "profile.updated",
    entityType: "user",
    entityId: userId,
    ip,
  });
  return getProfile(userId);
}

// ---------- profile picture ----------
export async function setAvatar(
  targetId: string,
  actor: Viewer,
  file: { buffer: Buffer },
  ip?: string,
) {
  const target = (
    await query("select id, avatar_key from users where id = $1", [targetId])
  ).rows[0];
  if (!target) throw notFound();
  const jpeg = await normaliseImage(file.buffer);
  const key = `avatars/${crypto.randomUUID()}.jpg`;
  await storage.put(key, jpeg, "image/jpeg");
  try {
    await withTransaction(async (c) => {
      await c.query(
        "update users set avatar_key = $2, avatar_updated_at = now(), updated_at = now() where id = $1",
        [targetId, key],
      );
      await audit(
        {
          actorId: actor.id,
          action:
            actor.id === targetId
              ? "profile.avatar_set"
              : "profile.avatar_set_by_admin",
          entityType: "user",
          entityId: targetId,
          ip,
        },
        c,
      );
    });
  } catch (e) {
    await storage.remove(key).catch(() => undefined); // the row never changed, so do not leave an orphan file behind
    throw e;
  }
  // The old file is removed only after the new one is saved and referenced, so a failure can never leave a broken reference.
  if (target.avatar_key)
    await storage.remove(target.avatar_key).catch(() => undefined);
  return getProfile(targetId);
}

export async function removeAvatar(
  targetId: string,
  actor: Viewer,
  ip?: string,
) {
  const target = (
    await query("select avatar_key from users where id = $1", [targetId])
  ).rows[0];
  if (!target) throw notFound();
  await withTransaction(async (c) => {
    await c.query(
      "update users set avatar_key = null, avatar_updated_at = now(), updated_at = now() where id = $1",
      [targetId],
    );
    await audit(
      {
        actorId: actor.id,
        action: "profile.avatar_removed",
        entityType: "user",
        entityId: targetId,
        ip,
      },
      c,
    );
  });
  if (target.avatar_key)
    await storage.remove(target.avatar_key).catch(() => undefined);
  return getProfile(targetId);
}

// Who may see whose picture: yourself, staff, and the guardian/child link. Everyone else gets a 404.
async function canView(v: Viewer, targetId: string) {
  if (v.id === targetId || v.role === "admin" || v.role === "teacher")
    return true;
  if (v.role === "parent")
    return !!(
      await query(
        "select 1 from parent_students where parent_id = $1 and student_id = $2",
        [v.id, targetId],
      )
    ).rowCount;
  if (v.role === "student")
    return !!(
      await query(
        "select 1 from parent_students where parent_id = $2 and student_id = $1",
        [v.id, targetId],
      )
    ).rowCount;
  return false;
}

export async function readAvatar(
  viewer: Viewer,
  targetId: string,
): Promise<Buffer> {
  const u = (
    await query("select avatar_key from users where id = $1", [targetId])
  ).rows[0];
  if (!u?.avatar_key || !(await canView(viewer, targetId))) throw notFound();
  try {
    return await storage.get(u.avatar_key);
  } catch {
    throw notFound();
  }
}

/** For the ID card PDF: the stored picture, or null when there is none or it cannot be read (the card then shows initials). */
export async function avatarBufferOrNull(
  userId: string,
): Promise<Buffer | null> {
  const u = (
    await query("select avatar_key from users where id = $1", [userId])
  ).rows[0];
  if (!u?.avatar_key) return null;
  try {
    return await storage.get(u.avatar_key);
  } catch {
    return null;
  }
}
