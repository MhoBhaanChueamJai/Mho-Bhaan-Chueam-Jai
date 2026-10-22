/**
 * เลือกบทบาทผู้ใช้ — ปรับคำเรียก ขอบเขตคำแนะนำของครูปัญญา และตำแหน่งในเอกสารพิมพ์
 * ไม่มีการยืนยันตัวตน เปลี่ยนได้ทุกเมื่อในตั้งค่า
 * ตอนนี้ (ROLE_PICKER ปิด) ใช้ 2 แบบ: ประชาชนทั่วไป / หมอ-บุคลากรสุขภาพ — กำหนดว่าเห็นเมนูผู้ป่วยไหม
 * mode=onboard : ขั้นแรกหลังเข้าสู่ระบบ (ไม่มีปุ่มย้อนกลับ) → ตั้ง PIN (next=pin) หรือหน้าหลัก · เคยเลือกแล้วข้ามไปเลย
 * mode=demo    : ปุ่ม "ทดลองใช้" หน้าเข้าสู่ระบบ — เลือกแบบไหน เข้าบัญชีทดลองของแบบนั้น (แพทย์ = พ่อหมอสมบัติ · ประชาชน = สมศรี) ไม่ต้องสมัคร
 */
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { CircleIcon, PAGE_PAD } from '../components/ListRow';
import { Sym, ios } from '../components/ios';
import { PressableScale, T, useHaptic } from '../components/ui';
import { column } from '../components/layout';
import { saveUserRole } from '../lib/account';
import { Alert } from '../lib/alert';
import { DEMO_ACCOUNTS, supabase, usernameToEmail } from '../lib/supabase';
import { KINDS, ROLE_PICKER, ROLES, type UserKind, type UserRole } from '../lib/roles';
import { useApp } from '../store/app';
import { elevation, palette } from '../theme';

export default function RolePicker() {
  const { settings, update, demo, reloadCloud, setUnlocked } = useApp();
  const h = useHaptic();
  const { mode, next } = useLocalSearchParams<{ mode?: 'onboard' | 'demo'; next?: 'pin' | 'home' }>();
  const onboard = mode === 'onboard';
  const tryDemo = mode === 'demo';
  const [signing, setSigning] = useState<UserKind | null>(null);
  const proceed = () => {
    if (!onboard) return router.canGoBack() ? router.back() : router.replace('/home');
    if (next === 'pin') router.replace({ pathname: '/pin-setup', params: { mode: 'onboard' } });
    else router.replace('/home');
  };
  // หลังเข้าสู่ระบบ: เคยเลือกบทบาทแล้ว (ในเครื่อง/บนคลาวด์) → ไปขั้นถัดไปเลย
  useEffect(() => {
    if (onboard && (ROLE_PICKER ? settings.userRole : settings.userKind)) proceed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** ทดลองใช้: เข้าบัญชีทดลองของแบบที่เลือก → ตั้ง PIN (ยังไม่เคยตั้ง) หรือหน้าหลัก */
  const signInDemo = async (k: UserKind) => {
    const acct = DEMO_ACCOUNTS.find((d) => d.kind === k);
    if (!acct || signing) return;
    setSigning(k);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(acct.username), password: acct.password });
      if (error) throw error;
      const md = data.user?.user_metadata ?? {};
      update({ userKind: k });
      await reloadCloud();
      h.success();
      update({ loggedIn: true, username: md.first_name ? `${md.first_name} ${md.last_name ?? ''}`.trim() : acct.username, userKind: k });
      setUnlocked(true);
      if (!settings.pinEnabled && !settings.faceIdEnabled) router.replace({ pathname: '/pin-setup', params: { mode: 'onboard' } });
      else router.replace('/home');
    } catch {
      setSigning(null);
      h.warn();
      Alert.alert('เข้าโหมดทดลองไม่สำเร็จ', 'ตรวจสอบอินเทอร์เน็ต แล้วลองใหม่อีกครั้ง');
    }
  };
  const pick = (k: UserRole | UserKind) => {
    if (tryDemo) return signInDemo(k as UserKind);
    h.success();
    update(ROLE_PICKER ? { userRole: k as UserRole } : { userKind: k as UserKind });
    if (!demo) saveUserRole(k).catch(() => {});
    proceed();
  };
  const list = ROLE_PICKER ? ROLES : KINDS;
  const current = ROLE_PICKER ? settings.userRole : settings.userKind;
  return (
    <>
      <Stack.Screen options={tryDemo ? { title: 'ทดลองใช้งาน' } : onboard ? { title: ROLE_PICKER ? 'คุณใช้แอปในบทบาทไหน' : 'คุณใช้แอปแบบไหน', headerBackVisible: false, headerLeft: () => null, gestureEnabled: false } : { title: ROLE_PICKER ? 'บทบาทของคุณ' : 'การใช้งาน' }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={[styles.page, column.read]}>
        <T v="callout" color={ios.secondary} style={{ marginBottom: 18, paddingHorizontal: 4 }}>
          {tryDemo ? 'เลือกแบบที่อยากลองใช้ ไม่ต้องสมัคร · ข้อมูลที่ทดลองเก็บในเครื่องนี้เท่านั้น' : ROLE_PICKER ? (onboard ? 'เลือกบทบาทเพื่อให้ครูปัญญาแนะนำได้เหมาะกับคุณ · เปลี่ยนได้ทุกเมื่อในตั้งค่า' : 'ครูปัญญาจะปรับคำแนะนำให้เหมาะกับบทบาทของคุณ · เปลี่ยนได้ทุกเมื่อในตั้งค่า') : 'หมอและบุคลากรสุขภาพจะมีเมนูผู้ป่วย บันทึกการรักษา และนัดหมายเพิ่ม · เปลี่ยนได้ทุกเมื่อในตั้งค่า'}
        </T>
        {list.map((r, i) => {
          const on = !tryDemo && current === r.k;
          return (
            <Animated.View key={r.k} entering={FadeInDown.delay(40 + i * 50).duration(320)}>
              <PressableScale haptic="none" scaleTo={0.98} onPress={() => pick(r.k)} style={[styles.card, elevation.e1, on && { borderColor: r.color }]} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${r.label} ${r.desc}`}>
                <CircleIcon name={r.icon} color={r.color} size={48} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="title">{r.label}</T>
                  <T v="subhead" color={ios.secondary}>{r.desc}</T>
                </View>
                {signing === r.k ? <ActivityIndicator color={r.color} /> : tryDemo ? <Sym name="chevron.right" size={16} color={ios.tertiary} weight="semibold" /> : on ? <Sym name="checkmark.circle.fill" size={24} color={r.color} /> : <View style={styles.ring} />}
              </PressableScale>
            </Animated.View>
          );
        })}
        {ROLE_PICKER ? (
          <T v="caption" color={ios.tertiary} style={{ marginTop: 8, paddingHorizontal: 4 }}>
            ประชาชนทั่วไป: ครูปัญญาแนะนำเฉพาะการดูแลตัวเองเบื้องต้น สมุนไพร และยาสามัญประจำบ้าน พร้อมบอกเมื่อควรไปพบแพทย์
          </T>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: PAGE_PAD, paddingTop: 8, paddingBottom: 60 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 84, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 22, borderCurve: 'continuous', backgroundColor: palette.surface, marginBottom: 12, borderWidth: 2, borderColor: 'transparent' },
  ring: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: ios.separator },
});
