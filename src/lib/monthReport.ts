/**
 * รายงานการรักษา (dashboard) จากทะเบียน ม.บ.5 — คำนวณในเครื่อง
 * ช่วงเวลา: 1 เดือน (แท่งรายสัปดาห์) · 3 เดือน / 1 ปี (แท่งรายเดือน) · เทียบกับช่วงก่อนหน้าเท่ากัน
 * + PDF สำหรับรายงาน รพ.สต. / สสจ. หรือประกอบการต่ออายุหนังสือรับรอง
 */
import type { MB5Visit, Patient } from '../data/mock';
import { herbsMentioned } from './brain';

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const monthLabel = (y: number, m: number) => `${TH_MONTHS[m]} ${y + 543}`;

export type Span = 1 | 3 | 12;
/** ชื่อช่วงเวลา เช่น "ตุลาคม 2569" · "ส.ค.–ต.ค. 2569" · "พ.ย. 2568–ต.ค. 2569" */
export function periodLabel(y: number, m: number, span: Span) {
  if (span === 1) return monthLabel(y, m);
  const s = new Date(y, m - span + 1, 1);
  return s.getFullYear() === y ? `${TH_MON[s.getMonth()]}–${TH_MON[m]} ${y + 543}` : `${TH_MON[s.getMonth()]} ${s.getFullYear() + 543}–${TH_MON[m]} ${y + 543}`;
}

/** "14/10/2569" → Date */
function dateOf(d: string) {
  const x = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return x ? new Date(+x[3] - 543, +x[2] - 1, +x[1]) : null;
}
const clean = (s?: string) => (s && s.trim() && s.trim() !== '-' ? s.trim() : '');
const top = (xs: string[], k: number) =>
  [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([name, n]) => ({ name, n }));

/** ผลการรักษา (พิมพ์เอง) → กลุ่ม */
export const OUTCOMES = [
  { k: 'หาย', color: '#14905C' },
  { k: 'ดีขึ้น', color: '#3FB37F' },
  { k: 'ทรงตัว', color: '#E0A31A' },
  { k: 'แย่ลง', color: '#D2453A' },
  { k: 'ส่งต่อ', color: '#2F7BE0' },
  { k: 'รอติดตามผล', color: '#A8B3AC' },
] as const;
export function outcomeOf(result: string): (typeof OUTCOMES)[number]['k'] {
  const r = result.replace(/\s+/g, '');
  if (/ส่งต่อ/.test(r)) return 'ส่งต่อ';
  if (/ไม่ดีขึ้น|แย่ลง|มากขึ้น|กำเริบ|หนักขึ้น/.test(r)) return 'แย่ลง';
  if (/หายดี|^หาย|หายขาด|หายแล้ว/.test(r)) return 'หาย';
  if (/ดีขึ้น|ทุเลา|ลดลง|บรรเทา|เบาลง/.test(r)) return 'ดีขึ้น';
  if (/ทรงตัว|เท่าเดิม|คงที่|เหมือนเดิม/.test(r)) return 'ทรงตัว';
  return 'รอติดตามผล';
}

type Row = { p: Patient; v: MB5Visit; d: Date };
const rowsIn = (patients: Patient[], from: Date, to: Date): Row[] => {
  const out: Row[] = [];
  patients.forEach((p) =>
    p.visits.forEach((v) => {
      const d = dateOf(v.date);
      if (d && d >= from && d < to) out.push({ p, v, d });
    }),
  );
  return out.sort((a, b) => a.d.getTime() - b.d.getTime());
};

function stats(patients: Patient[], from: Date, to: Date) {
  const rows = rowsIn(patients, from, to);
  const ids = new Set(rows.map((r) => r.p.id));
  const outcome = rows.map((r) => outcomeOf(clean(r.v.result)));
  const known = outcome.filter((o) => o !== 'รอติดตามผล');
  const better = known.filter((o) => o === 'หาย' || o === 'ดีขึ้น').length;
  const referrals = patients.reduce((n, p) => n + (p.referrals ?? []).filter((r) => r.at >= from.getTime() && r.at < to.getTime()).length, 0);
  return {
    rows,
    visits: rows.length,
    patients: ids.size,
    newPatients: new Set(rows.filter((r) => r.v.no === 1).map((r) => r.p.id)).size,
    better: known.length ? Math.round((better / known.length) * 100) : null,
    outcome,
    referrals,
    ps: patients.filter((p) => ids.has(p.id)),
  };
}

export type Report = ReturnType<typeof buildReport>;

export function buildReport(patients: Patient[], y: number, m: number, span: Span) {
  const from = new Date(y, m - span + 1, 1);
  const to = new Date(y, m + 1, 1);
  const cur = stats(patients, from, to);
  const prev = stats(patients, new Date(y, m - 2 * span + 1, 1), from);
  // แท่งกราฟ: 1 เดือน = สัปดาห์ (วันที่ 1–7, 8–14, …) · หลายเดือน = รายเดือน
  const bars =
    span === 1
      ? [0, 1, 2, 3, 4]
          .filter((w) => w * 7 + 1 <= new Date(y, m + 1, 0).getDate())
          .map((w) => ({ label: `สัปดาห์ ${w + 1}`, short: `ส.${w + 1}`, n: cur.rows.filter((r) => Math.floor((r.d.getDate() - 1) / 7) === w).length }))
      : Array.from({ length: span }, (_, i) => {
          const d = new Date(y, m - span + 1 + i, 1);
          return { label: TH_MONTHS[d.getMonth()], short: TH_MON[d.getMonth()], n: cur.rows.filter((r) => r.d.getFullYear() === d.getFullYear() && r.d.getMonth() === d.getMonth()).length };
        });
  const ps = cur.ps;
  return {
    y,
    m,
    span,
    label: periodLabel(y, m, span),
    visits: cur.visits,
    patients: cur.patients,
    newPatients: cur.newPatients,
    better: cur.better,
    referrals: cur.referrals,
    delta: { visits: cur.visits - prev.visits, patients: cur.patients - prev.patients, newPatients: cur.newPatients - prev.newPatients, better: cur.better != null && prev.better != null ? cur.better - prev.better : null },
    bars,
    outcomes: OUTCOMES.map((o) => ({ ...o, n: cur.outcome.filter((x) => x === o.k).length })).filter((o) => o.n),
    male: ps.filter((p) => p.sex === 'ชาย').length,
    female: ps.filter((p) => p.sex === 'หญิง').length,
    ages: [
      { label: 'เด็ก (<15)', n: ps.filter((p) => p.age < 15).length },
      { label: 'วัยทำงาน', n: ps.filter((p) => p.age >= 15 && p.age < 60).length },
      { label: 'ผู้สูงอายุ (60+)', n: ps.filter((p) => p.age >= 60).length },
    ],
    diagnoses: top(cur.rows.map((r) => clean(r.v.diagnosis) || clean(r.v.symptoms)).filter(Boolean).map((x) => x.split(/[·,(]/)[0].trim()), 6),
    herbs: top(cur.rows.flatMap((r) => herbsMentioned(r.v.treatment).map((h) => h.name)), 6),
    rows: cur.rows,
  };
}

const esc = (s: string | number) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function reportHtml(r: Report, dr: { name: string; types: string; cert?: string | null }) {
  const list = (xs: { name: string; n: number }[], unit: string) => (xs.length ? `<ol>${xs.map((x) => `<li>${esc(x.name)} — ${x.n} ${unit}</li>`).join('')}</ol>` : '<div class="muted">-</div>');
  const max = Math.max(1, ...r.bars.map((b) => b.n));
  const css = `@page{size:A4;margin:14mm 12mm}body{font-family:-apple-system,'Thonburi','Noto Sans Thai',sans-serif;color:#111;font-size:12.5px;line-height:1.5}h1{font-size:18px;text-align:center;margin:0}h2{font-size:13.5px;text-align:center;margin:2px 0 12px;font-weight:600}.muted{color:#888}.grid{display:flex;gap:10px;margin:10px 0}.k{flex:1;border:1px solid #333;border-radius:6px;padding:8px;text-align:center}.k b{display:block;font-size:20px}.two{display:flex;gap:16px}.two>div{flex:1}h3{font-size:13px;margin:12px 0 4px}table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border:1px solid #333;padding:4px 5px;font-size:11.5px;vertical-align:top}th{background:#eef3ef}ol{margin:2px 0 0 18px;padding:0}.bars{display:flex;align-items:flex-end;gap:8px;height:110px;border-bottom:1px solid #333;margin-top:6px}.bar{flex:1;text-align:center;font-size:10.5px}.bar div{background:#2E7D57;border-radius:3px 3px 0 0;margin:0 auto;width:70%}.sign{margin-top:28px;text-align:right}`;
  const body = `
    <h1>รายงานสรุปการให้บริการ</h1>
    <h2>${esc(r.label)} · ${esc(dr.name)}${dr.types ? ` (${esc(dr.types)})` : ''}${dr.cert ? ` · เลขที่หนังสือรับรอง ${esc(dr.cert)}` : ''}</h2>
    <div class="grid">
      <div class="k"><b>${r.visits}</b>ครั้งที่ให้การรักษา</div>
      <div class="k"><b>${r.patients}</b>ผู้ป่วย (ราย)</div>
      <div class="k"><b>${r.newPatients}</b>ผู้ป่วยใหม่</div>
      <div class="k"><b>${r.better != null ? `${r.better}%` : '-'}</b>หาย/ดีขึ้น</div>
      <div class="k"><b>${r.referrals}</b>ส่งต่อ</div>
    </div>
    <h3>จำนวนครั้งที่รักษา${r.span === 1 ? 'รายสัปดาห์' : 'รายเดือน'}</h3>
    <div class="bars">${r.bars.map((b) => `<div class="bar">${b.n}<div style="height:${Math.round((b.n / max) * 80)}px"></div>${esc(b.short)}</div>`).join('')}</div>
    <div class="two">
      <div><h3>ผลการรักษา</h3>${r.outcomes.length ? r.outcomes.map((o) => `${o.k} ${o.n} ครั้ง`).join(' · ') : '-'}<h3>เพศ · ช่วงอายุ</h3>ชาย ${r.male} · หญิง ${r.female}<br>${r.ages.map((a) => `${a.label} ${a.n}`).join(' · ')}</div>
      <div><h3>โรค/อาการที่พบบ่อย</h3>${list(r.diagnoses, 'ครั้ง')}<h3>สมุนไพรที่ใช้บ่อย</h3>${list(r.herbs, 'ครั้ง')}</div>
    </div>
    <h3>รายการให้การรักษา</h3>
    <table><tr><th>ว/ด/ป</th><th>ผู้ป่วย</th><th>อาการ/วินิจฉัย</th><th>การรักษา</th><th>ผล</th></tr>
    ${r.rows.map(({ p, v }) => `<tr><td>${esc(v.date)}</td><td>${esc(p.name)}</td><td>${esc(clean(v.diagnosis) || clean(v.symptoms) || '-')}</td><td>${esc(clean(v.treatment) || '-')}</td><td>${esc(clean(v.result) || '-')}</td></tr>`).join('') || '<tr><td colspan="5" class="muted" style="text-align:center">ไม่มีการรักษาในช่วงนี้</td></tr>'}
    </table>
    <div class="sign">ลงชื่อ ......................................................<br>(${esc(dr.name)})<br>${esc(dr.types || 'ผู้บันทึก')}</div>`;
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายงาน ${esc(r.label)}</title><style>${css}</style></head><body>${body}</body></html>`;
}
