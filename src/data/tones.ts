import { palette } from '../theme';
import type { Patient } from './mock';

export const statusTone: Record<Patient['status'], { fg: string; bg: string }> = {
  นัดวันนี้: { fg: palette.primary, bg: palette.primarySoft },
  ติดตามอาการ: { fg: '#B0761E', bg: palette.peach },
  หายดี: { fg: palette.green, bg: palette.lime },
  'ส่งต่อ รพ.สต.': { fg: palette.coral, bg: palette.coralSoft },
};

/** ชื่อสถานะที่แสดง — หมอพื้นบ้านไม่มีระบบนัด จึงแสดง "นัดวันนี้" เป็น "กำลังรักษา" */
export const statusLabel = (s: Patient['status']) => (s === 'นัดวันนี้' ? 'กำลังรักษา' : s);

/** วันที่ ว/ด/ป (พ.ศ.) → ค่าเรียงลำดับ */
export const visitSortKey = (d?: string) => {
  if (!d) return 0;
  const [dd, mm, yy] = d.split('/').map(Number);
  return yy * 10000 + mm * 100 + dd;
};
