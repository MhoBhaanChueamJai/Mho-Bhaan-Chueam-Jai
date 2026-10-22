/**
 * ครูปัญญาแนะนำคำค้น — เดาว่าหมอกำลังจะค้นหาอะไร จากพฤติกรรมการใช้งาน
 * บริบทที่ใช้: คำที่เคยค้น, ผู้ป่วยที่เปิดดูบ่อย/ล่าสุด, นัดวันนี้, ผู้ป่วยที่ต้องติดตาม, ช่วงเวลาของวัน
 * ส่งให้ LLM เฉพาะชื่อ สถานะ และสรุปอาการ — ไม่ส่งเบอร์โทร/ที่อยู่
 * ถ้า AI ไม่ตอบ ใช้กฎจากพฤติกรรมเดียวกันแทน
 */
import { chatJSON } from '../api/ai';
import { TODAY, dayKey, lastVisit, type Patient } from '../data/mock';
import type { Agenda } from './cloud';
import type { OpenLog, SearchLog } from '../store/app';

export type Suggestion = { q: string; why: string; icon: 'clock' | 'person' | 'calendar' | 'sparkles' | 'stethoscope' };

const period = () => {
  const h = new Date().getHours();
  return h < 11 ? 'เช้า' : h < 16 ? 'บ่าย' : 'เย็น';
};
/** ชื่อสั้นสำหรับค้น (ตัดคำนำหน้า) */
const shortName = (name: string) => name.replace(/^(นางสาว|นาง|นาย)/, '').trim().split(' ')[0];

function topOpened(openLog: OpenLog, patients: Patient[], n = 3) {
  const count = new Map<string, number>();
  openLog.forEach((o) => count.set(o.pid, (count.get(o.pid) ?? 0) + 1));
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([pid, c]) => ({ p: patients.find((x) => x.id === pid), c }))
    .filter((x): x is { p: Patient; c: number } => !!x.p);
}

/** คำแนะนำจากกฎ (สำรอง / แสดงทันทีระหว่างรอ AI) */
export function ruleSuggestions(patients: Patient[], searchLog: SearchLog, openLog: OpenLog, agenda: Agenda): Suggestion[] {
  const out: Suggestion[] = [];
  const today = agenda[dayKey(TODAY)] ?? [];
  const next = today.find((a) => a.start >= `${String(new Date().getHours()).padStart(2, '0')}:00`) ?? today[0];
  if (next) {
    const p = patients.find((x) => x.id === next.pid);
    if (p) out.push({ q: shortName(p.name), why: `นัดถัดไปวันนี้ ${next.start} น.`, icon: 'calendar' });
  }
  topOpened(openLog, patients, 2).forEach(({ p, c }) => {
    if (!out.some((s) => s.q === shortName(p.name))) out.push({ q: shortName(p.name), why: `เปิดดูบ่อย ${c} ครั้ง`, icon: 'person' });
  });
  const follow = patients.find((p) => p.status === 'ติดตามอาการ' && !out.some((s) => s.q === shortName(p.name)));
  if (follow) out.push({ q: shortName(follow.name), why: 'ถึงเวลาติดตามอาการ', icon: 'stethoscope' });
  searchLog.slice(0, 2).forEach((s) => {
    if (!out.some((x) => x.q === s.q)) out.push({ q: s.q, why: 'ค้นหาล่าสุด', icon: 'clock' });
  });
  return out.slice(0, 5);
}

/** ให้ AI วิเคราะห์พฤติกรรมแล้วเสนอคำค้น */
export async function aiSuggestions(patients: Patient[], searchLog: SearchLog, openLog: OpenLog, agenda: Agenda): Promise<Suggestion[]> {
  const today = (agenda[dayKey(TODAY)] ?? []).map((a) => {
    const p = patients.find((x) => x.id === a.pid);
    return p ? `${a.start} ${shortName(p.name)} (${a.what})` : '';
  });
  const roster = patients.map((p) => `${shortName(p.name)} | ${p.status} | ${lastVisit(p)?.diagnosis ?? '-'}`);
  const opened = topOpened(openLog, patients, 5).map(({ p, c }) => `${shortName(p.name)} ×${c}`);
  const context = [
    `ช่วงเวลา: ${period()}`,
    `นัดวันนี้: ${today.filter(Boolean).join('; ') || 'ไม่มี'}`,
    `คำที่ค้นล่าสุด: ${searchLog.slice(0, 8).map((s) => s.q).join(', ') || 'ยังไม่มี'}`,
    `ผู้ป่วยที่เปิดดูบ่อย: ${opened.join(', ') || 'ยังไม่มี'}`,
    `รายชื่อผู้ป่วย (ชื่อ | สถานะ | วินิจฉัยล่าสุด):\n${roster.join('\n')}`,
  ].join('\n');

  const r = await chatJSON<{ suggestions: Suggestion[] }>([
    {
      role: 'system',
      content: 'คุณคือผู้ช่วยในแอปสุขภาพแผนไทย วิเคราะห์พฤติกรรมการใช้งานแล้วเดาว่าผู้ใช้กำลังจะค้นหาผู้ป่วยหรืออาการอะไรต่อ ตอบเป็น JSON เท่านั้น',
    },
    {
      role: 'user',
      content: `${context}\n\nเสนอคำค้น 4 ข้อที่หมอน่าจะค้นตอนนี้ เรียงจากน่าจะใช้มากสุด คำค้นต้องสั้น (ชื่อผู้ป่วยแบบไม่มีคำนำหน้า หรือ อาการ/โรค 1–3 คำ) ต้องค้นเจอในรายชื่อด้านบน ห้ามซ้ำ
เหตุผลไม่เกิน 6 คำ ภาษาไทย
{"suggestions":[{"q":"คำค้น","why":"เหตุผลสั้น","icon":"calendar|person|clock|stethoscope|sparkles"}]}`,
    },
  ]);
  const icons = ['clock', 'person', 'calendar', 'sparkles', 'stethoscope'];
  return (r.suggestions ?? [])
    .filter((s) => s?.q && typeof s.q === 'string')
    .map((s) => ({ q: s.q.trim().slice(0, 24), why: String(s.why ?? '').slice(0, 40), icon: (icons.includes(s.icon) ? s.icon : 'sparkles') as Suggestion['icon'] }))
    .slice(0, 5);
}
