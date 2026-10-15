/**
 * ชิ้นส่วนแบบ iOS แท้ (ตาม Apple HIG / iOS 26)
 *  - Sym        : SF Symbols ของ Apple
 *  - AppIcon    : ไอคอนในสี่เหลี่ยมมนสีทึบ (แบบหน้า Settings)
 *  - IOSCard    : การ์ดแบน พื้น secondarySystemBackground ไม่มีเงา มุมโค้งต่อเนื่อง
 *  - Group/Row  : รายการแบบ inset grouped พร้อมเส้นคั่นและลูกศร ›
 *  - SectionTitle: หัวข้อ section แบบ Health/Fitness
 */
import { SymbolView, type SFSymbol, type SymbolWeight } from 'expo-symbols';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { PressableScale, T } from './ui';
import { iconTier, palette } from '../theme';

export const ios = {
  fill: '#F2F3F0', // secondarySystemBackground (โทนสมุนไพรอ่อนมาก)
  separator: 'rgba(60,60,67,0.16)',
  label: '#111813',
  secondary: 'rgba(60,67,62,0.62)',
  tertiary: 'rgba(60,67,62,0.36)',
  radius: 26,
};

export function Sym({ name, size = 22, color = palette.primary, weight = 'medium', type = 'monochrome' }: { name: SFSymbol; size?: number; color?: string; weight?: SymbolWeight; type?: 'monochrome' | 'hierarchical' | 'palette' | 'multicolor' }) {
  const s = iconTier(size);
  return <SymbolView name={name} size={s} tintColor={color} weight={weight} type={type} style={{ width: s, height: s }} />;
}

export function AppIcon({ name, bg, size = 29, glyph }: { name: SFSymbol; bg: string; size?: number; glyph?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.26, borderCurve: 'continuous', backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <SymbolView name={name} size={glyph ?? (size <= 32 ? 17 : 22)} tintColor="#FFFFFF" weight="semibold" style={{ width: glyph ?? (size <= 32 ? 17 : 22), height: glyph ?? (size <= 32 ? 17 : 22) }} />
    </View>
  );
}

export function IOSCard({ children, style, onPress, containerStyle }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; containerStyle?: StyleProp<ViewStyle> }) {
  const body = <View style={[styles.card, style]}>{children}</View>;
  return onPress ? (
    <PressableScale onPress={onPress} scaleTo={0.98} style={containerStyle}>
      {body}
    </PressableScale>
  ) : (
    body
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionTitle}>
      <T v="title" style={{ fontSize: 20, lineHeight: 26, fontWeight: '700' }}>{title}</T>
      {action ? (
        <PressableScale onPress={onAction} haptic="select" style={{ paddingVertical: 4, paddingLeft: 12 }}>
          <T v="callout" color={palette.primary}>{action}</T>
        </PressableScale>
      ) : null}
    </View>
  );
}

/** กลุ่มรายการ inset grouped */
export function Group({ children, style, inset = 60 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; inset?: number }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.card, { paddingVertical: 0, paddingHorizontal: 0 }, style]}>
      {items.map((c, i) => (
        <View key={i}>
          {c}
          {i < items.length - 1 ? <View style={[styles.sep, { marginLeft: inset }]} /> : null}
        </View>
      ))}
    </View>
  );
}

export function Row({
  icon,
  title,
  subtitle,
  value,
  onPress,
  chevron = true,
  leading,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  chevron?: boolean;
  leading?: React.ReactNode;
}) {
  const inner = (
    <View style={styles.row}>
      {leading}
      {icon}
      <View style={{ flex: 1 }}>
        <T v="body" numberOfLines={1}>{title}</T>
        {subtitle ? <T v="caption" color={ios.secondary} numberOfLines={2}>{subtitle}</T> : null}
      </View>
      {value ? <T v="callout" color={ios.secondary}>{value}</T> : null}
      {chevron && onPress ? <Sym name="chevron.right" size={14} color={ios.tertiary} weight="semibold" /> : null}
    </View>
  );
  return onPress ? (
    <PressableScale onPress={onPress} scaleTo={0.985} haptic="select">
      {inner}
    </PressableScale>
  ) : (
    inner
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: ios.fill, borderRadius: ios.radius, borderCurve: 'continuous', padding: 16 },
  sectionTitle: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 28, marginBottom: 10, paddingHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingHorizontal: 16, paddingVertical: 11 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: ios.separator, marginLeft: 60 },
});
