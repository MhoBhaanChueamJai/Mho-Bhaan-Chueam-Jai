/**
 * ครูปัญญาช่วยบันทึกภูมิปัญญาด้วยเสียง — ตรรกะการสนทนา (แบบเดียวกับบันทึกการรักษา)
 * ถามทีละเรื่อง: ชื่อตำรับ/เรื่อง → ประเภท → ตัวยา → วิธีทำ/วิธีใช้ → สรรพคุณ → ข้อห้าม → ได้รับสืบทอดจากใคร
 */
import { chatJSON } from '../api/ai';
import { dialectHint, dialectSpeakStyle } from './dialect';
import type { Wisdom } from '../data/mock';
import type { Turn } from './intake';

export type WisdomData = {
  title?: string;
  kind?: string;
  ingredients?: string; // คั่นด้วยจุลภาค
  method?: string;
  indication?: string;
  caution?: string;
  origin?: string; // ได้รับสืบทอดจากใคร
};

export const KINDS: Wisdom['kind'][] = ['ตำรับยา', 'วิธีรักษา', 'คาถา/พิธี', 'ตำราโบราณ'];

export const WISDOM_TOPICS: { key: keyof WisdomData; label: string; ask: string }[] = [
  { key: 'title', label: 'ชื่อเรื่อง', ask: 'วันนี้จะบันทึกภูมิปัญญาเรื่องอะไรครับ เช่น ยาต้มแก้ลมจับโปง ยาประคบแก้ปวดเมื่อย การนวดแก้ปวดหลัง' },
  { key: 'kind', label: 'ประเภท', ask: 'เป็นภูมิปัญญาประเภทไหนครับ ตำรับยา วิธีรักษา คาถาหรือพิธี หรือตำราโบราณ' },
  { key: 'ingredients', label: 'ตัวยา', ask: 'ใช้ตัวยาหรือสมุนไพรอะไรบ้างครับ เช่น เถาวัลย์เปรียง ไพล ขมิ้นชัน อย่างละเท่าไหร่' },
  { key: 'method', label: 'วิธีทำ', ask: 'ปรุงหรือทำอย่างไรครับ แล้วใช้อย่างไร เช่น ต้มสามเอาหนึ่ง กินเช้าเย็นครั้งละครึ่งแก้ว' },
  { key: 'indication', label: 'สรรพคุณ', ask: 'ใช้แก้อาการหรือโรคอะไรครับ เช่น ปวดเข่า ปวดเมื่อย ท้องอืด ไข้ตัวร้อน' },
  { key: 'caution', label: 'ข้อห้าม', ask: 'มีข้อห้ามหรือข้อควรระวังไหมครับ เช่น ห้ามใช้ในคนท้อง ไม่ควรกินนานเกิน 7 วัน' },
  { key: 'origin', label: 'ที่มา', ask: 'ภูมิปัญญานี้ได้รับสืบทอดมาจากใครครับ เช่น พ่อ ปู่ ครูบาอาจารย์ หรือตำราของวัด' },
];

export const WISDOM_OPTIONS: Record<keyof WisdomData, string[]> = {
  title: ['ยาต้มแก้ปวดเมื่อย', 'ยาประคบสมุนไพร', 'ยาแก้ไข้', 'ยาแก้ท้องอืด', 'การนวดแก้ปวดหลัง', 'ยาหม้อบำรุงเลือด'],
  kind: [...KINDS],
  ingredients: ['เถาวัลย์เปรียง', 'ไพล', 'ขมิ้นชัน', 'ฟ้าทะลายโจร', 'บอระเพ็ด', 'ขิง', 'ตะไคร้', 'ใบมะขาม', 'การบูร'],
  method: ['ต้มสามเอาหนึ่ง', 'ตำห่อผ้าประคบ', 'บดปั้นลูกกลอน', 'ดองเหล้า', 'ฝนกับน้ำ', 'นึ่งให้ร้อน', 'กินเช้าเย็น'],
  indication: ['ปวดเมื่อย', 'ปวดเข่า', 'ปวดหลัง', 'ไข้ตัวร้อน', 'ท้องอืด', 'บำรุงเลือด', 'นอนไม่หลับ'],
  caution: ['ห้ามใช้ในคนท้อง', 'ไม่ควรกินนานเกิน 7 วัน', 'ระวังในคนเป็นโรคตับ/ไต', 'ห้ามใช้กับแผลเปิด', 'ไม่มีข้อห้าม'],
  origin: ['สืบทอดจากพ่อ', 'สืบทอดจากปู่', 'ครูบาอาจารย์', 'ตำราของวัด', 'คิดค้นเอง'],
};

export const wisdomHas = (d: WisdomData, key: string) => !!String((d as any)[key] ?? '').trim();

export const wisdomOpening = () => `สวัสดีครับ มาบันทึกภูมิปัญญาของคุณหมอเก็บไว้ให้ลูกหลานกันนะครับ ${WISDOM_TOPICS[0].ask}`;

const mergeOpts = (a: string[], b: string[]) => {
  const out: string[] = [];
  [...a, ...b].forEach((x) => {
    if (x && !out.some((y) => y.replace(/\s/g, '') === x.replace(/\s/g, ''))) out.push(x);
  });
  return out.slice(0, 10);
};
const nextOptions = (d: WisdomData) => {
  const t = WISDOM_TOPICS.find((x) => !wisdomHas(d, x.key));
  return t ? WISDOM_OPTIONS[t.key] : [];
};
const asKind = (k?: string) => KINDS.find((x) => k?.includes(x.split('/')[0])) ?? undefined;

const clean = (r: Record<string, unknown> | undefined, base: WisdomData = {}): WisdomData => {
  const out: WisdomData = { ...base };
  Object.entries(r ?? {}).forEach(([k, v]) => {
    const s = (Array.isArray(v) ? v.join(', ') : String(v ?? '')).trim();
    if (s) (out as any)[k] = s;
  });
  if (out.kind) out.kind = asKind(out.kind) ?? out.kind;
  return out;
};

/** หนึ่งรอบการสนทนา */
export async function wisdomTurn(known: WisdomData, history: Turn[], answer: string): Promise<{ data: WisdomData; reply: string; done: boolean; options: string[] }> {
  const asked = history.filter((h) => h.role === 'ai').length;
  try {
    const r = await chatJSON<{ fields?: Record<string, unknown>; reply?: string; done?: boolean; options?: string[] }>([
      {
        role: 'user',
        content: `คุณคือ "ครูปัญญา" ผู้ช่วยหมอพื้นบ้าน ผู้ชายวัย 45 อบอุ่น ให้เกียรติภูมิปัญญาของหมอ พูดภาษาพูดเป็นธรรมชาติ ลงท้าย "ครับ"
กำลังช่วยหมอบันทึกภูมิปัญญา (ตำรับยา วิธีรักษา คาถา/พิธี ตำราโบราณ) ด้วยเสียง เพื่อเก็บไว้สืบทอด
ข้อมูลที่รู้แล้ว: ${JSON.stringify(known)}
บทสนทนาล่าสุด:
${history.slice(-6).map((h) => `${h.role === 'ai' ? 'ครูปัญญา' : 'หมอ'}: ${h.text}`).join('\n')}
หมอเพิ่งตอบว่า: "${answer}"

${dialectHint()}
หมออาจพูดภาษาถิ่น และข้อความมาจากการถอดเสียง ให้ตีความจากบริบท แล้วบันทึกเป็นภาษาไทยกลาง ชื่อสมุนไพรให้สะกดตามชื่อมาตรฐาน
งาน:
1) แยกข้อมูลลงช่อง (ห้ามเดา ช่องที่ไม่ได้พูดถึงไม่ต้องใส่) ถ้าหมอแก้ข้อมูลเดิม ให้แทนที่ช่องนั้น
   kind ต้องเป็นหนึ่งใน: ${KINDS.join(' | ')} (ถ้าบอกตัวยาและวิธีปรุง อนุมานว่า "ตำรับยา" ได้)
   ingredients เป็นรายการตัวยาคั่นด้วยจุลภาค พร้อมปริมาณถ้าบอก
2) คิดคำพูดถัดไป: รับคำตอบอย่างเป็นธรรมชาติ แล้วถามเรื่องถัดไปที่ยังไม่รู้ ตามลำดับ ${WISDOM_TOPICS.map((t) => t.label).join(' → ')}
   ทุกคำถามยกตัวอย่างสั้นๆ 2-4 อย่างที่เข้ากับเรื่องที่หมอเล่า เช่น คำถามมาตรฐาน: ${WISDOM_TOPICS.map((t) => `${t.label}: "${t.ask}"`).join(' | ')}
   ถ้าเป็นคาถา/พิธี ไม่ต้องถามตัวยา ให้ถามขั้นตอนแทน
   ถ้าสมุนไพรที่เล่ามีข้อควรระวังสำคัญที่รู้กันทั่วไป ให้เตือนสั้นๆ อย่างสุภาพ
   ประโยคสั้น ไม่เกิน 3 ประโยค ห้ามใช้ไม้ยมก (ๆ)
   ภาษาที่ใช้ตอบ (reply): ${dialectSpeakStyle()}
3) ถ้าครบทุกเรื่องแล้ว หรือหมอบอกว่าพอแล้ว ให้ done=true และ reply เป็นสรุปภูมิปัญญานี้สั้นๆ
ตอบ JSON เท่านั้น:
{"fields":{"title":"","kind":"","ingredients":"","method":"","indication":"","caution":"","origin":""},"reply":"","options":["ตัวเลือกคำตอบสั้นๆ 5-8 ข้อ สำหรับคำถามที่เพิ่งถาม ให้เข้ากับเรื่องที่หมอเล่า"],"done":false}`,
      },
    ]);
    const data = clean(r.fields, known);
    const missing = WISDOM_TOPICS.filter((t) => !wisdomHas(data, t.key));
    const done = !!r.done || !missing.length || asked >= 12;
    const opts = (Array.isArray(r.options) ? r.options : []).map((x) => String(x).trim()).filter((x) => x && x.length <= 30).slice(0, 8);
    return { data, reply: String(r.reply ?? '').trim() || (missing[0]?.ask ?? 'บันทึกครบแล้วครับ'), done, options: done ? [] : mergeOpts(opts, nextOptions(data)) };
  } catch {
    const data = { ...known };
    const prev = WISDOM_TOPICS.find((t) => !wisdomHas(known, t.key));
    if (prev) (data as any)[prev.key] = answer;
    const next = WISDOM_TOPICS.find((t) => !wisdomHas(data, t.key));
    return { data, reply: next ? next.ask : 'บันทึกครบแล้วครับ', done: !next, options: next ? WISDOM_OPTIONS[next.key] : [] };
  }
}

/** โหมดฟัง: หมอเล่าภูมิปัญญายาวๆ (ถอดเสียง) → แยกลงหัวข้อ */
export async function wisdomScribe(transcript: string): Promise<WisdomData> {
  const r = await chatJSON<Record<string, unknown>>([
    {
      role: 'user',
      content: `หมอพื้นบ้านเล่าภูมิปัญญา (ถอดจากเสียงอัตโนมัติ อาจสะกดเพี้ยน):
${transcript}
${dialectHint()}

สรุปเป็นภาษาไทยกลาง กระชับ ชื่อสมุนไพรสะกดตามชื่อมาตรฐาน ห้ามเดาข้อมูลที่ไม่ได้พูดถึง (ช่องที่ไม่มีให้เป็น "")
ตอบ JSON เท่านั้น:
{"title":"ชื่อตำรับ/เรื่อง","kind":"${KINDS.join('|')}","ingredients":"ตัวยาคั่นด้วยจุลภาค พร้อมปริมาณ","method":"วิธีปรุงและวิธีใช้","indication":"สรรพคุณ แก้อาการอะไร","caution":"ข้อห้าม/ข้อควรระวัง","origin":"ได้รับสืบทอดจากใคร"}`,
    },
  ]);
  return clean(r);
}

/** ส่งผลจากหน้าเสียง / หน้าสแกนตำรา กลับไปเติมฟอร์มเพิ่มภูมิปัญญา */
export type WisdomResult = WisdomData & { source?: Wisdom['source']; summary?: string };
let listener: ((d: WisdomResult) => void) | null = null;
let pending: WisdomResult | null = null;
export const onWisdomResult = (fn: ((d: WisdomResult) => void) | null) => {
  listener = fn;
};
export const setWisdomResult = (d: WisdomResult) => {
  if (listener) listener(d);
  else pending = d;
};
export const takeWisdomResult = () => {
  const r = pending;
  pending = null;
  return r;
};
