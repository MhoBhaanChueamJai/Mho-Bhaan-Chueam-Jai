import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ChevronLeft, Search } from './icons';
import React, { useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { useApp } from '../store/app';
import { Image } from 'expo-image';
import { clayCard, control, elevation, motion, palette, radius, space, type, type TypeVariant } from '../theme';

/* ───────────── Typography ───────────── */
export function T({
  v = 'body',
  color = palette.ink,
  style,
  center,
  ...rest
}: TextProps & { v?: TypeVariant; color?: string; center?: boolean; style?: StyleProp<TextStyle> }) {
  const t = type[v];
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={1.6}
      style={[{ fontSize: t.size, lineHeight: t.line, fontWeight: t.weight, color }, center && { textAlign: 'center' }, style]}
    />
  );
}

/* ───────────── Haptics ───────────── */
export function useHaptic() {
  const { settings } = useApp();
  return {
    tap: () => settings.haptics && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    press: () => settings.haptics && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    heavy: () => settings.haptics && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
    success: () => settings.haptics && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    warn: () => settings.haptics && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    select: () => settings.haptics && Haptics.selectionAsync(),
  };
}

/* ───────────── PressableScale: ยุบตัวนุ่มแบบสปริง + สั่นเบาๆ ───────────── */
const APressable = Animated.createAnimatedComponent(Pressable);
export function PressableScale({
  children,
  style,
  scaleTo = 0.96,
  haptic = 'tap',
  onPress,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number; haptic?: 'tap' | 'press' | 'select' | 'none'; children?: React.ReactNode }) {
  const s = useSharedValue(1);
  const h = useHaptic();
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <APressable
      {...rest}
      accessibilityRole="button"
      onPressIn={(e) => {
        s.value = withSpring(scaleTo, motion.press);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withSpring(1, motion.press);
        rest.onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic !== 'none') h[haptic]();
        onPress?.(e);
      }}
      style={[style, aStyle]}
    >
      {children}
    </APressable>
  );
}

/* ───────────── พื้นหลังเรียบ สีกลาง ───────────── */
export function Backdrop() {
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg }]} pointerEvents="none" />;
}


/* ───────────── Liquid Glass (iOS 26) — ใช้กับชั้น navigation/controls ตามแนวทาง Apple ───────────── */
const LIQUID = isLiquidGlassAvailable();
export function Glass({
  children,
  style,
  tint,
  interactive,
  clear,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tint?: string;
  interactive?: boolean;
  clear?: boolean;
}) {
  if (LIQUID) {
    return (
      <GlassView glassEffectStyle={clear ? 'clear' : 'regular'} tintColor={tint ?? 'rgba(255,255,255,0.55)'} isInteractive={interactive} colorScheme="light" style={[{ overflow: 'hidden' }, style]}>
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tint ?? 'rgba(255,255,255,0.6)' }]} />
      {children}
    </View>
  );
}

/** ปุ่มกระจกวงกลม (back, bell, ปิด) */
export function GlassCircle({ children, onPress, size = control.icon, label, tint }: { children: React.ReactNode; onPress?: () => void; size?: number; label: string; tint?: string }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} scaleTo={0.92}>
      <Glass interactive tint={tint} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </Glass>
    </PressableScale>
  );
}

/** แถบปุ่มล่างลอยแบบกระจก */
/**
 * แถบปุ่มลอยด้านล่าง (Design system: Floating action bar) — ใช้กับปุ่มหลักของทุกหน้าที่ต้องบันทึก/ดำเนินการ
 * Liquid Glass ใสทรงแคปซูล + เงา e3 ลอยเหนือขอบล่าง เนื้อหาเลื่อนผ่านใต้แถบได้ (เผื่อ paddingBottom ~130 ให้ ScrollView)
 */
export function GlassDock({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 8 }} pointerEvents="box-none">
      {/* ขอบนอกเป็น Liquid Glass ใส (ไม่ทาสีขาวทับ) ให้เห็นเนื้อหาด้านหลังแบบกระจกจริง */}
      <Glass interactive tint="rgba(255,255,255,0.12)" style={[styles.dock, elevation.e3, style]}>{children}</Glass>
    </View>
  );
}

/* ───────────── Surfaces ───────────── */
type Tone = 'white' | 'clay' | 'cyan' | 'lime' | 'lavender' | 'peach' | 'blue' | 'dark';
const toneBg: Record<Tone, string> = {
  white: palette.surface,
  clay: palette.clay,
  cyan: palette.cyan,
  lime: palette.lime,
  lavender: palette.lavender,
  peach: palette.peach,
  blue: palette.primary,
  dark: palette.black,
};
export function Card({ children, style, onPress, tone = 'white' }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; tone?: Tone }) {
  const inner = (
    <View style={[styles.card, { backgroundColor: toneBg[tone] }, tone === 'clay' ? [clayCard, elevation.e1] : tone === 'white' ? elevation.e1 : null, style]}>{children}</View>
  );
  if (!onPress) return inner;
  return (
    <PressableScale onPress={onPress} scaleTo={0.975}>
      {inner}
    </PressableScale>
  );
}

/* ───────────── Buttons ───────────── */
export function Button({
  label,
  icon,
  onPress,
  kind = 'primary',
  style,
  disabled,
}: {
  label: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  kind?: 'primary' | 'secondary' | 'dark' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const map = {
    primary: { bg: palette.primary, fg: palette.white },
    secondary: { bg: palette.surface, fg: palette.primary },
    dark: { bg: palette.black, fg: palette.white },
    ghost: { bg: 'transparent', fg: palette.primary },
    danger: { bg: palette.coralSoft, fg: palette.coral },
  }[kind];
  return (
    <PressableScale
      haptic="press"
      onPress={disabled ? undefined : onPress}
      style={[styles.btn, { backgroundColor: map.bg, opacity: disabled ? 0.45 : 1 }, kind === 'primary' && !disabled && elevation.glow, kind === 'secondary' && elevation.e1, style]}
    >
      {icon}
      <T v="bodyStrong" color={map.fg}>
        {label}
      </T>
    </PressableScale>
  );
}

/** ปุ่มกลมน้ำเงิน + glow (FAB / ปุ่มบวก) */
export function RoundButton({ children, onPress, size = control.fab, color = palette.primary, label }: { children: React.ReactNode; onPress?: () => void; size?: number; color?: string; label: string }) {
  return (
    <PressableScale haptic="press" scaleTo={0.9} onPress={onPress} accessibilityLabel={label} style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }, color === palette.primary && elevation.glow]}>
      {children}
    </PressableScale>
  );
}

/* ───────────── Pills / chips ───────────── */
export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <PressableScale haptic="select" hitSlop={control.hitSlop} onPress={onPress} style={[styles.chip, active ? [{ backgroundColor: palette.primary }, elevation.glow] : null]} accessibilityState={{ selected: active }}>
      <T v="callout" color={active ? palette.white : palette.inkSoft}>
        {label}
      </T>
    </PressableScale>
  );
}

/** สวิตช์สองฝั่งแบบ ref (พื้นขาว ปุ่มดำ) */
export function Segmented<K extends string>({ items, value, onChange }: { items: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <Glass interactive style={styles.seg}>
      {items.map((it) => (
        <PressableScale key={it.key} haptic="select" hitSlop={control.hitSlop} onPress={() => onChange(it.key)} style={[styles.segItem, value === it.key && { backgroundColor: palette.black }]}>
          <T v="callout" color={value === it.key ? palette.white : palette.inkSoft}>
            {it.label}
          </T>
        </PressableScale>
      ))}
    </Glass>
  );
}

export function Badge({ label, fg = palette.white, bg = palette.black }: { label: string; fg?: string; bg?: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <T v="micro" color={fg}>
        {label}
      </T>
    </View>
  );
}

/** ไอคอน duotone: เส้นสี + พื้นสีอ่อน (แบบไอคอนสีใน ref) */
export function DuoIcon({ Icon, color, size = 26 }: { Icon: any; color: string; size?: number }) {
  return <Icon size={size} color={color} fill={`${color}2E`} strokeWidth={2} />;
}

/** ไอคอนสีในวงกลมขาวลอย (แบบไทล์ใน ref) */
export function IconBubble({ children, size = 64, bg = palette.surface, style }: { children: React.ReactNode; size?: number; bg?: string; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, elevation.e1, style]}>{children}</View>;
}

/** ไอคอนในสี่เหลี่ยมมนขาว (แบบการ์ดพาสเทลใน ref) */
export function IconTile({ children, size = 64 }: { children: React.ReactNode; size?: number }) {
  // ไอคอนบนการ์ดขาว → พื้นเขียวอ่อน (Design system: icon tile)
  return <View style={{ width: size, height: size, borderRadius: 18, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' }}>{children}</View>;
}

/* ───────────── Avatar (ตัวอักษร + จุดออนไลน์) ───────────── */
const AV = [palette.cyan, palette.lavender, palette.peach, palette.lime, palette.pink, palette.primarySoft];
export function Avatar({ name, src, size = 60, online, ring }: { name: string; src?: number; size?: number; online?: boolean; ring?: boolean }) {
  const clean = name.replace(/^(นางสาว|นาง|นาย|แม่|ลุง|น้อง|ตา|ป้า|พ่อหมอ|ยาย|พ่อ)/, '');
  const code = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <View style={{ width: size, height: size }}>
      <View style={[{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: AV[code % AV.length], alignItems: 'center', justifyContent: 'center' }, ring && { borderWidth: 3, borderColor: palette.surface }]}>
        {src ? (
          <Image source={src} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <T v="title" style={{ fontSize: size * 0.34, lineHeight: size * 0.5 }}>{clean.slice(0, 1)}</T>
        )}
      </View>
      {online ? <View style={[styles.online, { width: size * 0.24, height: size * 0.24, borderRadius: size }]} /> : null}
    </View>
  );
}

/* ───────────── Search bar (ขาว มุมโค้ง แบบ ref) ───────────── */
export function SearchBar({ style, right, ...props }: TextInputProps & { right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.search, style]}>
      <Search size={17} color={palette.inkMute} />
      <TextInput placeholderTextColor={palette.inkMute} returnKeyType="search" {...props} style={{ flex: 1, fontSize: 17, color: palette.ink }} />
      {right}
    </View>
  );
}

/* ───────────── Header หน้ารายละเอียด: ปุ่มกลมซ้าย หัวเรื่องกลาง ───────────── */
export function ScreenHeader({ title, right, onBack, dark }: { title: string; right?: React.ReactNode; onBack?: () => void; dark?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
      <GlassCircle label="ย้อนกลับ" onPress={onBack ?? (() => router.back())}>
        <ChevronLeft size={20} color={dark ? palette.white : palette.ink} strokeWidth={2.4} />
      </GlassCircle>
      <T v="title" color={dark ? palette.white : palette.ink} numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
        {title}
      </T>
      <View style={{ width: 56, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <T v="h2">{title}</T>
      {action ? (
        <PressableScale onPress={onAction} style={{ paddingVertical: 8, paddingLeft: 12 }}>
          <T v="callout" color={palette.primary}>
            {action}
          </T>
        </PressableScale>
      ) : null}
    </View>
  );
}

/* ───────────── Progress ring ───────────── */
const ACircle = Animated.createAnimatedComponent(Circle);
export function ProgressRing({ progress, size = 112, stroke = 12, children, track = palette.primarySoft, color = palette.primary }: { progress: number; size?: number; stroke?: number; children?: React.ReactNode; track?: string; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(progress, { duration: 1400, easing: Easing.out(Easing.cubic) });
  }, [progress, p]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <ACircle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} strokeLinecap="round" fill="none" strokeDasharray={`${c} ${c}`} animatedProps={props} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      {children}
    </View>
  );
}

/* ───────────── Brand mark ───────────── */
export function Logo({ size = 44, light }: { size?: number; light?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M24 4C13 14 10 26 24 44C38 26 35 14 24 4Z" fill={light ? palette.white : palette.primary} />
      <Path d="M24 12V40M24 22L17 16M24 28L31 22M24 34L18 29" stroke={light ? palette.primary : palette.white} strokeWidth={2.4} strokeLinecap="round" />
      <Circle cx="36" cy="10" r="4" fill={palette.orange} />
    </Svg>
  );
}

/* ───────────── แถบจางใต้ status bar ───────────── */
export function TopScrim({ height }: { height: number }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(247,251,249,1)', 'rgba(247,251,249,0.9)', 'rgba(247,251,249,0)']} // สีเดียวกับ palette.bg
      locations={[0, 0.6, 1]}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: height + 18 }}
    />
  );
}

/** ลายเส้นทแยง (ช่อง "ไม่มีนัด" แบบ ref) */
export function Hatch({ height = 80, label }: { height?: number; label: string }) {
  return (
    <View style={{ height, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: palette.clay }}>
      <Svg width="100%" height={height} style={StyleSheet.absoluteFill}>
        {Array.from({ length: 60 }).map((_, i) => (
          <Path key={i} d={`M${i * 12 - height} ${height} L${i * 12} 0`} stroke="rgba(27,37,65,0.07)" strokeWidth={3} />
        ))}
      </Svg>
      <T v="callout" color={palette.inkMute}>
        {label}
      </T>
    </View>
  );
}

export const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space.lg },
  dock: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 32, borderCurve: 'continuous', padding: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.9)' },
  btn: { height: control.button, borderRadius: radius.pill, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs },
  chip: { height: control.buttonSmall, paddingHorizontal: 14, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  seg: { flexDirection: 'row', borderRadius: radius.pill, padding: 5, alignSelf: 'center' },
  segItem: { height: control.buttonSmall, paddingHorizontal: 16, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  online: { position: 'absolute', top: 1, right: 1, backgroundColor: palette.online, borderWidth: 2.5, borderColor: palette.surface },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: palette.mint, borderRadius: radius.pill, paddingHorizontal: 14, height: control.field },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm },
  circleBtn: { width: control.icon, height: control.icon, borderRadius: control.icon / 2, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xxl, marginBottom: space.sm },
});

/**
 * ปุ่มบนแถบหัวจอ native (iOS 26 ห่อด้วยวงกลมกระจก 44pt ให้เอง)
 * ไอคอน 20pt กึ่งกลางกรอบ 36pt ตาม HIG
 */
export function HeaderButton({ children, onPress, label }: { children: React.ReactNode; onPress?: () => void; label: string }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} haptic="select" style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </PressableScale>
  );
}

/** ปุ่มย้อนกลับมาตรฐาน — ย้อนกลับได้ก็กลับ ไม่ได้ก็ไปหน้าที่กำหนด */
export function HeaderBack({ fallback = '/home', color = palette.ink }: { fallback?: string; color?: string }) {
  return (
    <HeaderButton label="ย้อนกลับ" onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as any))}>
      <ChevronLeft size={20} color={color} strokeWidth={2.4} />
    </HeaderButton>
  );
}
