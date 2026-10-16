import { router, useLocalSearchParams } from 'expo-router';
import {
  AlertTriangle,
  BookMarked,
  Check,
  FlaskConical,
  HelpCircle,
  Keyboard,
  Leaf,
  Mic,
  RotateCcw,
  Square,
  Stethoscope,
  Volume2,
  VolumeX,
  X,
} from '../components/icons';
import React, { useEffect, useRef, useState } from 'react';
import { VerifyPrompt } from '../components/PractitionerGate';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SYSTEM_PROMPT, chatJSON, transcribe } from '../api/ai';
import { useSpeaker, useVoiceRecorder } from '../components/audio';
import { ParticleRing, ProgressHalo, Waveform } from '../components/Orb';
import { AISphere } from '../components/AISphere';
import { Sym } from '../components/ios';
import { Backdrop, Badge, Button, Card, GlassCircle, GlassDock, IconBubble, PressableScale, T, useHaptic } from '../components/ui';
import { elementColor, palette, radius, space } from '../theme';
import { useApp } from '../store/app';

type Mode = 'patient' | 'wisdom';
type Stage = 'choose' | 'listening' | 'typing' | 'processing' | 'result';

/** ผลวิเคราะห์ = แบบ ม.บ.5 ที่ AI กรอกให้ + คำแนะนำความปลอดภัย */
type PatientResult = {
  patient: { name: string; sex: string; age: string; address: string; phone: string; chronic: string; allergies: string; weight: string; height: string };
  visit: { symptoms: string; exam: string; diagnosis: string; treatment: string; result: string; followUp: string; note: string };
  summary: string;
  element: 'ดิน' | 'น้ำ' | 'ลม' | 'ไฟ';
  elementReason: string;
  herbs: { name: string; how: string }[];
  cautions: string[];
  redFlags: string[];
  askMore: string[];
};
type WisdomResult = {
  title: string;
  summary: string;
  ingredients: string[];
  method: string;
  indication: string;
  caution: string;
  followUp: string;
};

const HINTS: Record<Mode, string[]> = {
  patient: ['ผู้ป่วยชื่ออะไร อายุเท่าไร', 'มีอาการอะไร เป็นมากี่วัน', 'กินยาอะไรอยู่บ้าง แพ้ยาไหม', 'คุณหมอสังเกตเห็นอะไร'],
  wisdom: ['ตำรับนี้ชื่ออะไร ได้มาจากใคร', 'ใช้สมุนไพรอะไรบ้าง กี่ส่วน', 'ปรุงอย่างไร กินอย่างไร', 'ห้ามใช้กับใคร'],
};

const SAMPLE: Record<Mode, string> = {
  patient:
    'แม่บุญมา อายุเจ็ดสิบสองปี ปวดเข่าทั้งสองข้างมาสามเดือน ตอนเช้าเข่าฝืด เดินลำบาก ช่วงนี้อากาศเย็นยิ่งปวดมาก กินยาความดันอยู่ แพ้ยาซัลฟา กดดูเข่าด้านในเจ็บ บวมนิดหน่อย',
  wisdom:
    'ตำรับยาต้มแก้ลมจับโปงของพ่อหมอแก้ว ใช้เถาเอ็นอ่อนหนึ่งกำมือ โคคลานหนึ่งกำมือ แก่นฝางสิบห้ากรัม ไพลสามแว่น ขิงแก่สามแว่น ต้มกับน้ำสามส่วนเคี่ยวให้เหลือหนึ่งส่วน กินเช้าเย็นก่อนอาหารครั้งละครึ่งแก้ว เจ็ดวัน',
};

const FALLBACK_PATIENT: PatientResult = {
  patient: { name: 'นางบุญมา', sex: 'หญิง', age: '72', address: '', phone: '', chronic: 'ความดันโลหิตสูง', allergies: 'แพ้ยาซัลฟา', weight: '', height: '' },
  visit: {
    symptoms: 'ปวดเข่าทั้งสองข้าง 3 เดือน เช้าฝืด เดินลำบาก กำเริบเมื่ออากาศเย็น',
    exam: 'กดเจ็บเข่าด้านใน บวมเล็กน้อย',
    diagnosis: 'ลมจับโปงแห้ง (ข้อเข่าเสื่อม)',
    treatment: 'นวดพื้นบ้านรอบเข่า + ประคบสมุนไพรไพล ขมิ้น ตะไคร้',
    result: 'รอประเมินครั้งถัดไป',
    followUp: 'นัด 3–4 วัน ติดตามระดับปวดและความดันโลหิต',
    note: 'เลี่ยงนั่งพับเพียบ',
  },
  summary: 'ผู้สูงอายุหญิง 72 ปี ปวดเข่าสองข้างเรื้อรัง ฝืดตอนเช้า กำเริบเมื่ออากาศเย็น',
  element: 'ลม',
  elementReason: 'ปวดตึง ฝืด กำเริบเมื่ออากาศเย็น สัมพันธ์กับวาโยธาตุในวัยปัจฉิมวัย',
  herbs: [
    { name: 'ลูกประคบไพล–ขมิ้น–ตะไคร้', how: 'ประคบอุ่นรอบเข่า 15–20 นาที วันละ 1–2 ครั้ง' },
    { name: 'น้ำมันไพล', how: 'ทาถูนวดเบาๆ เช้า–เย็น' },
  ],
  cautions: ['ใช้ยาความดันอยู่ — ยารสร้อนอาจเพิ่มความดัน', 'แพ้ยาซัลฟา — ตรวจส่วนผสมยาให้ละเอียด'],
  redFlags: ['เข่าบวมแดงร้อนมาก มีไข้', 'ลงน้ำหนักไม่ได้ → ส่งต่อ รพ.สต.'],
  askMore: ['ที่อยู่และเบอร์โทรศัพท์', 'น้ำหนักและส่วนสูง', 'เคยหกล้มหรือกระแทกเข่าหรือไม่'],
};

const FALLBACK_WISDOM: WisdomResult = {
  title: 'ยาต้มแก้ลมจับโปง (สูตรพ่อหมอแก้ว)',
  summary: 'ตำรับยาต้มสืบทอดในครอบครัว ใช้แก้ปวดบวมข้อเข่าจากลมจับโปง',
  ingredients: ['เถาเอ็นอ่อน 1 กำมือ', 'โคคลาน 1 กำมือ', 'แก่นฝาง 15 กรัม', 'ไพล 3 แว่น', 'ขิงแก่ 3 แว่น'],
  method: 'ต้มน้ำ 3 ส่วน เคี่ยวเหลือ 1 ส่วน ดื่มครั้งละครึ่งแก้ว เช้า–เย็น ก่อนอาหาร 7 วัน',
  indication: 'ลมจับโปง ปวดเข่า ข้อบวม',
  caution: 'ระวังในผู้ป่วยโรคไต ความดันสูง และหญิงตั้งครรภ์',
  followUp: 'พ่อหมอเลือกเถาเอ็นอ่อนอย่างไร ต้องเก็บช่วงฤดูไหนจึงจะได้ยาที่ดีที่สุดครับ?',
};

function CaptureInner() {
  const { isPractitioner } = useApp();
  const params = useLocalSearchParams<{ mode?: Mode; pid?: string }>();
  const insets = useSafeAreaInsets();
  const { settings, addWisdom, patients, addVisit, addPatient } = useApp();
  const h = useHaptic();
  const rec = useVoiceRecorder();
  const tts = useSpeaker();

  const [mode, setMode] = useState<Mode | null>(params.mode ?? null);
  const [stage, setStage] = useState<Stage>(params.mode ? 'listening' : 'choose');
  const [transcript, setTranscript] = useState('');
  const [typed, setTyped] = useState('');
  const [step, setStep] = useState(0);
  const [demo, setDemo] = useState(false);
  const [patient, setPatient] = useState<PatientResult | null>(null);
  const [wisdom, setWisdom] = useState<WisdomResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [hint, setHint] = useState(0);
  const autoStarted = useRef(false);

  // เริ่มอัดเสียงอัตโนมัติเมื่อเลือกโหมดแล้ว
  useEffect(() => {
    if (stage === 'listening' && !autoStarted.current) {
      autoStarted.current = true;
      rec.start().catch(() => setStage('typing'));
    }
  }, [stage]);

  useEffect(() => {
    if (stage !== 'listening') return;
    const t = setInterval(() => setHint((x) => (x + 1) % 4), 3200);
    return () => clearInterval(t);
  }, [stage]);

  useEffect(() => () => tts.stop(), []);

  const pick = (m: Mode) => {
    if (m === 'patient' && !isPractitioner) return router.replace('/verify');
    h.press();
    setMode(m);
    autoStarted.current = false;
    setStage('listening');
  };

  const analyze = async (text: string) => {
    if (!mode) return;
    setStage('processing');
    setStep(1);
    try {
      if (mode === 'patient') {
        const r = await chatJSON<PatientResult>(
          [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `หมอพื้นบ้านเล่าอาการผู้ป่วยดังนี้:\n"${text}"\n\nกรอก "แบบ ม.บ.5 ทะเบียนการรักษา" ของกรมการแพทย์แผนไทยฯ จากคำเล่า และวิเคราะห์ตามหลักแพทย์แผนไทย ช่องที่ไม่ได้กล่าวถึงให้เป็น "" (ห้ามเดา) ตอบเป็น JSON เท่านั้น:
{"patient":{"name":"ชื่อ-สกุล","sex":"ชาย|หญิง","age":"ปี","address":"ที่อยู่","phone":"","chronic":"โรคประจำตัว","allergies":"การแพ้ยา/อาหาร","weight":"กก.","height":"ซม."},"visit":{"symptoms":"อาการเจ็บป่วย","exam":"ตรวจร่างกาย","diagnosis":"วินิจฉัยโรค (ภาษาแพทย์แผนไทย)","treatment":"การรักษาที่หมอเล่า ถ้าไม่ได้เล่าให้เสนอการรักษาแผนไทยที่เหมาะสม ขึ้นต้นด้วย แนะนำ:","result":"ผลการรักษา","followUp":"การติดตามผล","note":"หมายเหตุ"},"summary":"สรุป 1 ประโยค","element":"ดิน|น้ำ|ลม|ไฟ","elementReason":"เหตุผลสั้น","herbs":[{"name":"สมุนไพร/ตำรับ","how":"วิธีใช้สั้น"}],"cautions":["ข้อควรระวังเฉพาะผู้ป่วยนี้"],"redFlags":["สัญญาณอันตรายที่ต้องส่งต่อ"],"askMore":["ข้อมูล ม.บ.5 ที่ยังขาด หรือคำถามที่ควรถามเพิ่ม"]}
herbs ไม่เกิน 3 รายการ รายการอื่นไม่เกิน 3 ข้อ`,
            },
          ],
          settings.model,
        );
        setStep(3);
        setPatient(r);
        if (settings.autoSpeak) tts.speak(`กรอกแบบ ม.บ.5 ให้แล้วครับ ${r.summary} วินิจฉัยเบื้องต้นว่า ${r.visit.diagnosis} ${r.cautions[0] ?? ''}`);
      } else {
        const r = await chatJSON<WisdomResult>(
          [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `หมอพื้นบ้านเล่าภูมิปัญญา/ตำรับยาดังนี้:\n"${text}"\n\nเรียบเรียงเป็นบันทึกตำรับยาที่ถูกต้อง ตอบเป็น JSON เท่านั้น:
{"title":"ชื่อตำรับ","summary":"สรุป 1 ประโยค","ingredients":["ตัวยา + ปริมาณ"],"method":"วิธีปรุงและวิธีใช้","indication":"สรรพคุณ","caution":"ข้อควรระวังด้านความปลอดภัย","followUp":"คำถาม 1 ข้อแบบนักสัมภาษณ์ เพื่อดึงความรู้ลึกที่ยังขาด เช่น การเลือกวัตถุดิบ ฤดูเก็บ เคล็ดลับ"}`,
            },
          ],
          settings.model,
        );
        setStep(3);
        setWisdom(r);
        if (settings.autoSpeak) tts.speak(`บันทึกตำรับ ${r.title} แล้วครับ ขอถามเพิ่มนะครับ ${r.followUp}`);
      }
      setDemo(false);
    } catch {
      setDemo(true);
      if (mode === 'patient') setPatient(FALLBACK_PATIENT);
      else setWisdom(FALLBACK_WISDOM);
    }
    h.success();
    setStage('result');
  };

  const stopAndProcess = async () => {
    h.heavy();
    const uri = await rec.stop().catch(() => null);
    setStage('processing');
    setStep(0);
    let text = '';
    try {
      if (uri && rec.durationMs > 1200) text = await transcribe(uri);
    } catch {}
    if (!text) text = SAMPLE[mode!];
    setTranscript((prev) => (prev ? `${prev}\n${text}` : text));
    analyze(transcript ? `${transcript}\n${text}` : text);
  };

  /** บันทึกผลลงทะเบียนการรักษา ม.บ.5 — ผู้ป่วยเดิม: เพิ่มครั้งที่ n+1, ผู้ป่วยใหม่: สร้างประวัติ */
  const saveMB5 = () => {
    if (!patient) return;
    const d = new Date();
    const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear() + 543}`;
    const v = patient.visit;
    const visit = {
      date,
      symptoms: v.symptoms || '-',
      exam: v.exam || '-',
      diagnosis: v.diagnosis || '-',
      treatment: v.treatment || '-',
      result: v.result || 'รอติดตาม',
      followUp: v.followUp || '-',
      note: v.note || undefined,
    };
    const g = patient.patient;
    const first = (g.name || '').replace(/^(นางสาว|นาง|นาย|แม่|ลุง|ป้า|ตา|ยาย|น้อง)/, '').trim().split(' ')[0];
    const match = params.pid ? patients.find((x) => x.id === params.pid) : first ? patients.find((x) => x.name.includes(first)) : undefined;
    let pid: string;
    if (match) {
      addVisit(match.id, visit);
      pid = match.id;
    } else {
      const num = (x: string) => Number(String(x || '').replace(/[^0-9.]/g, '')) || 0;
      pid = addPatient(
        {
          name: g.name || 'ผู้ป่วยใหม่',
          sex: g.sex === 'ชาย' ? 'ชาย' : 'หญิง',
          age: num(g.age),
          address: { houseNo: '', moo: '', village: g.address || 'ยังไม่ระบุ', subdistrict: '', district: '', province: '' },
          phone: g.phone || '-',
          chronic: g.chronic || 'ไม่มี',
          allergies: g.allergies || 'ไม่มี',
          weight: num(g.weight),
          height: num(g.height),
          element: patient.element ?? 'ลม',
          status: 'ติดตามอาการ',
          meds: [],
        },
        visit,
      );
    }
    h.success();
    setSaved(true);
    setTimeout(() => router.replace(`/patient/${pid}`), 450);
  };

  const saveWisdom = () => {
    if (!wisdom) return;
    addWisdom({
      id: `w${Date.now()}`,
      title: wisdom.title,
      kind: 'ตำรับยา',
      source: 'เสียงเล่า',
      date: 'วันนี้',
      minutes: Math.max(1, Math.round(rec.durationMs / 60000)),
      summary: wisdom.summary,
      ingredients: wisdom.ingredients,
      method: wisdom.method,
      indication: wisdom.indication,
      caution: wisdom.caution,
      verified: false,
    });
    h.success();
    setSaved(true);
  };

  const continueInterview = () => {
    tts.stop();
    autoStarted.current = false;
    setSaved(false);
    setStage('listening');
  };

  const close = () => {
    tts.stop();
    if (rec.isRecording) rec.stop().catch(() => {});
    router.back();
  };

  const secs = Math.floor(rec.durationMs / 1000);
  const timer = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Backdrop />
      {/* Top bar */}
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <GlassCircle label="ปิด" onPress={close}>
          <X size={20} color={palette.ink} strokeWidth={2.4} />
        </GlassCircle>
        <View style={{ alignItems: 'center' }}>
          <T v="title" color={palette.ink}>ครูปัญญา</T>
          <T v="micro" color={palette.orange}>
            {mode === 'patient' ? 'โหมดเล่าอาการผู้ป่วย' : mode === 'wisdom' ? 'โหมดถ่ายทอดภูมิปัญญา' : 'ผู้ช่วย AI ฟังเสียง'}
          </T>
        </View>
        <GlassCircle label="หยุดเสียง" onPress={() => (tts.speaking ? tts.stop() : null)}>
          {tts.speaking ? <VolumeX size={20} color={palette.primary} /> : <Volume2 size={20} color={palette.inkMute} />}
        </GlassCircle>
      </View>

      {stage === 'choose' && (
        <Animated.View entering={FadeIn} style={{ flex: 1, padding: space.lg, justifyContent: 'center', gap: space.lg }}>
          <View style={{ alignItems: 'center', marginBottom: space.md }}>
            <AISphere size={120} />
            <T v="h1" center color={palette.ink} style={{ marginTop: -20 }}>วันนี้อยากเล่าเรื่องอะไรครับ</T>
            <T v="body" center color={palette.inkSoft}>เลือกหนึ่งอย่าง แล้วพูดได้เลย</T>
          </View>
          {[
            { m: 'patient' as Mode, title: 'เล่าอาการผู้ป่วย', sub: 'ครูปัญญาช่วยจด วิเคราะห์ธาตุ แนะนำสมุนไพร และเตือนอันตราย', Icon: Stethoscope, bg: palette.primarySoft, fg: palette.primary },
            { m: 'wisdom' as Mode, title: 'ถ่ายทอดภูมิปัญญา', sub: 'เล่าตำรับยาหรือวิธีรักษา ครูปัญญาเรียบเรียงเป็นสมุดข่อยดิจิทัล', Icon: BookMarked, bg: palette.peach, fg: '#A8642B' },
          ].map(({ m, title, sub, Icon, bg, fg }, i) => (
            <Animated.View key={m} entering={FadeInDown.delay(120 + i * 90).springify()}>
              <Card onPress={() => pick(m)} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', minHeight: 120 }}>
                <IconBubble bg={bg} size={64}>
                  <Icon size={32} color={fg} />
                </IconBubble>
                <View style={{ flex: 1 }}>
                  <T v="title">{title}</T>
                  <T v="callout" color={palette.inkSoft}>{sub}</T>
                </View>
              </Card>
            </Animated.View>
          ))}
        </Animated.View>
      )}

      {stage === 'listening' && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={{ flex: 1, paddingBottom: insets.bottom + space.lg }}>
          <View style={styles.center}>
            {wisdom?.followUp ? (
              <Animated.View entering={FadeInDown} style={styles.question}>
                <HelpCircle size={20} color={palette.orange} />
                <T v="callout" style={{ flex: 1 }}>{wisdom.followUp}</T>
              </Animated.View>
            ) : null}
            <ParticleRing size={260} level={rec.level}>
              <AISphere size={86} active level={rec.level} />
            </ParticleRing>
            <T v="hero" style={{ marginTop: 4, fontVariant: ['tabular-nums'], fontWeight: '300' }}>{timer}</T>
            <T v="callout" color={palette.inkSoft} style={{ marginTop: 4 }}>{rec.isRecording ? 'ครูปัญญากำลังฟัง พูดได้ตามสบาย' : 'กำลังเตรียมไมโครโฟน…'}</T>
            <View style={{ marginTop: space.xl }}>
              <Waveform level={rec.level} />
            </View>
            <Animated.View key={hint} entering={FadeInUp} exiting={FadeOut} style={styles.hint}>
              <T v="callout" color={palette.primary}>ลองเล่าว่า: {HINTS[mode ?? 'patient'][hint]}</T>
            </Animated.View>
          </View>
          <View style={styles.controls}>
            <PressableScale onPress={async () => { await rec.stop().catch(() => {}); setStage('typing'); }} style={styles.sideBtn} accessibilityLabel="พิมพ์แทน">
              <Keyboard size={26} color={palette.primary} />
              <T v="caption" color={palette.inkSoft}>พิมพ์แทน</T>
            </PressableScale>
            <View style={{ alignItems: 'center', gap: space.sm }}>
              <PressableScale haptic="none" scaleTo={0.9} onPress={stopAndProcess} style={styles.stop} accessibilityLabel="พูดจบแล้ว">
                <Square size={28} color={palette.white} />
              </PressableScale>
              <T v="caption" color={palette.inkMute}>แตะเมื่อพูดจบ</T>
            </View>
            <PressableScale onPress={async () => { await rec.stop().catch(() => {}); setTranscript(''); setTyped(SAMPLE[mode!]); setStage('typing'); }} style={styles.sideBtn} accessibilityLabel="ใช้ตัวอย่าง">
              <FlaskConical size={26} color={palette.primary} />
              <T v="caption" color={palette.inkSoft}>ตัวอย่าง</T>
            </PressableScale>
          </View>
        </Animated.View>
      )}

      {stage === 'typing' && (
        <Animated.View entering={FadeIn} style={{ flex: 1, padding: space.lg, gap: space.md }}>
          <T v="h2" color={palette.ink}>{mode === 'wisdom' ? 'เล่าตำรับยา' : 'เล่าอาการผู้ป่วย'}</T>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            multiline
            autoFocus
            placeholder={HINTS[mode ?? 'patient'].join(' · ')}
            placeholderTextColor={palette.inkMute}
            style={styles.input}
          />
          <Button label="ให้ครูปัญญาวิเคราะห์" icon={<Check size={22} color={palette.white} />} disabled={!typed.trim()} onPress={() => { setTranscript(typed); analyze(typed); }} />
          <Button kind="ghost" label="กลับไปพูดแทน" icon={<Mic size={20} color={palette.primary} />} onPress={() => { autoStarted.current = false; setStage('listening'); }} />
        </Animated.View>
      )}

      {stage === 'processing' && (
        <Animated.View entering={FadeIn} style={styles.center}>
          <ProgressHalo size={240} progress={step === 0 ? 0.24 : step === 1 ? 0.62 : 0.99}>
            {step === 0 ? (
              <View style={styles.haloIcon}>
                <Sym name="waveform" size={28} color="#A35DD8" />
              </View>
            ) : step === 1 ? (
              <View style={styles.haloIcon}>
                <Sym name="text.alignleft" size={28} color="#D06CB8" />
              </View>
            ) : (
              <AISphere size={84} active />
            )}
          </ProgressHalo>
          <T v="h2" style={{ marginTop: 12 }}>ครูปัญญากำลังคิด…</T>
          <View style={{ marginTop: space.xl, gap: space.sm, width: '80%' }}>
            {['ถอดเสียงภาษาไทย (Qwen3‑ASR)', `วิเคราะห์ด้วย ${settings.model === 'qwen' ? 'Qwen' : 'Gemma'}`, 'เรียบเรียงตามหลักแพทย์แผนไทย'].map((s, i) => (
              <Animated.View key={s} entering={FadeInDown.delay(i * 250)} style={styles.stepRow}>
                <View style={[styles.stepDot, step > i && { backgroundColor: palette.primary, borderColor: palette.primary }, step === i && { borderColor: palette.orange }]}>
                  {step > i ? <Check size={14} color={palette.white} /> : null}
                </View>
                <T v="callout" color={step >= i ? palette.ink : palette.inkMute}>{s}</T>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      )}

      {stage === 'result' && (
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + 140 }} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.springify()} style={{ alignItems: 'center', marginBottom: space.sm }}>
            <AISphere size={96} active={tts.speaking} level={tts.level} />
            {demo ? <Badge label="โหมดสาธิต · ไม่ได้เชื่อมต่อ AI" fg={palette.coral} bg={palette.coralSoft} /> : <Badge label={`✓ วิเคราะห์โดย ${settings.model === 'qwen' ? 'Qwen' : 'Gemma'}`} />}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).springify()} layout={LinearTransition}>
            <Card tone="clay" style={{ marginBottom: space.md }}>
              <T v="caption" color={palette.inkMute}>สิ่งที่ครูปัญญาได้ยิน</T>
              <T v="callout" color={palette.inkSoft} style={{ marginTop: 4 }}>“{transcript}”</T>
            </Card>
          </Animated.View>

          {patient && <PatientView r={patient} />}
          {wisdom && <WisdomView r={wisdom} />}
        </ScrollView>
      )}

      {stage === 'result' && (
        <Animated.View entering={FadeInUp.springify()} style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <GlassDock>
          <PressableScale onPress={() => (tts.speaking ? tts.stop() : tts.speak(patient ? `${patient.summary} การรักษา ${patient.visit.treatment}` : `${wisdom?.title} ${wisdom?.method}`))} style={styles.sideBtn} accessibilityLabel="ฟังสรุป">
            {tts.speaking ? <VolumeX size={26} color={palette.primary} /> : <Volume2 size={26} color={palette.primary} />}
            <T v="micro" color={palette.inkSoft}>{tts.speaking ? 'หยุด' : 'ฟังสรุป'}</T>
          </PressableScale>
          {mode === 'wisdom' ? (
            <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
              <Button style={{ flex: 1 }} kind="secondary" label="ตอบต่อ" icon={<Mic size={20} color={palette.primary} />} onPress={continueInterview} />
              <Button style={{ flex: 1.3 }} kind={saved ? 'secondary' : 'primary'} label={saved ? 'บันทึกแล้ว' : 'เก็บเข้าคลัง'} icon={saved ? <Check size={20} color={palette.primary} /> : <BookMarked size={20} color={palette.white} />} onPress={saved ? () => router.replace('/vault') : saveWisdom} />
            </View>
          ) : (
            <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
              <Button style={{ flex: 1 }} kind="secondary" label="เล่าเพิ่ม" icon={<Mic size={20} color={palette.primary} />} onPress={continueInterview} />
              <Button style={{ flex: 1.4 }} label={saved ? 'บันทึกแล้ว' : 'บันทึก ม.บ.5'} kind={saved ? 'secondary' : 'primary'} icon={<Check size={20} color={saved ? palette.primary : palette.white} />} onPress={saved ? undefined : saveMB5} />
            </View>
          )}
          <PressableScale onPress={() => { setTranscript(''); setPatient(null); setWisdom(null); setSaved(false); autoStarted.current = false; setStage('listening'); }} style={styles.sideBtn} accessibilityLabel="เริ่มใหม่">
            <RotateCcw size={24} color={palette.primary} />
            <T v="micro" color={palette.inkSoft}>เริ่มใหม่</T>
          </PressableScale>
          </GlassDock>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

function Section({ title, icon, children, i, tint = palette.primary }: { title: string; icon: React.ReactNode; children: React.ReactNode; i: number; tint?: string }) {
  return (
    <Animated.View entering={FadeInDown.delay(160 + i * 90).springify().damping(18)}>
      <Card style={{ marginBottom: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {icon}
          <T v="bodyStrong" color={tint}>{title}</T>
        </View>
        {children}
      </Card>
    </Animated.View>
  );
}

const Bullet = ({ text, color = palette.ink }: { text: string; color?: string }) => (
  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
    <T v="body" color={palette.orange}>•</T>
    <T v="body" color={color} style={{ flex: 1 }}>{text}</T>
  </View>
);

function MB5Row({ label, value }: { label: string; value: string }) {
  const empty = !value?.trim();
  return (
    <View style={styles.mbRow}>
      <T v="caption" color={palette.inkMute} style={{ width: 100 }}>{label}</T>
      <T v="callout" color={empty ? palette.inkMute : palette.ink} style={{ flex: 1 }}>{empty ? 'ยังไม่ระบุ' : value}</T>
    </View>
  );
}

function PatientView({ r }: { r: PatientResult }) {
  const el = elementColor[r.element] ?? elementColor['ลม'];
  const g = r.patient;
  const v = r.visit;
  return (
    <>
      <Section i={0} title="แบบ ม.บ.5 · ข้อมูลทั่วไป" icon={<Stethoscope size={20} color={palette.primary} />}>
        <MB5Row label="ชื่อ-สกุล" value={g.name} />
        <MB5Row label="เพศ / อายุ" value={[g.sex, g.age && `${String(g.age).replace(/[^0-9]/g, '')} ปี`].filter(Boolean).join(' / ')} />
        <MB5Row label="ที่อยู่" value={g.address} />
        <MB5Row label="เบอร์โทรศัพท์" value={g.phone} />
        <MB5Row label="โรคประจำตัว" value={g.chronic} />
        <MB5Row label="การแพ้ยา/อาหาร" value={g.allergies} />
        <MB5Row label="น้ำหนัก / ส่วนสูง" value={[g.weight && `${String(g.weight).replace(/[^0-9.]/g, '')} กก.`, g.height && `${String(g.height).replace(/[^0-9.]/g, '')} ซม.`].filter(Boolean).join(' / ')} />
      </Section>
      <Section i={1} title="แบบ ม.บ.5 · ทะเบียนการรักษา" icon={<Check size={20} color={palette.primary} />}>
        <MB5Row label="ว/ด/ป" value={new Date().toLocaleDateString('th-TH')} />
        <MB5Row label="อาการเจ็บป่วย" value={v.symptoms} />
        <MB5Row label="ตรวจร่างกาย" value={v.exam} />
        <MB5Row label="วินิจฉัยโรค" value={v.diagnosis} />
        <MB5Row label="การรักษา" value={v.treatment} />
        <MB5Row label="ผลการรักษา" value={v.result} />
        <MB5Row label="การติดตามผล" value={v.followUp} />
        <MB5Row label="หมายเหตุ" value={v.note} />
        <View style={[styles.element, { backgroundColor: el.bg }]}>
          <T v="bodyStrong" color={el.fg}>{el.label}กำเริบ</T>
          <T v="caption" color={palette.inkSoft}>{r.elementReason}</T>
        </View>
      </Section>
      <Section i={2} title="สมุนไพร / ตำรับที่แนะนำ" icon={<Leaf size={20} color={palette.green} />}>
        {r.herbs.map((x) => (
          <View key={x.name} style={styles.herbRow}>
            <T v="bodyStrong">{x.name}</T>
            <T v="callout" color={palette.inkSoft}>{x.how}</T>
          </View>
        ))}
      </Section>
      <Section i={3} title="ข้อควรระวัง และสัญญาณอันตราย" tint={palette.coral} icon={<AlertTriangle size={20} color={palette.coral} />}>
        {r.cautions.map((a) => <Bullet key={a} text={a} />)}
        {r.redFlags.map((a) => <Bullet key={a} text={`ส่งต่อทันที: ${a}`} color={palette.coral} />)}
      </Section>
      <Section i={4} title="ครูปัญญาขอข้อมูลเพิ่มให้ครบ ม.บ.5" tint={palette.violet} icon={<HelpCircle size={20} color={palette.violet} />}>
        {r.askMore.map((a) => <Bullet key={a} text={a} />)}
        <T v="caption" color={palette.inkMute} style={{ marginTop: 6 }}>แตะ “เล่าเพิ่ม” เพื่อเติมข้อมูลที่ยังขาด</T>
      </Section>
      <T v="caption" center color={palette.inkMute}>คำแนะนำเบื้องต้นจาก AI ไม่ใช่การวินิจฉัยแทนแพทย์</T>
    </>
  );
}

function WisdomView({ r }: { r: WisdomResult }) {
  return (
    <>
      <Animated.View entering={FadeInDown.delay(140).springify()}>
        <View style={styles.scroll}>
          <T v="micro" color="#8A6A1E">สมุดข่อยดิจิทัล · หน้าใหม่</T>
          <T v="h1" color={palette.ink} style={{ marginTop: 4 }}>{r.title}</T>
          <T v="callout" color={palette.inkSoft}>{r.summary}</T>
          <View style={styles.rule} />
          <T v="bodyStrong" color={palette.ink}>ตัวยา</T>
          {r.ingredients.map((x) => <Bullet key={x} text={x} />)}
          <T v="bodyStrong" color={palette.ink} style={{ marginTop: space.md }}>วิธีปรุงและวิธีใช้</T>
          <T v="body">{r.method}</T>
          <T v="bodyStrong" color={palette.ink} style={{ marginTop: space.md }}>สรรพคุณ</T>
          <T v="body">{r.indication}</T>
        </View>
      </Animated.View>
      <Section i={2} title="ข้อควรระวัง" tint={palette.coral} icon={<AlertTriangle size={22} color={palette.coral} />}>
        <T v="body">{r.caution}</T>
      </Section>
      <Section i={3} title="ครูปัญญาอยากรู้เพิ่ม" tint="#8A6A1E" icon={<HelpCircle size={22} color={palette.orange} />}>
        <T v="title" color={palette.ink}>“{r.followUp}”</T>
        <T v="caption" color={palette.inkMute} style={{ marginTop: 6 }}>แตะ “ตอบต่อ” เพื่อเล่าเพิ่ม ความรู้ส่วนนี้มักไม่มีในตำรา</T>
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingBottom: 6 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  question: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: palette.peach, borderRadius: radius.md, padding: space.md, marginHorizontal: space.lg, marginBottom: space.sm },
  hint: { marginTop: space.xl, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: palette.primarySoft },
  controls: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around', paddingHorizontal: space.xl },
  stop: { width: 72, height: 72, borderRadius: 36, backgroundColor: palette.coral, alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: palette.coralSoft },
  sideBtn: { width: 64, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 4 },
  input: { minHeight: 220, backgroundColor: palette.surface, borderRadius: 30, paddingHorizontal: space.xl, padding: space.lg, fontSize: 17, color: palette.ink, textAlignVertical: 'top', borderWidth: 1, borderColor: palette.line },
  haloIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: palette.line, alignItems: 'center', justifyContent: 'center' },
  dockWrap: { position: 'absolute', left: space.md, right: space.md },
  dock: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6, borderRadius: radius.pill },
  element: { marginTop: space.md, padding: space.md, borderRadius: radius.md },
  mbRow: { flexDirection: 'row', gap: space.sm, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  herbRow: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  scroll: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: space.xl,
    marginBottom: space.md,
  },
  rule: { height: 1, backgroundColor: palette.line, marginVertical: space.md },
});

export default function Capture() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { isPractitioner } = useApp();
  // เล่าอาการผู้ป่วย = การรักษา → เฉพาะหมอพื้นบ้านที่ยืนยันแล้ว
  if (mode === 'patient' && !isPractitioner) return <VerifyPrompt />;
  return <CaptureInner />;
}
