import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Avatar, { setAvatarVersion } from "./Avatar";
import { Alert, SmallButton } from "./ui";
import { api, uploadWithProgress } from "../lib/api";
import { messageOf } from "../lib/forms";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX = 5 * 1024 * 1024;

/** Photograph picker: preview, upload progress, replace, remove. `base` is "/profile" for yourself or `/profile/users/<id>` for an administrator. */
export default function AvatarUploader({ userId, name, version, hasPhoto, base, onChanged }: {
  userId: string; name: string; version?: number | null; hasPhoto: boolean; base: string; onChanged: (version: number | null) => void;
}) {
  const { t } = useTranslation("profile");
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [percent, setPercent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const uploadPath = base === "/profile" ? "/profile/avatar" : `${base}/avatar`;

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(f: File | undefined) {
    setError(""); setDone("");
    if (!f) return;
    if (!TYPES.includes(f.type)) { setError(t("photo.badType")); return; }   // quick check for the user; the server checks the real content
    if (f.size > MAX) { setError(t("photo.tooBig")); return; }
    setFile(f);
  }

  async function save() {
    if (!file) return;
    setBusy(true); setError(""); setPercent(0);
    try {
      const r = await uploadWithProgress<{ avatarVersion: number | null }>(uploadPath, file, setPercent);
      setAvatarVersion(userId, r.avatarVersion);
      onChanged(r.avatarVersion);
      setFile(null); setDone(t("photo.saved"));
    } catch (e) { setError(messageOf(e)); } finally { setBusy(false); if (input.current) input.current.value = ""; }
  }

  async function remove() {
    if (!window.confirm(t("photo.confirmRemove"))) return;
    setBusy(true); setError(""); setDone("");
    try {
      await api(uploadPath, { method: "DELETE" });
      setAvatarVersion(userId, null);
      onChanged(null);
      setDone(t("photo.removed"));
    } catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      {preview ? (
        <img src={preview} alt={t("photo.previewLabel")} className="keep-colour h-28 w-28 rounded-full border-4 border-gold-400 object-cover" />
      ) : (
        <Avatar userId={userId} name={name} version={hasPhoto ? version : null} size={112} className="border-4 border-gold-400" />
      )}
      <div className="min-w-0 space-y-3">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id={`avatar-${userId}`} onChange={(e) => pick(e.target.files?.[0])} />
        <div className="flex flex-wrap gap-2">
          {file ? (
            <>
              <button type="button" onClick={save} disabled={busy} className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
                {busy ? t("photo.uploading", { percent }) : t("photo.save")}
              </button>
              <SmallButton type="button" disabled={busy} onClick={() => { setFile(null); if (input.current) input.current.value = ""; }}>{t("photo.cancelPick")}</SmallButton>
            </>
          ) : (
            <>
              <label htmlFor={`avatar-${userId}`} className="cursor-pointer rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
                {hasPhoto ? t("photo.change") : t("photo.choose")}
              </label>
              {hasPhoto && <SmallButton type="button" tone="danger" disabled={busy} onClick={remove}>{t("photo.remove")}</SmallButton>}
            </>
          )}
        </div>
        {busy && file && (
          <div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="h-2 w-56 max-w-full overflow-hidden rounded-full bg-gray-100">
            <div className="h-full bg-brand-500 transition-all" style={{ width: `${percent}%` }} />
          </div>
        )}
        <p className="text-sm text-muted">{t("photo.hint")}</p>
        {error && <Alert tone="error">{error}</Alert>}
        {done && <Alert tone="success">{done}</Alert>}
      </div>
    </div>
  );
}
