/**
 * เว็บ: Skia ถ่ายภาพ View เองไม่ได้ → วาด DOM ของหน้าเป็นภาพด้วย html2canvas แล้วแปลงเป็น SkImage
 * (ให้การพลิกหน้าแบบม้วนกระดาษทำงานเหมือนบน iOS)
 */
import { Skia, type SkImage } from '@shopify/react-native-skia';
import html2canvas from 'html2canvas';
import type React from 'react';
import type { View } from 'react-native';

export async function snapView(ref: React.RefObject<View>): Promise<SkImage | null> {
  const el = ref.current as unknown as HTMLElement | null;
  if (!el) return null;
  const canvas = await html2canvas(el, { backgroundColor: null, scale: Math.min(2, window.devicePixelRatio || 1), useCORS: true, logging: false });
  const b64 = canvas.toDataURL('image/png').split(',')[1];
  return Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(b64));
}
