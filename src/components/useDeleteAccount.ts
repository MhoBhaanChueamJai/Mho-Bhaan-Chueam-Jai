/**
 * ลบบัญชี: ยืนยัน 2 ขั้น (อธิบายผล → กรอกรหัสผ่าน) → ลบบนคลาวด์ → ล้างในเครื่อง → กลับหน้าเข้าสู่ระบบ
 * บัญชีทดลองใช้ (ใช้ร่วมกันหลายคน) ลบไม่ได้
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from '../lib/alert';
import { deleteAccount, verifyPassword } from '../lib/account';
import { useApp } from '../store/app';
import { clearPin } from '../store/security';
import { useHaptic } from './ui';

export function useDeleteAccount() {
  const { demo, clearLocal, update, setUnlocked } = useApp();
  const h = useHaptic();
  const [deleting, setDeleting] = useState(false);

  const leave = () => {
    clearLocal();
    clearPin();
    update({ loggedIn: false, phone: '', pinEnabled: false, faceIdEnabled: false, loginId: undefined });
    setUnlocked(false);
    router.dismissAll();
    router.replace('/login');
  };

  const run = async (pw?: string) => {
    if (!pw || !(await verifyPassword(pw))) {
      h.warn();
      return Alert.alert('รหัสผ่านไม่ถูกต้อง', 'ยังไม่ได้ลบบัญชี');
    }
    setDeleting(true);
    try {
      await deleteAccount();
      h.success();
      leave();
      setTimeout(() => Alert.alert('ลบบัญชีแล้ว', 'ข้อมูลทั้งหมดของคุณถูกลบเรียบร้อย'), 400);
    } catch {
      h.warn();
      Alert.alert('ลบบัญชีไม่สำเร็จ', 'ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่ หากยังไม่ได้ ติดต่อผู้ดูแลระบบ');
    } finally {
      setDeleting(false);
    }
  };

  const ask = () => {
    if (demo) return Alert.alert('ลบบัญชีทดลองใช้ไม่ได้', 'บัญชีทดลองใช้ใช้ร่วมกันหลายคน ถ้าต้องการล้างข้อมูลในเครื่อง ให้กดออกจากระบบในหน้าตั้งค่า');
    Alert.alert('ลบบัญชีถาวร?', 'ข้อมูลผู้ป่วย ประวัติการรักษา ตำรา เสียงเล่า และประวัติแชททั้งหมดจะถูกลบ กู้คืนไม่ได้', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ดำเนินการต่อ',
        style: 'destructive',
        onPress: () =>
          Alert.prompt('ยืนยันด้วยรหัสผ่าน', 'กรอกรหัสผ่านของบัญชีนี้เพื่อลบบัญชี', [{ text: 'ยกเลิก', style: 'cancel' }, { text: 'ลบบัญชี', style: 'destructive', onPress: run }], 'secure-text'),
      },
    ]);
  };

  return { ask, deleting };
}
