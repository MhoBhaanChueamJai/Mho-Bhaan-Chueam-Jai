/**
 * Android / เว็บ: ระยะเลื่อนของแต่ละหน้า (ตาม route key) — หัวหน้าจอใช้ค่านี้ทำ Large Title หดเป็นชื่อเล็ก
 * และแสดงขอบเบลอเมื่อเนื้อหาเลื่อนเข้าใต้แถบ (แบบ scroll edge effect ของ iOS 26)
 */
import { Platform } from 'react-native';
import { makeMutable, type SharedValue } from 'react-native-reanimated';

const map = new Map<string, SharedValue<number>>();
export function headerScrollY(key: string) {
  let v = map.get(key);
  if (!v) {
    v = makeMutable(0);
    map.set(key, v);
  }
  return v;
}
/** ความสูงแถบหัว (ไม่รวมแถบสถานะ) — ปุ่มกระจก 44 + ช่องว่างล่าง */
export const BAR_H = 54;
/** ความสูงบรรทัด Large Title (34pt) */
export const LARGE_H = 52;

/** แถบแท็บหด (1) เมื่อเลื่อนเนื้อหาลง · กาง (0) เมื่อเลื่อนขึ้น — แบบ minimizeBehavior="onScrollDown" ของ iOS 26 */
export const tabMinimized = makeMutable(0);

/** ระยะบนของแถบหัว: เว็บไม่มีแถบสถานะ → เว้น 8 ไม่ให้ปุ่มชิดขอบ */
export const topOf = (insetTop: number) => (Platform.OS === 'web' ? Math.max(insetTop, 8) : insetTop);
