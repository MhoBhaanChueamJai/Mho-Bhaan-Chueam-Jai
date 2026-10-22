/**
 * โหมดเล่า — หมอเล่าภูมิปัญญาให้ครูปัญญาฟังแบบต่อเนื่อง (เหมือนเล่าให้ลูกหลานฟัง)
 * 1) อัดเสียงต่อเนื่อง ตัดเป็นช่วงละ ~40 วินาที ถอดข้อความไปพร้อมกัน (เห็นคำบรรยายสด)
 * 2) เก็บไฟล์เสียงต้นฉบับทุกช่วงไว้กับตำรา (ฟังเสียงหมอย้อนหลังได้)
 * 3) จบการเล่า → ครูปัญญาตรวจว่ายังขาดเรื่องไหน (เล่าเพิ่มได้) → เรียบเรียงเป็นหนังสือ → หน้าสรุปก่อนบันทึก
 */
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Alert } from '../../lib/alert';
import Animated, { FadeIn, FadeInDown, FadeInUp, LinearTransition, useDerivedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chatJSON, transcribe } from '../../api/ai';
import { AISphere } from '../../components/AISphere';
import { useVoiceRecorder } from '../../components/audio';
import { Sym } from '../../components/ios';
import { Waveform } from '../../components/Orb';
import { useOrbMorph, type OrbFrom } from '../../components/orbMorph';
import { GlassCircle, PressableScale, T, useHaptic } from '../../components/ui';
import type { Wisdom, WisdomAudio } from '../../data/mock';
import { dialectHint } from '../../lib/dialect';
import { clock, keepClip, removeClips } from '../../lib/wisdomAudio';
import { organizeWisdom } from '../../lib/wisdomOrganize';
import { KINDS, setWisdomResult } from '../../lib/wisdomTalk';
import { column } from '../../components/layout';
import { userNoun } from '../../lib/roles';

const MINT = '#7CF0A8';
const CHUNK_MS = 40_000;

/** หัวข้อที่ควรเล่าของแต่ละประเภท (ครูปัญญาใช้ตรวจว่ายังขาดเรื่องไหน) */
const TOPICS: Record<Wisdom['kind'], string[]> = {
  ตำรับยา: ['ชื่อตำรับ', 'ใช้แก้อาการอะไร', 'ตัวยาและปริมาณ', 'วิธีปรุงยา', 'วิธีใช้และขนาดยา', 'ข้อห้ามข้อควรระวัง', 'ได้รับสืบทอดจากใคร'],
  วิธีรักษา: ['ชื่อวิธีรักษา', 'ใช้รักษาอาการอะไร', 'อุปกรณ์และสมุนไพรที่ใช้', 'ขั้นตอนการรักษา', 'ข้อห้ามข้อควรระวัง', 'ได้รับสืบทอดจากใคร'],
  'คาถา/พิธี': ['ชื่อคาถาหรือพิธี', 'ใช้ในโอกาสใด', 'บทคาถา', 'เครื่องประกอบพิธีและขั้นตอน', 'ข้อห้ามข้อปฏิบัติ', 'ได้รับสืบทอดจากใคร'],
  ตำราโบราณ: ['ชื่อตำรา', 'เนื้อหาในตำรา', 'ความหมาย/ถอดความ', 'ที่มาของตำรา'],
};
const TIPS = ['ชื่อตำรับหรือวิธีรักษา', 'ใช้แก้อาการอะไร', 'ตัวยา ปริมาณ วิธีปรุง', 'วิธีใช้ ข้อห้าม', 'ได้รับสืบทอดมาจากใคร'];

type Phase = 'ready' | 'recording' | 'paused' | 'checking' | 'missing' | 'writing';
type Piece = { n: number; text: string; status: 'wait' | 'ok' | 'fail' };
type Check = { kind: Wisdom['kind']; title: string; indication: string; missing: string[] };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function TellWisdom() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  return <TellView from={from} />;
}

/** โหมดเล่า — ใช้ได้ทั้งเป็นหน้าเอง และต่อจากหน้าเพิ่มภูมิปัญญาในหน้าเดียวกัน (ลูกแก้วเลื่อนต่อ) */
export function TellView({ from, morphFrom }: { from?: string; morphFrom?: OrbFrom }) {
  const orb = useOrbMorph(morphFrom);
  const insets = useSafeAreaInsets();
  const h = useHaptic();
  const rec = useVoiceRecorder();
  const [phase, setPhase] = useState<Phase>('ready');
  const [pieces, setPieces] = useState<Piece[]>([]);
  const piecesRef = useRef<Piece[]>([]);
  const upd = (fn: (p: Piece[]) => Piece[]) => {
    piecesRef.current = fn(piecesRef.current);
    if (alive.current) setPieces(piecesRef.current);
  };
  const [elapsed, setElapsed] = useState(0);
  const [check, setCheck] = useState<Check | null>(null);
  const [err, setErr] = useState('');
  const session = useRef(`t${Date.now()}`);
  const clips = useRef<WisdomAudio[]>([]);
  const jobs = useRef<Promise<void>[]>([]);
  const n = useRef(0);
  const recording = useRef(false);
  const rotating = useRef(false);
  const chunkStart = useRef(0);
  const acc = useRef(0); // เวลาที่อัดแล้วก่อนช่วงปัจจุบัน (ms)
  const alive = useRef(true);
  const scroll = useRef<ScrollView>(null);
  const micLevel = useDerivedValue(() => withTiming(rec.level.value, { duration: 120 }));

  useEffect(
    () => () => {
      alive.current = false;
      recording.current = false;
      rec.stop().catch(() => {});
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // นาฬิกา + ตัดช่วงทุก ~40 วินาที (ถอดข้อความระหว่างที่ยังเล่าต่อได้)
  useEffect(() => {
    if (phase !== 'recording') return;
    const t = setInterval(() => {
      const cur = Date.now() - chunkStart.current;
      setElapsed(Math.floor((acc.current + cur) / 1000));
      if (cur > CHUNK_MS) rotate(true);
    }, 300);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startChunk = async () => {
    await rec.start();
    chunkStart.current = Date.now();
  };

  /** ปิดช่วงที่กำลังอัด → เก็บไฟล์ + ส่งถอดข้อความ · again = อัดช่วงต่อไปทันที */
  const rotate = async (again: boolean) => {
    if (rotating.current) return;
    rotating.current = true;
    try {
      const dur = Date.now() - chunkStart.current;
      const uri = await rec.stop().catch(() => null);
      acc.current += dur;
      if (again && recording.current && alive.current) await startChunk().catch(() => {});
      if (uri && dur > 1500) {
        const i = n.current++;
        const kept = keepClip(uri, session.current, i);
        if (kept) clips.current.push(kept);
        upd((p) => [...p, { n: i, text: '', status: 'wait' }]);
        const job = transcribe(kept?.uri ?? uri)
          .then((text) => {
            if (!alive.current) return;
            upd((p) => p.map((x) => (x.n === i ? { ...x, text: text.trim(), status: text.trim() ? 'ok' : 'fail' } : x)));
            setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
          })
          .catch(() => {
            if (alive.current) upd((p) => p.map((x) => (x.n === i ? { ...x, status: 'fail' } : x)));
          });
        jobs.current.push(job);
      }
    } finally {
      rotating.current = false;
    }
  };

  const start = async () => {
    h.press();
    setErr('');
    try {
      await startChunk();
      recording.current = true;
      setPhase('recording');
    } catch {
      Alert.alert('เปิดไมค์ไม่ได้', 'อนุญาตให้แอปใช้ไมโครโฟนในการตั้งค่าของเครื่องก่อนนะครับ');
    }
  };
  const pause = async () => {
    h.select();
    recording.current = false;
    setPhase('paused');
    await rotate(false);
  };
  const resume = async () => {
    h.select();
    try {
      await startChunk();
      recording.current = true;
      setPhase('recording');
    } catch {}
  };

  /** ข้อความที่ถอดได้ทั้งหมด (รอช่วงที่ยังถอดไม่เสร็จ) */
  const transcript = async () => {
    await Promise.all(jobs.current);
    await wait(50);
    return piecesRef.current
      .filter((x) => x.status === 'ok')
      .sort((a, b) => a.n - b.n)
      .map((x) => x.text)
      .join('\n\n');
  };

  /** จบการเล่า → ครูปัญญาตรวจว่าครบไหม */
  const finish = async () => {
    h.heavy();
    recording.current = false;
    setPhase('checking');
    await rotate(false);
    const text = await transcript();
    if (!alive.current) return;
    if (text.replace(/\s/g, '').length < 20) {
      setErr('ยังไม่ได้ยินเรื่องเล่า ลองเล่าอีกครั้งนะครับ (พูดใกล้ๆ เครื่อง)');
      setPhase(clips.current.length ? 'paused' : 'ready');
      return;
    }
    try {
      const r = await chatJSON<{ relevant?: boolean; kind?: string; title?: string; indication?: string; missing?: string[] }>(
        [
          {
            role: 'user',
            content: `${userNoun()}เล่าภูมิปัญญาด้วยเสียง (ถอดอัตโนมัติ อาจสะกดเพี้ยน) ${dialectHint()}
"""
${text.slice(0, 12000)}
"""
0) relevant = true ถ้าเป็นเรื่องภูมิปัญญาการแพทย์พื้นบ้าน/สมุนไพร/ตำรับยา/วิธีรักษา/คาถา/ตำรา · false ถ้าเป็นเสียงรอบข้างที่ไม่เกี่ยว (เช่น ละคร ข่าว คนคุยเรื่องอื่น)
1) kind = ประเภท เลือก 1 จาก ${KINDS.join(' / ')}
2) title = ชื่อเรื่อง (ถ้าไม่ได้บอก ให้ตั้งสั้นๆ จากเนื้อหา) · indication = ใช้แก้/ใช้ในโอกาส (ถ้ามี)
3) missing = หัวข้อที่ "ยังไม่ได้เล่าเลย" เลือกจากรายการของประเภทนั้นเท่านั้น:
${KINDS.map((k) => `${k}: ${TOPICS[k].join(', ')}`).join('\n')}
ตอบ JSON เท่านั้น: {"relevant":true,"kind":"","title":"","indication":"","missing":[]}`,
          },
        ],
        undefined,
        { maxTokens: 500, timeoutMs: 60_000 },
      );
      if (r.relevant === false) {
        // ได้ยินแต่เสียงรอบข้าง (ทีวี/คนคุยเรื่องอื่น) → ไม่เขียนหนังสือจากเสียงนี้ ให้เล่าใหม่
        removeClips(clips.current).catch(() => {});
        clips.current = [];
        jobs.current = [];
        upd(() => []);
        acc.current = 0;
        setElapsed(0);
        setErr('ครูปัญญายังไม่ได้ยินเรื่องภูมิปัญญาเลยครับ เสียงรอบข้างอาจดังเกินไป ลองเล่าใหม่ใกล้ๆ เครื่องในที่เงียบนะครับ');
        setPhase('ready');
        h.warn();
        return;
      }
      const kind = (KINDS.find((k) => r.kind?.includes(k.split('/')[0])) ?? 'ตำรับยา') as Wisdom['kind'];
      const missing = (r.missing ?? []).filter((m) => TOPICS[kind].includes(m));
      setCheck({ kind, title: (r.title ?? '').trim(), indication: (r.indication ?? '').trim(), missing });
      if (!alive.current) return;
      if (missing.length) {
        setPhase('missing');
        h.warn();
      } else write({ kind, title: (r.title ?? '').trim(), indication: (r.indication ?? '').trim(), missing });
    } catch {
      // ตรวจไม่สำเร็จ → เรียบเรียงต่อเลย (ไม่ให้เรื่องเล่าหาย)
      write({ kind: 'ตำรับยา', title: '', indication: '', missing: [] });
    }
  };

  /** เรียบเรียงเป็นหนังสือ → หน้าสรุปก่อนบันทึก */
  const write = async (c: Check) => {
    setPhase('writing');
    const text = await transcript();
    // แบ่งเป็นหน้าต้นฉบับละ ~1,500 ตัวอักษร
    const pages: string[] = [];
    let cur = '';
    text.split('\n\n').forEach((p) => {
      if (cur && cur.length + p.length > 1500) {
        pages.push(cur);
        cur = p;
      } else cur = cur ? `${cur}\n\n${p}` : p;
    });
    if (cur) pages.push(cur);
    try {
      const o = await organizeWisdom(c.kind, c.title, c.indication, pages, { spoken: true });
      if (!alive.current) return;
      h.success();
      setWisdomResult({ kind: c.kind, title: o.title, indication: o.indication, source: 'เสียงเล่า', organized: o, audio: clips.current });
      if (from === 'new') router.back();
      else router.replace('/wisdom/new');
    } catch (e: any) {
      if (!alive.current) return;
      h.warn();
      // เรียบเรียงไม่สำเร็จ → ส่งข้อความที่ถอดได้ไปหน้าต้นฉบับ แก้เองหรือกดจัดหน้าใหม่ได้ (ไม่ทิ้งเรื่องเล่า)
      Alert.alert(e?.message === 'TOO_LONG' ? 'เรื่องเล่ายาวมาก' : 'เรียบเรียงไม่สำเร็จ', 'จะเปิดข้อความที่ถอดได้ในหน้าต้นฉบับให้ แก้ไขแล้วกด "ให้ครูปัญญาจัดหน้า" ได้ครับ', [
        {
          text: 'ตกลง',
          onPress: () => {
            setWisdomResult({ kind: c.kind, title: c.title, indication: c.indication, summary: text, source: 'เสียงเล่า', audio: clips.current });
            if (from === 'new') router.back();
            else router.replace('/wisdom/new');
          },
        },
      ]);
    }
  };

  const close = () => {
    if (!clips.current.length && phase === 'ready') return router.back();
    Alert.alert('ออกจากโหมดเล่า?', 'เรื่องที่เล่าไว้ยังไม่ได้บันทึก จะหายไป', [
      { text: 'เล่าต่อ', style: 'cancel' },
      {
        text: 'ออก',
        style: 'destructive',
        onPress: () => {
          alive.current = false;
          recording.current = false;
          rec.stop().catch(() => {});
          removeClips(clips.current).catch(() => {}); // ไม่บันทึก → ไม่เก็บไฟล์เสียงค้างในเครื่อง
          router.back();
        },
      },
    ]);
  };

  const live = phase === 'recording';
  const heard = pieces.filter((p) => p.status !== 'fail');
  const status =
    phase === 'ready' ? 'พร้อมฟังแล้วครับ' : phase === 'recording' ? 'กำลังฟัง… เล่าได้เลย' : phase === 'paused' ? 'พักไว้ก่อน' : phase === 'checking' ? 'ครูปัญญากำลังตรวจเรื่องเล่า…' : phase === 'missing' ? 'ยังขาดบางเรื่อง' : 'กำลังเรียบเรียงเป็นหนังสือ…';

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <GlassCircle label="ปิด" onPress={close} tint="rgba(255,255,255,0.12)">
          <Sym name="xmark" size={17} color="#FFFFFF" weight="semibold" />
        </GlassCircle>
        <View style={{ alignItems: 'center' }}>
          <T v="title" color="#FFFFFF">โหมดเล่า</T>
          <T v="micro" color={live ? MINT : 'rgba(255,255,255,0.55)'}>{phase === 'ready' ? 'เล่าให้ครูปัญญาฟัง' : clock(elapsed)}</T>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <View style={{ alignItems: 'center', marginTop: 6 }}>
        <Animated.View ref={orb.ref} onLayout={orb.onLayout} style={orb.style}>
          <PressableScale haptic="none" scaleTo={0.97} onPress={phase === 'ready' ? start : phase === 'recording' ? pause : phase === 'paused' ? resume : undefined} accessibilityLabel={status}>
            <AISphere size={pieces.length || phase !== 'ready' ? 170 : 220} active={live || phase === 'checking' || phase === 'writing'} level={(live ? micLevel : undefined) as any} />
          </PressableScale>
        </Animated.View>
        <View style={styles.statusPill}>
          {live ? <View style={styles.liveDot} /> : null}
          <T v="subhead" color="rgba(255,255,255,0.88)">{status}</T>
        </View>
        {live ? (
          <View style={{ width: 180, marginTop: 10 }}>
            <Waveform level={micLevel as any} bars={20} />
          </View>
        ) : null}
      </View>

      {/* เนื้อหากลางจอ: วิธีเล่า (ก่อนเริ่ม) · คำบรรยายสด · เรื่องที่ยังขาด */}
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={[{ padding: 20, paddingBottom: 30, gap: 12 }, column.read]} showsVerticalScrollIndicator={false}>
        {phase === 'ready' && !pieces.length ? (
          <Animated.View entering={FadeInDown.duration(380)} style={{ gap: 12 }}>
            <T v="h2" color="#FFFFFF" center>เล่าเหมือนเล่าให้ลูกหลานฟัง</T>
            <T v="callout" color="rgba(255,255,255,0.6)" center>เล่ายาวแค่ไหนก็ได้ พักได้ ครูปัญญาจะเก็บเสียงของคุณหมอไว้ และเรียบเรียงเป็นหนังสือให้</T>
            <View style={styles.tips}>
              {TIPS.map((t, i) => (
                <View key={t} style={styles.tip}>
                  <T v="caption" color={MINT} style={{ fontWeight: '700' }}>{i + 1}</T>
                  <T v="subhead" color="#FFFFFF">{t}</T>
                </View>
              ))}
            </View>
          </Animated.View>
        ) : null}

        {heard.length ? (
          <Animated.View layout={LinearTransition.duration(220)} style={styles.captions}>
            <T v="micro" color="rgba(255,255,255,0.5)" style={{ fontWeight: '700' }}>ครูปัญญาได้ยินว่า</T>
            {heard.map((p) => (
              <Animated.View key={p.n} entering={FadeInUp.duration(260)}>
                {p.status === 'wait' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color={MINT} />
                    <T v="caption" color="rgba(255,255,255,0.5)">กำลังถอดข้อความช่วงที่ {p.n + 1}…</T>
                  </View>
                ) : (
                  <T v="body" color="rgba(255,255,255,0.92)" style={{ lineHeight: 26 }}>{p.text}</T>
                )}
              </Animated.View>
            ))}
          </Animated.View>
        ) : null}

        {err ? (
          <Animated.View entering={FadeIn} style={styles.err}>
            <Sym name="exclamationmark.circle.fill" size={15} color="#FFB4A8" />
            <T v="subhead" color="#FFD9D2" style={{ flex: 1 }}>{err}</T>
          </Animated.View>
        ) : null}

        {phase === 'missing' && check ? (
          <Animated.View entering={FadeInDown.duration(320)} style={styles.missing}>
            <T v="title" color="#FFFFFF">{check.title ? `“${check.title}”` : check.kind}</T>
            <T v="subhead" color="rgba(255,255,255,0.7)">ครูปัญญายังไม่ได้ยินเรื่องเหล่านี้ เล่าเพิ่มได้ หรือเรียบเรียงเลยก็ได้ครับ</T>
            <View style={styles.missRow}>
              {check.missing.map((m) => (
                <View key={m} style={styles.missChip}>
                  <Sym name="circle.dashed" size={12} color="#FFD27A" />
                  <T v="caption" color="#FFE7B5" style={{ fontWeight: '600' }}>{m}</T>
                </View>
              ))}
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>

      {/* ปุ่มล่าง */}
      <View style={[styles.dock, { paddingBottom: insets.bottom + 14 }]}>
        {phase === 'ready' ? (
          <PressableScale haptic="press" onPress={start} style={styles.primary} accessibilityLabel="เริ่มเล่า">
            <Sym name="mic.fill" size={18} color="#04150E" />
            <T v="bodyStrong" color="#04150E">เริ่มเล่า</T>
          </PressableScale>
        ) : phase === 'recording' || phase === 'paused' ? (
          <View style={styles.row}>
            <PressableScale haptic="select" onPress={phase === 'recording' ? pause : resume} style={styles.round} accessibilityLabel={phase === 'recording' ? 'พักการเล่า' : 'เล่าต่อ'}>
              <Sym name={phase === 'recording' ? 'pause.fill' : 'mic.fill'} size={20} color="#FFFFFF" />
            </PressableScale>
            <PressableScale haptic="press" onPress={finish} disabled={elapsed < 3 && !clips.current.length} style={[styles.primary, { flex: 1 }]} accessibilityLabel="จบการเล่า">
              <Sym name="checkmark" size={18} color="#04150E" weight="bold" />
              <T v="bodyStrong" color="#04150E">จบการเล่า</T>
            </PressableScale>
          </View>
        ) : phase === 'missing' && check ? (
          <View style={styles.row}>
            <PressableScale haptic="select" onPress={resume} style={[styles.secondary, { flex: 1 }]} accessibilityLabel="เล่าเพิ่ม">
              <Sym name="mic.fill" size={17} color="#FFFFFF" />
              <T v="bodyStrong" color="#FFFFFF">เล่าเพิ่ม</T>
            </PressableScale>
            <PressableScale haptic="press" onPress={() => write(check)} style={[styles.primary, { flex: 1.3 }]} accessibilityLabel="เรียบเรียงเป็นหนังสือ">
              <Sym name="book.closed.fill" size={17} color="#04150E" />
              <T v="bodyStrong" color="#04150E">เรียบเรียงเลย</T>
            </PressableScale>
          </View>
        ) : (
          <View style={[styles.primary, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
            <ActivityIndicator color={MINT} />
            <T v="bodyStrong" color="#FFFFFF">{phase === 'checking' ? 'กำลังตรวจ…' : 'กำลังเขียนหนังสือ…'}</T>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000000' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.1)' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5A4E' },
  tips: { marginTop: 8, padding: 14, gap: 10, borderRadius: 20, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)' },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  captions: { gap: 10, padding: 16, borderRadius: 20, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)' },
  err: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 16, backgroundColor: 'rgba(217,83,74,0.22)' },
  missing: { gap: 8, padding: 16, borderRadius: 20, borderCurve: 'continuous', backgroundColor: 'rgba(255,210,122,0.1)', borderWidth: 1, borderColor: 'rgba(255,210,122,0.35)' },
  missRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  missChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,210,122,0.14)' },
  dock: { paddingHorizontal: 20, paddingTop: 10 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: 27, backgroundColor: MINT },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.25)' },
  round: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.25)' },
});
