/**
 * ด่านความปลอดภัยของครูปัญญา (ทำงานในเครื่อง ไม่ต้องใช้เซิร์ฟเวอร์)
 *  1) สัญญาณอันตราย: อาการที่ต้องไปโรงพยาบาลทันที → สั่งให้ AI บอกเรื่องนี้ก่อน และเติมคำเตือนเองถ้า AI ไม่ได้พูดถึง
 *  2) กลุ่มเสี่ยง: ตั้งครรภ์ เด็ก ผู้สูงอายุ โรคตับ-ไต-หัวใจ เบาหวาน ความดัน ยาละลายลิ่มเลือด
 *     → จับคู่กับข้อควรระวังของสมุนไพรในคลัง (ข้อมูลที่ตรวจแล้ว ไม่แต่งเอง) แล้วเตือนเมื่อขัดกัน
 */
import type { Herb } from '../data/herbs';
import { DRUG_MATCH, HERB_DRUG, type DrugClass, type HerbDrug } from '../data/interactions';
import { knownAge } from './birth';

/* ── 1) สัญญาณอันตราย ─────────────────────────────────────── */
const RED_FLAGS: { re: RegExp; why: string }[] = [
  { re: /เจ็บ(แน่น)?หน้าอก|แน่นหน้าอก|เจ็บอกร้าว|ร้าวไปแขน/, why: 'เจ็บแน่นหน้าอก (อาจเป็นโรคหัวใจ)' },
  { re: /หายใจไม่ออก|หายใจลำบาก|หอบเหนื่อย(มาก)?|ปากเขียว|หายใจไม่ทัน/, why: 'หายใจลำบาก' },
  { re: /ปากเบี้ยว|หน้าเบี้ยว|แขนขาอ่อนแรง(ซีก|ข้าง)|อ่อนแรงครึ่งซีก|พูดไม่ชัด(ทันที)?|ลิ้นแข็ง/, why: 'อาการคล้ายหลอดเลือดสมอง (ปากเบี้ยว อ่อนแรงครึ่งซีก พูดไม่ชัด)' },
  { re: /ชัก|หมดสติ|ไม่รู้สึกตัว|เรียกไม่ตื่น|ซึมลง/, why: 'ชัก ซึม หรือหมดสติ' },
  { re: /อาเจียนเป็นเลือด|ถ่ายดำ|ถ่ายเป็นเลือด|ไอเป็นเลือด/, why: 'มีเลือดออกในทางเดินอาหารหรือปอด' },
  { re: /ไข้เลือดออก|จุดเลือดออก|เลือดกำเดาไหลไม่หยุด/, why: 'สงสัยไข้เลือดออก (ห้ามใช้ยาแก้ไข้กลุ่ม NSAIDs และยาที่ทำให้เลือดออกง่าย)' },
  { re: /ปวดท้อง(รุนแรง|อย่างแรง)|ท้องแข็ง|ปวดท้องน้อยขวา/, why: 'ปวดท้องรุนแรง' },
  { re: /(ตั้งครรภ์|คนท้อง|ตั้งท้อง).{0,20}(เลือดออก|ลูกไม่ดิ้น|ลูกดิ้นน้อย|น้ำเดิน|ปวดท้อง)/, why: 'หญิงตั้งครรภ์มีเลือดออก ปวดท้อง หรือลูกดิ้นน้อย' },
  { re: /งูกัด|สุนัขกัด|หมากัด|แมวกัด|กินยาเกินขนาด|กินยาฆ่าแมลง|กินยาเบื่อ|สารพิษ/, why: 'ถูกสัตว์มีพิษกัดหรือได้รับสารพิษ' },
  { re: /ปวดหัว(รุนแรง|มาก)ทันที|ปวดศีรษะรุนแรง|คอแข็ง/, why: 'ปวดศีรษะรุนแรงทันทีหรือคอแข็ง' },
  { re: /(เด็ก|ทารก|ลูก).{0,15}(ไข้สูง|ซึม|ไม่กินนม|ชัก|ขาดน้ำ)/, why: 'เด็กเล็กไข้สูง ซึม หรือขาดน้ำ' },
  { re: /ไข้สูง.{0,10}(หลายวัน|[3-9] ?วัน|ไม่ลด)/, why: 'ไข้สูงหลายวันไม่ลด' },
  { re: /ตามัวทันที|มองไม่เห็นทันที/, why: 'ตามัวทันที' },
  { re: /ฆ่าตัวตาย|อยากตาย|ทำร้ายตัวเอง/, why: 'มีความคิดทำร้ายตัวเอง (สายด่วนสุขภาพจิต 1323)' },
];

export function redFlags(text: string): string[] {
  const t = text.replace(/\s+/g, '');
  return [...new Set(RED_FLAGS.filter((f) => f.re.test(t)).map((f) => f.why))];
}

/* ── 2) กลุ่มเสี่ยง ↔ ข้อควรระวังของสมุนไพร ─────────────────── */
type Group = { k: string; label: string; ask: RegExp; caution: RegExp };
const GROUPS: Group[] = [
  { k: 'preg', label: 'หญิงตั้งครรภ์/ให้นมบุตร', ask: /ตั้งครรภ์|ตั้งท้อง|มีครรภ์|คนท้อง|แพ้ท้อง|ให้นมลูก|ให้นมบุตร|ลูกอ่อน/, caution: /ตั้งครรภ์|ให้นมบุตร|แท้ง|มดลูก/ },
  { k: 'child', label: 'เด็ก', ask: /เด็ก|ทารก|ลูก(อายุ)?\d+(ขวบ|เดือน)|\d+ขวบ/, caution: /เด็ก/ },
  { k: 'liver', label: 'โรคตับ', ask: /โรคตับ|ตับอักเสบ|ตับแข็ง|ไขมันพอกตับ|ค่าตับ/, caution: /ตับ/ },
  { k: 'kidney', label: 'โรคไต', ask: /โรคไต|ไตเสื่อม|ไตวาย|ฟอกไต|ค่าไต|ไตทำงาน/, caution: /ไต|โพแทสเซียม/ },
  { k: 'heart', label: 'โรคหัวใจ', ask: /โรคหัวใจ|หัวใจเต้นผิด|หัวใจโต|ใส่ขดลวด/, caution: /หัวใจ|โพแทสเซียม/ },
  { k: 'dm', label: 'เบาหวาน/ยาลดน้ำตาล', ask: /เบาหวาน|น้ำตาลสูง|ยาลดน้ำตาล|อินซูลิน|metformin|เมทฟอร์มิน/i, caution: /เบาหวาน|น้ำตาล|อินซูลิน|metformin/i },
  { k: 'bp', label: 'ความดันโลหิตสูง/ยาลดความดัน', ask: /ความดัน(สูง|โลหิตสูง)?|ยาลดความดัน/, caution: /ความดัน/ },
  { k: 'blood', label: 'ยาละลายลิ่มเลือด/ต้านเกล็ดเลือด', ask: /วาร์ฟาริน|warfarin|แอสไพริน|aspirin|โคลพิโดเกรล|clopidogrel|ยาละลายลิ่มเลือด|ยาต้านการแข็งตัว|ยาต้านเกล็ด|ยากันเลือดแข็ง/i, caution: /แข็งตัวของเลือด|ลิ่มเลือด|เกล็ดเลือด|เลือดออกง่าย|เลือดหยุดยาก|วาร์ฟาริน|แอสไพริน/ },
  { k: 'gallstone', label: 'นิ่วในถุงน้ำดี', ask: /นิ่วในถุงน้ำดี|ถุงน้ำดี/, caution: /ถุงน้ำดี|ท่อน้ำดี/ },
  { k: 'ulcer', label: 'แผลในกระเพาะ/กรดไหลย้อน', ask: /แผลในกระเพาะ|โรคกระเพาะ|กรดไหลย้อน/, caution: /กระเพาะ|กรดไหลย้อน/ },
  { k: 'fever', label: 'กำลังมีไข้', ask: /มีไข้|เป็นไข้|ตัวร้อน|ไข้ขึ้น/, caution: /ขณะมีไข้|มีไข้ไม่ควร|ผู้มีไข้/ },
];

export type RiskCtx = { age?: number; birthDate?: string; sex?: string; chronic?: string; allergies?: string; meds?: string[] };

/** กลุ่มเสี่ยงจากคำถาม + ข้อมูลผู้ป่วย (อายุ โรคประจำตัว ยาที่ใช้) */
export function riskGroups(text: string, p?: RiskCtx | null): Group[] {
  const src = `${text} ${p?.chronic ?? ''} ${(p?.meds ?? []).join(' ')}`.replace(/\s+/g, '');
  const out = GROUPS.filter((g) => g.ask.test(src));
  // ไม่ทราบอายุ (บันทึกเป็น 0) ห้ามถือเป็นเด็ก
  const age = p ? knownAge(p) : undefined;
  if (age != null && age < 12 && !out.some((g) => g.k === 'child')) out.push(GROUPS.find((g) => g.k === 'child')!);
  return out;
}

export type Conflict = { herb: Herb; group: string; caution: string };

/** สมุนไพรที่ข้อควรระวังตรงกับกลุ่มเสี่ยง (จากข้อความในคลังสมุนไพรเท่านั้น) */
export function herbConflicts(hs: Herb[], groups: Group[]): Conflict[] {
  const out: Conflict[] = [];
  for (const h of hs) for (const g of groups) if (g.caution.test(h.caution)) out.push({ herb: h, group: g.label, caution: h.caution });
  return out;
}

/** แพ้ยา/สมุนไพร: ชื่อในประวัติแพ้ที่ตรงกับสมุนไพรที่กำลังคุย */
export function allergyHits(hs: Herb[], allergies?: string): Herb[] {
  const a = (allergies ?? '').replace(/\s+/g, '');
  if (!a || a === 'ไม่มี') return [];
  return hs.filter((h) => a.includes(h.name.replace(/\s+/g, '')));
}

/** คำสั่งความปลอดภัยที่แนบให้ AI */
export function safetyBlock(flags: string[], groups: Group[], conflicts: Conflict[], allergic: Herb[]): string {
  const b: string[] = [];
  if (flags.length)
    b.push(`⚠ สัญญาณอันตรายในคำถาม: ${flags.join(' · ')}\nต้องบอกคุณหมอเป็นอย่างแรกว่าควรพาผู้ป่วยไปโรงพยาบาลหรือโทร 1669 ทันที ห้ามแนะนำให้รักษาด้วยสมุนไพรแทนการไปโรงพยาบาล`);
  if (groups.length) b.push(`ผู้ป่วยอยู่ในกลุ่มเสี่ยง: ${groups.map((g) => g.label).join(', ')} — เลือกเฉพาะสมุนไพร/ตำรับที่ปลอดภัยกับกลุ่มนี้ และบอกข้อระวังที่เกี่ยวข้อง`);
  if (conflicts.length) b.push(`ข้อควรระวังที่ขัดกับผู้ป่วยกลุ่มเสี่ยง (จากคลังสมุนไพร ต้องแจ้งคุณหมอถ้าพูดถึงสมุนไพรเหล่านี้ หรือเลี่ยงไปใช้ตัวอื่น):\n${conflicts.map((c) => `• ${c.herb.name} — ${c.group}: ${c.caution}`).join('\n')}`);
  if (allergic.length) b.push(`ผู้ป่วยมีประวัติแพ้: ${allergic.map((h) => h.name).join(', ')} — ห้ามแนะนำสมุนไพรเหล่านี้`);
  return b.join('\n\n');
}

/**
 * ตรวจคำตอบหลัง AI ตอบ: ถ้ามีสัญญาณอันตรายแต่ไม่ได้บอกให้ไปโรงพยาบาล → เติมคำเตือนไว้บนสุด
 * ถ้าแนะนำสมุนไพรที่ขัดกับกลุ่มเสี่ยงโดยไม่เตือน → เติมข้อควรระวังท้ายคำตอบ
 */
export function guardReply(reply: string, flags: string[], conflicts: Conflict[], mode: 'chat' | 'voice'): string {
  let out = reply;
  if (flags.length && !/โรงพยาบาล|1669|ส่งต่อ|พบแพทย์|หาหมอ/.test(reply)) {
    out = mode === 'voice' ? `อาการนี้อันตรายครับ ควรพาไปโรงพยาบาลหรือโทร 1669 ทันที ${out}` : `⚠️ อาการนี้อาจอันตราย: ${flags[0]}\nควรพาไปโรงพยาบาลหรือโทร 1669 ทันที\n\n${out}`;
  }
  if (mode === 'chat') {
    const missed = conflicts.filter((c) => out.includes(c.herb.name) && !out.includes(c.group.split('/')[0]) && !/ระวัง|ห้าม|ไม่ควร/.test(sentenceWith(out, c.herb.name)));
    const uniq = [...new Map(missed.map((c) => [c.herb.id, c])).values()].slice(0, 3);
    if (uniq.length) out += `\n\n⚠️ ข้อควรระวังสำหรับผู้ป่วยรายนี้\n${uniq.map((c) => `• ${c.herb.name} (${c.group}): ${c.caution}`).join('\n')}`;
  }
  return out;
}

const sentenceWith = (text: string, word: string) => text.split(/\n|(?<=[.!?])\s/).filter((s) => s.includes(word)).join(' ');

/* ── 3) สมุนไพร ↔ ยาแผนปัจจุบัน (บัญชียาหลักแห่งชาติด้านสมุนไพร 2566) ── */
export type DrugHit = { it: HerbDrug; hit: boolean };

/** อันตรกิริยาของสมุนไพรแต่ละตัว · hit = ยาของผู้ป่วย (ข้อความ/รายการยา) หรือกลุ่มยาที่เลือก ตรงกับกลุ่มยาในประกาศ */
export function drugInteractions(h: Herb, medsText: string, picked: DrugClass[] = [], hasMeds = false): DrugHit[] {
  const t = medsText.replace(/\s+/g, '');
  return HERB_DRUG.filter((x) => x.herb === h.id).map((it) => {
    const re = DRUG_MATCH[it.drug];
    const hit = picked.includes(it.drug) || (re ? re.test(t) : hasMeds);
    return { it, hit };
  });
}
