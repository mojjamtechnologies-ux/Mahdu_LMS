import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import jsQR from "jsqr";
import { SmallButton } from "../ui";

type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
declare global { interface Window { BarcodeDetector?: new (o?: { formats: string[] }) => Detector } }

/**
 * Live camera scanner. Uses the browser's built-in BarcodeDetector where there is one (Chrome and Edge, Android and desktop) and
 * the jsQR decoder everywhere else (iPhone Safari, Firefox). It reads one code, then waits (`paused`) until the page has dealt with it.
 */
export default function CameraScanner({ onCode, paused }: { onCode: (code: string) => void; paused: boolean }) {
  const { t } = useTranslation("idcards");
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);
  const handled = useRef(false);
  const pausedRef = useRef(paused);
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");

  useEffect(() => { pausedRef.current = paused; if (!paused) handled.current = false; }, [paused]);

  const stop = useCallback(() => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setRunning(false);
  }, []);
  useEffect(() => stop, [stop]);

  const start = useCallback(async (id?: string) => {
    setError("");
    if (!window.isSecureContext) { setError(t("scanner.https")); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setError(t("scanner.unsupported")); return; }
    stop(); setStarting(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: id ? { deviceId: { exact: id }, width: { ideal: 1280 } } : { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
      });
      stream.current = s;
      const v = video.current!;
      v.srcObject = s; v.setAttribute("playsinline", "true"); v.muted = true;
      await v.play();
      setRunning(true);
      const all = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
      setDevices(all);
      setDeviceId(s.getVideoTracks()[0]?.getSettings().deviceId ?? "");

      const detector = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code", "code_128", "ean_13", "code_39"] }) : null;
      let working = false;
      timer.current = window.setInterval(async () => {
        if (working || pausedRef.current || handled.current || v.readyState < 2 || !v.videoWidth) return;
        working = true;
        try {
          let value = "";
          if (detector) {
            value = (await detector.detect(v))[0]?.rawValue ?? "";
          } else {
            const c = (canvas.current ??= document.createElement("canvas"));
            const scale = Math.min(1, 640 / v.videoWidth);
            c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
            const ctx = c.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(v, 0, 0, c.width, c.height);
            const img = ctx.getImageData(0, 0, c.width, c.height);
            value = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? "";
          }
          if (value && !handled.current) { handled.current = true; onCode(value); } // one read at a time: ignored until the page resumes us
        } catch { /* a single bad frame is skipped */ } finally { working = false; }
      }, 180);
    } catch (e) {
      const name = (e as DOMException)?.name;
      setError(name === "NotAllowedError" || name === "SecurityError" ? t("scanner.denied") : name === "NotFoundError" || name === "OverconstrainedError" ? t("scanner.noCamera") : name === "NotReadableError" ? t("scanner.busy") : t("scanner.unsupported"));
      stop();
    } finally { setStarting(false); }
  }, [onCode, stop, t]);

  return (
    <div>
      <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-xl border border-line bg-black">
        <video ref={video} className="keep-colour h-full w-full object-cover" muted playsInline />
        {running && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[62%] w-[62%] rounded-2xl border-4 border-gold-400/90 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
          </div>
        )}
        {!running && <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-white/80">{starting ? t("scanner.starting") : t("scanner.intro")}</div>}
      </div>
      {running && <p className="mt-2 text-center text-sm text-muted">{t("scanner.hint")}</p>}
      {error && <p role="alert" className="mx-auto mt-3 max-w-md rounded-lg border border-red-300 bg-red-50 px-3.5 py-3 text-sm text-red-900">{error}</p>}
      <div className="mx-auto mt-3 flex max-w-md flex-wrap items-center justify-center gap-2">
        {running ? <SmallButton type="button" onClick={stop}>{t("scanner.stop")}</SmallButton>
          : <button type="button" disabled={starting} onClick={() => start(deviceId || undefined)} className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">{t("scanner.start")}</button>}
        {devices.length > 1 && (
          <select aria-label={t("scanner.camera")} value={deviceId} onChange={(e) => { setDeviceId(e.target.value); void start(e.target.value); }} className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm">
            {devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `${t("scanner.camera")} ${i + 1}`}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}
