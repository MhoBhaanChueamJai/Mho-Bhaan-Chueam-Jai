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
