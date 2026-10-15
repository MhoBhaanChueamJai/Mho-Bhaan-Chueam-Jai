import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import { palette } from '../../theme';

/**
 * ปุ่มกระจก "ครูปัญญา" บนแถบเมนู — กดแล้วเปิดหน้าแชทเต็มจอ (ไม่มีแถบเมนู)
 * แท็บนี้จึงไม่มีเนื้อหาของตัวเอง: สลับกลับหน้าหลักแล้วเปิด /assistant ซ้อนด้านบน
 */
export default function AskTab() {
  useFocusEffect(
    useCallback(() => {
      // ไม่ยกเลิก timer ตอน blur — การสลับไปหน้าหลักทำให้แท็บนี้ blur ทันที
      router.navigate('/home');
      setTimeout(() => router.push('/assistant'), 80);
    }, []),
  );
  return <View style={{ flex: 1, backgroundColor: palette.bg }} />;
}
