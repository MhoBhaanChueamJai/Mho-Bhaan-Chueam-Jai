/**
 * แนวทางการรักษาจากครูปัญญา (ซักประวัติ → ภาวะที่น่าจะเป็น → แนวทางรักษา)
 *  - แผนไทย: สมุนไพร ตำรับยา หัตถการ ตามคลังความรู้ (แนวทางเวชกรรมไทย 2568 / ตำราอ้างอิง 2568 / บัญชียาหลักฯ / THP)
 *  - แผนปัจจุบัน: เฉพาะยาสามัญประจำบ้านตามประกาศกระทรวงสาธารณสุข + บอกเมื่อต้องส่งต่อแพทย์
 * ทุกข้อต้องอ้างหัวข้อในคลังที่ส่งให้ AI เท่านั้น — ข้อที่อ้างไม่ได้ถูกตัดทิ้ง (ไม่แต่งแหล่งอ้างอิงเอง)
 * ข้อเตือนความปลอดภัย (สัญญาณอันตราย กลุ่มเสี่ยง แพ้ยา) คำนวณในเครื่องจากข้อมูลที่ตรวจแล้ว ไม่ขึ้นกับ AI
 */
import { chatJSON } from '../api/ai';
import type { Herb } from '../data/herbs';
import type { HouseholdMed } from '../data/household';
import type { Patient } from '../data/mock';
import { herbsFor, householdFor, pharmacyFor } from './brain';
import { allergyHits, drugInteractions, herbConflicts, redFlags, riskGroups } from './safety';
import { citeLabel, docById, herbDocId, medDocId, type KDoc } from './sources';
import { roleBrief, userNoun } from './roles';
import { expandQuery } from './synonyms';
import { historyText } from './visit';

export type PlanCase = { symptoms: string; duration?: string; exam?: string; vitals?: string; diagnosis?: string; /** คำตอบซักประวัติเพิ่ม (ถาม → ตอบ) */ answers?: { q: string; a: string }[] };
/** ผู้ที่ขอคำแนะนำ: ผู้ป่วยในทะเบียน หรือผู้ใช้ทั่วไปที่ปรึกษาอาการตัวเอง (ไม่ต้องมีบัตรผู้ป่วย) */
export type PlanPerson = { name?: string; sex?: string; age?: number; element?: string; chronic?: string; allergies?: string; meds?: string[]; history?: string };
const personOf = (p: Patient | PlanPerson): PlanPerson => ('visits' in p ? { name: p.name, sex: p.sex, age: p.age, element: p.element, chronic: p.chronic, allergies: p.allergies, meds: p.meds, history: historyText(p) } : p);
export type PlanRef = { id: string; label: string };
export type PlanItem = { text: string; refs: PlanRef[] };
export type ReferLevel = 'now' | 'soon' | 'none';

export type TreatmentPlan = {
  /** ภาวะที่น่าจะเป็น (แผนไทย / แผนปัจจุบัน) */
  thaiDx: string;
  modernDx: string;
  reason: string;
  /** คำถามซักประวัติเพิ่มเพื่อแยกโรค */
  ask: string[];
  refer: { level: ReferLevel; reason: string };
  thai: PlanItem[];
  modern: PlanItem[];
  care: PlanItem[];
  followUp: string;
  /** เตือนในเครื่อง: สัญญาณอันตราย กลุ่มเสี่ยง แพ้ยา ข้อห้ามของยาสามัญฯ */
  warnings: string[];
  /** หัวข้อในคลังที่ครูปัญญาใช้ */
  used: PlanRef[];
};

type Raw = {
  thaiDx?: string;
  modernDx?: string;
  reason?: string;
  ask?: string[];
  refer?: { level?: string; reason?: string };
  thai?: { text?: string; src?: string[] }[];
  modern?: { text?: string; src?: string[] }[];
  care?: { text?: string; src?: string[] }[];
  followUp?: string;
};

/* คำตอบจาก 2 โมเดลถูกรวมกัน → ตัดข้อที่ซ้ำ/ใกล้เคียงกัน (ไตรแกรมซ้อนกันเกินครึ่ง) */
const tri = (s: string) => {
  const t = s.replace(/[\s.,:;()·\-]/g, '');
  const g = new Set<string>();
  for (let i = 0; i + 3 <= t.length; i++) g.add(t.slice(i, i + 3));
  return g;
};
const similar = (a: string, b: string) => {
  const A = tri(a);
  const B = tri(b);
  if (!A.size || !B.size) return a === b;
  let n = 0;
  A.forEach((g) => B.has(g) && n++);
  return n / Math.min(A.size, B.size) > 0.6;
};
export function dedupeText(list: string[]) {
  return list.filter((x, i) => !list.slice(0, i).some((y) => similar(x, y)));
}
export function dedupe(list: PlanItem[]) {
  return list.filter((x, i) => !list.slice(0, i).some((y) => similar(x.text, y.text)));
}

/** ตัดรหัสอ้างอิงที่หลุดมาในข้อความ เช่น [S1, S5] */
/** คำตอบปฏิเสธ — ไม่นับเป็นอาการ/กลุ่มเสี่ยง */
const NEGATIVE = /^(ไม่|ไม่มี|ไม่ได้|ไม่เคย|ไม่ใช่|ปกติ|no\b)/i;

export const strip = (v: unknown) => String(v ?? '').replace(/\[[\sSH\d,]*\]/g, '').replace(/\s+/g, ' ').trim();
export const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

const medBrief = (m: HouseholdMed) =>
  `${m.name}${m.kind === 'traditional' ? ' (ยาสามัญประจำบ้านแผนโบราณ)' : ''}\nข้อบ่งใช้: ${m.use}${m.how ? `\nวิธีใช้: ${clip(m.how, 260)}` : ''}${m.caution ? `\nคำเตือน: ${clip(m.caution, 260)}` : ''}`;
export const herbBrief = (h: Herb) => `${h.name} (${h.sci}) รส${h.taste}\nสรรพคุณ: ${h.uses.join(', ')}\nวิธีใช้: ${h.howto}\nข้อควรระวัง: ${h.caution}`;

export function caseText(c: PlanCase) {
  const qa = (c.answers ?? []).filter((x) => x.a.trim());
  return [c.symptoms && `อาการ: ${c.symptoms}`, c.duration && `เป็นมา: ${c.duration}`, c.exam && `ตรวจพบ: ${c.exam}`, c.vitals && `สัญญาณชีพ: ${c.vitals}`, c.diagnosis && `วินิจฉัยเบื้องต้น: ${c.diagnosis}`, qa.length ? `ซักประวัติเพิ่ม:\n${qa.map((x) => `• ${x.q} → ${x.a}`).join('\n')}` : ''].filter(Boolean).join('\n');
}

export async function treatmentPlan(who: Patient | PlanPerson, c: PlanCase): Promise<TreatmentPlan> {
  const p = personOf(who);
  const text = caseText(c);
  // ค้นทีละอาการ (ไข้ / เจ็บคอ / ปวดหัว …) แล้วรวมแบบสลับกัน — ไม่ให้อาการที่มีคำยาวๆ กลบอาการอื่น
  const phrases = [...`${c.symptoms} ${c.diagnosis ?? ''}`.split(/[\s,，·/]+|และ|กับ|ร่วมกับ/), `${c.symptoms} ${c.diagnosis ?? ''} ${c.exam ?? ''}`]
    .map((x) => x.trim())
    .filter((x) => x.length >= 2 && !/^\d|^(วัน|สัปดาห์|เดือน|ปี|ครั้ง|มา|เป็น|มาก|น้อย)$/.test(x));
  const qs = [...new Set(phrases)].map(expandQuery);
  const roundRobin = <T extends { id: string }>(lists: T[][], k: number) => {
    const out = new Map<string, T>();
    for (let i = 0; out.size < k && lists.some((l) => l[i]); i++) for (const l of lists) if (l[i] && out.size < k) out.set(l[i].id, l[i]);
    return [...out.values()];
  };
  // คลังที่ส่งให้ AI: S = ความรู้แผนไทย/สมุนไพร · H = ยาสามัญประจำบ้าน
  const docs = roundRobin(qs.map((q) => pharmacyFor(q, 3)), 7);
  const hs = roundRobin(qs.map((q) => herbsFor(q, 3)), 6);
  const meds = [...roundRobin(qs.map((q) => householdFor(q, 3, 'modern')), 5), ...roundRobin(qs.map((q) => householdFor(q, 2, 'traditional')), 3)];
  const S: { key: string; doc: KDoc; body: string }[] = [
    ...docs.map((d) => ({ key: '', doc: docById(d.id)!, body: `${d.title}\n${clip(d.text, 900)}` })),
    ...hs.map((h) => ({ key: '', doc: docById(herbDocId(h))!, body: herbBrief(h) })),
  ].filter((x) => x.doc);
  S.forEach((x, i) => (x.key = `S${i + 1}`));
  const H = meds.map((m, i) => ({ key: `H${i + 1}`, doc: docById(medDocId(m))!, med: m, body: medBrief(m) })).filter((x) => x.doc);

  const r = await chatJSON<Raw>(
    [
      {
        role: 'user',
        content: `${roleBrief()}
ผู้ป่วย: ${[p.name, p.sex, p.age ? `${p.age} ปี` : '', p.element ? `ธาตุเจ้าเรือน${p.element}` : ''].filter(Boolean).join(' ') || 'ไม่ระบุ'} · โรคประจำตัว ${p.chronic || 'ไม่ทราบ'} · แพ้ ${p.allergies || 'ไม่ทราบ'} · ยาที่ใช้อยู่ ${p.meds?.join(', ') || 'ไม่มี/ไม่ทราบ'}
ประวัติการรักษา:
${p.history || '(ไม่มี)'}

ครั้งนี้:
${text}

คลังความรู้ (ใช้ได้เฉพาะข้อมูลในนี้ อ้างด้วยรหัสในวงเล็บเหลี่ยม):
${S.map((x) => `[${x.key}] ${x.body}`).join('\n\n') || '(ไม่มีหัวข้อที่ตรง)'}

ยาสามัญประจำบ้าน (ประกาศกระทรวงสาธารณสุข — แผนปัจจุบันแนะนำได้เฉพาะรายการนี้):
${H.map((x) => `[${x.key}] ${x.body}`).join('\n\n') || '(ไม่มีรายการที่ตรงกับอาการ)'}

ช่วย${userNoun()}วางแนวทางการรักษาเบื้องต้น ตอบเป็นภาษาไทย กระชับ:
- thaiDx: ภาวะที่น่าจะเป็นตามการแพทย์แผนไทย · modernDx: ภาวะที่น่าจะเป็นตามแผนปัจจุบัน (ใช้คำว่า "สงสัย" ห้ามฟันธง)
- ask: คำถามซักประวัติเพิ่ม 2-4 ข้อที่ช่วยแยกโรคหรือคัดกรองอันตราย
- refer.level: "now" ต้องไปโรงพยาบาลทันที / "soon" ควรพบแพทย์ภายใน 1-3 วัน / "none" ดูแลเบื้องต้นได้ พร้อมเหตุผล
- thai: แนวทางแผนไทย (สมุนไพร ตำรับยา หัตถการ) 1-4 ข้อ แต่ละข้อต้องมี src เป็นรหัส S ที่ใช้ ห้ามใส่ขนาดยาที่ไม่มีในคลัง
- modern: ยาสามัญประจำบ้าน 0-3 ข้อ ใช้ได้เฉพาะรหัส H เท่านั้น (ห้ามแนะนำยาอื่น ยาที่ต้องสั่งโดยแพทย์ หรือยาฉีด) บอกวิธีใช้ตามคลัง
- care: การปฏิบัติตัว/อาหาร/ของแสลง 1-3 ข้อ (src ใส่รหัสที่เกี่ยวข้อง หรือ [] ถ้าเป็นคำแนะนำทั่วไป)
- followUp: ติดตามอาการเมื่อไร และอาการแบบไหนต้องกลับมาหรือไปโรงพยาบาล
ถ้ารักษาแบบเดิมแล้วไม่ดีขึ้นให้เสนอทางอื่นหรือส่งต่อ ห้ามแนะนำสิ่งที่ขัดกับโรคประจำตัว ยาที่ใช้อยู่ หรือที่แพ้
ตอบ JSON เท่านั้น:
{"thaiDx":"","modernDx":"","reason":"เหตุผลสั้นๆ","ask":[""],"refer":{"level":"none","reason":""},"thai":[{"text":"","src":["S1"]}],"modern":[{"text":"","src":["H1"]}],"care":[{"text":"","src":[]}],"followUp":""}`,
      },
    ],
    undefined,
    { maxTokens: 1600, timeoutMs: 60_000 },
  );

  const byKey = new Map<string, KDoc>([...S.map((x) => [x.key, x.doc] as const), ...H.map((x) => [x.key, x.doc] as const)]);
  const refsOf = (src: unknown, allow: RegExp) =>
    [...new Set((Array.isArray(src) ? src : []).map((k) => String(k).replace(/[[\]\s]/g, '').toUpperCase()).filter((k) => allow.test(k) && byKey.has(k)))].map((k) => {
      const d = byKey.get(k)!;
      return { id: d.id, label: citeLabel(d) };
    });
  const items = (list: Raw['thai'], allow: RegExp, needRef: boolean) =>
    (Array.isArray(list) ? list : [])
      .map((x) => ({ text: strip(x?.text), refs: refsOf(x?.src, allow) }))
      .filter((x) => x.text && (!needRef || x.refs.length));

  const thai = dedupe(items(r.thai, /^S\d+$/, true));
  const modern = dedupe(items(r.modern, /^H\d+$/, true));
  const care = dedupe(items(r.care, /^[SH]\d+$/, false));

  // ── ความปลอดภัยในเครื่อง ──
  // ตรวจเฉพาะสิ่งที่ผู้ใช้บอก (ไม่รวมคำถามของครูปัญญา เช่น "หายใจลำบากไหม") และข้ามคำตอบปฏิเสธ ("ไม่มี" "ไม่ได้ตั้งครรภ์")
  const said = [c.symptoms, c.duration, c.exam, c.vitals, c.diagnosis, ...(c.answers ?? []).map((x) => x.a).filter((a) => !NEGATIVE.test(a.trim()))].filter(Boolean).join(' ');
  const flags = redFlags(said);
  const groups = riskGroups(said, { age: p.age, sex: p.sex, chronic: p.chronic, allergies: p.allergies, meds: p.meds });
  const usedHerbs = hs.filter((h) => thai.some((t) => t.refs.some((x) => x.id === herbDocId(h)) || t.text.includes(h.name)));
  const warnings = [
    ...flags.map((f) => `สัญญาณอันตราย: ${f} — ควรไปโรงพยาบาลหรือโทร 1669`),
    ...herbConflicts(usedHerbs, groups).map((x) => `${x.herb.name} กับผู้ป่วย${x.group}: ${x.caution}`),
    ...allergyHits(usedHerbs, p.allergies).map((h) => `ผู้ป่วยมีประวัติแพ้${h.name}`),
    // ยาแผนปัจจุบันที่ผู้ป่วยใช้อยู่ ↔ สมุนไพรที่แนะนำ (บัญชียาหลักแห่งชาติด้านสมุนไพร 2566)
    ...usedHerbs.flatMap((h) => drugInteractions(h, (p.meds ?? []).join(' '), [], !!p.meds?.length).filter((x) => x.hit).map((x) => `${h.name} กับ${x.it.label}ที่ผู้ป่วยใช้อยู่: ${x.it.statement}`)),
    ...H.filter((x) => modern.some((m) => m.refs.some((rf) => rf.id === x.doc.id)))
      .flatMap((x) => groups.filter((g) => x.med.caution && g.caution.test(x.med.caution)).map((g) => `${x.med.name} กับผู้ป่วย${g.label}: ${clip(x.med.caution!, 160)}`)),
  ];

  const lv = String(r.refer?.level ?? '').toLowerCase();
  let level: ReferLevel = lv === 'now' ? 'now' : lv === 'soon' ? 'soon' : 'none';
  if (flags.length) level = 'now';
  const used = [...new Map([...thai, ...modern, ...care].flatMap((x) => x.refs).map((x) => [x.id, x])).values()];

  return {
    thaiDx: strip(r.thaiDx),
    modernDx: strip(r.modernDx),
    reason: strip(r.reason),
    ask: dedupeText((Array.isArray(r.ask) ? r.ask : []).map(strip).filter(Boolean)).slice(0, 4),
    refer: { level, reason: strip(r.refer?.reason) || (flags.length ? flags[0] : '') },
    thai,
    modern,
    care,
    followUp: strip(r.followUp),
    warnings: [...new Set(warnings)],
    used,
  };
}

/** แนวทางที่เลือก → ข้อความสำหรับช่อง "การรักษา" */
export function planToTreatment(plan: TreatmentPlan, track: 'thai' | 'modern') {
  const list = track === 'thai' ? plan.thai : plan.modern;
  const tail = track === 'modern' && plan.refer.level !== 'none' ? [`แนะนำพบแพทย์${plan.refer.level === 'now' ? 'ทันที' : 'ภายใน 1-3 วัน'}${plan.refer.reason ? ` (${plan.refer.reason})` : ''}`] : [];
  return [...list.map((x) => x.text), ...tail].join(' · ');
}
