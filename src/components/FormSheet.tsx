/**
 * แผ่นฟอร์มแบบ iOS (formSheet): หัวแผ่น = ปุ่มวงกลม ✕ · ชื่อ · ✓ (แบบแอปของ Apple บน iOS 26)
 * ปุ่มบันทึกอยู่บนหัวแผ่น → คีย์บอร์ดไม่บัง · ความสูงกำหนดตายตัวตามสัดส่วน detent (ไม่งั้นแผ่นว่าง)
 */
import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sym, ios } from './ios';
import { GlassCircle, PressableScale, T } from './ui';
import { SHEET_NATIVE, SheetFrame } from './nav/SheetFrame';
import { palette } from '../theme';


export function FormSheet({ title, canSave, busy, onSave, children }: { title: string; canSave: boolean; busy?: boolean; onSave: () => void; children: React.ReactNode }) {
  const { height: SH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    // แผ่นเต็มจอ (detent 1.0) — ความสูงต้องกำหนดตายตัว ใช้ flex แล้วแผ่นว่าง
    <SheetFrame>
    <View style={{ height: SHEET_NATIVE ? SH - insets.top - 10 : '100%', backgroundColor: palette.bg }}>
      {/* หัวแผ่นแบบ iOS 26: ปุ่มกระจกวงกลม ✕ (ยกเลิก) · ชื่อ · ✓ (บันทึก สีเด่นเมื่อกดได้) */}
      <View style={styles.head}>
        <GlassCircle label="ยกเลิก" onPress={() => router.back()}>
          <Sym name="xmark" size={17} color={palette.ink} weight="semibold" />
        </GlassCircle>
        <T v="bodyStrong" center numberOfLines={1} style={{ flex: 1 }}>{title}</T>
        <PressableScale haptic="press" scaleTo={0.92} onPress={onSave} disabled={!canSave || busy} accessibilityLabel="บันทึก" accessibilityState={{ disabled: !canSave || busy }}>
          <View style={[styles.save, canSave || busy ? styles.saveOn : styles.saveOff]}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Sym name="checkmark" size={18} color={canSave ? '#FFFFFF' : ios.tertiary} weight="bold" />}
          </View>
        </PressableScale>
      </View>
      {/* ฟอร์มสั้น ใช้ View ธรรมดา (ScrollView ในแผ่น iOS ทำให้เนื้อหาหาย/หัวแผ่นถูกดันพ้นจอ) */}
      <Pressable onPress={Keyboard.dismiss} accessible={false} style={styles.body}>
        {children}
      </Pressable>
    </View>
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  save: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  saveOn: { backgroundColor: palette.primary, boxShadow: '0px 4px 12px rgba(20,144,92,0.35)' },
  saveOff: { backgroundColor: 'rgba(120,120,128,0.14)' },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 6, gap: 14 },
});
