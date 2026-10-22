import { Platform } from 'react-native';

/**
 * เว็บ: เบราว์เซอร์ให้ใช้กล้องได้เฉพาะหน้าที่เปิดผ่าน https (หรือ localhost)
 * เปิดผ่าน http ธรรมดา (เช่น IP ในวง Wi-Fi) → ไม่มี navigator.mediaDevices ปุ่มอนุญาตจะกดไม่เกิดอะไร
 */
export const cameraBlocked = () =>
  Platform.OS === 'web' && typeof window !== 'undefined' && (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia);

export const CAMERA_HTTPS_MSG = 'เบราว์เซอร์อนุญาตให้ใช้กล้องเฉพาะเว็บที่เปิดผ่าน https เท่านั้น กรุณาเปิดแอปจากลิงก์ https';
