/**
 * โหมดเสียงครูปัญญา (ใช้ร่วม: ซักประวัติผู้ป่วยใหม่ / บันทึกการรักษา)
 * วงจร: ครูปัญญาพูดคำถาม → ฟังคำตอบ (หยุดเองเมื่อเงียบ) → ถอดเสียง → AI แยกข้อมูล + คิดคำถามถัดไป → วนจนครบ
 * ครบแล้ว: สรุป (+ ข้อความปิดท้าย) → ถามยืนยัน → ตอบใช้ = บันทึก
 * หน้าจอ: พื้นดำ ก้อนแสง AI ตอบสนองเสียง ชิปหัวข้อที่ได้แล้ว ปุ่มลอยด้านล่าง
 */
import { type AudioPlayer } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { TextInput } from './AppText';
import Animated, { Easing, FadeIn, FadeInDown, FadeInUp, FadeOutUp, useAnimatedKeyboard, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { transcribe } from '../api/ai';
import { useVoiceRecorder } from './audio';
import { createSpeech, type SpeechCtl } from './speech';
import { Sym } from './ios';
import { AISphere } from './AISphere';
import { AIGlow, Waveform } from './Orb';
import { Button, GlassCircle, PressableScale, T, useHaptic } from './ui';
import type { Turn } from '../lib/intake';
import { palette } from '../theme';
import { AiDownBanner } from './AiDownBanner';
import { COLUMN, column, useLayout } from './layout';

type Phase = 'speaking' | 'listening' | 'thinking' | 'done';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
export type VoiceData = Record<string, string | undefined>;
export type VoiceSessionProps = {
  title: string;
  opening: string;
  topics: { key: string; label: string }[];
  has: (d: VoiceData, key: string) => boolean;
  turn: (known: VoiceData, history: Turn[], answer: string) => Promise<{ data: VoiceData; reply: string; done: boolean; options?: string[] }>;
  /** ชิปตัวเลือกของคำถามแรก */
  initialOptions?: string[];
  /** โหมดฟังบทสนทนา (ในหน้าเดียวกัน): บทสนทนาที่ถอดได้ → ข้อมูลตามหัวข้อ */
  scribe?: (transcript: string) => Promise<VoiceData>;
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
  /** เปลี่ยนจากหน้าก่อนในหน้าเดียวกัน: ลูกแก้วเลื่อน/ขยายจากตำแหน่งเดิม (จุดกึ่งกลางบนจอ + ขนาด) มาที่ตำแหน่งใหม่ */
  morphFrom?: { x: number; y: number; size: number };
};

export function VoiceSession({ scribe, initialOptions, title, opening, topics, has, turn, closing, confirmQ, yesBye, noBye, noContinues, dockLabel, canUse, dockSaves, doneLabel, onFinish, morphFrom }: VoiceSessionProps) {
  // ── ลูกแก้วต่อเนื่องจากหน้าก่อน (ไม่เปิดหน้าใหม่ — ลูกแก้วเดิมเลื่อนลงมาเป็นลูกแก้วของการสนทนา) ──
  const orbRef = useRef<View>(null);
  const mTx = useSharedValue(0);
  const mTy = useSharedValue(0);
  const mSc = useSharedValue(1);
  const mOp = useSharedValue(morphFrom ? 0 : 1);
  const morphed = useRef(false);
  const orbMorph = useAnimatedStyle(() => ({ opacity: mOp.value, transform: [{ translateX: mTx.value }, { translateY: mTy.value }, { scale: mSc.value }] }));
  const startMorph = () => {
    if (!morphFrom || morphed.current) return;
    morphed.current = true;
    orbRef.current?.measureInWindow((x, y, w, hh) => {
      const ease = { duration: 620, easing: Easing.bezier(0.2, 0.8, 0.2, 1) };
      mTx.value = morphFrom.x - (x + w / 2);
      mTy.value = morphFrom.y - (y + hh / 2);
      mSc.value = morphFrom.size / Math.max(1, w);
      mOp.value = 1;
      mTx.value = withTiming(0, ease);
      mTy.value = withTiming(0, ease);
      mSc.value = withTiming(1, ease);
    });
  };
  const insets = useSafeAreaInsets();
  // จอกว้าง: แถบพิมพ์ แถบแจ้ง และป้ายแจ้งเตือน กว้างเท่าคอลัมน์อ่าน อยู่กึ่งกลาง
  const side = useLayout().side(COLUMN.read - 48, 24);
  const h = useHaptic();
  const rec = useVoiceRecorder();
  const [phase, setPhase] = useState<Phase>('speaking');
  const [aiText, setAiText] = useState(opening);
  const [userText, setUserText] = useState('');
  const [data, setData] = useState<VoiceData>({});
  const dataRef = useRef<VoiceData>({});
  const hist = useRef<Turn[]>([]);
  const alive = useRef(true);
  const loopGen = useRef(0);
  const resume = useRef<(() => void) | null>(null);
  const manualStop = useRef(false);
  // คำตอบที่พิมพ์ (ใช้แทนเสียงได้ทุกเมื่อ)
  const typed = useRef<string | null>(null);
  const stopSpeaking = useRef<(() => void) | null>(null);
  const [draft, setDraft] = useState('');
  // ชิปตัวเลือกคำตอบ (เลือกได้หลายข้อ)
  const [options, setOptions] = useState<string[]>(initialOptions ?? []);
  const [picked, setPicked] = useState<string[]>([]);
  const [kbOpen, setKbOpen] = useState(false);
  // Snackbar แจ้งสถานะข้อมูล (บันทึกหัวข้อไหน / แก้อะไร)
  const [snack, setSnack] = useState<{ id: number; icon: string; text: string } | null>(null);
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showSnack = (text: string, icon = 'checkmark.circle.fill') => {
    if (snackTimer.current) clearTimeout(snackTimer.current);
    setSnack({ id: Date.now(), icon, text });
    snackTimer.current = setTimeout(() => setSnack(null), 2800);
  };
  /** เทียบข้อมูลเก่า-ใหม่ แล้วแจ้งหัวข้อที่เพิ่ง ได้/แก้ */
  const announceChanges = (prev: VoiceData, next: VoiceData) => {
    const changed = topics.filter((t) => String(next[t.key] ?? '').trim() && String(next[t.key] ?? '').trim() !== String(prev[t.key] ?? '').trim());
    if (!changed.length) return;
    const short = (v: string) => (v.length > 34 ? `${v.slice(0, 34)}…` : v);
    if (changed.length === 1) {
      const t = changed[0];
      const wasSet = !!String(prev[t.key] ?? '').trim();
      showSnack(`${wasSet ? 'แก้' : 'บันทึก'}${t.label}: ${short(String(next[t.key]))}`, wasSet ? 'pencil.circle.fill' : 'checkmark.circle.fill');
    } else showSnack(`บันทึกแล้ว ${changed.length} หัวข้อ: ${changed.map((t) => t.label).join(', ')}`);
  };
  // โหมดฟังบทสนทนา: chat → scribe (อัดต่อเนื่อง) → analyzing → review (แก้ไขก่อนบันทึก)
  const [mode, setMode] = useState<'chat' | 'scribe' | 'analyzing' | 'review'>('chat');
  const [lines, setLines] = useState<string[]>([]);
  const linesRef = useRef<string[]>([]);
  linesRef.current = lines;
  const [pending, setPending] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [scribeErr, setScribeErr] = useState('');
  const scribing = useRef(false);
  const scribePause = useRef(false);
  const jobs = useRef<Promise<void>[]>([]);
  const kb = useAnimatedKeyboard();
  const dockLift = useAnimatedStyle(() => ({ transform: [{ translateY: -Math.max(0, kb.height.value - 16) }] }));
  const player = useRef<AudioPlayer | null>(null);
  const speakLevel = useSharedValue(0);
  // เสียงไมค์ (อัปเดตทุก 80ms) → ทำให้นุ่มก่อนส่งให้ดอกไม้
  const micLevel = useDerivedValue(() => withTiming(rec.level.value, { duration: 120 }));

  /** พูดแล้วรอจนจบ — แบ่งช่วงประโยค เตรียมช่วงถัดไปล่วงหน้า (ตอบยาวได้จนจบ ไม่ถูกตัด) */
  const speechRef = useRef<SpeechCtl | null>(null);
  if (!speechRef.current) speechRef.current = createSpeech(speakLevel);
  const speak = async (text: string) => {
    if (!alive.current) return;
    stopSpeaking.current = () => speechRef.current?.stop();
    await speechRef.current!.speak(text);
    stopSpeaking.current = null;
  };

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

  /** วงจรสนทนาถาม-ตอบ (เริ่มใหม่ได้เมื่อกลับจากโหมดฟังบทสนทนา/ตรวจทาน) */
  const runLoop = async (first: string) => {
      // วงจรใหม่แทนที่วงจรเก่า (กันสองวงจรฟังไมค์พร้อมกัน)
      const my = ++loopGen.current;
      const live = () => alive.current && my === loopGen.current;
      alive.current = true;
      manualStop.current = false;
      hist.current.push({ role: 'ai', text: first });
      setAiText(first);
      setUserText('');
      setPhase('speaking');
      await speak(first);
      let misses = 0;
      while (live()) {
        setPhase('listening');
        setUserText('');
        const ans = await listen();
        if (!live()) return;
        if (!ans) {
          misses += 1;
          if (misses > 2) {
            // ไม่ได้ยิน 3 ครั้ง → พักไว้ แตะลูกบอลหรือพิมพ์ตอบเพื่อคุยต่อ (ไม่ค้าง)
            setAiText('แตะที่ลูกบอลเพื่อพูดต่อ หรือพิมพ์ตอบด้านล่างได้เลยครับ');
            setPhase('done');
            await new Promise<void>((r) => (resume.current = r));
            resume.current = null;
            if (!live()) return;
            misses = 0;
            continue;
          }
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
        setOptions([]);
        setPicked([]);
        const r = await turn(dataRef.current, hist.current, ans);
        setOptions(r.options ?? []);
        if (!live()) return;
        announceChanges(dataRef.current, r.data);
        dataRef.current = r.data;
        setData(r.data);
        let reply = r.reply;
        if (r.done) {
          // ท้ายสุด: สรุปข้อมูล → ข้อความปิดท้าย → ไปหน้าตรวจทานก่อนบันทึก (ใช้ร่วมกับโหมดฟังบทสนทนา)
          const extra = closing?.(r.data);
          if (extra) reply = `${reply} ${extra}`;
          reply = `${reply} ตรวจทานข้อมูล แก้ไขได้ แล้วกดบันทึกได้เลยครับ`;
        }
        hist.current.push({ role: 'ai', text: reply });
        setAiText(reply);
        setPhase('speaking');
        h.select();
        await speak(reply);
        if (r.done) {
          if (!live()) return;
          setPhase('done');
          setOptions([]);
          h.success();
          setMode('review');
          return;
        }
      }
      if (my === loopGen.current) setPhase('done');
  };

  // เริ่มวงจรสนทนา
  useEffect(() => {
    hist.current = [];
    runLoop(opening);
    return () => {
      scribing.current = false;
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** หยุดทุกอย่างทันที (ปิดหน้า / ใช้ข้อมูล): เสียงที่กำลังพูด ไมค์ และวงจรสนทนา */
  const stopAll = () => {
    alive.current = false;
    speechRef.current?.stop();
    resume.current?.();
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

  const got = topics.filter((t) => has(data, t.key));
  /** แตะชิป: ใส่/เอาคำนั้นออกจากช่องพิมพ์ (คั่นด้วยจุลภาค) แล้วส่งจากช่องพิมพ์ */
  const togglePick = (o: string) => {
    const on = picked.includes(o);
    setPicked((x) => (on ? x.filter((y) => y !== o) : [...x, o]));
    setDraft((d) => {
      const parts = d.split(',').map((x) => x.trim()).filter(Boolean);
      const next = on ? parts.filter((x) => x !== o) : [...parts, o];
      return next.join(', ');
    });
  };

  /** ส่งคำตอบที่พิมพ์/เลือก: ถ้าครูปัญญากำลังพูดอยู่ ให้หยุดพูดแล้วใช้คำตอบนี้ทันที */
  const sendTyped = (text?: string) => {
    const t = (text ?? draft).trim();
    if (!t) return;
    h.press();
    typed.current = t;
    setDraft('');
    setPicked([]);
    try {
      player.current?.pause();
    } catch {}
    stopSpeaking.current?.();
    resume.current?.();
  };

  /** เข้าโหมดฟังบทสนทนา: หยุดถาม-ตอบ แล้วอัดเสียงต่อเนื่องเป็นช่วงละ 40 วิ ถอดเสียงไปพร้อมกัน */
  const startScribe = async () => {
    h.press();
    Keyboard.dismiss();
    stopAll();
    setMode('scribe');
    setLines([]);
    setElapsed(0);
    setScribeErr('');
    jobs.current = [];
    await wait(600); // ให้วงจรถาม-ตอบปล่อยไมค์ก่อน
    scribing.current = true;
    let idx = 0;
    let acc = 0;
    let last = Date.now();
    const tick = setInterval(() => {
      const now = Date.now();
      if (!scribePause.current) acc += now - last;
      last = now;
      setElapsed(Math.floor(acc / 1000));
      if (!scribing.current) clearInterval(tick);
    }, 500);
    while (scribing.current) {
      if (scribePause.current) {
        await wait(200);
        continue;
      }
      try {
        await rec.start();
      } catch {
        setScribeErr('เปิดไมโครโฟนไม่ได้');
        break;
      }
      const s0 = Date.now();
      while (scribing.current && !scribePause.current && Date.now() - s0 < 40_000) await wait(150);
      const uri = await rec.stop().catch(() => null);
      if (uri && Date.now() - s0 > 1200) {
        const i = idx++;
        setPending((n) => n + 1);
        jobs.current.push(
          transcribe(uri)
            .then((t) => {
              const text = t.trim();
              if (text) setLines((ls) => {
                const next = [...ls];
                next[i] = text;
                return next;
              });
            })
            .catch(() => {})
            .finally(() => setPending((n) => n - 1)),
        );
      }
    }
  };

  /** จบฟัง → รอถอดเสียงครบ → วิเคราะห์ลงหัวข้อ → ตรวจทานในหน้าเดิม */
  const finishScribe = async () => {
    if (!scribe) return;
    h.heavy();
    scribing.current = false;
    setMode('analyzing');
    await wait(400);
    await Promise.allSettled(jobs.current);
    const transcript = linesRef.current.filter(Boolean).join('\n');
    if (transcript.trim()) {
      try {
        const d = await scribe(transcript);
        const merged = { ...dataRef.current, ...d };
        announceChanges(dataRef.current, merged);
        dataRef.current = merged;
        setData(merged);
        h.success();
      } catch {
        setScribeErr('วิเคราะห์ไม่สำเร็จ กรอกหรือแก้ไขเองได้');
      }
    } else setScribeErr('ไม่ได้ยินบทสนทนา กรอกเองได้');
    setMode('review');
  };

  /** กลับไปโหมดถาม-ตอบ: หยุดฟัง/ปิดหน้าตรวจทาน แล้วคุยต่อจากหัวข้อที่ยังขาด */
  const backToChat = async () => {
    h.select();
    Keyboard.dismiss();
    scribing.current = false;
    scribePause.current = false;
    setPaused(false);
    await rec.stop().catch(() => {});
    await wait(500);
    setMode('chat');
    const missing = topics.find((t) => !has(dataRef.current, t.key));
    const first = missing ? `กลับมาคุยต่อนะครับ ขอถามเรื่อง${missing.label}ต่อเลยนะครับ` : 'กลับมาคุยต่อนะครับ ข้อมูลครบแล้ว อยากแก้หรือเพิ่มเรื่องไหน บอกได้เลยครับ';
    runLoop(first);
  };

  const setField = (k: string, v: string) => {
    const next = { ...dataRef.current, [k]: v };
    dataRef.current = next;
    setData(next);
  };

  const status = phase === 'speaking' ? 'ครูปัญญากำลังพูด' : phase === 'listening' ? 'กำลังฟัง… พูดได้เลย' : phase === 'thinking' ? 'กำลังคิด…' : doneLabel;

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <LinearGradient colors={['#000000', '#050B08', '#000000']} style={StyleSheet.absoluteFill} />
      <AIGlow active={phase === 'listening' || phase === 'speaking'} />
      <AiDownBanner dark style={{ position: 'absolute', top: insets.top + 64, left: side, right: side, zIndex: 5 }} />
      {/* แตะพื้นที่ว่างเพื่อปิดคีย์บอร์ด */}
      <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} accessible={false} />

      {/* หัว */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <GlassCircle label="ปิด" onPress={close} tint="rgba(255,255,255,0.12)">
          <Sym name="xmark" size={17} color="#FFFFFF" weight="semibold" />
        </GlassCircle>
        <T v="title" color="#FFFFFF">{mode === 'chat' ? title : mode === 'review' ? 'ตรวจทานก่อนบันทึก' : 'ฟังบทสนทนา'}</T>
        {scribe && mode === 'chat' ? (
          <GlassCircle label="ฟังบทสนทนา" onPress={startScribe} tint="rgba(255,255,255,0.12)">
            <Sym name="ear" size={19} color="#FFFFFF" />
          </GlassCircle>
        ) : mode === 'scribe' || mode === 'review' ? (
          // กลับโหมดถาม-ตอบเดิม
          <GlassCircle label="กลับโหมดถาม-ตอบ" onPress={backToChat} tint="rgba(255,255,255,0.12)">
            <Sym name="bubble.left.and.bubble.right.fill" size={17} color="#FFFFFF" />
          </GlassCircle>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      {/* Snackbar สถานะข้อมูล */}
      {snack ? (
        <Animated.View key={snack.id} entering={FadeInUp.duration(260)} exiting={FadeOutUp.duration(220)} style={[styles.snack, { top: insets.top + 64, left: side, right: side }]} pointerEvents="none">
          <Sym name={snack.icon as any} size={17} color="#7CF0A8" />
          <T v="subhead" color="#FFFFFF" numberOfLines={2} style={{ flex: 1 }}>{snack.text}</T>
        </Animated.View>
      ) : null}

      {mode === 'scribe' || mode === 'analyzing' ? (
        /* ── โหมดฟังบทสนทนา ── */
        <View style={styles.scribe}>
          <AISphere size={230} active={!paused} level={mode === 'scribe' && !paused ? (micLevel as any) : undefined} />
          <View style={styles.statusPill}>
            {mode === 'scribe' ? <View style={[styles.liveDot, paused && { backgroundColor: '#FFC24A' }]} /> : <ActivityIndicator size="small" color="#7CF0A8" />}
            <T v="subhead" color="rgba(255,255,255,0.85)">
              {mode === 'analyzing' ? 'ครูปัญญากำลังวิเคราะห์บทสนทนา…' : `${paused ? 'หยุดชั่วคราว' : 'กำลังฟังบทสนทนา'} · ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`}
            </T>
          </View>
          {mode === 'scribe' && !paused ? (
            <View style={{ width: 180, marginTop: 10 }}>
              <Waveform level={micLevel as any} bars={20} />
            </View>
          ) : null}
          <T v="caption" color="rgba(255,255,255,0.55)" center style={{ marginTop: 8, paddingHorizontal: 40 }}>คุยกับผู้ป่วยตามปกติ ครูปัญญาจะฟังแล้วจัดลงหัวข้อให้</T>
          {mode === 'analyzing' ? null : pending > 0 || lines.filter(Boolean).length ? (
            <T v="caption" color="rgba(255,255,255,0.45)" style={{ marginTop: 6 }}>ได้ยินบทสนทนาแล้ว {lines.filter(Boolean).length} ช่วง</T>
          ) : null}
        </View>
      ) : mode === 'review' ? (
        /* ── ตรวจทาน: แก้ เพิ่ม ลบ แต่ละหัวข้อ ก่อนบันทึก ── */
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={[{ padding: 20, paddingBottom: insets.bottom + 120, gap: 12 }, column.read]}>
          <T v="subhead" color="rgba(255,255,255,0.6)">{scribeErr || 'ตรวจทานข้อมูล แก้ เพิ่ม หรือลบได้ก่อนบันทึก'}</T>
          {topics.map((t, i) => {
            const v = String(data[t.key] ?? '');
            return (
              <Animated.View key={t.key} entering={FadeInDown.delay(i * 50).duration(350)} style={styles.field}>
                <View style={styles.fieldHead}>
                  <View style={[styles.fieldDot, { backgroundColor: v.trim() ? '#7CF0A8' : 'rgba(255,255,255,0.25)' }]} />
                  <T v="subhead" color="rgba(255,255,255,0.75)" style={{ flex: 1, fontWeight: '600' }}>{t.label}</T>
                  {v ? (
                    <PressableScale haptic="select" onPress={() => setField(t.key, '')} hitSlop={10} accessibilityLabel={`ลบ${t.label}`}>
                      <Sym name="xmark.circle.fill" size={18} color="rgba(255,255,255,0.4)" />
                    </PressableScale>
                  ) : null}
                </View>
                <TextInput value={v} onChangeText={(x) => setField(t.key, x)} placeholder={`เพิ่ม${t.label}`} placeholderTextColor="rgba(255,255,255,0.35)" multiline onFocus={() => setKbOpen(true)} onBlur={() => setKbOpen(false)} style={styles.fieldInput} accessibilityLabel={t.label} />
              </Animated.View>
            );
          })}
        </ScrollView>
      ) : (
      <>
      {/* ก้อนแสง AI ตอบสนองเสียง */}
      <View style={styles.center}>
        <Animated.View ref={orbRef} onLayout={startMorph} style={orbMorph}>
        <PressableScale
          scaleTo={0.95}
          onPress={() => {
            if (phase === 'listening') manualStop.current = true;
            else if (resume.current) resume.current();
          }}
          accessibilityLabel={phase === 'listening' ? 'ส่งคำตอบ' : 'ครูปัญญา'}
        >
          <AISphere size={options.length && phase !== 'done' ? 170 : 230} active={phase !== 'done'} level={(phase === 'listening' ? micLevel : speakLevel) as any} />
        </PressableScale>
        </Animated.View>
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
        {/* ชิปตัวเลือกคำตอบ: กดเลือกได้หลายข้อ แล้วส่ง */}
        {options.length && phase !== 'done' ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.optWrap}>
            <View style={styles.opts}>
              {options.map((o) => {
                const on = picked.includes(o);
                return (
                  <PressableScale key={o} haptic="select" scaleTo={0.95} onPress={() => togglePick(o)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={o}>
                    {/* ชิปมืด (กระจกระบบบนพื้นดำออกเป็นขาวฝ้า จึงใช้พื้นมืดโปร่งแทน) */}
                    <View style={[styles.opt, on && styles.optOn]}>
                      {on ? <Sym name="checkmark" size={12} color="#7CF0A8" weight="bold" /> : null}
                      <T v="subhead" color={on ? '#BFFFD6' : 'rgba(255,255,255,0.92)'} style={{ fontWeight: on ? '700' : '500' }}>{o}</T>
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </Animated.View>
        ) : null}
        {userText ? (
          <Animated.View entering={FadeIn.duration(250)} style={styles.userBubble}>
            <T v="callout" color="rgba(255,255,255,0.9)" center>“{userText}”</T>
          </Animated.View>
        ) : null}
      </View>

      {/* ข้อมูลที่ได้แล้ว */}
      {/* ความคืบหน้า: จุดตามจำนวนหัวข้อ (ได้ข้อมูลแล้ว = จุดเขียวยาว) */}
      {kbOpen ? null : (
        <View style={[styles.dots, { bottom: insets.bottom + (mode === 'chat' && got.length === topics.length ? 140 : 82) }]} accessibilityLabel={`ได้ข้อมูลแล้ว ${got.length} จาก ${topics.length} หัวข้อ`}>
          {topics.map((t) => {
            const ok = got.includes(t);
            return <View key={t.key} style={[styles.pDot, ok && styles.pDotOn]} />;
          })}
        </View>
      )}
      </>
      )}

      {/* แถบลอยยกขึ้นตามคีย์บอร์ด (ส่วนอื่นของหน้าอยู่ที่เดิม) */}
      <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, dockLift]}>
      {/* แถบมืด (กระจกสว่างบนพื้นดำทำให้ช่องพิมพ์มองไม่เห็น) */}
      <View style={[styles.darkDock, { bottom: insets.bottom ? 24 : 16, left: side, right: side }]}>
        {mode === 'scribe' ? (
          <View style={styles.scribeCtrls}>
            <PressableScale
              haptic="select"
              onPress={() => {
                scribePause.current = !scribePause.current;
                setPaused(scribePause.current);
              }}
              style={styles.ctrlSmall}
              accessibilityLabel={paused ? 'ฟังต่อ' : 'หยุดชั่วคราว'}
            >
              <Sym name={paused ? 'play.fill' : 'pause.fill'} size={19} color="#FFFFFF" />
            </PressableScale>
            <PressableScale haptic="press" onPress={finishScribe} style={styles.ctrlMain} accessibilityLabel="จบและวิเคราะห์">
              <Sym name="stop.fill" size={17} color="#04150E" />
              <T v="bodyStrong" color="#04150E">จบและวิเคราะห์</T>
            </PressableScale>
          </View>
        ) : mode === 'analyzing' ? (
          <View style={[styles.scribeCtrls, { justifyContent: 'center', height: 52 }]}>
            <ActivityIndicator color="#7CF0A8" />
          </View>
        ) : mode === 'review' ? (
          kbOpen ? null : <Button label={dockLabel(data, got.length, topics.length, true)} disabled={!got.length} onPress={() => finish(true)} style={{ height: 52 }} />
        ) : (
        <>
        {/* พิมพ์ตอบแทนการพูดได้ */}
        <View style={styles.typeRow}>
          <Sym name="keyboard" size={18} color="#8A928D" />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="พิมพ์ตอบได้ที่นี่"
            placeholderTextColor="#9AA19D"
            returnKeyType="send"
            onSubmitEditing={() => sendTyped()}
            onFocus={() => setKbOpen(true)}
            onBlur={() => setKbOpen(false)}
            style={styles.typeInput}
            accessibilityLabel="พิมพ์คำตอบ"
          />
          <PressableScale haptic="press" onPress={() => sendTyped()} disabled={!draft.trim()} style={[styles.send, { backgroundColor: draft.trim() ? palette.primary : 'transparent' }]} accessibilityLabel="ส่งคำตอบ">
            <Sym name="arrow.up" size={17} color={draft.trim() ? '#FFFFFF' : '#B5BBB7'} weight="bold" />
          </PressableScale>
        </View>
        </>
        )}
        {/* ปุ่มบันทึกแสดงเมื่อถามครบทุกหัวข้อแล้วเท่านั้น */}
        {mode === 'chat' && !kbOpen && got.length === topics.length ? (
          <Animated.View entering={FadeIn.duration(300)}>
            <Button
              label="ตรวจทานและบันทึก"
              disabled={!canUse(data)}
              onPress={() => {
                stopAll();
                setPhase('done');
                setMode('review');
              }}
              style={{ height: 52 }}
            />
          </Animated.View>
        ) : null}
      </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000000' },
  optWrap: { alignItems: 'center', marginTop: 16, paddingHorizontal: 20, gap: 12 },
  opts: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  optOn: { backgroundColor: 'rgba(124,240,168,0.16)', borderColor: '#7CF0A8' },
  scribe: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 140 },
  scribeCtrls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ctrlSmall: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  ctrlMain: { flex: 1, height: 52, borderRadius: 26, backgroundColor: '#7CF0A8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  field: { borderRadius: 20, borderCurve: 'continuous', padding: 14, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)' },
  fieldHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  fieldDot: { width: 8, height: 8, borderRadius: 4 },
  fieldInput: { fontSize: 17, lineHeight: 24, color: '#FFFFFF', minHeight: 26, padding: 0 },
  snack: { position: 'absolute', left: 20, right: 20, zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 18, borderCurve: 'continuous', backgroundColor: 'rgba(28,32,30,0.97)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(124,240,168,0.35)', boxShadow: '0px 8px 24px rgba(0,0,0,0.5)' },
  darkDock: { position: 'absolute', left: 24, right: 24, gap: 8, padding: 8, borderRadius: 32, borderCurve: 'continuous', backgroundColor: 'rgba(28,30,29,0.96)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.22)', boxShadow: '0px 10px 30px rgba(0,0,0,0.6)' },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 50, paddingLeft: 16, paddingRight: 6, borderRadius: 25, backgroundColor: '#FFFFFF' },
  typeInput: { flex: 1, fontSize: 17, color: '#1F2A24', height: '100%' },
  send: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  top: { ...column.read, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 190 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5A5A' },
  userBubble: { marginTop: 14, marginHorizontal: 32, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)' },
  dots: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  pDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.22)' },
  pDotOn: { width: 20, backgroundColor: '#7CF0A8' },
});
