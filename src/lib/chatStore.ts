/**
 * ประวัติแชทครูปัญญา — เก็บในเครื่อง (AsyncStorage) หลายห้องแชท
 * แต่ละห้อง: ชื่อเรื่อง (จากคำถามแรก) · ข้อความ · เวลาแก้ไขล่าสุด · คุยด้วยเสียงหรือพิมพ์
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ChatSource = { id: string; title: string; kind?: 'wisdom' | 'herb' };
export type StoredMsg = { id: string; role: 'user' | 'assistant'; content: string; failed?: boolean; sources?: ChatSource[]; voice?: boolean; rating?: 1 | -1 };
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
    cache = Array.isArray(list) ? list.filter((t) => t && Array.isArray(t.msgs)) : [];
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

/** บันทึกห้องแชท (สร้างใหม่ถ้ายังไม่มี) — ห้องที่ยังไม่มีข้อความไม่ถูกเก็บ */
export async function saveThread(id: string, msgs: StoredMsg[]) {
  const list = await loadChats();
  const real = msgs.filter((m) => !m.failed);
  if (!real.length) return;
  const first = real.find((m) => m.role === 'user');
  const cur = list.find((t) => t.id === id);
  const next: ChatThread = {
    id,
    title: cur?.title || titleFrom(first?.content ?? ''),
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
