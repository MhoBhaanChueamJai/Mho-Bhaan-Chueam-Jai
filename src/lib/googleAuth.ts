/**
 * เข้าสู่ระบบ / สมัคร ด้วยบัญชี Google (Supabase Auth · OAuth)
 * - iOS / Android: เปิดหน้าล็อกอินของ Google ในเบราว์เซอร์ของระบบ แล้วกลับเข้าแอปทาง suebsan://login
 * - เว็บ: พาไปหน้า Google ทั้งหน้า แล้วกลับมาที่ /login พร้อม token ใน # ของ URL
 * บัญชีที่ยังไม่เคยมี = สมัครให้อัตโนมัติ (ชื่อจากบัญชี Google)
 */
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { SUPABASE_KEY, SUPABASE_URL, supabase } from './supabase';

// เว็บ: เก็บ # ที่ Google ส่งกลับไว้ตั้งแต่โหลดหน้า (ก่อน router เปลี่ยน URL)
const WEB_RETURN = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hash : '';

const webRedirect = () => {
  const base = __DEV__ ? '' : (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
  return `${window.location.origin}${base}/login`;
};

/** แยก token จาก URL ที่ Google/Supabase ส่งกลับ (#access_token=… หรือ ?code=…) แล้วตั้ง session */
async function sessionFromUrl(url: string) {
  const frag = url.includes('#') ? url.split('#')[1] : url.split('?')[1] ?? '';
  const q = new URLSearchParams(frag);
  const err = q.get('error_description') || q.get('error');
  if (err) throw new Error(err);
  const code = q.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }
  const access_token = q.get('access_token');
  const refresh_token = q.get('refresh_token');
  if (!access_token || !refresh_token) return false;
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return true;
}

/** ชื่อที่แสดงจากข้อมูลบัญชี Google */
export async function googleDisplayName() {
  const { data } = await supabase.auth.getUser();
  const md = data.user?.user_metadata ?? {};
  return (md.full_name || md.name || md.first_name || data.user?.email?.split('@')[0] || 'คุณหมอ') as string;
}

/**
 * เริ่มเข้าสู่ระบบด้วย Google
 * คืน true เมื่อได้ session แล้ว (iOS/Android) · false เมื่อผู้ใช้ยกเลิก · เว็บ: เปลี่ยนหน้าไป Google (ไม่คืนค่า)
 */
export async function signInWithGoogle(): Promise<boolean> {
  // ยังไม่เปิด Google ใน Supabase → แจ้งในแอป (ไม่พาไปหน้า error ของเซิร์ฟเวอร์)
  const st = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } })
    .then((r) => r.json())
    .catch(() => null);
  if (st && !st.external?.google) throw new Error('provider is not enabled');
  const redirectTo = Platform.OS === 'web' ? webRedirect() : 'suebsan://login';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web', queryParams: { prompt: 'select_account' } },
  });
  if (error) throw error;
  if (Platform.OS === 'web') return false; // กำลังพาไปหน้า Google
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success') return false;
  return sessionFromUrl(res.url);
}

/** เว็บ: เพิ่งกลับมาจาก Google → ตั้ง session จาก URL (เรียกครั้งเดียวตอนเปิดหน้าเข้าสู่ระบบ) */
export async function finishGoogleRedirect(): Promise<boolean> {
  if (!WEB_RETURN || !/access_token|error|code=/.test(WEB_RETURN)) return false;
  const ok = await sessionFromUrl(WEB_RETURN);
  try {
    window.history.replaceState(null, '', window.location.pathname);
  } catch {}
  return ok;
}
