import { Image } from 'expo-image';
import { Stack, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { VerifyPrompt } from '../../../components/PractitionerGate';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { AppIcon, Group, IOSCard, Row, SectionTitle, Sym, ios } from '../../../components/ios';
import { AISphere } from '../../../components/AISphere';
import { Avatar, HeaderButton, PressableScale, T } from '../../../components/ui';
import { noticesFrom } from '../../../lib/notices';
import { TODAY, avatarFor, doctor, lastVisit, thaiDate } from '../../../data/mock';
import { visitSortKey } from '../../../data/tones';
import { useApp } from '../../../store/app';
import { palette } from '../../../theme';

const enter = (i: number) => FadeInDown.delay(30 + i * 50).duration(420);

/** เครื่องมือ — ไอคอนสี่เหลี่ยมมนสีทึบแบบแอป Apple */
const TOOLS = [
  { title: 'เล่าอาการ', sub: 'AI ช่วยบันทึก', sym: 'waveform', bg: palette.primary, go: () => router.push({ pathname: '/capture', params: { mode: 'patient' } }) },
  { title: 'สแกนตำรา', sub: 'สมุดข่อย ใบลาน', sym: 'doc.text.viewfinder', bg: '#D9921A', go: () => router.push('/scan') },
  { title: 'ถ่ายทอดตำรับ', sub: 'เก็บให้ลูกหลาน', sym: 'book.closed.fill', bg: '#C2564B', go: () => router.push('/wisdom/new') },
  { title: 'สมุนไพร', sub: '12 ชนิด', sym: 'leaf.fill', bg: '#4E9A3E', go: () => router.push('/herbs') },
] as const;

/** กระดิ่งแจ้งเตือน: มีที่ยังไม่อ่าน → สั่นทุกครั้งที่เข้าหน้า (แกว่งจากจุดแขวนด้านบน) */
function Bell({ unread, shake }: { unread: number; shake: number }) {
  const r = useSharedValue(0);
  useEffect(() => {
    if (!unread) return;
    r.value = withDelay(
      450,
      withSequence(
        withTiming(16, { duration: 70 }), withTiming(-14, { duration: 90 }), withTiming(12, { duration: 90 }),
        withTiming(-10, { duration: 90 }), withTiming(7, { duration: 90 }), withTiming(-4, { duration: 90 }), withTiming(0, { duration: 110 }),
      ),
    );
  }, [shake, unread, r]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: -9 }, { rotate: `${r.value}deg` }, { translateY: 9 }] }));
  return (
    <Animated.View style={st}>
      <Image source={require('../../../../assets/icons/bell.png')} style={{ width: 22, height: 22 }} tintColor={palette.ink} />
    </Animated.View>
  );
}

export default function Home() {
  const { patients, settings, isPractitioner, profile, wisdoms: allW } = useApp();
  const wisdoms = allW; // นับรวมตำราอ้างอิงในระบบ
  // ผู้ป่วยที่มารักษาล่าสุด 3 ราย (หมอพื้นบ้านไม่ใช้ระบบนัด)
  const recent = [...patients].sort((a, b) => visitSortKey(lastVisit(b)?.date) - visitSortKey(lastVisit(a)?.date)).slice(0, 3);
  const name = settings.username && settings.username !== 'somchai' ? settings.username : doctor.short;
  const notices = noticesFrom(patients, wisdoms, isPractitioner);
  const pendingW = wisdoms.filter((w) => !w.verified).length;
  const unread = notices.filter((n) => !settings.readNotices?.includes(n.id)).length;
  // เข้าหน้านี้ทุกครั้ง → นับรอบ (ให้กระดิ่งสั่นเมื่อมีที่ยังไม่อ่าน)
  const [visit, setVisit] = useState(0);
  useFocusEffect(useCallback(() => setVisit((v) => v + 1), []));
  const me = profile?.first_name || profile?.display_name?.split(' ')[0] || name;

  return (
    <>
      <Stack.Screen
        options={{
          // ซ้าย: โปรไฟล์ (รูป + ชื่อ) · ขวา: แจ้งเตือน
          headerLeft: () => (
            <PressableScale onPress={() => router.push('/settings')} accessibilityLabel={`บัญชีและตั้งค่า ${me}`} hitSlop={6} style={styles.me}>
              <Avatar name={me} size={32} />
              <T v="subhead" color={palette.ink} numberOfLines={1} style={{ maxWidth: 140, fontWeight: '600' }}>{me}</T>
            </PressableScale>
          ),
          headerRight: () => (
            <HeaderButton label={`แจ้งเตือน ยังไม่อ่าน ${unread} รายการ`} onPress={() => router.push('/notifications')}>
              <Bell unread={unread} shake={visit} />
              {unread ? <View style={styles.dot} /> : null}
            </HeaderButton>
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <Animated.View entering={enter(0)}>
          <T v="callout" color={ios.secondary} style={{ paddingHorizontal: 4 }}>
            {thaiDate(TODAY)} · สวัสดีครับ {name}
          </T>
        </Animated.View>

        {/* ครูปัญญา — การ์ดแนะนำแบบ Siri Suggestions */}
        <Animated.View entering={enter(1)} style={{ marginTop: 14 }}>
          <IOSCard onPress={() => router.push('/assistant')} style={styles.ai}>
            <View style={styles.orb}>
              <AISphere size={48} active />
            </View>
            <View style={{ flex: 1 }}>
              <T v="title">ถามครูปัญญา</T>
              <T v="subhead" color={ios.secondary}>สมุนไพร ตำรับยา หรือความปลอดภัยของยา</T>
            </View>
            <PressableScale haptic="press" onPress={() => router.push('/capture')} style={styles.mic} accessibilityLabel="พูดกับครูปัญญา">
              <Sym name="mic.fill" size={20} color="#FFFFFF" />
            </PressableScale>
          </IOSCard>
        </Animated.View>

        {/* ผู้ป่วยล่าสุด — เฉพาะหมอพื้นบ้านที่ยืนยันแล้ว */}
        {isPractitioner ? (
        <Animated.View entering={enter(2)}>
          <SectionTitle title="ผู้ป่วยล่าสุด" action="ดูทั้งหมด" onAction={() => router.push('/patients')} />
          <Group>
            {recent.map((p) => {
              const v = lastVisit(p);
              return (
                <Row
                  key={p.id}
                  leading={<Avatar name={p.name} src={avatarFor(p)} size={36} />}
                  title={p.name}
                  subtitle={v ? v.diagnosis : 'ยังไม่มีการรักษา'}
                  value={v ? v.date.slice(0, 5) : undefined}
                  onPress={() => router.push(`/patient/${p.id}`)}
                />
              );
            })}
          </Group>
        </Animated.View>
        ) : (
          <Animated.View entering={enter(2)}>
            <SectionTitle title="การรักษาผู้ป่วย" />
            <VerifyPrompt compact />
          </Animated.View>
        )}

        {/* เครื่องมือ */}
        <Animated.View entering={enter(3)}>
          <SectionTitle title="เครื่องมือ" />
          <View style={styles.grid}>
            {TOOLS.map((t) => (
              <IOSCard key={t.title} onPress={t.go} style={styles.tile} containerStyle={styles.tileWrap}>
                <AppIcon name={t.sym} bg={t.bg} size={40} />
                <View>
                  <T v="title">{t.title}</T>
                  <T v="subhead" color={ios.secondary}>{t.sub}</T>
                </View>
              </IOSCard>
            ))}
          </View>
        </Animated.View>

        {/* ภูมิปัญญา */}
        <Animated.View entering={enter(4)}>
          <SectionTitle title="ภูมิปัญญาของฉัน" />
          <IOSCard onPress={() => router.push('/vault')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <AppIcon name="books.vertical.fill" bg="#8A6A44" size={40} />
              <View style={{ flex: 1 }}>
                <T v="title">บันทึกแล้ว {wisdoms.length} เรื่อง</T>
                <T v="subhead" color={ios.secondary}>{pendingW ? `รอตรวจทาน ${pendingW} เรื่อง` : 'ตรวจทานครบทุกเรื่องแล้ว'}</T>
              </View>
              <Sym name="chevron.right" size={14} color={ios.tertiary} weight="semibold" />
            </View>
            {/* แถบ = สัดส่วนที่ตรวจทานแล้ว */}
            {wisdoms.length ? (
              <View style={styles.track}>
                <View style={[styles.fillBar, { width: `${((wisdoms.length - pendingW) / wisdoms.length) * 100}%` }]} />
              </View>
            ) : null}
          </IOSCard>
        </Animated.View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  me: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 36, paddingLeft: 2, paddingRight: 8 },
  dot: { position: 'absolute', top: 6, right: 7, width: 9, height: 9, borderRadius: 5, backgroundColor: '#E5484D', borderWidth: 1.5, borderColor: '#FFFFFF' },
  meAvatar: { width: 32, height: 32, borderRadius: 16 },
  page: { paddingHorizontal: 16, paddingBottom: 120 },
  ai: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  orb: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  mic: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tileWrap: { width: '48.3%' },
  tile: { flex: 1, gap: 14, minHeight: 124, justifyContent: 'space-between' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#D3E5DB', marginTop: 14, overflow: 'hidden' },
  fillBar: { height: 8, borderRadius: 4, backgroundColor: palette.primary },
});
