/**
 * ตั้งค่า AI (เปิดจากหน้าตั้งค่า) — ก้อนแสงครูปัญญา · ภาษาพูด · ทดลองฟังเสียง
 * ครูปัญญาใช้โมเดล Gemma 4 ของ BMS และเสียงเดียวทั้งแอป จึงตั้งได้แค่ภาษาพูด (ภาษาถิ่น)
 */
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Switch } from '../components/AppSwitch';
import { Alert } from '../lib/alert';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AISphere } from '../components/AISphere';
import { useSpeaker } from '../components/audio';
import { Sym } from '../components/ios';
import { PressableScale, T } from '../components/ui';
import { CircleIcon, ListRow, ListSection, PAGE_PAD } from '../components/ListRow';
import { DIALECTS, type Dialect } from '../lib/dialect';
import { clearChats } from '../lib/chatStore';
import { useApp } from '../store/app';
import { elevation, palette } from '../theme';
import { column } from '../components/layout';

/** คำทักทายตัวอย่างตามภาษาพูด */
const GREETING: Record<Dialect, string> = {
  central: 'สวัสดีครับคุณหมอ ผมครูปัญญา ยินดีช่วยดูแลผู้ป่วยครับ มีอะไรให้ช่วยบอกได้เลยนะครับ',
  isan: 'สวัสดีครับ ข้อยครูปัญญาเด้อ มื้อนี้เป็นจั่งใดแหน่ มีอิหยังให้ข้อยซ่อยบ่ครับ เว้ามาได้เลยครับ',
  north: 'สวัสดีครับ ผมครูปัญญาเน้อ วันนี้เป๋นจะใดพ่อง มีอะหยังหื้อผมจ้วยก่อครับ อู้มาได้เลยเน้อ',
  south: 'สวัสดีครับ ผมครูปัญญาหนิ วันนี้เป็นพรือมั่ง มีไหรให้ช่วยกาครับ แหลงมาได้เลยโหล',
};

export default function AISettings() {
  const { settings, update } = useApp();
  const tts = useSpeaker();
  const dialect = settings.dialect ?? 'central';
  useEffect(() => () => tts.stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const preview = () => (tts.speaking ? tts.stop() : tts.speak(GREETING[dialect]));

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={[{ paddingHorizontal: PAGE_PAD, paddingTop: 8, paddingBottom: 56 }, column.read]}>
      {/* ก้อนแสงครูปัญญา */}
      <Animated.View entering={FadeInDown.duration(420)} style={[styles.hero, elevation.e2]}>
        <AISphere size={170} active={tts.speaking} level={tts.level} />
        <T v="h2" color="#FFFFFF" style={{ marginTop: 6 }}>ครูปัญญา</T>
        <T v="subhead" color="rgba(255,255,255,0.65)" center>ผู้ช่วย AI ด้านการแพทย์แผนไทย · รู้จักสมุนไพร 100 ชนิด ตำรา และหลักการตั้งตำรับยา</T>
        <PressableScale haptic="press" onPress={preview} style={[styles.listen, tts.speaking && styles.listenOn]} accessibilityLabel={tts.speaking ? 'หยุดเสียง' : 'ทดลองฟังเสียง'}>
          <Sym name={tts.speaking ? 'stop.fill' : 'play.fill'} size={15} color={tts.speaking ? '#04150E' : '#FFFFFF'} />
          <T v="bodyStrong" color={tts.speaking ? '#04150E' : '#FFFFFF'}>{tts.speaking ? 'หยุด' : 'ทดลองฟังเสียง'}</T>
        </PressableScale>
      </Animated.View>

      {/* ภาษาพูด */}
      <ListSection i={1} title="ภาษาพูด" footer="ครูปัญญาจะฟังและเข้าใจภาษาที่เลือกได้แม่นขึ้น กดทดลองฟังเสียงเพื่อฟังคำทักทายในภาษานั้น">
        {DIALECTS.map((d, i) => {
          const on = dialect === d.id;
          return (
            <ListRow
              key={d.id}
              icon={<CircleIcon name="bubble.left.and.bubble.right.fill" color={['#14905C', '#D9921A', '#7A5CC8', '#2A8C7A'][i]} />}
              title={d.label}
              subtitle={d.note}
              onPress={() => {
                update({ dialect: d.id });
                tts.stop();
              }}
              right={on ? <Sym name="checkmark.circle.fill" size={24} color={palette.primary} /> : <View style={styles.radio} />}
              last={i === DIALECTS.length - 1}
            />
          );
        })}
      </ListSection>

      {/* การสนทนา */}
      <ListSection i={2} title="การสนทนา" footer="ประวัติแชทเก็บไว้ในเครื่องนี้เท่านั้น และถูกล้างเมื่อออกจากระบบ">
        <ListRow
          icon={<CircleIcon name="speaker.wave.2.fill" color="#14905C" />}
          title="พูดคำตอบอัตโนมัติ"
          subtitle="ในหน้าแชท ครูปัญญาจะพูดคำตอบให้ฟังทันที"
          right={<Switch value={settings.autoSpeak} onValueChange={(v) => update({ autoSpeak: v })} trackColor={{ true: palette.primary }} />}
        />
        <ListRow
          icon={<CircleIcon name="trash.fill" color="#D9534A" />}
          title="ลบประวัติแชททั้งหมด"
          onPress={() =>
            Alert.alert('ลบประวัติแชททั้งหมด?', 'แชทกับครูปัญญาทั้งหมดในเครื่องนี้จะถูกลบ และกู้คืนไม่ได้', [
              { text: 'ยกเลิก', style: 'cancel' },
              { text: 'ลบทั้งหมด', style: 'destructive', onPress: () => clearChats() },
            ])
          }
          last
        />
      </ListSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 8, borderRadius: 26, borderCurve: 'continuous', backgroundColor: '#05090A', alignItems: 'center', paddingTop: 18, paddingBottom: 20, paddingHorizontal: 20, overflow: 'hidden' },
  listen: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, height: 46, paddingHorizontal: 22, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.4)' },
  listenOn: { backgroundColor: '#7CF0A8' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(60,60,67,0.25)' },
});
