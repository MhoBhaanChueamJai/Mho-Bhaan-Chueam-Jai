/**
 * แผ่นฟอร์มแบบ iOS (formSheet): หัวแผ่น = ยกเลิก · ชื่อ · บันทึก (แบบแอปตั้งค่า/รายชื่อของ Apple)
 * ปุ่มบันทึกอยู่บนหัวแผ่น → คีย์บอร์ดไม่บัง · ความสูงกำหนดตายตัวตามสัดส่วน detent (ไม่งั้นแผ่นว่าง)
 */
import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ios } from './ios';
import { PressableScale, T } from './ui';
import { palette } from '../theme';

/** สัดส่วนความสูงของแผ่น (ต้องตรงกับ sheetAllowedDetents ใน _layout) */
export const FORM_SHEET_DETENT = 0.62;

export function FormSheet({ title, canSave, busy, onSave, children }: { title: string; canSave: boolean; busy?: boolean; onSave: () => void; children: React.ReactNode }) {
  const { height: SH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    // ความสูงตายตัว = สัดส่วน detent ของจอ (หักขอบบน) — ใช้ flex แล้วแผ่นว่าง
    <View style={{ height: (SH - insets.top) * FORM_SHEET_DETENT, backgroundColor: palette.bg }}>
      <View style={styles.head}>
        <PressableScale haptic="select" onPress={() => router.back()} hitSlop={10} style={styles.side} accessibilityLabel="ยกเลิก">
          <T v="body" color={palette.primary}>ยกเลิก</T>
        </PressableScale>
        <T v="bodyStrong" center numberOfLines={1} style={{ flex: 1 }}>{title}</T>
        <View style={[styles.side, { alignItems: 'flex-end' }]}>
          {busy ? (
            <ActivityIndicator color={palette.primary} />
          ) : (
            <PressableScale haptic="press" onPress={onSave} disabled={!canSave} hitSlop={10} accessibilityLabel="บันทึก">
              <T v="body" color={canSave ? palette.primary : ios.tertiary} style={{ fontWeight: '700' }}>บันทึก</T>
            </PressableScale>
          )}
        </View>
      </View>
      {/* ฟอร์มสั้น ใช้ View ธรรมดา (ScrollView ในแผ่น iOS ทำให้เนื้อหาหาย/หัวแผ่นถูกดันพ้นจอ) */}
      <Pressable onPress={Keyboard.dismiss} accessible={false} style={styles.body}>
        {children}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 10 },
  side: { width: 64 },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 6, gap: 14 },
});
