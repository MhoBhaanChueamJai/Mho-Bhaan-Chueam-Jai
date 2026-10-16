/** แจ้งเตือนในแอป (คำนวณจากข้อมูลในเครื่อง): ผู้ป่วยที่ต้องติดตามอาการ · ส่งต่อ รพ.สต. · ภูมิปัญญารอตรวจทาน · ยังไม่ยืนยันตัวตน */
import type { Patient, Wisdom } from '../data/mock';
import { lastVisit } from '../data/mock';

export type Notice = { id: string; icon: string; color: string; title: string; body: string; go: string };

export function noticesFrom(patients: Patient[], wisdoms: Wisdom[], isPractitioner: boolean): Notice[] {
  const out: Notice[] = [];
  if (!isPractitioner)
    out.push({ id: 'verify', icon: 'person.badge.shield.checkmark.fill', color: '#C27A12', title: 'ยืนยันตัวตนหมอพื้นบ้าน', body: 'ยืนยันด้วยเลขที่หนังสือรับรอง เพื่อใช้งานการรักษาผู้ป่วย', go: '/verify' });
  patients
    .filter((p) => p.status === 'ติดตามอาการ')
    .forEach((p) => {
      const v = lastVisit(p);
      out.push({ id: `f-${p.id}`, icon: 'stethoscope', color: '#14905C', title: `ติดตามอาการ ${p.name}`, body: v ? `${v.diagnosis} · นัด ${v.followUp}` : 'รอติดตามอาการ', go: `/patient/${p.id}` });
    });
  patients
    .filter((p) => p.status === 'ส่งต่อ รพ.สต.')
    .forEach((p) => out.push({ id: `r-${p.id}`, icon: 'cross.case.fill', color: '#C2564B', title: `ส่งต่อ รพ.สต. · ${p.name}`, body: 'ติดตามผลการรักษาจาก รพ.สต.', go: `/patient/${p.id}` }));
  const pending = wisdoms.filter((w) => !w.verified);
  if (pending.length)
    out.push({ id: 'wisdom', icon: 'book.closed.fill', color: '#B07A2A', title: `ภูมิปัญญารอตรวจทาน ${pending.length} เรื่อง`, body: pending.slice(0, 2).map((w) => w.title).join(' · '), go: '/vault' });
  return out;
}
