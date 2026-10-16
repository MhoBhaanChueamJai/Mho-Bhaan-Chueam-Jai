/**
 * คลังความรู้ของครูปัญญา — ค้นตำราในคลังภูมิ (ตำราอ้างอิงในระบบ + ตำราที่หมอบันทึกเอง) ที่เกี่ยวกับเรื่องที่กำลังคุย
 * แล้วแนบให้ AI ใช้ประกอบการวิเคราะห์/แนะนำ (RAG แบบเบา ทำงานในเครื่อง ไม่ต้องมีเซิร์ฟเวอร์ค้นหา)
 * ยิ่งหมอบันทึกตำราเพิ่ม ครูปัญญายิ่งมีความรู้ให้ค้นมากขึ้น
 *
 * การจับคู่: ภาษาไทยไม่เว้นวรรคคำ จึงเทียบด้วย "ชิ้นตัวอักษร 3 ตัว" (trigram) ของคำค้นกับตำรา
 * ให้น้ำหนัก: ชื่อเรื่อง/ใช้แก้ > ตัวยา > เนื้อหา/วิธีใช้/ข้อห้าม
 */
import type { Wisdom } from '../data/mock';
import { KIND_FORM, plainText, splitMethod } from './wisdomKinds';

const ORIGIN_RE = /\n*(ได้รับสืบทอดจาก|แหล่งที่มา):\s*(.+)$/;
// คำทั่วไปที่ไม่ช่วยแยกเรื่อง (ตัดออกก่อนเทียบ)
const STOP = /(ครับ|ค่ะ|คะ|นะ|หน่อย|อะไร|อย่างไร|ยังไง|ได้ไหม|ไหม|บ้าง|ดี|ใช้|ผู้ป่วย|คนไข้|อาการ|รักษา|สมุนไพร|ยา(?=\s|$))/g;

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^฀-๿a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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

type Doc = { w: Wisdom; head: Set<string>; ing: Set<string>; body: Set<string> };
let cache: { key: string; docs: Doc[] } | null = null;
function index(list: Wisdom[]): Doc[] {
  const key = list.map((w) => `${w.id}:${w.title.length}:${(w.summary ?? '').length}`).join('|');
  if (cache?.key === key) return cache.docs;
  const docs = list.map((w) => ({
    w,
    head: grams(`${w.title} ${w.indication ?? ''}`),
    ing: grams((w.ingredients ?? []).join(' ')),
    body: grams(`${plainText(w.summary)} ${w.method ?? ''} ${w.caution ?? ''}`),
  }));
  cache = { key, docs };
  return docs;
}

/** ตำราที่เกี่ยวข้องที่สุด k เล่ม (คะแนนต่ำเกินไป = ไม่เกี่ยว ไม่ส่ง) */
export function retrieve(query: string, list: Wisdom[], k = 4): Wisdom[] {
  const q = grams(query.replace(STOP, ' '));
  if (!q.size || !list.length) return [];
  const scored = index(list).map((d) => {
    let s = 0;
    q.forEach((g) => {
      if (d.head.has(g)) s += 3;
      if (d.ing.has(g)) s += 2;
      if (d.body.has(g)) s += 1;
    });
    // ตำราที่หมอบันทึกเอง/ตรวจทานแล้ว ได้น้ำหนักเพิ่มเล็กน้อย (ความรู้เฉพาะของหมอเอง)
    if (!d.w.builtin) s *= 1.15;
    return { w: d.w, s: s / Math.sqrt(q.size) };
  });
  const top = Math.max(0, ...scored.map((x) => x.s));
  // ตัดเล่มที่เกี่ยวน้อย: ต้องผ่านเกณฑ์ขั้นต่ำ และไม่ห่างจากเล่มที่ตรงที่สุดเกินไป
  return scored
    .filter((x) => x.s >= 3.5 && x.s >= top * 0.3)
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x) => x.w);
}

/** สรุปตำรา 1 เล่มให้ AI อ่าน (กระชับ ไม่เกิน ~maxChars) */
function brief(w: Wisdom, maxChars: number): string {
  const f = KIND_FORM[w.kind] ?? KIND_FORM['ตำรับยา'];
  const om = (w.summary ?? '').match(ORIGIN_RE);
  const body = plainText((w.summary ?? '').replace(ORIGIN_RE, '')).replace(/\s+/g, ' ').trim();
  const { steps, extra } = splitMethod(w.kind, w.method);
  const src = w.builtin ? `ตำราอ้างอิงในระบบ${w.refs?.[0] ? ` (${w.refs[0].org ?? w.refs[0].title})` : ''}` : w.sharedBy ? `ตำราจาก ${w.sharedBy}` : 'ตำราของหมอเอง';
  const lines = [
    `【${w.title}】 ${w.kind} · ${src}${om ? ` · ${om[1]} ${om[2]}` : ''}`,
    w.indication ? `${f.indication.label}: ${w.indication}` : '',
    w.ingredients?.length ? `${f.ingredients?.label ?? 'ตัวยา'}: ${w.ingredients.join(', ')}` : '',
    steps.length && !f.method.hidden ? `${f.method.label}: ${steps.join(' / ')}` : '',
    extra && f.extra ? `${f.extra.label}: ${extra}` : '',
    w.caution ? `${f.caution.label}: ${w.caution}` : '',
    body ? `เนื้อหา: ${body}` : '',
  ].filter(Boolean);
  const text = lines.join('\n');
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

/** ข้อความความรู้จากคลังภูมิสำหรับแนบใน prompt + รายการตำราที่ใช้ (ไว้แสดงที่มาให้หมอกดดู) */
export function knowledgeFor(query: string, list: Wisdom[], k = 4, budget = 3200): { text: string; used: Wisdom[] } {
  const used = retrieve(query, list, k);
  if (!used.length) return { text: '', used };
  const per = Math.floor(budget / used.length);
  const text = `ความรู้จากคลังภูมิ (ตำราที่เกี่ยวข้อง ${used.length} เล่ม — ใช้ประกอบการวิเคราะห์และแนะนำเมื่อเกี่ยวข้อง ถ้าใช้ข้อมูลจากเล่มไหนให้เอ่ยชื่อตำรานั้น ห้ามแต่งตัวยา ขนาดยา หรือสรรพคุณเกินจากที่ตำราระบุ ถ้าข้อห้ามในตำราตรงกับผู้ป่วยต้องเตือน):
${used.map((w) => brief(w, per)).join('\n\n')}`;
  return { text, used };
}
