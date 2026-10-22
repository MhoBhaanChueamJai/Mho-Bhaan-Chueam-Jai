import type { Doctor } from '../lib/printDocs';
import { signerTitle } from '../lib/roles';
import { useApp } from '../store/app';

/** ข้อมูลผู้บันทึกสำหรับหัวเอกสาร (ม.บ.5 / ใบส่งต่อ) — ตำแหน่งตามบทบาทที่ผู้ใช้เลือก */
export function useDoctor(): Doctor {
  const { profile, settings } = useApp();
  const name = profile?.display_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || settings.username || 'ผู้บันทึก';
  return { name, types: signerTitle(settings.userRole), cert: profile?.cert_number, province: profile?.cert_province };
}
