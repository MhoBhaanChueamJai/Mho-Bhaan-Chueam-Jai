import { Stack, router } from 'expo-router';
import React, { useMemo } from 'react';
import { PractitionerGate } from '../../../components/PractitionerGate';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { IOSCard, Sym, ios } from '../../../components/ios';
import { Avatar, HeaderButton, PressableScale, T } from '../../../components/ui';
import { avatarFor, lastVisit } from '../../../data/mock';
import { statusLabel, statusTone, visitSortKey } from '../../../data/tones';
import { useApp } from '../../../store/app';
import { elevation, palette } from '../../../theme';

/**
 * แท็บผู้ป่วย — รายชื่อผู้ป่วยทั้งหมด เรียงตามที่มารักษาล่าสุด
 * (หมอพื้นบ้านไม่ใช้ระบบนัดแบบคลินิก จึงไม่มีตารางนัด)
 */
function PatientsInner() {
  const { patients } = useApp();
  const list = useMemo(() => [...patients].sort((a, b) => visitSortKey(lastVisit(b)?.date) - visitSortKey(lastVisit(a)?.date)), [patients]);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <HeaderButton label="ค้นหาผู้ป่วย" onPress={() => router.push('/patient/search')}>
                <Sym name="magnifyingglass" size={20} color={palette.ink} weight="semibold" />
              </HeaderButton>
              <HeaderButton label="เพิ่มผู้ป่วยใหม่" onPress={() => router.push('/patient/new')}>
                <Sym name="plus" size={20} color={palette.ink} weight="semibold" />
              </HeaderButton>
            </View>
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <T v="callout" color={ios.secondary} style={{ paddingHorizontal: 4, marginBottom: 14 }}>
          ผู้ป่วย {patients.length} ราย · เรียงตามที่มารักษาล่าสุด
        </T>

        {list.length ? (
          <View style={[styles.list, elevation.e1]}>
            {list.map((p, i) => {
              const st = statusTone[p.status];
              const v = lastVisit(p);
              return (
                <Animated.View key={p.id} entering={i < 12 ? FadeIn.delay(i * 40).duration(200) : undefined}>
                  {i ? <View style={styles.sep} /> : null}
                  <PressableScale scaleTo={0.98} haptic="select" onPress={() => router.push(`/patient/${p.id}`)} style={styles.row} accessibilityLabel={`${p.name} ${statusLabel(p.status)}`}>
                    <View>
                      <Avatar name={p.name} src={avatarFor(p)} size={52} />
                      <View style={[styles.dot, { backgroundColor: st.fg }]} />
                    </View>
                    <View style={{ flex: 1, gap: 1 }}>
                      <T v="title" numberOfLines={1}>{p.name}</T>
                      <T v="subhead" color={ios.secondary} numberOfLines={1}>{v ? v.diagnosis : 'ยังไม่มีการรักษา'}</T>
                      <View style={styles.meta}>
                        <T v="caption" color={st.fg} style={{ fontWeight: '600' }}>{statusLabel(p.status)}</T>
                        <T v="caption" color={ios.tertiary}>{v ? `· มาล่าสุด ${v.date}` : `· ${p.sex} ${p.age} ปี`}</T>
                      </View>
                    </View>
                    <Sym name="chevron.right" size={13} color={ios.tertiary} weight="semibold" />
                  </PressableScale>
                </Animated.View>
              );
            })}
          </View>
        ) : (
          <IOSCard style={{ alignItems: 'center', paddingVertical: 28, gap: 6 }}>
            <Sym name="person.2" size={28} color={ios.tertiary} />
            <T v="callout" color={ios.secondary}>ยังไม่มีผู้ป่วย กด + เพื่อเพิ่ม</T>
          </IOSCard>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 120 },
  list: { backgroundColor: palette.surface, borderRadius: 20, borderCurve: 'continuous' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingLeft: 14, paddingRight: 16, minHeight: 76 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: ios.separator, marginLeft: 80 },
  dot: { position: 'absolute', right: 0, bottom: 1, width: 14, height: 14, borderRadius: 7, borderWidth: 2.5, borderColor: palette.surface },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
});

export default function Patients() {
  return (
    <PractitionerGate>
      <PatientsInner />
    </PractitionerGate>
  );
}
