/**
 * แจ้งเตือนแบบ Push (APNs): ขออนุญาต → ส่ง device token ขึ้น Supabase (register_push_token)
 * ทางระบบเพิ่มประกาศ → Edge Function send-push ส่งถึงทุกเครื่อง · กดแจ้งเตือน → เปิดหน้าที่ระบุใน go
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// แอปเปิดอยู่ก็ยังแสดงแบนเนอร์
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/** ขออนุญาต (ครั้งแรกจะมีกล่องของ iOS) แล้วลงทะเบียนเครื่อง — เรียกซ้ำได้ (ย้ายเจ้าของ token ตามบัญชีที่เข้าสู่ระบบ) */
export async function registerPush(ask = true) {
  if (Platform.OS !== 'ios') return false;
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && ask) status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return false;
    const { data } = await Notifications.getDevicePushTokenAsync();
    if (typeof data !== 'string' || !data) return false;
    await supabase.rpc('register_push_token', { p_token: data, p_platform: 'ios' });
    return true;
  } catch {
    return false;
  }
}

/** หน้าที่ต้องเปิดจากแจ้งเตือนที่ถูกกด */
export function goOf(r: Notifications.NotificationResponse | null | undefined) {
  const req = r?.notification.request;
  // expo อ่านข้อมูลจากคีย์ body · APNs ดิบอยู่ใน trigger.payload
  const payload = req?.trigger && 'payload' in req.trigger ? (req.trigger.payload as Record<string, unknown> | undefined) : undefined;
  const go = req?.content.data?.go ?? payload?.go;
  return typeof go === 'string' && go.startsWith('/') ? go : null;
}
