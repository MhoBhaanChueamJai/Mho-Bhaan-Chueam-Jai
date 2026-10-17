import { router, useFocusEffect, usePathname } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { AISphere } from '../../components/AISphere';
import { T } from '../../components/ui';
import { askLaunch } from '../../lib/askLaunch';

/**
 * แท็บ "ครูปัญญา" บนแถบเมนู — กดแล้วเปิดหน้าแชทเต็มจอ (หน้านี้เป็นแค่ฉากรองด้านหลัง)
 * ปิดแชท (ปุ่มย้อนกลับ / ปัดขอบจอ) → กลับแท็บที่อยู่ก่อนหน้า
 * กันค้าง: ถ้าหน้านี้ยังแสดงอยู่เองเกินครู่หนึ่ง (ไม่มีหน้าแชททับ) → พากลับแท็บเดิมอัตโนมัติ
 *   (ตอนปัดย้อนกลับ ลำดับเหตุการณ์ปิดแชท/โฟกัสแท็บไม่แน่นอน จึงไม่พึ่งแค่ตัวแปรสถานะ)
 */
export default function AskTab() {
  const path = usePathname();
  useFocusEffect(
    useCallback(() => {
      if (askLaunch.open || askLaunch.justClosed) {
        askLaunch.open = false;
        askLaunch.justClosed = false;
        router.navigate(askLaunch.lastTab as any);
        return;
      }
      askLaunch.open = true;
      router.push('/assistant');
    }, []),
  );
  // ฉากรองแสดงค้าง (ไม่มีหน้าแชทอยู่ด้านบน) → กลับแท็บเดิม
  useEffect(() => {
    if (path !== '/ask') return;
    const t = setTimeout(() => {
      askLaunch.open = false;
      askLaunch.justClosed = false;
      router.navigate(askLaunch.lastTab as any);
    }, 700);
    return () => clearTimeout(t);
  }, [path]);
  // ฉากรองระหว่างเปิด/ปิดแชท (พื้นดำเดียวกับหน้าแชท ไม่มีปุ่มให้ดูเหมือนหน้าค้าง)
  return (
    <View style={styles.page}>
      <AISphere size={110} active />
      <T v="title" center color="rgba(255,255,255,0.8)" style={{ marginTop: 8 }}>ครูปัญญา</T>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
});
