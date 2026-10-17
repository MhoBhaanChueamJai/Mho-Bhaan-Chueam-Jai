/**
 * สแกนหาสมุนไพรจากภาพ — ส่งภาพให้ครูปัญญา (Gemma + Qwen ดูภาพได้ทั้งคู่) ทายพร้อมกัน แล้วรวมคะแนน
 * คืนผล 3 อันดับ (พืชตระกูลขิง ข่า ไพล ขมิ้น ใบคล้ายกันมาก จึงให้ผู้ใช้กดสลับดูอันดับใกล้เคียงได้)
 * ถ้าตรงกับสมุนไพรในคลัง → ใช้ข้อมูลในคลัง (เชื่อถือได้) · ไม่ตรง → ใช้ข้อมูลที่ครูปัญญาให้ พร้อมคำเตือน
 */
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { ENDPOINTS, MODELS, type ModelKey } from '../api/ai';
import { herbs, type Herb } from '../data/herbs';

export type HerbGuess = {
  name: string;
  sci: string;
  confidence: number; // 0-100
  clues: string;
  herb?: Herb; // ตรงกับคลังสมุนไพร
  // ข้อมูลจากครูปัญญา (ใช้เมื่อไม่มีในคลัง)
  uses: string[];
  howto: string;
  caution: string;
  part: string;
  taste: string;
};
export type ScanResult = { isPlant: boolean; guesses: HerbGuess[]; tip: string };

const PROMPT = () => `คุณเป็นผู้เชี่ยวชาญพฤกษศาสตร์และสมุนไพรไทย ดูภาพนี้อย่างละเอียด (รูปใบ เส้นใบ ก้าน ลำต้น ดอก ผล เหง้า สีเนื้อเหง้า)
แล้วระบุพืชสมุนไพร 3 อันดับที่เป็นไปได้มากที่สุด เรียงจากมั่นใจมากไปน้อย
ถ้าตรงกับรายการนี้ให้ใช้ชื่อตามรายการ: ${herbs.map((h) => h.name).join(', ')} · ถ้าไม่ใช่ ให้ใช้ชื่อไทยที่ถูกต้อง
ระวังพืชตระกูลขิงที่ใบคล้ายกัน (ขิง ข่า ไพล ขมิ้นชัน กระชาย) ให้ดูสีและลักษณะเหง้าถ้าเห็น
ถ้าภาพไม่ใช่พืช ให้ isPlant=false
สำหรับอันดับ 1 ให้ข้อมูลตามหลักการแพทย์แผนไทยแบบสั้น ห้ามแต่งสรรพคุณที่ไม่มีหลักฐาน
ตอบ JSON เท่านั้น:
{"isPlant":true,"candidates":[{"name":"ชื่อไทย","sci":"ชื่อวิทยาศาสตร์","confidence":0,"clues":"ลักษณะในภาพที่ใช้ตัดสิน"}],"top":{"uses":["สรรพคุณ"],"howto":"วิธีใช้","caution":"ข้อควรระวัง","part":"ส่วนที่ใช้","taste":"รสยา"},"tip":"คำแนะนำการถ่ายภาพให้แม่นขึ้น (ถ้ามี)"}`;

async function askModel(model: ModelKey, b64: string): Promise<any> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 45_000);
  try {
    const res = await fetch(`${ENDPOINTS[model]}/v1/chat/completions`, {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODELS[model].id,
        max_tokens: 700,
        temperature: 0.1,
        chat_template_kwargs: { enable_thinking: false },
        messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT() }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }] }],
      }),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const text: string = (await res.json()).choices?.[0]?.message?.content ?? '';
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } finally {
    clearTimeout(t);
  }
}

const norm = (s: string) => s.replace(/\s+/g, '').replace(/^ต้น/, '');
/** จับคู่ชื่อกับคลัง: ตรงตัวก่อน (ชื่อ/ชื่อท้องถิ่น) แล้วค่อยแบบบางส่วนโดยเลือกชื่อที่ยาวที่สุด
 * (เดิมจับบางส่วนตัวแรกที่เจอ ทำให้ "มะขาม" → มะขามแขก, "พลู" → ช้าพลู, "ยอ" → พญายอ) */
const findHerb = (name: string) => {
  const n = norm(name);
  if (!n) return undefined;
  const exact = herbs.find((h) => norm(h.name) === n || h.local.split(/[,，]/).some((l) => l.trim() && norm(l) === n));
  if (exact) return exact;
  const part = herbs.filter((h) => n.includes(norm(h.name)) && norm(h.name).length >= 3).sort((a, b) => b.name.length - a.name.length);
  return part[0];
};

/** ภาพ (uri) → ผลสแกน 3 อันดับ */
export async function identifyHerb(uri: string): Promise<ScanResult> {
  // ย่อภาพก่อนส่ง (เร็วขึ้น ประหยัดเน็ต)
  const img = await manipulateAsync(uri, [{ resize: { width: 900 } }], { compress: 0.72, format: SaveFormat.JPEG, base64: true });
  const b64 = img.base64 ?? '';
  const [g, q] = await Promise.allSettled([askModel('gemma', b64), askModel('qwen', b64)]);
  const outs = [g, q].filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && !!r.value).map((r) => r.value);
  if (!outs.length) throw new Error('scan failed');

  // รวมคะแนน: ชื่อเดียวกันจากทั้งสองโมเดล → บวกกัน (สองโมเดลเห็นตรงกัน = มั่นใจขึ้น)
  const score = new Map<string, { name: string; sci: string; clues: string; sum: number; n: number }>();
  outs.forEach((o) =>
    (Array.isArray(o.candidates) ? o.candidates : []).slice(0, 3).forEach((c: any, rank: number) => {
      const name = String(c?.name ?? '').trim();
      if (!name) return;
      const key = findHerb(name)?.id ?? norm(name);
      // บางครั้งโมเดลตอบความมั่นใจเป็น 0–1 (เช่น 0.95) → แปลงเป็น 0–100
      let raw = Number(c?.confidence) || 0;
      if (raw > 0 && raw <= 1) raw *= 100;
      const conf = Math.max(0, Math.min(100, raw)) * (1 - rank * 0.15);
      const cur = score.get(key) ?? { name, sci: String(c?.sci ?? ''), clues: String(c?.clues ?? ''), sum: 0, n: 0 };
      cur.sum += conf;
      cur.n += 1;
      score.set(key, cur);
    }),
  );
  const ranked = [...score.values()].sort((a, b) => b.sum - a.sum).slice(0, 3);
  // ข้อมูลสรรพคุณ (top) ต้องมาจากโมเดลที่อันดับ 1 ของมันตรงกับอันดับ 1 ที่รวมแล้ว (กันเอาข้อมูลของอีกต้นมาใส่)
  const keyOf = (name: string) => findHerb(name)?.id ?? norm(name);
  const firstKey = ranked[0] ? keyOf(ranked[0].name) : '';
  const top = outs.find((o) => o.top && Array.isArray(o.candidates) && o.candidates[0] && keyOf(String(o.candidates[0].name ?? '')) === firstKey)?.top ?? {};
  const guesses: HerbGuess[] = ranked.map((r, i) => {
    const herb = findHerb(r.name);
    return {
      name: herb?.name ?? r.name,
      sci: herb?.sci ?? r.sci,
      confidence: Math.round(Math.min(99, r.sum / outs.length)),
      clues: r.clues,
      herb,
      uses: i === 0 && Array.isArray(top.uses) ? top.uses.map(String).slice(0, 5) : [],
      howto: i === 0 ? String(top.howto ?? '') : '',
      caution: i === 0 ? String(top.caution ?? '') : '',
      part: i === 0 ? String(top.part ?? '') : '',
      taste: i === 0 ? String(top.taste ?? '') : '',
    };
  });
  const isPlant = outs.some((o) => o.isPlant !== false) && guesses.length > 0;
  const tip = String(outs.find((o) => o.tip)?.tip ?? '');
  return { isPlant, guesses, tip };
}

/** ผลสแกนล่าสุด (ส่งต่อให้แผ่นผลลัพธ์ herb/found) */
let last: { photo: string; result: ScanResult } | null = null;
export const setLastScan = (photo: string, result: ScanResult) => {
  last = { photo, result };
};
export const getLastScan = () => last;
