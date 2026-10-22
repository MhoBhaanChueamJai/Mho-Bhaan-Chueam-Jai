/**
 * ครูปัญญาช่วยบันทึกภูมิปัญญาด้วยเสียง — ตรรกะการสนทนา ตามประเภทที่เลือกในหน้าเพิ่ม
 * แต่ละประเภทถามหัวข้อไม่เหมือนกัน (ตรงกับช่องกรอกใน lib/wisdomKinds.ts):
 *   ตำรับยา: ชื่อ → ใช้แก้ → ตัวยา+ปริมาณ → วิธีปรุง → วิธีใช้ → ข้อห้าม → ที่มา
 *   วิธีรักษา: ชื่อ → รักษาอาการ → อุปกรณ์ → ขั้นตอน → ระยะเวลา → ข้อห้าม → ที่มา
 *   คาถา/พิธี: ชื่อ → ใช้ในโอกาส → บทคาถา → เครื่องประกอบพิธี → ขั้นตอนพิธี → ข้อปฏิบัติ → ที่มา
 *   ตำราโบราณ: ชื่อ → ว่าด้วยเรื่อง → ข้อความต้นฉบับ → ถอดความ → ตัวยาที่พบ → หมายเหตุ → แหล่งที่มา
 */
import { chatJSON } from '../api/ai';
import { dialectHint, dialectSpeakStyle } from './dialect';
import { KIND_FORM } from './wisdomKinds';
import type { Wisdom, WisdomAudio } from '../data/mock';
import type { Organized } from './wisdomOrganize';
import type { Turn } from './intake';
import { roleBrief, userNoun } from './roles';

type Kind = Wisdom['kind'];
export type WisdomData = {
  title?: string;
  kind?: string;
  indication?: string;
  ingredients?: string; // คั่นด้วยจุลภาค
  method?: string; // ขั้นตอน คั่นด้วยขึ้นบรรทัดใหม่ (ตำราโบราณ = ข้อความต้นฉบับ)
  extra?: string; // วิธีใช้ / ระยะเวลา
  summary?: string; // บทคาถา / ถอดความ / เนื้อหาเพิ่มเติม
  caution?: string;
  origin?: string;
};
type Key = Exclude<keyof WisdomData, 'kind'>;

export const KINDS: Kind[] = ['ตำรับยา', 'วิธีรักษา', 'คาถา/พิธี', 'ตำราโบราณ'];
const asKind = (k?: string): Kind => KINDS.find((x) => k?.includes(x.split('/')[0])) ?? 'ตำรับยา';

/** ลำดับหัวข้อที่ถามของแต่ละประเภท */
const ORDER: Record<Kind, Key[]> = {
  ตำรับยา: ['title', 'indication', 'ingredients', 'method', 'extra', 'caution', 'origin'],
  วิธีรักษา: ['title', 'indication', 'ingredients', 'method', 'extra', 'caution', 'origin'],
  'คาถา/พิธี': ['title', 'indication', 'summary', 'ingredients', 'method', 'caution', 'origin'],
  ตำราโบราณ: ['title', 'indication', 'method', 'summary', 'ingredients', 'caution', 'origin'],
};
/** ป้าย + คำถาม (ยกตัวอย่างจากช่องกรอกของประเภทนั้น) */
function labelOf(kind: Kind, key: Key): { label: string; ask: string } {
  const f = KIND_FORM[kind];
  const c = { title: f.title, indication: f.indication, ingredients: f.ingredients, method: f.method, extra: f.extra, summary: f.summary, caution: f.caution, origin: f.origin }[key]!;
  const asks: Record<Key, string> = {
    title: `${kind === 'ตำราโบราณ' ? 'ตำรานี้ชื่ออะไร' : kind === 'คาถา/พิธี' ? 'คาถาหรือพิธีนี้ชื่ออะไร' : kind === 'วิธีรักษา' ? 'วิธีรักษานี้เรียกว่าอะไร' : 'ตำรับยานี้ชื่ออะไร'}ครับ ${c.ph}`,
    indication: `${c.label}อะไรครับ ${c.ph}`,
    ingredients: kind === 'ตำรับยา' ? `ใช้ตัวยาอะไรบ้าง อย่างละเท่าไหร่ครับ เช่น เถาวัลย์เปรียง 1 กำมือ ไพล 3 แง่ง` : `${c.label}มีอะไรบ้างครับ ${c.ph}`,
    method: kind === 'ตำราโบราณ' ? `ช่วยอ่านข้อความในต้นฉบับให้ฟังหน่อยครับ อ่านตามตัวอักษรเดิมได้เลย` : `${c.label}ทำอย่างไรครับ เล่าทีละขั้นได้เลย ${c.ph}`,
    extra: `${c.label}อย่างไรครับ ${c.ph}`,
    summary: kind === 'คาถา/พิธี' ? 'บทคาถาว่าอย่างไรครับ ท่องให้ฟังได้เลย' : kind === 'ตำราโบราณ' ? 'ข้อความนี้หมายความว่าอย่างไรครับ อธิบายเป็นภาษาปัจจุบัน' : `มีอะไรอยากเล่าเพิ่มเติมไหมครับ`,
    caution: `${c.label}ไหมครับ ${c.ph}`,
    origin: kind === 'ตำราโบราณ' ? `ตำรานี้ได้มาจากไหนครับ ${c.ph}` : `ภูมิปัญญานี้ได้รับสืบทอดมาจากใครครับ ${c.ph}`,
  };
  return { label: key === 'summary' && !f.summary.big ? 'เนื้อหา' : c.label.split(' / ')[0], ask: asks[key] };
}
export const topicsFor = (kind: Kind) => ORDER[kind].map((key) => ({ key, ...labelOf(kind, key) }));

/** ตัวเลือกคำตอบพื้นฐาน (ชิป) */
const OPTIONS: Record<Kind, Partial<Record<Key, string[]>>> = {
  ตำรับยา: {
    title: ['ยาต้มแก้ปวดเมื่อย', 'ยาแก้ไข้', 'ยาแก้ท้องอืด', 'ยาหม้อบำรุงเลือด', 'ยาลูกกลอนแก้ลม'],
    indication: ['ปวดเมื่อย', 'ปวดเข่า', 'ไข้ตัวร้อน', 'ท้องอืด', 'บำรุงเลือด', 'นอนไม่หลับ'],
    ingredients: ['เถาวัลย์เปรียง', 'ไพล', 'ขมิ้นชัน', 'ฟ้าทะลายโจร', 'บอระเพ็ด', 'ขิง', 'ตะไคร้'],
    method: ['ต้มสามเอาหนึ่ง', 'บดเป็นผง', 'ปั้นลูกกลอน', 'ดองเหล้า', 'ฝนกับน้ำ'],
    extra: ['ครั้งละครึ่งแก้ว เช้า-เย็น', 'ก่อนอาหาร', 'หลังอาหาร', 'วันละ 3 ครั้ง', 'ก่อนนอน'],
    caution: ['ห้ามใช้ในหญิงตั้งครรภ์', 'ไม่ควรกินนานเกิน 7 วัน', 'ระวังในคนเป็นโรคตับ/ไต', 'ไม่มีข้อห้าม'],
  },
  วิธีรักษา: {
    title: ['นวดจับเส้นแก้ปวดหลัง', 'ประคบสมุนไพร', 'อบสมุนไพร', 'นวดฝ่าเท้า', 'ทับหม้อเกลือ'],
    indication: ['ปวดหลัง', 'ปวดคอบ่าไหล่', 'ลมปลายปัตคาด', 'ข้อเข่าเสื่อม', 'ปวดเมื่อย'],
    ingredients: ['ลูกประคบ', 'น้ำมันไพล', 'หม้อเกลือ', 'ผ้าขาวม้า', 'ใบพลับพลึง'],
    method: ['กดจุดตามแนวเส้น', 'ประคบอุ่นๆ', 'คลึงเบาๆ', 'ยืดเส้น'],
    extra: ['ครั้งละ 30 นาที', 'ครั้งละ 1 ชั่วโมง', 'สัปดาห์ละ 2 ครั้ง', 'ทุกวันติดต่อกัน 3 วัน'],
    caution: ['ห้ามนวดบริเวณที่อักเสบ', 'ห้ามประคบแผลเปิด', 'ระวังในคนความดันสูง', 'ไม่มีข้อห้าม'],
  },
  'คาถา/พิธี': {
    title: ['คาถาเป่าแก้ปวดฟัน', 'คาถาเป่างูสวัด', 'พิธีไหว้ครูหมอ', 'คาถาห้ามเลือด'],
    indication: ['เป่ารักษาเริม งูสวัด', 'ไหว้ครูก่อนรักษา', 'ห้ามเลือด', 'ถอนพิษ'],
    ingredients: ['ดอกไม้ธูปเทียน', 'ขันน้ำมนต์', 'หมาก พลู', 'ผ้าขาว', 'เงินกำนล'],
    method: ['ไหว้ครู', 'จุดธูป 3 ดอก', 'ว่าคาถา 3 จบ', 'เป่าลงบนแผล'],
    caution: ['ห้ามกินของคาว 3 วัน', 'ห้ามลอดใต้ถุนบ้าน', 'ต้องไหว้ครูทุกปี'],
  },
  ตำราโบราณ: {
    indication: ['ยาแก้ไข้', 'ตำราเส้น', 'ตำรายาสตรี', 'ตำราธาตุ'],
    ingredients: ['บอระเพ็ด', 'ฟ้าทะลายโจร', 'รากย่านาง', 'จันทน์แดง'],
    caution: ['อักษรบางส่วนเลือนราง', 'ควรให้ผู้รู้ตรวจทาน'],
    origin: ['สมุดข่อยของวัด', 'ใบลานจากปู่', 'ตำราของครู'],
  },
};
export const optionsFor = (kind: Kind, key: Key) => OPTIONS[kind]?.[key] ?? [];

export const wisdomHas = (d: WisdomData, key: string) => !!String((d as any)[key] ?? '').trim();
export const wisdomOpening = (kind: Kind) =>
  `สวัสดีครับ มาบันทึก${kind === 'คาถา/พิธี' ? 'คาถาและพิธี' : kind}ของคุณหมอเก็บไว้ให้ลูกหลานกันนะครับ ${topicsFor(kind)[0].ask}`;

const mergeOpts = (a: string[], b: string[]) => {
  const out: string[] = [];
  [...a, ...b].forEach((x) => {
    if (x && !out.some((y) => y.replace(/\s/g, '') === x.replace(/\s/g, ''))) out.push(x);
  });
  return out.slice(0, 10);
};
const clean = (r: Record<string, unknown> | undefined, base: WisdomData = {}): WisdomData => {
  const out: WisdomData = { ...base };
  Object.entries(r ?? {}).forEach(([k, v]) => {
    const sep = k === 'method' ? '\n' : ', ';
    const s = (Array.isArray(v) ? v.join(sep) : String(v ?? '')).trim();
    if (s && k !== 'kind') (out as any)[k] = s;
  });
  return out;
};
/** คำอธิบายช่อง JSON ตามประเภท */
const schemaFor = (kind: Kind) => {
  const t = topicsFor(kind);
  const lab = (k: Key) => t.find((x) => x.key === k)?.label ?? '';
  return {
    title: lab('title'),
    indication: lab('indication'),
    ingredients: kind === 'ตำรับยา' ? 'ตัวยาพร้อมปริมาณ คั่นด้วยจุลภาค เช่น "เถาวัลย์เปรียง 1 กำมือ, ไพล 3 แง่ง"' : `${lab('ingredients')} คั่นด้วยจุลภาค`,
    method: kind === 'ตำราโบราณ' ? 'ข้อความต้นฉบับตามที่อ่าน (คงอักขระเดิม)' : `${lab('method')} แยกทีละขั้นด้วยขึ้นบรรทัดใหม่ (\\n)`,
    ...(KIND_FORM[kind].extra ? { extra: KIND_FORM[kind].extra!.label } : {}),
    summary: kind === 'คาถา/พิธี' ? 'บทคาถาตามที่หมอท่อง (คงถ้อยคำเดิม)' : kind === 'ตำราโบราณ' ? 'ถอดความเป็นภาษาปัจจุบัน' : 'เนื้อหาเพิ่มเติม (ถ้ามี)',
    caution: lab('caution'),
    origin: lab('origin'),
  };
};

/** หนึ่งรอบการสนทนา */
export async function wisdomTurn(kind: Kind, known: WisdomData, history: Turn[], answer: string): Promise<{ data: WisdomData; reply: string; done: boolean; options: string[] }> {
  const topics = topicsFor(kind);
  const asked = history.filter((h) => h.role === 'ai').length;
  const next = (d: WisdomData) => topics.find((t) => !wisdomHas(d, t.key));
  try {
    const schema = schemaFor(kind);
    const r = await chatJSON<{ fields?: Record<string, unknown>; reply?: string; done?: boolean; options?: string[] }>([
      {
        role: 'user',
        content: `คุณคือ "ครูปัญญา" ผู้ช่วยบันทึกภูมิปัญญาแพทย์แผนไทย (${roleBrief()}) ผู้ชายวัย 45 อบอุ่น ให้เกียรติภูมิปัญญาของหมอ พูดภาษาพูดเป็นธรรมชาติ ลงท้าย "ครับ"
กำลังช่วยหมอบันทึกภูมิปัญญาประเภท "${kind}" ด้วยเสียง เพื่อเก็บไว้สืบทอด
ข้อมูลที่รู้แล้ว: ${JSON.stringify(known)}
บทสนทนาล่าสุด:
${history.slice(-6).map((h) => `${h.role === 'ai' ? 'ครูปัญญา' : 'หมอ'}: ${h.text}`).join('\n')}
หมอเพิ่งตอบว่า: "${answer}"

${dialectHint()}
หมออาจพูดภาษาถิ่น และข้อความมาจากการถอดเสียง ให้ตีความจากบริบท แล้วบันทึกเป็นภาษาไทยกลาง ชื่อสมุนไพรให้สะกดตามชื่อมาตรฐาน${kind === 'คาถา/พิธี' || kind === 'ตำราโบราณ' ? ' ยกเว้นบทคาถาและข้อความต้นฉบับ ให้คงถ้อยคำเดิมตามที่หมอพูด' : ''}
งาน:
1) แยกข้อมูลลงช่อง (ห้ามเดา ช่องที่ไม่ได้พูดถึงไม่ต้องใส่) ถ้าหมอแก้ข้อมูลเดิม ให้แทนที่ช่องนั้น
   สำคัญ: ภูมิปัญญามักยาวหลายหน้า — summary (เนื้อหา/บทคาถา/ถอดความ), method และขั้นตอน ให้บันทึกครบถ้วนทุกรายละเอียดตามที่หมอเล่า ห้ามย่อ ห้ามสรุป แบ่งย่อหน้าตามเนื้อหา
   ถ้าหมอเล่าต่อจากเรื่องเดิม ให้ "ต่อท้าย" ข้อความเดิมในช่องนั้น (ไม่ลบของเดิม) และถามว่ายังมีต่ออีกไหม ก่อนไปหัวข้อถัดไป
   ความหมายของช่อง: ${JSON.stringify(schema)}
2) คิดคำพูดถัดไป: รับคำตอบอย่างเป็นธรรมชาติ แล้วถามเรื่องถัดไปที่ยังไม่รู้ ตามลำดับ ${topics.map((t) => t.label).join(' → ')}
   คำถามมาตรฐานพร้อมตัวอย่าง: ${topics.map((t) => `${t.label}: "${t.ask}"`).join(' | ')}
   ยกตัวอย่างให้เข้ากับเรื่องที่หมอเล่า ถ้าเล่าหลายเรื่องในคำตอบเดียว ให้เก็บทุกช่องแล้วข้ามหัวข้อที่ได้แล้ว
   ${kind === 'ตำรับยา' ? 'ถ้าบอกตัวยาแต่ไม่บอกปริมาณ ให้ถามปริมาณสั้นๆ · ถ้าสมุนไพรมีข้อควรระวังสำคัญที่รู้กันทั่วไป ให้เตือนอย่างสุภาพ' : ''}
   ประโยคสั้น ไม่เกิน 3 ประโยค ห้ามใช้ไม้ยมก (ๆ)
   ภาษาที่ใช้ตอบ (reply): ${dialectSpeakStyle()}
3) ถ้าครบทุกเรื่องแล้ว หรือหมอบอกว่าพอแล้ว ให้ done=true และ reply เป็นสรุปสั้นๆ
ตอบ JSON เท่านั้น:
{"fields":${JSON.stringify(Object.fromEntries(Object.keys(schema).map((k) => [k, ''])))},"reply":"","options":["ตัวเลือกคำตอบสั้นๆ 5-8 ข้อ สำหรับคำถามที่เพิ่งถาม ให้เข้ากับเรื่องที่หมอเล่า"],"done":false}`,
      },
    ]);
    const data = clean(r.fields, known);
    const n = next(data);
    const done = !!r.done || !n || asked >= 12;
    const opts = (Array.isArray(r.options) ? r.options : []).map((x) => String(x).trim()).filter((x) => x && x.length <= 30).slice(0, 8);
    return { data, reply: String(r.reply ?? '').trim() || (n?.ask ?? 'บันทึกครบแล้วครับ'), done, options: done ? [] : mergeOpts(opts, n ? optionsFor(kind, n.key) : []) };
  } catch {
    const data = { ...known };
    const prev = next(known);
    if (prev) (data as any)[prev.key] = answer;
    const n = next(data);
    return { data, reply: n ? n.ask : 'บันทึกครบแล้วครับ', done: !n, options: n ? optionsFor(kind, n.key) : [] };
  }
}

/** โหมดฟัง: หมอเล่ายาวๆ (ถอดเสียง) → แยกลงหัวข้อตามประเภท */
export async function wisdomScribe(kind: Kind, transcript: string): Promise<WisdomData> {
  const schema = schemaFor(kind);
  const r = await chatJSON<Record<string, unknown>>([
    {
      role: 'user',
      content: `${userNoun()}เล่าภูมิปัญญาประเภท "${kind}" (ถอดจากเสียงอัตโนมัติ อาจสะกดเพี้ยน):
${transcript}
${dialectHint()}

เรียบเรียงเป็นภาษาไทยกลางให้ครบถ้วนทุกรายละเอียด ห้ามย่อ ห้ามตัดทอน แบ่งย่อหน้าตามเนื้อหา (ถ้ายาวมากให้คั่นแต่ละช่วงด้วยบรรทัดว่าง) ชื่อสมุนไพรสะกดตามชื่อมาตรฐาน ห้ามเดาข้อมูลที่ไม่ได้พูดถึง (ช่องที่ไม่มีให้เป็น "")${kind === 'คาถา/พิธี' || kind === 'ตำราโบราณ' ? ' บทคาถาและข้อความต้นฉบับให้คงถ้อยคำเดิม' : ''}
ความหมายของช่อง: ${JSON.stringify(schema)}
ตอบ JSON เท่านั้น ใช้คีย์: ${Object.keys(schema).join(', ')}`,
    },
  ]);
  return clean(r);
}

export const kindOf = asKind;

/** ส่งผลจากหน้าเสียง / หน้าสแกนตำรา กลับไปเติมฟอร์มเพิ่มภูมิปัญญา */
export type WisdomResult = WisdomData & {
  source?: Wisdom['source'];
  summary?: string;
  /** โหมดเล่า: ครูปัญญาเรียบเรียงเป็นหนังสือแล้ว → เปิดหน้าสรุปก่อนบันทึกได้ทันที */
  organized?: Organized;
  /** โหมดเล่า: ไฟล์เสียงเล่าต้นฉบับ */
  audio?: WisdomAudio[];
};
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
