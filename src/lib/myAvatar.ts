/**
 * ภาพโปรไฟล์ — ภาพถ่ายที่เลือกเอง → ตัวการ์ตูนที่เลือก → ภาพเริ่มต้นตามประเภทผู้ใช้
 * (หมอ = พ่อหมอ · คนทั่วไป = ตัวการ์ตูนคนทั่วไป ไม่ใช้รูปพ่อหมอ)
 * ไฟล์เก็บใน Documents ของแอป (ไม่หายเมื่อล้างแคช)
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Linking } from 'react-native';
import { Alert } from './alert';
import { avatars } from '../data/mock';
import { kindOf } from './roles';
import { useApp } from '../store/app';

/** ตัวการ์ตูนให้เลือกเป็นภาพโปรไฟล์ */
export const AVATAR_PRESETS: Record<string, number> = {
  doctor: avatars.doctor,
  young_f: require('../../assets/avatars/generic/young_f.png'),
  young_m: require('../../assets/avatars/generic/young_m.png'),
  adult_f: require('../../assets/avatars/generic/adult_f.png'),
  adult_m: require('../../assets/avatars/generic/adult_m.png'),
  senior_f: require('../../assets/avatars/generic/senior_f.png'),
  senior_m: require('../../assets/avatars/generic/senior_m.png'),
};
/** ลำดับในตัวเลือก: คนทั่วไปไม่มีรูปพ่อหมอ */
export const presetKeys = (kind?: string | null) => Object.keys(AVATAR_PRESETS).filter((k) => k !== 'doctor' || kindOf(kind) !== 'public');
const PUBLIC_DEFAULT = 'young_f';

/** แหล่งภาพโปรไฟล์ปัจจุบัน */
export function useMyAvatar(): number | { uri: string } {
  const { settings } = useApp();
  if (settings.avatarUri) return { uri: settings.avatarUri };
  if (settings.avatarPreset && AVATAR_PRESETS[settings.avatarPreset]) return AVATAR_PRESETS[settings.avatarPreset];
  return kindOf(settings.userKind) === 'public' ? AVATAR_PRESETS[PUBLIC_DEFAULT] : avatars.doctor;
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

/** เมนูเปลี่ยนภาพโปรไฟล์: ถ่ายรูป / เลือกจากคลังภาพ / เลือกตัวการ์ตูน / ใช้ภาพเริ่มต้น */
export function changeAvatar(current: string | undefined, onChange: (uri: string | undefined) => void, onPreset?: () => void) {
  const run = (from: 'camera' | 'library') => pick(from).then((u) => u && onChange(u)).catch(() => {});
  Alert.alert('เปลี่ยนภาพโปรไฟล์', undefined, [
    { text: 'ถ่ายรูป', onPress: () => run('camera') },
    { text: 'เลือกจากคลังภาพ', onPress: () => run('library') },
    ...(onPreset ? [{ text: 'เลือกตัวการ์ตูน', onPress: onPreset }] : []),
    ...(current ? [{ text: 'ใช้ภาพเริ่มต้น', style: 'destructive' as const, onPress: () => onChange(undefined) }] : []),
    { text: 'ยกเลิก', style: 'cancel' as const },
  ]);
}
