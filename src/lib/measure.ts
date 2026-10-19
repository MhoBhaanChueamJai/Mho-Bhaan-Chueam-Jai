import { Platform, StatusBar, type View } from 'react-native';

/**
 * ตำแหน่งของ View บนจอ (สำหรับวางเมนู/ป๊อปโอเวอร์ใน Modal ที่คลุมทั้งจอ)
 * Android: measureInWindow ไม่นับแถบสถานะ แต่ Modal (statusBarTranslucent) เริ่มจากขอบจอบนสุด → บวกความสูงแถบสถานะ
 */
export function measureOnScreen(v: View | null, cb: (r: { x: number; y: number; w: number; h: number }) => void) {
  v?.measureInWindow((x, y, w, h) => cb({ x, y: y + (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0), w, h }));
}
