/**
 * ช่องข้อมูลเฉพาะของแต่ละประเภทภูมิปัญญา — ใช้ทั้งหน้าเพิ่ม/แก้ไข และหน้าแสดงตำรา
 * เก็บลงช่องเดิมของ Wisdom (ไม่ต้องเพิ่มคอลัมน์):
 *   indication = ใช้แก้ / รักษาอาการ / ใช้ในโอกาส / ว่าด้วยเรื่อง
 *   ingredients = ตัวยา+ปริมาณ / อุปกรณ์ / เครื่องประกอบพิธี / ตัวยาที่พบ
 *   method = ขั้นตอน (ขึ้นบรรทัดใหม่ทีละขั้น) + บรรทัด "<extra.prefix>: ..." (วิธีใช้ / ความถี่)
 *   summary = เนื้อหา / บทคาถา / ถอดความ
 */
import type { Wisdom } from '../data/mock';

type Kind = Wisdom['kind'];
type FieldCfg = { label: string; ph: string };
export type KindForm = {
  desc: string;
  title: FieldCfg;
  indication: FieldCfg;
  /** null = ไม่ใช้ */
  ingredients: (FieldCfg & { amount: boolean; add: string }) | null;
  /** steps = กรอกทีละขั้น · false = กล่องข้อความยาว (เช่น ข้อความต้นฉบับ) */
  method: FieldCfg & { steps: boolean; add?: string; hidden?: boolean };
  /** บรรทัดเสริมท้ายวิธีทำ เช่น วิธีใช้ / ความถี่ */
  extra: (FieldCfg & { prefix: string }) | null;
  summary: FieldCfg & { big?: boolean };
  caution: FieldCfg;
  origin: FieldCfg;
};

export const KIND_FORM: Record<Kind, KindForm> = {
  ตำรับยา: {
    desc: 'สูตรยา ตัวยา วิธีปรุง',
    title: { label: 'ชื่อตำรับยา', ph: 'เช่น ยาต้มแก้ลมจับโปง' },
    indication: { label: 'สรรพคุณ / ใช้แก้', ph: 'เช่น ปวดเข่า ข้อบวม ปวดเมื่อย' },
    ingredients: { label: 'ตัวยาและปริมาณ', ph: 'ชื่อตัวยา', amount: true, add: 'เพิ่มตัวยา' },
    method: { label: 'วิธีปรุง', ph: 'เช่น ต้มกับน้ำ 3 ส่วน เคี่ยวให้เหลือ 1 ส่วน', steps: true, add: 'เพิ่มขั้นตอน' },
    extra: { label: 'วิธีใช้ / ขนาดรับประทาน', ph: 'เช่น ครั้งละครึ่งแก้ว เช้า-เย็น ก่อนอาหาร', prefix: 'วิธีใช้' },
    summary: { label: 'เนื้อหาเพิ่มเติม', ph: 'เล่าที่มา เคล็ดลับ หรือคำอธิบายของตำรับ' },
    caution: { label: 'ข้อห้าม / ข้อควรระวัง', ph: 'เช่น ห้ามใช้ในหญิงตั้งครรภ์' },
    origin: { label: 'ได้รับสืบทอดจาก', ph: 'เช่น พ่อ ครูบาอาจารย์' },
  },
  วิธีรักษา: {
    desc: 'นวด ประคบ อบ ขั้นตอนรักษา',
    title: { label: 'ชื่อวิธีรักษา', ph: 'เช่น นวดจับเส้นแก้ปวดหลัง' },
    indication: { label: 'รักษาอาการ', ph: 'เช่น ปวดหลัง ลมปลายปัตคาด' },
    ingredients: { label: 'อุปกรณ์ / สมุนไพรที่ใช้', ph: 'เช่น ลูกประคบ น้ำมันไพล', amount: false, add: 'เพิ่มรายการ' },
    method: { label: 'ขั้นตอนการรักษา', ph: 'เช่น กดจุดแนวกระดูกสันหลังจากล่างขึ้นบน', steps: true, add: 'เพิ่มขั้นตอน' },
    extra: { label: 'ระยะเวลา / ความถี่', ph: 'เช่น ครั้งละ 30 นาที สัปดาห์ละ 2 ครั้ง', prefix: 'ระยะเวลา' },
    summary: { label: 'เนื้อหาเพิ่มเติม', ph: 'หลักการ หรือข้อสังเกตของวิธีนี้' },
    caution: { label: 'ข้อห้าม / ข้อควรระวัง', ph: 'เช่น ห้ามนวดบริเวณที่อักเสบ บวม แดง ร้อน' },
    origin: { label: 'ได้รับสืบทอดจาก', ph: 'เช่น ครูหมอนวด วัดโพธิ์' },
  },
  'คาถา/พิธี': {
    desc: 'บทคาถา เครื่องประกอบพิธี',
    title: { label: 'ชื่อคาถา / พิธี', ph: 'เช่น คาถาเป่าแก้ปวดฟัน' },
    indication: { label: 'ใช้ในโอกาส / วัตถุประสงค์', ph: 'เช่น เป่ารักษาเริม งูสวัด' },
    ingredients: { label: 'เครื่องประกอบพิธี', ph: 'เช่น ดอกไม้ ธูปเทียน ขันน้ำมนต์', amount: false, add: 'เพิ่มเครื่องประกอบ' },
    method: { label: 'ขั้นตอนพิธี', ph: 'เช่น ไหว้ครู จุดธูป 3 ดอก', steps: true, add: 'เพิ่มขั้นตอน' },
    extra: null,
    summary: { label: 'บทคาถา', ph: 'พิมพ์หรือเล่าบทคาถาตามที่ได้รับสืบทอด', big: true },
    caution: { label: 'ข้อปฏิบัติ / ข้อห้าม', ph: 'เช่น ห้ามกินของคาว 3 วัน' },
    origin: { label: 'ได้รับสืบทอดจาก', ph: 'เช่น ครูบาอาจารย์ พระอาจารย์' },
  },
  ตำราโบราณ: {
    desc: 'สมุดข่อย ใบลาน ถอดความ',
    title: { label: 'ชื่อตำรา', ph: 'เช่น ตำรายาวัดดอนแก้ว' },
    indication: { label: 'ว่าด้วยเรื่อง', ph: 'เช่น ยาแก้ไข้ ตำราเส้น' },
    ingredients: { label: 'ตัวยาที่พบในตำรา', ph: 'เช่น บอระเพ็ด', amount: false, add: 'เพิ่มตัวยา' },
    // ไม่แสดงหัวข้อ "ข้อความต้นฉบับ" แยก (ข้อความเดิมอยู่รวมในเนื้อหา)
    method: { label: 'ข้อความต้นฉบับ', ph: 'คัดลอกข้อความตามต้นฉบับ (อักขระเดิม)', steps: false, hidden: true },
    extra: null,
    summary: { label: 'ถอดความ (ภาษาปัจจุบัน)', ph: 'อธิบายเนื้อหาของตำราเป็นภาษาปัจจุบัน', big: true },
    caution: { label: 'หมายเหตุ / ข้อควรระวัง', ph: 'เช่น อักษรบางส่วนเลือนราง' },
    origin: { label: 'แหล่งที่มาของตำรา', ph: 'เช่น สมุดข่อยวัดดอนแก้ว อายุราว 120 ปี' },
  },
};

/** แยกวิธีทำเป็น ขั้นตอน + บรรทัดเสริม (วิธีใช้/ระยะเวลา) */
export function splitMethod(kind: Kind, method?: string): { steps: string[]; extra: string } {
  const cfg = KIND_FORM[kind];
  const lines = (method ?? '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
  let extra = '';
  const steps = lines.filter((l) => {
    if (cfg.extra && l.startsWith(`${cfg.extra.prefix}:`)) {
      extra = l.slice(cfg.extra.prefix.length + 1).trim();
      return false;
    }
    return true;
  });
  return { steps, extra };
}
export function joinMethod(kind: Kind, steps: string[], extra: string) {
  const cfg = KIND_FORM[kind];
  const lines = steps.map((s) => s.trim()).filter(Boolean);
  if (cfg.extra && extra.trim()) lines.push(`${cfg.extra.prefix}: ${extra.trim()}`);
  return lines.join('\n');
}

/** ── เนื้อหาหลายหน้า ──
 * เก็บในช่องเดิม (summary) คั่นหน้าด้วย PAGE_BREAK · หน้าอ่านแบบหนังสือจะตัดหน้ายาวเป็นหน้าย่อยให้พอดีจอ */
export const PAGE_BREAK = '\n\n———\n\n';
export const splitPages = (text?: string) => (text ?? '').split(PAGE_BREAK).map((p) => p.trim());
export const joinPages = (pages: string[]) => pages.map((p) => p.trim()).filter(Boolean).join(PAGE_BREAK);
export const plainText = (text?: string) => (text ?? '').split(PAGE_BREAK).join('\n\n');

/** ตัดเป็นหน้าสำหรับอ่าน (ไม่เกินราว max ตัวอักษร ตัดที่ขึ้นบรรทัด/เว้นวรรค) */
export function bookPages(text: string, max = 520): string[] {
  const out: string[] = [];
  splitPages(text).forEach((page) => {
    let rest = page.trim();
    while (rest.length > max) {
      const slice = rest.slice(0, max);
      let cut = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf(' '));
      if (cut < max * 0.5) cut = max;
      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
  });
  return out;
}
