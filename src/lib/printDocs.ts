/**
 * เอกสารพิมพ์ (PDF): แบบ ม.บ.5 (ทะเบียนการรักษา) และหนังสือส่งต่อผู้ป่วย
 * iOS / Android: สร้างไฟล์ PDF แล้วเปิดหน้าแชร์ (บันทึกลงไฟล์ / ส่ง LINE / พิมพ์) · เว็บ: เปิดหน้าพิมพ์ของเบราว์เซอร์ (บันทึกเป็น PDF ได้)
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { fullAddress, type MB5Visit, type Patient } from '../data/mock';

export type Doctor = { name: string; types: string; cert?: string | null; province?: string | null };

const esc = (s?: string | number | null) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
const dash = (s?: string | null) => (s && s.trim() && s.trim() !== '-' ? esc(s) : '<span class="muted">-</span>');
const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const today = () => {
  const d = new Date();
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} พ.ศ. ${d.getFullYear() + 543}`;
};
const bmi = (p: Patient) => (p.weight && p.height ? (p.weight / (p.height / 100) ** 2).toFixed(1) : '');

const BASE_CSS = `
  @page { size: A4 %ORIENT%; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, 'Thonburi', 'Sukhumvit Set', 'Noto Sans Thai', 'Sarabun', sans-serif; color: #111; font-size: 12.5px; line-height: 1.5; }
  h1 { font-size: 18px; margin: 0; text-align: center; }
  h2 { font-size: 13.5px; margin: 0 0 2px; text-align: center; font-weight: 600; }
  .muted { color: #888; }
  .row { display: flex; gap: 18px; flex-wrap: wrap; }
  .f { display: inline-flex; gap: 6px; align-items: baseline; }
  .f b { font-weight: 600; white-space: nowrap; }
  .line { border-bottom: 1px dotted #888; padding: 0 4px; min-width: 60px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th, td { border: 1px solid #333; padding: 5px 6px; vertical-align: top; text-align: left; }
  th { background: #eef3ef; font-weight: 600; text-align: center; font-size: 12px; }
  .box { border: 1px solid #333; border-radius: 4px; padding: 10px 12px; margin-top: 10px; }
  .sign { margin-top: 34px; display: flex; justify-content: flex-end; }
  .sign div { text-align: center; min-width: 260px; }
  .foot { margin-top: 14px; font-size: 10.5px; color: #777; text-align: right; }
`;
const page = (title: string, body: string, landscape = false) =>
  `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${BASE_CSS.replace('%ORIENT%', landscape ? 'landscape' : 'portrait')}</style></head><body>${body}</body></html>`;

/** หัวข้อมูลผู้ป่วย (ใช้ทั้ง ม.บ.5 และใบส่งต่อ) */
const patientBlock = (p: Patient) => `
  <div class="row"><span class="f"><b>ชื่อ-สกุล</b><span class="line">${esc(p.name)}</span></span><span class="f"><b>เพศ</b><span class="line">${esc(p.sex)}</span></span><span class="f"><b>อายุ</b><span class="line">${esc(p.age)} ปี</span></span><span class="f"><b>โทรศัพท์</b><span class="line">${dash(p.phone)}</span></span></div>
  <div class="row"><span class="f"><b>ที่อยู่</b><span class="line">${dash(fullAddress(p.address))}</span></span></div>
  <div class="row"><span class="f"><b>โรคประจำตัว</b><span class="line">${dash(p.chronic)}</span></span><span class="f"><b>ประวัติแพ้ยา/อาหาร</b><span class="line">${dash(p.allergies)}</span></span></div>
  <div class="row"><span class="f"><b>ยาที่ใช้อยู่</b><span class="line">${dash(p.meds?.join(', '))}</span></span><span class="f"><b>น้ำหนัก</b><span class="line">${p.weight ? esc(p.weight) + ' กก.' : '-'}</span></span><span class="f"><b>ส่วนสูง</b><span class="line">${p.height ? esc(p.height) + ' ซม.' : '-'}</span></span>${bmi(p) ? `<span class="f"><b>BMI</b><span class="line">${bmi(p)}</span></span>` : ''}<span class="f"><b>ธาตุเจ้าเรือน</b><span class="line">${dash(p.element)}</span></span></div>`;

/** แบบ ม.บ.5 — ทะเบียนการรักษา ประวัติการรักษา และผลการรักษาผู้ป่วย (ผู้ป่วยละหน้า เรียงครั้งที่จากน้อยไปมาก) */
export function mb5Html(patients: Patient[], dr: Doctor) {
  const sheets = patients.map((p, i) => {
    const visits = [...p.visits].sort((a, b) => a.no - b.no);
    const rows = visits.length
      ? visits
          .map(
            (v) => `<tr><td style="text-align:center">${v.no}</td><td style="white-space:nowrap">${dash(v.date)}</td><td>${dash(v.symptoms)}</td><td>${dash(v.exam)}</td><td>${dash(v.diagnosis)}</td><td>${dash(v.treatment)}</td><td>${dash(v.result)}</td><td>${dash(v.followUp)}</td><td>${dash(v.note)}</td></tr>`,
          )
          .join('')
      : `<tr><td colspan="9" style="text-align:center;color:#888;padding:18px">ยังไม่มีบันทึกการรักษา</td></tr>`;
    return `<section style="${i ? 'page-break-before:always' : ''}">
      <div style="text-align:right;font-weight:600">แบบ ม.บ.5</div>
      <h1>ทะเบียนการรักษา ประวัติการรักษา และผลการรักษาผู้ป่วย</h1>
      <h2>ของหมอพื้นบ้าน ${esc(dr.name)}${dr.types ? ` (${esc(dr.types)})` : ''}${dr.cert ? ` · เลขที่หนังสือรับรอง ${esc(dr.cert)}` : ''}</h2>
      <div class="box">${patientBlock(p)}</div>
      <table>
        <tr><th style="width:5%">ครั้งที่</th><th style="width:8%">ว/ด/ป</th><th style="width:14%">อาการเจ็บป่วย</th><th style="width:12%">ตรวจร่างกาย</th><th style="width:11%">วินิจฉัยโรค</th><th style="width:17%">การรักษา</th><th style="width:9%">ผลการรักษา</th><th style="width:14%">การติดตามผล</th><th style="width:10%">หมายเหตุ</th></tr>
        ${rows}
      </table>
      <div class="sign"><div>ลงชื่อ ......................................................<br>(${esc(dr.name)})<br>หมอพื้นบ้าน</div></div>
      <div class="foot">พิมพ์จากแอปหมอบ้านเชื่อมใจ · ${today()}</div>
    </section>`;
  });
  return page('แบบ ม.บ.5', sheets.join(''), true);
}

export type Referral = { to: string; reason: string; urgent: boolean; extra?: string; no?: string };

/** หนังสือส่งต่อผู้ป่วย → รพ.สต. / โรงพยาบาล (ใช้ข้อมูลการรักษาครั้งล่าสุด) */
export function referralHtml(p: Patient, v: MB5Visit | undefined, r: Referral, dr: Doctor) {
  const body = `
    <div style="display:flex;justify-content:space-between"><span>${r.no ? `เลขที่ส่งต่อ ${esc(r.no)}` : ''}</span><span>วันที่ ${today()}</span></div>
    <h1 style="margin-top:8px">หนังสือส่งต่อผู้ป่วย</h1>
    ${r.urgent ? '<div style="text-align:center;margin-top:4px"><span style="border:1.5px solid #c00;color:#c00;padding:2px 12px;border-radius:4px;font-weight:700">ด่วน</span></div>' : ''}
    <div style="margin-top:14px"><b>เรียน</b> ผู้อำนวยการ${esc(r.to || '..............................................')}</div>
    <div style="margin-top:8px;text-indent:32px">ข้าพเจ้า ${esc(dr.name)} หมอพื้นบ้าน${dr.types ? `ประเภท${esc(dr.types)}` : ''}${dr.cert ? ` เลขที่หนังสือรับรอง ${esc(dr.cert)}` : ''} ขอส่งตัวผู้ป่วยเพื่อรับการตรวจรักษาต่อ รายละเอียดดังนี้</div>
    <div class="box">${patientBlock(p)}</div>
    <div class="box">
      <div><b>อาการสำคัญ</b> ${dash(v?.symptoms)}</div>
      <div><b>ผลการตรวจร่างกาย</b> ${dash(v?.exam)}</div>
      <div><b>การวินิจฉัยเบื้องต้น (แผนไทย)</b> ${dash(v?.diagnosis)}</div>
      <div><b>การรักษาที่ให้แล้ว</b> ${dash(v?.treatment)}${v?.date ? ` <span class="muted">(เมื่อ ${esc(v.date)})</span>` : ''}</div>
      <div><b>ผลการรักษา</b> ${dash(v?.result)}</div>
    </div>
    <div class="box"><b>เหตุผลที่ส่งต่อ</b><div style="margin-top:4px">${dash(r.reason)}</div>${r.extra ? `<div style="margin-top:6px"><b>หมายเหตุ</b> ${esc(r.extra)}</div>` : ''}</div>
    <div style="margin-top:12px;text-indent:32px">จึงเรียนมาเพื่อโปรดพิจารณาให้การดูแลรักษาต่อ และขอความกรุณาแจ้งผลการรักษากลับเพื่อการติดตามอาการต่อไป</div>
    <div class="sign"><div>ลงชื่อ ......................................................<br>(${esc(dr.name)})<br>หมอพื้นบ้าน</div></div>
    <div class="box" style="margin-top:26px;border-style:dashed"><b>ส่วนของหน่วยบริการที่รับ</b> (ตอบกลับผลการรักษา)<div style="height:70px"></div><div style="text-align:right">ลงชื่อผู้รับ ......................................... วันที่ ....................</div></div>
    <div class="foot">พิมพ์จากแอปหมอบ้านเชื่อมใจ</div>`;
  return page('หนังสือส่งต่อผู้ป่วย', body);
}

/** สร้าง PDF แล้วเปิดหน้าแชร์ (เว็บ = หน้าพิมพ์ของเบราว์เซอร์) */
export async function outputPdf(html: string, fileTitle: string) {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html, margins: { left: 0, right: 0, top: 0, bottom: 0 } });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: fileTitle });
  else await Print.printAsync({ uri });
}
