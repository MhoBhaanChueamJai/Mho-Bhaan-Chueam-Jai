/** เว็บ: รอ CanvasKit (Skia) โหลดเสร็จก่อนวาดแอป — กราฟิก Skia ทุกชิ้นต้องใช้ */
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { useEffect, useState } from 'react';

export function useSkiaWeb() {
  const [ok, setOk] = useState(!!(globalThis as any).CanvasKit);
  useEffect(() => {
    if (ok) return;
    // เว็บจริง (GitHub Pages) อยู่ใต้ base path · ตอนพัฒนา (Metro) ไฟล์อยู่ที่ราก → ลอง base ก่อน ไม่ได้ค่อยลองราก
    const base = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
    LoadSkiaWeb({ locateFile: (f: string) => `${base}/${f}` })
      .catch(() => (base ? LoadSkiaWeb({ locateFile: (f: string) => `/${f}` }) : null))
      .catch(() => {})
      .finally(() => setOk(true));
  }, [ok]);
  return ok;
}
