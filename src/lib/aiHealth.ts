/**
 * สถานะเซิร์ฟเวอร์ AI (ครูปัญญา) — เช็คก่อนใช้ เพื่อบอกผู้ใช้ทันทีว่าใช้ไม่ได้ชั่วคราว แทนการรอแล้วค่อยขึ้น error
 * ใช้ได้ = อย่างน้อยหนึ่งโมเดล (Gemma / Qwen) ตอบ · เก็บผลไว้ 45 วินาที
 */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { ENDPOINTS } from '../api/ai';

let cache: { ok: boolean; at: number } | null = null;
let inflight: Promise<boolean> | null = null;
const subs = new Set<(ok: boolean) => void>();

const ping = async (base: string) => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(`${base}/v1/models`, { signal: ctl.signal });
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
};

export function checkAi(force = false): Promise<boolean> {
  if (!force && cache && Date.now() - cache.at < 45_000) return Promise.resolve(cache.ok);
  if (inflight) return inflight;
  inflight = Promise.all([ping(ENDPOINTS.gemma), ping(ENDPOINTS.qwen)])
    .then(([g, q]) => {
      const ok = g || q;
      cache = { ok, at: Date.now() };
      subs.forEach((f) => f(ok));
      return ok;
    })
    .finally(() => (inflight = null));
  return inflight;
}

/** true = ใช้ได้ · false = ล่ม · null = กำลังเช็ค (ล่ม → เช็คซ้ำทุก 20 วินาที จนกลับมา) */
export function useAiStatus() {
  const [ok, setOk] = useState<boolean | null>(cache?.ok ?? null);
  useEffect(() => {
    subs.add(setOk);
    checkAi().catch(() => {});
    const t = setInterval(() => cache?.ok === false && checkAi(true).catch(() => {}), 20_000);
    const a = AppState.addEventListener('change', (s) => s === 'active' && checkAi(true).catch(() => {}));
    return () => {
      subs.delete(setOk);
      clearInterval(t);
      a.remove();
    };
  }, []);
  return ok;
}

export const AI_DOWN_MSG = 'ครูปัญญาไม่พร้อมใช้งานชั่วคราว (เซิร์ฟเวอร์ AI ขัดข้อง) ส่วนอื่นของแอปใช้ได้ตามปกติ';
