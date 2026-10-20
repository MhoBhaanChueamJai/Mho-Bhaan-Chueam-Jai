/**
 * รูปและวิดีโอประกอบตำรา (ท่านวด วิธีปรุงยา ต้นสมุนไพร) — ความรู้หลายอย่างต้องเห็นด้วยตา
 * - เก็บไฟล์ในเครื่อง: Documents/wisdom-media/<ตำรา>/<id>.<jpg|mp4>
 * - สำรองขึ้นคลาวด์ (Storage โฟลเดอร์ของผู้ใช้ <uid>/<ตำรา>/media-<id>) + รายการไฟล์ในไฟล์ข้อมูลส่วนตัว (ไม่ต้องแก้ฐานข้อมูล)
 * - ลบบัญชี → ไฟล์ในโฟลเดอร์ตำราถูกลบตาม
 */
import { Directory, File, Paths } from 'expo-file-system';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { setItems, useItems } from './userStore';

export type Media = { id: string; type: 'image' | 'video'; uri?: string; path?: string; w?: number; h?: number; sec?: number; at: number };

const BUCKET = 'wisdom-audio';
const MAX_VIDEO_BYTES = 45 * 1024 * 1024;
const key = (wid: string) => `media-${wid}`;
export const useWisdomMedia = (wid: string) => useItems<Media>(key(wid));

/** เก็บไฟล์ไว้ในเครื่องถาวร (แคชของตัวเลือกภาพอาจถูกล้าง) */
function keep(srcUri: string, wid: string, name: string) {
  if (Platform.OS === 'web') return srcUri;
  try {
    const dir = new Directory(Paths.document, 'wisdom-media', wid);
    if (!dir.exists) dir.create({ intermediates: true });
    const dest = new File(dir, name);
    if (dest.exists) dest.delete();
    new File(srcUri).copy(dest);
    return dest.uri;
  } catch {
    return srcUri;
  }
}

async function upload(m: Media, wid: string): Promise<Media> {
  try {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid || !m.uri) return m;
    const ext = m.type === 'video' ? 'mp4' : 'jpg';
    const bytes = Platform.OS === 'web' ? new Uint8Array(await (await fetch(m.uri)).arrayBuffer()) : await new File(m.uri).bytes();
    if (bytes.byteLength > MAX_VIDEO_BYTES) return m; // ใหญ่เกิน → เก็บในเครื่องอย่างเดียว
    const path = `${uid}/${wid}/media-${m.id}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: m.type === 'video' ? 'video/mp4' : 'image/jpeg', upsert: true });
    return error ? m : { ...m, path };
  } catch {
    return m;
  }
}

/** เลือกจากคลังภาพ หรือถ่ายใหม่ → เพิ่มเข้าตำรา (คืนจำนวนที่เพิ่ม) */
export async function addMedia(wid: string, current: Media[], from: 'library' | 'camera'): Promise<number> {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images', 'videos'], quality: 0.85, videoMaxDuration: 120, allowsMultipleSelection: from === 'library', selectionLimit: 6 };
  if (from === 'camera') {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) return 0;
  }
  const r = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (r.canceled) return 0;
  const added: Media[] = [];
  for (const a of r.assets) {
    const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    if (a.type === 'video') {
      added.push({ id, type: 'video', uri: keep(a.uri, wid, `${id}.mp4`), w: a.width, h: a.height, sec: a.duration ? Math.round(a.duration / 1000) : undefined, at: Date.now() });
    } else {
      // ย่อรูปให้พอดีจอ (ประหยัดที่เก็บและเน็ต)
      const img = await manipulateAsync(a.uri, a.width > 1600 ? [{ resize: { width: 1600 } }] : [], { compress: 0.8, format: SaveFormat.JPEG });
      added.push({ id, type: 'image', uri: keep(img.uri, wid, `${id}.jpg`), w: img.width, h: img.height, at: Date.now() });
    }
  }
  let list = [...current, ...added];
  setItems(key(wid), list);
  // อัปโหลดทีละไฟล์ (ไม่ส่งพร้อมกันหลายไฟล์)
  for (const m of added) {
    const up = await upload(m, wid);
    if (up.path) {
      list = list.map((x) => (x.id === m.id ? up : x));
      setItems(key(wid), list);
    }
  }
  return added.length;
}

export async function removeMedia(wid: string, current: Media[], m: Media) {
  setItems(key(wid), current.filter((x) => x.id !== m.id));
  if (m.path) await supabase.storage.from(BUCKET).remove([m.path]).catch(() => {});
  if (m.uri && Platform.OS !== 'web') {
    try {
      const f = new File(m.uri);
      if (f.exists) f.delete();
    } catch {}
  }
}

/** ที่อยู่ไฟล์สำหรับแสดง: ไฟล์ในเครื่องก่อน · ไม่มี (เปลี่ยนเครื่อง) → ลิงก์ชั่วคราวจากคลาวด์ */
export async function mediaUrl(m: Media): Promise<string | null> {
  if (m.uri) {
    if (Platform.OS === 'web') return m.uri;
    try {
      if (new File(m.uri).exists) return m.uri;
    } catch {}
  }
  if (!m.path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(m.path, 3600);
  return data?.signedUrl ?? null;
}
