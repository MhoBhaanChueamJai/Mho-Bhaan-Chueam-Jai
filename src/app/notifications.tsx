/** แจ้งเตือน — เปิดจากปุ่มกระดิ่งบนหัวจอหน้าหลัก */
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { CircleIcon, PAGE_PAD } from '../components/ListRow';
import { Sym, ios } from '../components/ios';
import { PressableScale, T } from '../components/ui';
import { noticesFrom } from '../lib/notices';
import { useApp } from '../store/app';
import { elevation, palette } from '../theme';

export default function Notifications() {
  const { patients, wisdoms, isPractitioner, settings, update } = useApp();
  const list = noticesFrom(patients, wisdoms, isPractitioner);
  // เปิดหน้านี้ = อ่านแล้วทั้งหมด (กระดิ่งหยุดสั่น จุดแดงหาย)
  useEffect(() => {
    const ids = list.map((n) => n.id);
    if (ids.some((id) => !settings.readNotices?.includes(id))) update({ readNotices: Array.from(new Set([...(settings.readNotices ?? []), ...ids])) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingTop: 8, paddingBottom: 60 }}>
      {list.length ? (
        <View style={[styles.card, elevation.e1]}>
          {list.map((n, i) => (
            <Animated.View key={n.id} entering={i < 12 ? FadeIn.delay(i * 40).duration(200) : undefined}>
              {i ? <View style={styles.sep} /> : null}
              <PressableScale scaleTo={0.98} haptic="select" onPress={() => router.push(n.go as any)} style={styles.row} accessibilityLabel={n.title}>
                <CircleIcon name={n.icon} color={n.color} size={46} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="title" numberOfLines={2}>{n.title}</T>
                  <T v="subhead" color={ios.secondary} numberOfLines={2}>{n.body}</T>
                </View>
                <Sym name="chevron.right" size={13} color={ios.tertiary} weight="semibold" />
              </PressableScale>
            </Animated.View>
          ))}
        </View>
      ) : (
        <View style={[styles.card, elevation.e1, { alignItems: 'center', paddingVertical: 36, gap: 8 }]}>
          <Sym name="bell.slash" size={30} color={ios.tertiary} />
          <T v="callout" color={ios.secondary}>ยังไม่มีแจ้งเตือน</T>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderRadius: 22, borderCurve: 'continuous' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingLeft: 16, paddingRight: 16, minHeight: 76 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: ios.separator, marginLeft: 76 },
});
