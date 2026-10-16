/**
 * ตั้งค่า AI (เปิดจากหน้าตั้งค่า) — ก้อนแสงครูปัญญา · ภาษาพูด · ทดลองฟังเสียง
 * ครูปัญญาใช้ 2 โมเดลช่วยกันอัตโนมัติ และเสียงเดียวทั้งแอป จึงตั้งได้แค่ภาษาพูด (ภาษาถิ่น)
 */
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AISphere } from '../components/AISphere';
import { useSpeaker } from '../components/audio';
import { Sym, ios } from '../components/ios';
import { PressableScale, T } from '../components/ui';
import { DIALECTS, type Dialect } from '../lib/dialect';
import { useApp } from '../store/app';
import { elevation, palette } from '../theme';

/** คำทักทายตัวอย่างตามภาษาพูด */
const GREETING: Record<Dialect, string> = {
  central: 'สวัสดีครับคุณหมอ ผมครูปัญญา ยินดีช่วยดูแลผู้ป่วยครับ มีอะไรให้ช่วยบอกได้เลยนะครับ',
  isan: 'สวัสดีครับคุณหมอ ผมครูปัญญาเด้อ มีหยังให้ช่วย บอกได้เลยเด้อครับ',
  north: 'สวัสดีครับคุณหมอ ผมครูปัญญา มีอะหยังหื้อจ้วย บอกได้เลยเน้อครับ',
  south: 'สวัสดีครับคุณหมอ ผมครูปัญญา มีไหรให้ช่วย แหลงมาได้เลยครับ',
};

export default function AISettings() {
  const { settings, update } = useApp();
  const tts = useSpeaker();
  const dialect = settings.dialect ?? 'central';
  useEffect(() => () => tts.stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const preview = () => (tts.speaking ? tts.stop() : tts.speak(GREETING[dialect]));

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
      {/* ก้อนแสงครูปัญญา */}
      <Animated.View entering={FadeInDown.springify().damping(20)} style={[styles.hero, elevation.e2]}>
        <AISphere size={170} active={tts.speaking} level={tts.level} />
        <T v="h2" color="#FFFFFF" style={{ marginTop: 6 }}>ครูปัญญา</T>
        <T v="subhead" color="rgba(255,255,255,0.65)" center>ผู้ช่วย AI ของหมอพื้นบ้าน · คิดวิเคราะห์ 2 ทางเพื่อความแม่นยำ</T>
        <PressableScale haptic="press" onPress={preview} style={[styles.listen, tts.speaking && styles.listenOn]} accessibilityLabel={tts.speaking ? 'หยุดเสียง' : 'ทดลองฟังเสียง'}>
          <Sym name={tts.speaking ? 'stop.fill' : 'play.fill'} size={15} color={tts.speaking ? '#04150E' : '#FFFFFF'} />
          <T v="bodyStrong" color={tts.speaking ? '#04150E' : '#FFFFFF'}>{tts.speaking ? 'หยุด' : 'ทดลองฟังเสียง'}</T>
        </PressableScale>
      </Animated.View>

      {/* ภาษาพูด */}
      <Animated.View entering={FadeInDown.delay(60).springify().damping(20)}>
        <T v="h3" style={styles.secTitle}>ภาษาพูด</T>
        <View style={[styles.card, elevation.e1]}>
          {DIALECTS.map((d, i) => {
            const on = dialect === d.id;
            return (
              <PressableScale
                key={d.id}
                haptic="select"
                scaleTo={0.99}
                onPress={() => {
                  update({ dialect: d.id });
                  tts.stop();
                }}
                style={[styles.row, i < DIALECTS.length - 1 && styles.sep]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={d.label}
              >
                <View style={{ flex: 1 }}>
                  <T v="body" color={on ? palette.primaryDeep : ios.label} style={{ fontWeight: on ? '600' : '400' }}>{d.label}</T>
                  <T v="caption" color={ios.secondary}>{d.note}</T>
                </View>
                {on ? <Sym name="checkmark" size={17} color={palette.primary} weight="bold" /> : null}
              </PressableScale>
            );
          })}
        </View>
        <T v="caption" color={ios.secondary} style={styles.footer}>ครูปัญญาจะฟังและเข้าใจภาษาที่เลือกได้แม่นขึ้น กดทดลองฟังเสียงเพื่อฟังคำทักทายในภาษานั้น</T>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 8, borderRadius: 26, borderCurve: 'continuous', backgroundColor: '#05090A', alignItems: 'center', paddingTop: 18, paddingBottom: 20, paddingHorizontal: 20, overflow: 'hidden' },
  listen: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, height: 46, paddingHorizontal: 22, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.4)' },
  listenOn: { backgroundColor: '#7CF0A8' },
  secTitle: { marginTop: 26, marginBottom: 10, marginLeft: 4 },
  card: { backgroundColor: palette.surface, borderRadius: 20, borderCurve: 'continuous' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingHorizontal: 16, paddingVertical: 10 },
  sep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ios.separator },
  footer: { marginTop: 8, paddingHorizontal: 6 },
});
