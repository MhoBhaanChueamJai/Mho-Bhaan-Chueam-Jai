/**
 * ครูปัญญาบันทึกการรักษาด้วยเสียง — ตรรกะการสนทนา (โครงข้อมูลอ้างอิงทะเบียนการรักษาของกรมการแพทย์แผนไทยฯ)
 * ถามทีละเรื่อง: อาการ → ตรวจร่างกาย → วินิจฉัย → การรักษา/ยาที่ให้ → ของแสลง/ข้อห้าม → นัดดูอาการ
 */
import { chatJSON } from '../api/ai';
import { dialectHint, dialectSpeakStyle } from './dialect';
import type { Patient } from '../data/mock';
import type { Turn } from './intake';

export type VisitData = {
  symptoms?: string;
  exam?: string;
  diagnosis?: string;
  treatment?: string;
  caution?: string; // ของแสลง / ข้อห้าม
  followUp?: string; // ให้มาอีกเมื่อไหร่ / การติดตาม
  result?: string;
};

export const VISIT_TOPICS: { key: keyof VisitData; label: string; ask: string }[] = [
  { key: 'symptoms', label: 'อาการ', ask: 'วันนี้ผู้ป่วยมาด้วยอาการอะไรครับ เช่น ปวดเข่า ปวดหลัง ท้องอืด ไข้ตัวร้อน เป็นมานานเท่าไหร่แล้วครับ' },
  { key: 'exam', label: 'ตรวจร่างกาย', ask: 'ตรวจร่างกายแล้วพบอะไรบ้างครับ เช่น ชีพจรเต้นแรงหรือเบา ตัวร้อนหรือเย็น คลำแล้วบวมหรือเจ็บตรงไหน เส้นตึง ลิ้นเป็นฝ้า หน้าซีด' },
  { key: 'diagnosis', label: 'วินิจฉัย', ask: 'หมอวินิจฉัยว่าเป็นอะไรครับ เช่น ลมจับโปง ธาตุไฟหย่อน เส้นตึง ไข้หวัด' },
  { key: 'treatment', label: 'การรักษา', ask: 'รักษาอย่างไรบ้างครับ เช่น นวดจับเส้น ประคบสมุนไพร ให้ยาต้มหรือยาลูกกลอนตัวไหน' },
  { key: 'caution', label: 'ของแสลง', ask: 'มีของแสลงหรือข้อห้ามที่บอกผู้ป่วยไหมครับ เช่น ห้ามกินของหมักดอง ข้าวเหนียว เนื้อวัว น้ำเย็น' },
  { key: 'followUp', label: 'นัดดูอาการ', ask: 'ให้ผู้ป่วยกลับมาอีกเมื่อไหร่ครับ เช่น อีก 3 วัน อีก 1 สัปดาห์ หรือมาเมื่ออาการไม่ดีขึ้น' },
];

/** ตัวเลือกพื้นฐานของแต่ละหัวข้อ (ใช้เป็นชิปให้กดเลือก เมื่อ AI ไม่ได้เสนอเอง) */
export const VISIT_OPTIONS: Record<keyof VisitData, string[]> = {
  symptoms: ['ปวดเข่า', 'ปวดหลัง', 'ปวดเมื่อย', 'ท้องอืด', 'ไข้ตัวร้อน', 'นอนไม่หลับ', 'เวียนหัว', 'ไอ มีเสมหะ'],
  exam: ['ชีพจรเต้นแรง', 'ชีพจรเบา', 'ตัวร้อน', 'ตัวเย็น', 'บวม', 'คลำแล้วเจ็บ', 'เส้นตึง', 'ลิ้นเป็นฝ้า', 'หน้าซีด'],
  diagnosis: ['ลมจับโปง', 'ธาตุไฟหย่อน', 'เส้นตึง', 'ลมปลายปัตคาด', 'ไข้หวัด', 'ท้องอืดเฟ้อ'],
  treatment: ['นวดจับเส้น', 'ประคบสมุนไพร', 'ยาต้ม', 'ยาลูกกลอน', 'ยาฝน', 'อบสมุนไพร', 'พอกยา'],
  caution: ['ของหมักดอง', 'ข้าวเหนียว', 'เนื้อวัว', 'น้ำเย็น', 'ของมัน', 'เหล้า', 'ไม่มีข้อห้าม'],
  followUp: ['อีก 3 วัน', 'อีก 1 สัปดาห์', 'อีก 2 สัปดาห์', 'มาเมื่ออาการไม่ดีขึ้น'],
  result: [],
};
export const nextVisitOptions = (d: VisitData) => {
  const t = VISIT_TOPICS.find((x) => !visitHas(d, x.key));
  return t ? VISIT_OPTIONS[t.key] : [];
};

export const visitHas = (d: VisitData, key: string) => !!String((d as any)[key] ?? '').trim();

export const visitOpening = (p: Patient) => {
  const short = p.name.replace(/^(นาย|นางสาว|นาง|ด\.ช\.|ด\.ญ\.)\s*/, '').split(' ')[0];
  return `สวัสดีครับ มาบันทึกการรักษาของคุณ${short}กันนะครับ ${VISIT_TOPICS[0].ask}`;
};

/** หนึ่งรอบการสนทนา */
export async function visitTurn(p: Patient, known: VisitData, history: Turn[], answer: string): Promise<{ data: VisitData; reply: string; done: boolean; options: string[] }> {
  const asked = history.filter((h) => h.role === 'ai').length;
  const last = p.visits[0];
  try {
    const r = await chatJSON<{ fields?: VisitData; reply?: string; done?: boolean; options?: string[] }>([
      {
        role: 'user',
        content: `คุณคือ "ครูปัญญา" ผู้ช่วยหมอพื้นบ้าน ผู้ชายวัย 45 อบอุ่น ฉลาด มีไหวพริบ พูดภาษาพูดเป็นธรรมชาติ ลงท้าย "ครับ"
กำลังช่วยหมอบันทึกการรักษาครั้งนี้ด้วยเสียง
ผู้ป่วย: ${p.name} ${p.sex} ${p.age} ปี ธาตุ${p.element} โรคประจำตัว: ${p.chronic} แพ้ยา/อาหาร: ${p.allergies}
${last ? `ครั้งก่อน (${last.date}): ${last.diagnosis} รักษาโดย ${last.treatment}` : 'เป็นการรักษาครั้งแรก'}
ข้อมูลครั้งนี้ที่รู้แล้ว: ${JSON.stringify(known)}
บทสนทนาล่าสุด:
${history.slice(-6).map((h) => `${h.role === 'ai' ? 'ครูปัญญา' : 'หมอ'}: ${h.text}`).join('\n')}
หมอเพิ่งตอบว่า: "${answer}"

${dialectHint()}
หมออาจพูดภาษาถิ่น (อีสาน/เหนือ/ใต้) และข้อความมาจากการถอดเสียง ให้ตีความจากบริบท แล้วบันทึกเป็นภาษาไทยกลาง ใช้ศัพท์แพทย์แผนไทยได้
งาน:
1) แยกข้อมูลลงช่อง (ห้ามเดา ช่องที่ไม่ได้พูดถึงไม่ต้องใส่) ถ้าหมอแก้ข้อมูลเดิม ให้แทนที่ช่องนั้น
2) คิดคำพูดถัดไป: รับคำตอบอย่างเป็นธรรมชาติ แล้วถามเรื่องถัดไปที่ยังไม่รู้ ตามลำดับ อาการ → ตรวจร่างกาย → วินิจฉัย → การรักษา/ยาที่ให้ → ของแสลง/ข้อห้าม → ให้กลับมาอีกเมื่อไหร่
   ทุกคำถามให้ยกตัวอย่างสั้นๆ 2-4 อย่างที่เข้ากับอาการของผู้ป่วยรายนี้ เพื่อให้หมอตอบง่าย เช่น ถามตรวจร่างกายของคนปวดเข่า: "ตรวจแล้วพบอะไรบ้างครับ เช่น เข่าบวม ร้อน คลำแล้วเจ็บ งอเหยียดได้แค่ไหน"
   คำถามมาตรฐานพร้อมตัวอย่าง: ${VISIT_TOPICS.map((t) => `${t.label}: "${t.ask}"`).join(' | ')}
   ถ้ายาหรือสมุนไพรที่ให้ อาจไม่เหมาะกับโรคประจำตัว การแพ้ หรือธาตุของผู้ป่วย ให้เตือนสั้นๆ อย่างสุภาพ
   ประโยคสั้น ไม่เกิน 3 ประโยค ห้ามใช้ไม้ยมก (ๆ)
   ภาษาที่ใช้ตอบ (reply): ${dialectSpeakStyle()}
3) ถ้าครบทุกเรื่องแล้ว หรือหมอบอกว่าพอแล้ว ให้ done=true และ reply เป็นสรุปการรักษาครั้งนี้สั้นๆ
ตอบ JSON เท่านั้น:
{"fields":{"symptoms":"","exam":"","diagnosis":"","treatment":"","caution":"","followUp":"","result":""},"reply":"","options":["ตัวเลือกคำตอบสั้นๆ 5-8 ข้อ สำหรับคำถามที่เพิ่งถาม (เข้ากับอาการผู้ป่วยรายนี้) ให้หมอกดเลือกได้"],"done":false}`,
      },
    ]);
    const data = { ...known };
    Object.entries(r.fields ?? {}).forEach(([k, v]) => {
      const s = String(v ?? '').trim();
      if (s) (data as any)[k] = s;
    });
    const missing = VISIT_TOPICS.filter((t) => !visitHas(data, t.key));
    const done = !!r.done || !missing.length || asked >= 12;
    const opts = (Array.isArray(r.options) ? r.options : []).map((x) => String(x).trim()).filter((x) => x && x.length <= 30).slice(0, 8);
    return { data, reply: String(r.reply ?? '').trim() || (missing[0]?.ask ?? 'บันทึกครบแล้วครับ'), done, options: done ? [] : opts.length ? opts : nextVisitOptions(data) };
  } catch {
    const data = { ...known };
    const prev = VISIT_TOPICS.find((t) => !visitHas(known, t.key));
    if (prev) (data as any)[prev.key] = answer;
    const next = VISIT_TOPICS.find((t) => !visitHas(data, t.key));
    return { data, reply: next ? next.ask : 'บันทึกครบแล้วครับ', done: !next, options: next ? VISIT_OPTIONS[next.key] : [] };
  }
}
