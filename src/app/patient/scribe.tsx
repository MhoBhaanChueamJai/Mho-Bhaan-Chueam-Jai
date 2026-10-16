/**
 * โหมดฟังบทสนทนา (AI scribe) — ครูปัญญาฟังหมอคุยกับผู้ป่วย แล้วจัดลงหัวข้อการรักษาให้อัตโนมัติ
 * 1) อัดเสียงต่อเนื่อง ตัดเป็นช่วงละ ~40 วิ แล้วถอดเสียงไปพร้อมกัน (เห็นข้อความสด · ไฟล์ไม่ใหญ่เกิน)
 * 2) กดหยุด → AI วิเคราะห์บทสนทนาทั้งหมด → แยกลงหัวข้อ อาการ/ตรวจร่างกาย/วินิจฉัย/การรักษา/ของแสลง/นัดดูอาการ
 * 3) ตรวจทาน: แก้ เพิ่ม ลบ แต่ละหัวข้อได้ก่อนกดบันทึก
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useDerivedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chatJSON, transcribe } from '../../api/ai';
import { AISphere } from '../../components/AISphere';
import { useVoiceRecorder } from '../../components/audio';
import { Sym } from '../../components/ios';
import { AIGlow, Waveform } from '../../components/Orb';
import { PractitionerGate } from '../../components/PractitionerGate';
import { Button, GlassCircle, PressableScale, T, useHaptic } from '../../components/ui';
import { dialectHint } from '../../lib/dialect';
import { VISIT_TOPICS, historyText, type VisitData } from '../../lib/visit';
import { useApp } from '../../store/app';

const SEGMENT_MS = 40_000;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MINT = '#7CF0A8';

type Phase = 'recording' | 'analyzing' | 'review';

function ScribeInner() {
  const { pid } = useLocalSearchParams<{ pid: string }>();
  const { patients, addVisit } = useApp();
  const p = patients.find((x) => x.id === pid);
  const insets = useSafeAreaInsets();
  const h = useHaptic();
  const rec = useVoiceRecorder();
  const micLevel = useDerivedValue(() => withTiming(rec.level.value, { duration: 120 }));

  const [phase, setPhase] = useState<Phase>('recording');
  const [paused, setPaused] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [pending, setPending] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [fields, setFields] = useState<VisitData>({});
  const [error, setError] = useState('');
  const alive = useRef(true);
  const stopReq = useRef(false);
  const pauseReq = useRef(false);
  const jobs = useRef<Promise<void>[]>([]);
  const scroll = useRef<ScrollView>(null);

  /** ถอดเสียงหนึ่งช่วง (ทำเบื้องหลัง ไม่ขวางการอัดช่วงถัดไป) */
  const pushSegment = (uri: string, idx: number) => {
    setPending((n) => n + 1);
    const job = transcribe(uri)
      .then((t) => {
        const text = t.trim();
        if (text && alive.current)
          setLines((ls) => {
            const next = [...ls];
            next[idx] = text;
            return next;
          });
      })
      .catch(() => {})
      .finally(() => alive.current && setPending((n) => n - 1));
    jobs.current.push(job);
  };

  // วงจรอัดเสียง: ช่วงละ 40 วิ จนกว่าจะกดหยุด
  useEffect(() => {
    alive.current = true;
    let idx = 0;
    const t0 = Date.now();
    const tick = setInterval(() => !pauseReq.current && setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    (async () => {
      while (alive.current && !stopReq.current) {
        if (pauseReq.current) {
          await wait(200);
          continue;
        }
        try {
          await rec.start();
        } catch {
          setError('เปิดไมโครโฟนไม่ได้');
          return;
        }
        const s0 = Date.now();
        while (alive.current && !stopReq.current && !pauseReq.current && Date.now() - s0 < SEGMENT_MS) await wait(150);
        const uri = await rec.stop().catch(() => null);
        if (uri && Date.now() - s0 > 1200) pushSegment(uri, idx++);
      }
    })();
    return () => {
      alive.current = false;
      clearInterval(tick);
      rec.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scroll.current?.scrollToEnd({ animated: true });
  }, [lines.length]);

  /** หยุดฟัง → รอถอดเสียงครบ → AI แยกลงหัวข้อ */
  const finish = async () => {
    h.heavy();
    stopReq.current = true;
    setPhase('analyzing');
    await wait(400);
    await Promise.allSettled(jobs.current);
    const transcript = linesRef.current.filter(Boolean).join('\n');
    if (!transcript.trim()) {
      setError('ไม่ได้ยินบทสนทนา ลองอัดใหม่ หรือกรอกเองได้');
      setPhase('review');
      return;
    }
    try {
      const r = await chatJSON<VisitData>([
        {
          role: 'user',
          content: `บทสนทนาระหว่างหมอพื้นบ้านกับผู้ป่วย (ถอดจากเสียงอัตโนมัติ อาจสะกดเพี้ยน และไม่ได้ระบุว่าใครพูด):
${transcript}

ผู้ป่วย: ${p?.name} ${p?.sex} ${p?.age} ปี ธาตุ${p?.element} โรคประจำตัว ${p?.chronic} แพ้ ${p?.allergies}
ประวัติการรักษา:
${p ? historyText(p) : '-'}
${dialectHint()}

สรุปการรักษาครั้งนี้จากบทสนทนา แยกลงหัวข้อเป็นภาษาไทยกลาง กระชับ ใช้ศัพท์แพทย์แผนไทยได้ ห้ามเดาข้อมูลที่ไม่ได้พูดถึง (ช่องที่ไม่มีให้เป็น "")
ตอบ JSON เท่านั้น:
{"symptoms":"อาการและระยะเวลาที่เป็น","exam":"สิ่งที่ตรวจพบ","diagnosis":"การวินิจฉัย","treatment":"วิธีรักษา ยา/สมุนไพรที่ให้ พร้อมวิธีใช้","caution":"ของแสลง/ข้อห้ามที่บอกผู้ป่วย","followUp":"นัดกลับมาเมื่อไหร่","result":"ผลหลังรักษา (ถ้ามี)"}`,
        },
      ]);
      const out: VisitData = {};
      Object.entries(r ?? {}).forEach(([k, v]) => {
        const s = String(v ?? '').trim();
        if (s) (out as any)[k] = s;
      });
      setFields(out);
      h.success();
    } catch {
      setError('วิเคราะห์ไม่สำเร็จ กรอกหรือแก้ไขเองได้');
    }
    setPhase('review');
  };
  const linesRef = useRef<string[]>([]);
  linesRef.current = lines;

  const togglePause = () => {
    h.select();
    pauseReq.current = !pauseReq.current;
    setPaused(pauseReq.current);
  };

  const save = () => {
    if (!p) return;
    const t = new Date();
    addVisit(p.id, {
      date: `${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}/${t.getFullYear() + 543}`,
      symptoms: fields.symptoms || '-',
      exam: fields.exam || '-',
      diagnosis: fields.diagnosis || '-',
      treatment: fields.treatment || '-',
      result: fields.result || 'รอติดตามผล',
      followUp: fields.followUp || '-',
      note: fields.caution ? `ของแสลง/ข้อห้าม: ${fields.caution}` : undefined,
    });
    h.success();
    router.back();
  };

  const close = () => {
    alive.current = false;
    stopReq.current = true;
    rec.stop().catch(() => {});
    router.back();
  };

  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const filled = VISIT_TOPICS.filter((t) => String(fields[t.key] ?? '').trim()).length;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
      <StatusBar style="light" />
      <LinearGradient colors={['#000000', '#050B08', '#000000']} style={StyleSheet.absoluteFill} />
      <AIGlow active={phase !== 'review'} />

      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <GlassCircle label="ปิด" onPress={close} tint="rgba(255,255,255,0.12)">
          <Sym name="xmark" size={17} color="#FFFFFF" weight="semibold" />
        </GlassCircle>
        <T v="title" color="#FFFFFF">{phase === 'review' ? 'ตรวจทานก่อนบันทึก' : 'ฟังบทสนทนา'}</T>
        <View style={{ width: 44 }} />
      </View>

      {phase !== 'review' ? (
        <View style={{ flex: 1 }}>
          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <AISphere size={170} active={!paused} level={phase === 'recording' && !paused ? (micLevel as any) : undefined} />
            <View style={styles.statusPill}>
              {phase === 'recording' ? <View style={[styles.liveDot, paused && { backgroundColor: '#FFC24A' }]} /> : <ActivityIndicator size="small" color={MINT} />}
              <T v="subhead" color="rgba(255,255,255,0.85)">
                {phase === 'analyzing' ? 'ครูปัญญากำลังวิเคราะห์บทสนทนา…' : paused ? `หยุดชั่วคราว · ${mm}` : `กำลังฟังบทสนทนา · ${mm}`}
              </T>
            </View>
            {phase === 'recording' && !paused ? (
              <View style={{ width: 180, marginTop: 10 }}>
                <Waveform level={micLevel as any} bars={20} />
              </View>
            ) : null}
            <T v="caption" color="rgba(255,255,255,0.55)" center style={{ marginTop: 10, paddingHorizontal: 40 }}>
              คุยกับผู้ป่วยตามปกติ ครูปัญญาจะฟังแล้วจัดลงหัวข้อการรักษาให้
            </T>
          </View>

          {/* ข้อความที่ถอดได้ (สด) */}
          <ScrollView ref={scroll} style={styles.transcript} contentContainerStyle={{ padding: 16, gap: 8 }}>
            {lines.filter(Boolean).map((l, i) => (
              <Animated.View key={i} entering={FadeInDown.duration(300)}>
                <T v="callout" color="rgba(255,255,255,0.88)">{l}</T>
              </Animated.View>
            ))}
            {pending > 0 ? <T v="caption" color="rgba(255,255,255,0.45)">กำลังถอดเสียง…</T> : null}
            {!lines.filter(Boolean).length && !pending ? <T v="caption" color="rgba(255,255,255,0.4)" center>ข้อความจากบทสนทนาจะขึ้นที่นี่</T> : null}
          </ScrollView>

          {phase === 'recording' ? (
            <View style={[styles.controls, { paddingBottom: insets.bottom + 16 }]}>
              <PressableScale haptic="select" onPress={togglePause} style={styles.ctrlSmall} accessibilityLabel={paused ? 'ฟังต่อ' : 'หยุดชั่วคราว'}>
                <Sym name={paused ? 'play.fill' : 'pause.fill'} size={20} color="#FFFFFF" />
              </PressableScale>
              <PressableScale haptic="press" onPress={finish} style={styles.ctrlMain} accessibilityLabel="จบและวิเคราะห์">
                <Sym name="stop.fill" size={18} color="#04150E" />
                <T v="bodyStrong" color="#04150E">จบและวิเคราะห์</T>
              </PressableScale>
            </View>
          ) : null}
        </View>
      ) : (
        /* ── ตรวจทาน: แก้ เพิ่ม ลบ แต่ละหัวข้อ ── */
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120, gap: 12 }}>
          <Animated.View entering={FadeIn.duration(300)}>
            <T v="subhead" color="rgba(255,255,255,0.6)">
              {error || `ครูปัญญาจัดลงหัวข้อให้แล้ว ${filled}/${VISIT_TOPICS.length} หัวข้อ แก้ เพิ่ม หรือลบได้ก่อนบันทึก`}
            </T>
          </Animated.View>
          {VISIT_TOPICS.map((t, i) => {
            const v = String(fields[t.key] ?? '');
            return (
              <Animated.View key={t.key} entering={FadeInDown.delay(i * 50).duration(350)} style={styles.field}>
                <View style={styles.fieldHead}>
                  <View style={[styles.dot, { backgroundColor: v.trim() ? MINT : 'rgba(255,255,255,0.25)' }]} />
                  <T v="subhead" color="rgba(255,255,255,0.75)" style={{ flex: 1, fontWeight: '600' }}>{t.label}</T>
                  {v ? (
                    <PressableScale haptic="select" onPress={() => setFields((f) => ({ ...f, [t.key]: '' }))} hitSlop={10} accessibilityLabel={`ลบ${t.label}`}>
                      <Sym name="xmark.circle.fill" size={18} color="rgba(255,255,255,0.4)" />
                    </PressableScale>
                  ) : null}
                </View>
                <TextInput
                  value={v}
                  onChangeText={(x) => setFields((f) => ({ ...f, [t.key]: x }))}
                  placeholder={`เพิ่ม${t.label}`}
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  multiline
                  style={styles.fieldInput}
                  accessibilityLabel={t.label}
                />
              </Animated.View>
            );
          })}
          {lines.filter(Boolean).length ? (
            <View style={[styles.field, { opacity: 0.85 }]}>
              <T v="subhead" color="rgba(255,255,255,0.6)" style={{ fontWeight: '600', marginBottom: 6 }}>บทสนทนาที่ถอดได้</T>
              <T v="caption" color="rgba(255,255,255,0.6)">{lines.filter(Boolean).join('\n')}</T>
            </View>
          ) : null}
        </ScrollView>
      )}

      {phase === 'review' ? (
        <View style={[styles.dock, { bottom: insets.bottom ? 24 : 16 }]}>
          <Button
            label="บันทึกการรักษา"
            disabled={!filled}
            onPress={() => {
              Keyboard.dismiss();
              save();
            }}
            style={{ height: 52 }}
          />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000000' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5A5A' },
  transcript: { flex: 1, marginTop: 14, marginHorizontal: 20, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingTop: 16, paddingHorizontal: 24 },
  ctrlSmall: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  ctrlMain: { flex: 1, height: 56, borderRadius: 28, backgroundColor: MINT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  field: { borderRadius: 20, borderCurve: 'continuous', padding: 14, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)' },
  fieldHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  fieldInput: { fontSize: 17, lineHeight: 24, color: '#FFFFFF', minHeight: 26, padding: 0 },
  dock: { position: 'absolute', left: 24, right: 24, padding: 8, borderRadius: 32, backgroundColor: 'rgba(28,30,29,0.96)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.22)' },
});

export default function Scribe() {
  return (
    <PractitionerGate>
      <ScribeInner />
    </PractitionerGate>
  );
}
