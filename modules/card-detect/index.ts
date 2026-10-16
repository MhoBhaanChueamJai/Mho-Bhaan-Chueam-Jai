import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export type CardRect = { x: number; y: number; width: number; height: number; confidence: number; imageWidth: number; imageHeight: number };

export type ExtractedCard = { uri: string; width: number; height: number; x: number; y: number; boxWidth: number; boxHeight: number };

const Native =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<{
        detect(uri: string): Promise<CardRect | null>;
        extract(uri: string, hint: { x: number; y: number; width: number; height: number } | null): Promise<ExtractedCard | null>;
        extractDoc(uri: string): Promise<ExtractedCard | null>;
      }>('CardDetect')
    : null;

/** มีตัวตรวจจับบัตร (iOS เท่านั้น) */
export const cardDetectAvailable = !!Native;

/** หาสี่เหลี่ยมสัดส่วนบัตรในรูป — คืนกรอบ normalized (0–1) หรือ null */
export async function detectCard(uri: string): Promise<CardRect | null> {
  if (!Native) return null;
  try {
    return await Native.detect(uri);
  } catch {
    return null;
  }
}

/** ตัดบัตรพอดีขอบ + ดัดให้ตรง (perspective correction) จากรูปเต็ม — hint = กรอบบนจอแบบ normalized */
export async function extractCard(uri: string, hint?: { x: number; y: number; width: number; height: number }): Promise<ExtractedCard | null> {
  if (!Native) return null;
  try {
    return await Native.extract(uri, hint ?? null);
  } catch {
    return null;
  }
}

/** ตำรา/เอกสาร: ตัดพอดีขอบกระดาษ + ดัดให้ตรง (สัดส่วนใดก็ได้) */
export async function extractDoc(uri: string): Promise<ExtractedCard | null> {
  if (!Native?.extractDoc) return null;
  try {
    return await Native.extractDoc(uri);
  } catch {
    return null;
  }
}
