/**
 * ครูปัญญาซักประวัติ — โหมดเสียงเต็มจอ (เปิดจากปุ่มไมค์ในหน้าเพิ่มผู้ป่วย)
 * วงจร: ครูปัญญาพูดคำถาม → ฟังคำตอบ (หยุดเองเมื่อเงียบ) → ถอดเสียง → AI แยกข้อมูล + คิดคำถามถัดไป → วนจนครบ
 * กด "ใช้ข้อมูลนี้" เมื่อไหร่ก็ได้ → ปิดหน้าแล้วเติมข้อมูลลงฟอร์ม
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { synthesize, transcribe } from '../../api/ai';
import { rmsLevel, useVoiceRecorder } from '../../components/audio';
import { Sym } from '../../components/ios';
import { AIFlower, AIGlow, Waveform } from '../../components/Orb';
import { Button, GlassCircle, GlassDock, PressableScale, T, useHaptic } from '../../components/ui';
import { OPENING, TOPICS, hasTopic, intakeTurn, setIntakeResult, type IntakeData, type Turn } from '../../lib/intake';

type Phase = 'speaking' | 'listening' | 'thinking' | 'done';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function VoiceIntake() {
  const insets = useSafeAreaInsets();
  const h = useHaptic();
  const rec = useVoiceRecorder();
  const [phase, setPhase] = useState<Phase>('speaking');
  const [aiText, setAiText] = useState(OPENING);
  const [userText, setUserText] = useState('');
  const [data, setData] = useState<IntakeData>({});
  const dataRef = useRef<IntakeData>({});
  const hist = useRef<Turn[]>([]);
  const alive = useRef(true);
  const manualStop = useRef(false);
  const player = useRef<AudioPlayer | null>(null);
  const speakLevel = useSharedValue(0);
  // เสียงไมค์ (อัปเดตทุก 80ms) → ทำให้นุ่มก่อนส่งให้ดอกไม้
  const micLevel = useDerivedValue(() => withTiming(rec.level.value, { duration: 120 }));

  /** พูดแล้วรอจนจบ */
  const speak = (text: string) =>
    new Promise<void>(async (resolve) => {
      let finished = false;
      const end = () => {
        if (finished) return;
        finished = true;
        speakLevel.value = withTiming(0, { duration: 250 });
        try {
          player.current?.pause();
          player.current?.remove();
        } catch {}
        player.current = null;
        resolve();
      };
      try {
        const uri = await synthesize(text);
        if (!alive.current) return end();
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
        // ปิดหน้าไประหว่างรอ → ไม่สร้างตัวเล่นเสียง
        if (!alive.current) return end();
        const p = createAudioPlayer({ uri });
        player.current = p;
        // ดอกไม้ขยับตามระดับเสียงจริงของครูปัญญา (RMS จากคลื่นเสียง) แบบนุ่มนวล
        try {
          p.setAudioSamplingEnabled(true);
          p.addListener('audioSampleUpdate', (sm) => {
            speakLevel.value = withTiming(rmsLevel(sm.channels[0]?.frames), { duration: 90 });
          });
        } catch {}
        p.addListener('playbackStatusUpdate', (s) => {
          if (s.didJustFinish) end();
        });
        p.play();
        setTimeout(end, 30000); // กันค้าง
      } catch {
        end();
      }
    });

  /**
   * ฟังคำตอบ (VAD แบบปรับตามห้อง):
   * 1) รอ 0.3 วิ ให้เสียงครูปัญญาหายจากห้อง แล้ววัดเสียงพื้นหลัง 0.5 วิ
   * 2) นับว่า "เริ่มพูด" เมื่อเสียงดังกว่าพื้นหลังชัดเจนต่อเนื่อง ≥ 0.25 วิ
   * 3) จบเมื่อเงียบลงใกล้ระดับพื้นหลังต่อเนื่อง 1.4 วิ (หรือแตะดอกไม้เพื่อส่ง)
   */
  const listen = async (): Promise<string> => {
    manualStop.current = false;
    await wait(300);
    try {
      await rec.start();
    } catch {
      return '';
    }
    const TICK = 80;
    // วัดเสียงพื้นหลัง
    let floor = 0;
    let n = 0;
    for (let i = 0; i < 6 && alive.current; i++) {
      await wait(TICK);
      floor += rec.level.value;
      n++;
    }
    floor = n ? floor / n : 0;
    const speakTh = Math.min(0.9, floor + 0.14);
    const quietTh = Math.min(0.85, floor + 0.07);
    let loud = 0;
    let heard = false;
    let quiet = 0;
    const t0 = Date.now();
    while (alive.current && !manualStop.current) {
      await wait(TICK);
      const lv = rec.level.value;
      if (lv > speakTh) {
        loud += TICK;
        if (loud >= 250) heard = true;
        quiet = 0;
      } else {
        loud = 0;
        if (heard && lv < quietTh) quiet += TICK;
        else if (heard) quiet = Math.max(0, quiet - TICK / 2);
      }
      if (heard && quiet >= 1400) break;
      if (Date.now() - t0 > (heard ? 25000 : 10000)) break;
    }
    const uri = await rec.stop().catch(() => null);
    if (!alive.current || !uri || (!heard && !manualStop.current)) return '';
    try {
      return (await transcribe(uri)).trim();
    } catch {
      return '';
    }
  };

  // วงจรสนทนา
  useEffect(() => {
    alive.current = true;
    (async () => {
      hist.current = [{ role: 'ai', text: OPENING }];
      await speak(OPENING);
      let misses = 0;
      while (alive.current) {
        setPhase('listening');
        setUserText('');
        const ans = await listen();
        if (!alive.current) return;
        if (!ans) {
          misses += 1;
          if (misses > 2) break;
          const again = 'ขอโทษครับ ไม่ได้ยินชัด ช่วยพูดอีกครั้งนะครับ';
          setAiText(again);
          setPhase('speaking');
          await speak(again);
          continue;
        }
        misses = 0;
        setUserText(ans);
        hist.current.push({ role: 'user', text: ans });
        setPhase('thinking');
        const r = await intakeTurn(dataRef.current, hist.current, ans);
        if (!alive.current) return;
        dataRef.current = r.data;
        setData(r.data);
        hist.current.push({ role: 'ai', text: r.reply });
        setAiText(r.reply);
        setPhase('speaking');
        h.select();
        await speak(r.reply);
        if (r.done) {
          setPhase('done');
          h.success();
          return;
        }
      }
      setPhase('done');
    })();
    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** หยุดทุกอย่างทันที (ปิดหน้า / ใช้ข้อมูล): เสียงที่กำลังพูด ไมค์ และวงจรสนทนา */
  const stopAll = () => {
    alive.current = false;
    manualStop.current = true;
    try {
      player.current?.pause();
      player.current?.remove();
    } catch {}
    player.current = null;
    speakLevel.value = 0;
    rec.stop().catch(() => {});
  };

  const close = () => {
    stopAll();
    router.back();
  };

  const useData = () => {
    stopAll();
    setIntakeResult({ ...dataRef.current });
    h.success();
    router.back();
  };

  const got = TOPICS.filter((t) => hasTopic(data, t.key));
  const status = phase === 'speaking' ? 'ครูปัญญากำลังพูด' : phase === 'listening' ? 'กำลังฟัง… พูดได้เลย' : phase === 'thinking' ? 'กำลังคิด…' : 'ซักประวัติเสร็จแล้ว';

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <LinearGradient colors={['#04150E', '#0B3B28', '#062218']} style={StyleSheet.absoluteFill} />
      <AIGlow active={phase === 'listening' || phase === 'speaking'} />

      {/* หัว */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <GlassCircle label="ปิด" onPress={close} tint="rgba(255,255,255,0.12)">
          <Sym name="xmark" size={17} color="#FFFFFF" weight="semibold" />
        </GlassCircle>
        <T v="title" color="#FFFFFF">ครูปัญญาซักประวัติ</T>
        <View style={{ width: 44 }} />
      </View>

      {/* ดอกไม้ AI ตอบสนองเสียง */}
      <View style={styles.center}>
        <PressableScale
          scaleTo={0.95}
          onPress={() => {
            if (phase === 'listening') manualStop.current = true;
          }}
          accessibilityLabel={phase === 'listening' ? 'ส่งคำตอบ' : 'ครูปัญญา'}
        >
          <AIFlower size={190} active={phase !== 'done'} level={(phase === 'listening' ? micLevel : speakLevel) as any} />
        </PressableScale>
        <View style={styles.statusPill}>
          {phase === 'listening' ? <View style={styles.liveDot} /> : null}
          <T v="subhead" color="rgba(255,255,255,0.85)">{status}</T>
        </View>
        {phase === 'listening' ? (
          <View style={{ width: 180, marginTop: 10 }}>
            <Waveform level={micLevel as any} bars={20} />
          </View>
        ) : null}

        <Animated.View key={aiText} entering={FadeInDown.duration(320)} style={{ paddingHorizontal: 28, marginTop: 22 }}>
          <T v="h2" color="#FFFFFF" center>{aiText}</T>
        </Animated.View>
        {userText ? (
          <Animated.View entering={FadeIn.duration(250)} style={styles.userBubble}>
            <T v="callout" color="rgba(255,255,255,0.9)" center>“{userText}”</T>
          </Animated.View>
        ) : null}
      </View>

      {/* ข้อมูลที่ได้แล้ว */}
      <View style={[styles.chips, { bottom: insets.bottom + 100 }]}>
        {TOPICS.map((t) => {
          const ok = got.includes(t);
          return (
            <View key={t.key} style={[styles.chip, ok && styles.chipOk]}>
              {ok ? <Sym name="checkmark" size={11} color="#04150E" weight="bold" /> : null}
              <T v="caption" color={ok ? '#04150E' : 'rgba(255,255,255,0.55)'} style={{ fontWeight: ok ? '700' : '400' }}>{t.label}</T>
            </View>
          );
        })}
      </View>

      <GlassDock>
        <Button label={phase === 'done' ? 'ใช้ข้อมูลนี้' : `ใช้ข้อมูลนี้ (${got.length}/${TOPICS.length})`} disabled={!data.name} onPress={useData} style={{ flex: 1, height: 52 }} />
      </GlassDock>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#04150E' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 160 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5A5A' },
  userBubble: { marginTop: 14, marginHorizontal: 32, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)' },
  chips: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  chipOk: { backgroundColor: '#7CF0A8' },
});
