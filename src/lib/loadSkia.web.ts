/** เว็บ: โหลด CanvasKit (Skia) จาก canvaskit.wasm ใน public/ */
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

export async function loadSkia() {
  const base = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
  await LoadSkiaWeb({ locateFile: (f: string) => `${base}/${f}` });
}
