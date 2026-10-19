/** แจ้งเตือนแบบ Push (iOS/Android): ลงทะเบียนเครื่อง · รับขณะเปิดแอป → ดึงประกาศ · กดแจ้งเตือน → เปิดหน้าที่ระบุ */
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { refreshAnnouncements } from './announcements';
import { goOf, registerPush } from './push';

export function usePushRouting(inside: boolean) {
  useEffect(() => {
    if (inside) registerPush().catch(() => {});
  }, [inside]);
  // ได้รับขณะเปิดแอป → ดึงประกาศใหม่ (กระดิ่งขึ้นจุดแดง)
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => refreshAnnouncements().catch(() => {}));
    return () => sub.remove();
  }, []);
  // กดแจ้งเตือน → เปิดหน้าที่ระบุ (เปิดแอปจากแจ้งเตือน/กดขณะใช้งาน · รอให้ปลดล็อกก่อน)
  const [pendingGo, setPendingGo] = useState<string | null>(() => goOf(Notifications.getLastNotificationResponse()));
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => setPendingGo(goOf(r)));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!pendingGo || !inside) return;
    Notifications.clearLastNotificationResponse();
    refreshAnnouncements().catch(() => {});
    setTimeout(() => router.push(pendingGo as any), 350);
    setPendingGo(null);
  }, [pendingGo, inside]);
}
