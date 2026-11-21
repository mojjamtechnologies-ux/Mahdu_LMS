import { useEffect, useState, useSyncExternalStore } from "react";
import { fetchApiBlob } from "../lib/api";

// Pictures are private: they are fetched with the sign-in token, then shown from memory. The version in the key means a new
// photograph is picked up straight away, and a picture that was not changed is never downloaded twice.
const urls = new Map<string, Promise<string | null>>();
const versions = new Map<string, number | null>();
const listeners = new Set<() => void>();
let tick = 0;

/** Call after a picture is uploaded or removed, so every Avatar on screen for that person refreshes at once. */
export function setAvatarVersion(userId: string, version: number | null) {
  versions.set(userId, version);
  tick++;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

function load(userId: string, version: number | null | undefined): Promise<string | null> {
  const key = `${userId}:${version ?? "?"}`;
  let p = urls.get(key);
  if (!p) {
    p = fetchApiBlob(`/profile/users/${userId}/avatar`).then((b) => URL.createObjectURL(b)).catch(() => null);
    urls.set(key, p);
  }
  return p;
}

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

export default function Avatar({ userId, name, version, size = 40, className = "" }: {
  userId: string; name: string; version?: number | null; size?: number; className?: string;
}) {
  useSyncExternalStore(subscribe, () => tick);
  const effective = versions.has(userId) ? versions.get(userId) : version;
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    if (effective === null) { setSrc(null); return; } // known to have no picture: nothing to fetch
    void load(userId, effective).then((u) => { if (live) setSrc(u); });
    return () => { live = false; };
  }, [userId, effective]);

  const box = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) };
  return src ? (
    <img src={src} alt="" style={box} className={`keep-colour shrink-0 rounded-full object-cover ${className}`} />
  ) : (
    <span aria-hidden="true" style={box} className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700 ${className}`}>
      {initialsOf(name)}
    </span>
  );
}
