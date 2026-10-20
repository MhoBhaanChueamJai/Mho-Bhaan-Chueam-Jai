/**
 * สรุปตอนเช้า (7 โมง) — "วันนี้มีนัดติดตาม 3 ราย · ยาใกล้หมดอายุ 1 รายการ"
 * แจ้งเตือนในเครื่องตั้งไว้ล่วงหน้า 7 วัน (คำนวณจากข้อมูลตอนนี้) · ตั้งใหม่ทุกครั้งที่ข้อมูลผู้ป่วย/คลังยาเปลี่ยน
 * วันที่ไม่มีอะไร = ไม่เตือน
 */
import { useEffect } from 'react';
import type { Patient } from '../data/mock';
import { cancelReminder, dayAt, isoIn, remindAt } from './reminders';
import { stockState, type StockItem } from './stock';

export function useMorningDigest(patients: Patient[], stock: StockItem[], ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      for (let i = 0; i < 7; i++) {
        const d = isoIn(i);
        const due = patients.filter((p) => p.status === 'ติดตามอาการ' && p.followUpOn && p.followUpOn <= d).length;
        const meds = stock.filter((s) => {
          if (!s.expiresOn) return false;
          const left = Math.round((Date.parse(s.expiresOn) - Date.parse(d)) / 86400000);
          return left >= 0 && left <= 7;
        }).length;
        const low = stock.filter((s) => ['low', 'out'].includes(stockState(s).k)).length;
        const parts = [due ? `นัดติดตามอาการ ${due} ราย` : '', meds ? `ยาใกล้หมดอายุ ${meds} รายการ` : '', low ? `ยาใกล้หมด ${low} รายการ` : ''].filter(Boolean);
        const id = `digest-${i}`;
        if (!parts.length) cancelReminder(id).catch(() => {});
        else remindAt(id, dayAt(d, 7), 'สรุปงานวันนี้', parts.join(' · '), due ? '/appointments' : '/stock').catch(() => {});
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [patients, stock, ready]);
}
