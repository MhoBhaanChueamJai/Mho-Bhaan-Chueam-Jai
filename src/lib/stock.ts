/** คลังยาของหมอ: ยาที่ปรุงไว้ · จำนวนคงเหลือ · วันหมดอายุ (เตือนก่อนหมดอายุ 7 วัน) */
import { cancelReminder, dayAt, isoIn, remindAt, todayIso } from './reminders';
import { useItems } from './userStore';

export type StockItem = {
  id: string;
  name: string;
  form: string; // รูปแบบยา เช่น ยาลูกกลอน ยาผง
  qty: number;
  unit: string; // ห่อ ขวด ลูก กรัม
  lowAt?: number; // เหลือเท่านี้ = ใกล้หมด
  madeOn: string; // YYYY-MM-DD
  expiresOn?: string; // YYYY-MM-DD
  note?: string;
};

export const FORMS = ['ยาลูกกลอน', 'ยาผง', 'ยาแคปซูล', 'ยาต้ม', 'ยาดอง', 'ยาน้ำมัน', 'ลูกประคบ', 'อื่นๆ'];
export const UNITS = ['ห่อ', 'ขวด', 'กระปุก', 'ลูก', 'ซอง', 'กรัม'];

export const useStock = () => useItems<StockItem>('stock');

/** สถานะของยา: หมดอายุ / ใกล้หมดอายุ (≤30 วัน) / ใกล้หมด / ปกติ */
export function stockState(s: StockItem): { k: 'expired' | 'expiring' | 'low' | 'out' | 'ok'; label: string; days?: number } {
  const days = s.expiresOn ? Math.round((Date.parse(s.expiresOn) - Date.parse(todayIso())) / 86400000) : undefined;
  if (days != null && days < 0) return { k: 'expired', label: 'หมดอายุแล้ว', days };
  if (s.qty <= 0) return { k: 'out', label: 'หมดแล้ว', days };
  if (days != null && days <= 30) return { k: 'expiring', label: days === 0 ? 'หมดอายุวันนี้' : `หมดอายุใน ${days} วัน`, days };
  if (s.lowAt != null && s.qty <= s.lowAt) return { k: 'low', label: 'ใกล้หมด', days };
  return { k: 'ok', label: 'พร้อมใช้', days };
}

/** เตือน 9 โมงเช้า 7 วันก่อนหมดอายุ (ถ้าเหลือไม่ถึง 7 วัน เตือนพรุ่งนี้) */
export function remindExpiry(s: StockItem) {
  if (!s.expiresOn) return cancelReminder(`exp-${s.id}`);
  const before = dayAt(s.expiresOn, 9).getTime() - 7 * 86400000;
  const at = new Date(Math.max(before, dayAt(isoIn(1), 9).getTime()));
  if (at.getTime() > dayAt(s.expiresOn, 9).getTime()) return cancelReminder(`exp-${s.id}`);
  return remindAt(`exp-${s.id}`, at, `${s.name} ใกล้หมดอายุ`, `หมดอายุวันที่ ${dayAt(s.expiresOn, 12).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} · เหลือ ${s.qty} ${s.unit}`, '/stock');
}
