/**
 * ดาวน์โหลดคลังความรู้เป็นเอกสาร (รูปแบบรายงาน)
 *  - หน้าปก · สารบัญ · หัวข้อมีเลขลำดับ · กล่องที่มาใต้ทุกหัวข้อ · บรรณานุกรม · ข้อควรทราบ
 *  - ไม่ใช้หัว/ท้ายกระดาษแบบ fixed (iOS/Android/เว็บ วางตำแหน่งตอนพิมพ์ไม่เหมือนกัน ทับเนื้อหา)
 *  - คลังความรู้อ้างอิง: ทั้งเล่ม / รายหัวข้อ / ทั้งคลัง · คลังภูมิปัญญา: รายเรื่อง / ทั้งคลัง
 * iOS / Android: สร้างไฟล์แล้วเปิดหน้าแชร์ (บันทึกลงไฟล์ / ส่ง LINE) · เว็บ: หน้าพิมพ์ของเบราว์เซอร์
 */
import type { Wisdom } from '../data/mock';
import { outputPdf } from './printDocs';
import { BOOKS, bookOf, citeLabel, docsOf, type Book, type BookKey, type KDoc } from './sources';

const esc = (s?: string | number | null) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const today = () => {
  const d = new Date();
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} พ.ศ. ${d.getFullYear() + 543}`;
};

/* ── รูปแบบรายงาน ── */
const CSS = `
  @page { size: A4; margin: 20mm 18mm 22mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { font-family: -apple-system, 'Sukhumvit Set', 'Thonburi', 'Noto Sans Thai', 'Sarabun', sans-serif; color: #1F2A24; font-size: 12.5px; line-height: 1.75; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .cover { min-height: 640px; display: flex; flex-direction: column; page-break-after: always; }
  .band { height: 26px; border-radius: 9px; background: linear-gradient(90deg, #0B6E45, #14905C 55%, #8AD45E); }
  .brand { margin-top: 40px; display: flex; align-items: center; gap: 10px; color: #0B6E45; font-weight: 700; font-size: 14px; letter-spacing: .3px; }
  .dot { width: 26px; height: 26px; border-radius: 8px; background: #14905C; display: inline-block; }
  .kind { margin-top: 96px; display: inline-block; padding: 4px 12px; border-radius: 99px; background: #E3F2EA; color: #0B6E45; font-weight: 700; font-size: 12px; }
  .ctitle { margin: 17px 0 9px; font-size: 30px; line-height: 1.35; font-weight: 800; color: #14201A; }
  .csub { font-size: 14px; color: #5E6B63; max-width: 425px; }
  .meta { margin-top: auto; border-top: 1.5px solid #14905C; padding-top: 14px; display: grid; grid-template-columns: 96px 1fr; row-gap: 7px; font-size: 12px; }
  .meta b { color: #5E6B63; font-weight: 600; }
  .toc { page-break-after: always; }
  h2.part { font-size: 19px; color: #0B6E45; margin: 0 0 14px; padding-bottom: 6px; border-bottom: 1.5px solid #14905C; }
  ol.tocl { list-style: none; padding: 0; margin: 0; counter-reset: t; }
  ol.tocl li { counter-increment: t; display: flex; gap: 8px; padding: 5px 0; border-bottom: 0.6px dotted #C9D6CE; font-size: 12px; }
  ol.tocl li::before { content: counter(t) "."; color: #14905C; font-weight: 700; min-width: 23px; }
  .sec { page-break-inside: avoid; margin: 0 0 20px; }
  .sec h3 { display: flex; gap: 8px; align-items: baseline; font-size: 15px; line-height: 1.45; margin: 0 0 7px; color: #14201A; }
  .sec h3 .no { color: #FFFFFF; background: #14905C; border-radius: 6px; font-size: 11px; padding: 1px 7px; flex: none; }
  .sec p { margin: 0 0 5px; }
  .sec ul { margin: 0 0 5px; padding-left: 14px; }
  .sec li { margin: 0 0 3px; }
  .src { margin-top: 7px; padding: 6px 10px; border-left: 3px solid #14905C; background: #F0F8F5; border-radius: 0 6px 6px 0; font-size: 10.5px; color: #3E4B44; }
  .src a { color: #0B6E45; word-break: break-all; text-decoration: none; }
  table.kv { width: 100%; border-collapse: collapse; margin: 0 0 11px; font-size: 11.5px; }
  table.kv td { border: 0.6px solid #D5E3DB; padding: 6px 9px; vertical-align: top; }
  table.kv td:first-child { width: 96px; background: #F0F8F5; color: #3E4B44; font-weight: 600; }
  table.ing { width: 100%; border-collapse: collapse; margin: 3px 0 9px; font-size: 11.5px; }
  table.ing th { background: #14905C; color: #FFFFFF; text-align: left; padding: 5px 9px; font-weight: 600; }
  table.ing td { border-bottom: 0.6px solid #E1EDE8; padding: 5px 9px; }
  table.ing tr:nth-child(even) td { background: #F7FBF9; }
  .label { font-weight: 700; color: #0B6E45; margin: 9px 0 3px; }
  .warn { margin: 6px 0 9px; padding: 7px 10px; background: #FDF1DC; border-left: 3px solid #D9921A; border-radius: 0 6px 6px 0; color: #5C3D00; }
  .refs { page-break-before: always; }
  ol.bib { padding-left: 17px; font-size: 11px; color: #3E4B44; }
  ol.bib li { margin-bottom: 7px; }
  ol.bib a { color: #0B6E45; word-break: break-all; text-decoration: none; }
  .note { margin-top: 23px; padding: 9px 11px; border-radius: 8px; background: #F0F8F5; font-size: 10.5px; color: #5E6B63; }
  .bookhead { page-break-before: always; margin-bottom: 17px; }
  .bookhead .kind { margin-top: 0; }
  .bookhead h2 { font-size: 22px; margin: 9px 0 3px; color: #14201A; }
  .bookhead p { color: #5E6B63; margin: 0; }
`;

/** ข้อความในคลัง → ย่อหน้า + รายการ (บรรทัดที่ขึ้นต้น • เป็นรายการ) */
function paras(text: string) {
  const lines = text.replace(/\n?\(ที่มา:[^)]*\)\s*$/, '').split('\n').map((l) => l.trim()).filter(Boolean);
  let out = '';
  let ul: string[] = [];
  const flush = () => {
    if (ul.length) out += `<ul>${ul.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    ul = [];
  };
  for (const l of lines) {
    if (/^[•\-–·]\s*/.test(l)) ul.push(l.replace(/^[•\-–·]\s*/, ''));
    else {
      flush();
      const m = l.match(/^([^:：]{2,28})[:：]\s*(.+)$/);
      out += m ? `<p><b>${esc(m[1])}:</b> ${esc(m[2])}</p>` : `<p>${esc(l)}</p>`;
    }
  }
  flush();
  return out;
}

type Cover = { kind: string; title: string; sub?: string; meta: [string, string][] };
const coverHtml = (c: Cover) => `
  <section class="cover">
    <div class="band"></div>
    <div class="brand"><span class="dot"></span>หมอบ้านเชื่อมใจ</div>
    <div><span class="kind">${esc(c.kind)}</span></div>
    <div class="ctitle">${esc(c.title)}</div>
    ${c.sub ? `<div class="csub">${esc(c.sub)}</div>` : ''}
    <div class="meta">${c.meta.map(([k, v]) => `<b>${esc(k)}</b><span>${esc(v)}</span>`).join('')}</div>
  </section>`;
const tocHtml = (items: string[]) => (items.length > 1 ? `<section class="toc"><h2 class="part">สารบัญ</h2><ol class="tocl">${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ol></section>` : '');
const bibHtml = (refs: { title: string; url?: string }[]) =>
  refs.length ? `<section class="refs"><h2 class="part">บรรณานุกรม</h2><ol class="bib">${refs.map((r) => `<li>${esc(r.title)}${r.url ? `<br><a href="${esc(r.url)}">${esc(r.url)}</a>` : ''}</li>`).join('')}</ol>${NOTE}</section>` : NOTE;
const NOTE = `<div class="note"><b>ข้อควรทราบ</b> จัดทำจากแอปหมอบ้านเชื่อมใจ เมื่อ ${today()} · เอกสารนี้ใช้เพื่อการศึกษาและประกอบการดูแลสุขภาพ ไม่แทนการตรวจวินิจฉัยของแพทย์ อาการรุนแรงหรือฉุกเฉินให้ไปโรงพยาบาลหรือโทร 1669</div>`;

function report(title: string, cover: Cover, body: string) {
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>
    ${coverHtml(cover)}${body}</body></html>`;
}

const secHtml = (d: KDoc, no: number) => `
  <section class="sec">
    <h3><span class="no">${no}</span><span>${esc(d.title)}</span></h3>
    ${paras(d.text)}
    <div class="src">ที่มา: ${esc(citeLabel(d))}${d.url ? ` · <a href="${esc(d.url)}">${esc(d.url)}</a>` : ''}</div>
  </section>`;

/* ── คลังความรู้อ้างอิง ── */
export function bookHtml(k: BookKey) {
  const b = bookOf(k);
  const docs = docsOf(k);
  return report(b.short, { kind: 'รายงานคลังความรู้อ้างอิง', title: b.title, sub: b.desc, meta: [['จำนวนหัวข้อ', `${docs.length} หัวข้อ`], ['แหล่งที่มา', b.refs.map((r) => r.title).join(' · ').slice(0, 260)], ['วันที่จัดทำ', today()]] }, `${tocHtml(docs.map((d) => d.title))}${docs.map((d, i) => secHtml(d, i + 1)).join('')}${bibHtml(b.refs)}`);
}
export const bookPdf = (k: BookKey) => outputPdf(bookHtml(k), bookOf(k).short, { report: true });

export function docPdf(d: KDoc) {
  const b = bookOf(d.book);
  const html = report(d.title, { kind: b.short, title: d.title, meta: [['ที่มา', citeLabel(d)], ['วันที่จัดทำ', today()]] }, `${secHtml(d, 1)}${bibHtml(b.refs)}`);
  return outputPdf(html, d.title, { report: true });
}

/** ทุกเล่มในไฟล์เดียว */
export function allBooksPdf() {
  const all = BOOKS.map((b) => ({ b, docs: docsOf(b.k) }));
  const total = all.reduce((n, x) => n + x.docs.length, 0);
  const bookPart = (b: Book, docs: KDoc[], i: number) => `
    <div class="bookhead"><span class="kind">ส่วนที่ ${i + 1}</span><h2>${esc(b.title)}</h2><p>${esc(b.desc)} · ${docs.length} หัวข้อ</p></div>
    ${docs.map((d, j) => secHtml(d, j + 1)).join('')}`;
  const html = report(
    'คลังความรู้อ้างอิงของครูปัญญา',
    { kind: 'รายงานคลังความรู้อ้างอิง', title: 'คลังความรู้อ้างอิงของครูปัญญา', sub: 'รวมตำราทางการที่ครูปัญญาใช้ค้นและอ้างอิงคำแนะนำ', meta: [['จำนวน', `${BOOKS.length} ส่วน · ${total} หัวข้อ`], ['วันที่จัดทำ', today()]] },
    `${tocHtml(all.map((x, i) => `ส่วนที่ ${i + 1} ${x.b.short} (${x.docs.length} หัวข้อ)`))}${all.map((x, i) => bookPart(x.b, x.docs, i)).join('')}${bibHtml(BOOKS.flatMap((b) => b.refs))}`,
  );
  return outputPdf(html, 'คลังความรู้อ้างอิง', { report: true });
}

/* ── คลังภูมิปัญญา ── */
const wisdomSec = (w: Wisdom, no?: number) => `
  <section class="sec" style="page-break-inside:auto">
    <h3>${no != null ? `<span class="no">${no}</span>` : ''}<span>${esc(w.title)}</span></h3>
    <table class="kv">
      <tr><td>ประเภท</td><td>${esc(w.kind)}</td></tr>
      <tr><td>ที่มา</td><td>${esc(w.source)}${w.sharedBy ? ` · ได้รับจาก ${esc(w.sharedBy)}` : ''}</td></tr>
      ${w.date ? `<tr><td>วันที่บันทึก</td><td>${esc(w.date)}</td></tr>` : ''}
      <tr><td>สถานะ</td><td>${w.builtin ? 'ตำราอ้างอิงในระบบ' : w.verified ? 'ตรวจทานแล้ว' : 'ยังไม่ผ่านการตรวจทาน'}</td></tr>
    </table>
    ${w.indication ? `<div class="label">สรรพคุณ / ข้อบ่งใช้</div><p>${esc(w.indication)}</p>` : ''}
    ${w.ingredients?.length ? `<div class="label">ส่วนประกอบ</div><table class="ing"><tr><th style="width:12mm">ลำดับ</th><th>ตัวยา / ปริมาณ</th></tr>${(() => { let n = 0; return w.ingredients.map((x) => (/^\(/.test(x.trim()) ? `<tr><td></td><td><b>${esc(x.trim().replace(/^\(|\)$/g, ''))}</b></td></tr>` : `<tr><td>${++n}</td><td>${esc(x)}</td></tr>`)).join(''); })()}</table>` : ''}
    ${w.method ? `<div class="label">วิธีทำ / วิธีใช้</div>${paras(w.method)}` : ''}
    ${w.caution ? `<div class="warn"><b>ข้อควรระวัง</b> ${esc(w.caution)}</div>` : ''}
    ${w.summary ? `<div class="label">รายละเอียด</div>${paras(w.summary.replace(/———/g, ''))}` : ''}
    ${w.refs?.length ? `<div class="src">อ้างอิง: ${w.refs.map((r) => esc([r.title, r.org, r.year].filter(Boolean).join(' '))).join(' · ')}</div>` : ''}
  </section>`;

export function wisdomPdf(w: Wisdom, by?: string) {
  const html = report(w.title, { kind: `ตำราภูมิปัญญา · ${w.kind}`, title: w.title, sub: w.indication, meta: [...(by ? [['บันทึกโดย', by] as [string, string]] : []), ['ที่มา', w.source], ['วันที่จัดทำ', today()]] }, `${wisdomSec(w)}${NOTE}`);
  return outputPdf(html, w.title, { report: true });
}

export function wisdomsPdf(list: Wisdom[], by?: string) {
  const html = report(
    'คลังภูมิปัญญา',
    { kind: 'รายงานคลังภูมิปัญญา', title: 'คลังภูมิปัญญา', sub: 'ตำรับยา วิธีรักษา และตำราที่บันทึกไว้', meta: [...(by ? [['บันทึกโดย', by] as [string, string]] : []), ['จำนวน', `${list.length} เรื่อง`], ['วันที่จัดทำ', today()]] },
    `${tocHtml(list.map((w) => `${w.title} (${w.kind})`))}${list.map((w, i) => wisdomSec(w, i + 1)).join('')}${NOTE}`,
  );
  return outputPdf(html, 'คลังภูมิปัญญา', { report: true });
}
