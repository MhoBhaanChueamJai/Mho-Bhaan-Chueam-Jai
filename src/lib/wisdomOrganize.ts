/**
 * ครูปัญญาจัดหน้าตำรา — หมอเขียน/เล่ารวมกันเป็นหน้าๆ (เนื้อหา วิธีใช้ ตัวยา ข้อห้าม ที่มา ปนกันได้)
 * → AI แยกหัวข้อตามประเภท เรียบเรียงภาษาใหม่ให้อ่านง่าย (คงความหมายเดิม) และแบ่งเนื้อหาเป็นหน้าอัตโนมัติ
 * บทคาถาและข้อความต้นฉบับโบราณ: คงถ้อยคำเดิม ไม่เรียบเรียงใหม่
 */
import { chatJSON } from '../api/ai';
import type { Wisdom } from '../data/mock';
import { KIND_FORM, PAGE_BREAK, joinMethod, joinPages, splitMethod } from './wisdomKinds';

type Kind = Wisdom['kind'];
export type Organized = {
  title: string;
  indication: string;
  pages: string[]; // เนื้อหาที่เรียบเรียงแล้ว แบ่งเป็นหน้า
  ingredients: string[];
  steps: string[];
  extra: string;
  caution: string;
  origin: string;
};

export async function organizeWisdom(kind: Kind, title: string, indication: string, draft: string[]): Promise<Organized> {
  const f = KIND_FORM[kind];
  const text = draft.map((p, i) => `【หน้า ${i + 1}】\n${p.trim()}`).filter((p) => p.trim().length > 8).join('\n\n');
  const keep = kind === 'คาถา/พิธี' ? 'บทคาถาให้คงถ้อยคำเดิมทุกคำ ห้ามแก้' : kind === 'ตำราโบราณ' ? 'ข้อความต้นฉบับโบราณให้คงอักขระเดิม ส่วนถอดความเรียบเรียงเป็นภาษาปัจจุบัน' : '';
  const r = await chatJSON<Partial<Record<keyof Organized, unknown>>>([
    {
      role: 'user',
      content: `คุณคือบรรณาธิการตำราแพทย์แผนไทย ช่วยจัดหน้าและเรียบเรียง "${kind}" ที่หมอพื้นบ้านเขียนไว้ให้เป็นตำราที่อ่านง่าย
ชื่อเรื่อง: ${title || '(ยังไม่ระบุ)'}
${f.indication.label}: ${indication || '(ยังไม่ระบุ)'}
ต้นฉบับที่หมอเขียน (หลายหน้า เนื้อหาปนกัน):
"""
${text.slice(0, 14000)}
"""

งาน:
1) แยกข้อมูลลงหัวข้อของ${kind}:
   - ${f.ingredients ? `ingredients = ${f.ingredients.label} (รายการ${kind === 'ตำรับยา' ? ' พร้อมปริมาณ เช่น "เถาวัลย์เปรียง 1 กำมือ"' : ''})` : 'ingredients = []'}
   - steps = ${f.method.label}${f.method.steps ? ' (แยกทีละขั้น เรียงลำดับ)' : ' (ข้อความต้นฉบับ ใส่เป็นรายการย่อหน้า)'}
   - extra = ${f.extra ? f.extra.label : '""'}
   - caution = ${f.caution.label}
   - origin = ${f.origin.label} (ถ้ามีกล่าวถึง)
   - pages = ${f.summary.big ? f.summary.label : 'เนื้อหาหลัก/คำอธิบาย'} ที่เรียบเรียงแล้ว
2) เรียบเรียงภาษาให้สละสลวย อ่านง่าย ถูกต้องตามหลักภาษา คงความหมายและรายละเอียดเดิมทั้งหมด ห้ามย่อหรือตัดทอน ห้ามเพิ่มข้อมูลที่ต้นฉบับไม่ได้กล่าว ${keep}
3) แบ่ง pages เป็นหน้าละประมาณ 400-600 ตัวอักษร ตัดที่จบประโยคหรือจบหัวข้อย่อย หน้าละ 1-3 ย่อหน้า
4) ถ้าชื่อเรื่องหรือ${f.indication.label}ยังไม่ระบุ ให้ตั้งจากเนื้อหา
ข้อมูลส่วนไหนไม่มีให้เป็นค่าว่าง ห้ามเดา
ตอบ JSON เท่านั้น:
{"title":"","indication":"","pages":["หน้า 1","หน้า 2"],"ingredients":[],"steps":[],"extra":"","caution":"","origin":""}`,
    },
  ]);
  const arr = (v: unknown) => (Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(/\n+/) : []).map((x) => String(x).trim()).filter(Boolean);
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : Array.isArray(v) ? v.join(' ').trim() : '');
  const pages = arr(r.pages);
  return {
    title: str(r.title) || title,
    indication: str(r.indication) || indication,
    pages: pages.length ? pages : draft.filter((p) => p.trim()),
    ingredients: arr(r.ingredients),
    steps: arr(r.steps),
    extra: str(r.extra),
    caution: str(r.caution),
    origin: str(r.origin),
  };
}

/** ผลที่จัดแล้ว → ช่องของ Wisdom */
export function organizedToWisdom(kind: Kind, o: Organized) {
  const originLabel = kind === 'ตำราโบราณ' ? 'แหล่งที่มา' : 'ได้รับสืบทอดจาก';
  const content = joinPages(o.pages);
  return {
    title: o.title.trim(),
    kind,
    indication: o.indication.trim() || undefined,
    summary: [content, o.origin ? `${originLabel}: ${o.origin}` : ''].filter(Boolean).join('\n\n') || o.title,
    ingredients: o.ingredients.length ? o.ingredients : undefined,
    method: joinMethod(kind, o.steps, o.extra) || undefined,
    caution: o.caution || undefined,
  };
}

/** ตำราเดิม / ผลจากโหมดเสียง → ต้นฉบับแบบหลายหน้า ให้หมอแก้ต่อได้ (เนื้อหาก่อน แล้วรายละเอียดท้าย) */
export function draftFromWisdom(kind: Kind, w: { summary?: string; ingredients?: string[]; method?: string; caution?: string }): string[] {
  const f = KIND_FORM[kind];
  const ORIGIN_RE = /\n*(ได้รับสืบทอดจาก|แหล่งที่มา):\s*(.+)$/;
  const om = (w.summary ?? '').match(ORIGIN_RE);
  const pages = (w.summary ?? '').replace(ORIGIN_RE, '').trim().split(PAGE_BREAK).map((p) => p.trim()).filter(Boolean);
  const { steps, extra } = splitMethod(kind, w.method);
  const detail = [
    w.ingredients?.length ? `${f.ingredients?.label ?? 'ตัวยา'}\n${w.ingredients.map((x) => `- ${x}`).join('\n')}` : '',
    steps.length ? `${f.method.label}\n${f.method.steps ? steps.map((s, i) => `${i + 1}. ${s}`).join('\n') : steps.join('\n')}` : '',
    extra && f.extra ? `${f.extra.label}: ${extra}` : '',
    w.caution ? `${f.caution.label}: ${w.caution}` : '',
    om ? `${om[1]}: ${om[2]}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  const out = [...pages, detail].filter(Boolean);
  return out.length ? out : [''];
}
