/** เว็บ: รอ CanvasKit (Skia) โหลดเสร็จก่อนวาดแอป — กราฟิก Skia ทุกชิ้นต้องใช้ */
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { useEffect, useState } from 'react';

export function useSkiaWeb() {
  const [ok, setOk] = useState(!!(globalThis as any).CanvasKit);
  useEffect(() => {
    if (ok) return;
    // เว็บจริง (GitHub Pages) อยู่ใต้ base path · ตอนพัฒนา (Metro) ไฟล์ public/ อยู่ที่ราก
    const base = __DEV__ ? '' : (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
    LoadSkiaWeb({ locateFile: (f: string) => `${base}/${f}` })
      .catch(() => {})
      .finally(() => setOk(true));
  }, [ok]);
  return ok;
}
