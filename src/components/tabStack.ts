import { Platform } from 'react-native';
import { palette } from '../theme';

/**
 * หัวหน้าจอของทุกแท็บ (Design system: Page header) — ใช้ชุดเดียวกันทุกแท็บ
 * Large Title แบบ iOS ย่อเป็นแถบกระจกเมื่อเลื่อน, ปุ่มขวาบนใช้ HeaderButton
 */
export const tabStackOptions = {
  headerLargeTitle: true,
  // เว็บไม่มี large title แบบ native → ใช้แถบหัวทึบ ไม่ทับเนื้อหา
  headerTransparent: Platform.OS === 'ios',
  headerShadowVisible: false,
  headerLargeTitleShadowVisible: false,
  headerTintColor: palette.ink,
  // iOS ใช้หัวโปร่ง (เบลอเองเมื่อเลื่อน) — กำหนดสีพื้นเฉพาะเว็บ
  headerStyle: Platform.OS === 'ios' ? undefined : { backgroundColor: palette.bg },
  contentStyle: { backgroundColor: palette.bg },
} as const;
