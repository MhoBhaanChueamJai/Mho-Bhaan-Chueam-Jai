/**
 * ครูปัญญาจัดหน้าตำรา — หมอเขียน/เล่ารวมกันเป็นหน้าๆ (เนื้อหา วิธีใช้ ตัวยา ข้อห้าม ที่มา ปนกันได้)
 * → AI แยกหัวข้อตามประเภท เรียบเรียงภาษาใหม่ให้อ่านง่าย (คงความหมายเดิม) และแบ่งเนื้อหาเป็นหน้าอัตโนมัติ
 * บทคาถาและข้อความต้นฉบับโบราณ: คงถ้อยคำเดิม ไม่เรียบเรียงใหม่
 */
import { chatJSON } from '../api/ai';
import { dialectHint } from './dialect';
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

export async function organizeWisdom(kind: Kind, title: string, indication: string, draft: string[], opts?: { spoken?: boolean }): Promise<Organized> {
  const f = KIND_FORM[kind];
  const full = draft.map((p) => p.trim()).join('');
  if (full.length > 20000) throw new Error('TOO_LONG'); // ยาวเกินจัดในครั้งเดียว — ไม่ตัดทิ้งเงียบๆ
  const text = draft.map((p, i) => `【หน้า ${i + 1}】\n${p.trim()}`).filter((p) => p.trim().length > 8).join('\n\n');
  const keep = kind === 'คาถา/พิธี' ? 'บทคาถาให้คงถ้อยคำเดิมทุกคำ ห้ามแก้' : kind === 'ตำราโบราณ' ? 'ข้อความต้นฉบับโบราณให้คงอักขระเดิม ส่วนถอดความเรียบเรียงเป็นภาษาปัจจุบัน' : '';
  const r = await chatJSON<Partial<Record<keyof Organized, unknown>>>([
    {
      role: 'user',
      content: `คุณคือบรรณาธิการตำราแพทย์แผนไทย ช่วยจัดหน้าและเรียบเรียง "${kind}" ที่ผู้ใช้เขียนไว้ให้เป็นตำราที่อ่านง่าย
ชื่อเรื่อง: ${title || '(ยังไม่ระบุ)'}
${f.indication.label}: ${indication || '(ยังไม่ระบุ)'}
${opts?.spoken ? `ต้นฉบับนี้ถอดจากเสียงที่หมอเล่า (ถอดอัตโนมัติ อาจสะกดเพี้ยน มีคำพูดซ้ำ คำอุทาน หรือพูดวกกลับ) — แก้คำที่ถอดเพี้ยนให้ถูก (โดยเฉพาะชื่อสมุนไพร) ตัดคำอุทาน/คำซ้ำ แต่คงเนื้อหาและสำนวนของหมอไว้ ${dialectHint()}
` : ''}ต้นฉบับที่หมอ${opts?.spoken ? 'เล่า' : 'เขียน'} (หลายหน้า เนื้อหาปนกัน):
"""
${text}
"""

งาน:
1) แยกข้อมูลลงหัวข้อของ${kind}:
   - ${f.ingredients ? `ingredients = ${f.ingredients.label} (รายการ${kind === 'ตำรับยา' ? ' พร้อมปริมาณ เช่น "เถาวัลย์เปรียง 1 กำมือ"' : ''})` : 'ingredients = []'}
   - steps = ${f.method.hidden ? '[] (ไม่ต้องแยก ข้อความเดิมให้รวมไว้ใน pages)' : `${f.method.label}${f.method.steps ? ' (แยกทีละขั้น เรียงลำดับ)' : ''}`}
   - extra = ${f.extra ? f.extra.label : '""'}
   - caution = ${f.caution.label}
   - origin = ${f.origin.label} (ถ้ามีกล่าวถึง)
   - pages = ${f.summary.big ? f.summary.label : 'เนื้อหาหลัก/คำอธิบาย'} ที่เรียบเรียงแล้ว — ห้ามซ้ำกับสิ่งที่แยกไปใส่ ingredients / steps / extra / caution / origin แล้ว (ข้อมูลแต่ละอย่างอยู่ที่เดียว) ถ้าต้นฉบับมีแค่ข้อมูลเหล่านั้น ให้ pages เป็นคำอธิบายสั้นๆ 1 ย่อหน้า
   - แต่ละหน้าต่อเนื่องกัน ห้ามเขียนเนื้อหาเดิมซ้ำในหน้าถัดไป
2) เรียบเรียงภาษาให้สละสลวย อ่านง่าย ถูกต้องตามหลักภาษา คงความหมายและรายละเอียดเดิมทั้งหมด ห้ามย่อหรือตัดทอน ห้ามเพิ่มข้อมูลที่ต้นฉบับไม่ได้กล่าว ${keep}
3) จัดรูปแบบเนื้อหาใน pages ให้อ่านง่ายแบบหนังสือ:
   - แบ่งย่อหน้าตามใจความ ย่อหน้าละ 2-5 ประโยค คั่นย่อหน้าด้วยบรรทัดว่าง (\\n\\n)
   - หัวข้อย่อยให้อยู่บรรทัดของตัวเอง แล้วขึ้นบรรทัดใหม่ก่อนเนื้อหา
   - รายการหลายข้อ ให้ขึ้นบรรทัดใหม่ทีละข้อ นำหน้าด้วย "• " หรือเลขลำดับ "1. "
   - ใช้ช่องว่างคั่นวลี/ประโยคแบบภาษาไทย ไม่ใส่ช่องว่างซ้อน ไม่ใส่ markdown (** # ฯลฯ)
   - บทคาถา: คงถ้อยคำเดิม แต่ตัดวรรคให้ขึ้นบรรทัดใหม่ทีละวรรค
   - ใน steps / ingredients ให้เป็นข้อความสั้นกระชับต่อข้อ ไม่ต้องใส่เลขหรือสัญลักษณ์นำหน้า
4) แบ่ง pages เป็นหน้าละประมาณ 450-520 ตัวอักษร (ไม่เกิน 520 = 1 หน้าหนังสือ) ตัดที่จบย่อหน้าหรือจบหัวข้อย่อย ไม่ตัดกลางประโยค
5) ถ้าชื่อเรื่องหรือ${f.indication.label}ยังไม่ระบุ ให้ตั้งจากเนื้อหา
ข้อมูลส่วนไหนไม่มีให้เป็นค่าว่าง ห้ามเดา
ตอบ JSON เท่านั้น:
{"title":"","indication":"","pages":["หน้า 1","หน้า 2"],"ingredients":[],"steps":[],"extra":"","caution":"","origin":""}`,
    },
  ], undefined, { maxTokens: Math.min(8000, 1500 + Math.ceil(full.length * 0.9)), timeoutMs: 150_000 });
  const arr = (v: unknown) => (Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(/\n+/) : []).map((x) => String(x).trim()).filter(Boolean);
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : Array.isArray(v) ? v.join(' ').trim() : '');
  const tidy = (t: string) =>
    t
      .replace(/\*\*|__|^#+\s*/gm, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/ {2,}/g, ' ')
      .trim();
  const item = (t: string) => t.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim();
  // กันเนื้อหาซ้ำ: ย่อหน้าที่ซ้ำกับหน้าก่อนหน้า (AI บางครั้งเขียนซ้ำ) ถูกตัดออก
  const seen = new Set<string>();
  const norm = (t: string) => t.replace(/\s+/g, '');
  const pages = (Array.isArray(r.pages) ? r.pages : typeof r.pages === 'string' ? [r.pages] : [])
    .map((x) => tidy(String(x)))
    .map((pg) =>
      pg
        .split(/\n{2,}/)
        .filter((para) => {
          const k = norm(para);
          if (k.length < 12) return true; // หัวข้อสั้นๆ ซ้ำได้
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        // หัวข้อที่เนื้อหาใต้หัวข้อถูกตัดไปแล้ว (ตามด้วยหัวข้ออื่น/ท้ายหน้า) → ตัดหัวข้อด้วย
        .filter((para, i, all) => norm(para).length >= 12 || (i + 1 < all.length && norm(all[i + 1]).length >= 12))
        .join('\n\n')
        .trim(),
    )
    .filter((pg) => norm(pg).length > 12);
  // ที่มา: ตัดคำนำหน้าที่ AI ใส่ซ้ำ (เดิมแสดง "ได้รับสืบทอดจาก: ได้รับสืบทอดจากพ่อ")
  const origin = str(r.origin).replace(/^(?:ได้รับ)?(?:สืบทอด|ถ่ายทอด)(?:มา)?จาก\s*|^แหล่งที่มา\s*:?\s*/, '').trim();
  return {
    title: str(r.title) || title,
    indication: str(r.indication) || indication,
    pages: pages.length ? pages : draft.filter((p) => p.trim()),
    ingredients: arr(r.ingredients).map(item).filter(Boolean),
    steps: arr(r.steps).map(item).filter(Boolean),
    extra: str(r.extra),
    caution: str(r.caution),
    origin,
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
