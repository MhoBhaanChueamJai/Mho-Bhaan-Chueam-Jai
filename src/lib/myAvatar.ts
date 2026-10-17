/**
 * ภาพโปรไฟล์ของหมอ — ใช้ภาพที่หมอเลือกเอง (ถ่ายรูป/คลังภาพ) ไม่งั้นใช้ภาพหมอเริ่มต้น
 * ไฟล์เก็บใน Documents ของแอป (ไม่หายเมื่อล้างแคช)
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';
import { avatars } from '../data/mock';
import { useApp } from '../store/app';

/** แหล่งภาพโปรไฟล์ปัจจุบัน */
export function useMyAvatar(): number | { uri: string } {
  const { settings } = useApp();
  return settings.avatarUri ? { uri: settings.avatarUri } : avatars.doctor;
}

async function pick(from: 'camera' | 'library'): Promise<string | null> {
  const perm = from === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(from === 'camera' ? 'ใช้กล้องไม่ได้' : 'เปิดคลังภาพไม่ได้', 'อนุญาตการเข้าถึงในการตั้งค่าของเครื่องก่อนนะครับ', [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'เปิดการตั้งค่า', onPress: () => Linking.openSettings() },
    ]);
    return null;
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 };
  const r = from === 'camera' ? await ImagePicker.launchCameraAsync({ ...opts, cameraType: ImagePicker.CameraType.front }) : await ImagePicker.launchImageLibraryAsync(opts);
  if (r.canceled || !r.assets?.[0]?.uri) return null;
  // คัดลอกไปเก็บถาวร (ชื่อไฟล์ใหม่ทุกครั้ง ให้ภาพเปลี่ยนทันทีไม่ติดแคช)
  const dir = new Directory(Paths.document, 'profile');
  if (!dir.exists) dir.create({ intermediates: true });
  dir.list().forEach((f) => {
    try {
      f.delete();
    } catch {}
  });
  const dest = new File(dir, `me-${Date.now()}.jpg`);
  new File(r.assets[0].uri).copy(dest);
  return dest.uri;
}

/** เมนูเปลี่ยนภาพโปรไฟล์: ถ่ายรูป / เลือกจากคลังภาพ / ใช้ภาพเริ่มต้น */
export function changeAvatar(current: string | undefined, onChange: (uri: string | undefined) => void) {
  const run = (from: 'camera' | 'library') => pick(from).then((u) => u && onChange(u)).catch(() => {});
  Alert.alert('เปลี่ยนภาพโปรไฟล์', undefined, [
    { text: 'ถ่ายรูป', onPress: () => run('camera') },
    { text: 'เลือกจากคลังภาพ', onPress: () => run('library') },
    ...(current ? [{ text: 'ใช้ภาพเริ่มต้น', style: 'destructive' as const, onPress: () => onChange(undefined) }] : []),
    { text: 'ยกเลิก', style: 'cancel' as const },
  ]);
}
