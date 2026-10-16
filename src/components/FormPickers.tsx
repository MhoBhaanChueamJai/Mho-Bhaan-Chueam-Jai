/**
 * ตัวเลือกในฟอร์ม (Design system: ช่องแคปซูลพื้นมิ้นต์ ป้ายอยู่ด้านบน)
 * - Dropdown: กดแล้วมีรายการลอยใต้ช่อง (popover)
 * - DateField: กดแล้วมีปฏิทินให้เลือก (ปฏิทินพุทธศักราช)
 */
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sym, ios } from './ios';
import { Button, PressableScale, T } from './ui';
import { elevation, palette } from '../theme';

function Label({ text }: { text: string }) {
  return <T v="subhead" color={ios.secondary} style={styles.label}>{text}</T>;
}

export function Dropdown({ label, value, options, onChange, placeholder = 'เลือก', flex }: { label: string; value: string; options: string[]; onChange: (v: string) => void; placeholder?: string; flex?: number }) {
  const ref = useRef<View>(null);
  const { width: W } = useWindowDimensions();
  const [open, setOpen] = useState<{ x: number; y: number; w: number } | null>(null);
  const show = () => ref.current?.measureInWindow((x, y, w, h) => setOpen({ x, y: y + h + 6, w: Math.max(w, 160) }));
  return (
    <View style={flex ? { flex } : undefined}>
      <Label text={label} />
      <View ref={ref} collapsable={false}>
        <PressableScale haptic="select" scaleTo={0.98} onPress={show} style={[styles.box, open && styles.boxOn]} accessibilityRole="button" accessibilityLabel={`${label} ${value || placeholder}`}>
          <T v="body" color={value ? palette.ink : ios.tertiary} style={{ flex: 1 }} numberOfLines={1}>{value || placeholder}</T>
          <Sym name="chevron.down" size={13} color={ios.secondary} weight="semibold" />
        </PressableScale>
      </View>
      <Modal visible={!!open} transparent animationType="none" onRequestClose={() => setOpen(null)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(null)} />
        {open ? (
          <Animated.View entering={ZoomIn.duration(180)} exiting={FadeOut.duration(120)} style={[styles.menu, elevation.e3, { left: Math.min(open.x, W - open.w - 16), top: open.y, width: open.w }]}>
            {options.map((o, i) => (
              <PressableScale
                key={o}
                haptic="select"
                scaleTo={0.98}
                onPress={() => {
                  onChange(o);
                  setOpen(null);
                }}
                style={[styles.item, i > 0 && styles.itemSep]}
              >
                <T v="body" style={{ flex: 1, fontWeight: o === value ? '600' : '400' }} color={o === value ? palette.primary : palette.ink}>{o}</T>
                {o === value ? <Sym name="checkmark" size={15} color={palette.primary} weight="semibold" /> : null}
              </PressableScale>
            ))}
          </Animated.View>
        ) : null}
      </Modal>
    </View>
  );
}

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export const thaiDateLong = (d: Date) => `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;

export function DateField({ label, value, onChange, placeholder = 'เลือกวันที่', flex }: { label: string; value: Date | null; onChange: (d: Date) => void; placeholder?: string; flex?: number }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(value ?? new Date(1960, 0, 1));
  return (
    <View style={flex ? { flex } : undefined}>
      <Label text={label} />
      <PressableScale
        haptic="select"
        scaleTo={0.98}
        onPress={() => {
          setDraft(value ?? new Date(1960, 0, 1));
          setOpen(true);
        }}
        style={[styles.box, open && styles.boxOn]}
        accessibilityRole="button"
        accessibilityLabel={`${label} ${value ? thaiDateLong(value) : placeholder}`}
      >
        <T v="body" color={value ? palette.ink : ios.tertiary} style={{ flex: 1 }} numberOfLines={1}>{value ? thaiDateLong(value) : placeholder}</T>
        <Sym name="calendar" size={16} color={palette.primary} />
      </PressableScale>
      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        </Animated.View>
        <Animated.View entering={SlideInDown.springify().damping(20)} exiting={SlideOutDown.duration(200)} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <T v="title">{label}</T>
            <T v="callout" color={palette.primary} style={{ fontWeight: '600' }}>{thaiDateLong(draft)}</T>
          </View>
          {/* locale th-TH → ปฏิทินพุทธศักราช */}
          <DateTimePicker value={draft} mode="date" display="inline" locale="th-TH" maximumDate={new Date()} minimumDate={new Date(1900, 0, 1)} accentColor={palette.primary} themeVariant="light" onChange={(_, d) => d && setDraft(d)} />
          <Button
            label="ตกลง"
            onPress={() => {
              onChange(draft);
              setOpen(false);
            }}
            style={{ height: 52, marginTop: 8 }}
          />
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 6, marginLeft: 4, fontWeight: '600' },
  box: { height: 52, borderRadius: 26, paddingHorizontal: 18, backgroundColor: palette.mint, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: 'transparent' },
  boxOn: { backgroundColor: palette.surface, borderColor: palette.primary },
  menu: { position: 'absolute', backgroundColor: palette.surface, borderRadius: 18, borderCurve: 'continuous', paddingVertical: 4, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: 16 },
  itemSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ios.separator },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderCurve: 'continuous', paddingHorizontal: 16, paddingTop: 8 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(60,60,67,0.3)', marginBottom: 8 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 4 },
});
