import { doctorTypes } from '../data/mock';
import { TYPE_LABEL } from '../app/verify';
import type { Doctor } from '../lib/printDocs';
import { useApp } from '../store/app';

/** ข้อมูลหมอสำหรับหัวเอกสาร (ม.บ.5 / ใบส่งต่อ) */
export function useDoctor(): Doctor {
  const { profile, settings } = useApp();
  const name = profile?.display_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || settings.username || 'หมอพื้นบ้าน';
  const types = profile?.healer_types?.length
    ? profile.healer_types.map((t) => TYPE_LABEL[t] ?? t).join(', ')
    : (doctorTypes.find((d) => d.key === settings.doctorType) ?? doctorTypes[0]).label;
  return { name, types, cert: profile?.cert_number, province: profile?.cert_province };
}
