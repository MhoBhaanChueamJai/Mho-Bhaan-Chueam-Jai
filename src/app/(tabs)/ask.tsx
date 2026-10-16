import { router, useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { AISphere } from '../../components/AISphere';
import { Button, T } from '../../components/ui';
import { askLaunch } from '../../lib/askLaunch';
import { palette } from '../../theme';

/**
 * ปุ่มไมค์ "ครูปัญญา" บนแถบเมนู — กดแล้วเปิดหน้าแชทเต็มจอ (ไม่มีแถบเมนู)
 * กดย้อนกลับจากหน้าแชท → กลับหน้าหลัก (ไม่ค้างอยู่ที่แท็บนี้)
 */
export default function AskTab() {
  useFocusEffect(
    useCallback(() => {
      if (askLaunch.justClosed) {
        // เพิ่งปิดหน้าแชท → พากลับหน้าหลัก ไม่เปิดแชทซ้ำ
        askLaunch.justClosed = false;
        router.navigate('/home');
        return;
      }
      const t = setTimeout(() => router.push('/assistant'), 60);
      return () => clearTimeout(t);
    }, []),
  );
  // สำรองไว้ ไม่ให้เห็นหน้าขาวระหว่างสลับหน้า
  return (
    <View style={styles.page}>
      <AISphere size={110} active />
      <T v="h2" center style={{ marginTop: 8 }}>ครูปัญญา</T>
      <T v="callout" center color={palette.inkSoft} style={{ marginTop: 4 }}>ผู้ช่วย AI สำหรับหมอพื้นบ้าน</T>
      <Button label="เริ่มคุยกับครูปัญญา" onPress={() => router.push('/assistant')} style={{ marginTop: 24, alignSelf: 'stretch' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
});
