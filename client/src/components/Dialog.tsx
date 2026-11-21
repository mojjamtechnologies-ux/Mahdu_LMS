import { useEffect, useId, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

/** A modal dialog: closes with Escape or the backdrop, focus moves into it and returns afterwards, and the page behind does not scroll. */
export default function Dialog({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const { t } = useTranslation();
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && box.current) { // keep Tab inside the dialog
        const f = box.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0]!, last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = overflow; prev?.focus(); };
  }, [onClose]);

  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 shadow-xl outline-none sm:rounded-2xl ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={id} className="font-display text-xl font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t("actions.close")} className="rounded-md border border-line px-2.5 py-1 text-sm hover:bg-brand-50">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
