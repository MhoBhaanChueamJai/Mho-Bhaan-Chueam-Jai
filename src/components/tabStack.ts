import { platformHeader } from './nav/platformHeader';
import { palette } from '../theme';

/**
 * หัวหน้าจอของทุกแท็บ (Design system: Page header) — ใช้ชุดเดียวกันทุกแท็บ
 * Large Title แบบ iOS ย่อเป็นแถบกระจกเมื่อเลื่อน, ปุ่มขวาบนใช้ HeaderButton
 */
export const tabStackOptions = {
  headerLargeTitle: true,
  headerBackButtonDisplayMode: 'minimal',
  // Android / เว็บ: แถบหัววาดเอง (NavHeader) + Large Title ในเนื้อหา (LargeTitle) — โปร่งเหมือน iOS
  headerTransparent: true,
  headerShadowVisible: false,
  headerLargeTitleShadowVisible: false,
  headerTintColor: palette.ink,
  contentStyle: { backgroundColor: palette.bg },
  ...platformHeader,
} as const;
