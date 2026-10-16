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
        <View style={styles.box} accessibilityRole="button" accessibilityLabel={`${label} ${value || placeholder}`}>
          <T v="body" color={value ? palette.ink : ios.tertiary} style={{ flex: 1 }} numberOfLines={1}>{value || placeholder}</T>
          <Sym name="chevron.up.chevron.down" size={13} color={ios.secondary} weight="semibold" />
        </View>
      </MenuView>
    </View>
  );
}

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export const thaiDateLong = (d: Date) => `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;

/**
 * วันที่: หน้าตาเป็นแคปซูลเหมือนช่องอื่น แต่ตัวที่รับการแตะคือ UIDatePicker แบบ compact ของ iOS 26 จริง
 * (วางทับทั้งช่องแบบโปร่งใส ขยายให้คลุมทั้งแคปซูล) → แตะแล้วเปิดป๊อปโอเวอร์ Liquid Glass ของระบบ
 */
export function DateField({ label, value, onChange, flex, placeholder = 'เลือกวันที่', fallback = new Date(1960, 0, 1) }: { label: string; value: Date | null; onChange: (d: Date) => void; flex?: number; placeholder?: string; fallback?: Date }) {
  return (
    <View style={flex ? { flex } : undefined}>
      <Label text={label} />
      <View style={styles.box} accessibilityRole="button" accessibilityLabel={`${label} ${value ? thaiDateLong(value) : placeholder}`}>
        <T v="body" color={value ? palette.ink : ios.tertiary} style={{ flex: 1 }} numberOfLines={1}>{value ? thaiDateLong(value) : placeholder}</T>
        <Sym name="calendar" size={16} color={palette.primary} />
        {/* ปุ่ม compact ของระบบ (มองไม่เห็น) คลุมทั้งช่อง */}
        <View style={styles.native} pointerEvents="box-none">
          <DateTimePicker
            value={value ?? fallback}
            mode="date"
            display="compact"
            locale="th-TH"
            maximumDate={new Date()}
            minimumDate={new Date(1900, 0, 1)}
            accentColor={palette.primary}
            themeVariant="light"
            onChange={(e, d) => e.type === 'set' && d && onChange(d)}
            style={styles.nativePicker}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 6, marginLeft: 4, fontWeight: '600' },
  native: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  // ขยายปุ่ม compact ให้คลุมทั้งแคปซูล และโปร่งใสเกือบหมด (ยังรับการแตะได้)
  nativePicker: { width: 140, height: 40, opacity: 0.02, transform: [{ scaleX: 2.4 }, { scaleY: 1.6 }] },
  box: { height: 52, borderRadius: 26, paddingHorizontal: 18, backgroundColor: palette.mint, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: 'transparent' },
});
