/**
 * เสียงเล่าต้นฉบับของตำรา (โหมดเล่า)
 * - เก็บไฟล์ไว้ในเครื่อง: Documents/wisdom-audio/<รอบการเล่า>/clip-<n>.wav (ไม่หายเมื่อแอปล้างแคช)
 * - สำรองขึ้นคลาวด์ (Supabase Storage: bucket "wisdom-audio" โฟลเดอร์ของผู้ใช้) — ฟังได้แม้เปลี่ยนเครื่อง
 *   ถ้ายังไม่ได้สร้าง bucket บนเซิร์ฟเวอร์ → เก็บในเครื่องอย่างเดียว ไม่ทำให้การบันทึกล้ม
 */
import { Directory, File, Paths } from 'expo-file-system';
import type { WisdomAudio } from '../data/mock';
import { supabase } from './supabase';

const BUCKET = 'wisdom-audio';

/** ความยาวไฟล์ WAV 16kHz mono 16-bit (วินาที) จากขนาดไฟล์ */
export function wavSeconds(bytes: number) {
  return Math.max(0, Math.round((bytes - 44) / 32000));
}

/** ย้ายไฟล์ที่อัดไว้ (แคช) → โฟลเดอร์ถาวรของรอบการเล่านี้ */
export function keepClip(srcUri: string, session: string, n: number): WisdomAudio | null {
  try {
    const dir = new Directory(Paths.document, 'wisdom-audio', session);
    if (!dir.exists) dir.create({ intermediates: true });
    const src = new File(srcUri);
    const dest = new File(dir, `clip-${String(n).padStart(3, '0')}.wav`);
    if (dest.exists) dest.delete();
    src.copy(dest);
    return { uri: dest.uri, sec: wavSeconds(dest.size ?? src.size ?? 0) };
  } catch {
    return null;
  }
}

export const totalSeconds = (a?: WisdomAudio[]) => (a ?? []).reduce((s, x) => s + (x.sec || 0), 0);
export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** อัปโหลดเสียงขึ้นคลาวด์ (ข้ามไฟล์ที่อัปแล้ว) — คืนรายการที่มี path · ล้มเหลว = คืนของเดิม */
export async function uploadClips(wid: string, clips: WisdomAudio[]): Promise<WisdomAudio[]> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return clips;
  const out: WisdomAudio[] = [];
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    if (c.path || !c.uri) {
      out.push(c);
      continue;
    }
    try {
      const f = new File(c.uri);
      const bytes = await f.bytes();
      const path = `${uid}/${wid}/clip-${String(i).padStart(3, '0')}.wav`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: 'audio/wav', upsert: true });
      out.push(error ? c : { ...c, path });
    } catch {
      out.push(c);
    }
  }
  return out;
}

/** ที่อยู่สำหรับเล่น: ไฟล์ในเครื่อง (ถ้ายังอยู่) ไม่งั้นลิงก์ชั่วคราวจากคลาวด์ */
export async function playableUri(c: WisdomAudio): Promise<string | null> {
  if (c.uri) {
    try {
      if (new File(c.uri).exists) return c.uri;
    } catch {}
  }
  if (!c.path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(c.path, 3600);
  return data?.signedUrl ?? null;
}

/** ลบไฟล์เสียงของตำรา (ในเครื่อง + คลาวด์) */
export async function removeClips(clips?: WisdomAudio[]) {
  if (!clips?.length) return;
  clips.forEach((c) => {
    try {
      if (c.uri) new File(c.uri).delete();
    } catch {}
  });
  const paths = clips.map((c) => c.path).filter(Boolean) as string[];
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths).catch(() => {});
}
