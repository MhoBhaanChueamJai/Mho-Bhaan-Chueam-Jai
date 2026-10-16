/**
 * หมอบ้านเชื่อมใจ Design System — "Soft Herbal"
 * ─────────────────────────────────────────────
 * อ้างอิง UI: Dribbble "Medical Mobile App" (ishtiaqkhanparag #14235513, alomgir08 #26947858)
 *  - พื้นเรียบสีกลาง (ไม่มีสี), การ์ดขาว/clay นูนนุ่ม เงากว้างจาง
 *  - สีหลักเขียวใบยา, จุดเน้นขมิ้น/ดินเผา, การ์ดพาสเทลโทนสมุนไพร, ป้ายเขียวเข้ม
 *
 * Color rule 60 · 30 · 10
 *   60% → Canvas  พื้นหลังเทากลาง + การ์ดขาว
 *   30% → Ink     ข้อความกรมท่า + การ์ดพาสเทล (ฟ้าอมเขียว / มะนาว / ลาเวนเดอร์ / พีช)
 *   10% → Herb    เขียวใบยา: ปุ่มหลัก, สถานะที่เลือก + ขมิ้น/ดินเผาเป็นจุดเน้น
 *
 * ตัวอักษร: ฟอนต์ระบบ + ขนาดมาตรฐาน Apple HIG, ปรับขนาดตาม Dynamic Type ของเครื่อง
 * Touch target ≥ 56pt สำหรับผู้ใช้ 40–80 ปี
 */

export const palette = {
  // 60 — Canvas (พื้นขาว)
  bg: '#FFFFFF',
  bgDeep: '#E1EDE8',
  surface: '#FFFFFF',
  clay: '#F0F8F5',
  // 30 — Ink + การ์ดพาสเทลโทนสมุนไพร
  ink: '#1F2A24',
  inkSoft: '#5E6B63',
  inkMute: '#99A29B',
  line: 'rgba(31,42,36,0.08)',
  // 10 — เขียวใบยา (สีหลัก)
  // โทนเขียวมรกตสด อ้างอิง Dribbble "Gardening App UI Design – Grow Smarter with Nature"
  primary: '#14905C',
  primaryDeep: '#0B6E45',
  primarySoft: '#E3F2EA',
  mint: '#F0F8F5', // พื้นเขียวมิ้นต์อ่อน (ช่องกรอก / การ์ดรอง)
  // พาสเทล
  cyan: '#E1EDE8', // เขียวเซจ
  lime: '#E7EDC8', // ใบตองอ่อน
  lavender: '#F1E8D6', // ครีมข้าว
  peach: '#F7E1D3', // ดินเผาอ่อน
  pink: '#F6E3DC',
  // สีไอคอน (โทนเครื่องยา)
  orange: '#D9921A', // ขมิ้น
  magenta: '#C2564B', // ดินเผา
  violet: '#8A6A44', // อบเชย
  teal: '#2A8C7A', // ใบเตย
  green: '#4E9A3E', // ใบไม้
  // สถานะ
  coral: '#D9534A',
  coralSoft: '#FBE4E1',
  online: '#3DBE7A',
  black: '#14201A',
  white: '#FFFFFF',
};

/** ฟอนต์ระบบ iOS (SF Pro + ฟอนต์ไทยของระบบ) — ใช้น้ำหนักแทนชื่อฟอนต์ */
export const font = {
  body: undefined,
  bodyMedium: undefined,
  bodySemi: undefined,
  head: undefined,
  headMedium: undefined,
  headBold: undefined,
} as Record<string, string | undefined>;

/** Type scale ตาม Apple HIG (Dynamic Type ของระบบปรับให้อัตโนมัติ) */
export const type = {
  hero: { size: 34, line: 44, weight: '700' }, // Large Title
  h1: { size: 28, line: 36, weight: '600' }, // Title 1
  h2: { size: 22, line: 30, weight: '600' }, // Title 2
  title: { size: 17, line: 24, weight: '600' }, // Headline
  body: { size: 17, line: 25, weight: '400' }, // Body
  bodyStrong: { size: 17, line: 25, weight: '600' },
  callout: { size: 16, line: 23, weight: '400' }, // Callout
  caption: { size: 13, line: 18, weight: '400' }, // Footnote
  micro: { size: 12, line: 16, weight: '600' }, // Caption 1
} as const;
export type TypeVariant = keyof typeof type;

/** 4-pt spacing grid */
export const space = { xxs: 4, xs: 8, sm: 12, md: 14, lg: 16, xl: 16, xxl: 24, xxxl: 32 };

export const radius = { sm: 14, md: 20, lg: 26, xl: 34, pill: 999 };

export const touch = { min: 56 };


/**
 * ระดับเงา (Elevation) — ใช้ชุดเดียวทั้งแอป
 * หลักการ: แสงมาจากด้านบนจุดเดียว → เงาตกลงล่างเสมอ, สีเงาเป็นโทนเขียวเข้ม (ไม่ใช้ดำ/เทา) ให้กลืนกับธีม
 * ยิ่งชิ้นอยู่ "สูง" (ใกล้ผู้ใช้) เงายิ่งเลื่อนลง กว้างขึ้น และเข้มขึ้นเล็กน้อย
 *   e1 พัก   — การ์ด/รายการที่วางบนพื้น (ส่วนใหญ่ของแอป)
 *   e2 ลอย   — ตัวควบคุมที่ลอยเหนือเนื้อหา: ช่องค้นหา ปุ่มวงกลม
 *   e3 ซ้อน  — ชั้นบนสุด: sheet, popover
 *   glow    — เฉพาะปุ่มหลักสีเขียว (เงาสีเดียวกับปุ่ม)
 */
const SH = 'rgba(11, 61, 38,';
export const elevation = {
  e1: { boxShadow: `0px 1px 2px ${SH} 0.05), 0px 4px 14px ${SH} 0.07)` },
  e2: { boxShadow: `0px 2px 4px ${SH} 0.06), 0px 8px 22px ${SH} 0.11)` },
  e3: { boxShadow: `0px 4px 8px ${SH} 0.06), 0px 18px 40px ${SH} 0.16)` },
  glow: { boxShadow: '0px 6px 16px rgba(20, 144, 92, 0.28)' },
  /** การ์ด = e1 */
  card: { boxShadow: `0px 1px 2px ${SH} 0.05), 0px 4px 14px ${SH} 0.07)` },
} as const;

/** การ์ด clay: พื้นสว่างกว่าฉากเล็กน้อย + ขอบไฮไลต์ขาว */
export const clayCard = {
  backgroundColor: '#F7F8F4',
  borderWidth: 1.5,
  borderColor: 'rgba(255,255,255,0.95)',
};

/** Motion — สปริงหนืดนุ่มแบบ iOS */
export const motion = {
  press: { damping: 18, stiffness: 320, mass: 0.6 },
  gentle: { damping: 20, stiffness: 140 },
};

/** ธาตุเจ้าเรือน (แพทย์แผนไทย) */
export const elementColor: Record<string, { fg: string; bg: string; label: string }> = {
  ดิน: { fg: '#B07A3C', bg: palette.peach, label: 'ธาตุดิน' },
  น้ำ: { fg: palette.primary, bg: palette.primarySoft, label: 'ธาตุน้ำ' },
  ลม: { fg: palette.teal, bg: palette.cyan, label: 'ธาตุลม' },
  ไฟ: { fg: palette.coral, bg: palette.coralSoft, label: 'ธาตุไฟ' },
};

/**
 * ขนาดตัวควบคุมตาม Apple HIG / iOS 26 (pt)
 * - พื้นที่แตะขั้นต่ำ 44×44
 * - ปุ่มแคปซูล large = 50, small = 36
 */
export const control = {
  button: 50, // ปุ่มหลัก/รอง (UIButton .large)
  buttonSmall: 36, // ชิป / ตัวสลับ (.medium)
  icon: 44, // ปุ่มไอคอนวงกลม (ย้อนกลับ ปิด แชร์)
  fab: 50, // ปุ่มกลมหลัก (เพิ่ม ไมค์)
  field: 44, // ช่องค้นหา / ช่องพิมพ์
  row: 44, // แถวรายการ (มีบรรทัดรอง ≈ 60)
  record: 72, // ปุ่มอัดเสียง (แบบ Voice Memos)
  hitSlop: { top: 6, bottom: 6, left: 6, right: 6 },
};

/** ขนาดไอคอน SF Symbols ตาม HIG */
export const iconSize = {
  chevron: 13, // ลูกศรในแถวรายการ
  inline: 17, // ในปุ่ม / ข้อความ (เท่า Body)
  bar: 20, // ปุ่มวงกลม / แถบหัวจอ
  tile: 22, // ไอคอนบนการ์ดเครื่องมือ
  feature: 28, // ไอคอนเด่น
};

/** ปรับขนาดไอคอนใดๆ ให้ลงระดับมาตรฐานด้านบน */
export function iconTier(n: number) {
  if (n <= 15) return iconSize.chevron;
  if (n <= 18) return iconSize.inline;
  if (n <= 21) return iconSize.bar;
  if (n <= 26) return iconSize.tile;
  return iconSize.feature;
}
