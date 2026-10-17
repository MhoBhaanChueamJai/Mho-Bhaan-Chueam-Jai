/**
 * สมองของครูปัญญา — รวมความรู้ทุกแหล่งในเครื่องก่อนส่งให้ AI ตอบ
 *  1) คลังภูมิ: ตำราในระบบ + ตำราที่หมอบันทึกเอง (ยิ่งบันทึกมาก ยิ่งรู้มาก)
 *  2) คลังสมุนไพร 100 ชนิด: รส ธาตุ ส่วนที่ใช้ สรรพคุณ วิธีใช้ ข้อควรระวัง
 *  3) ความรู้เภสัชกรรมไทย: หลักตั้งตำรับ พิกัดยา รสยา วิธีปรุง ตำรับในบัญชียาหลัก ความปลอดภัยในการผสมยา
 *  4) ตรวจความปลอดภัยอัตโนมัติ: สมุนไพรที่ถูกเอ่ยถึง → ข้อควรระวังของแต่ละตัว + ข้อมูลผู้ป่วย (ถ้ามี)
 * ค้นแบบ trigram ในเครื่อง ไม่ต้องมีเซิร์ฟเวอร์ค้นหา
 */
import { herbs, type Herb } from '../data/herbs';
import type { Wisdom } from '../data/mock';
import { PHARMACY, type PharmacyDoc } from '../data/pharmacy';
import { dialectHint, dialectSpeakStyle } from './dialect';
import { knowledgeFor } from './knowledge';

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^฀-๿a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const STOP = /(ครับ|ค่ะ|คะ|นะ|หน่อย|อะไร|อย่างไร|ยังไง|ได้ไหม|ไหม|บ้าง|คุณหมอ|ครู|ปัญญา|ช่วย|แนะนำ)/g;

function grams(s: string): Set<string> {
  const out = new Set<string>();
  for (const word of norm(s).split(' ')) {
    if (word.length < 3) {
      if (word.length === 2) out.add(word);
      continue;
    }
    for (let i = 0; i + 3 <= word.length; i++) out.add(word.slice(i, i + 3));
  }
  return out;
}

/* ── สมุนไพร ─────────────────────────────────────────────── */
type HerbIdx = { h: Herb; names: string[]; head: Set<string>; body: Set<string> };
let herbIdx: HerbIdx[] | null = null;
function herbIndex() {
  if (herbIdx) return herbIdx;
  herbIdx = herbs.map((h) => ({
    h,
    // ชื่อหลัก + ชื่อท้องถิ่น (ตัดวงเล็บ) ไว้จับชื่อที่ถูกเอ่ยถึงตรงๆ
    names: [h.name, ...h.local.split(/[,，/]/)].map((x) => x.replace(/\(.*?\)/g, '').trim()).filter((x) => x.length >= 2),
    head: grams(`${h.name} ${h.local}`),
    body: grams(`${h.uses.join(' ')} ${h.taste} ธาตุ${h.element}`),
  }));
  return herbIdx;
}

/** สมุนไพรที่ถูกเอ่ยชื่อในข้อความ (ชื่อหลัก/ชื่อท้องถิ่น) — ใช้ตรวจความปลอดภัย */
export function herbsMentioned(text: string): Herb[] {
  const t = text.replace(/\s+/g, '');
  const found = herbIndex().filter((x) => x.names.some((n) => n.length >= 2 && t.includes(n.replace(/\s+/g, ''))));
  // ชื่อสั้นที่เป็นส่วนหนึ่งของชื่อยาวกว่าที่เจอแล้ว (เช่น ขิง ใน ขิงแห้ง ที่ไม่มีในคลัง) ยังเก็บไว้ — แต่ตัดตัวซ้ำ
  return [...new Map(found.map((x) => [x.h.id, x.h])).values()];
}

/** สมุนไพรที่เกี่ยวข้องกับคำถาม: เอ่ยชื่อตรงๆ ก่อน แล้วค่อยตามสรรพคุณที่ตรงกับอาการ */
export function herbsFor(query: string, k = 5): Herb[] {
  const named = herbsMentioned(query);
  const q = grams(query.replace(STOP, ' '));
  if (!q.size) return named.slice(0, k);
  const scored = herbIndex()
    .filter((x) => !named.includes(x.h))
    .map((x) => {
      let s = 0;
      q.forEach((g) => {
        if (x.head.has(g)) s += 3;
        if (x.body.has(g)) s += 1.5;
      });
      if (x.h.nationalList) s *= 1.1;
      return { h: x.h, s: s / Math.sqrt(q.size) };
    })
    .filter((x) => x.s >= 2.4)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.h);
  return [...named, ...scored].slice(0, k);
}

function herbBrief(h: Herb) {
  return [
    `【${h.name}】 (${h.sci}${h.local ? ` · ชื่อท้องถิ่น ${h.local}` : ''})${h.nationalList ? ' · อยู่ในบัญชียาหลักแห่งชาติ' : ''}`,
    `รส${h.taste} · ธาตุ${h.element} · ส่วนที่ใช้: ${h.part}`,
    `สรรพคุณ: ${h.uses.join(', ')}`,
    `วิธีใช้: ${h.howto}`,
    `ข้อควรระวัง: ${h.caution}`,
  ].join('\n');
}

/** ข้อควรระวังของสมุนไพรที่ถูกเอ่ยถึง (ใช้ตอนบันทึกการรักษา: เตือนเมื่อขัดกับโรคประจำตัว/ยาที่ใช้) */
export function safetyNotes(text: string): string {
  const hs = herbsMentioned(text);
  if (!hs.length) return '';
  return `ข้อควรระวังของสมุนไพรที่กล่าวถึง (จากคลังสมุนไพร — ถ้าขัดกับโรคประจำตัว ยาที่ใช้ หรือแพ้ยาของผู้ป่วย ให้เตือนหมอสั้นๆ):\n${hs.map((h) => `• ${h.name} (รส${h.taste}): ${h.caution}`).join('\n')}`;
}

/* ── เภสัชกรรมไทย ─────────────────────────────────────────── */
type DocIdx = { d: PharmacyDoc; head: Set<string>; body: Set<string>; tags: string[] };
let docIdx: DocIdx[] | null = null;
function docIndex() {
  if (docIdx) return docIdx;
  docIdx = PHARMACY.map((d) => ({ d, head: grams(`${d.title} ${d.tags.join(' ')}`), body: grams(d.text), tags: d.tags.map((t) => t.replace(/\s+/g, '')) }));
  return docIdx;
}

/** เรื่องตั้งตำรับ/ผสมยา → ให้น้ำหนักหลักการตั้งตำรับเพิ่ม */
const FORMULA_Q = /(ผสม|ตั้งตำรับ|ตำรับ|สูตร|ปรุง|เข้ายา|พิกัด|สัดส่วน|อัตราส่วน|กี่ส่วน|ยาต้ม|ยาดอง|ลูกกลอน|ยาผง|ยาฝน|ประคบ|ยาหม้อ|รสยา|ตัวยา)/;

export function pharmacyFor(query: string, k = 4): PharmacyDoc[] {
  const q = grams(query.replace(STOP, ' '));
  const flat = query.replace(/\s+/g, '');
  const formula = FORMULA_Q.test(query);
  const scored = docIndex().map((x) => {
    let s = 0;
    q.forEach((g) => {
      if (x.head.has(g)) s += 3;
      if (x.body.has(g)) s += 1;
    });
    s = q.size ? s / Math.sqrt(q.size) : 0;
    // แท็กตรงกับคำในคำถามทั้งคำ (เช่น ชื่อพิกัด ชื่อตำรับ ชื่อสมุนไพร) → ได้คะแนนพิเศษ
    if (x.tags.some((t) => t.length >= 3 && flat.includes(t))) s += 4;
    if (formula && /หลัก|ตั้งตำรับ|ตัวยา/.test(x.d.title)) s += 1.5;
    return { d: x.d, s };
  });
  const top = Math.max(0, ...scored.map((x) => x.s));
  return scored
    .filter((x) => x.s >= 3 && x.s >= top * 0.35)
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x) => x.d);
}

/* ── ผู้ป่วย (บริบทการรักษา) ───────────────────────────────── */
export type PatientCtx = { name?: string; age?: number; sex?: string; element?: string; chronic?: string; allergies?: string; meds?: string[] };

function patientBrief(p: PatientCtx) {
  return [
    `ผู้ป่วยที่กำลังคุยถึง: ${p.name ?? ''} ${p.sex ?? ''} ${p.age ? `อายุ ${p.age} ปี` : ''} ${p.element ? `ธาตุเจ้าเรือน${p.element}` : ''}`.replace(/\s+/g, ' ').trim(),
    p.chronic && p.chronic !== 'ไม่มี' ? `โรคประจำตัว: ${p.chronic}` : '',
    p.allergies && p.allergies !== 'ไม่มี' ? `แพ้ยา/อาหาร: ${p.allergies}` : '',
    p.meds?.length ? `ยาที่ใช้อยู่: ${p.meds.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/* ── คำสั่งหลัก ────────────────────────────────────────────── */
const CORE = `คุณคือ "ครูปัญญา" ผู้ช่วย AI ผู้เชี่ยวชาญการแพทย์แผนไทยและเภสัชกรรมไทย ของแอป "หมอบ้านเชื่อมใจ" คู่คิดของหมอพื้นบ้านไทยอายุ 40–80 ปี
บุคลิก: อบอุ่น สุภาพ ให้เกียรติภูมิปัญญาของหมอ เรียกผู้ใช้ว่า "คุณหมอ" ใช้ภาษาง่าย ประโยคสั้น ลงท้าย "ครับ" แค่ครั้งเดียวต่อช่วง (ห้าม "ครับครับ")

วิธีคิดก่อนตอบ (คิดในใจ ไม่ต้องเขียนขั้นตอนออกมา):
1. คุณหมอถามเรื่องอะไร: สมุนไพรตัวเดียว / การตั้งตำรับ-ผสมยา / อาการ-การดูแลผู้ป่วย / ความปลอดภัย-ยาตีกัน / ทฤษฎีธาตุ-รสยา / เรื่องทั่วไป
2. ใช้ความรู้ที่แนบมาด้านล่างเป็นหลักเสมอ (คลังภูมิ คลังสมุนไพร เภสัชกรรมไทย) — ถ้าไม่มีในความรู้ที่แนบ ใช้ความรู้การแพทย์แผนไทยที่เป็นที่ยอมรับ และบอกตรงๆ เมื่อไม่แน่ใจ ห้ามแต่งตัวยา ขนาดยา หรือสรรพคุณขึ้นเอง
3. ตรวจความปลอดภัยทุกครั้ง: ข้อห้ามของสมุนไพรแต่ละตัว หญิงตั้งครรภ์/ให้นมบุตร เด็ก ผู้สูงอายุ โรคตับ-ไต ยาที่ใช้อยู่ (เช่น ยาต้านการแข็งตัวของเลือด ยาเบาหวาน ยาความดัน) และอาการอันตรายที่ต้องส่งต่อโรงพยาบาล
4. ตอบให้ตรงคำถาม ครบ แต่ไม่ยืดยาว

เมื่อถามเรื่องตั้งตำรับหรือผสมยา ให้ตอบตามหลักเภสัชกรรมไทย:
• ตัวยาตรง (ตัวยาหลักที่แก้อาการ) • ตัวยาช่วย (เสริมฤทธิ์) • ตัวยาคุม (ควบคุม/ลดพิษ ปรับธาตุ) • ตัวยาแต่งกลิ่นรส (ถ้ามี)
• สัดส่วน/ปริมาณ (อ้างตามตำราหรือบัญชียาหลัก ถ้าไม่มีแหล่งให้บอกว่าควรให้หมอปรับตามประสบการณ์)
• รูปแบบยาและวิธีปรุง • ขนาดและวิธีใช้ • ข้อห้าม ข้อควรระวัง ยาตีกัน • เหตุผลตามรสยาและธาตุ
ถ้าตำรับที่ถามตรงกับพิกัดยาหรือตำรับในบัญชียาหลัก ให้บอกชื่อพิกัด/ตำรับนั้น

ข้อห้าม: ห้ามวินิจฉัยแทนแพทย์ ห้ามให้หยุดยาแผนปัจจุบันเอง ห้ามรับรองว่ารักษาหายขาด ห้ามแนะนำสมุนไพรที่มีพิษร้ายแรงโดยไม่เตือน`;

const CHAT_STYLE = `รูปแบบคำตอบ: ไม่ใช้ markdown ไม่ใช้ตาราง ไม่ใช้ ** หรือ # · หัวข้อสั้นขึ้นบรรทัดใหม่ · รายการใช้ "•" · ถ้าใช้ข้อมูลจากตำราเล่มไหนให้เอ่ยชื่อเล่มนั้น`;

const VOICE_STYLE = `กำลังคุยกันด้วยเสียง (คำตอบจะถูกอ่านออกเสียง):
- พูดเหมือนคนคุยกันจริง เป็นธรรมชาติ ประโยคสั้น 2–5 ประโยค ไม่เกิน ~70 คำ
- ห้ามใช้หัวข้อ รายการ สัญลักษณ์ ตัวเลขข้อ หรือวงเล็บ — เล่าต่อเนื่องเป็นคำพูด
- ใช้คำเชื่อมแบบภาษาพูด เช่น "ได้เลยครับ" "อันนี้ต้องระวังนิดนึงนะครับ"
- ตอบส่วนสำคัญที่สุดก่อน ถ้ามีรายละเอียดมาก บอกสั้นๆ แล้วถามว่าอยากให้อธิบายต่อไหม
- จบด้วยคำถามสั้นๆ ชวนคุยต่อเมื่อเหมาะสม (เช่น ถามอาการเพิ่ม ถามอายุผู้ป่วย)
- ตัวเลขเขียนเป็นตัวเลขอารบิก หน่วยเขียนเต็ม เช่น "3 กรัม" "วันละ 2 ครั้ง"`;

export type Brain = { system: string; sources: { id: string; title: string; kind: 'wisdom' | 'herb' }[]; herbsUsed: Herb[] };

/**
 * สร้างคำสั่งระบบ + ความรู้ที่เกี่ยวข้อง สำหรับคำถามล่าสุด
 * query = คำถามล่าสุด (+ คำถามก่อนหน้า 1–2 ข้อ เพื่อคงบริบท)
 */
export function think(query: string, opts: { wisdoms: Wisdom[]; mode: 'chat' | 'voice'; patient?: PatientCtx | null }): Brain {
  const kn = knowledgeFor(query, opts.wisdoms, opts.mode === 'voice' ? 3 : 4, opts.mode === 'voice' ? 2200 : 3200);
  const hs = herbsFor(query, opts.mode === 'voice' ? 4 : 5);
  const docs = pharmacyFor(query, opts.mode === 'voice' ? 3 : 4);
  const named = herbsMentioned(query);
  const blocks: string[] = [CORE, opts.mode === 'voice' ? VOICE_STYLE : CHAT_STYLE, `- ${dialectHint()}`, `- ${dialectSpeakStyle()}`];
  if (opts.patient) blocks.push(patientBrief(opts.patient));
  if (docs.length) blocks.push(`ความรู้เภสัชกรรมไทย (จากแหล่งทางการ ใช้อ้างอิงเรื่องหลักการ พิกัดยา ตำรับ วิธีปรุง ความปลอดภัย):\n${docs.map((d) => `【${d.title}】\n${d.text}`).join('\n\n')}`);
  if (hs.length) blocks.push(`ข้อมูลจากคลังสมุนไพรของแอป (เชื่อถือได้ ใช้ก่อนความรู้ทั่วไป):\n${hs.map(herbBrief).join('\n\n')}`);
  if (kn.text) blocks.push(kn.text);
  // ผสมสมุนไพรตั้งแต่ 2 ตัว → ย้ำให้ตรวจข้อห้ามรวมกัน
  if (named.length >= 2) blocks.push(`คุณหมอเอ่ยถึงสมุนไพร ${named.length} ชนิด (${named.map((h) => h.name).join(', ')}) — ตรวจข้อควรระวังของทุกตัวรวมกัน รสยาที่ขัดกัน และผลต่อกลุ่มเสี่ยง ก่อนแนะนำให้ผสม`);
  return {
    system: blocks.join('\n\n'),
    sources: [
      ...kn.used.map((w) => ({ id: w.id, title: w.title, kind: 'wisdom' as const })),
      ...hs.map((h) => ({ id: h.id, title: h.name, kind: 'herb' as const })),
    ],
    herbsUsed: hs,
  };
}

/** เก็บกวาดคำตอบ: ตัด markdown ที่หลุดมา คำซ้ำ "ครับครับ" ช่องว่างซ้อน */
export function tidyReply(text: string, mode: 'chat' | 'voice' = 'chat') {
  let t = text
    .replace(/\*\*|__|^#+\s*/gm, '')
    .replace(/(ครับ\s*){2,}/g, 'ครับ ')
    .replace(/(ค่ะ\s*){2,}/g, 'ค่ะ ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim();
  if (mode === 'voice') t = t.replace(/^\s*(?:[-•*]|\d+[.)])\s*/gm, '').replace(/\n+/g, ' ');
  return t;
}

/** ที่มาที่ควรแสดง: ตำรา/สมุนไพรที่ถูกเอ่ยชื่อในคำตอบ (ไม่เอ่ยเลย → ตำราที่ตรงที่สุด 1 เล่ม) */
export function citedSources(reply: string, b: Brain) {
  const named = b.sources.filter((s) => reply.includes(s.title.replace(/\s*\(.*\)$/, '')));
  if (named.length) return named.slice(0, 5);
  const firstW = b.sources.find((s) => s.kind === 'wisdom');
  return firstW ? [firstW] : [];
}
