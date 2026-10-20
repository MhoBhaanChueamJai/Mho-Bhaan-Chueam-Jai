/**
 * กันเซิร์ฟเวอร์ AI ล่ม (เซิร์ฟเวอร์ของ BMS ใช้ร่วมกันหลายทีม)
 *  - แต่ละเครื่องส่งคำขอไปเซิร์ฟเวอร์เดียวกันได้พร้อมกันไม่เกิน 2 รายการ ที่เหลือรอคิว
 *  - เซิร์ฟเวอร์ตอบ 5xx / หมดเวลา / ต่อไม่ติด → พักส่งไปที่นั้น 30 วินาที (ไม่ยิงซ้ำตอนเซิร์ฟเวอร์กำลังมีปัญหา)
 *  - ไม่ลองส่งซ้ำอัตโนมัติ: ผู้ใช้กดถามใหม่เอง
 */
const LIMIT = 2;
const COOL_MS = 30_000;

type Lane = { active: number; waiting: (() => void)[]; coolUntil: number };
const lanes = new Map<string, Lane>();
const lane = (k: string) => {
  let l = lanes.get(k);
  if (!l) lanes.set(k, (l = { active: 0, waiting: [], coolUntil: 0 }));
  return l;
};

export class AiBusyError extends Error {
  constructor(key: string) {
    super(`AI ${key} cooling down`);
  }
}

/** เซิร์ฟเวอร์นี้กำลังพักอยู่ไหม (ใช้แสดงสถานะ / ตัดสินใจไม่ส่ง) */
export const isCooling = (key: string) => Date.now() < lane(key).coolUntil;

const serverTrouble = (e: unknown) => /\b5\d\d\b|Network request failed|Failed to fetch|abort|timeout|Load failed/i.test(String((e as Error)?.message ?? e) + String((e as Error)?.name ?? ''));

export async function guarded<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const l = lane(key);
  if (Date.now() < l.coolUntil) throw new AiBusyError(key);
  if (l.active >= LIMIT) await new Promise<void>((r) => l.waiting.push(r));
  // รอคิวอยู่แล้วเซิร์ฟเวอร์เพิ่งมีปัญหา → ไม่ส่งต่อ
  if (Date.now() < l.coolUntil) {
    l.waiting.shift()?.();
    throw new AiBusyError(key);
  }
  l.active++;
  try {
    return await fn();
  } catch (e) {
    if (serverTrouble(e)) l.coolUntil = Date.now() + COOL_MS;
    throw e;
  } finally {
    l.active--;
    l.waiting.shift()?.();
  }
}
