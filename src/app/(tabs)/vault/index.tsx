/**
 * แท็บคลังภูมิปัญญา — สมุดข่อยดิจิทัลของคุณหมอ (โครงเดียวกับแท็บผู้ป่วย)
 * สรุปจำนวน → รายการภูมิปัญญาในการ์ดเดียว (ไอคอนวงกลมตามประเภท) → ว่าง = ชวนเพิ่มด้วยเสียง/สแกนตำรา
 */
import { Stack, router } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { CircleIcon } from '../../../components/ListRow';
import { Sym, ios } from '../../../components/ios';
import { HeaderButton, PressableScale, T } from '../../../components/ui';
import { legacy, type Wisdom } from '../../../data/mock';
import { useApp } from '../../../store/app';
import { elevation, palette } from '../../../theme';

const KIND: Record<Wisdom['kind'], { icon: string; color: string }> = {
  ตำรับยา: { icon: 'leaf.fill', color: palette.primary },
  วิธีรักษา: { icon: 'hand.raised.fill', color: '#3B7DD8' },
  'คาถา/พิธี': { icon: 'sparkles', color: '#8A5CD0' },
  ตำราโบราณ: { icon: 'scroll.fill', color: '#B07A2A' },
};
const SOURCE_ICON: Record<Wisdom['source'], string> = { เสียงเล่า: 'waveform', สแกนตำรา: 'doc.viewfinder', พิมพ์เอง: 'pencil' };

export default function Vault() {
  const { wisdoms } = useApp();
  const recorded = legacy.recorded + Math.max(0, wisdoms.length - 3);
  const pending = wisdoms.filter((w) => !w.verified).length;
  const counts = useMemo(() => {
    const c: Partial<Record<Wisdom['kind'], number>> = {};
    wisdoms.forEach((w) => (c[w.kind] = (c[w.kind] ?? 0) + 1));
    return c;
  }, [wisdoms]);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <HeaderButton label="ค้นหาภูมิปัญญา" onPress={() => router.push('/wisdom/search')}>
                <Sym name="magnifyingglass" size={20} color={palette.primary} weight="semibold" />
              </HeaderButton>
              <HeaderButton label="เพิ่มภูมิปัญญา" onPress={() => router.push('/wisdom/new')}>
                <Sym name="plus" size={20} color={palette.primary} weight="semibold" />
              </HeaderButton>
            </View>
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <T v="callout" color={ios.secondary} style={{ paddingHorizontal: 4, marginBottom: 14 }}>
          สมุดข่อยดิจิทัล · บันทึกแล้ว {recorded} เรื่อง
        </T>

        {/* สรุป: เสียงเล่า · ศิษย์ · รอตรวจทาน */}
        <Animated.View entering={FadeIn.duration(250)} style={[styles.stats, elevation.e1]}>
          {[
            { v: `${legacy.minutes}`, l: 'นาทีเสียงเล่า' },
            { v: `${legacy.apprentices}`, l: 'ลูกศิษย์' },
            { v: `${pending}`, l: 'รอตรวจทาน', warn: pending > 0 },
          ].map((s, i) => (
            <React.Fragment key={s.l}>
              {i ? <View style={styles.vsep} /> : null}
              <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                <T v="h2" color={s.warn ? '#C27A12' : palette.ink}>{s.v}</T>
                <T v="caption" color={ios.secondary}>{s.l}</T>
              </View>
            </React.Fragment>
          ))}
        </Animated.View>

        {/* ประเภท (สรุปจำนวน) */}
        <View style={styles.kinds}>
          {(Object.keys(KIND) as Wisdom['kind'][]).map((k) => (
            <View key={k} style={[styles.kind, elevation.e1]}>
              <CircleIcon name={KIND[k].icon} color={KIND[k].color} size={34} />
              <View style={{ flex: 1 }}>
                <T v="caption" color={ios.secondary} numberOfLines={1}>{k}</T>
                <T v="title">{counts[k] ?? 0}</T>
              </View>
            </View>
          ))}
        </View>

        <T v="h3" style={{ marginTop: 28, marginBottom: 12, marginLeft: 4 }}>ภูมิปัญญาทั้งหมด</T>
        {wisdoms.length ? (
          <View style={[styles.list, elevation.e1]}>
            {wisdoms.map((w, i) => (
              <Animated.View key={w.id} entering={FadeIn.delay(i * 40).duration(200)}>
                {i ? <View style={styles.sep} /> : null}
                <PressableScale scaleTo={0.98} haptic="select" onPress={() => router.push(`/wisdom/${w.id}`)} style={styles.row} accessibilityLabel={`${w.title} ${w.kind}`}>
                  <CircleIcon name={KIND[w.kind]?.icon ?? 'book.closed.fill'} color={KIND[w.kind]?.color ?? palette.primary} size={48} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <T v="title" numberOfLines={2}>{w.title}</T>
                    <T v="subhead" color={ios.secondary} numberOfLines={1}>{w.summary}</T>
                    <View style={styles.meta}>
                      <Sym name={SOURCE_ICON[w.source] as any} size={11} color={ios.tertiary} />
                      <T v="caption" color={ios.tertiary}>{w.source} · {w.date}</T>
                      {w.verified ? null : (
                        <View style={styles.pending}>
                          <T v="micro" color="#C27A12" style={{ fontWeight: '700' }}>รอตรวจทาน</T>
                        </View>
                      )}
                    </View>
                  </View>
                  <Sym name="chevron.right" size={13} color={ios.tertiary} weight="semibold" />
                </PressableScale>
              </Animated.View>
            ))}
          </View>
        ) : null}

        {/* ชวนเพิ่ม: เล่าด้วยเสียง · สแกนตำรา */}
        <View style={[styles.list, elevation.e1, { marginTop: 14 }]}>
          <PressableScale scaleTo={0.98} haptic="select" onPress={() => router.push('/wisdom/voice')} style={styles.row} accessibilityLabel="เล่าให้ครูปัญญาบันทึก">
            <CircleIcon name="mic.fill" color={palette.primary} size={48} />
            <View style={{ flex: 1 }}>
              <T v="title">เล่าให้ครูปัญญาบันทึก</T>
              <T v="subhead" color={ios.secondary}>พูดเล่าตำรับ ครูปัญญาจดและจัดหมวดให้</T>
            </View>
            <Sym name="chevron.right" size={13} color={ios.tertiary} weight="semibold" />
          </PressableScale>
          <View style={styles.sep} />
          <PressableScale scaleTo={0.98} haptic="select" onPress={() => router.push('/scan')} style={styles.row} accessibilityLabel="สแกนตำราโบราณ">
            <CircleIcon name="doc.viewfinder" color="#B07A2A" size={48} />
            <View style={{ flex: 1 }}>
              <T v="title">สแกนตำราโบราณ</T>
              <T v="subhead" color={ios.secondary}>ถ่ายสมุดข่อย/ใบลาน ถอดความเป็นภาษาปัจจุบัน</T>
            </View>
            <Sym name="chevron.right" size={13} color={ios.tertiary} weight="semibold" />
          </PressableScale>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 120 },
  stats: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, borderRadius: 20, borderCurve: 'continuous', paddingVertical: 16 },
  vsep: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: ios.separator },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  kind: { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: palette.surface, borderRadius: 18, borderCurve: 'continuous' },
  list: { backgroundColor: palette.surface, borderRadius: 20, borderCurve: 'continuous' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingLeft: 14, paddingRight: 16, minHeight: 76 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: ios.separator, marginLeft: 76 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  pending: { marginLeft: 4, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999, backgroundColor: '#FDF0DC' },
});
