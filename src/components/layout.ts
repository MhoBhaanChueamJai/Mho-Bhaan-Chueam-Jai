/**
 * จอกว้าง (Design system: Responsive) — iPad / แท็บเล็ต / เว็บบนคอม
 * - เนื้อหาอยู่ในคอลัมน์กลางจอ: หน้าแท็บ/กริด กว้างไม่เกิน 1040 · ฟอร์ม รายการ หน้ารายละเอียด ไม่เกิน 720
 * - กริดเพิ่มคอลัมน์ตามความกว้าง (useGrid) · มือถือจอเล็ก (< 375) ใช้ `compact` ลดระยะ/ขนาด
 * บนมือถือทั่วไป maxWidth ไม่มีผล (จอแคบกว่า) — หน้าตาเดิมทุกอย่าง
 */
import { StyleSheet, useWindowDimensions } from 'react-native';

export const COLUMN = { grid: 1040, read: 720 } as const;
/** ความกว้างที่นับเป็นจอกว้าง (iPad mini แนวตั้ง = 744) */
export const WIDE = 700;
/** มือถือจอเล็ก (iPhone SE / Android 360) */
export const COMPACT = 375;

/** ใส่ใน contentContainerStyle ของ ScrollView หรือกล่องนอกสุดของหน้า */
export const column = StyleSheet.create({
  grid: { width: '100%', maxWidth: COLUMN.grid, alignSelf: 'center' },
  read: { width: '100%', maxWidth: COLUMN.read, alignSelf: 'center' },
});

export function useLayout() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    wide: width >= WIDE,
    compact: width < COMPACT,
    /** ความกว้างคอลัมน์จริงบนจอนี้ */
    gridW: Math.min(width, COLUMN.grid),
    readW: Math.min(width, COLUMN.read),
    /** ระยะจากขอบจอถึงคอลัมน์ (ใช้กับสิ่งที่ลอย position: absolute เช่นแถบปุ่มล่าง) */
    side: (max: number, min = 0) => Math.max(min, (width - max) / 2),
  };
}

/**
 * กริดที่เพิ่มคอลัมน์ตามความกว้าง: ช่องกว้างอย่างน้อย `min` · ไม่น้อยกว่า `least` คอลัมน์ · ไม่เกิน `most`
 * `pad` = ระยะขอบซ้ายขวาของเนื้อหา · คืนจำนวนคอลัมน์และความกว้างช่อง
 */
export function useGrid({ min, gap, pad, least = 1, most = 6, max = COLUMN.grid }: { min: number; gap: number; pad: number; least?: number; most?: number; max?: number }) {
  const { width } = useWindowDimensions();
  const inner = Math.min(width, max) - pad * 2;
  const cols = Math.max(least, Math.min(most, Math.floor((inner + gap) / (min + gap))));
  // ปัดลง: ช่องรวมช่องไฟต้องไม่เกินแถวแม้เศษพิกเซล (ไม่งั้น flexWrap ดันช่องสุดท้ายลงแถวใหม่)
  return { cols, cell: Math.floor((inner - gap * (cols - 1)) / cols), inner };
}
