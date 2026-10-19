/**
 * กล่องแจ้งเตือนแบบ iOS 26 — API เดียวกับ Alert ของ React Native (alert / prompt)
 * iOS: ใช้ของระบบ · Android / เว็บ: วาดเองให้เหมือน (เว็บไม่มี Alert · Android เป็น Material และไม่มี prompt)
 * - แผ่นกระจก 319 มุมโค้ง 34 · หัวข้อหนาชิดซ้าย · ข้อความรองสีเทา
 * - ปุ่มแคปซูลเทาสูง 48: 1–2 ปุ่มวางแถวเดียว · 3 ปุ่มขึ้นไปเรียงลง · ปุ่มลบ = ตัวแดง
 * - ฉากหลังหรี่ · เปิดแบบสปริงขยายจาก 0.92
 */
import React, { useEffect, useState } from 'react';
import { Alert as RNAlert, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { TextInput } from '../components/AppText';
import { Glass, T } from '../components/ui';

type Btn = { text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: (value?: string) => void };
type Req = { title: string; message?: string; buttons: Btn[]; prompt?: { secure: boolean; value: string }; cancelable?: boolean };

let push: ((r: Req) => void) | null = null;
const pending: Req[] = [];
const show = (r: Req) => (push ? push(r) : pending.push(r));

export const Alert =
  Platform.OS === 'ios'
    ? RNAlert
    : {
        alert(title: string, message?: string, buttons?: Btn[], options?: { cancelable?: boolean }) {
          show({ title, message, buttons: buttons?.length ? buttons : [{ text: 'ตกลง' }], cancelable: options?.cancelable });
        },
        prompt(title: string, message?: string, cb?: ((v: string) => void) | Btn[], type?: string, defaultValue?: string) {
          const buttons: Btn[] = typeof cb === 'function' ? [{ text: 'ยกเลิก', style: 'cancel' }, { text: 'ตกลง', onPress: (v) => cb(v ?? '') }] : (cb ?? [{ text: 'ตกลง' }]);
          show({ title, message, buttons, prompt: { secure: type === 'secure-text', value: defaultValue ?? '' } });
        },
      };

/** วางไว้ครั้งเดียวที่ root (Android / เว็บ) */
export function AlertHost() {
  const [list, setList] = useState<Req[]>([]);
  const [value, setValue] = useState('');
  const { width } = useWindowDimensions();
  const p = useSharedValue(0);
  const cur = list[0] ?? null;
  useEffect(() => {
    push = (r) => setList((l) => [...l, r]);
    if (pending.length) setList(pending.splice(0));
    return () => {
      push = null;
    };
  }, []);
  // กล่องใหม่ขึ้นมา → ค่าเริ่มต้นช่องกรอก + เล่นแอนิเมชันเปิด
  useEffect(() => {
    if (!cur) return;
    setValue(cur.prompt?.value ?? '');
    p.value = 0;
    p.value = withSpring(1, { damping: 18, stiffness: 300, mass: 0.7 });
  }, [cur, p]);

  const done = (b?: Btn) => {
    p.value = withTiming(0, { duration: 150 });
    const v = value, wasPrompt = !!cur?.prompt;
    setTimeout(() => {
      setList((l) => l.slice(1));
      b?.onPress?.(wasPrompt ? v : undefined);
    }, 140);
  };
  const dimSt = useAnimatedStyle(() => ({ opacity: p.value }));
  const boxSt = useAnimatedStyle(() => ({ opacity: Math.min(1, p.value * 1.5), transform: [{ scale: 0.92 + 0.08 * p.value }] }));
  if (Platform.OS === 'ios') return null;
  const btns = cur?.buttons ?? [];
  const row = btns.length <= 2;
  const cancel = btns.find((b) => b.style === 'cancel');
  return (
    <Modal visible={!!cur} transparent animationType="none" statusBarTranslucent onRequestClose={() => (cancel || cur?.cancelable ? done(cancel) : undefined)}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.dim, dimSt]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => (cur?.cancelable ? done(cancel) : undefined)} />
      </Animated.View>
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={[styles.shadow, { width: Math.min(319, width - 40) }, boxSt]}>
          <Glass tint="rgba(250,250,250,0.9)" style={styles.box}>
            <T v="bodyStrong" style={{ fontWeight: '700' }}>{cur?.title}</T>
            {cur?.message ? <T v="subhead" color="rgba(60,60,67,0.62)" style={{ marginTop: 4 }}>{cur.message}</T> : null}
            {cur?.prompt ? (
              <TextInput
                value={value}
                onChangeText={setValue}
                secureTextEntry={cur.prompt.secure}
                autoFocus
                style={styles.input}
                placeholderTextColor="rgba(60,60,67,0.36)"
                onSubmitEditing={() => done(btns.find((b) => b.style !== 'cancel'))}
              />
            ) : null}
            <View style={[styles.btns, row ? { flexDirection: 'row' } : { flexDirection: 'column' }]}>
              {btns.map((b, i) => (
                <Pressable key={i} onPress={() => done(b)} style={({ pressed }) => [styles.btn, row && { flex: 1 }, pressed && { backgroundColor: 'rgba(120,120,128,0.28)' }]} accessibilityRole="button" accessibilityLabel={b.text}>
                  <T v="bodyStrong" color={b.style === 'destructive' ? '#E5484D' : '#111813'} numberOfLines={1} style={{ fontWeight: b.style === 'cancel' ? '600' : '700' }}>{b.text ?? 'ตกลง'}</T>
                </Pressable>
              ))}
            </View>
          </Glass>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: 'rgba(0,0,0,0.22)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  shadow: { borderRadius: 34, boxShadow: '0px 24px 60px rgba(0,0,0,0.22)' },
  box: { borderRadius: 34, paddingTop: 26, paddingHorizontal: 30, paddingBottom: 15 },
  input: { marginTop: 14, height: 44, borderRadius: 12, paddingHorizontal: 12, fontSize: 17, color: '#111813', backgroundColor: 'rgba(120,120,128,0.12)' },
  btns: { gap: 8, marginTop: 24, marginHorizontal: -15 },
  btn: { height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, backgroundColor: 'rgba(120,120,128,0.16)' },
});
