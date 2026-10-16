/**
 * ตัวเลือกในฟอร์มแบบ native iOS 26 (Design system: ป้ายอยู่ด้านบน ช่องแคปซูลพื้นมิ้นต์)
 * - Dropdown: เมนูดึงลง UIMenu ของระบบ (@react-native-menu/menu)
 * - DateField: แคปซูลเหมือนช่องอื่น + UIDatePicker compact ของ iOS 26 จริง (ปฏิทิน พ.ศ. ตาม locale th-TH)
 */
import DateTimePicker from '@react-native-community/datetimepicker';
import { MenuView } from '@react-native-menu/menu';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Sym, ios } from './ios';
import { T } from './ui';
import { palette } from '../theme';

function Label({ text }: { text: string }) {
  return <T v="subhead" color={ios.secondary} style={styles.label}>{text}</T>;
}

export function Dropdown({ label, value, options, onChange, placeholder = 'เลือก', flex }: { label: string; value: string; options: string[]; onChange: (v: string) => void; placeholder?: string; flex?: number }) {
  return (
    <View style={flex ? { flex } : undefined}>
      <Label text={label} />
      <MenuView
        title={label}
        shouldOpenOnLongPress={false}
        themeVariant="light"
        actions={options.map((o) => ({ id: o, title: o, state: o === value ? 'on' : 'off' }))}
        onPressAction={({ nativeEvent }) => onChange(nativeEvent.event)}
      >
        <View style={styles.dateBox}>
        {/* ชั้นล่าง: ปุ่ม compact ของระบบ ขยายคลุมทั้งช่อง (รับการแตะ → ป๊อปโอเวอร์ + แอนิเมชันของ iOS 26) */}
        <View style={styles.native}>
          <DateTimePicker
            value={value ?? fallback}
            mode="date"
            display="compact"
            locale="th-TH@calendar=buddhist"
            maximumDate={new Date()}
            minimumDate={new Date(1900, 0, 1)}
            accentColor={palette.primary}
            themeVariant="light"
            onChange={(e, d) => e.type === 'set' && d && onChange(d)}
            style={styles.nativePicker}
          />
        </View>
        {/* ชั้นบน: แคปซูลที่มองเห็น ทึบ บังปุ่มระบบไว้ แต่ปล่อยการแตะทะลุลงไป */}
        <View pointerEvents="none" style={[styles.box, StyleSheet.absoluteFill]} accessibilityRole="button" accessibilityLabel={`${label} ${value ? thaiDateLong(value) : placeholder}`}>
          <T v="body" color={value ? palette.ink : ios.tertiary} style={{ flex: 1 }} numberOfLines={1}>{value ? thaiDateLong(value) : placeholder}</T>
          <Sym name="calendar" size={16} color={palette.primary} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 6, marginLeft: 4, fontWeight: '600' },
  dateBox: { height: 52 },
  native: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  // ขยายปุ่ม compact ให้คลุมทั้งแคปซูล (ถูกแคปซูลชั้นบนบังไว้)
  nativePicker: { width: 140, height: 40, transform: [{ scaleX: 2.4 }, { scaleY: 1.6 }] },
  box: { height: 52, borderRadius: 26, paddingHorizontal: 18, backgroundColor: palette.mint, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: 'transparent' },
});
