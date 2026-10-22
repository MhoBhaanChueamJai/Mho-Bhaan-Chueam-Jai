import { Platform } from 'react-native';

/**
 * เว็บ: เบราว์เซอร์ให้ใช้กล้องได้เฉพาะหน้าที่เปิดผ่าน https (หรือ localhost)
 * เปิดผ่าน http ธรรมดา (เช่น IP ในวง Wi-Fi) → ไม่มี navigator.mediaDevices ปุ่มอนุญาตจะกดไม่เกิดอะไร
 */
export const cameraBlocked = () =>
  Platform.OS === 'web' && typeof window !== 'undefined' && (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia);

export const CAMERA_HTTPS_MSG = 'เบราว์เซอร์อนุญาตให้ใช้กล้องเฉพาะเว็บที่เปิดผ่าน https เท่านั้น กรุณาเปิดแอปจากลิงก์ https';

/**
 * ขนาดจริงของภาพที่ถ่าย — เว็บ: expo-camera รายงาน width/height จากค่าตั้งของกล้อง ซึ่ง Safari บน iPhone ให้เป็นแนวนอน (เช่น 1920×1080)
 * ทั้งที่ภาพจริงเป็นแนวตั้ง → ครอปตามกรอบผิดที่ (ได้แค่มุมบนซ้ายของบัตร) จึงอ่านขนาดจากตัวภาพแทน
 */
export async function withRealSize<P extends { uri: string; width: number; height: number }>(p: P): Promise<P> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return p;
  try {
    const img = new window.Image();
    img.src = p.uri;
    await img.decode();
    return img.naturalWidth && img.naturalHeight ? { ...p, width: img.naturalWidth, height: img.naturalHeight } : p;
  } catch {
    return p;
  }
}
