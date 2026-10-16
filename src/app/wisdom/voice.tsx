/**
 * ครูปัญญาช่วยบันทึกภูมิปัญญาด้วยเสียง
 * 1) เลือกประเภทในหน้านี้ (ตำรับยา / วิธีรักษา / คาถา·พิธี / ตำราโบราณ) — เลือกไว้จากหน้าเพิ่มจะถูกเลือกให้ก่อน
 * 2) เริ่มคุย: หัวข้อที่ถามเปลี่ยนตามประเภท → ตรวจทานเสร็จส่งกลับไปเติมฟอร์ม
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AISphere } from '../../components/AISphere';
import { KindIcon } from '../../components/KindIcon';
import { Sym } from '../../components/ios';
import { GlassCircle, PressableScale, T } from '../../components/ui';
import { VoiceSession } from '../../components/VoiceSession';
import type { Wisdom } from '../../data/mock';
import { KIND_FORM } from '../../lib/wisdomKinds';
import { KINDS, kindOf, optionsFor, setWisdomResult, topicsFor, wisdomHas, wisdomOpening, wisdomScribe, wisdomTurn, type WisdomData } from '../../lib/wisdomTalk';

const MINT = '#7CF0A8';

/** หน้าเลือกประเภท (ธีมมืดเดียวกับหน้าคุยกับครูปัญญา) */
function KindPicker({ initial, onPick }: { initial?: Wisdom['kind']; onPick: (k: Wisdom['kind']) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <LinearGradient colors={['#000000', '#050B08', '#000000']} style={StyleSheet.absoluteFill} />
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <GlassCircle label="ปิด" onPress={() => router.back()} tint="rgba(255,255,255,0.12)">
          <Sym name="xmark" size={17} color="#FFFFFF" weight="semibold" />
        </GlassCircle>
        <T v="title" color="#FFFFFF">บันทึกภูมิปัญญา</T>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.body}>
        <Animated.View entering={FadeIn.duration(500)} style={{ alignItems: 'center' }}>
          <AISphere size={150} active />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(120).duration(420)}>
          <T v="h2" color="#FFFFFF" center style={{ marginTop: 14 }}>จะบันทึกประเภทไหนครับ</T>
          <T v="callout" color="rgba(255,255,255,0.6)" center style={{ marginTop: 6 }}>ครูปัญญาจะถามให้ตรงกับประเภทที่เลือก</T>
        </Animated.View>

        <View style={styles.grid}>
          {KINDS.map((k, i) => {
            const on = k === initial;
            return (
              <Animated.View key={k} entering={FadeInDown.delay(200 + i * 70).duration(420)} style={styles.cell}>
                <PressableScale haptic="press" scaleTo={0.96} onPress={() => onPick(k)} style={[styles.card, on && styles.cardOn]} accessibilityLabel={`${k} ${KIND_FORM[k].desc}`}>
                  <View style={[styles.icon, on && { backgroundColor: MINT }]}>
                    <KindIcon kind={k} size={22} color={on ? '#04150E' : MINT} />
                  </View>
                  <T v="title" color="#FFFFFF" style={{ marginTop: 10 }}>{k}</T>
                  <T v="caption" color="rgba(255,255,255,0.6)" numberOfLines={2}>{KIND_FORM[k].desc}</T>
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function WisdomVoice() {
  const { kind: k } = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState<Wisdom['kind'] | null>(null);
  if (!kind) return <KindPicker initial={k ? kindOf(k) : undefined} onPick={setKind} />;
  return (
    <VoiceSession
      key={kind}
      title={`บันทึก${kind}`}
      opening={wisdomOpening(kind)}
      initialOptions={optionsFor(kind, 'title')}
      scribe={(t) => wisdomScribe(kind, t) as any}
      topics={topicsFor(kind) as { key: string; label: string }[]}
      has={(d, key) => wisdomHas(d as WisdomData, key)}
      turn={(d, h, a) => wisdomTurn(kind, d as WisdomData, h, a) as any}
      confirmQ="จะใช้ข้อมูลนี้เลยไหมครับ"
      yesBye="เรียบร้อยครับ"
      noBye=""
      noContinues
      doneLabel="บันทึกเสร็จแล้ว"
      canUse={(d) => !!d.title}
      dockLabel={() => 'ใช้ข้อมูลนี้'}
      onFinish={(d) => {
        setWisdomResult({ ...(d as WisdomData), kind, source: 'เสียงเล่า' });
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000000' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 28 },
  cell: { flexBasis: '47%', flexGrow: 1 },
  card: { padding: 16, borderRadius: 22, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.14)', minHeight: 130 },
  cardOn: { borderColor: MINT, backgroundColor: 'rgba(124,240,168,0.12)' },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(124,240,168,0.14)', alignItems: 'center', justifyContent: 'center' },
});
