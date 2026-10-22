/**
 * แหล่งความรู้อ้างอิงของครูปัญญา — รวมทุกเล่มไว้ที่เดียว ใช้ทั้ง
 *  - ป้ายอ้างอิงใต้คำแนะนำ (บอกว่ามาจากตำราไหน หน้าไหน)
 *  - หน้า "คลังความรู้อ้างอิง" (อ่าน / ดาวน์โหลดเป็นเอกสาร)
 * เนื้อหาแต่ละหัวข้อมาจากแหล่งทางการที่ระบุในแต่ละไฟล์ข้อมูลเท่านั้น
 */
import { herbs, type Herb } from '../data/herbs';
import { HOUSEHOLD, HOUSEHOLD_SOURCES, type HouseholdMed } from '../data/household';
import { HERB_DRUG, type HerbDrug } from '../data/interactions';
import { PHARMACY, PHARMACY_SOURCES, type PharmacyDoc } from '../data/pharmacy';
import { THAIMED, THAIMED_SOURCES } from '../data/thaimed';
import { THP, THP_SOURCE } from '../data/thp';

export type BookKey = 'cpg' | 'ref' | 'nlem' | 'pharmacy' | 'thp' | 'household';

export type Book = { k: BookKey; title: string; short: string; desc: string; icon: string; color: string; refs: { title: string; url?: string }[] };

const cpgRef = THAIMED_SOURCES.find((s) => s.id === 'cpg2568')!;
const refRef = THAIMED_SOURCES.find((s) => s.id === 'ref2568')!;
const nlemRef = PHARMACY_SOURCES[0];

export const BOOKS: Book[] = [
  { k: 'cpg', title: 'แนวทางปฏิบัติเวชกรรมไทยในหน่วยบริการปฐมภูมิ พ.ศ. 2568', short: 'แนวทางเวชกรรมไทยปฐมภูมิ 2568', desc: 'เบาหวาน ความดันโลหิตสูง นอนไม่หลับ ปวดเรื้อรัง สะเก็ดเงิน ดูแลมารดาหลังคลอด', icon: 'cross.case.fill', color: '#14905C', refs: [{ title: cpgRef.title }] },
  { k: 'ref', title: 'ตำราอ้างอิงด้านการแพทย์แผนไทย พ.ศ. 2568', short: 'ตำราอ้างอิงการแพทย์แผนไทย 2568', desc: 'หลักการแพทย์แผนไทย ทฤษฎีธาตุ เวชกรรม เภสัชกรรม การนวด การผดุงครรภ์', icon: 'books.vertical.fill', color: '#2F7BE0', refs: [{ title: refRef.title }] },
  { k: 'nlem', title: 'บัญชียาหลักแห่งชาติด้านสมุนไพร พ.ศ. 2566', short: 'บัญชียาหลักแห่งชาติด้านสมุนไพร 2566', desc: 'ตำรับยาแผนไทยและยาจากสมุนไพรในบัญชียาหลัก ข้อบ่งใช้ ขนาด ข้อควรระวัง', icon: 'list.bullet.clipboard.fill', color: '#B0761E', refs: [nlemRef] },
  { k: 'pharmacy', title: 'เภสัชกรรมไทยและความปลอดภัยของยาสมุนไพร', short: 'คลังเภสัชกรรมไทย', desc: 'รสยา พิกัดยา หลักการตั้งตำรับ วิธีปรุง ข้อควรระวังและการใช้ร่วมกับยาแผนปัจจุบัน', icon: 'flask.fill', color: '#7A4FD0', refs: PHARMACY_SOURCES.slice(1) },
  { k: 'thp', title: THP_SOURCE.title, short: 'ตำรามาตรฐานยาสมุนไพรไทย (THP)', desc: `มอโนกราฟที่ตรงกับสมุนไพรในคลังของแอป ${Object.keys(THP).length} ชนิด · ${THP_SOURCE.publisher}`, icon: 'checkmark.seal.fill', color: '#0E7C86', refs: [{ title: `${THP_SOURCE.title}. ${THP_SOURCE.publisher}`, url: THP_SOURCE.url }] },
  { k: 'household', title: 'ยาสามัญประจำบ้าน (แผนปัจจุบันและแผนโบราณ)', short: 'ยาสามัญประจำบ้าน', desc: 'ยาที่ประชาชนซื้อใช้เองได้ตามประกาศกระทรวงสาธารณสุข พร้อมข้อบ่งใช้และข้อควรระวัง', icon: 'pills.fill', color: '#D9534A', refs: HOUSEHOLD_SOURCES },
];
export const bookOf = (k: BookKey) => BOOKS.find((b) => b.k === k)!;

/** หัวข้อในคลัง (1 หัวข้อ = 1 ชิ้นความรู้ที่ครูปัญญาค้นได้) */
export type KDoc = { id: string; book: BookKey; title: string; text: string; page?: string; url?: string; /** บรรทัดรองในรายการหัวข้อ */ sub?: string };

const NLEM_ID = /^(nlem-|f-)/;
const pharmBook = (d: PharmacyDoc): BookKey => (d.id.startsWith('cpg-') ? 'cpg' : d.id.startsWith('ref-') ? 'ref' : NLEM_ID.test(d.id) ? 'nlem' : 'pharmacy');
/** "(ที่มา: … หน้า 13, 40-41)" ท้ายเนื้อหา → เลขหน้า */
const pageOf = (text: string) => text.match(/ที่มา:[^)]*?หน้า\s*([\d\s,\-–]+)/)?.[1]?.trim().replace(/[,\s]+$/, '');

const fromPharm = (d: PharmacyDoc): KDoc => ({ id: d.id, book: pharmBook(d), title: d.title, text: d.text, page: pageOf(d.text) });

export const herbDocId = (h: Herb) => `herb:${h.id}`;
export const medDocId = (m: HouseholdMed) => `med:${m.id}`;

function fromHerb(h: Herb): KDoc {
  const t = THP[h.id];
  return {
    id: herbDocId(h),
    book: 'thp',
    title: `${h.name} (${h.sci})`,
    text: [`สรรพคุณ: ${h.uses.join(', ')}`, `ส่วนที่ใช้: ${h.part}`, `วิธีใช้: ${h.howto}`, `ข้อควรระวัง: ${h.caution}`, t ? `มอโนกราฟ: ${t.monographs.map((m) => `${m.title} (${m.en}) ${m.edition}`).join(' · ')}` : ''].filter(Boolean).join('\n'),
    page: t?.monographs[0]?.edition,
    url: t?.monographs[0]?.url,
  };
}

function fromMed(m: HouseholdMed): KDoc {
  return {
    id: medDocId(m),
    book: 'household',
    title: m.name,
    sub: m.kind === 'modern' ? `แผนปัจจุบัน · ${m.group ?? ''}` : 'แผนโบราณ',
    text: [m.form ? `รูปแบบ: ${m.form}` : '', `ข้อบ่งใช้: ${m.use}`, m.how ? `วิธีใช้: ${m.how}` : '', m.caution ? `ข้อควรระวัง: ${m.caution}` : '', `ประเภท: ${m.kind === 'modern' ? 'ยาสามัญประจำบ้านแผนปัจจุบัน' : 'ยาสามัญประจำบ้านแผนโบราณ'}`].filter(Boolean).join('\n'),
    url: m.url,
  };
}

export const ixDocId = (x: HerbDrug) => `ix:${x.herb}-${x.drug}`;
function fromIx(x: HerbDrug): KDoc {
  const h = herbs.find((y) => y.id === x.herb);
  return {
    id: ixDocId(x),
    book: 'nlem',
    title: `อันตรกิริยา: ${h?.name ?? x.herb} กับ${x.label}`,
    text: [x.statement, `${x.formula ? 'ข้อความในตำรับ' : 'ผลิตภัณฑ์'}: ${x.products.join(', ')}`].join('\n'),
    page: `ภาคผนวก 2 หน้า ${x.pages.join(', ')} ของไฟล์`,
  };
}

let all: KDoc[] | null = null;
/** ทุกหัวข้อในคลังความรู้อ้างอิง */
export function allDocs(): KDoc[] {
  if (all) return all;
  all = [...THAIMED.map(fromPharm), ...PHARMACY.map(fromPharm), ...herbs.filter((h) => THP[h.id]).map(fromHerb), ...HOUSEHOLD.map(fromMed), ...HERB_DRUG.map(fromIx)];
  return all;
}
export const docsOf = (k: BookKey) => allDocs().filter((d) => d.book === k);

/** หาหัวข้อจาก id (รวมสมุนไพรที่ยังไม่มีมอโนกราฟ THP → อ้างอิงคลังสมุนไพรของแอป) */
export function docById(id: string): KDoc | undefined {
  const d = allDocs().find((x) => x.id === id);
  if (d) return d;
  if (id.startsWith('herb:')) {
    const h = herbs.find((x) => x.id === id.slice(5));
    if (h) return { ...fromHerb(h), book: 'thp', page: undefined, url: h.refs?.[0] };
  }
  return undefined;
}

/** ป้ายอ้างอิงสั้นๆ เช่น "แนวทางเวชกรรมไทยปฐมภูมิ 2568 หน้า 13" */
export function citeLabel(d: KDoc): string {
  if (d.id.startsWith('herb:') && !THP[d.id.slice(5)]) return 'คลังสมุนไพรของแอป';
  const b = bookOf(d.book).short;
  if (d.book === 'thp') return `ตำรามาตรฐานยาสมุนไพรไทย: ${d.title.split(' (')[0]}`;
  if (d.book === 'household') return `${b}: ${d.title}`;
  // ตำรับในบัญชียาหลัก: บอกชื่อตำรับด้วย (เช่น "บัญชียาหลักฯ 2566: ยาจันทลีลา")
  if (d.book === 'nlem' && d.id.startsWith('f-')) return `${b}: ${d.title.split(' (')[0]}`;
  if (!d.page) return b;
  return /หน้า/.test(d.page) ? `${b} ${d.page}` : `${b} หน้า ${d.page}`;
}

/** ป้ายอ้างอิงแบบสั้น (ให้อ่านจบในป้ายเล็ก) */
export const shortCite = (label: string) =>
  label
    .replace('บัญชียาหลักแห่งชาติด้านสมุนไพร', 'บัญชียาหลักฯ')
    .replace('ตำรามาตรฐานยาสมุนไพรไทย', 'ตำรามาตรฐานฯ')
    .replace('แนวทางเวชกรรมไทยปฐมภูมิ', 'แนวทางเวชกรรมไทย')
    .replace('ตำราอ้างอิงการแพทย์แผนไทย', 'ตำราอ้างอิงแผนไทย')
    .replace(/ภาคผนวก 2 หน้า ([\d, ]+) ของไฟล์/, 'ภาคผนวก 2 น.$1')
    .replace(/ หน้า /, ' น.');
