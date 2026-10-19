import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { askLaunch } from '../../lib/askLaunch';

/** จำแท็บล่าสุด (ไม่นับแท็บครูปัญญา) → ปิดแชทแล้วกลับไปที่เดิม */
export function useTabMemory() {
  const path = usePathname();
  useEffect(() => {
    // เฉพาะหน้าของแท็บ (ไม่นับหน้าที่เปิดซ้อนบนแท็บ เช่น /assistant)
    const m = path?.match(/^\/(home|patients|herbs|vault)\b/);
    if (m) askLaunch.lastTab = `/${m[1]}`;
  }, [path]);
}
