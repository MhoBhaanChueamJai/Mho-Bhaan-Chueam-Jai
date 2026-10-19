/** คู่มือการใช้งาน (เว็บ ภาพหน้าจอจริงทุกขั้นตอน) — เปิดในเบราว์เซอร์ของเครื่อง (Safari / Chrome) */
import { Linking } from 'react-native';

export const MANUAL_URL = 'https://mhobhaanchueamjai.github.io/Mho-Bhaan-Chueam-Jai/tutorial/';

export function openManual() {
  return Linking.openURL(MANUAL_URL).catch(() => {});
}
