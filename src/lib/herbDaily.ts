/**
 * สมุนไพรประจำวัน — เปลี่ยนตอนเที่ยงคืนเวลาไทย · เลือกตามฤดูตามหลักกินตามฤดูของแพทย์แผนไทย
 *   ฤดูร้อน (คิมหันตฤดู 16 ก.พ.–15 พ.ค.)  → รสขม รสเย็น
 *   ฤดูฝน  (วสันตฤดู 16 พ.ค.–15 ต.ค.)   → รสเผ็ดร้อน
 *   ฤดูหนาว (เหมันตฤดู 16 ต.ค.–15 ก.พ.) → รสเปรี้ยว
 * วันคู่หยิบตัวที่เหมาะกับฤดู วันคี่หยิบตัวอื่นในคลัง (ให้ได้ทบทวนครบทุกตัว)
 * เคล็ดลับประจำวัน: ครูปัญญาเขียนจากข้อมูลในคลังเท่านั้น จำไว้ทั้งวัน (AsyncStorage)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { chat } from '../api/ai';
import { herbs, type Herb, type Taste } from '../data/herbs';

export type Season = { key: 'hot' | 'rain' | 'cold'; name: string; pali: string; tastes: Taste[]; advice: string };
const SEASONS: Record<Season['key'], Season> = {
  hot: { key: 'hot', name: 'ฤดูร้อน', pali: 'คิมหันตฤดู', tastes: ['ขม', 'หอมเย็น'], advice: 'แนะนำรสขม รสเย็น' },
  rain: { key: 'rain', name: 'ฤดูฝน', pali: 'วสันตฤดู', tastes: ['เผ็ดร้อน'], advice: 'แนะนำรสเผ็ดร้อน' },
  cold: { key: 'cold', name: 'ฤดูหนาว', pali: 'เหมันตฤดู', tastes: ['เปรี้ยว'], advice: 'แนะนำรสเปรี้ยว' },
};

/** วันที่ตามเวลาไทย (UTC+7) */
export function thaiToday(now = new Date()) {
  const t = new Date(now.getTime() + 7 * 3600_000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), dayIndex: Math.floor(t.getTime() / 86_400_000) };
}

export function seasonOf(m: number, d: number): Season {
  const md = m * 100 + d;
  if (md >= 216 && md <= 515) return SEASONS.hot;
  if (md >= 516 && md <= 1015) return SEASONS.rain;
  return SEASONS.cold;
}

export type DailyPick = { herb: Herb; season: Season; fitsSeason: boolean; dateKey: string };

export function todayPick(now = new Date()): DailyPick {
  const { y, m, d, dayIndex } = thaiToday(now);
  const season = seasonOf(m, d);
  const fit = herbs.filter((h) => season.tastes.includes(h.taste));
  const rest = herbs.filter((h) => !season.tastes.includes(h.taste));
  const useFit = fit.length > 0 && (dayIndex % 2 === 0 || !rest.length);
  const pool = useFit ? fit : rest;
  const herb = pool[Math.floor(dayIndex / 2) % pool.length];
  return { herb, season, fitsSeason: season.tastes.includes(herb.taste), dateKey: `${y}-${m}-${d}` };
}

/** เคล็ดลับประจำวันจากครูปัญญา (จำไว้ทั้งวัน) — ล้มเหลวคืนค่าว่าง ให้หน้าจอใช้วิธีใช้จากคลังแทน */
export async function dailyTip(p: DailyPick): Promise<string> {
  const key = `herbtip:${p.dateKey}:${p.herb.id}`;
  try {
    const saved = await AsyncStorage.getItem(key);
    if (saved) return saved;
  } catch {}
  const h = p.herb;
  const text = await chat(
    [
      {
        role: 'user',
        content: `เขียน "เคล็ดลับวันนี้" เรื่อง${h.name} สำหรับหมอพื้นบ้าน 1-2 ประโยคสั้น ภาษาง่าย อบอุ่น ไม่ต้องทักทาย ไม่ใส่หัวข้อ ไม่ใส่สัญลักษณ์
ใช้เฉพาะข้อมูลนี้ ห้ามเพิ่มสรรพคุณหรือขนาดยาที่ไม่มีในข้อมูล:
รส${h.taste} ${h.element ? `ธาตุ${h.element}` : ''} · ส่วนที่ใช้: ${h.part}
สรรพคุณ: ${h.uses.join(', ')}
วิธีใช้: ${h.howto}
ข้อควรระวัง: ${h.caution}
ตอนนี้เป็น${p.season.name} (${p.season.advice})${p.fitsSeason ? ' ซึ่งรสของสมุนไพรนี้เหมาะกับฤดู ให้เชื่อมโยงสั้นๆ' : ''}`,
      },
    ],
    undefined,
    200,
  );
  const tip = text.replace(/^["“]|["”]$/g, '').trim();
  if (tip) AsyncStorage.setItem(key, tip).catch(() => {});
  return tip;
}
