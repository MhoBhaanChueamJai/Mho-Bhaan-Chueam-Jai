/** คู่มือการใช้งาน (เว็บ ภาพหน้าจอจริงทุกขั้นตอน) — เปิดเป็นแผ่นซ้อนในแอป ไม่ต้องออกไปเบราว์เซอร์ */
import * as WebBrowser from 'expo-web-browser';
import { palette } from '../theme';

export const MANUAL_URL = 'https://mhobhaanchueamjai.github.io/Mho-Bhaan-Chueam-Jai/tutorial/';

export function openManual() {
  return WebBrowser.openBrowserAsync(MANUAL_URL, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    controlsColor: palette.primary,
    toolbarColor: '#F4F7F3',
  }).catch(() => {});
}
