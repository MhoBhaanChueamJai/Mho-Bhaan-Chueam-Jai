/**
 * จุดเริ่มแอป
 * เว็บ: ต้องโหลด CanvasKit (Skia) ให้เสร็จ "ก่อน" โหลดโมดูลใดๆ ของแอป
 * ไม่งั้น Skia API ที่ถูกสร้างตอนโหลดโมดูลจะผูกกับ CanvasKit ที่ยังไม่มี → จอขาว
 * (Metro รันโมดูลตอน require ครั้งแรก จึงใช้ require ในฟังก์ชันเพื่อเลื่อนเวลาได้)
 */
import { Platform } from 'react-native';

if (Platform.OS === 'web') {
  const { LoadSkiaWeb } = require('@shopify/react-native-skia/lib/module/web');
  const base = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
  LoadSkiaWeb({ locateFile: (f) => `${base}/${f}` })
    .catch(() => {})
    .then(() => require('expo-router/entry'));
} else {
  require('expo-router/entry');
}
