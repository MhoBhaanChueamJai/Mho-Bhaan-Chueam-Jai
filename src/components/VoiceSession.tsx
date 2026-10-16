/**
 * โหมดเสียงครูปัญญา (ใช้ร่วม: ซักประวัติผู้ป่วยใหม่ / บันทึกการรักษา)
 * วงจร: ครูปัญญาพูดคำถาม → ฟังคำตอบ (หยุดเองเมื่อเงียบ) → ถอดเสียง → AI แยกข้อมูล + คิดคำถามถัดไป → วนจนครบ
 * ครบแล้ว: สรุป (+ ข้อความปิดท้าย) → ถามยืนยัน → ตอบใช้ = บันทึก
 * หน้าจอ: พื้นดำ ก้อนแสง AI ตอบสนองเสียง ชิปหัวข้อที่ได้แล้ว ปุ่มลอยด้านล่าง
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedKeyboard, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { synthesize, transcribe } from '../api/ai';
import { rmsLevel, useVoiceRecorder } from './audio';
import { Sym } from './ios';
import { AISphere } from './AISphere';
import { AIGlow, Waveform } from './Orb';
import { Button, GlassCircle, GlassDock, PressableScale, T, useHaptic } from './ui';
import { isYes, type Turn } from '../lib/intake';
import { palette } from '../theme';

type Phase = 'speaking' | 'listening' | 'thinking' | 'done';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
export type VoiceData = Record<string, string | undefined>;
export type VoiceSessionProps = {
  title: string;
  opening: string;
  topics: { key: string; label: string }[];
  has: (d: VoiceData, key: string) => boolean;
  turn: (known: VoiceData, history: Turn[], answer: string) => Promise<{ data: VoiceData; reply: string; done: boolean }>;
  /** ข้อความเพิ่มท้ายสรุป ก่อนถามยืนยัน (เช่น วิเคราะห์ธาตุ) */
  closing?: (d: VoiceData) => string;
  confirmQ: string;
  yesBye: string;
  noBye: string;
  /** ตอบ "ไม่" แล้วคุยต่อเพื่อแก้ไข (แทนการปิดหน้า) */
  noContinues?: boolean;
  dockLabel: (d: VoiceData, got: number, total: number, done: boolean) => string;
  canUse: (d: VoiceData) => boolean;
  /** ปุ่มลอยกด = บันทึกเลยหรือไม่ */
  dockSaves?: boolean;
  doneLabel: string;
  onFinish: (d: VoiceData, save: boolean) => void;
};

export function VoiceSession({ title, opening, topics, has, turn, closing, confirmQ, yesBye, noBye, noContinues, dockLabel, canUse, dockSaves, doneLabel, onFinish }: VoiceSessionProps) {
  const insets = useSafeAreaInsets();
  const h = useHaptic();
  const rec = useVoiceRecorder();
  const [phase, setPhase] = useState<Phase>('speaking');
  const [aiText, setAiText] = useState(opening);
  const [userText, setUserText] = useState('');
  const [data, setData] = useState<VoiceData>({});
  const dataRef = useRef<VoiceData>({});
  const hist = useRef<Turn[]>([]);
  const alive = useRef(true);
  const manualStop = useRef(false);
  // คำตอบที่พิมพ์ (ใช้แทนเสียงได้ทุกเมื่อ)
  const typed = useRef<string | null>(null);
  const stopSpeaking = useRef<(() => void) | null>(null);
  const [draft, setDraft] = useState('');
  const [kbOpen, setKbOpen] = useState(false);
  const kb = useAnimatedKeyboard();
  const dockLift = useAnimatedStyle(() => ({ transform: [{ translateY: -Math.max(0, kb.height.value - 16) }] }));
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
        stopSpeaking.current = null;
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
        stopSpeaking.current = end;
        // แสงตอบสนองระดับเสียงจริงของครูปัญญา (RMS จากคลื่นเสียง)
        let lastSample = 0;
        try {
          p.setAudioSamplingEnabled(true);
          p.addListener('audioSampleUpdate', (sm) => {
            lastSample = Date.now();
            speakLevel.value = withTiming(Math.min(1, rmsLevel(sm.channels[0]?.frames) * 1.3), { duration: 80 });
          });
        } catch {}
        // สำรอง: ถ้าไม่ได้ค่าคลื่นเสียง (เช่นไฟล์ MP3) → จำลองจังหวะพูดเป็นพยางค์ ตลอดช่วงที่กำลังพูด
        const t0 = Date.now();
        const sim = setInterval(() => {
          if (finished) return clearInterval(sim);
          if (Date.now() - lastSample < 300) return;
          const tt = (Date.now() - t0) / 1000;
          const syl = Math.abs(Math.sin(tt * 7.3)) * (0.55 + 0.45 * Math.sin(tt * 1.9 + 1));
          speakLevel.value = withTiming(0.25 + syl * 0.6, { duration: 90 });
        }, 90);
        p.addListener('playbackStatusUpdate', (s) => {
          if (s.didJustFinish) {
            clearInterval(sim);
            end();
          }
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
    const takeTyped = () => {
      const t = typed.current;
      typed.current = null;
      return t;
    };
    const pre = takeTyped();
    if (pre) return pre;
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
    while (alive.current && !manualStop.current && !typed.current) {
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
    // พิมพ์ตอบระหว่างฟัง → ใช้ข้อความที่พิมพ์
    const tt = takeTyped();
    if (tt) return tt;
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
      hist.current = [{ role: 'ai', text: opening }];
      await speak(opening);
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
        const r = await turn(dataRef.current, hist.current, ans);
        if (!alive.current) return;
        dataRef.current = r.data;
        setData(r.data);
        let reply = r.reply;
        if (r.done) {
          // ท้ายสุด: สรุปข้อมูล → ข้อความปิดท้าย → ถามยืนยันบันทึก
          const extra = closing?.(r.data);
          if (extra) reply = `${reply} ${extra}`;
          reply = `${reply} ${confirmQ}`;
        }
        hist.current.push({ role: 'ai', text: reply });
        setAiText(reply);
        setPhase('speaking');
        h.select();
        await speak(reply);
        if (r.done) {
          // ฟังคำยืนยัน: ใช้ → บันทึกเลย · ไม่ → ใส่ข้อมูลในฟอร์มให้แก้ต่อ
          setPhase('listening');
          setUserText('');
          const yes = await listen();
          if (!alive.current) return;
          if (yes) setUserText(yes);
          const ok = !!yes && isYes(yes);
          if (!ok && noContinues) {
            // ยังไม่บันทึก → คุยต่อเพื่อแก้ไข
            const fix = 'ได้ครับ อยากแก้ข้อไหน บอกผมได้เลยครับ';
            hist.current.push({ role: 'ai', text: fix });
            setAiText(fix);
            setPhase('speaking');
            await speak(fix);
            continue;
          }
          const bye = ok ? yesBye : noBye;
          setAiText(bye);
          setPhase('speaking');
          await speak(bye);
          if (!alive.current) return;
          setPhase('done');
          h.success();
          finish(ok);
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

  /** จบ: หยุดทุกอย่าง แล้วให้หน้าที่เรียกจัดการ (บันทึก / ส่งกลับฟอร์ม / ปิดหน้า) */
  const finish = (save: boolean) => {
    stopAll();
    onFinish({ ...dataRef.current }, save);
  };
  const useData = () => {
    h.success();
    finish(!!dockSaves);
  };

  const got = topics.filter((t) => has(data, t.key));
  /** ส่งคำตอบที่พิมพ์: ถ้าครูปัญญากำลังพูดอยู่ ให้หยุดพูดแล้วใช้คำตอบนี้ทันที */
  const sendTyped = () => {
    const t = draft.trim();
    if (!t) return;
    h.press();
    typed.current = t;
    setDraft('');
    try {
      player.current?.pause();
    } catch {}
    stopSpeaking.current?.();
  };

  const status = phase === 'speaking' ? 'ครูปัญญากำลังพูด' : phase === 'listening' ? 'กำลังฟัง… พูดได้เลย' : phase === 'thinking' ? 'กำลังคิด…' : doneLabel;

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <LinearGradient colors={['#000000', '#050B08', '#000000']} style={StyleSheet.absoluteFill} />
      <AIGlow active={phase === 'listening' || phase === 'speaking'} />

      {/* หัว */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <GlassCircle label="ปิด" onPress={close} tint="rgba(255,255,255,0.12)">
          <Sym name="xmark" size={17} color="#FFFFFF" weight="semibold" />
        </GlassCircle>
        <T v="title" color="#FFFFFF">{title}</T>
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
          <AISphere size={230} active={phase !== 'done'} level={(phase === 'listening' ? micLevel : speakLevel) as any} />
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

        <Animated.View key={aiText} entering={FadeInDown.duration(320)} style={{ paddingHorizontal: 36, marginTop: 18 }}>
          <T v="body" color="rgba(255,255,255,0.9)" center>{aiText}</T>
        </Animated.View>
        {userText ? (
          <Animated.View entering={FadeIn.duration(250)} style={styles.userBubble}>
            <T v="callout" color="rgba(255,255,255,0.9)" center>“{userText}”</T>
          </Animated.View>
        ) : null}
      </View>

      {/* ข้อมูลที่ได้แล้ว */}
      {kbOpen ? null : <View style={[styles.chips, { bottom: insets.bottom + (got.length === topics.length ? 170 : 110) }]}>
        {topics.map((t) => {
          const ok = got.includes(t);
          return (
            <View key={t.key} style={[styles.chip, ok && styles.chipOk]}>
              {ok ? <Sym name="checkmark" size={11} color="#04150E" weight="bold" /> : null}
              <T v="caption" color={ok ? '#04150E' : 'rgba(255,255,255,0.55)'} style={{ fontWeight: ok ? '700' : '400' }}>{t.label}</T>
            </View>
          );
        })}
      </View>}

      {/* แถบลอยยกขึ้นตามคีย์บอร์ด (ส่วนอื่นของหน้าอยู่ที่เดิม) */}
      <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, dockLift]}>
      <GlassDock style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        {/* พิมพ์ตอบแทนการพูดได้ */}
        <View style={styles.typeRow}>
          <Sym name="keyboard" size={17} color="rgba(255,255,255,0.55)" />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="พิมพ์ตอบได้ที่นี่"
            placeholderTextColor="rgba(255,255,255,0.4)"
            returnKeyType="send"
            onSubmitEditing={sendTyped}
            onFocus={() => setKbOpen(true)}
            onBlur={() => setKbOpen(false)}
            style={styles.typeInput}
            accessibilityLabel="พิมพ์คำตอบ"
          />
          <PressableScale haptic="press" onPress={sendTyped} disabled={!draft.trim()} style={[styles.send, { backgroundColor: draft.trim() ? palette.primary : 'transparent' }]} accessibilityLabel="ส่งคำตอบ">
            <Sym name="arrow.up" size={17} color={draft.trim() ? '#FFFFFF' : 'rgba(255,255,255,0.35)'} weight="bold" />
          </PressableScale>
        </View>
        {/* ปุ่มบันทึกแสดงเมื่อถามครบทุกหัวข้อแล้วเท่านั้น */}
        {!kbOpen && got.length === topics.length ? (
          <Animated.View entering={FadeIn.duration(300)}>
            <Button label={dockLabel(data, got.length, topics.length, phase === 'done')} disabled={!canUse(data)} onPress={useData} style={{ height: 52 }} />
          </Animated.View>
        ) : null}
      </GlassDock>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000000' },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingLeft: 14, paddingRight: 4, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.08)' },
  typeInput: { flex: 1, fontSize: 17, color: '#FFFFFF', height: '100%' },
  send: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 230 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5A5A' },
  userBubble: { marginTop: 14, marginHorizontal: 32, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)' },
  chips: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  chipOk: { backgroundColor: '#7CF0A8' },
});
