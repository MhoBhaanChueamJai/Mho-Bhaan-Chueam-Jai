/**
 * ประวัติแชทครูปัญญา — เก็บในเครื่อง (AsyncStorage) หลายห้องแชท
 * แต่ละห้อง: ชื่อเรื่อง (จากคำถามแรก) · ข้อความ · เวลาแก้ไขล่าสุด · คุยด้วยเสียงหรือพิมพ์
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TreatmentPlan } from './plan';

export type ChatSource = { id: string; title: string; kind?: 'wisdom' | 'herb' | 'doc' };
export type StoredMsg = { id: string; role: 'user' | 'assistant'; content: string; failed?: boolean; sources?: ChatSource[]; voice?: boolean; rating?: 1 | -1; /** คำถามเรื่องอาการ → เสนอปุ่มให้ครูปัญญาซักประวัติต่อในแชทนี้ */ consult?: string;
  /** ปรึกษาอาการในแชท: ตัวเลือกคำตอบ · สัญญาณอันตราย · แนวทางรักษา */
  options?: string[];
  urgent?: string[];
  plan?: TreatmentPlan;
  /** ครูปัญญาถามกลับ (ตัวเลือกให้แตะ) · คำถามต่อที่แนะนำ */
  askOpts?: string[];
  follow?: string[];
  /** ถาม-ตอบในแชท: รายการคำถามที่พบบ่อย · ตัวเลือกแบบทดสอบ · จบแบบทดสอบ */
  faq?: boolean;
  quiz?: string[];
  quizEnd?: boolean;
};
export type ChatThread = { id: string; title: string; updatedAt: number; msgs: StoredMsg[] };

const KEY = 'kru.chats.v1';
const MAX_THREADS = 60;
const MAX_MSGS = 120;

let cache: ChatThread[] | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function onChatsChange(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export async function loadChats(): Promise<ChatThread[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as ChatThread[]) : [];
    cache = Array.isArray(list) ? list.filter((t) => t && Array.isArray(t.msgs)).map((t) => (t.title === 'แชทใหม่' ? { ...t, title: threadTitle(t.msgs) } : t)) : [];
  } catch {
    cache = [];
  }
  return cache;
}

async function persist() {
  if (!cache) return;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch {}
  emit();
}

/** ชื่อห้องแชท: คำถามแรก ตัดให้สั้น */
export function titleFrom(text: string) {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 42 ? `${t.slice(0, 40)}…` : t || 'แชทใหม่';
}

/** ชื่อห้อง: คำถามแรก · แบบทดสอบ / ปรึกษาอาการ ตั้งชื่อตามประเภท (ห้องที่เริ่มจากปุ่มเคยได้ชื่อ "แชทใหม่" ค้าง) */
function threadTitle(msgs: StoredMsg[]) {
  const real = msgs.filter((m) => !m.failed);
  const first = real.find((m) => m.role === 'user');
  if (real.some((m) => m.quiz)) return 'แบบทดสอบความรู้';
  if (real[0]?.options && first) return `ปรึกษาอาการ: ${titleFrom(first.content)}`;
  if (real[0]?.faq && !first) return 'คำถามที่พบบ่อย';
  return titleFrom(first?.content ?? '');
}

/** บันทึกห้องแชท (สร้างใหม่ถ้ายังไม่มี) — ห้องที่ยังไม่มีข้อความไม่ถูกเก็บ */
export async function saveThread(id: string, msgs: StoredMsg[]) {
  const list = await loadChats();
  const real = msgs.filter((m) => !m.failed);
  if (!real.length) return;
  const cur = list.find((t) => t.id === id);
  const next: ChatThread = {
    id,
    title: cur?.title && cur.title !== 'แชทใหม่' ? cur.title : threadTitle(real),
    updatedAt: Date.now(),
    msgs: msgs.slice(-MAX_MSGS),
  };
  cache = [next, ...list.filter((t) => t.id !== id)].slice(0, MAX_THREADS);
  await persist();
}

export async function getThread(id: string) {
  return (await loadChats()).find((t) => t.id === id) ?? null;
}

export async function deleteThread(id: string) {
  cache = (await loadChats()).filter((t) => t.id !== id);
  await persist();
}

export async function clearChats() {
  cache = [];
  await persist();
}

export const newThreadId = () => `c${Date.now()}`;

/** ป้ายเวลาแบบสั้น: วันนี้ 14:05 · เมื่อวาน · 12 ต.ค. */
export function whenLabel(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return `วันนี้ ${hm}`;
  if (diff === 1) return `เมื่อวาน ${hm}`;
  const MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${d.getDate()} ${MON[d.getMonth()]}`;
}
