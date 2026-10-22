import type { Patient } from '../data/mock';

/**
 * วันเกิด → อายุ และธาตุเจ้าเรือน (ตามเดือนเกิด แบบที่ใช้ทั่วไปในการแพทย์แผนไทย)
 *   ไฟ ม.ค.–มี.ค. · ลม เม.ย.–มิ.ย. · น้ำ ก.ค.–ก.ย. · ดิน ต.ค.–ธ.ค.
 * หมายเหตุ: ตำราดั้งเดิมนับตามเดือนจันทรคติ หมอปรับเองได้ในฟอร์ม
 */
export const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

export function elementFromMonth(m: number): Patient['element'] {
  if (m <= 3) return 'ไฟ';
  if (m <= 6) return 'ลม';
  if (m <= 9) return 'น้ำ';
  return 'ดิน';
}

/** วัน/เดือน/ปี พ.ศ. → ISO ค.ศ. (คืน null ถ้าไม่ครบหรือไม่ถูกต้อง) */
export function toISO(day: string, month: string, yearBE: string): string | null {
  const d = Number(day), m = Number(month), y = Number(yearBE) - 543;
  if (!d || !m || !Number(yearBE) || m > 12 || d > 31 || y < 1900 || y > new Date().getFullYear()) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getMonth() !== m - 1) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function ageFrom(iso: string, now = new Date()): number {
  const [y, m, d] = iso.split('-').map(Number);
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
  return Math.max(0, age);
}

/** ISO → "12 มีนาคม 2501" */
export const thaiBirth = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${TH_MONTHS[m - 1]} ${y + 543}`;
};

const MONTH_KEYS: [RegExp, number][] = [
  [/ม\.?ค\.?|มกรา/, 1], [/ก\.?พ\.?|กุมภา/, 2], [/มี\.?ค\.?|มีนา/, 3], [/เม\.?ย\.?|เมษา/, 4],
  [/พ\.?ค\.?|พฤษภา/, 5], [/มิ\.?ย\.?|มิถุนา/, 6], [/ก\.?ค\.?|กรกฎา/, 7], [/ส\.?ค\.?|สิงหา/, 8],
  [/ก\.?ย\.?|กันยา/, 9], [/ต\.?ค\.?|ตุลา/, 10], [/พ\.?ย\.?|พฤศจิกา/, 11], [/ธ\.?ค\.?|ธันวา/, 12],
  [/jan/i, 1], [/feb/i, 2], [/mar/i, 3], [/apr/i, 4], [/may/i, 5], [/jun/i, 6], [/jul/i, 7], [/aug/i, 8], [/sep/i, 9], [/oct/i, 10], [/nov/i, 11], [/dec/i, 12],
];

/** เดือนรูปแบบใดก็ได้ (เลข, ชื่อเต็ม, ตัวย่อ, อังกฤษ) → "1".."12" */
export function monthNum(v?: string): string {
  const t = String(v ?? '').trim();
  if (!t) return '';
  const n = Number(t.replace(/\D/g, ''));
  if (/^\d+$/.test(t) && n >= 1 && n <= 12) return String(n);
  // ลองชื่อยาวก่อน (กัน "มี.ค." ชนกับ "ม.ค.")
  const hit = [...MONTH_KEYS].sort((a, b) => b[0].source.length - a[0].source.length).find(([re]) => re.test(t));
  return hit ? String(hit[1]) : '';
}

/** ปีรูปแบบใดก็ได้ (พ.ศ./ค.ศ./2 หลัก) → พ.ศ. 4 หลัก */
export function yearBE(v?: string): string {
  const n = Number(String(v ?? '').replace(/\D/g, ''));
  if (!n) return '';
  if (n < 100) return String(2500 + n); // "42" → 2542
  if (n < 2300) return String(n + 543); // ค.ศ. → พ.ศ.
  return String(n);
}

/**
 * ทำวันเกิดจากผล AI ให้เป็น วัน/เดือนเลข/ปี พ.ศ. — รองรับกรณี AI ใส่วันที่ทั้งก้อนไว้ช่องเดียว
 * เช่น bDay="14 เมษายน 2542" หรือ bMonth="เมษายน" หรือ bYear="1999"
 */
export function normalizeBirth(d: { bDay?: string; bMonth?: string; bYear?: string }): { bDay: string; bMonth: string; bYear: string } {
  let day = String(d.bDay ?? '').trim();
  let month = monthNum(d.bMonth);
  let year = yearBE(d.bYear);
  const all = [d.bDay, d.bMonth, d.bYear].filter(Boolean).join(' ');
  if (!month) month = monthNum(all);
  const nums = all.match(/\d+/g) ?? [];
  if (!/^\d{1,2}$/.test(day)) day = nums.find((x) => Number(x) >= 1 && Number(x) <= 31 && x.length <= 2) ?? '';
  if (!year) year = yearBE(nums.find((x) => x.length === 4));
  return { bDay: day ? String(Number(day)) : '', bMonth: month, bYear: year };
}

/**
 * อายุที่ทราบ (ปี) — ไม่ได้กรอกอายุและวันเกิด แอปบันทึกอายุเป็น 0 → ถือว่า "ไม่ทราบ" (undefined) ไม่ใช่ 0 ขวบ
 * (มีวันเกิด = ทราบอายุจริง แม้เป็นเด็กอายุ 0 ปี)
 */
export const knownAge = (p: { age?: number | null; birthDate?: string | null }): number | undefined => ((p.age ?? 0) > 0 || p.birthDate ? (p.age ?? 0) : undefined);
/** "68 ปี" · ไม่ทราบ → "ไม่ระบุอายุ" */
export const ageLabel = (p: { age?: number | null; birthDate?: string | null }) => {
  const a = knownAge(p);
  return a == null ? 'ไม่ระบุอายุ' : `${a} ปี`;
};
