/**
 * แชร์ตำรา/ภูมิปัญญาให้เพื่อนหมอ — สร้างรหัสแชร์ (Supabase: wisdom_shares) แล้วส่งผ่าน LINE/ข้อความ
 * เพื่อนเปิดลิงก์ หรือกรอกรหัสในหน้า "รับตำราจากเพื่อน" → ดูตัวอย่าง → เก็บเข้าคลังของตัวเอง
 */
import { Share } from 'react-native';
import type { Wisdom } from '../data/mock';
import { supabase } from './supabase';

/** ตัวอักษรที่อ่าน/พูดไม่สับสน (ไม่มี 0 O 1 I L) */
const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 8 }, () => ABC[Math.floor(Math.random() * ABC.length)]).join('');
/** แสดงรหัสเป็น ABCD-EFGH ให้อ่านง่าย */
export const prettyCode = (c: string) => `${c.slice(0, 4)}-${c.slice(4)}`;
export const cleanCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');

const WEB = 'https://mhobhaanchueamjai.github.io/Mho-Bhaan-Chueam-Jai';

/** ส่วนของตำราที่แชร์ (ไม่ส่ง id / สถานะตรวจทานของเรา) */
export type SharedWisdom = Pick<Wisdom, 'title' | 'kind' | 'summary' | 'ingredients' | 'method' | 'indication' | 'caution'>;
export type ReceivedShare = { fromName: string; wisdom: SharedWisdom; createdAt: string };

export async function createShare(w: Wisdom, fromName: string): Promise<string> {
  const payload: SharedWisdom = { title: w.title, kind: w.kind, summary: w.summary, ingredients: w.ingredients, method: w.method, indication: w.indication, caution: w.caution };
  // รหัสชนกันได้ยากมาก แต่ลองใหม่ไม่เกิน 3 ครั้งถ้าซ้ำ
  for (let i = 0; i < 3; i++) {
    const code = newCode();
    const { error } = await supabase.from('wisdom_shares').insert({ code, from_name: fromName, payload, wisdom_id: w.id });
    if (!error) return code;
    if (error.code !== '23505') throw error;
  }
  throw new Error('สร้างรหัสแชร์ไม่สำเร็จ');
}

// ผลที่เพิ่งอ่านรหัสได้ (หน้าแผ่นล่างใช้ต่อได้ทันทีไม่ต้องโหลดซ้ำ)
const recent = new Map<string, ReceivedShare>();
export const cachedShare = (code: string) => recent.get(cleanCode(code)) ?? null;

export async function fetchShare(code: string): Promise<ReceivedShare | null> {
  const { data, error } = await supabase.rpc('get_wisdom_share', { p_code: cleanCode(code) });
  if (error) throw error;
  const r = Array.isArray(data) ? data[0] : data;
  if (!r?.payload) return null;
  const got = { fromName: r.from_name ?? 'เพื่อนหมอ', wisdom: r.payload as SharedWisdom, createdAt: r.created_at };
  recent.set(cleanCode(code), got);
  return got;
}

/** สร้างรหัส แล้วเปิดเมนูแชร์ของระบบ (LINE, ข้อความ, AirDrop ฯลฯ) */
export async function shareWisdom(w: Wisdom, fromName: string) {
  const code = await createShare(w, fromName);
  const pretty = prettyCode(code);
  await Share.share({
    message: `📜 ${fromName} แชร์ตำรา "${w.title}" ให้คุณ\n\nเปิดแอปหมอบ้านเชื่อมใจ → คลังภูมิ → รับตำราจากเพื่อน แล้วกรอกรหัส\n${pretty}\n\nหรือเปิดลิงก์: ${WEB}/wisdom/receive?code=${code}\n(รหัสใช้ได้ 30 วัน)`,
  });
  return code;
}

/** ข้อความใน QR: ลิงก์เปิดแอปพร้อมรหัส (สแกนด้วยกล้องในแอป หรือกล้องมือถือก็ได้) */
export const qrPayload = (code: string) => `suebsan://wisdom/receive?code=${code}`;
/** อ่านรหัสจากข้อความที่สแกนได้ (ลิงก์ หรือรหัสเปล่า) */
export function codeFromScan(data: string): string | null {
  const m = data.match(/[?&]code=([A-Za-z0-9-]+)/);
  const c = cleanCode(m ? m[1] : data);
  return c.length === 8 ? c : null;
}
/** แชร์ต่อผ่านแอปอื่น (LINE ฯลฯ) ด้วยรหัสที่สร้างแล้ว */
export async function shareCodeText(title: string, fromName: string, code: string) {
  await Share.share({
    message: `📜 ${fromName} แชร์ตำรา "${title}" ให้คุณ\n\nเปิดแอปหมอบ้านเชื่อมใจ → คลังภูมิ → สแกนรับตำรา หรือกรอกรหัส\n${prettyCode(code)}\n\nหรือเปิดลิงก์: ${WEB}/wisdom/receive?code=${code}\n(รหัสใช้ได้ 30 วัน)`,
  });
}

/** เนื้อหาล่าสุดของต้นฉบับที่เพื่อนแชร์มา (null = ต้นฉบับถูกลบ / ยังไม่รองรับ) */
export async function fetchLatestShared(code: string): Promise<SharedWisdom | null> {
  const { data, error } = await supabase.rpc('get_shared_wisdom', { p_code: cleanCode(code) });
  if (error) return null;
  const r = Array.isArray(data) ? data[0] : data;
  if (!r?.title) return null;
  return { title: r.title, kind: r.kind, summary: r.summary ?? '', ingredients: r.ingredients ?? undefined, method: r.method ?? undefined, indication: r.indication ?? undefined, caution: r.caution ?? undefined };
}

/** อัปเดตสำเนาที่ได้รับจากเพื่อน ให้ตรงกับต้นฉบับล่าสุด (เฉพาะช่องที่เปลี่ยน) */
export async function syncShared(list: Wisdom[], update: (id: string, patch: Partial<Wisdom>) => void) {
  await Promise.all(
    list
      .filter((w) => w.shareCode)
      .map(async (w) => {
        const r = await fetchLatestShared(w.shareCode!);
        if (!r) return;
        const patch: Partial<Wisdom> = {};
        (Object.keys(r) as (keyof SharedWisdom)[]).forEach((k) => {
          if (JSON.stringify(r[k] ?? null) !== JSON.stringify(w[k] ?? null)) (patch as any)[k] = r[k];
        });
        if (Object.keys(patch).length) update(w.id, patch);
      }),
  );
}
