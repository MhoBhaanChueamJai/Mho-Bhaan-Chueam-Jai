/** แจ้งเตือนในแอป (คำนวณจากข้อมูลในเครื่อง): ผู้ป่วยที่ต้องติดตามอาการ · ส่งต่อ รพ.สต. · ภูมิปัญญารอตรวจทาน · ยังไม่ยืนยันตัวตน */
import type { Patient, Wisdom } from '../data/mock';
import { lastVisit } from '../data/mock';
import type { Announcement } from './announcements';

/** ประเภท (ใช้กับ chip กรองในหน้าแจ้งเตือน) */
export type NoticeGroup = 'patient' | 'wisdom' | 'update' | 'account';
export const GROUPS: { key: NoticeGroup; label: string; color: string }[] = [
  { key: 'patient', label: 'ผู้ป่วย', color: '#14905C' },
  { key: 'wisdom', label: 'ภูมิปัญญา', color: '#8A5E30' },
  { key: 'update', label: 'อัปเดต', color: '#2F7BE0' },
  { key: 'account', label: 'บัญชี', color: '#E0861A' },
];

export type Notice = {
  id: string;
  group: NoticeGroup;
  icon: string;
  /** สีไล่ของไอคอน (บน → ล่าง) */
  colors: readonly [string, string];
  /** หมวด (แสดงหัวการ์ดแบบชื่อแอปใน Notification Center) */
  cat: string;
  title: string;
  body: string;
  /** เวลาแบบสัมพัทธ์ เช่น "4 วันที่แล้ว" */
  when?: string;
  at: number;
  go: string;
};

/** "14/10/2569" (พ.ศ.) → เวลา ms */
function parseThai(d?: string) {
  const m = d?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return 0;
  return new Date(+m[3] - 543, +m[2] - 1, +m[1]).getTime();
}

export function ago(at: number, precise = false) {
  if (!at) return undefined;
  if (precise) {
    const min = Math.floor((Date.now() - at) / 60000);
    if (min < 1) return 'เมื่อสักครู่';
    if (min < 60) return `${min} นาทีที่แล้ว`;
    if (min < 24 * 60) return `${Math.floor(min / 60)} ชม.ที่แล้ว`;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - at) / 86400000);
  if (days <= 0) return 'วันนี้';
  if (days === 1) return 'เมื่อวาน';
  if (days < 7) return `${days} วันที่แล้ว`;
  if (days < 30) return `${Math.floor(days / 7)} สัปดาห์ที่แล้ว`;
  return new Date(at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

/** รวมข้อความที่มีเนื้อหาจริง (ข้ามช่องว่าง/ขีด) */
const join = (...parts: (string | undefined)[]) => parts.map((x) => x?.trim()).filter((x) => x && !/^[-–·\s]+$/.test(x)).join(' · ');

/** ประกาศจากทางระบบ: ไอคอน · สี · หมวด · หน้าที่เปิดเมื่อไม่ได้ระบุ */
const KIND: Record<Announcement['kind'], { icon: string; colors: readonly [string, string]; cat: string; go: string }> = {
  system: { icon: 'arrow.down.app.fill', colors: ['#6AB8FF', '#2F7BE0'], cat: 'อัปเดตระบบ', go: '/about' },
  herb: { icon: 'leaf.fill', colors: ['#8AD45E', '#3E8E2E'], cat: 'สมุนไพรใหม่', go: '/herbs' },
  wisdom: { icon: 'books.vertical.fill', colors: ['#B48BF5', '#7A4FD0'], cat: 'คลังภูมิปัญญา', go: '/vault' },
  content: { icon: 'sparkles', colors: ['#FFC25A', '#E0861A'], cat: 'เนื้อหาใหม่', go: '/home' },
};

export function noticesFrom(patients: Patient[], wisdoms: Wisdom[], isPractitioner: boolean, ann: Announcement[] = []): Notice[] {
  const out: Notice[] = [];
  if (!isPractitioner)
    out.push({ id: 'verify', group: 'account', icon: 'person.badge.shield.checkmark.fill', colors: ['#FFC25A', '#E0861A'], cat: 'บัญชี', title: 'ยืนยันตัวตนหมอพื้นบ้าน', body: 'ยืนยันด้วยเลขที่หนังสือรับรอง เพื่อใช้งานการรักษาผู้ป่วย', at: Infinity, go: '/verify' });
  const care: Notice[] = [];
  patients.forEach((p) => {
    const v = lastVisit(p);
    const at = parseThai(v?.date);
    if (p.status === 'ติดตามอาการ')
      care.push({ id: `f-${p.id}-${v?.no ?? 0}`, group: 'patient', icon: 'stethoscope', colors: ['#3FD089', '#14905C'], cat: 'ติดตามอาการ', title: p.name, body: join(v?.diagnosis, v?.followUp) || 'รอติดตามอาการ', when: ago(at), at, go: `/patient/${p.id}` });
    else if (p.status === 'ส่งต่อ รพ.สต.')
      care.push({ id: `r-${p.id}-${v?.no ?? 0}`, group: 'patient', icon: 'cross.case.fill', colors: ['#FF8A7A', '#D2453A'], cat: 'ส่งต่อ รพ.สต.', title: p.name, body: join(v?.diagnosis, 'ติดตามผลการรักษาจาก รพ.สต.'), when: ago(at), at, go: `/patient/${p.id}` });
  });
  ann.forEach((a) => {
    const k = KIND[a.kind] ?? KIND.content;
    const at = new Date(a.created_at).getTime() || 0;
    care.push({ id: `a-${a.id}`, group: a.kind === 'wisdom' ? 'wisdom' : 'update', icon: k.icon, colors: k.colors, cat: k.cat, title: a.title, body: a.body, when: ago(at, true), at, go: a.go || k.go });
  });
  out.push(...care.sort((a, b) => b.at - a.at));
  const pending = wisdoms.filter((w) => !w.verified);
  if (pending.length)
    out.push({ id: `wisdom-${pending.length}`, group: 'wisdom', icon: 'book.closed.fill', colors: ['#D2A36E', '#8A5E30'], cat: 'คลังภูมิปัญญา', title: `รอคุณหมอตรวจทาน ${pending.length} เรื่อง`, body: pending.slice(0, 2).map((w) => w.title).join(' · '), at: 0, go: pending.length === 1 ? `/wisdom/${pending[0].id}` : '/vault' });
  return out;
}
