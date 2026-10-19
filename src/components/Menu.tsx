/**
 * เมนูแบบ iOS 26 (UIMenu) สำหรับ Android / เว็บ — API เดียวกับ MenuView ของ @react-native-menu/menu
 * (iOS ใช้เมนู native: ดู Menu.ios.tsx)
 * - แผ่นกระจกฝ้ากว้าง 248 มุมโค้ง 34 ไม่มีพื้นหลังทึบ · เปิดทับตำแหน่งปุ่ม แล้วขยายออกจากมุมปุ่มแบบสปริง
 * - หัวเมนูตัวเล็กสีเทา · แถวสูง 42: ไอคอนซ้าย + ข้อความ 17pt · รายการลบเป็นสีแดง · state "on" = เครื่องหมายถูก
 * - กดค้าง (shouldOpenOnLongPress): ฉากหลังเบลอและเมนูอยู่ใต้รายการ แบบ context menu ของ iOS
 */
import { BlurView } from 'expo-blur';
import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Sym } from './ios';
import { measureOnScreen } from '../lib/measure';
import { Glass, T, useHaptic } from './ui';

type Action = { id?: string; title: string; image?: string; imageColor?: string; state?: 'on' | 'off' | 'mixed'; attributes?: { destructive?: boolean; disabled?: boolean; hidden?: boolean } };
type Props = {
  actions: Action[];
  title?: string;
  onPressAction?: (e: { nativeEvent: { event: string } }) => void;
  shouldOpenOnLongPress?: boolean;
  themeVariant?: 'light' | 'dark';
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};
const W = 248, ROW = 42, RED = '#E5484D';
const childLabel = (c: React.ReactNode): string | undefined => (React.isValidElement(c) ? (c.props as { accessibilityLabel?: string }).accessibilityLabel : undefined);

export function MenuView({ actions, title, onPressAction, shouldOpenOnLongPress, themeVariant = 'light', style, children }: Props) {
  const ref = useRef<View>(null);
  const { width: SW, height: SH } = useWindowDimensions();
  const h = useHaptic();
  const [open, setOpen] = useState<null | { x: number; y: number; w: number; h: number }>(null);
  const p = useSharedValue(0);
  const dark = themeVariant === 'dark';
  const list = actions.filter((a) => !a.attributes?.hidden);
  const hasLead = list.some((a) => a.image || a.state);

  const show = () => {
    measureOnScreen(ref.current, (r) => {
      h.select();
      setOpen(r);
      p.value = 0;
      p.value = withSpring(1, { damping: 19, stiffness: 260, mass: 0.7 });
    });
  };
  const close = (then?: () => void) => {
    p.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) });
    setTimeout(() => {
      setOpen(null);
      then?.();
    }, 150);
  };

  // ตำแหน่ง: ชิดขวาของปุ่ม (ห่างขอบจอ ≥ 9) · ปุ่ม = ทับตำแหน่งปุ่ม · กดค้าง = ใต้รายการ · ล้นจอล่าง → ขึ้นด้านบน
  const menuH = (title ? 36 : 10) + list.length * ROW + 10;
  let left = 0, top = 0, originX = 'right', originY = 'top';
  if (open) {
    const rightEdge = Math.min(SW - 9, open.x + open.w + (shouldOpenOnLongPress ? 0 : 9));
    left = Math.max(9, rightEdge - W);
    if (open.x + open.w / 2 < SW / 2 && !shouldOpenOnLongPress) {
      left = Math.max(9, open.x - 9);
      originX = 'left';
    }
    top = shouldOpenOnLongPress ? open.y + open.h + 8 : open.y - 1;
    if (top + menuH > SH - 24) {
      top = Math.max(24, (shouldOpenOnLongPress ? open.y - 8 : open.y + open.h) - menuH);
      originY = 'bottom';
    }
  }
  const panelSt = useAnimatedStyle(() => ({ opacity: Math.min(1, p.value * 1.6), transform: [{ scale: 0.35 + 0.65 * p.value }] }));
  const dimSt = useAnimatedStyle(() => ({ opacity: p.value }));

  return (
    <>
      <Pressable
        ref={ref}
        collapsable={false}
        style={style}
        onPress={shouldOpenOnLongPress ? undefined : show}
        onLongPress={shouldOpenOnLongPress ? show : undefined}
        delayLongPress={380}
        // ปุ่มเปิดเมนู: ใช้ชื่อปุ่มของลูก (ลูกปิดการแตะไว้ จึงต้องยกชื่อขึ้นมาให้โปรแกรมอ่านจอ)
        accessible={!shouldOpenOnLongPress}
        accessibilityRole={shouldOpenOnLongPress ? undefined : 'button'}
        accessibilityLabel={shouldOpenOnLongPress ? undefined : childLabel(children)}
      >
        {shouldOpenOnLongPress ? <View pointerEvents="box-none">{children}</View> : <View pointerEvents="none">{children}</View>}
      </Pressable>
      <Modal visible={!!open} transparent animationType="none" statusBarTranslucent onRequestClose={() => close()}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close()}>
          {shouldOpenOnLongPress ? (
            <Animated.View style={[StyleSheet.absoluteFill, dimSt]}>
              <BlurView intensity={30} tint={dark ? 'dark' : 'light'} experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.12)' }]} />
            </Animated.View>
          ) : null}
        </Pressable>
        {open ? (
          <Animated.View style={[styles.shadow, { left, top, width: W, transformOrigin: `${originX} ${originY}` }, panelSt]}>
            <Glass tint={dark ? 'rgba(44,46,45,0.86)' : 'rgba(250,252,251,0.84)'} style={styles.panel}>
              {title ? (
                <T v="caption" color={dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)'} style={styles.title} numberOfLines={1}>{title}</T>
              ) : (
                <View style={{ height: 10 }} />
              )}
              {list.map((a, i) => {
                const red = a.attributes?.destructive;
                const color = red ? RED : dark ? '#FFFFFF' : '#111813';
                const icon = a.state === 'on' ? 'checkmark' : a.image;
                return (
                  <Pressable
                    key={a.id ?? i}
                    disabled={a.attributes?.disabled}
                    onPress={() => close(() => onPressAction?.({ nativeEvent: { event: a.id ?? String(i) } }))}
                    style={({ pressed }) => [styles.row, pressed && { backgroundColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}
                    accessibilityRole="menuitem"
                    accessibilityLabel={a.title}
                  >
                    {hasLead ? <View style={styles.lead}>{icon ? <Sym name={icon as any} size={19} color={red ? RED : a.state === 'on' ? color : (a.imageColor ?? color)} weight="medium" /> : null}</View> : null}
                    <T v="body" color={color} numberOfLines={1} style={{ flex: 1, opacity: a.attributes?.disabled ? 0.4 : 1 }}>{a.title}</T>
                  </Pressable>
                );
              })}
              <View style={{ height: 10 }} />
            </Glass>
          </Animated.View>
        ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  shadow: { position: 'absolute', borderRadius: 34, boxShadow: '0px 18px 50px rgba(0,0,0,0.18), 0px 2px 8px rgba(0,0,0,0.08)' },
  panel: { borderRadius: 34, paddingVertical: 0 },
  title: { fontWeight: '600', paddingTop: 14, paddingBottom: 6, paddingHorizontal: 22 },
  row: { height: ROW, flexDirection: 'row', alignItems: 'center', paddingLeft: 22, paddingRight: 18, gap: 10 },
  lead: { width: 26, alignItems: 'center' },
});
