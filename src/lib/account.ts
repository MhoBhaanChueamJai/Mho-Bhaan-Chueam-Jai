/**
 * จัดการบัญชี: แก้ชื่อ · เปลี่ยนรหัสผ่าน · ลบบัญชี
 * บัญชีทดลองใช้ (ใช้ร่วมกันหลายคน) แก้/ลบไม่ได้ — กันคนหนึ่งเปลี่ยนแล้วกระทบคนอื่น
 */
import { Directory, Paths } from 'expo-file-system';
import { supabase } from './supabase';

async function myEmail() {
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? null;
}

/** ตรวจรหัสผ่านปัจจุบัน (เข้าสู่ระบบซ้ำด้วยอีเมลเดิม) */
export async function verifyPassword(password: string): Promise<boolean> {
  const email = await myEmail();
  if (!email) return false;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return !error;
}

/** แก้ชื่อ-นามสกุล (โปรไฟล์ + ข้อมูลบัญชี) */
export async function updateName(first: string, last: string) {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error('กรุณาเข้าสู่ระบบก่อน');
  const display = `${first} ${last}`.trim();
  const { error } = await supabase.from('profiles').update({ first_name: first, last_name: last, display_name: display }).eq('id', uid);
  if (error) throw error;
  await supabase.auth.updateUser({ data: { first_name: first, last_name: last, display_name: display } }).catch(() => {});
}

/** บันทึกบทบาทผู้ใช้ขึ้นคลาวด์ (ถ้าฐานข้อมูลยังไม่มีคอลัมน์ → เก็บในเครื่องอย่างเดียว ซิงก์ทีหลัง) */
export async function saveUserRole(role: string) {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return;
  await supabase.from('profiles').update({ user_role: role }).eq('id', uid);
}

/** เปลี่ยนรหัสผ่าน: ตรวจรหัสเดิมก่อน */
export async function changePassword(current: string, next: string): Promise<'ok' | 'wrong' | 'same' | 'error'> {
  if (current === next) return 'same';
  if (!(await verifyPassword(current))) return 'wrong';
  const { error } = await supabase.auth.updateUser({ password: next });
  return error ? 'error' : 'ok';
}

/** ลบไฟล์เสียงเล่าของผู้ใช้ใน Storage (โฟลเดอร์ <uid>/<ตำรา>/…) */
async function removeMyAudio(uid: string) {
  const b = supabase.storage.from('wisdom-audio');
  const { data: folders } = await b.list(uid, { limit: 1000 });
  for (const f of folders ?? []) {
    const { data: files } = await b.list(`${uid}/${f.name}`, { limit: 1000 });
    const paths = (files ?? []).map((x) => `${uid}/${f.name}/${x.name}`);
    if (paths.length) await b.remove(paths);
  }
}

/** ลบบัญชีถาวร: ไฟล์เสียงบนคลาวด์ → บัญชี + ข้อมูลทั้งหมด (ฐานข้อมูลลบตามอัตโนมัติ) → ไฟล์ในเครื่อง */
export async function deleteAccount() {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error('กรุณาเข้าสู่ระบบก่อน');
  await removeMyAudio(uid).catch(() => {});
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  for (const name of ['wisdom-audio', 'profile']) {
    try {
      const d = new Directory(Paths.document, name);
      if (d.exists) d.delete();
    } catch {}
  }
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}
