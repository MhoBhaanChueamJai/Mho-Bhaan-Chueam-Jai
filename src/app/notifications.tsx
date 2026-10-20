/** แจ้งเตือน — เปิดจากปุ่มกระดิ่งบนหัวจอหน้าหลัก · การ์ดแยกทีละเรื่องแบบ Notification Center ของ iOS (ปัดซ้ายเพื่อล้าง) */
import { Stack, router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { CircleIcon, PAGE_PAD } from '../components/ListRow';
import { Sym, ios } from '../components/ios';
import { PressableScale, T, useHaptic } from '../components/ui';
import { useAnnouncements } from '../lib/announcements';
import { GROUPS, noticesFrom, type Notice, type NoticeGroup } from '../lib/notices';
import { useStock } from '../lib/stock';
import { useApp } from '../store/app';
import { elevation, palette } from '../theme';

export default function Notifications() {
  const { patients, wisdoms, isPractitioner, settings, update } = useApp();
  const h = useHaptic();
  const ann = useAnnouncements();
  const [stock] = useStock();
  const dismissed = settings.dismissedNotices ?? [];
  const list = noticesFrom(patients, wisdoms, isPractitioner, ann, stock).filter((n) => !dismissed.includes(n.id));
  // ยังไม่อ่าน = ยังไม่เคยกดเปิด (แสดงจุดเขียว) · กดการ์ด/ปัดล้าง/อ่านทั้งหมด → อ่านแล้ว
  const read = settings.readNotices ?? [];
  const isUnread = (n: Notice) => !read.includes(n.id);
  const markRead = (ids: string[]) => {
    const add = ids.filter((id) => !read.includes(id));
    if (add.length) update({ readNotices: [...read, ...add] });
  };
  const unreadCount = list.filter(isUnread).length;

  const clear = (ids: string[]) => {
    h.select();
    update({ dismissedNotices: Array.from(new Set([...dismissed, ...ids])), readNotices: Array.from(new Set([...read, ...ids])) });
  };
  const open = (n: Notice) => {
    markRead([n.id]);
    router.push(n.go as any);
  };
  // chip กรองประเภท: แสดงเฉพาะประเภทที่มีแจ้งเตือน (ล้างจนหมด → กลับไปทั้งหมด)
  const [group, setGroup] = useState<NoticeGroup | 'all'>('all');
  const groups = GROUPS.filter((g) => list.some((n) => n.group === g.key));
  const active = group !== 'all' && groups.some((g) => g.key === group) ? group : 'all';
  const shown = active === 'all' ? list : list.filter((n) => n.group === active);
  const newer = shown.filter(isUnread);
  const older = shown.filter((n) => !isUnread(n));

  return (
    <>
      {/* มีที่ยังไม่อ่าน → ปุ่ม "อ่านทั้งหมด" มุมขวาบน */}
      <Stack.Screen
        options={{
          headerRight: unreadCount
            ? () => (
                <PressableScale haptic="select" scaleTo={0.92} onPress={() => markRead(list.map((n) => n.id))} accessibilityLabel="ทำเครื่องหมายว่าอ่านทั้งหมด" style={styles.readAll}>
                  <T v="subhead" color={palette.primary} style={{ fontWeight: '600' }}>อ่านทั้งหมด</T>
                </PressableScale>
              )
            : undefined,
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingTop: 4, paddingBottom: 60 }}>
        {list.length ? (
          <>
            {groups.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ marginHorizontal: -PAGE_PAD }}>
                {[{ key: 'all' as const, label: 'ทั้งหมด', color: palette.primary }, ...groups].map((g) => {
                  const on = active === g.key;
                  const count = g.key === 'all' ? list.length : list.filter((n) => n.group === g.key).length;
                  return (
                    <PressableScale key={g.key} haptic="select" scaleTo={0.95} onPress={() => setGroup(g.key)} style={[styles.chip, on && { backgroundColor: g.color, borderColor: 'transparent' }]} accessibilityState={{ selected: on }} accessibilityLabel={`${g.label} ${count} รายการ`}>
                      <T v="subhead" color={on ? '#FFFFFF' : palette.ink} style={{ fontWeight: '600' }}>{g.label}</T>
                      <T v="caption" color={on ? 'rgba(255,255,255,0.85)' : ios.secondary} style={{ fontWeight: '600' }}>{count}</T>
                    </PressableScale>
                  );
                })}
              </ScrollView>
            ) : null}
            {newer.length ? <Group title="ยังไม่อ่าน" items={newer} unread onOpen={open} onClear={clear} start={0} /> : null}
            {older.length ? <Group title="อ่านแล้ว" items={older} onOpen={open} onClear={clear} start={newer.length} /> : null}
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
    </>
  );
}

function Group({ title, items, unread, onOpen, onClear, start }: { title: string; items: Notice[]; unread?: boolean; onOpen: (n: Notice) => void; onClear: (ids: string[]) => void; start: number }) {
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
          <Card key={n.id} n={n} i={start + i} unread={unread} onOpen={() => onOpen(n)} onClear={() => onClear([n.id])} />
        ))}
      </View>
    </Animated.View>
  );
}

function Card({ n, i, unread, onOpen, onClear }: { n: Notice; i: number; unread?: boolean; onOpen: () => void; onClear: () => void }) {
  const sw = useRef<SwipeableMethods>(null);
  // กำลังปัด/ปัดค้างอยู่ → แตะการ์ด = ปิดปุ่มล้าง ไม่เปิดหน้า
  const moved = useRef(false);
  const open = useRef(false);
  const press = () => {
    if (moved.current) return;
    if (open.current) return sw.current?.close();
    onOpen();
  };
  return (
    <Animated.View entering={i < 12 ? FadeIn.delay(i * 40).duration(220) : undefined} exiting={FadeOut.duration(180)} layout={LinearTransition.duration(260)}>
      <ReanimatedSwipeable
        ref={sw}
        // ค่าเริ่มต้นตัดขอบ → เงาการ์ดหาย (ปุ่มล้างโปร่งใสตอนไม่ได้ปัด จึงไม่โผล่)
        containerStyle={{ overflow: 'visible' }}
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
        <PressableScale scaleTo={0.98} haptic="select" onPress={press} style={[styles.card, elevation.e1]} accessibilityLabel={`${unread ? 'ยังไม่อ่าน ' : ''}${n.cat} ${n.title} ${n.body}`}>
          <View style={styles.icon}>
            <CircleIcon name={n.icon} color={n.colors[1]} size={36} />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <View style={styles.top}>
              <T v="caption" color={ios.secondary} numberOfLines={1} style={{ flex: 1, fontWeight: '600' }}>{n.cat}</T>
              {n.when ? <T v="caption" color={unread ? palette.primary : ios.tertiary}>{n.when}</T> : null}
              {unread ? <View style={styles.dot} /> : null}
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
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: palette.primary },
  readAll: { paddingHorizontal: 10, height: 36, justifyContent: 'center' },
  chips: { gap: 8, paddingHorizontal: PAGE_PAD, paddingTop: 6, paddingBottom: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1, borderColor: ios.separator },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8 },
  clearAll: { paddingHorizontal: 12, height: 26, borderRadius: 13, backgroundColor: 'rgba(120,120,128,0.14)', alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 22, borderCurve: 'continuous', backgroundColor: palette.surface },
  icon: { marginTop: 2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionWrap: { justifyContent: 'center', paddingLeft: 8 },
  action: { width: 72, flex: 1, borderRadius: 22, borderCurve: 'continuous', backgroundColor: 'rgba(120,120,128,0.16)', alignItems: 'center', justifyContent: 'center', gap: 3 },
  empty: { alignItems: 'center', gap: 8, paddingTop: 120 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(120,120,128,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
});
