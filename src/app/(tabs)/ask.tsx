import { router, useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { AISphere } from '../../components/AISphere';
import { Button, T } from '../../components/ui';
import { askLaunch } from '../../lib/askLaunch';

/**
 * ปุ่มไมค์ "ครูปัญญา" บนแถบเมนู — กดแล้วเปิดหน้าแชทเต็มจอ (ไม่มีแถบเมนู)
 * กดย้อนกลับจากหน้าแชท → กลับหน้าหลัก (ไม่ค้างอยู่ที่แท็บนี้)
 */
export default function AskTab() {
  useFocusEffect(
    useCallback(() => {
      // กลับมาจากหน้าแชท (ปิดด้วยปุ่ม/ปัดย้อนกลับ — หน้าแชทอาจยังไม่ถูกถอดตอนแท็บนี้ได้โฟกัส) → กลับแท็บเดิม
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
  // สำรองไว้ ไม่ให้เห็นหน้าขาวระหว่างสลับหน้า
  return (
    <View style={styles.page}>
      <AISphere size={110} active />
      <T v="h2" center color="#FFFFFF" style={{ marginTop: 8 }}>ครูปัญญา</T>
      <T v="callout" center color="rgba(255,255,255,0.6)" style={{ marginTop: 4 }}>ผู้ช่วย AI สำหรับหมอพื้นบ้าน</T>
      <Button label="เริ่มคุยกับครูปัญญา" onPress={() => ((askLaunch.open = true), router.push('/assistant'))} style={{ marginTop: 24, alignSelf: 'stretch' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
});
