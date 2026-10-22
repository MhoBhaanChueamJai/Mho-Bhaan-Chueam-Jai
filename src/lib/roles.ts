/**
 * บทบาทผู้ใช้ (เลือกเองตอนสมัคร / ในตั้งค่า) — ไม่มีการยืนยันตัวตนกับทะเบียนแล้ว
 * ใช้ปรับคำเรียก ข้อความ และขอบเขตคำแนะนำของครูปัญญา (เช่น ประชาชนทั่วไป: ดูแลตัวเองเบื้องต้น + บอกเมื่อควรพบแพทย์)
 */
export type UserRole = 'thai_medicine' | 'modern_medicine' | 'public' | 'folk_healer';

export const ROLES: { k: UserRole; label: string; desc: string; icon: string; color: string }[] = [
  { k: 'thai_medicine', label: 'แพทย์แผนไทย', desc: 'ดูแลผู้ป่วยด้วยการแพทย์แผนไทยและสมุนไพร', icon: 'leaf.fill', color: '#14905C' },
  { k: 'modern_medicine', label: 'แพทย์แผนปัจจุบัน', desc: 'แพทย์ พยาบาล เภสัชกร และบุคลากรสุขภาพ', icon: 'stethoscope', color: '#2F7BE0' },
  { k: 'public', label: 'ประชาชนทั่วไป', desc: 'ดูแลสุขภาพตัวเองและคนในครอบครัว', icon: 'person.2.fill', color: '#7A4FD0' },
  { k: 'folk_healer', label: 'หมอพื้นบ้าน', desc: 'ภูมิปัญญาการรักษาพื้นบ้านที่สืบทอดมา', icon: 'hands.sparkles.fill', color: '#B0761E' },
];
export const ROLE_LABEL: Record<UserRole, string> = Object.fromEntries(ROLES.map((r) => [r.k, r.label])) as Record<UserRole, string>;

/** บทบาทที่ยังไม่ได้เลือก → ใช้แบบปลอดภัยที่สุด (ประชาชนทั่วไป) */
export const roleOf = (r?: string | null): UserRole => (ROLES.some((x) => x.k === r) ? (r as UserRole) : 'public');
/** ผู้ใช้เป็นบุคลากรที่ดูแลผู้ป่วย (ไม่ใช่ประชาชนทั่วไป) */
export const isClinician = (r?: string | null) => roleOf(r) !== 'public';
/** คำเรียกผู้ใช้ในข้อความ/เสียงของครูปัญญา */
export const addressOf = (r?: string | null) => (isClinician(r) ? 'คุณหมอ' : 'คุณ');
/** ตำแหน่งใต้ลายมือชื่อในเอกสารพิมพ์ */
export const signerTitle = (r?: string | null) => (!ROLE_PICKER || !r ? 'ผู้ให้การรักษา' : { thai_medicine: 'แพทย์แผนไทย', modern_medicine: 'แพทย์ / บุคลากรสุขภาพ', public: 'ผู้บันทึก', folk_healer: 'หมอพื้นบ้าน' }[roleOf(r)]);

/**
 * ประเภทผู้ใช้ (ถามครั้งเดียวหลังเข้าสู่ระบบ) — กำหนดว่าเห็นเมนูผู้ป่วยและเครื่องมือของหมอไหม
 * ประชาชนทั่วไป: ปรึกษาอาการ ถามครูปัญญา สมุนไพร คลังภูมิ · หมอ/บุคลากรสุขภาพ: + ผู้ป่วย บันทึกการรักษา นัดหมาย รายงาน คลังยา
 */
export type UserKind = 'public' | 'clinician';
export const KINDS: { k: UserKind; label: string; desc: string; icon: string; color: string }[] = [
  { k: 'public', label: 'ประชาชนทั่วไป', desc: 'ดูแลสุขภาพตัวเองและคนในครอบครัว ปรึกษาอาการ ถามเรื่องสมุนไพร', icon: 'person.2.fill', color: '#7A4FD0' },
  { k: 'clinician', label: 'หมอ / บุคลากรสุขภาพ', desc: 'แพทย์แผนไทย แพทย์แผนปัจจุบัน หมอพื้นบ้าน พยาบาล เภสัชกร · บันทึกและดูแลผู้ป่วย', icon: 'stethoscope', color: '#14905C' },
];
export const kindOf = (k?: string | null): UserKind | undefined => (k === 'public' || k === 'clinician' ? k : undefined);
/** เห็นเมนูผู้ป่วย: หมอ/บุคลากร (ยังไม่ได้เลือก = เห็น กันข้อมูลผู้ป่วยเดิมหายไปจากจอ) */
export const showPatients = (k?: string | null) => kindOf(k) !== 'public';

/**
 * เปิด/ปิดการเลือกบทบาท — ตอนนี้ปิด: ใช้ "แบบรวม" ครูปัญญาตอบให้ทุกกลุ่มเข้าใจได้ ไม่ต้องเลือกบทบาท
 * (เปิดเป็น true → มีหน้าเลือกบทบาทหลังเข้าสู่ระบบ การ์ดชวนเลือกบนหน้าหลัก และเมนูในตั้งค่า/ข้อมูลส่วนตัว)
 */
export const ROLE_PICKER = false;

/* บทบาทปัจจุบัน (ตั้งจาก store เหมือนภาษาถิ่น) — ให้ prompt ของ AI ที่อยู่นอก React รู้ว่าคุยกับใคร */
let CURRENT: UserRole | null = null;
export const setCurrentRole = (r?: string | null) => { CURRENT = ROLE_PICKER && r ? roleOf(r) : null; };
/** null = แบบรวม (ไม่ได้แยกบทบาท) */
export const currentRole = () => CURRENT;
/** คำเรียกผู้ใช้ใน prompt (เช่น "แพทย์แผนไทย") */
export const userNoun = (r: string | null | undefined = CURRENT) => (r ? ROLE_LABEL[roleOf(r)] : 'ผู้ใช้');

/** แบบรวม: ผู้ใช้มีได้ทุกกลุ่ม */
const GENERAL_BRIEF =
  'ผู้ใช้อาจเป็นแพทย์แผนไทย แพทย์แผนปัจจุบัน หมอพื้นบ้าน หรือประชาชนทั่วไป เรียกว่า "คุณ" ตอบให้ทุกกลุ่มเข้าใจได้ ใช้ศัพท์แพทย์แผนไทยหรือศัพท์การแพทย์ได้แต่อธิบายสั้นๆ ให้ข้อมูลที่มีแหล่งอ้างอิง และบอกชัดเจนเสมอว่าอาการแบบไหนต้องไปพบแพทย์';

/** บอก AI ว่ากำลังคุยกับใคร และต้องตอบในขอบเขตไหน */
export function roleBrief(r: string | null | undefined = CURRENT): string {
  if (!r) return GENERAL_BRIEF;
  switch (roleOf(r)) {
    case 'thai_medicine':
      return 'ผู้ใช้เป็นแพทย์แผนไทย เรียกว่า "คุณหมอ" ใช้ศัพท์แพทย์แผนไทยได้ (ธาตุ ลม เส้น ตำรับยา) และให้ข้อมูลเชิงวิชาชีพพร้อมแหล่งอ้างอิง';
    case 'modern_medicine':
      return 'ผู้ใช้เป็นบุคลากรการแพทย์แผนปัจจุบัน เรียกว่า "คุณหมอ" อธิบายการแพทย์แผนไทยให้เทียบกับแผนปัจจุบันได้ เน้นหลักฐาน ข้อมูลยา ปฏิกิริยาระหว่างยา และแหล่งอ้างอิง';
    case 'folk_healer':
      return 'ผู้ใช้เป็นหมอพื้นบ้าน เรียกว่า "คุณหมอ" ใช้ภาษาง่าย เคารพภูมิปัญญาเดิม และเติมข้อควรระวังที่ทันสมัย';
    default:
      return 'ผู้ใช้เป็นประชาชนทั่วไป (ไม่ใช่บุคลากรการแพทย์) เรียกว่า "คุณ" ใช้ภาษาง่าย แนะนำเฉพาะการดูแลตัวเองเบื้องต้น สมุนไพรและยาสามัญประจำบ้าน และบอกชัดเจนเสมอว่าเมื่อไรต้องไปพบแพทย์ ห้ามวินิจฉัยแทนแพทย์';
  }
}
