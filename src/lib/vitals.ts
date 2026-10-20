/**
 * ค่าสุขภาพ (ความดัน ชีพจร น้ำตาล น้ำหนัก) — บันทึกต่อครั้งที่รักษา + ประเมินตามแนวทางเวชปฏิบัติแผนไทย 2568
 * เก็บไว้ในช่อง "ตรวจร่างกาย" ของ ม.บ.5 ด้วย (ข้อความ เช่น "ความดัน 150/90 · ชีพจร 80") → อยู่บนคลาวด์ทุกบัญชี และอ่านกลับเป็นกราฟได้
 */
import type { MB5Visit } from '../data/mock';

export type Vitals = { sys?: number; dia?: number; pulse?: number; sugar?: number; weight?: number };
export const SRC = 'แนวทางเวชปฏิบัติแผนไทยปฐมภูมิ 2568';

/** ค่าสุขภาพ → ข้อความในช่องตรวจร่างกาย */
export function vitalsText(v: Vitals) {
  return [
    v.sys && v.dia ? `ความดัน ${v.sys}/${v.dia}` : '',
    v.pulse ? `ชีพจร ${v.pulse}` : '',
    v.sugar ? `น้ำตาล ${v.sugar}` : '',
    v.weight ? `น้ำหนัก ${v.weight} กก.` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** อ่านค่าสุขภาพจากข้อความตรวจร่างกาย (รองรับที่หมอพิมพ์เองแบบ "BP 150/90" "FBS 160" ด้วย) */
export function vitalsOf(v: MB5Visit): Vitals {
  const t = `${v.exam ?? ''}`;
  const bp = t.match(/(?:ความดัน|BP)\s*:?\s*(\d{2,3})\s*\/\s*(\d{2,3})/i);
  const pulse = t.match(/(?:ชีพจร|PR|P)\s*:?\s*(\d{2,3})(?!\s*\/)/i);
  const sugar = t.match(/(?:น้ำตาล|FBS|DTX|BS)\s*:?\s*(\d{2,3})/i);
  const weight = t.match(/(?:น้ำหนัก|BW)\s*:?\s*(\d{2,3}(?:\.\d)?)/i);
  return { sys: bp ? +bp[1] : undefined, dia: bp ? +bp[2] : undefined, pulse: pulse ? +pulse[1] : undefined, sugar: sugar ? +sugar[1] : undefined, weight: weight ? +weight[1] : undefined };
}

export type Assess = { k: 'bp' | 'sugar' | 'pulse'; level: 'ok' | 'watch' | 'refer'; title: string; text: string };

/** ประเมินตามเกณฑ์ในแนวทางเวชปฏิบัติ (ตัวเลขจากตำราเท่านั้น) */
export function assess(v: Vitals): Assess[] {
  const out: Assess[] = [];
  if (v.sys && v.dia) {
    const { sys: s, dia: d } = v;
    if (s > 180 || d > 110) out.push({ k: 'bp', level: 'refer', title: 'ความดันระดับ 3', text: `เกิน 180/110 · ควรส่งต่อแพทย์แผนปัจจุบัน` });
    else if (s >= 160 || d >= 100) out.push({ k: 'bp', level: 'refer', title: 'ความดันระดับ 2', text: 'ตั้งแต่ 160/100 ขึ้นไป เกินเกณฑ์รับรักษาด้วยแผนไทย · ควรส่งต่อแพทย์แผนปัจจุบัน' });
    else if (s >= 140 || d >= 90) out.push({ k: 'bp', level: 'watch', title: 'ความดันระดับ 1', text: '140–159/90–99 อยู่ในกลุ่มที่ดูแลด้วยแผนไทยได้ · ติดตามทุก 1–2 เดือน' });
    else if (s >= 120 || d >= 80) out.push({ k: 'bp', level: 'watch', title: 'กลุ่มเสี่ยงความดันสูง', text: '120–139/80–89 แนะนำปรับพฤติกรรม · ติดตามทุก 6 เดือนถึง 1 ปี' });
    else if (s < 90 || d < 60) out.push({ k: 'bp', level: 'watch', title: 'ความดันต่ำ', text: 'ต่ำกว่า 90/60 · สังเกตอาการหน้ามืด เวียนศีรษะ' });
    else out.push({ k: 'bp', level: 'ok', title: 'ความดันปกติ', text: 'ต่ำกว่า 120/80' });
  }
  if (v.sugar) {
    const g = v.sugar;
    if (g > 180) out.push({ k: 'sugar', level: 'refer', title: 'น้ำตาลสูงเกินเกณฑ์', text: 'มากกว่า 180 มก./ดล. · ควรส่งต่อแพทย์แผนปัจจุบัน' });
    else if (g < 70) out.push({ k: 'sugar', level: 'refer', title: 'น้ำตาลต่ำ', text: 'ต่ำกว่า 70 มก./ดล. · ควรส่งต่อแพทย์แผนปัจจุบัน' });
    else if (g >= 126) out.push({ k: 'sugar', level: 'watch', title: 'น้ำตาลสูง (เบาหวาน)', text: '126–180 มก./ดล. อยู่ในเกณฑ์ดูแลด้วยแผนไทยได้ · ติดตามต่อเนื่อง' });
    else if (g > 110) out.push({ k: 'sugar', level: 'watch', title: 'น้ำตาลสูงกว่าปกติ', text: '111–125 มก./ดล. · แนะนำปรับพฤติกรรม' });
    else out.push({ k: 'sugar', level: 'ok', title: 'น้ำตาลปกติ', text: '70–110 มก./ดล. (งดอาหาร)' });
  }
  if (v.pulse && (v.pulse < 60 || v.pulse > 100)) out.push({ k: 'pulse', level: 'watch', title: 'ชีพจรผิดปกติ', text: 'ปกติ 60–100 ครั้ง/นาที · ตรวจซ้ำหลังพัก' });
  return out;
}

export const LEVEL = {
  ok: { color: '#14905C', bg: '#E6F4EC', icon: 'checkmark.circle.fill' },
  watch: { color: '#B86E00', bg: '#FDF1DC', icon: 'exclamationmark.circle.fill' },
  refer: { color: '#D2453A', bg: '#FCE8E6', icon: 'exclamationmark.triangle.fill' },
} as const;
