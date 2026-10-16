/**
 * ครูปัญญาซักประวัติผู้ป่วยด้วยเสียง — ตรรกะการสนทนา
 * แต่ละรอบ: ส่งข้อมูลที่รู้แล้ว + คำตอบล่าสุด → AI แยกข้อมูลเพิ่ม และคิดคำถามถัดไป (สั้น สุภาพ ทีละเรื่อง)
 * ถ้าเชื่อมต่อ AI ไม่ได้ ใช้ชุดคำถามสำรองตามลำดับ
 */
import { chatJSON } from '../api/ai';
import { dialectGreeting, dialectHint, dialectSpeakStyle } from './dialect';

export type IntakeData = {
  prefix?: string;
  name?: string;
  bDay?: string;
  bMonth?: string;
  bYear?: string; // พ.ศ.
  age?: string;
  phone?: string;
  address?: string;
  chronic?: string;
  allergies?: string;
  weight?: string;
  height?: string;
};

export type Turn = { role: 'ai' | 'user'; text: string };

/** ลำดับเรื่องที่ต้องถาม (ใช้ทั้งตรวจความครบและคำถามสำรอง) */
export const TOPICS: { key: keyof IntakeData | 'birth'; label: string; ask: string }[] = [
  { key: 'name', label: 'ชื่อ-สกุล', ask: 'ผู้ป่วยชื่ออะไรครับ บอกคำนำหน้าและนามสกุลด้วยนะครับ' },
  { key: 'birth', label: 'วันเกิด', ask: 'เกิดวันที่เท่าไหร่ เดือนอะไร ปีไหนครับ ถ้าจำไม่ได้บอกอายุก็ได้ครับ' },
  { key: 'address', label: 'ที่อยู่', ask: 'ตอนนี้อยู่บ้านเลขที่เท่าไหร่ หมู่ไหน ตำบลอะไรครับ' },
  { key: 'phone', label: 'เบอร์โทร', ask: 'มีเบอร์โทรศัพท์ที่ติดต่อได้ไหมครับ' },
  { key: 'chronic', label: 'โรคประจำตัว', ask: 'มีโรคประจำตัวอะไรบ้างไหมครับ เช่น เบาหวาน ความดัน' },
  { key: 'allergies', label: 'แพ้ยา/อาหาร', ask: 'เคยแพ้ยาหรือแพ้อาหารอะไรไหมครับ' },
  { key: 'weight', label: 'น้ำหนัก ส่วนสูง', ask: 'น้ำหนักประมาณกี่กิโล สูงประมาณเท่าไหร่ครับ' },
];

export const hasTopic = (d: IntakeData, key: (typeof TOPICS)[number]['key']) =>
  key === 'birth' ? !!(d.bYear || d.age) : key === 'weight' ? !!(d.weight || d.height) : !!String(d[key] ?? '').trim();

/** คำถามแรก */
export const OPENING = 'สวัสดีครับ ผมครูปัญญานะครับ เดี๋ยวผมช่วยซักประวัติให้นะครับ พูดภาษาถิ่นได้เลยครับ ' + TOPICS[0].ask;
/** คำเปิดตามภาษาพูดที่ตั้งไว้ (คำถามแรกให้ AI ไม่ต้องคิด จึงใช้ภาษากลางที่ทุกภาคเข้าใจต่อท้าย) */
export const openingFor = () => `${dialectGreeting()} ${TOPICS[0].ask}`;

/** หนึ่งรอบการสนทนา: คืนข้อมูลที่อัปเดต + คำพูดถัดไป + จบหรือยัง */
export async function intakeTurn(known: IntakeData, history: Turn[], answer: string): Promise<{ data: IntakeData; reply: string; done: boolean }> {
  const asked = history.filter((h) => h.role === 'ai').length;
  try {
    const r = await chatJSON<{ fields?: IntakeData; reply?: string; done?: boolean }>([
      {
        role: 'user',
        content: `คุณคือ "ครูปัญญา" ผู้ช่วยหมอพื้นบ้าน ผู้ชายวัย 45 น้ำเสียงอบอุ่น ใจดี ฉลาด มีไหวพริบ พูดเป็นธรรมชาติเหมือนคนคุยกันจริง (ไม่แข็งแบบหุ่นยนต์) ลงท้าย "ครับ"
กำลังซักประวัติผู้ป่วยใหม่ด้วยเสียง
ข้อมูลที่รู้แล้ว: ${JSON.stringify(known)}
บทสนทนาล่าสุด:
${history.slice(-6).map((h) => `${h.role === 'ai' ? 'ครูปัญญา' : 'หมอ'}: ${h.text}`).join('\n')}
หมอเพิ่งตอบว่า: "${answer}"

สำคัญ — ภาษาถิ่น: ${dialectHint()}
หมอและผู้ป่วยอาจพูดภาษาถิ่น (อีสาน/ลาว, เหนือ/คำเมือง, ใต้, เขมรถิ่นไทย ฯลฯ) และข้อความมาจากการถอดเสียงอัตโนมัติ อาจสะกดเพี้ยน
ให้ตีความความหมายจากบริบท เช่น "บ่มี/บ่" = ไม่มี, "เจ้า/เพิ่น" = เขา/ท่าน, "แม่นแล้ว" = ใช่แล้ว, "เจ็บแอว" = ปวดเอว, "ขี้หลง" = หลงลืม, "เป็นหยัง" = เป็นอะไร, "จั๊กเดียว" = นิดเดียว
แล้วกรอกข้อมูลเป็นภาษาไทยกลางที่ถูกต้อง (ชื่อคนและชื่อสถานที่ให้คงตามที่ได้ยิน)

งาน:
1) แยกข้อมูลจากคำตอบลงช่อง (ห้ามเดา ช่องที่ไม่ได้พูดถึงไม่ต้องใส่) ตัวเลขเป็นเลขอารบิก ปีเกิดเป็น พ.ศ. ที่อยู่เขียนเต็มตามที่พูด ถ้าตอบว่าไม่มี ให้ใส่ "ไม่มี"
2) คิดคำพูดถัดไปแบบคนจริง: รับคำตอบอย่างเป็นธรรมชาติและหลากหลาย (เช่น "อ๋อ ได้ครับ", "เข้าใจแล้วครับ") ใส่ใจรายละเอียด
   ถ้าตอบเรื่องสุขภาพที่ควรถามต่อ ให้ถามต่อสั้นๆ อย่างมีไหวพริบ (เช่น เป็นเบาหวาน → ถามว่ากินยาอะไรอยู่)
   แล้วไปเรื่องถัดไปที่ยังไม่รู้ ตามลำดับ ชื่อ → วันเกิด/อายุ → ที่อยู่ → เบอร์โทร → โรคประจำตัว → แพ้ยา/อาหาร → น้ำหนักส่วนสูง
   ถามทีละเรื่อง ประโยคสั้น ไม่เกิน 2 ประโยค ถ้าคำตอบไม่ชัดให้ถามซ้ำอย่างสุภาพ
   ใช้ภาษาพูดแบบคนคุยกันจริง เป็นกันเอง อบอุ่น (เช่น "อ๋อ เข้าใจแล้วครับ", "โอเคครับ แล้วก็…", "ดีเลยครับ") ไม่ใช้ภาษาเขียนหรือภาษาทางการ ไม่ขึ้นต้นซ้ำแบบเดิมทุกครั้ง
   ห้ามใช้ไม้ยมก (ๆ) ให้เขียนคำซ้ำเต็ม เช่น "ค่อยค่อย"
   ภาษาที่ใช้ตอบ (reply): ${dialectSpeakStyle()}
3) ถ้าครบทุกเรื่องแล้ว หรือหมอบอกว่าพอแล้ว ให้ done=true และ reply เป็นการสรุปสั้นๆ อบอุ่น ว่าได้ข้อมูลอะไรบ้าง
ตอบ JSON เท่านั้น:
{"fields":{"prefix":"","name":"ชื่อ สกุล (ไม่มีคำนำหน้า)","bDay":"วันที่ 1-31 (ตัวเลข)","bMonth":"เดือน 1-12 (ตัวเลข)","bYear":"ปี พ.ศ. 4 หลัก","age":"","phone":"","address":"","chronic":"","allergies":"","weight":"","height":""},"reply":"คำพูดถัดไป","done":false}`,
      },
    ]);
    const data = { ...known };
    Object.entries(r.fields ?? {}).forEach(([k, v]) => {
      const s = String(v ?? '').trim();
      if (s) (data as any)[k] = s;
    });
    const missing = TOPICS.filter((t) => !hasTopic(data, t.key));
    const done = !!r.done || !missing.length || asked >= 10;
    return { data, reply: String(r.reply ?? '').trim() || (missing[0]?.ask ?? 'ได้ข้อมูลครบแล้วครับ'), done };
  } catch {
    // สำรอง: ถามตามลำดับ (เก็บคำตอบดิบไว้ในช่องของคำถามก่อนหน้า)
    const data = { ...known };
    const prev = TOPICS.find((t) => !hasTopic(known, t.key));
    if (prev && prev.key !== 'birth' && prev.key !== 'weight') (data as any)[prev.key] = answer;
    if (prev?.key === 'birth') data.age = answer.replace(/\D/g, '').slice(0, 3);
    const next = TOPICS.find((t) => !hasTopic(data, t.key));
    return { data, reply: next ? next.ask : 'ได้ข้อมูลครบแล้วครับ', done: !next };
  }
}

/** ส่งผลการซักประวัติกลับไปหน้าเพิ่มผู้ป่วย */
export type IntakeResult = IntakeData & { save?: boolean };
let pending: IntakeResult | null = null;
let listener: ((d: IntakeResult) => void) | null = null;
/** หน้าเพิ่มผู้ป่วยลงทะเบียนรับผล — ได้ผลทันทีที่กด "ใช้ข้อมูลนี้" */
export const onIntakeResult = (fn: ((d: IntakeResult) => void) | null) => {
  listener = fn;
};
export const setIntakeResult = (d: IntakeResult) => {
  if (listener) listener(d);
  else pending = d;
};
export const takeIntakeResult = () => {
  const r = pending;
  pending = null;
  return r;
};

/** คำตอบยืนยัน "ใช้/บันทึก" (รองรับภาษาถิ่น) — ถ้ามีคำปฏิเสธถือว่าไม่ใช้ */
export function isYes(ans: string): boolean {
  const t = ans.replace(/\s+/g, '');
  if (/(ไม่|บ่|ยังก่อน|เดี๋ยวก่อน|รอก่อน|แก้)/.test(t)) return false;
  return /(ใช่|ใช้|ได้|เอา|ตกลง|โอเค|ok|บันทึก|แม่น|เลย|จ้า|ค่ะ|ครับ|ถูกต้อง|เจ้า)/i.test(t);
}
