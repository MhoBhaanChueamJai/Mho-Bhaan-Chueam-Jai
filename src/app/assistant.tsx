import { Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SYSTEM_PROMPT, chat, transcribe, type ChatMsg } from '../api/ai';
import { dialectHint, dialectSpeakStyle } from '../lib/dialect';
import { useSpeaker, useVoiceRecorder } from '../components/audio';
import { Sym } from '../components/ios';
import { SoftShadow, Waveform } from '../components/Orb';
import { AISphere } from '../components/AISphere';
import { Glass, HeaderBack, PressableScale, T, useHaptic } from '../components/ui';
import { askLaunch } from '../lib/askLaunch';
import { useApp } from '../store/app';
import { control, palette } from '../theme';

const SUGGEST = [
  { q: 'ผู้สูงอายุปวดเข่า ใช้สมุนไพรอะไรดี', sym: 'figure.walk' },
  { q: 'ฟ้าทะลายโจร ห้ามใช้กับใคร', sym: 'exclamationmark.shield' },
  { q: 'ทำลูกประคบสมุนไพรอย่างไร', sym: 'leaf' },
  { q: 'ยาสมุนไพรกินคู่กับยาความดันได้ไหม', sym: 'pills' },
] as const;

type Msg = ChatMsg & { id: string; failed?: boolean };

/** หน้าแชทครูปัญญา — หน้าเต็มจอแยก (ไม่มีแถบเมนูล่าง) */
export default function Assistant() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const insets = useSafeAreaInsets();
  const { settings } = useApp();
  const h = useHaptic();
  const tts = useSpeaker();
  const rec = useVoiceRecorder();
  const scroll = useRef<ScrollView>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [barW, setBarW] = useState(0);
  const [barH, setBarH] = useState(52);

  const send = async (content: string) => {
    if (!content.trim() || busy) return;
    h.tap();
    const user: Msg = { id: `u${Date.now()}`, role: 'user', content: content.trim() };
    const history = [...msgs, user];
    setMsgs(history);
    setText('');
    setBusy(true);
    try {
      const reply = await chat([{ role: 'system', content: `${SYSTEM_PROMPT}\n- ${dialectHint()}\n- ${dialectSpeakStyle()}` }, ...history.map(({ role, content }) => ({ role, content }))], settings.model);
      const id = `a${Date.now()}`;
      setMsgs((m) => [...m, { id, role: 'assistant', content: reply }]);
      h.success();
      if (settings.autoSpeak) {
        setSpeakingId(id);
        tts.speak(reply);
      }
    } catch {
      setMsgs((m) => [...m, { id: `e${Date.now()}`, role: 'assistant', content: 'ขออภัยครับ ตอนนี้เชื่อมต่อครูปัญญาไม่ได้ ลองใหม่อีกครั้งนะครับ', failed: true }]);
      h.warn();
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (q) send(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 120);
  }, [msgs.length, busy]);
  useEffect(() => {
    if (!tts.speaking) setSpeakingId(null);
  }, [tts.speaking]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(
    () => () => {
      tts.stop();
      // ปิดหน้าแชท → แท็บไมค์รู้ว่าต้องพากลับหน้าหลัก
      askLaunch.justClosed = true;
      setTimeout(() => (askLaunch.justClosed = false), 1500);
    },
    [],
  );

  const toggleMic = async () => {
    if (rec.isRecording) {
      h.heavy();
      const uri = await rec.stop().catch(() => null);
      if (!uri) return;
      setBusy(true);
      try {
        const t = await transcribe(uri);
        setBusy(false);
        if (t) send(t);
      } catch {
        setBusy(false);
      }
    } else {
      h.press();
      tts.stop();
      rec.start().catch(() => {});
    }
  };

  const status = busy ? 'กำลังคิด…' : tts.speaking ? 'กำลังพูด…' : rec.isRecording ? 'กำลังฟัง…' : 'พร้อมช่วยคุณหมอ';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: DARK }}>
      <StatusBar style="light" />
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: false,
          headerStyle: { backgroundColor: DARK },
          headerShadowVisible: false,
          headerBackVisible: false,
          headerLeft: () => <HeaderBack fallback="/home" color={MINT} />,
          headerTitle: () => (
            <View style={{ alignItems: 'center' }}>
              <T v="title" color="#FFFFFF">ครูปัญญา</T>
              <T v="micro" color={busy || rec.isRecording ? MINT : 'rgba(255,255,255,0.55)'}>{status}</T>
            </View>
          ),
        }}
      />

      <ScrollView
        ref={scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, gap: 12 }}
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {/* ก้อนแสงครูปัญญา: ใหญ่ตอนยังไม่คุย · เล็กติดด้านบนเมื่อเริ่มคุย — ตอบสนองเสียงพูด/ตอนคิด */}
        <View style={{ alignItems: 'center', paddingTop: msgs.length ? 0 : 12 }}>
          <AISphere size={msgs.length ? 90 : 190} active={busy || tts.speaking || rec.isRecording} level={(tts.speaking ? tts.level : rec.level) as any} />
        </View>
        {msgs.length === 0 && (
          <Animated.View entering={FadeIn.duration(300)}>
            <T v="h2" color="#FFFFFF" center style={{ marginTop: 8 }}>ถามอะไรก็ได้ครับ</T>
            <T v="callout" center color="rgba(255,255,255,0.6)" style={{ marginTop: 6, alignSelf: 'center', maxWidth: 300 }}>
              สมุนไพร ตำรับยา ธาตุเจ้าเรือน หรือความปลอดภัยของยา
            </T>
            <T v="subhead" color="rgba(255,255,255,0.5)" style={{ marginTop: 32, marginBottom: 10, marginLeft: 4 }}>คำถามแนะนำ</T>
            <View style={{ gap: 10 }}>
              {SUGGEST.map((s) => (
                <PressableScale key={s.q} haptic="select" scaleTo={0.98} onPress={() => send(s.q)} style={styles.suggest} accessibilityLabel={s.q}>
                  <View style={styles.suggestIcon}>
                    <Sym name={s.sym} size={17} color={MINT} />
                  </View>
                  <T v="body" color="#FFFFFF" style={{ flex: 1 }}>{s.q}</T>
                  <Sym name="arrow.up.right" size={13} color="rgba(255,255,255,0.4)" weight="semibold" />
                </PressableScale>
              ))}
            </View>
          </Animated.View>
        )}

        {msgs.map((m) =>
          m.role === 'user' ? (
            <Animated.View key={m.id} entering={FadeInUp.duration(220)} style={{ alignItems: 'flex-end' }}>
              <View style={[styles.bubble, styles.user]}>
                <T v="body" color={palette.white}>{m.content}</T>
              </View>
            </Animated.View>
          ) : (
            <Animated.View key={m.id} entering={FadeInUp.duration(220)} style={{ alignItems: 'flex-start' }}>
              <View style={[styles.bubble, styles.ai, m.failed && { backgroundColor: 'rgba(217,83,74,0.25)' }]}>
                <T v="body" color="#FFFFFF">{m.content}</T>
              </View>
              {!m.failed && (
                <PressableScale
                  haptic="select"
                  hitSlop={control.hitSlop}
                  onPress={() => {
                    if (speakingId === m.id) return tts.stop();
                    setSpeakingId(m.id);
                    tts.speak(m.content);
                  }}
                  style={styles.listen}
                >
                  <Sym name={speakingId === m.id ? 'stop.fill' : 'speaker.wave.2.fill'} size={17} color={MINT} />
                  <T v="caption" color={MINT} style={{ fontWeight: '600' }}>{speakingId === m.id ? 'หยุด' : 'ฟังคำตอบ'}</T>
                </PressableScale>
              )}
            </Animated.View>
          ),
        )}
        {busy && <Typing />}
      </ScrollView>

      {/* แถบแชทลอย — แคปซูล Liquid Glass ลอยเหนือเนื้อหา */}
      <View style={[styles.floatWrap, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
        <View onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
          <SoftShadow width={barW} height={barH} radius={barH / 2} blur={16} offsetY={6} />
          <Glass interactive style={styles.bar} tint="rgba(255,255,255,0.12)">
            <View onLayout={(e) => setBarH(e.nativeEvent.layout.height)} style={styles.barInner}>
              <PressableScale haptic="none" onPress={toggleMic} style={[styles.round, { backgroundColor: rec.isRecording ? palette.coral : 'rgba(124,240,168,0.16)' }]} accessibilityLabel={rec.isRecording ? 'หยุดพูด' : 'พูด'}>
                <Sym name={rec.isRecording ? 'stop.fill' : 'mic.fill'} size={20} color={rec.isRecording ? palette.white : MINT} />
              </PressableScale>
              {rec.isRecording ? (
                <View style={{ flex: 1, height: control.field, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }}>
                  <Waveform level={rec.level} bars={16} />
                </View>
              ) : (
                <TextInput value={text} onChangeText={setText} placeholder="ถามครูปัญญา" placeholderTextColor="rgba(255,255,255,0.4)" multiline style={styles.input} />
              )}
              <PressableScale haptic="press" onPress={() => send(text)} disabled={!text.trim()} accessibilityLabel="ส่ง" style={[styles.round, { backgroundColor: text.trim() ? palette.primary : 'transparent' }]}>
                <Sym name="arrow.up" size={20} color={text.trim() ? palette.white : 'rgba(255,255,255,0.35)'} weight="bold" />
              </PressableScale>
            </View>
          </Glass>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Dot({ d }: { d: number }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(d, withRepeat(withSequence(withTiming(-4, { duration: 280 }), withTiming(0, { duration: 280 })), -1));
  }, [d, y]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.6)' }, st]} />;
}
function Typing() {
  return (
    <Animated.View entering={FadeIn} style={[styles.bubble, styles.ai, { flexDirection: 'row', gap: 5, paddingVertical: 16, alignSelf: 'flex-start' }]}>
      <Dot d={0} />
      <Dot d={140} />
      <Dot d={280} />
    </Animated.View>
  );
}

/** ธีมมืดเหมือนหน้าโหมดเสียง (ก้อนแสง AI เด่นบนพื้นดำ) */
const DARK = '#000000';
const MINT = '#7CF0A8';

const styles = StyleSheet.create({
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderCurve: 'continuous' },
  user: { backgroundColor: palette.primary, borderBottomRightRadius: 6 },
  ai: { backgroundColor: 'rgba(255,255,255,0.1)', borderBottomLeftRadius: 6 },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 20, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)' },
  suggestIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(124,240,168,0.14)', alignItems: 'center', justifyContent: 'center' },
  listen: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, marginLeft: 6, height: 28 },
  round: { width: control.field, height: control.field, borderRadius: control.field / 2, alignItems: 'center', justifyContent: 'center' },
  floatWrap: { position: 'absolute', left: 12, right: 12, bottom: 0 },
  bar: { borderRadius: 30 },
  barInner: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, padding: 4 },
  input: { flex: 1, maxHeight: 120, fontSize: 17, color: '#FFFFFF', paddingTop: 11, paddingBottom: 11, paddingHorizontal: 4 },
});
