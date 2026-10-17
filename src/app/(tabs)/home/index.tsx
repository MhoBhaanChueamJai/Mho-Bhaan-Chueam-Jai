import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { IOSCard, SectionTitle, Sym, ios } from '../../../components/ios';
import { AISphere } from '../../../components/AISphere';
import { Avatar, HeaderButton, PressableScale, T } from '../../../components/ui';
import { noticesFrom } from '../../../lib/notices';
import { useMyAvatar } from '../../../lib/myAvatar';
import { TODAY, avatarFor, doctor, lastVisit, thaiDate } from '../../../data/mock';
import { visitSortKey } from '../../../data/tones';
import { useApp } from '../../../store/app';
import { todayPick } from '../../../lib/herbDaily';
import { elevation, palette } from '../../../theme';

const enter = (i: number) => FadeInDown.delay(30 + i * 50).duration(420);


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
  const recent = [...patients].sort((a, b) => visitSortKey(lastVisit(b)?.date) - visitSortKey(lastVisit(a)?.date)).slice(0, 8);
  const follow = patients.filter((p) => p.status === 'ติดตามอาการ' || p.status === 'นัดวันนี้').length;
  // สมุนไพรประจำวัน (เปลี่ยนทุกวัน ตามฤดู)
  const pick = todayPick();
  const name = settings.username && settings.username !== 'somchai' ? settings.username : doctor.short;
  const notices = noticesFrom(patients, wisdoms, isPractitioner);
  const pendingW = wisdoms.filter((w) => !w.verified).length;
  const unread = notices.filter((n) => !settings.readNotices?.includes(n.id)).length;
  // เข้าหน้านี้ทุกครั้ง → นับรอบ (ให้กระดิ่งสั่นเมื่อมีที่ยังไม่อ่าน)
  const [visit, setVisit] = useState(0);
  useFocusEffect(useCallback(() => setVisit((v) => v + 1), []));
  const myAvatar = useMyAvatar();
  const me = profile?.first_name || profile?.display_name?.split(' ')[0] || name;

  return (
    <>
      <Stack.Screen
        options={{
          // ซ้าย: โปรไฟล์ (รูป + ชื่อ) · ขวา: แจ้งเตือน
          headerLeft: () => (
            <PressableScale onPress={() => router.push('/settings')} accessibilityLabel={`บัญชีและตั้งค่า ${me}`} hitSlop={6} style={styles.me}>
              <Avatar name={me} src={myAvatar} size={32} />
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
            {thaiDate(TODAY)} · สวัสดีครับ {me}
          </T>
        </Animated.View>

        {/* ── Bento แถว 1: ครูปัญญา (ใหญ่) · ผู้ป่วย + เล่าอาการ ── */}
        <Animated.View entering={enter(1)} style={[styles.row, { height: 236, marginTop: 14 }]}>
          <Tile onPress={() => router.push('/assistant')} style={{ flex: 1.15 }} label="ถามครูปัญญา">
            <LinearGradient colors={['#0F2A1F', '#0A1913', '#050B08']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={styles.kruOrb} pointerEvents="none">
              <AISphere size={96} active />
            </View>
            <View style={styles.tileBottom}>
              <T v="micro" color="rgba(124,240,168,0.85)" style={styles.kicker}>ผู้ช่วย AI</T>
              <T v="h3" color="#FFFFFF">ถามครูปัญญา</T>
              <T v="caption" color="rgba(255,255,255,0.65)" numberOfLines={2}>สมุนไพร ตำรับยา ความปลอดภัยของยา</T>
              <PressableScale haptic="press" onPress={() => router.push({ pathname: '/assistant', params: { voice: '1' } })} style={styles.voiceBtn} accessibilityLabel="คุยกับครูปัญญาด้วยเสียง">
                <Sym name="waveform" size={15} color="#04150E" />
                <T v="subhead" color="#04150E" style={{ fontWeight: '700' }}>คุยด้วยเสียง</T>
              </PressableScale>
            </View>
          </Tile>
          <View style={{ flex: 1, gap: 10 }}>
            {isPractitioner ? (
              <Widget onPress={() => router.push('/patients')} icon="person.2.fill" colors={G.green} title={`ผู้ป่วย ${patients.length} ราย`} sub={follow ? `ติดตามอาการ ${follow} ราย` : 'ไม่มีรายที่ต้องติดตาม'} subColor={follow ? '#B0761E' : undefined} style={{ flex: 1 }} />
            ) : (
              <Widget onPress={() => router.push('/verify')} icon="checkmark.seal.fill" colors={G.amber} title="ยืนยันตัวตน" sub="เพื่อรักษาผู้ป่วย" style={{ flex: 1 }} />
            )}
            <Widget onPress={() => router.push('/patient/tell')} icon="waveform" colors={G.purple} title="เล่าอาการ" sub="AI ช่วยบันทึก" style={{ flex: 1 }} />
          </View>
        </Animated.View>

        {/* ── Bento แถว 2: สมุนไพรวันนี้ · สแกนตำรา ── */}
        <Animated.View entering={enter(2)} style={[styles.row, { height: 140 }]}>
          <Widget onPress={() => router.push(`/herb/${pick.herb.id}`)} icon="leaf.fill" colors={G.leaf} title={pick.herb.name} sub={`สมุนไพรวันนี้ · รส${pick.herb.taste}`} photo={pick.herb.image} style={{ flex: 1 }} />
          <Widget onPress={() => router.push('/scan')} icon="doc.viewfinder" colors={G.amber} title="สแกนตำรา" sub="สมุดข่อย ใบลาน" style={{ flex: 1 }} />
        </Animated.View>

        {/* ── Bento แถว 3: ถ่ายทอดตำรับ · ภูมิปัญญาของฉัน ── */}
        <Animated.View entering={enter(3)} style={[styles.row, { height: 140 }]}>
          <Widget onPress={() => router.push('/wisdom/tell')} icon="book.closed.fill" colors={G.red} title="ถ่ายทอดตำรับ" sub="เล่าให้ครูปัญญาฟัง" style={{ flex: 1 }} />
          <Widget onPress={() => router.push('/vault')} icon="books.vertical.fill" colors={G.brown} title={`ภูมิปัญญา ${wisdoms.length} เรื่อง`} sub={pendingW ? `รอตรวจทาน ${pendingW} เรื่อง` : 'ตรวจทานครบแล้ว'} style={{ flex: 1 }}>
            {wisdoms.length ? (
              <View style={styles.track}>
                <View style={[styles.fillBar, { width: `${((wisdoms.length - pendingW) / wisdoms.length) * 100}%` }]} />
              </View>
            ) : null}
          </Widget>
        </Animated.View>

        {/* ── ผู้ป่วยล่าสุด: การ์ดแนวนอนเลื่อนได้ ── */}
        {isPractitioner ? (
          <Animated.View entering={enter(4)}>
            <SectionTitle title="ผู้ป่วยล่าสุด" action="ดูทั้งหมด" onAction={() => router.push('/patients')} />
            {recent.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }} style={{ marginHorizontal: -16 }} contentInset={{ left: 16, right: 16 }} contentOffset={{ x: -16, y: 0 }}>
                {recent.map((p) => {
                  const v = lastVisit(p);
                  const what = v ? [v.diagnosis, v.symptoms].find((x) => x && x.trim() !== '-') ?? 'ยังไม่ได้ระบุอาการ' : 'ยังไม่มีการรักษา';
                  return (
                    <PressableScale key={p.id} haptic="select" scaleTo={0.97} onPress={() => router.push(`/patient/${p.id}`)} style={[styles.pCard, elevation.e1]} accessibilityLabel={`${p.name} ${what}`}>
                      <Avatar name={p.name} src={avatarFor(p)} size={44} />
                      <T v="bodyStrong" numberOfLines={1} style={{ marginTop: 8 }}>{p.name.replace(/^(นาย|นางสาว|นาง|เด็กชาย|เด็กหญิง)/, '')}</T>
                      <T v="caption" color={ios.secondary} numberOfLines={2}>{what}</T>
                      {v ? <T v="micro" color={ios.tertiary} style={{ marginTop: 'auto' }}>{v.date}</T> : null}
                    </PressableScale>
                  );
                })}
              </ScrollView>
            ) : (
              <IOSCard onPress={() => router.push('/patient/new')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Sym name="person.badge.plus" size={22} color={palette.primary} />
                <View style={{ flex: 1 }}>
                  <T v="bodyStrong">ยังไม่มีผู้ป่วย</T>
                  <T v="subhead" color={ios.secondary}>แตะเพื่อเพิ่มผู้ป่วยรายแรก</T>
                </View>
              </IOSCard>
            )}
          </Animated.View>
        ) : null}
      </ScrollView>
    </>
  );
}

/** สีไล่เฉดของไอคอน (สว่าง → เข้ม) */
const G = {
  green: ['#3FD089', '#14905C'],
  purple: ['#B48BF5', '#7A4FD0'],
  leaf: ['#8AD45E', '#3E8E2E'],
  amber: ['#FFC25A', '#E0861A'],
  red: ['#FF8A7A', '#D2453A'],
  brown: ['#D2A36E', '#8A5E30'],
} as const;

/** การ์ด bento พื้นฐาน (มุมโค้ง เงา กดยุบ) */
function Tile({ children, onPress, style, label }: { children: React.ReactNode; onPress: () => void; style?: any; label: string }) {
  return (
    <PressableScale haptic="select" scaleTo={0.97} onPress={onPress} style={[styles.tile, elevation.e2, style]} accessibilityLabel={label}>
      {children}
    </PressableScale>
  );
}

/** การ์ดแบบ widget iOS: พื้นขาว · ไอคอนสี่เหลี่ยมมนไล่สี (บนซ้าย) · ชื่อ + รายละเอียด (ล่าง) */
function Widget({ icon, colors, title, sub, subColor, onPress, style, photo, children }: { icon: string; colors: readonly [string, string]; title: string; sub: string; subColor?: string; onPress: () => void; style?: any; photo?: any; children?: React.ReactNode }) {
  return (
    <Tile onPress={onPress} style={[styles.widget, style]} label={`${title} ${sub}`}>
      <View style={styles.widgetTop}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.wIcon, { boxShadow: `0px 4px 10px ${colors[1]}55` }]}>
          <Sym name={icon as any} size={19} color="#FFFFFF" />
        </LinearGradient>
        {photo ? <Image source={photo} style={styles.wPhoto} contentFit="cover" /> : <Sym name="chevron.right" size={13} color={ios.tertiary} weight="semibold" />}
      </View>
      <View style={{ gap: 1 }}>
        <T v="title" numberOfLines={1}>{title}</T>
        <T v="caption" color={subColor ?? ios.secondary} numberOfLines={1}>{sub}</T>
        {children}
      </View>
    </Tile>
  );
}

const styles = StyleSheet.create({
  me: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 36, paddingLeft: 2, paddingRight: 8 },
  dot: { position: 'absolute', top: 6, right: 7, width: 9, height: 9, borderRadius: 5, backgroundColor: '#E5484D', borderWidth: 1.5, borderColor: '#FFFFFF' },
  page: { paddingHorizontal: 16, paddingBottom: 120, gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  tile: { borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: '#0A1712' },
  widget: { backgroundColor: palette.surface, padding: 14, justifyContent: 'space-between' },
  widgetTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  wIcon: { width: 40, height: 40, borderRadius: 12, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  wPhoto: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#FFFFFF' },
  kruOrb: { position: 'absolute', top: 14, right: 10 },
  kicker: { fontWeight: '700', letterSpacing: 0.5 },
  tileBottom: { position: 'absolute', left: 14, right: 14, bottom: 14, gap: 2 },
  voiceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'flex-start', height: 36, paddingHorizontal: 14, marginTop: 10, borderRadius: 18, backgroundColor: '#7CF0A8' },
  track: { height: 5, borderRadius: 3, backgroundColor: '#E3EDE7', marginTop: 8, overflow: 'hidden' },
  fillBar: { height: 5, borderRadius: 3, backgroundColor: palette.primary },
  pCard: { width: 138, height: 150, padding: 12, borderRadius: 20, borderCurve: 'continuous', backgroundColor: palette.surface },
});
