/**
 * เตือนในเครื่อง (ไม่ต้องใช้เซิร์ฟเวอร์): นัดติดตามอาการ · ถามอาการหลังรักษา 3 วัน · ยาในคลังใกล้หมดอายุ
 * ใช้ local notification ของเครื่อง (iOS/Android) — เว็บไม่มีการแจ้งเตือน จึงข้าม
 * id แจ้งเตือนผูกกับผู้ป่วย/ยา: ตั้งใหม่แทนของเดิมเสมอ (ไม่เตือนซ้ำซ้อน)
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const ok = Platform.OS !== 'web';

async function allowed() {
  if (!ok) return false;
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (Platform.OS === 'android')
      await Notifications.setNotificationChannelAsync('reminders', { name: 'เตือนนัดและยา', importance: Notifications.AndroidImportance.DEFAULT });
    return status === 'granted';
  } catch {
    return false;
  }
}

/** ตั้งเตือนที่เวลา (ถ้าเวลาผ่านไปแล้ว = ไม่ตั้ง) */
export async function remindAt(id: string, at: Date, title: string, body: string, go: string) {
  if (!ok) return;
  await cancelReminder(id);
  if (at.getTime() <= Date.now() + 60_000 || !(await allowed())) return;
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body, data: { go }, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}) },
  }).catch(() => {});
}

export async function cancelReminder(id: string) {
  if (!ok) return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

/** "2026-10-27" → วันนั้นเวลา hh:00 */
export const dayAt = (iso: string, hour: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, hour, 0, 0);
};
/** วันนี้ + n วัน → "YYYY-MM-DD" */
export const isoIn = (days: number, from = new Date()) => {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const todayIso = () => isoIn(0);
/** "2026-10-27" → "อ. 27 ต.ค." */
export const thShort = (iso: string) => dayAt(iso, 12).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });

/** นัดติดตามอาการ: เตือน 8 โมงเช้าวันนัด */
export const remindFollowUp = (pid: string, name: string, iso: string, what: string) =>
  remindAt(`fu-${pid}`, dayAt(iso, 8), `วันนี้มีนัดติดตามอาการ: ${name}`, what || 'แตะเพื่อดูประวัติการรักษาและบันทึกผล', `/patient/${pid}`);

/** ถามอาการหลังรักษา 3 วัน: เตือน 9 โมงเช้า → เปิดหน้าผู้ป่วยพร้อมข้อความถามอาการ */
export const remindCheckIn = (pid: string, name: string) =>
  remindAt(`ci-${pid}`, dayAt(isoIn(3), 9), `ถามอาการ ${name} หลังรักษา`, 'ครบ 3 วันแล้ว แตะเพื่อส่งข้อความถามอาการทาง LINE หรือ SMS', `/patient/${pid}?ask=1`);
