/**
 * ตัวเลือกในฟอร์มแบบ native iOS 26 (Design system: ป้ายอยู่ด้านบน ช่องแคปซูลพื้นมิ้นต์)
 * - Dropdown: เมนูดึงลง UIMenu ของระบบ (@react-native-menu/menu)
 * - DateField: แคปซูลเหมือนช่องอื่น กดแล้วปฏิทินลอยใต้ช่องแบบ popover (ปฏิทิน พ.ศ. ตาม locale th-TH)
 */
import DateTimePicker from '@react-native-community/datetimepicker';
import { MenuView } from '@react-native-menu/menu';
import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeOut, ZoomIn } from 'react-native-reanimated';
import { Sym, ios } from './ios';
import { PressableScale, T } from './ui';
import { elevation, palette } from '../theme';

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
 * วันที่: แคปซูลเหมือนช่องอื่น (แสดง "14 เมษายน 2542") กดแล้วปฏิทินลอยใต้ช่อง
 * แบบ popover ของ iOS (compact) — เลือกวันแล้วปิดเอง, แตะนอกกรอบเพื่อปิด
 */
export function DateField({ label, value, onChange, flex, placeholder = 'เลือกวันที่', fallback = new Date(1960, 0, 1) }: { label: string; value: Date | null; onChange: (d: Date) => void; flex?: number; placeholder?: string; fallback?: Date }) {
  const ref = useRef<View>(null);
  const { width: W, height: H } = useWindowDimensions();
  const [at, setAt] = useState<{ x: number; y: number; up: boolean } | null>(null);
  const PW = Math.min(W - 24, 360);
  const PH = 360;
  const show = () =>
    ref.current?.measureInWindow((x, y, w, h) => {
      const up = y + h + PH + 40 > H; // ที่ด้านล่างไม่พอ → เปิดขึ้นด้านบน
      setAt({ x: Math.max(12, Math.min(x, W - PW - 12)), y: up ? y - PH - 8 : y + h + 8, up });
    });
  return (
    <View style={flex ? { flex } : undefined}>
      <Label text={label} />
      <View ref={ref} collapsable={false}>
        <PressableScale haptic="select" scaleTo={0.98} onPress={show} style={[styles.box, at && styles.boxOn]} accessibilityRole="button" accessibilityLabel={`${label} ${value ? thaiDateLong(value) : placeholder}`}>
          <T v="body" color={value ? palette.ink : ios.tertiary} style={{ flex: 1 }} numberOfLines={1}>{value ? thaiDateLong(value) : placeholder}</T>
          <Sym name="calendar" size={16} color={palette.primary} />
        </PressableScale>
      </View>
      <Modal visible={!!at} transparent animationType="none" onRequestClose={() => setAt(null)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setAt(null)} />
        {at ? (
          <Animated.View entering={ZoomIn.springify().damping(18)} exiting={FadeOut.duration(140)} style={[styles.pop, elevation.e3, { left: at.x, top: at.y, width: PW }]}>
            {/* locale th-TH → ปฏิทินพุทธศักราช */}
            <DateTimePicker
              value={value ?? fallback}
              mode="date"
              display="inline"
              locale="th-TH"
              maximumDate={new Date()}
              minimumDate={new Date(1900, 0, 1)}
              accentColor={palette.primary}
              themeVariant="light"
              onChange={(e, d) => {
                if (!d) return;
                const prev = value ?? fallback;
                onChange(d);
                // แตะเลือกวัน (เลขวันเปลี่ยน) → ปิดเอง · เปลี่ยนเดือน/ปีจากหัวปฏิทิน (เลขวันเท่าเดิม) → ยังเปิดอยู่
                if (d.getDate() !== prev.getDate()) setTimeout(() => setAt(null), 250);
              }}
              style={{ width: PW - 16, alignSelf: 'center' }}
            />
          </Animated.View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 6, marginLeft: 4, fontWeight: '600' },
  pop: { position: 'absolute', backgroundColor: palette.surface, borderRadius: 24, borderCurve: 'continuous', paddingVertical: 8 },
  boxOn: { backgroundColor: palette.surface, borderColor: palette.primary },
  box: { height: 52, borderRadius: 26, paddingHorizontal: 18, backgroundColor: palette.mint, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: 'transparent' },
});
