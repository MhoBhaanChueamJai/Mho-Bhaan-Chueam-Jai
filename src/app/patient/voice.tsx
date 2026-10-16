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
import Animated, { FadeIn, FadeInDown, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { synthesize, transcribe } from '../../api/ai';
import { useVoiceRecorder } from '../../components/audio';
import { Sym } from '../../components/ios';
import { AIFlower, AIGlow, Waveform } from '../../components/Orb';
import { Button, GlassCircle, GlassDock, PressableScale, T, useHaptic } from '../../components/ui';
import { OPENING, TOPICS, hasTopic, intakeTurn, setIntakeResult, type IntakeData, type Turn } from '../../lib/intake';
import { useApp } from '../../store/app';

type Phase = 'speaking' | 'listening' | 'thinking' | 'done';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function VoiceIntake() {
  const insets = useSafeAreaInsets();
  const { settings } = useApp();
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

  /** พูดแล้วรอจนจบ */
  const speak = (text: string) =>
    new Promise<void>(async (resolve) => {
      let finished = false;
      const end = () => {
        if (finished) return;
        finished = true;
        speakLevel.value = 0;
        player.current?.remove();
        player.current = null;
        resolve();
      };
      try {
        const uri = await synthesize(text.replace(/[•*#]/g, ' '), settings.voice);
        if (!alive.current) return end();
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
        const p = createAudioPlayer({ uri });
        player.current = p;
        p.addListener('playbackStatusUpdate', (s) => {
          speakLevel.value = s.playing ? 0.35 + Math.random() * 0.5 : 0;
          if (s.didJustFinish) end();
        });
        p.play();
        setTimeout(end, 30000); // กันค้าง
      } catch {
        end();
      }
    });

  /** ฟังคำตอบ: หยุดเองเมื่อพูดแล้วเงียบ ~1.3 วิ (หรือแตะปุ่มเพื่อส่ง) */
  const listen = async (): Promise<string> => {
    manualStop.current = false;
    try {
      await rec.start();
    } catch {
      return '';
    }
    let heard = false;
    let quiet = 0;
    const t0 = Date.now();
    while (alive.current && !manualStop.current) {
      await wait(120);
      const lv = rec.level.value;
      if (lv > 0.28) {
        heard = true;
        quiet = 0;
      } else if (heard) quiet += 120;
      if ((heard && quiet > 1300) || Date.now() - t0 > (heard ? 20000 : 9000)) break;
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
    return () => {
      alive.current = false;
      player.current?.remove();
      rec.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useData = () => {
    alive.current = false;
    setIntakeResult(dataRef.current);
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
        <GlassCircle label="ปิด" onPress={() => router.back()} tint="rgba(255,255,255,0.12)">
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
          <AIFlower size={190} active={phase !== 'done'} level={phase === 'listening' ? rec.level : speakLevel} />
        </PressableScale>
        <View style={styles.statusPill}>
          {phase === 'listening' ? <View style={styles.liveDot} /> : null}
          <T v="subhead" color="rgba(255,255,255,0.85)">{status}</T>
        </View>
        {phase === 'listening' ? (
          <View style={{ width: 180, marginTop: 10 }}>
            <Waveform level={rec.level} bars={20} />
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
