import { Image } from 'expo-image';
import { Stack, router } from 'expo-router';
import React from 'react';
import { VerifyPrompt } from '../../../components/PractitionerGate';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppIcon, Group, IOSCard, Row, SectionTitle, Sym, ios } from '../../../components/ios';
import { AIFlower } from '../../../components/Orb';
import { Avatar, PressableScale, T } from '../../../components/ui';
import { TODAY, avatars, dayKey, doctor, legacy, nowHM, thaiDate } from '../../../data/mock';
import { useApp } from '../../../store/app';
import { palette } from '../../../theme';

const enter = (i: number) => FadeInDown.delay(30 + i * 50).springify().damping(20);

/** เครื่องมือ — ไอคอนสี่เหลี่ยมมนสีทึบแบบแอป Apple */
const TOOLS = [
  { title: 'เล่าอาการ', sub: 'AI กรอก ม.บ.5', sym: 'waveform', bg: palette.primary, go: () => router.push({ pathname: '/capture', params: { mode: 'patient' } }) },
  { title: 'สแกนตำรา', sub: 'สมุดข่อย ใบลาน', sym: 'doc.text.viewfinder', bg: '#D9921A', go: () => router.push('/scan') },
  { title: 'ถ่ายทอดตำรับ', sub: 'เก็บให้ลูกหลาน', sym: 'book.closed.fill', bg: '#C2564B', go: () => router.push({ pathname: '/capture', params: { mode: 'wisdom' } }) },
  { title: 'สมุนไพร', sub: '12 ชนิด', sym: 'leaf.fill', bg: '#4E9A3E', go: () => router.push('/herbs') },
] as const;

export default function Home() {
  const { patients, agenda, settings, isPractitioner } = useApp();
  // นัดของวันนี้จากฐานข้อมูล — นัดที่เลยเวลาจบแล้วนับว่า "ดูแลแล้ว"
  const today = [...(agenda[dayKey(TODAY)] ?? [])].sort((a, b) => a.start.localeCompare(b.start));
  const now = nowHM();
  const isDone = (end: string) => !!end && end <= now;
  const done = today.filter((a) => isDone(a.end)).length;
  const name = settings.username && settings.username !== 'somchai' ? settings.username : doctor.short;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <PressableScale onPress={() => router.push('/settings')} accessibilityLabel="บัญชีและตั้งค่า" hitSlop={8} style={{ width: 36, height: 36 }}>
              <Image source={avatars.doctor} style={{ width: 36, height: 36, borderRadius: 18 }} />
            </PressableScale>
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
              <AIFlower size={48} active />
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

        {/* ผู้ป่วยวันนี้ — เฉพาะหมอพื้นบ้านที่ยืนยันแล้ว */}
        {isPractitioner ? (
        <Animated.View entering={enter(2)}>
          <SectionTitle title="ผู้ป่วยวันนี้" action="ดูทั้งหมด" onAction={() => router.push('/patients')} />
          <Group>
            <View style={styles.progressRow}>
              <View style={{ flex: 1 }}>
                <T v="h1">
                  {done}
                  <T v="title" color={ios.secondary}> / {today.length} ราย</T>
                </T>
                <T v="caption" color={ios.secondary}>{today.length ? 'ดูแลแล้ววันนี้' : 'วันนี้ไม่มีนัด'}</T>
              </View>
              <View style={styles.bars}>
                {today.map((a) => (
                  <View key={a.start + a.pid} style={[styles.bar, { backgroundColor: isDone(a.end) ? palette.primary : '#D3E5DB' }]} />
                ))}
              </View>
            </View>
            {today.map((a) => {
              const p = patients.find((x) => x.id === a.pid);
              if (!p) return null;
              return (
                <Row
                  key={a.start + a.pid}
                  leading={<Avatar name={p.name} src={avatars[p.id]} size={36} />}
                  title={p.name}
                  subtitle={isDone(a.end) ? `✓ ${a.what}` : a.what}
                  value={a.start}
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
                <T v="title">บันทึกแล้ว {legacy.recorded} จาก {legacy.goal} เรื่อง</T>
                <T v="subhead" color={ios.secondary}>เสียงเล่ารวม {legacy.minutes} นาที · ศิษย์ {legacy.apprentices} คน</T>
              </View>
              <Sym name="chevron.right" size={14} color={ios.tertiary} weight="semibold" />
            </View>
            <View style={styles.track}>
              <View style={[styles.fillBar, { width: `${(legacy.recorded / legacy.goal) * 100}%` }]} />
            </View>
          </IOSCard>
        </Animated.View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingBottom: 120 },
  ai: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  orb: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  mic: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  progressRow: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 12 },
  bars: { flexDirection: 'row', gap: 6 },
  bar: { width: 10, height: 34, borderRadius: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tileWrap: { width: '48.3%' },
  tile: { flex: 1, gap: 14, minHeight: 124, justifyContent: 'space-between' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#D3E5DB', marginTop: 14, overflow: 'hidden' },
  fillBar: { height: 8, borderRadius: 4, backgroundColor: palette.primary },
});
