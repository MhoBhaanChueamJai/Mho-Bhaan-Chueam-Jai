/**
 * ครูปัญญาซักประวัติผู้ป่วยด้วยเสียง — ตรรกะการสนทนา
 * แต่ละรอบ: ส่งข้อมูลที่รู้แล้ว + คำตอบล่าสุด → AI แยกข้อมูลเพิ่ม และคิดคำถามถัดไป (สั้น สุภาพ ทีละเรื่อง)
 * ถ้าเชื่อมต่อ AI ไม่ได้ ใช้ชุดคำถามสำรองตามลำดับ
 */
import { chatJSON } from '../api/ai';

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
export const OPENING = 'สวัสดีครับ ครูปัญญาจะช่วยซักประวัติผู้ป่วยนะครับ ' + TOPICS[0].ask;

/** หนึ่งรอบการสนทนา: คืนข้อมูลที่อัปเดต + คำพูดถัดไป + จบหรือยัง */
export async function intakeTurn(known: IntakeData, history: Turn[], answer: string): Promise<{ data: IntakeData; reply: string; done: boolean }> {
  const asked = history.filter((h) => h.role === 'ai').length;
  try {
    const r = await chatJSON<{ fields?: IntakeData; reply?: string; done?: boolean }>([
      {
        role: 'user',
        content: `คุณคือ "ครูปัญญา" ผู้ช่วยหมอพื้นบ้าน กำลังซักประวัติผู้ป่วยใหม่ด้วยเสียง พูดภาษาไทยสุภาพ ลงท้าย "ครับ" สั้น กระชับ ถามทีละเรื่อง
ข้อมูลที่รู้แล้ว: ${JSON.stringify(known)}
บทสนทนาล่าสุด:
${history.slice(-6).map((h) => `${h.role === 'ai' ? 'ครูปัญญา' : 'หมอ'}: ${h.text}`).join('\n')}
หมอเพิ่งตอบว่า: "${answer}"

งาน:
1) แยกข้อมูลจากคำตอบลงช่อง (ห้ามเดา ช่องที่ไม่ได้พูดถึงไม่ต้องใส่) ตัวเลขเป็นเลขอารบิก ปีเกิดเป็น พ.ศ. ที่อยู่เขียนเต็มตามที่พูด ถ้าบอกว่า "ไม่มี" ให้ใส่ "ไม่มี"
2) คิดคำพูดถัดไป: รับคำตอบสั้นๆ แล้วถามเรื่องถัดไปที่ยังไม่รู้ ตามลำดับ ชื่อ → วันเกิด/อายุ → ที่อยู่ → เบอร์โทร → โรคประจำตัว → แพ้ยา/อาหาร → น้ำหนักส่วนสูง (ถ้าคำตอบไม่ชัดให้ถามซ้ำแบบสุภาพ)
3) ถ้าครบทุกเรื่องแล้ว หรือหมอบอกว่าพอแล้ว ให้ done=true และ reply เป็นการสรุปสั้นๆ ว่าได้ข้อมูลอะไรบ้าง
ตอบ JSON เท่านั้น:
{"fields":{"prefix":"","name":"ชื่อ สกุล (ไม่มีคำนำหน้า)","bDay":"","bMonth":"","bYear":"","age":"","phone":"","address":"","chronic":"","allergies":"","weight":"","height":""},"reply":"คำพูดถัดไป","done":false}`,
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
let pending: IntakeData | null = null;
export const setIntakeResult = (d: IntakeData) => {
  pending = d;
};
export const takeIntakeResult = () => {
  const r = pending;
  pending = null;
  return r;
};
