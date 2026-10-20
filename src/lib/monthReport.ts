/** สรุปการรักษารายเดือนจากทะเบียน ม.บ.5 (คำนวณในเครื่อง) + PDF สำหรับรายงาน รพ.สต. / สสจ. */
import type { MB5Visit, Patient } from '../data/mock';
import { herbsMentioned } from './brain';

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export const monthLabel = (y: number, m: number) => `${TH_MONTHS[m]} ${y + 543}`;

/** "14/10/2569" → { y: 2026, m: 9 } */
function ym(date: string) {
  const x = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return x ? { y: +x[3] - 543, m: +x[2] - 1 } : null;
}

const clean = (s?: string) => (s && s.trim() && s.trim() !== '-' ? s.trim() : '');
const top = (xs: string[], k: number) =>
  [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([name, n]) => ({ name, n }));

export type MonthReport = {
  y: number;
  m: number;
  visits: number;
  patients: number;
  newPatients: number;
  male: number;
  female: number;
  ages: { label: string; n: number }[];
  diagnoses: { name: string; n: number }[];
  herbs: { name: string; n: number }[];
  outcomes: { name: string; n: number }[];
  referrals: number;
  rows: { p: Patient; v: MB5Visit }[];
};

export function monthReport(patients: Patient[], y: number, m: number): MonthReport {
  const rows: { p: Patient; v: MB5Visit }[] = [];
  patients.forEach((p) => p.visits.forEach((v) => {
    const d = ym(v.date);
    if (d && d.y === y && d.m === m) rows.push({ p, v });
  }));
  const ids = new Set(rows.map((r) => r.p.id));
  const ps = patients.filter((p) => ids.has(p.id));
  // ผู้ป่วยใหม่ = มาครั้งแรก (ครั้งที่ 1) ในเดือนนี้
  const newPatients = new Set(rows.filter((r) => r.v.no === 1).map((r) => r.p.id)).size;
  const AGE = [
    { label: 'ต่ำกว่า 15 ปี', ok: (a: number) => a < 15 },
    { label: '15–59 ปี', ok: (a: number) => a >= 15 && a < 60 },
    { label: '60 ปีขึ้นไป', ok: (a: number) => a >= 60 },
  ];
  const referrals = patients.reduce((n, p) => n + (p.referrals ?? []).filter((r) => { const d = new Date(r.at); return d.getFullYear() === y && d.getMonth() === m; }).length, 0);
  return {
    y,
    m,
    visits: rows.length,
    patients: ps.length,
    newPatients,
    male: ps.filter((p) => p.sex === 'ชาย').length,
    female: ps.filter((p) => p.sex === 'หญิง').length,
    ages: AGE.map((a) => ({ label: a.label, n: ps.filter((p) => a.ok(p.age)).length })),
    diagnoses: top(rows.map((r) => clean(r.v.diagnosis) || clean(r.v.symptoms)).filter(Boolean).map((x) => x.split(/[·,(]/)[0].trim()), 8),
    herbs: top(rows.flatMap((r) => herbsMentioned(r.v.treatment).map((h) => h.name)), 8),
    outcomes: top(rows.map((r) => clean(r.v.result)).filter(Boolean).map((x) => x.split(/[·,]/)[0].trim().slice(0, 30)), 6),
    referrals,
    rows: rows.sort((a, b) => a.v.date.split('/').reverse().join('').localeCompare(b.v.date.split('/').reverse().join(''))),
  };
}

const esc = (s: string | number) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function monthReportHtml(r: MonthReport, dr: { name: string; types: string; cert?: string | null; province?: string | null }) {
  const list = (xs: { name: string; n: number }[], unit: string) => (xs.length ? `<ol>${xs.map((x) => `<li>${esc(x.name)} — ${x.n} ${unit}</li>`).join('')}</ol>` : '<div class="muted">-</div>');
  const css = `@page{size:A4;margin:14mm 12mm}body{font-family:-apple-system,'Thonburi','Noto Sans Thai',sans-serif;color:#111;font-size:12.5px;line-height:1.5}h1{font-size:18px;text-align:center;margin:0}h2{font-size:13.5px;text-align:center;margin:2px 0 12px;font-weight:600}.muted{color:#888}.grid{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}.k{flex:1;min-width:110px;border:1px solid #333;border-radius:6px;padding:8px;text-align:center}.k b{display:block;font-size:20px}.two{display:flex;gap:16px}.two>div{flex:1}h3{font-size:13px;margin:12px 0 4px}table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border:1px solid #333;padding:4px 5px;font-size:11.5px;vertical-align:top}th{background:#eef3ef}ol{margin:2px 0 0 18px;padding:0}.sign{margin-top:28px;text-align:right}`;
  const body = `
    <h1>รายงานสรุปการให้บริการของหมอพื้นบ้าน</h1>
    <h2>ประจำเดือน ${monthLabel(r.y, r.m)} · ${esc(dr.name)}${dr.types ? ` (${esc(dr.types)})` : ''}${dr.cert ? ` · เลขที่หนังสือรับรอง ${esc(dr.cert)}` : ''}</h2>
    <div class="grid">
      <div class="k"><b>${r.visits}</b>ครั้งที่ให้การรักษา</div>
      <div class="k"><b>${r.patients}</b>ผู้ป่วย (ราย)</div>
      <div class="k"><b>${r.newPatients}</b>ผู้ป่วยใหม่</div>
      <div class="k"><b>${r.referrals}</b>ส่งต่อสถานพยาบาล</div>
    </div>
    <div class="two">
      <div><h3>เพศ</h3>ชาย ${r.male} ราย · หญิง ${r.female} ราย<h3>ช่วงอายุ</h3>${r.ages.map((a) => `${a.label} ${a.n} ราย`).join(' · ')}</div>
      <div><h3>ผลการรักษา</h3>${list(r.outcomes, 'ครั้ง')}</div>
    </div>
    <div class="two">
      <div><h3>โรค/อาการที่พบบ่อย</h3>${list(r.diagnoses, 'ครั้ง')}</div>
      <div><h3>สมุนไพรที่ใช้บ่อย</h3>${list(r.herbs, 'ครั้ง')}</div>
    </div>
    <h3>รายการให้การรักษา</h3>
    <table><tr><th>ว/ด/ป</th><th>ผู้ป่วย</th><th>อาการ/วินิจฉัย</th><th>การรักษา</th><th>ผล</th></tr>
    ${r.rows.map(({ p, v }) => `<tr><td>${esc(v.date)}</td><td>${esc(p.name)}</td><td>${esc(clean(v.diagnosis) || clean(v.symptoms) || '-')}</td><td>${esc(clean(v.treatment) || '-')}</td><td>${esc(clean(v.result) || '-')}</td></tr>`).join('') || '<tr><td colspan="5" class="muted" style="text-align:center">ไม่มีการรักษาในเดือนนี้</td></tr>'}
    </table>
    <div class="sign">ลงชื่อ ......................................................<br>(${esc(dr.name)})<br>หมอพื้นบ้าน</div>`;
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายงาน ${monthLabel(r.y, r.m)}</title><style>${css}</style></head><body>${body}</body></html>`;
}
