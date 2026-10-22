/**
 * ดราฟต์ฟอร์ม — เก็บสิ่งที่กรอกไว้ในเครื่องอัตโนมัติขณะพิมพ์ (กดกลับ/ปิดแอปแล้วไม่หาย) · เปิดฟอร์มเดิมอีกครั้ง = กรอกต่อจากเดิม
 * แยกตามฟอร์ม เช่น visit.<รหัสผู้ป่วย> (บันทึกการรักษา) · patient.new (เพิ่มผู้ป่วย) · บันทึกสำเร็จแล้วลบดราฟต์
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const K = (key: string) => `suebsan.draft.${key}`;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export async function loadDraft<T>(key: string): Promise<{ data: T; at: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(K(key));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** บันทึกดราฟต์ (รวบการพิมพ์ต่อเนื่องเป็นครั้งเดียว) */
export function saveDraft(key: string, data: unknown) {
  const t = timers.get(key);
  if (t) clearTimeout(t);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      AsyncStorage.setItem(K(key), JSON.stringify({ data, at: Date.now() })).catch(() => {});
    }, 400),
  );
}

export function clearDraft(key: string) {
  const t = timers.get(key);
  if (t) clearTimeout(t);
  timers.delete(key);
  AsyncStorage.removeItem(K(key)).catch(() => {});
}

/** "10:32 น." หรือ "เมื่อวาน 10:32 น." */
export function draftWhen(at: number) {
  const d = new Date(at);
  const t = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / 86400000);
  return `${days === 0 ? '' : days === 1 ? 'เมื่อวาน ' : `${d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} `}${t} น.`;
}

/** ลบดราฟต์ทุกฟอร์ม — เรียกตอนออกจากระบบ (ข้อมูลผู้ป่วยที่กรอกค้างไว้ห้ามข้ามไปบัญชีถัดไปในเครื่องเดียวกัน) */
export async function clearAllDrafts() {
  timers.forEach((t) => clearTimeout(t));
  timers.clear();
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(K('')));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch {}
}
