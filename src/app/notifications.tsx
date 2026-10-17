/** แจ้งเตือน — เปิดจากปุ่มกระดิ่งบนหัวจอหน้าหลัก · การ์ดแยกทีละเรื่องแบบ Notification Center ของ iOS (ปัดซ้ายเพื่อล้าง) */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { PAGE_PAD } from '../components/ListRow';
import { Sym, ios } from '../components/ios';
import { PressableScale, T, useHaptic } from '../components/ui';
import { useAnnouncements } from '../lib/announcements';
import { noticesFrom, type Notice } from '../lib/notices';
import { useApp } from '../store/app';
import { elevation, palette } from '../theme';

export default function Notifications() {
  const { patients, wisdoms, isPractitioner, settings, update } = useApp();
  const h = useHaptic();
  const ann = useAnnouncements();
  const dismissed = settings.dismissedNotices ?? [];
  const list = noticesFrom(patients, wisdoms, isPractitioner, ann).filter((n) => !dismissed.includes(n.id));
  // จำว่าอันไหน "ใหม่" ตอนเปิดหน้า (ก่อนถูกทำเป็นอ่านแล้ว)
  const [fresh, setFresh] = useState(() => new Set(list.filter((n) => !settings.readNotices?.includes(n.id)).map((n) => n.id)));
  // เปิดหน้านี้ = อ่านแล้วทั้งหมด (กระดิ่งหยุดสั่น จุดแดงหาย) · ประกาศที่โหลดมาทีหลังก็นับเป็น "ใหม่"
  useEffect(() => {
    const unread = list.map((n) => n.id).filter((id) => !settings.readNotices?.includes(id));
    if (!unread.length) return;
    setFresh((f) => new Set([...f, ...unread]));
    update({ readNotices: Array.from(new Set([...(settings.readNotices ?? []), ...unread])) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ann]);

  const clear = (ids: string[]) => {
    h.select();
    update({ dismissedNotices: Array.from(new Set([...dismissed, ...ids])) });
  };
  const newer = list.filter((n) => fresh.has(n.id));
  const older = list.filter((n) => !fresh.has(n.id));

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingTop: 4, paddingBottom: 60 }}>
      {list.length ? (
        <>
          {newer.length ? <Group title="ใหม่" items={newer} onClear={clear} start={0} /> : null}
          {older.length ? <Group title={newer.length ? 'ก่อนหน้านี้' : 'แจ้งเตือนทั้งหมด'} items={older} onClear={clear} start={newer.length} /> : null}
        </>
      ) : (
        <Animated.View entering={FadeIn.duration(300)} style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Sym name="bell.slash.fill" size={30} color={ios.tertiary} />
          </View>
          <T v="title" color={ios.secondary}>ไม่มีการแจ้งเตือน</T>
          <T v="subhead" color={ios.tertiary} center>ผู้ป่วยที่ต้องติดตามอาการ ภูมิปัญญารอตรวจทาน{'\n'}และอัปเดตใหม่จากระบบ จะแสดงที่นี่</T>
        </Animated.View>
      )}
    </ScrollView>
  );
}

function Group({ title, items, onClear, start }: { title: string; items: Notice[]; onClear: (ids: string[]) => void; start: number }) {
  return (
    <Animated.View layout={LinearTransition.duration(260)} style={{ marginTop: 14 }}>
      <View style={styles.groupHead}>
        <T v="h3">{title}</T>
        <PressableScale haptic="select" scaleTo={0.9} onPress={() => onClear(items.map((n) => n.id))} accessibilityLabel={`ล้าง${title}`} hitSlop={8}>
          <View style={styles.clearAll}>
            <T v="caption" color={ios.secondary} style={{ fontWeight: '600' }}>ล้าง</T>
          </View>
        </PressableScale>
      </View>
      <View style={{ gap: 8 }}>
        {items.map((n, i) => (
          <Card key={n.id} n={n} i={start + i} onClear={() => onClear([n.id])} />
        ))}
      </View>
    </Animated.View>
  );
}

function Card({ n, i, onClear }: { n: Notice; i: number; onClear: () => void }) {
  const sw = useRef<SwipeableMethods>(null);
  // กำลังปัด/ปัดค้างอยู่ → แตะการ์ด = ปิดปุ่มล้าง ไม่เปิดหน้า
  const moved = useRef(false);
  const open = useRef(false);
  const press = () => {
    if (moved.current) return;
    if (open.current) return sw.current?.close();
    router.push(n.go as any);
  };
  return (
    <Animated.View entering={i < 12 ? FadeIn.delay(i * 40).duration(220) : undefined} exiting={FadeOut.duration(180)} layout={LinearTransition.duration(260)}>
      <ReanimatedSwipeable
        ref={sw}
        onSwipeableOpenStartDrag={() => (moved.current = true)}
        onSwipeableWillOpen={() => (open.current = true)}
        onSwipeableWillClose={() => (open.current = false)}
        onSwipeableClose={() => (moved.current = false)}
        onSwipeableOpen={() => setTimeout(() => (moved.current = false), 250)}
        friction={1.6}
        rightThreshold={40}
        overshootRight={false}
        renderRightActions={() => (
          <PressableScale haptic="press" scaleTo={0.92} onPress={onClear} accessibilityLabel={`ล้าง ${n.title}`} style={styles.actionWrap}>
            <View style={styles.action}>
              <Sym name="xmark" size={15} color={palette.ink} weight="semibold" />
              <T v="caption" style={{ fontWeight: '600' }}>ล้าง</T>
            </View>
          </PressableScale>
        )}
      >
        <PressableScale scaleTo={0.98} haptic="select" onPress={press} style={[styles.card, elevation.e1]} accessibilityLabel={`${n.cat} ${n.title} ${n.body}`}>
          <LinearGradient colors={n.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.icon, { boxShadow: `0px 3px 8px ${n.colors[1]}44` }]}>
            <Sym name={n.icon as any} size={19} color="#FFFFFF" />
          </LinearGradient>
          <View style={{ flex: 1, gap: 1 }}>
            <View style={styles.top}>
              <T v="caption" color={ios.secondary} numberOfLines={1} style={{ flex: 1, fontWeight: '600' }}>{n.cat}</T>
              {n.when ? <T v="caption" color={ios.tertiary}>{n.when}</T> : null}
            </View>
            <T v="bodyStrong" numberOfLines={1}>{n.title}</T>
            <T v="subhead" color={ios.secondary} numberOfLines={2}>{n.body}</T>
          </View>
        </PressableScale>
      </ReanimatedSwipeable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8 },
  clearAll: { paddingHorizontal: 12, height: 26, borderRadius: 13, backgroundColor: 'rgba(120,120,128,0.14)', alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 22, borderCurve: 'continuous', backgroundColor: palette.surface },
  icon: { width: 38, height: 38, borderRadius: 10, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionWrap: { justifyContent: 'center', paddingLeft: 8 },
  action: { width: 72, flex: 1, borderRadius: 22, borderCurve: 'continuous', backgroundColor: 'rgba(120,120,128,0.16)', alignItems: 'center', justifyContent: 'center', gap: 3 },
  empty: { alignItems: 'center', gap: 8, paddingTop: 120 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(120,120,128,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
});
