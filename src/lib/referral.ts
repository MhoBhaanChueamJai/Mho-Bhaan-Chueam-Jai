/** ส่งต่อผู้ป่วย: วันที่/เวลาแบบไทย + พิมพ์หนังสือส่งต่อจากประวัติ */
import type { Patient, ReferralRecord } from '../data/mock';
import { Alert } from './alert';
import { outputPdf, referralHtml, type Doctor } from './printDocs';

export const thDate = (t: number) => new Date(t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
export const thTime = (t: number) => new Date(t).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

/** พิมพ์หนังสือส่งต่อของรายการนี้ (ใช้ข้อมูลการรักษาครั้งที่ส่งต่อ) */
export async function printReferral(p: Patient, r: ReferralRecord, dr: Doctor) {
  const v = p.visits.find((x) => x.no === r.visitNo) ?? p.visits[0];
  try {
    await outputPdf(referralHtml(p, v, { to: r.to, reason: r.reason, urgent: r.urgent, extra: r.extra, no: r.no }, dr), `ใบส่งต่อ ${p.name}`);
  } catch {
    Alert.alert('สร้างเอกสารไม่สำเร็จ', 'ลองใหม่อีกครั้ง');
  }
}
