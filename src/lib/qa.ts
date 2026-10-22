/**
 * คำถามที่พบบ่อย + แบบทดสอบความรู้ — สร้างจากคลังความรู้ในแอปโดยตรง (ไม่ใช้ AI แต่งเนื้อหา)
 * ทุกคำตอบ/เฉลยมีป้ายแหล่งอ้างอิงที่แตะเปิดอ่านได้ · ใช้ได้แม้ไม่มีอินเทอร์เน็ต
 */
import { herbs, type Herb } from '../data/herbs';
import { HOUSEHOLD } from '../data/household';
import { HERB_DRUG } from '../data/interactions';
import { PHARMACY } from '../data/pharmacy';
import { THAIMED } from '../data/thaimed';
import { THP } from '../data/thp';
import { citeLabel, docById, herbDocId, ixDocId, medDocId } from './sources';

export type Ref = { id: string; label: string };
const ref = (id: string): Ref[] => {
  const d = docById(id);
  return d ? [{ id: d.id, label: citeLabel(d) }] : [];
};
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trim()}…` : s);
const cleanDoc = (t: string) => t.replace(/\n?\(ที่มา:[^)]*\)\s*$/, '').trim();

/* ───────────────────────── คำถามที่พบบ่อย ───────────────────────── */
export type FaqCat = 'สมุนไพร' | 'ข้อควรระวัง' | 'ยาสามัญประจำบ้าน' | 'ดูแลสุขภาพ';
export type Faq = { id: string; cat: FaqCat; q: string; a: string; refs: Ref[] };
export const FAQ_CATS: FaqCat[] = ['สมุนไพร', 'ข้อควรระวัง', 'ยาสามัญประจำบ้าน', 'ดูแลสุขภาพ'];

/** สมุนไพรที่ข้อมูลยืนยันได้ดีที่สุด: อยู่ในตำรามาตรฐานยาสมุนไพรไทยหรือบัญชียาหลัก */
const core = () => herbs.filter((h) => THP[h.id] || h.nationalList);

let faqCache: Faq[] | null = null;
export function faqList(): Faq[] {
  if (faqCache) return faqCache;
  const out: Faq[] = [];
  for (const h of core()) {
    out.push({ id: `use-${h.id}`, cat: 'สมุนไพร', q: `${h.name} ใช้ทำอะไร ใช้อย่างไร`, a: `สรรพคุณ: ${h.uses.join(', ')}\nส่วนที่ใช้: ${h.part}\nวิธีใช้: ${h.howto}`, refs: ref(herbDocId(h)) });
    const ix = HERB_DRUG.filter((x) => x.herb === h.id);
    if (h.caution || ix.length)
      out.push({
        id: `caution-${h.id}`,
        cat: 'ข้อควรระวัง',
        q: `${h.name} ห้ามใช้กับใคร ต้องระวังอะไร`,
        a: [h.caution && `ข้อควรระวัง: ${h.caution}`, ...ix.map((x) => `ใช้ร่วมกับ${x.label}: ${x.statement}`)].filter(Boolean).join('\n'),
        refs: [...ref(herbDocId(h)), ...ix.flatMap((x) => ref(ixDocId(x)))],
      });
  }
  // ยาสามัญประจำบ้านแผนปัจจุบัน ตามกลุ่มอาการ
  const groups = [...new Set(HOUSEHOLD.filter((m) => m.kind === 'modern' && m.group).map((m) => m.group!))];
  for (const g of groups) {
    const ms = HOUSEHOLD.filter((m) => m.group === g);
    out.push({ id: `hh-${g}`, cat: 'ยาสามัญประจำบ้าน', q: `ยาสามัญประจำบ้านกลุ่ม${g} มีอะไรบ้าง`, a: ms.map((m) => `• ${m.name}: ${clip(m.use, 140)}`).join('\n'), refs: ms.slice(0, 3).flatMap((m) => ref(medDocId(m))) });
  }
  // ความปลอดภัยของยาสมุนไพร + การดูแลตนเองตามแนวทางเวชกรรมไทย
  for (const d of PHARMACY.filter((x) => x.id.startsWith('safe-'))) out.push({ id: d.id, cat: 'ข้อควรระวัง', q: d.title, a: clip(cleanDoc(d.text), 900), refs: ref(d.id) });
  for (const d of THAIMED.filter((x) => /ดูแลตนเอง|ปฏิบัติตัว|อาหาร|ออกกำลัง|ส่งต่อ|selfcare|lifestyle/i.test(`${x.title} ${x.id}`)))
    out.push({ id: d.id, cat: 'ดูแลสุขภาพ', q: d.title, a: clip(cleanDoc(d.text), 900), refs: ref(d.id) });
  faqCache = out;
  return out;
}

/* ───────────────────────── แบบทดสอบความรู้ ───────────────────────── */
export type QuizQ = { q: string; choices: string[]; answer: number; explain: string; refs: Ref[] };

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const shuffle = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
/** สร้างข้อสอบ 4 ตัวเลือก (คำตอบถูก + ตัวลวงที่ไม่ซ้ำ) */
function mcq(q: string, right: string, wrong: string[], explain: string, refs: Ref[]): QuizQ | null {
  const ds = shuffle([...new Set(wrong.filter((w) => w && w !== right))]).slice(0, 3);
  if (ds.length < 3) return null;
  const choices = shuffle([right, ...ds]);
  return { q, choices, answer: choices.indexOf(right), explain, refs };
}
const norm = (s: string) => s.replace(/\s+/g, '');

const GEN: (() => QuizQ | null)[] = [
  // สรรพคุณ → สมุนไพร
  () => {
    const h = pick(core().filter((x) => x.uses.length));
    const u = pick(h.uses);
    const others = core().filter((x) => x !== h && !x.uses.some((y) => norm(y).includes(norm(u).slice(0, 6)) || norm(u).includes(norm(y).slice(0, 6))));
    return mcq(`สมุนไพรใดมีสรรพคุณ "${u}"`, h.name, others.map((x) => x.name), `${h.name}: ${h.uses.join(', ')}`, ref(herbDocId(h)));
  },
  // สมุนไพร → รสยา
  () => {
    const h = pick(herbs);
    const tastes = [...new Set(herbs.map((x) => x.taste))];
    return mcq(`${h.name} มีรสยาอะไร`, `รส${h.taste}`, tastes.filter((t) => t !== h.taste).map((t) => `รส${t}`), `${h.name} รส${h.taste} · ธาตุ${h.element} · ส่วนที่ใช้: ${h.part}`, ref(herbDocId(h)));
  },
  // ยาตีกัน (บัญชียาหลักแห่งชาติด้านสมุนไพร 2566)
  () => {
    const x = pick(HERB_DRUG);
    const h = herbs.find((y) => y.id === x.herb);
    if (!h) return null;
    const mine = new Set(HERB_DRUG.filter((y) => y.herb === x.herb).map((y) => y.label));
    const labels = [...new Set(HERB_DRUG.map((y) => y.label))].filter((l) => !mine.has(l));
    return mcq(`ควรระวังการใช้${h.name}ร่วมกับยาข้อใด`, x.label, labels, x.statement, ref(ixDocId(x)));
  },
  // ยาสามัญประจำบ้าน → กลุ่มอาการ
  () => {
    const m = pick(HOUSEHOLD.filter((y) => y.kind === 'modern' && y.group));
    const groups = [...new Set(HOUSEHOLD.filter((y) => y.group).map((y) => y.group!))];
    return mcq(`"${m.name}" เป็นยาสามัญประจำบ้านกลุ่มใด`, m.group!, groups, `${m.name}: ${clip(m.use, 160)}`, ref(medDocId(m)));
  },
  // ส่วนที่ใช้
  () => {
    const h = pick(core());
    return mcq(`ส่วนใดของ${h.name}ที่นำมาใช้เป็นยา`, h.part, core().map((x) => x.part).filter((p) => norm(p) !== norm(h.part)), `${h.name}: ส่วนที่ใช้ ${h.part} · วิธีใช้: ${clip(h.howto, 140)}`, ref(herbDocId(h)));
  },
  // ข้อควรระวัง → สมุนไพร
  () => {
    const h: Herb = pick(core().filter((x) => x.caution && x.caution.length > 20));
    return mcq(`ข้อควรระวังนี้เป็นของสมุนไพรใด: "${clip(h.caution, 110)}"`, h.name, core().filter((x) => x !== h && norm(x.caution) !== norm(h.caution)).map((x) => x.name), `${h.name}: ${h.caution}`, ref(herbDocId(h)));
  },
];

/** ชุดข้อสอบ n ข้อ (สุ่มทุกครั้ง ไม่ซ้ำคำถาม) */
export function makeQuiz(n = 10): QuizQ[] {
  const out: QuizQ[] = [];
  for (let tries = 0; out.length < n && tries < n * 12; tries++) {
    const q = GEN[tries % GEN.length]();
    if (q && !out.some((x) => x.q === q.q)) out.push(q);
  }
  return shuffle(out);
}
