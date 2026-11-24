import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Avatar from "../Avatar";
import { fetchApiBlob } from "../../lib/api";
import type { CardFace, CardTemplate } from "./types";

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (
    (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  );
};
const onColor = (hex: string) =>
  /^#[0-9a-fA-F]{6}$/.test(hex) && lum(hex) > 0.62 ? "#1c2417" : "#ffffff";
const ROLE_TITLE: Record<string, string> = {
  student: "STUDENT ID CARD",
  teacher: "STAFF ID CARD",
  parent: "PARENT / GUARDIAN ID",
  admin: "STAFF ID CARD",
};

// The preview uses a light paper surface in light mode and a dark card surface in dark mode.
const card =
  "card-preview keep-colour relative aspect-[85.6/53.98] w-full max-w-[26rem] overflow-hidden rounded-xl border border-gray-400 bg-white text-[#111827] shadow-md";

function useLogo(show: boolean, key: string | null) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!show) {
      setSrc(null);
      return;
    }
    let live = true;
    let url: string | null = null;
    fetchApiBlob("/admin/id-cards/template/logo")
      .then((b) => {
        url = URL.createObjectURL(b);
        if (live) setSrc(url);
      })
      .catch(() => {
        if (live) setSrc(null);
      });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [show, key]);
  return src;
}

const fmt = (d: string | Date, lang: string) =>
  new Date(d).toLocaleDateString(lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export function CardFront({
  face,
  tpl,
}: {
  face: CardFace;
  tpl: CardTemplate;
}) {
  const { i18n } = useTranslation();
  const logo = useLogo(!!tpl.logoKey, tpl.logoKey);
  const onP = onColor(tpl.primaryColor);
  const rows: [string, string][] = [];
  if (tpl.show.number) rows.push([face.idLabel, face.idValue]);
  if (tpl.show.classInfo && face.line1)
    rows.push([face.role === "student" ? "Class" : "Designation", face.line1]);
  if (tpl.show.session && face.line2) rows.push(["Session", face.line2]);
  const dates = [
    tpl.show.issueDate
      ? `Issued ${fmt(face.state === "preview" ? new Date() : face.issuedAt, "en")}`
      : "",
    tpl.show.expiry && face.expiresAt
      ? `Valid to ${fmt(face.expiresAt, "en")}`
      : "",
  ]
    .filter(Boolean)
    .join("   ");
  void i18n;
  return (
    <div
      className={card}
      dir="ltr"
      style={{ fontFamily: "Public Sans, sans-serif" }}
    >
      <div
        className="flex h-[24%] items-center gap-2 px-[3.5%]"
        style={{ background: tpl.primaryColor, color: onP }}
      >
        {logo ? (
          <img src={logo} alt="" className="h-[70%] w-auto object-contain" />
        ) : (
          <span className="h-[70%] w-[8%]" />
        )}
        <div className="min-w-0">
          <p className="truncate text-[0.7rem] font-bold uppercase leading-tight sm:text-sm">
            {tpl.schoolName}
          </p>
          <p
            className="truncate text-[0.5rem] font-bold sm:text-[0.62rem]"
            style={{
              color: lum(tpl.primaryColor) < 0.5 ? tpl.accentColor : onP,
            }}
          >
            {ROLE_TITLE[face.role]}
          </p>
        </div>
      </div>
      <div className="h-[2%]" style={{ background: tpl.accentColor }} />
      <div className="flex gap-[4%] px-[4%] pt-[4%]">
        {tpl.show.photo && (
          <div
            className="shrink-0 overflow-hidden rounded-md border-2"
            style={{
              borderColor: tpl.primaryColor,
              width: "22.5%",
              aspectRatio: "54/66",
            }}
          >
            <Avatar
              userId={face.userId}
              name={face.name}
              version={face.hasPhoto ? face.avatarVersion : null}
              size={96}
              className="!h-full !w-full !rounded-none"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[0.8rem] font-bold leading-tight sm:text-base">
            {face.name}
          </p>
          <dl className="mt-1.5 space-y-0.5">
            {rows.map(([l, v]) => (
              <div key={l}>
                <dt className="text-[0.45rem] uppercase text-gray-500 sm:text-[0.58rem]">
                  {l}
                </dt>
                <dd className="truncate text-[0.62rem] font-bold sm:text-xs">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <p className="absolute inset-x-[4%] bottom-[11%] truncate text-[0.45rem] text-gray-600 sm:text-[0.58rem]">
        {dates}
      </p>
      <div
        className="absolute inset-x-0 bottom-0 flex h-[9.5%] items-center justify-center px-[3%]"
        style={{ background: tpl.primaryColor, color: onP }}
      >
        <p className="truncate text-[0.42rem] sm:text-[0.55rem]">
          {tpl.footerText}
        </p>
      </div>
    </div>
  );
}

export function CardBack({ face, tpl }: { face: CardFace; tpl: CardTemplate }) {
  const { t } = useTranslation("idcards");
  const onP = onColor(tpl.primaryColor);
  return (
    <div
      className={card}
      dir="ltr"
      style={{ fontFamily: "Public Sans, sans-serif" }}
    >
      <div
        className="flex h-[8%] items-center px-[3%]"
        style={{ background: tpl.primaryColor, color: onP }}
      >
        <p className="truncate text-[0.45rem] font-bold uppercase sm:text-[0.6rem]">
          {tpl.schoolName}
        </p>
      </div>
      <div className="h-[1.5%]" style={{ background: tpl.accentColor }} />
      <div className="flex gap-[4%] px-[4%] pt-[4%]">
        <div className="w-[30%] shrink-0 text-center">
          <div className="card-qr-wrap rounded-sm p-[3%]">
            <img
              src={face.qr}
              alt="QR"
              className="keep-colour aspect-square w-full"
            />
          </div>
          <p className="mt-0.5 text-[0.42rem] uppercase text-gray-500 sm:text-[0.55rem]">
            {t("preview.scanToVerify")}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.42rem] uppercase text-gray-500 sm:text-[0.55rem]">
            {t("preview.cardNumber")}
          </p>
          <p className="text-[0.7rem] font-bold sm:text-sm">
            {face.cardNumber}
          </p>
          <p className="mt-1 line-clamp-4 text-[0.45rem] leading-snug text-gray-700 sm:text-[0.58rem]">
            {tpl.backText}
          </p>
          <p className="mt-1 whitespace-pre-line text-[0.45rem] leading-snug sm:text-[0.58rem]">
            {[tpl.address, tpl.phone, tpl.email].filter(Boolean).join("\n")}
          </p>
          <h2
            dir="rtl"
            className="font-[Amiri,serif] text-[2rem] text-center font-black leading-tight sm:text-[1.0rem] p-3"
          >
            معهد الرحمة الإسلامي
          </h2>
        </div>
      </div>
      <div
        className="absolute inset-x-0 bottom-0 flex h-[5%] items-center justify-center"
        dir="rtl"
        style={{ background: tpl.primaryColor, color: onP }}
      ></div>
    </div>
  );
}
