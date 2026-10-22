/**
 * Supabase — ฐานข้อมูลบนคลาวด์ของหมอบ้านเชื่อมใจ (โปรเจกต์ MhoBhaanChueamJai, ap-southeast-1)
 * ใช้ publishable key (ปลอดภัยที่จะฝังในแอป) — ข้อมูลถูกป้องกันด้วย RLS ให้เห็นเฉพาะของเจ้าของบัญชี
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

export const SUPABASE_URL = 'https://ocsgxhrmoxwnxmyuqzic.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_HC212pjQWtbyePisBCcS0Q_MkL1G7Ei';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ต่ออายุ token อัตโนมัติเฉพาะตอนแอปเปิดอยู่
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (st) => {
    if (st === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/**
 * Supabase Auth ต้องใช้อีเมล → แปลงชื่อผู้ใช้เป็นอีเมลภายในแอป
 * ชื่อผู้ใช้ภาษาไทย/อักขระพิเศษ → เข้ารหัสเป็น hex ให้ได้อีเมลที่ถูกรูปแบบและคงที่
 */
export function usernameToEmail(u: string) {
  const k = u.trim().toLowerCase();
  if (/^[a-z0-9._-]+$/.test(k)) return `${k}@mhobhaan.app`;
  const hex = Array.from(new TextEncoder().encode(k), (b) => b.toString(16).padStart(2, '0')).join('');
  return `u${hex}@mhobhaan.app`;
}

/**
 * บัญชีทดลองใช้ (ปุ่ม "ทดลองใช้" หน้าเข้าสู่ระบบ ไม่ต้องสมัคร) — หลายคนใช้ร่วมกัน
 * ซิงก์ขึ้นคลาวด์เหมือนบัญชีจริง (ทุกเครื่องเห็นข้อมูลชุดเดียวกัน ใช้นำเสนอได้) · แก้/ลบบัญชีไม่ได้ · ประเภทผู้ใช้ตายตัวตามบัญชี
 */
export const DEMO_ACCOUNTS = [
  { username: 'somchai', password: '123456', kind: 'clinician', label: 'พ่อหมอสมบัติ (แพทย์)' },
  { username: 'somsri', password: '123456', kind: 'public', label: 'สมศรี (ประชาชน)' },
] as const;
export type DemoAccount = (typeof DEMO_ACCOUNTS)[number];
/** อีเมลนี้เป็นบัญชีทดลองใช้ไหม (คืนข้อมูลบัญชี หรือ undefined) */
export const demoAccountOf = (email?: string | null): DemoAccount | undefined => {
  const e = (email ?? '').toLowerCase();
  return DEMO_ACCOUNTS.find((d) => usernameToEmail(d.username).toLowerCase() === e);
};
