/**
 * รายการแบบการ์ด (Design system: List) — ใช้กับหน้าตั้งค่า / ข้อมูลส่วนตัว / ตั้งค่า AI
 *   ระยะขอบหน้า 20 · การ์ดมุม 22 + เงา e1 · แถวสูงขั้นต่ำ 72 (padding 16×18)
 *   ไอคอนวงกลม 42 พื้นสีอ่อนของสีนั้น · เส้นคั่นเริ่มหลังไอคอน · หัวข้อส่วน h3 ห่างกัน 32
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Sym, ios } from './ios';
import { PressableScale, T } from './ui';
import { elevation, palette } from '../theme';

export const PAGE_PAD = 20;
const ICON = 42;

/** ไอคอนวงกลม: พื้นสีอ่อน + สัญลักษณ์สีเข้ม */
export function CircleIcon({ name, color = palette.primary, size = ICON }: { name: string; color?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}1F`, alignItems: 'center', justifyContent: 'center' }}>
      <Sym name={name as any} size={size * 0.45} color={color} />
    </View>
  );
}

export function ListSection({ title, footer, children, i = 0 }: { title?: string; footer?: string; children: React.ReactNode; i?: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(40 + i * 50).duration(420)} layout={LinearTransition.duration(280)} style={{ marginTop: 32 }}>
      {title ? <T v="h3" style={styles.title}>{title}</T> : null}
      <View style={[styles.group, elevation.e1]}>{children}</View>
      {footer ? <T v="caption" color={ios.secondary} style={styles.footer}>{footer}</T> : null}
    </Animated.View>
  );
}

export function ListRow({
  icon,
  overline,
  title,
  titleLines = 1,
  subtitle,
  value,
  right,
  onPress,
  last,
  danger,
  chevron,
}: {
  icon?: React.ReactNode;
  /** ป้ายเล็กเหนือหัวข้อ (ใช้กับแถวแสดงข้อมูล เช่น "อีเมล") */
  overline?: string;
  title: string;
  /** จำนวนบรรทัดสูงสุดของหัวข้อ (ข้อมูลยาวให้ขึ้นบรรทัดได้) */
  titleLines?: number;
  subtitle?: string;
  value?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
  danger?: boolean;
  chevron?: boolean;
}) {
  const body = (
    <View style={styles.row}>
      {icon}
      <View style={{ flex: 1, gap: 2 }}>
        {overline ? <T v="subhead" color={ios.secondary}>{overline}</T> : null}
        <T v="body" color={danger ? palette.coral : ios.label} style={{ fontWeight: '500' }} numberOfLines={titleLines}>{title}</T>
        {subtitle ? <T v="subhead" color={ios.secondary} numberOfLines={2}>{subtitle}</T> : null}
      </View>
      {value ? <T v="subhead" color={ios.secondary}>{value}</T> : null}
      {right}
      {chevron ? <Sym name="chevron.right" size={13} color={ios.tertiary} weight="semibold" /> : null}
      {!last ? <View style={[styles.sep, { left: icon ? 18 + ICON + 14 : 18 }]} /> : null}
    </View>
  );
  return onPress ? (
    <PressableScale onPress={onPress} scaleTo={0.99} haptic="select">
      {body}
    </PressableScale>
  ) : (
    body
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: 12, marginLeft: 4 },
  footer: { marginTop: 10, paddingHorizontal: 6 },
  group: { backgroundColor: palette.surface, borderRadius: 22, borderCurve: 'continuous' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72, paddingVertical: 16, paddingHorizontal: 18 },
  sep: { position: 'absolute', right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: ios.separator },
});
