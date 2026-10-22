/**
 * ปรึกษาอาการกับครูปัญญา (ทุกกลุ่มผู้ใช้ ไม่ต้องมีบัตรผู้ป่วย)
 * ซักประวัติทีละคำถาม พร้อมตัวเลือกให้แตะตอบ → ครบพอแล้วเสนอแนวทางรักษา (แผนไทย / แผนปัจจุบัน) ผ่าน treatmentPlan
 * สัญญาณอันตรายตรวจในเครื่องทุกคำตอบ — เจอแล้วหยุดถาม บอกให้ไปโรงพยาบาลทันที
 */
import { hasMe, meLine, mePerson } from './me';
import { chatJSON } from '../api/ai';
import type { Turn } from './intake';
import type { PlanCase, PlanPerson } from './plan';
import { roleBrief } from './roles';
import { redFlags } from './safety';
import { uniqOptions } from './chatQA';

export type ConsultFacts = {
  symptoms?: string;
  duration?: string;
  /** ปรึกษาให้ใคร: ตัวเอง / คนในครอบครัว / ผู้ป่วยที่ดูแล */
  who?: string;
  age?: string;
  sex?: string;
  pregnant?: string;
  chronic?: string;
  meds?: string;
  allergies?: string;
  /** อาการร่วม/ความรุนแรงที่เล่าเพิ่ม */
  details?: string;
};

export type ConsultStep = { facts: ConsultFacts; reply: string; options: string[]; done: boolean; urgent: string[] };

/** ถ้าเชื่อมต่อ AI ไม่ได้ ถามตามลำดับนี้ */
const FALLBACK: { key: keyof ConsultFacts; ask: string; options: string[] }[] = [
  { key: 'duration', ask: 'เป็นมานานเท่าไรแล้วครับ', options: ['วันนี้', '2-3 วัน', '1 สัปดาห์', 'นานกว่า 1 เดือน'] },
  { key: 'age', ask: 'ผู้ที่มีอาการอายุเท่าไร เพศอะไรครับ', options: ['เด็ก', 'ผู้ใหญ่ ชาย', 'ผู้ใหญ่ หญิง', 'ผู้สูงอายุ'] },
  { key: 'chronic', ask: 'มีโรคประจำตัวไหมครับ', options: ['ไม่มี', 'เบาหวาน', 'ความดันสูง', 'โรคไต/ตับ', 'โรคหัวใจ'] },
  { key: 'meds', ask: 'ตอนนี้กินยาอะไรเป็นประจำอยู่ไหมครับ', options: ['ไม่ได้กินยา', 'ยาเบาหวาน', 'ยาความดัน', 'ยาละลายลิ่มเลือด'] },
  { key: 'allergies', ask: 'เคยแพ้ยา แพ้อาหาร หรือแพ้สมุนไพรอะไรไหมครับ', options: ['ไม่เคยแพ้', 'แพ้ยา', 'แพ้อาหาร'] },
];

const filled = (f: ConsultFacts, k: keyof ConsultFacts) => !!String(f[k] ?? '').trim();

/** หนึ่งรอบ: อัปเดตข้อมูลจากคำตอบ + คำถามถัดไป */
export async function consultTurn(known: ConsultFacts, history: Turn[], answer: string): Promise<ConsultStep> {
  const asked = history.filter((h) => h.role === 'ai').length;
  const urgent = redFlags(`${known.symptoms ?? ''} ${known.details ?? ''} ${/^(ไม่|ไม่มี|ไม่ได้|ไม่เคย)/.test(answer.trim()) ? '' : answer}`);
  if (urgent.length) return { facts: { ...known, details: [known.details, answer].filter(Boolean).join(' · ') }, reply: '', options: [], done: true, urgent };
  try {
    const r = await chatJSON<{ facts?: ConsultFacts; reply?: string; options?: string[]; done?: boolean }>(
      [
        {
          role: 'user',
          content: `คุณคือ "ครูปัญญา" กำลังซักประวัติเพื่อให้คำแนะนำด้านสุขภาพแผนไทย (${roleBrief()})
ข้อมูลที่รู้แล้ว: ${JSON.stringify(known)}${meLine() && hasMe() ? `
ข้อมูลของผู้ใช้เอง (จากโปรไฟล์): ${meLine()} — ถ้าปรึกษาให้ตัวเอง ใส่ age/sex จากนี้ได้เลยไม่ต้องถาม · ถ้าปรึกษาให้คนอื่นห้ามใช้` : ''}
บทสนทนา:
${history.map((h) => `${h.role === 'ai' ? 'ครูปัญญา' : 'ผู้ใช้'}: ${h.text}`).join('\n')}
ผู้ใช้: ${answer}

1) แยกข้อมูลจากคำตอบล่าสุดลงช่อง facts (symptoms อาการหลัก, duration เป็นมานานเท่าไร, who ปรึกษาให้ใคร, age, sex, pregnant ตั้งครรภ์/ให้นมไหม, chronic โรคประจำตัว, meds ยาที่กินประจำ, allergies แพ้อะไร, details อาการร่วม/ความรุนแรง) — คงค่าเดิมไว้ ใส่เฉพาะที่ผู้ใช้บอก ห้ามเดา
2) คิดคำถามถัดไป 1 คำถาม สั้น สุภาพ ลงท้าย "ครับ" เลือกเรื่องที่สำคัญที่สุดที่ยังไม่รู้ ลำดับ: อาการหลักและระยะเวลา → อาการร่วมหรือสัญญาณอันตรายที่เกี่ยวกับอาการนี้ (เช่น ไข้สูง เลือดออก หายใจลำบาก) → อายุ/เพศ (และตั้งครรภ์ถ้าเป็นผู้หญิงวัยเจริญพันธุ์) → โรคประจำตัว → ยาที่กินประจำ → แพ้ยา
3) options: ตัวเลือกคำตอบสั้นๆ 2-5 ข้อที่ผู้ใช้แตะตอบได้
4) done = true เมื่อรู้อาการหลัก ระยะเวลา อายุ โรคประจำตัว และยาที่กินแล้ว หรือถามไปแล้ว 7 ข้อ (ตอนนี้ถามไปแล้ว ${asked} ข้อ)
ตอบ JSON เท่านั้น: {"facts":{},"reply":"คำถามถัดไป","options":[""],"done":false}`,
        },
      ],
      undefined,
      { maxTokens: 500, timeoutMs: 30_000 },
    );
    const facts: ConsultFacts = { ...known };
    Object.entries(r?.facts ?? {}).forEach(([k, v]) => {
      const t = String(v ?? '').trim();
      if (t && t !== 'null' && t !== '-') (facts as Record<string, string>)[k] = t;
    });
    if (!facts.symptoms) facts.symptoms = answer;
    const reply = String(r?.reply ?? '').trim();
    const done = !!r?.done || asked >= 7 || !reply;
    const options = (Array.isArray(r?.options) ? r.options : []).map((x) => String(x).trim()).filter((x) => x && x.length <= 40).slice(0, 5);
    return { facts, reply, options: uniqOptions(options), done, urgent: [] };
  } catch {
    // ออฟไลน์/AI ล่ม → ถามตามชุดสำรอง
    const facts: ConsultFacts = { ...known };
    const prev = FALLBACK.find((f) => history.length && history[history.length - 1].text === f.ask);
    if (prev) facts[prev.key] = answer;
    else if (!facts.symptoms) facts.symptoms = answer;
    const next = FALLBACK.find((f) => !filled(facts, f.key));
    return next ? { facts, reply: next.ask, options: next.options, done: false, urgent: [] } : { facts, reply: '', options: [], done: true, urgent: [] };
  }
}

/** ข้อมูลที่ซักได้ → ใช้กับ treatmentPlan */
export function consultToPlan(f: ConsultFacts, qa: { q: string; a: string }[]): { person: PlanPerson; input: PlanCase } {
  const age = Number(String(f.age ?? '').match(/\d+/)?.[0]);
  // ปรึกษาให้ตัวเอง → เติมเพศ อายุ ธาตุ จากโปรไฟล์ที่ยังไม่ได้บอก
  const self = !f.who || /ตัวเอง|ฉัน|ผม|ดิฉัน|หนู|เรา/.test(f.who);
  const me = self ? mePerson() : {};
  return {
    person: {
      name: f.who && !self ? f.who : undefined,
      sex: f.sex ?? me.sex,
      age: Number.isFinite(age) && age > 0 ? age : me.age,
      element: me.element,
      chronic: [f.chronic, f.pregnant && !/ไม่/.test(f.pregnant) ? `ตั้งครรภ์/ให้นมบุตร (${f.pregnant})` : ''].filter(Boolean).join(' · ') || undefined,
      allergies: f.allergies,
      meds: f.meds && !/^(ไม่|ไม่มี|ไม่ได้)/.test(f.meds) ? f.meds.split(/[,，、]| และ /).map((x) => x.trim()).filter(Boolean) : [],
    },
    input: { symptoms: [f.symptoms, f.details].filter(Boolean).join(' · '), duration: f.duration, answers: qa },
  };
}
