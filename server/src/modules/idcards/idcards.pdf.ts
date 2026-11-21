import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { avatarBufferOrNull } from '../profile/profile.service';
import { qrPng, type CardFace } from './idcards.service';
import { getTemplate, readLogo, type CardTemplate } from './idcards.template';

// ISO/IEC 7810 ID-1 (the standard bank-card / ID card size): 85.60 x 53.98 mm, in PDF points.
const MM = 72 / 25.4;
export const CARD_W = 85.6 * MM;
export const CARD_H = 53.98 * MM;
const A4 = { w: 595.28, h: 841.89 };
const ROLE_TITLE: Record<string, string> = { student: 'STUDENT ID CARD', teacher: 'STAFF ID CARD', parent: 'PARENT / GUARDIAN ID', admin: 'STAFF ID CARD' };

// The built-in PDF fonts only hold Latin characters. Anything else (for example Arabic letters) would print as wrong symbols, so it is dropped.
const printable = (s: string | null | undefined) => (s ?? '').replace(/[^\x20-\x7E\u00A1-\u00FF]/g, '').replace(/\s+/g, ' ').trim();
const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
const onColor = (hex: string) => (lum(hex) > 0.62 ? '#1c2417' : '#ffffff');
const dmy = (d: string | Date) => new Date(d).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: '2-digit', month: 'short', year: 'numeric' });
const initials = (name: string) => printable(name).split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

const fallbackLogo = () => { const p = resolve(process.cwd(), process.env.SCHOOL_LOGO_PATH || 'assets/logo.png'); return existsSync(p) ? p : null; };

interface Assets { logo: Buffer | string | null; photos: Map<string, Buffer | null>; qrs: Map<string, Buffer> }

async function loadAssets(faces: CardFace[], tpl: CardTemplate): Promise<Assets> {
  const logo = (await readLogo(tpl)) ?? fallbackLogo();
  const photos = new Map<string, Buffer | null>(); const qrs = new Map<string, Buffer>();
  await Promise.all(faces.map(async (f) => {
    photos.set(f.userId, tpl.show.photo ? await avatarBufferOrNull(f.userId) : null);
    qrs.set(f.userId, await qrPng(f.token));
  }));
  return { logo, photos, qrs };
}

function drawFront(doc: PDFKit.PDFDocument, x: number, y: number, f: CardFace, t: CardTemplate, a: Assets) {
  const P = t.primaryColor, ACC = t.accentColor, onP = onColor(P);
  doc.save();
  doc.roundedRect(x, y, CARD_W, CARD_H, 7).clip();
  doc.rect(x, y, CARD_W, CARD_H).fill('#ffffff');
  // header
  doc.rect(x, y, CARD_W, 36).fill(P);
  doc.rect(x, y + 36, CARD_W, 3).fill(ACC);
  let tx = x + 10;
  if (a.logo) { try { doc.image(a.logo as any, x + 8, y + 6, { fit: [24, 24] }); tx = x + 38; } catch { /* a bad logo must not stop a card from printing */ } }
  doc.fillColor(onP).font('Helvetica-Bold').fontSize(9).text(printable(t.schoolName).toUpperCase(), tx, y + 9, { width: x + CARD_W - tx - 8, height: 12, ellipsis: true, lineBreak: false });
  doc.fillColor(ACC === P ? onP : lum(P) < 0.5 ? ACC : onP).font('Helvetica-Bold').fontSize(6.5).text(ROLE_TITLE[f.role], tx, y + 22, { width: x + CARD_W - tx - 8, lineBreak: false });
  // photo
  const px = x + 10, py = y + 48, pw = 54, ph = 66;
  const photo = a.photos.get(f.userId);
  doc.save(); doc.roundedRect(px, py, pw, ph, 4).clip();
  if (photo) { try { doc.image(photo, px, py, { cover: [pw, ph], align: 'center', valign: 'center' }); } catch { /* fall through to initials */ } }
  if (!photo) {
    doc.rect(px, py, pw, ph).fill('#e5e7eb');
    doc.fillColor('#6b7280').font('Helvetica-Bold').fontSize(20).text(initials(f.name), px, py + ph / 2 - 10, { width: pw, align: 'center', lineBreak: false });
  }
  doc.restore();
  doc.roundedRect(px, py, pw, ph, 4).lineWidth(0.8).strokeColor(P).stroke();
  // details
  const dx = x + 74, dw = CARD_W - 74 - 10;
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(10.5).text(printable(f.name) || '-', dx, y + 47, { width: dw, height: 26, ellipsis: true });
  let cy = y + 72;
  const line = (label: string, value: string) => {
    doc.fillColor('#6b7280').font('Helvetica').fontSize(5.8).text(label.toUpperCase(), dx, cy, { width: dw, lineBreak: false });
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8).text(printable(value), dx, cy + 7, { width: dw, height: 10, ellipsis: true, lineBreak: false });
    cy += 17;
  };
  if (t.show.number) line(f.idLabel, f.idValue);
  if (t.show.classInfo && f.line1) line(f.role === 'student' ? 'Class' : 'Designation', f.line1);
  if (t.show.session && f.line2) line('Session', f.line2);
  // dates + footer
  const dates = [t.show.issueDate && f.state !== 'preview' ? `Issued ${dmy(f.issuedAt)}` : t.show.issueDate ? `Issued ${dmy(new Date())}` : '', t.show.expiry && f.expiresAt ? `Valid to ${dmy(f.expiresAt)}` : ''].filter(Boolean).join('   ');
  if (dates) doc.fillColor('#374151').font('Helvetica').fontSize(6).text(dates, x + 10, y + CARD_H - 22, { width: CARD_W - 20, lineBreak: false });
  doc.rect(x, y + CARD_H - 14, CARD_W, 14).fill(P);
  doc.fillColor(onP).font('Helvetica').fontSize(5.5).text(printable(t.footerText), x + 8, y + CARD_H - 10, { width: CARD_W - 16, height: 8, ellipsis: true, lineBreak: false, align: 'center' });
  doc.restore();
  doc.roundedRect(x, y, CARD_W, CARD_H, 7).lineWidth(0.4).strokeColor('#9ca3af').stroke();
}

function drawBack(doc: PDFKit.PDFDocument, x: number, y: number, f: CardFace, t: CardTemplate, a: Assets) {
  const P = t.primaryColor, ACC = t.accentColor, onP = onColor(P);
  doc.save();
  doc.roundedRect(x, y, CARD_W, CARD_H, 7).clip();
  doc.rect(x, y, CARD_W, CARD_H).fill('#ffffff');
  doc.rect(x, y, CARD_W, 12).fill(P);
  doc.rect(x, y + 12, CARD_W, 2).fill(ACC);
  doc.fillColor(onP).font('Helvetica-Bold').fontSize(6.5).text(printable(t.schoolName).toUpperCase(), x + 8, y + 3.5, { width: CARD_W - 16, lineBreak: false, ellipsis: true });
  // QR: 64 pt = about 22.6 mm square, with its own white quiet zone from the generator. Well above the size phones need.
  const q = 64, qx = x + 10, qy = y + 24;
  doc.image(a.qrs.get(f.userId)!, qx, qy, { width: q, height: q });
  doc.fillColor('#6b7280').font('Helvetica').fontSize(5.5).text('SCAN TO VERIFY', qx, qy + q + 2, { width: q, align: 'center', lineBreak: false });
  const tx = x + 84, tw = CARD_W - 84 - 10;
  doc.fillColor('#6b7280').font('Helvetica').fontSize(5.5).text('CARD NUMBER', tx, y + 24, { width: tw, lineBreak: false });
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9).text(f.cardNumber, tx, y + 31, { width: tw, lineBreak: false });
  doc.fillColor('#374151').font('Helvetica').fontSize(5.6).text(printable(t.backText), tx, y + 46, { width: tw, height: 40, ellipsis: true });
  const contact = [printable(t.address), printable(t.phone), printable(t.email)].filter(Boolean).join('\n');
  if (contact) doc.fillColor('#111827').font('Helvetica').fontSize(5.6).text(contact, tx, y + 88, { width: tw, height: 26, ellipsis: true });
  doc.rect(x, y + CARD_H - 8, CARD_W, 8).fill(P);
  doc.restore();
  doc.roundedRect(x, y, CARD_W, CARD_H, 7).lineWidth(0.4).strokeColor('#9ca3af').stroke();
}

export type PdfLayout = 'cards' | 'sheet';

/** Loads photos, QR codes and the logo first, so any failure is a normal JSON error. Only then does render() stream the PDF. */
export async function prepareCardsPdf(faces: CardFace[], layout: PdfLayout) {
  const t = await getTemplate();
  const a = await loadAssets(faces, t);
  return {
    filename: faces.length === 1 ? `id-card-${faces[0]!.cardNumber}.pdf` : `id-cards-${faces.length}.pdf`,
    render(out: NodeJS.WritableStream) {
      const doc = new PDFDocument({ autoFirstPage: false, margin: 0, info: { Title: 'ID cards', Author: printable(t.schoolName) } });
      doc.pipe(out);
      if (layout === 'cards') {
        for (const f of faces) {
          doc.addPage({ size: [CARD_W, CARD_H], margin: 0 }); drawFront(doc, 0, 0, f, t, a);
          doc.addPage({ size: [CARD_W, CARD_H], margin: 0 }); drawBack(doc, 0, 0, f, t, a);
        }
      } else {
        const cols = 2, rows = 5, gapX = 12, gapY = 8;
        const left = (A4.w - cols * CARD_W - (cols - 1) * gapX) / 2, top = (A4.h - rows * CARD_H - (rows - 1) * gapY) / 2;
        const perPage = cols * rows;
        for (let i = 0; i < faces.length; i += perPage) {
          const batch = faces.slice(i, i + perPage);
          // Fronts, then a page of backs with the columns swapped, so the two sides line up when printed double-sided (flip on long edge).
          doc.addPage({ size: 'A4', margin: 0 });
          batch.forEach((f, k) => drawFront(doc, left + (k % cols) * (CARD_W + gapX), top + Math.floor(k / cols) * (CARD_H + gapY), f, t, a));
          doc.addPage({ size: 'A4', margin: 0 });
          batch.forEach((f, k) => drawBack(doc, left + (cols - 1 - (k % cols)) * (CARD_W + gapX), top + Math.floor(k / cols) * (CARD_H + gapY), f, t, a));
        }
      }
      doc.end();
    },
  };
}
