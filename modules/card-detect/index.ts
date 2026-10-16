import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export type CardRect = { x: number; y: number; width: number; height: number; confidence: number; imageWidth: number; imageHeight: number };

const Native = Platform.OS === 'ios' ? requireOptionalNativeModule<{ detect(uri: string): Promise<CardRect | null> }>('CardDetect') : null;

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
