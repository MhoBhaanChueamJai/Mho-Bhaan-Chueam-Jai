import { MenuView } from '../components/Menu';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Alert } from '../lib/alert';
import { TextInput } from '../components/AppText';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut, LinearTransition, useAnimatedKeyboard, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chat, chatQuick, transcribe, type ChatMsg } from '../api/ai';
import { AISphere } from '../components/AISphere';
import { useSpeaker, useVoiceRecorder } from '../components/audio';
import { Sym } from '../components/ios';
import { Waveform } from '../components/Orb';
import { createSpeech, listenOnce, type SpeechCtl } from '../components/speech';
import { Glass, GlassCircle, PressableScale, T, useHaptic } from '../components/ui';
import { askLaunch } from '../lib/askLaunch';
import { citedSources, herbsMentioned, think, tidyReply, isSymptomQ } from '../lib/brain';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { herbs as HERBS, type Herb } from '../data/herbs';
import { findPatient, patientCtx } from '../lib/patientRef';
import { guardReply } from '../lib/safety';
import { useDoctor } from '../components/useDoctor';
import { clearChats, deleteThread, getThread, loadChats, newThreadId, onChatsChange, saveThread, whenLabel, type ChatSource, type ChatThread, type StoredMsg } from '../lib/chatStore';
import { useApp } from '../store/app';
import { control, palette } from '../theme';
import { AiDownBanner } from '../components/AiDownBanner';
import { AI_DOWN_MSG, checkAi } from '../lib/aiHealth';
import { COLUMN, column, useLayout } from '../components/layout';
import { PlanDark, PlanResult } from '../components/PlanCard';
import { shortCite } from '../lib/sources';
import { consultToPlan, consultTurn, type ConsultFacts } from '../lib/consult';
import type { Turn } from '../lib/intake';
import { treatmentPlan, type TreatmentPlan } from '../lib/plan';
import { chatQA } from '../lib/chatQA';
import { FAQ_CATS, faqList, makeQuiz, type Faq, type FaqCat, type QuizQ } from '../lib/qa';

/* ── ปรึกษาอาการในแชท: ครูปัญญาซักประวัติทีละข้อ → แนวทางแผนไทย / แผนปัจจุบัน ── */
const CONSULT_OPEN = 'เล่าอาการให้ครูปัญญาฟังได้เลยครับ เป็นอะไร ตรงไหน เป็นมานานเท่าไร';
const CONSULT_QUICK = ['ไข้ ตัวร้อน', 'ไอ เจ็บคอ', 'ปวดหัว', 'ท้องอืด แน่นท้อง', 'ท้องเสีย', 'ปวดเมื่อย ปวดหลัง', 'นอนไม่หลับ', 'ผื่นคัน'];
const PLAN_NOW = 'พอแล้ว ดูแนวทางเลย';
const FIRST_AID = 'ดูการดูแลเบื้องต้น';
type Consult = { facts: ConsultFacts; turns: Turn[]; qa: { q: string; a: string }[]; planned: boolean };
/** สรุปแนวทางเป็นข้อความ (ให้ AI เห็นในประวัติแชท เวลาถามต่อ) */
const planText = (p: TreatmentPlan) =>
  [
    'แนวทางจากครูปัญญา',
    p.thaiDx && `แผนไทย: ${p.thaiDx}`,
    p.modernDx && `แผนปัจจุบัน: ${p.modernDx}`,
    p.thai.length ? `แนวทางแผนไทย: ${p.thai.map((x) => x.text).join(' · ')}` : '',
    p.modern.length ? `ยาสามัญประจำบ้าน: ${p.modern.map((x) => x.text).join(' · ')}` : '',
    p.followUp && `ติดตามอาการ: ${p.followUp}`,
  ]
    .filter(Boolean)
    .join('\n');

const SUGGEST = [
  { q: 'ผู้สูงอายุปวดเข่า ใช้สมุนไพรอะไรดี', sym: 'figure.walk' },
  { q: 'ตั้งตำรับยาแก้ท้องอืดจากขิง ข่า ตะไคร้ ผสมอย่างไร', sym: 'flask' },
  { q: 'ฟ้าทะลายโจร ห้ามใช้กับใคร', sym: 'exclamationmark.shield' },
  { q: 'ยาสมุนไพรกินคู่กับยาความดันได้ไหม', sym: 'pills' },
] as const;

type Msg = StoredMsg;

/** ประวัติการคุยที่ส่งให้ AI (ข้อความล่าสุด ~16 ข้อ ไม่รวมข้อความที่ล้มเหลว) */
const historyFor = (msgs: Msg[]): ChatMsg[] => msgs.filter((m) => !m.failed).slice(-16).map(({ role, content }) => ({ role, content }));

/** คำถามที่ใช้ค้นความรู้: คำถามล่าสุด + คำถามก่อนหน้า (คงบริบทเวลาถามต่อเนื่อง) */
const queryFor = (msgs: Msg[]) =>
  msgs
    .filter((x) => x.role === 'user')
    .slice(-2)
    .map((x) => x.content)
    .join(' ');

/** สมุนไพรที่คำตอบพูดถึง (จากป้ายอ้างอิง + ชื่อในข้อความ) → แสดงรูปให้ดู */
function herbsIn(m: StoredMsg): Herb[] {
  if (m.role !== 'assistant' || m.failed || m.quiz || m.faq) return [];
  const fromRefs = (m.sources ?? []).map((x) => (x.kind === 'herb' ? x.id : x.id.startsWith('herb:') ? x.id.slice(5) : '')).filter(Boolean);
  const byId = HERBS.filter((h) => fromRefs.includes(h.id));
  const pos = (h: Herb) => {
    const i = m.content.indexOf(h.name);
    return i < 0 ? 1e9 : i;
  };
  // เรียงตามลำดับที่พูดถึงในคำตอบ
  return [...new Map([...herbsMentioned(m.content), ...byId].map((h) => [h.id, h])).values()].sort((a, b) => pos(a) - pos(b)).slice(0, 8);
}

/** แถบรูปสมุนไพรใต้คำตอบ — แตะเพื่อเปิดหน้าสมุนไพร */
function HerbStrip({ list }: { list: Herb[] }) {
  if (!list.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.herbStrip} contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
      {list.map((h) => (
        <PressableScale key={h.id} haptic="select" scaleTo={0.95} onPress={() => router.push(`/herb/${h.id}`)} style={styles.herbCard} accessibilityLabel={`ดูสมุนไพร ${h.name}`}>
          <Image source={h.image} style={styles.herbImg} contentFit="cover" transition={150} />
          <T v="caption" color="#FFFFFF" numberOfLines={1} style={{ fontWeight: '700' }}>{h.name}</T>
          <T v="micro" color="rgba(255,255,255,0.55)" numberOfLines={1}>รส{h.taste}</T>
        </PressableScale>
      ))}
    </ScrollView>
  );
}

/** คำถามที่พบบ่อยในแชท: เลือกหมวด → แตะคำถาม → ได้คำตอบจากคลังความรู้ทันที (ไม่ต้องรอ AI) */
function FaqBrowser({ onPick }: { onPick: (f: Faq) => void }) {
  const all = React.useMemo(faqList, []);
  const [cat, setCat] = useState<FaqCat | null>(null);
  const [n, setN] = useState(6);
  const list = all.filter((x) => !cat || x.cat === cat);
  return (
    <View style={styles.faqBox}>
      <View style={styles.optRowWide}>
        {[null, ...FAQ_CATS].map((c) => {
          const on = cat === c;
          return (
            <PressableScale key={c ?? 'all'} haptic="select" scaleTo={0.95} onPress={() => (setCat(c), setN(6))} style={[styles.opt, on && styles.optPlan]} accessibilityLabel={`หมวด ${c ?? 'ทั้งหมด'}`} accessibilityState={{ selected: on }}>
              <T v="caption" color={on ? '#04150E' : '#FFFFFF'} style={{ fontWeight: '700' }}>{c ?? 'ทั้งหมด'}</T>
            </PressableScale>
          );
        })}
      </View>
      {list.slice(0, n).map((f) => (
        <PressableScale key={f.id} haptic="select" scaleTo={0.98} onPress={() => onPick(f)} style={styles.followChip} accessibilityLabel={f.q}>
          <Sym name="questionmark.circle.fill" size={14} color={MINT} />
          <T v="subhead" color="#FFFFFF" style={{ flexShrink: 1 }}>{f.q}</T>
        </PressableScale>
      ))}
      {list.length > n ? (
        <PressableScale haptic="select" onPress={() => setN((x) => x + 8)} style={styles.more} accessibilityLabel="ดูคำถามเพิ่ม">
          <T v="caption" color={MINT} style={{ fontWeight: '700' }}>ดูเพิ่ม ({list.length - n})</T>
        </PressableScale>
      ) : null}
    </View>
  );
}

/** หน้าแชทครูปัญญา — พิมพ์/พูดทีละคำถาม · โหมดคุยด้วยเสียงต่อเนื่อง · ประวัติแชทหลายห้อง */
export default function Assistant() {
  const { q, voice } = useLocalSearchParams<{ q?: string; voice?: string }>();
  const insets = useSafeAreaInsets();
  // จอกว้าง: แถบพิมพ์กว้างเท่าคอลัมน์อ่าน อยู่กึ่งกลาง
  const dockSide = useLayout().side(COLUMN.read - 48, 24);
  const { settings, wisdoms, patients, update } = useApp();
  const dr = useDoctor();
  // ความจำข้ามแชท: หัวข้อที่คุณหมอเคยถามในห้องแชทอื่นล่าสุด (เก็บในเครื่อง)
  const [topics, setTopics] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    const load = () => loadChats().then((all) => setTopics([...all].sort((a, b) => b.updatedAt - a.updatedAt).filter((t) => t.title).slice(0, 9).map(({ id, title }) => ({ id, title }))));
    load();
    return onChatsChange(load);
  }, []);
  const h = useHaptic();
  const tts = useSpeaker();
  const rec = useVoiceRecorder();
  const scroll = useRef<ScrollView>(null);
  const [threadId, setThreadId] = useState(newThreadId);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const msgsRef = useRef<Msg[]>([]);
  msgsRef.current = msgs;
  const mounted = useRef(true);
  useEffect(() => {
    // ตั้งกลับเป็น true ทุกครั้งที่ mount (Fast Refresh / StrictMode เรียก cleanup แล้ว mount ใหม่)
    mounted.current = true;
    return () => void (mounted.current = false);
  }, []);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyKind, setBusyKind] = useState<'chat' | 'consult' | 'plan'>('chat');
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  // เปิดจากปุ่มไมค์หน้าหลัก → เข้าโหมดคุยด้วยเสียงทันที
  const [voiceOn, setVoiceOn] = useState(voice === '1');
  const kb = useAnimatedKeyboard();
  const dockLift = useAnimatedStyle(() => ({ transform: [{ translateY: -Math.max(0, kb.height.value - 16) }] }));
  const scrollPad = useAnimatedStyle(() => ({ height: Math.max(0, kb.height.value - 16) }));

  /** อัปเดตข้อความ + บันทึกห้องแชท */
  const commit = useCallback(
    (next: Msg[]) => {
      msgsRef.current = next;
      if (mounted.current) setMsgs(next);
      saveThread(threadId, next).catch(() => {});
    },
    [threadId],
  );

  /** ถามครูปัญญา 1 คำถาม (ใช้ทั้งโหมดพิมพ์และโหมดเสียง) → คืนคำตอบ */
  const ask = useCallback(
    async (content: string, mode: 'chat' | 'voice'): Promise<Msg> => {
      const user: Msg = { id: `u${Date.now()}`, role: 'user', content: content.trim(), voice: mode === 'voice' };
      const history = [...msgsRef.current, user];
      commit(history);
      try {
        // ผู้ป่วยที่คุณหมอเอ่ยชื่อในแชทนี้ (ล่าสุดก่อน) → แนบข้อมูลและประวัติการรักษาให้ครูปัญญา
        const who = findPatient(history.filter((m) => m.role === 'user').map((m) => m.content), patients);
        const doctor = { name: dr.name, types: dr.types, topics: topics.filter((t) => t.id !== threadId).map((t) => t.title) };
        const brain = think(queryFor(history), { wisdoms, mode, patient: who ? patientCtx(who) : null, latest: user.content, doctor });
        const messages: ChatMsg[] = [{ role: 'system', content: brain.system }, ...historyFor(history)];
        // แชท: ให้เวลาคิดนานกว่า · เสียง: คำตอบสั้น ตอบเร็ว (คุยลื่นไม่เงียบนาน)
        const raw = mode === 'voice' ? await chatQuick(messages, 420) : await chat(messages, settings.model, brain.sources.length ? 1100 : 800, { deep: brain.deep });
        const reply = guardReply(tidyReply(raw, mode), brain.flags, brain.conflicts, mode);
        const a: Msg = { id: `a${Date.now()}`, role: 'assistant', content: reply, sources: citedSources(reply, brain), voice: mode === 'voice', ...(mode === 'chat' && isSymptomQ(user.content) ? { consult: user.content } : {}) };
        commit([...msgsRef.current, a]);
        // ถาม-ตอบต่อ (เบื้องหลัง): คำถามกลับพร้อมตัวเลือก + คำถามต่อที่แนะนำ — ไม่ทำให้คำตอบช้า
        if (mode === 'chat')
          chatQA(user.content, reply)
            .then((qa) => {
              if (!mounted.current || (!qa.ask && !qa.follow.length)) return;
              const asked = qa.ask && !reply.includes(qa.ask.q.slice(0, 12));
              commit(msgsRef.current.map((x) => (x.id === a.id ? { ...x, content: asked ? `${x.content}\n\n${qa.ask!.q}` : x.content, askOpts: qa.ask?.options, follow: qa.follow } : x)));
              // ตัวเลือก/คำถามต่อขึ้นมาทีหลัง → เลื่อนให้เห็น (ไม่ให้จมใต้แถบพิมพ์)
              setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 150);
            })
            .catch(() => {});
        return a;
      } catch {
        const down = !(await checkAi(true));
        const e: Msg = { id: `e${Date.now()}`, role: 'assistant', content: down ? `ขออภัยครับ ${AI_DOWN_MSG}` : 'ขออภัยครับ ตอนนี้เชื่อมต่อครูปัญญาไม่ได้ ลองใหม่อีกครั้งนะครับ', failed: true };
        commit([...msgsRef.current, e]);
        return e;
      }
    },
    [commit, settings.model, wisdoms, patients, dr.name, dr.types, topics, threadId],
  );

  // ── ปรึกษาอาการ (ซักประวัติในแชท) ──
  const [cs, setCsState] = useState<Consult | null>(null);
  const csRef = useRef<Consult | null>(null);
  const setCs = (c: Consult | null) => ((csRef.current = c), setCsState(c));
  const say = (m: Omit<Msg, 'id' | 'role'>) => commit([...msgsRef.current, { id: `a${Date.now()}${Math.random().toString(36).slice(2, 5)}`, role: 'assistant', ...m }]);

  const makePlan = async (c: Consult) => {
    setBusyKind('plan');
    setBusy(true);
    try {
      const pairs = c.turns.flatMap((t, i) => (t.role === 'ai' && c.turns[i + 1]?.role === 'user' ? [{ q: t.text, a: c.turns[i + 1].text }] : []));
      const { person, input } = consultToPlan(c.facts, [...pairs, ...c.qa]);
      const plan = await treatmentPlan(person, input);
      if (!mounted.current) return;
      setCs({ ...c, planned: true });
      say({ content: planText(plan), plan });
      h.success();
    } catch {
      say({ content: 'ขออภัยครับ ตอนนี้ครูปัญญาวางแนวทางไม่ได้ ลองใหม่อีกครั้งนะครับ', failed: true, options: [PLAN_NOW] });
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  /** ตอบ 1 ข้อระหว่างซักประวัติ */
  const consultSend = async (answer: string, addUser = true) => {
    const c = csRef.current;
    if (!c) return;
    const a = answer.trim();
    if (!a) return;
    if (addUser) commit([...msgsRef.current, { id: `u${Date.now()}`, role: 'user', content: a }]);
    if (a === PLAN_NOW || a === FIRST_AID) return makePlan(c);
    setBusyKind('consult');
    setBusy(true);
    const r = await consultTurn(c.facts, c.turns, a);
    if (!mounted.current) return;
    setBusy(false);
    const turns: Turn[] = [...c.turns, { role: 'user', text: a }];
    if (r.urgent.length) {
      setCs({ ...c, facts: r.facts, turns });
      h.warn();
      return say({ content: 'อาการแบบนี้อาจอันตรายครับ ควรไปโรงพยาบาลหรือโทร 1669 ทันที', urgent: r.urgent, options: [FIRST_AID] });
    }
    if (r.done) return makePlan({ ...c, facts: r.facts, turns });
    setCs({ ...c, facts: r.facts, turns: [...turns, { role: 'ai', text: r.reply }] });
    say({ content: r.reply, options: r.options });
  };

  /** เริ่มปรึกษาอาการ (จากปุ่ม หรือจากคำถามเรื่องอาการที่ถามไปแล้ว) */
  const startConsult = (seed?: string) => {
    h.select();
    tts.stop();
    Keyboard.dismiss();
    const c: Consult = { facts: {}, turns: [{ role: 'ai', text: CONSULT_OPEN }], qa: [], planned: false };
    setCs(c);
    if (seed) {
      say({ content: 'ได้ครับ ขอถามเพิ่มอีกนิดเพื่อแนะนำได้ตรงขึ้นนะครับ' });
      consultSend(seed, false);
    } else say({ content: CONSULT_OPEN, options: CONSULT_QUICK });
  };
  /** ตอบคำถามซักประวัติเพิ่มในการ์ดแนวทาง → วางแนวทางใหม่ */
  const refine = (more: { q: string; a: string }[]) => {
    const c = csRef.current;
    if (!c) return;
    const next = { ...c, qa: [...c.qa.filter((x) => !more.some((m) => m.q === x.q)), ...more] };
    setCs(next);
    makePlan(next);
  };
  // ── คำถามที่พบบ่อย / แบบทดสอบความรู้ ในแชท (ไม่ต้องไปหน้าอื่น · ไม่ต้องรอ AI) ──
  const toSources = (refs: { id: string; label: string }[]) => refs.map((r) => ({ id: r.id, title: r.label, kind: 'doc' as const }));
  const startFaq = () => {
    h.select();
    setCs(null);
    say({ content: 'คำถามที่พบบ่อยครับ เลือกหมวด แล้วแตะคำถามที่อยากรู้ได้เลย คำตอบมาจากคลังความรู้ในแอป', faq: true });
  };
  const pickFaq = (f: Faq) => {
    h.tap();
    commit([...msgsRef.current, { id: `u${Date.now()}`, role: 'user', content: f.q }]);
    say({ content: f.a, sources: toSources(f.refs), follow: ['อธิบายเพิ่มเติมเรื่องนี้หน่อย', 'คำถามที่พบบ่อยข้ออื่น'] });
  };
  const quizRef = useRef<{ qs: QuizQ[]; i: number; score: number } | null>(null);
  const askQuiz = () => {
    const z = quizRef.current;
    if (!z) return;
    const q = z.qs[z.i];
    say({ content: `ข้อ ${z.i + 1}/${z.qs.length}: ${q.q}`, quiz: q.choices });
  };
  const startQuiz = () => {
    h.select();
    setCs(null);
    quizRef.current = { qs: makeQuiz(10), i: 0, score: 0 };
    say({ content: 'แบบทดสอบความรู้ 10 ข้อครับ แตะคำตอบที่คิดว่าถูก ครูปัญญาเฉลยให้ทันทีพร้อมแหล่งอ้างอิง' });
    askQuiz();
  };
  const answerQuiz = (k: number) => {
    const z = quizRef.current;
    if (!z) return;
    const q = z.qs[z.i];
    const ok = k === q.answer;
    if (ok) z.score++;
    if (ok) h.success();
    else h.warn();
    commit([...msgsRef.current, { id: `u${Date.now()}`, role: 'user', content: q.choices[k] }]);
    say({ content: `${ok ? '✓ ถูกต้องครับ' : `✗ ยังไม่ถูกครับ คำตอบคือ ${q.choices[q.answer]}`}\n${q.explain}`, sources: toSources(q.refs) });
    z.i++;
    if (z.i < z.qs.length) askQuiz();
    else {
      say({ content: `จบแบบทดสอบแล้วครับ ได้ ${z.score}/${z.qs.length} คะแนน ${z.score >= 8 ? 'เก่งมากครับ' : z.score >= 5 ? 'ดีครับ ทบทวนข้อที่ผิดอีกนิดนะครับ' : 'ไม่เป็นไรครับ อ่านเฉลยแล้วลองใหม่อีกรอบ'}`, quizEnd: true });
      quizRef.current = null;
    }
  };
  const answered = cs ? cs.turns.filter((t) => t.role === 'user').length : 0;
  const lastId = msgs[msgs.length - 1]?.id;
  const lastPlanId = [...msgs].reverse().find((x) => x.plan)?.id;

  const send = async (content: string) => {
    if (!content.trim() || busy) return;
    h.tap();
    setText('');
    // กำลังซักประวัติ → คำตอบไปที่ตัวซักประวัติ · ได้แนวทางแล้ว ถามต่อ = คุยปกติ
    if (csRef.current && !csRef.current.planned) return consultSend(content);
    quizRef.current = null;
    setBusyKind('chat');
    setBusy(true);
    const a = await ask(content, 'chat');
    if (!mounted.current) return;
    setBusy(false);
    if (a.failed) return h.warn();
    h.success();
    if (settings.autoSpeak) {
      setSpeakingId(a.id);
      tts.speak(a.content);
    }
  };

  useEffect(() => {
    if (q) send(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    // ยังไม่มีข้อความ = หน้าแนะนำ → อยู่บนสุด (เดิมเลื่อนลงจนลูกแก้วถูกตัดครึ่ง)
    if (!msgs.length && !busy) return;
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 120);
  }, [msgs.length, busy]);
  useEffect(() => {
    if (!tts.speaking) setSpeakingId(null);
  }, [tts.speaking]);
  useEffect(
    () => () => {
      tts.stop();
      // ปิดหน้าแชท → แท็บครูปัญญารู้ว่าต้องพากลับแท็บเดิม (ถ้าแท็บได้โฟกัสก่อนหน้านี้ถอด ใช้ open แทน)
      if (askLaunch.open) {
        askLaunch.open = false;
        askLaunch.justClosed = true;
        setTimeout(() => (askLaunch.justClosed = false), 1500);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** พูดถาม 1 ครั้ง (กดค้างไมค์แบบเดิม): กดเริ่ม-กดหยุด แล้วส่ง */
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

  const newChat = () => {
    h.select();
    tts.stop();
    setThreadId(newThreadId());
    msgsRef.current = [];
    setMsgs([]);
    setText('');
    setCs(null);
    quizRef.current = null;
  };
  const openThread = async (id: string) => {
    const t = await getThread(id);
    if (!t) return;
    tts.stop();
    setThreadId(t.id);
    msgsRef.current = t.msgs;
    setMsgs(t.msgs);
    setHistoryOpen(false);
    setCs(null);
  };

  /** ให้คะแนนคำตอบ (เก็บในห้องแชท) · ไม่ถูกใจ → ถามว่าจะแจ้งทีมพัฒนาไหม */
  const rate = (m: Msg, r: 1 | -1) => {
    const list = msgsRef.current;
    const next = list.map((x) => (x.id === m.id ? { ...x, rating: x.rating === r ? undefined : r } : x));
    commit(next);
    if (r !== -1 || m.rating === -1) return;
    const i = list.findIndex((x) => x.id === m.id);
    const q = [...list.slice(0, i)].reverse().find((x) => x.role === 'user')?.content ?? '';
    Alert.alert('ขอบคุณที่บอกครับ', 'อยากแจ้งให้ทีมพัฒนาดูคำตอบนี้ไหม จะได้ปรับครูปัญญาให้ตอบดีขึ้น', [
      { text: 'ไม่เป็นไร', style: 'cancel' },
      { text: 'แจ้งทีมพัฒนา', onPress: () => router.push({ pathname: '/feedback', params: { kind: 'bug', text: `คำตอบของครูปัญญาไม่ถูกต้อง/ไม่ตรงคำถาม\n(เล่าเพิ่มได้ว่าผิดตรงไหน)\n\nคำถาม: ${q}\n\nคำตอบ: ${m.content}` } }) },
    ]);
  };
  const openSource = (s: ChatSource) => (s.kind === 'doc' ? router.push({ pathname: '/source', params: { id: s.id } }) : router.push(s.kind === 'herb' ? `/herb/${s.id}` : `/wisdom/${s.id}`));
  const status = busy ? 'กำลังคิด…' : tts.speaking ? 'กำลังพูด…' : rec.isRecording ? 'กำลังฟัง…' : settings.userKind === 'clinician' ? 'พร้อมช่วยคุณหมอ' : 'พร้อมช่วยคุณ';

  return (
    <View style={{ flex: 1, backgroundColor: DARK }}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* หัว: กลับ · ชื่อ+สถานะ · ประวัติแชท / แชทใหม่ */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        {/* กว้างเท่าแถบเครื่องมือฝั่งขวา → ชื่ออยู่กึ่งกลางจอพอดี */}
        <View style={{ width: 92, alignItems: 'flex-start' }}>
          <GlassCircle label="กลับ" onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} tint="rgba(255,255,255,0.12)">
            <Sym name="chevron.left" size={18} color="#FFFFFF" weight="semibold" />
          </GlassCircle>
        </View>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <T v="title" color="#FFFFFF">ครูปัญญา</T>
          <T v="micro" color={busy || rec.isRecording ? MINT : 'rgba(255,255,255,0.55)'}>{status}</T>
        </View>
        {/* แถบเครื่องมือ (กระจกแคปซูลเดียว แบบ toolbar ของ iOS): ประวัติแชท · แชทใหม่ */}
        <Glass interactive tint="rgba(255,255,255,0.12)" style={styles.toolbar}>
          <PressableScale haptic="select" scaleTo={0.9} onPress={() => setHistoryOpen(true)} style={styles.toolBtn} accessibilityLabel="ประวัติแชท">
            <Sym name="clock.arrow.circlepath" size={18} color="#FFFFFF" weight="semibold" />
          </PressableScale>
          <PressableScale haptic="select" scaleTo={0.9} onPress={newChat} style={styles.toolBtn} accessibilityLabel="แชทใหม่">
            <Sym name="square.and.pencil" size={18} color="#FFFFFF" weight="semibold" />
          </PressableScale>
        </Glass>
      </View>

      <ScrollView
        ref={scroll}
        contentContainerStyle={[{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 110, gap: 12 }, column.read]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        showsVerticalScrollIndicator={false}
      >
        <AiDownBanner dark />
        {/* ก้อนแสงครูปัญญา: ใหญ่ตอนยังไม่คุย · เล็กติดด้านบนเมื่อเริ่มคุย */}
        <View style={{ alignItems: 'center', paddingTop: msgs.length ? 0 : 12 }}>
          {/* ระหว่างโหมดเสียง ลูกแก้วของหน้าแชทถูกทับอยู่ → ไม่ต้องวาด (ประหยัดแบต) */}
          {voiceOn ? <View style={{ height: msgs.length ? 90 : 132 }} /> : <AISphere size={msgs.length ? 90 : 132} active={busy || tts.speaking || rec.isRecording} level={(tts.speaking ? tts.level : rec.level) as any} />}
        </View>
        {msgs.length === 0 && (
          <Animated.View entering={FadeIn.duration(300)}>
            <T v="h2" color="#FFFFFF" center style={{ marginTop: 8 }}>ถามอะไรก็ได้ครับ</T>
            <T v="callout" center color="rgba(255,255,255,0.6)" style={{ marginTop: 6, alignSelf: 'center', maxWidth: 310 }}>
              ปรึกษาอาการ สมุนไพร การตั้งตำรับ-ผสมยา หรือความปลอดภัยของยา
            </T>
            {/* ปุ่มเข้าโหมดคุยด้วยเสียง */}
            <PressableScale haptic="press" scaleTo={0.97} onPress={() => (Keyboard.dismiss(), setVoiceOn(true))} style={styles.voiceCta} accessibilityLabel="คุยด้วยเสียง">
              <Sym name="waveform" size={20} color="#04150E" />
              <T v="bodyStrong" color="#04150E">คุยด้วยเสียง</T>
            </PressableScale>
            {/* ผู้ใช้ครั้งแรก: แนะนำสิ่งที่ทำได้ (ปิดแล้วไม่ขึ้นอีก) */}
            {!settings.assistantTip ? (
              <Animated.View entering={FadeIn.duration(260)} style={styles.tip}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Sym name="sparkles" size={14} color={MINT} />
                  <T v="subhead" color="#FFFFFF" style={{ fontWeight: '700', flex: 1 }}>ครูปัญญาทำอะไรได้บ้าง</T>
                </View>
                <T v="caption" color="rgba(255,255,255,0.75)">• ปรึกษาอาการ: ถามทีละข้อ แล้วเสนอแนวทางแผนไทยหรือแผนปัจจุบัน</T>
                <T v="caption" color="rgba(255,255,255,0.75)">• ถามอะไรก็ได้ ครูปัญญาอาจถามกลับพร้อมปุ่มให้แตะตอบ และมี “ถามต่อ” ให้แตะ</T>
                <T v="caption" color="rgba(255,255,255,0.75)">• ทุกคำตอบบอกแหล่งอ้างอิง แตะป้ายเพื่ออ่านต้นฉบับ แตะรูปสมุนไพรเพื่อดูรายละเอียด</T>
                <PressableScale haptic="select" onPress={() => update({ assistantTip: true })} style={styles.tipBtn} accessibilityLabel="เข้าใจแล้ว ปิดคำแนะนำ">
                  <T v="subhead" color="#04150E" style={{ fontWeight: '700' }}>เข้าใจแล้ว</T>
                </PressableScale>
              </Animated.View>
            ) : null}
            {/* เมนูกล่อง 2×2: ปรึกษาอาการ · สแกนสมุนไพร / คำถามที่พบบ่อย · แบบทดสอบความรู้ */}
            <View style={[styles.qaRow, { marginTop: 16 }]}>
              <PressableScale haptic="select" scaleTo={0.97} onPress={() => startConsult()} style={styles.qaCard} accessibilityLabel="ปรึกษาอาการ ครูปัญญาซักประวัติและเสนอแนวทางรักษา">
                <Sym name="stethoscope" size={20} color={MINT} />
                <T v="bodyStrong" color="#FFFFFF">ปรึกษาอาการ</T>
                <T v="caption" color="rgba(255,255,255,0.55)">ซักประวัติ แนะนำแนวทาง</T>
              </PressableScale>
              <PressableScale haptic="select" scaleTo={0.97} onPress={() => router.push('/herb/scan')} style={styles.qaCard} accessibilityLabel="สแกนสมุนไพร ถ่ายภาพให้ครูปัญญาบอกชื่อ">
                <Sym name="camera.viewfinder" size={20} color={MINT} />
                <T v="bodyStrong" color="#FFFFFF">สแกนสมุนไพร</T>
                <T v="caption" color="rgba(255,255,255,0.55)">ถ่ายภาพ ครูปัญญาบอกชื่อ</T>
              </PressableScale>
            </View>
            <View style={styles.qaRow}>
              <PressableScale haptic="select" scaleTo={0.97} onPress={startFaq} style={styles.qaCard} accessibilityLabel="คำถามที่พบบ่อย">
                <Sym name="questionmark.bubble.fill" size={20} color={MINT} />
                <T v="bodyStrong" color="#FFFFFF">คำถามที่พบบ่อย</T>
                <T v="caption" color="rgba(255,255,255,0.55)">คำตอบจากคลังความรู้</T>
              </PressableScale>
              <PressableScale haptic="select" scaleTo={0.97} onPress={startQuiz} style={styles.qaCard} accessibilityLabel="แบบทดสอบความรู้">
                <Sym name="graduationcap.fill" size={20} color={MINT} />
                <T v="bodyStrong" color="#FFFFFF">แบบทดสอบความรู้</T>
                <T v="caption" color="rgba(255,255,255,0.55)">10 ข้อ พร้อมเฉลย</T>
              </PressableScale>
            </View>
            <T v="subhead" color="rgba(255,255,255,0.5)" style={{ marginTop: 26, marginBottom: 10, marginLeft: 4 }}>คำถามแนะนำ</T>
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
                {m.voice ? <Sym name="waveform" size={12} color="rgba(255,255,255,0.7)" /> : null}
                <T v="body" color={palette.white}>{m.content}</T>
              </View>
            </Animated.View>
          ) : (
            <Animated.View key={m.id} entering={FadeInUp.duration(220)} style={{ alignItems: 'flex-start' }}>
              {m.plan ? (
                <View style={{ alignSelf: 'stretch' }}>
                  <PlanDark.Provider value>
                    <PlanResult plan={m.plan} busy={busy} onRefine={cs && m.id === lastPlanId ? refine : undefined} />
                  </PlanDark.Provider>
                </View>
              ) : (
                <View style={[styles.bubble, styles.ai, m.failed && { backgroundColor: 'rgba(217,83,74,0.25)' }, m.urgent && styles.urgentBubble]}>
                  {m.urgent ? <Sym name="exclamationmark.triangle.fill" size={16} color="#FF9F8A" /> : null}
                  <T v={m.urgent ? 'bodyStrong' : 'body'} color="#FFFFFF">{m.content}</T>
                  {m.urgent?.map((u) => (
                    <T key={u} v="caption" color="rgba(255,255,255,0.8)">• {u}</T>
                  ))}
                  {m.urgent ? (
                    <PressableScale haptic="press" onPress={() => Linking.openURL('tel:1669')} style={styles.callBtn} accessibilityLabel="โทร 1669">
                      <Sym name="phone.fill" size={14} color="#FFFFFF" />
                      <T v="subhead" color="#FFFFFF" style={{ fontWeight: '700' }}>โทร 1669</T>
                    </PressableScale>
                  ) : null}
                </View>
              )}
              {/* ตัวเลือกคำตอบ (เฉพาะคำถามล่าสุดระหว่างซักประวัติ) */}
              {cs && !cs.planned && m.options?.length && m.id === lastId && !busy ? (
                <View style={styles.optRow}>
                  {[...m.options, ...(answered >= 2 && !m.urgent && !m.options.includes(PLAN_NOW) ? [PLAN_NOW] : [])].map((o) => (
                    <PressableScale key={o} haptic="select" scaleTo={0.95} onPress={() => (h.tap(), consultSend(o))} style={[styles.opt, o === PLAN_NOW && styles.optPlan]} accessibilityLabel={`ตอบ ${o}`}>
                      {o === PLAN_NOW ? <Sym name="forward.fill" size={11} color="#04150E" /> : null}
                      <T v="subhead" color={o === PLAN_NOW ? '#04150E' : '#FFFFFF'} style={{ fontWeight: '600' }}>{o}</T>
                    </PressableScale>
                  ))}
                </View>
              ) : null}
              {/* ที่มา: ตำราในคลังภูมิ / สมุนไพรในคลัง — กดเปิดดู */}
              {/* รูปสมุนไพรที่คำตอบพูดถึง */}
              <HerbStrip list={herbsIn(m)} />
              {m.sources?.length ? (
                <View style={styles.sources}>
                  <T v="micro" color="rgba(255,255,255,0.55)" style={{ fontWeight: '600' }}>อ้างอิงจากคลัง</T>
                  <View style={styles.sourceRow}>
                    {[...new Map(m.sources.map((x) => [shortCite(x.title), { ...x, title: shortCite(x.title) }])).values()].map((src) => (
                      <PressableScale key={`${src.kind}${src.id}`} haptic="select" onPress={() => openSource(src)} style={styles.sourceChip} accessibilityLabel={`เปิด ${src.title}`}>
                        <Sym name={src.kind === 'herb' ? 'leaf.fill' : src.kind === 'doc' ? 'checkmark.seal.fill' : 'book.closed.fill'} size={12} color={MINT} />
                        <T v="caption" color="#FFFFFF" numberOfLines={1} style={{ maxWidth: 220, fontWeight: '600' }}>{src.title}</T>
                      </PressableScale>
                    ))}
                  </View>
                </View>
              ) : null}
              {m.consult && !m.failed && !cs ? (
                <PressableScale haptic="select" onPress={() => startConsult(m.consult)} style={styles.consultLink} accessibilityLabel="ให้ครูปัญญาซักประวัติละเอียดและเสนอแนวทาง">
                  <Sym name="stethoscope" size={14} color={MINT} />
                  <T v="caption" color="#FFFFFF" style={{ fontWeight: '600' }}>ให้ครูปัญญาซักประวัติละเอียด แล้วเลือกแผนไทย/แผนปัจจุบัน</T>
                </PressableScale>
              ) : null}
              {m.faq ? <FaqBrowser onPick={pickFaq} /> : null}
              {m.quiz && m.id === lastId && quizRef.current ? (
                <View style={styles.optRowWide}>
                  {m.quiz.map((c, k) => (
                    <PressableScale key={k} haptic="none" scaleTo={0.97} onPress={() => answerQuiz(k)} style={styles.quizChoice} accessibilityLabel={`ตัวเลือก ${c}`}>
                      <View style={styles.quizLetter}>
                        <T v="caption" color="#04150E" style={{ fontWeight: '800' }}>{'กขคง'[k]}</T>
                      </View>
                      <T v="subhead" color="#FFFFFF" style={{ flexShrink: 1 }}>{c}</T>
                    </PressableScale>
                  ))}
                </View>
              ) : null}
              {m.quizEnd && m.id === lastId ? (
                <View style={styles.optRow}>
                  <PressableScale haptic="select" scaleTo={0.95} onPress={startQuiz} style={[styles.opt, styles.optPlan]} accessibilityLabel="ทำแบบทดสอบใหม่">
                    <Sym name="arrow.clockwise" size={12} color="#04150E" />
                    <T v="subhead" color="#04150E" style={{ fontWeight: '700' }}>ทำแบบทดสอบใหม่</T>
                  </PressableScale>
                </View>
              ) : null}
              {/* ครูปัญญาถามกลับ → แตะตอบ · คำถามต่อที่แนะนำ (เฉพาะคำตอบล่าสุด) */}
              {m.id === lastId && !busy && !(cs && !cs.planned) && m.askOpts?.length ? (
                <View style={styles.optRow}>
                  {m.askOpts.map((o) => (
                    <PressableScale key={o} haptic="select" scaleTo={0.95} onPress={() => send(o)} style={styles.opt} accessibilityLabel={`ตอบ ${o}`}>
                      <T v="subhead" color="#FFFFFF" style={{ fontWeight: '600' }}>{o}</T>
                    </PressableScale>
                  ))}
                </View>
              ) : null}
              {m.id === lastId && !busy && !(cs && !cs.planned) && m.follow?.length ? (
                <View style={styles.followBox}>
                  <T v="micro" color="rgba(255,255,255,0.5)" style={{ fontWeight: '600' }}>ถามต่อ</T>
                  {m.follow.map((f) => (
                    <PressableScale key={f} haptic="select" scaleTo={0.98} onPress={() => (f === 'คำถามที่พบบ่อยข้ออื่น' ? startFaq() : send(f))} style={styles.followChip} accessibilityLabel={`ถามต่อ ${f}`}>
                      <Sym name="arrow.turn.down.right" size={12} color={MINT} />
                      <T v="subhead" color="#FFFFFF" style={{ flexShrink: 1 }}>{f}</T>
                    </PressableScale>
                  ))}
                </View>
              ) : null}
              {!m.failed && !m.plan && !m.options && !m.urgent && !m.faq && !m.quiz && (
                <View style={styles.actRow}>
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
                  {/* คำตอบดีไหม: ไม่ถูกใจ → เสนอให้แจ้งทีมพัฒนา (แนบคำถามและคำตอบให้แล้ว) */}
                  <PressableScale haptic="select" hitSlop={control.hitSlop} onPress={() => rate(m, 1)} style={styles.rate} accessibilityLabel="คำตอบนี้ดี" accessibilityState={{ selected: m.rating === 1 }}>
                    <Sym name={m.rating === 1 ? 'hand.thumbsup.fill' : 'hand.thumbsup'} size={16} color={m.rating === 1 ? MINT : 'rgba(255,255,255,0.55)'} />
                  </PressableScale>
                  <PressableScale haptic="select" hitSlop={control.hitSlop} onPress={() => rate(m, -1)} style={styles.rate} accessibilityLabel="คำตอบนี้ไม่ดี" accessibilityState={{ selected: m.rating === -1 }}>
                    <Sym name={m.rating === -1 ? 'hand.thumbsdown.fill' : 'hand.thumbsdown'} size={16} color={m.rating === -1 ? '#FF9F8A' : 'rgba(255,255,255,0.55)'} />
                  </PressableScale>
                </View>
              )}
            </Animated.View>
          ),
        )}
        {busy && <Typing kind={busyKind} />}
        <Animated.View style={scrollPad} />
      </ScrollView>

      {/* แถบมืดลอย: ไมค์ · ช่องพิมพ์ · ส่ง/คุยด้วยเสียง */}
      <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, dockLift]}>
        {/* เนื้อหาที่เลื่อนลงใต้แถบพิมพ์ค่อยๆ จางหาย (เดิมเห็นตัวหนังสือโผล่ใต้แถบ) */}
        <LinearGradient pointerEvents="none" colors={[`${DARK}00`, DARK]} locations={[0, 0.55]} style={styles.dockFade} />
        <View style={[styles.darkDock, { bottom: insets.bottom ? 24 : 16, left: dockSide, right: dockSide }]}>
          <View style={styles.typeRow}>
            <PressableScale haptic="none" onPress={toggleMic} style={[styles.send, { backgroundColor: rec.isRecording ? palette.coral : palette.primarySoft }]} accessibilityLabel={rec.isRecording ? 'หยุดพูด' : 'พูด'}>
              <Sym name={rec.isRecording ? 'stop.fill' : 'mic.fill'} size={17} color={rec.isRecording ? palette.white : palette.primaryDeep} />
            </PressableScale>
            {rec.isRecording ? (
              <View style={{ flex: 1, height: 38, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }}>
                <Waveform level={rec.level} bars={16} />
              </View>
            ) : (
              <TextInput value={text} onChangeText={setText} placeholder={cs && !cs.planned ? 'พิมพ์คำตอบ' : 'ถามครูปัญญา'} placeholderTextColor="#9AA19D" multiline style={styles.typeInput} accessibilityLabel="พิมพ์คำถาม" />
            )}
            {text.trim() ? (
              <PressableScale haptic="press" onPress={() => send(text)} accessibilityLabel="ส่ง" style={[styles.send, { backgroundColor: palette.primary }]}>
                <Sym name="arrow.up" size={17} color="#FFFFFF" weight="bold" />
              </PressableScale>
            ) : (
              <PressableScale haptic="press" onPress={() => (Keyboard.dismiss(), setVoiceOn(true))} accessibilityLabel="คุยด้วยเสียง" style={[styles.send, { backgroundColor: '#1F2A24' }]}>
                <Sym name="waveform" size={17} color={MINT} weight="bold" />
              </PressableScale>
            )}
          </View>
        </View>
      </Animated.View>

      {voiceOn ? (
        <VoiceMode
          greet={!msgs.length}
          last={msgs.filter((m) => !m.failed).slice(-2)}
          ask={(t) => ask(t, 'voice')}
          onClose={() => {
            setVoiceOn(false);
            h.select();
          }}
        />
      ) : null}

      <HistorySheet visible={historyOpen} current={threadId} onClose={() => setHistoryOpen(false)} onOpen={openThread} onNew={() => (newChat(), setHistoryOpen(false))} onCurrentDeleted={newChat} />
    </View>
  );
}

/* ───────────── โหมดคุยด้วยเสียง (ต่อเนื่องแบบคุยกับคนจริง) ───────────── */
type Phase = 'greeting' | 'listening' | 'hearing' | 'thinking' | 'speaking' | 'paused';

function VoiceMode({ greet, last, ask, onClose }: { greet: boolean; last: Msg[]; ask: (t: string) => Promise<Msg>; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const h = useHaptic();
  const rec = useVoiceRecorder();
  const speakLevel = useSharedValue(0);
  const speech = useRef<SpeechCtl | null>(null);
  if (!speech.current) speech.current = createSpeech(speakLevel);
  const [phase, setPhase] = useState<Phase>('greeting');
  const [heardText, setHeardText] = useState(last.find((m) => m.role === 'user')?.content ?? '');
  const [replyText, setReplyText] = useState(last.find((m) => m.role === 'assistant')?.content ?? '');
  const alive = useRef(true);
  const submit = useRef(false);
  const resume = useRef<(() => void) | null>(null);
  const micLevel = useDerivedValue(() => withTiming(rec.level.value, { duration: 120 }));
  const level = useDerivedValue(() => (phase === 'speaking' || phase === 'greeting' ? speakLevel.value : micLevel.value));

  useEffect(() => {
    alive.current = true;
    Keyboard.dismiss();
    const loop = async () => {
      setPhase('greeting');
      await speech.current!.speak(greet ? 'สวัสดีครับคุณหมอ วันนี้มีอะไรให้ครูปัญญาช่วยครับ' : 'ว่ามาได้เลยครับคุณหมอ');
      let misses = 0;
      while (alive.current) {
        submit.current = false;
        setPhase('listening');
        const r = await listenOnce(rec, { alive: () => alive.current, submit: () => submit.current, onHeard: () => alive.current && setPhase('hearing') });
        if (!alive.current) return;
        if (!r.text) {
          misses += r.heard ? 0 : 1;
          if (r.heard) {
            // ได้ยินแต่ถอดไม่ออก → ขอให้พูดใหม่ (ไม่นับเป็นความเงียบ)
            setPhase('speaking');
            await speech.current!.speak('ขอโทษครับ ไม่ค่อยได้ยิน พูดอีกครั้งได้ไหมครับ');
            continue;
          }
          if (misses >= 2) {
            // เงียบนาน → พักไว้ แตะลูกแก้วเพื่อคุยต่อ (ไม่เปิดไมค์ค้างไว้)
            setPhase('paused');
            await new Promise<void>((res) => (resume.current = res));
            resume.current = null;
            misses = 0;
          }
          continue;
        }
        misses = 0;
        h.select();
        setHeardText(r.text);
        setReplyText('');
        setPhase('thinking');
        const a = await ask(r.text);
        if (!alive.current) return;
        setReplyText(a.content);
        setPhase('speaking');
        await speech.current!.speak(a.content);
      }
    };
    loop();
    return () => {
      alive.current = false;
      resume.current?.();
      speech.current?.stop();
      rec.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** แตะลูกแก้ว: ตอนฟัง = ส่งเลย · ตอนพูด = ขัดจังหวะแล้วฟัง · ตอนพัก = คุยต่อ */
  const tapOrb = () => {
    h.press();
    if (phase === 'listening' || phase === 'hearing') submit.current = true;
    else if (phase === 'speaking' || phase === 'greeting') speech.current?.stop();
    else if (phase === 'paused') resume.current?.();
  };

  const label = { greeting: 'ครูปัญญากำลังทักทาย', listening: 'กำลังฟัง… พูดได้เลยครับ', hearing: 'กำลังฟัง…', thinking: 'กำลังคิด…', speaking: 'ครูปัญญากำลังพูด', paused: 'แตะลูกแก้วเพื่อคุยต่อ' }[phase];
  const hint = { greeting: 'แตะลูกแก้วเพื่อข้าม', listening: 'พูดจบแล้วรอสักครู่ หรือแตะลูกแก้วเพื่อส่ง', hearing: 'แตะลูกแก้วเพื่อส่งทันที', thinking: '', speaking: 'แตะลูกแก้วเพื่อขัดจังหวะแล้วพูดต่อได้เลย', paused: '' }[phase];

  return (
    // ไม่ใช้แอนิเมชันความโปร่งที่ตัวหน้า (ปุ่มกระจก Liquid Glass ไม่แสดงใต้ตัวจางเข้า)
    <View style={[StyleSheet.absoluteFill, styles.voicePage]}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <View style={{ width: 44 }} />
        <View style={{ alignItems: 'center' }}>
          <T v="title" color="#FFFFFF">คุยด้วยเสียง</T>
          <T v="micro" color="rgba(255,255,255,0.55)">ครูปัญญา</T>
        </View>
        <GlassCircle label="จบการคุยด้วยเสียง" onPress={onClose} tint="rgba(255,255,255,0.12)">
          <Sym name="xmark" size={17} color="#FFFFFF" weight="semibold" />
        </GlassCircle>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
        <Pressable onPress={tapOrb} accessibilityRole="button" accessibilityLabel={label}>
          <AISphere size={250} active={phase !== 'paused'} level={level as any} />
        </Pressable>
        <View style={styles.statusPill}>
          {phase === 'listening' || phase === 'hearing' ? <View style={styles.liveDot} /> : null}
          <T v="subhead" color="rgba(255,255,255,0.88)">{label}</T>
        </View>
        {phase === 'listening' || phase === 'hearing' ? (
          <View style={{ width: 180, marginTop: 12 }}>
            <Waveform level={micLevel as any} bars={20} />
          </View>
        ) : null}
        {/* คำบรรยาย: สิ่งที่หมอพูด + คำตอบล่าสุด */}
        <View style={{ marginTop: 22, gap: 12, alignSelf: 'stretch' }}>
          {heardText ? (
            <Animated.View key={`h${heardText}`} entering={FadeInDown.duration(260)}>
              <T v="callout" color="rgba(255,255,255,0.55)" center numberOfLines={2}>“{heardText}”</T>
            </Animated.View>
          ) : null}
          {replyText && phase !== 'thinking' ? (
            <Animated.View key={`r${replyText.slice(0, 20)}`} entering={FadeInDown.duration(320)}>
              <ScrollView style={{ maxHeight: 190 }} showsVerticalScrollIndicator={false}>
                <T v="body" color="#FFFFFF" center style={{ lineHeight: 26 }}>{replyText}</T>
              </ScrollView>
            </Animated.View>
          ) : null}
        </View>
      </View>

      <View style={{ paddingBottom: insets.bottom + 18, alignItems: 'center', gap: 14 }}>
        {hint ? <T v="caption" color="rgba(255,255,255,0.45)" center>{hint}</T> : null}
        <PressableScale haptic="press" onPress={onClose} style={styles.endBtn} accessibilityLabel="กลับไปพิมพ์">
          <Sym name="keyboard" size={17} color="#FFFFFF" />
          <T v="bodyStrong" color="#FFFFFF">กลับไปพิมพ์</T>
        </PressableScale>
      </View>
    </View>
  );
}

/** แถวแชทในประวัติ: แตะเปิด · ปัดซ้ายเพื่อลบ · กดค้างเปิดเมนู */
function ThreadRow({ t, on, onOpen, onDelete }: { t: ChatThread; on: boolean; onOpen: () => void; onDelete: () => void }) {
  const h = useHaptic();
  const sw = useRef<SwipeableMethods>(null);
  // กำลังปัด/ปัดค้างอยู่ → แตะแถว = ปิดปุ่มลบ ไม่เปิดแชท
  const moved = useRef(false);
  const open = useRef(false);
  const lastA = [...t.msgs].reverse().find((m) => m.role === 'assistant' && !m.failed);
  const press = () => {
    if (moved.current) return;
    if (open.current) return sw.current?.close();
    onOpen();
  };
  return (
    <Animated.View exiting={FadeOut.duration(180)} layout={LinearTransition.duration(240)}>
      <ReanimatedSwipeable
        ref={sw}
        containerStyle={{ overflow: 'visible' }}
        onSwipeableOpenStartDrag={() => (moved.current = true)}
        onSwipeableWillOpen={() => (open.current = true)}
        onSwipeableWillClose={() => (open.current = false)}
        onSwipeableClose={() => (moved.current = false)}
        onSwipeableOpen={() => setTimeout(() => (moved.current = false), 250)}
        friction={1.6}
        rightThreshold={40}
        overshootRight={false}
        renderRightActions={() => (
          <PressableScale haptic="none" scaleTo={0.92} onPress={() => (h.warn(), onDelete())} accessibilityLabel={`ลบแชท ${t.title}`} style={styles.swipeDel}>
            <Sym name="trash.fill" size={17} color="#FFFFFF" />
            <T v="caption" color="#FFFFFF" style={{ fontWeight: '700' }}>ลบ</T>
          </PressableScale>
        )}
      >
        <MenuView
          shouldOpenOnLongPress
          themeVariant="dark"
          actions={[{ id: 'delete', title: 'ลบแชทนี้', image: 'trash', imageColor: '#E5484D', attributes: { destructive: true } }]}
          onPressAction={({ nativeEvent }) => nativeEvent.event === 'delete' && onDelete()}
        >
          <PressableScale haptic="select" scaleTo={0.98} onPress={press} style={[styles.threadRow, on && { borderColor: 'rgba(124,240,168,0.55)' }]} accessibilityLabel={`${t.title} ${whenLabel(t.updatedAt)}`} accessibilityHint="ปัดไปทางซ้ายเพื่อลบ">
            <View style={styles.suggestIcon}>
              <Sym name={t.msgs.some((m) => m.voice) ? 'waveform' : 'bubble.left.and.text.bubble.right'} size={16} color={MINT} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="bodyStrong" color="#FFFFFF" numberOfLines={1}>{t.title}</T>
              {lastA ? <T v="caption" color="rgba(255,255,255,0.55)" numberOfLines={1}>{lastA.content}</T> : null}
            </View>
            <T v="micro" color="rgba(255,255,255,0.45)">{whenLabel(t.updatedAt)}</T>
          </PressableScale>
        </MenuView>
      </ReanimatedSwipeable>
    </Animated.View>
  );
}

/* ───────────── ประวัติแชท (แผ่นแบบ iOS) ───────────── */
function HistorySheet({ visible, current, onClose, onOpen, onNew, onCurrentDeleted }: { visible: boolean; current: string; onClose: () => void; onOpen: (id: string) => void; onNew: () => void; onCurrentDeleted: () => void }) {
  const [list, setList] = useState<ChatThread[]>([]);
  useEffect(() => {
    if (!visible) return;
    const reload = () => loadChats().then((l) => setList([...l]));
    reload();
    return onChatsChange(reload);
  }, [visible]);
  // ปัดซ้ายแล้วแตะ "ลบ" (ตั้งใจลบแล้ว ไม่ต้องถามซ้ำ)
  const remove = (t: ChatThread) => {
    deleteThread(t.id);
    // ลบแชทที่เปิดอยู่ → หน้าแชทเริ่มใหม่ (ไม่ให้บันทึกกลับมาอีก)
    if (t.id === current) onCurrentDeleted();
  };
  const removeAll = () =>
    Alert.alert('ลบประวัติแชททั้งหมด?', `${list.length} แชท จะถูกลบออกจากเครื่องนี้ และกู้คืนไม่ได้`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบทั้งหมด',
        style: 'destructive',
        onPress: () => {
          clearChats();
          onCurrentDeleted();
        },
      },
    ]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* Modal ของ iOS แยกลำดับชั้นออกไป → ต้องมี GestureHandlerRootView ของตัวเอง ไม่งั้นปัดลบไม่ทำงาน */}
      <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.sheet}>
        <View style={styles.sheetHead}>
          <PressableScale haptic="select" onPress={onClose} hitSlop={10} accessibilityLabel="ปิด">
            <T v="body" color={MINT}>ปิด</T>
          </PressableScale>
          <T v="title" color="#FFFFFF">ประวัติแชท</T>
          <PressableScale haptic="select" onPress={onNew} hitSlop={10} accessibilityLabel="แชทใหม่">
            <Sym name="square.and.pencil" size={20} color={MINT} />
          </PressableScale>
        </View>
        {list.length ? (
          <ScrollView contentContainerStyle={[{ padding: 16, gap: 10, paddingBottom: 40 }, column.read]}>
            {list.map((t) => (
              <ThreadRow key={t.id} t={t} on={t.id === current} onOpen={() => onOpen(t.id)} onDelete={() => remove(t)} />
            ))}
            <PressableScale haptic="select" scaleTo={0.97} onPress={removeAll} style={styles.clearAll} accessibilityLabel="ลบประวัติแชททั้งหมด">
              <Sym name="trash" size={15} color="#FF9F8A" />
              <T v="subhead" color="#FF9F8A" style={{ fontWeight: '700' }}>ลบประวัติแชททั้งหมด</T>
            </PressableScale>
            <T v="caption" color="rgba(255,255,255,0.4)" center style={{ marginTop: 2 }}>ปัดแชทไปทางซ้ายเพื่อลบ · ประวัติเก็บไว้ในเครื่องนี้เท่านั้น</T>
          </ScrollView>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 }}>
            <Sym name="clock.arrow.circlepath" size={34} color="rgba(255,255,255,0.35)" />
            <T v="callout" color="rgba(255,255,255,0.6)" center>ยังไม่มีประวัติแชท</T>
          </View>
        )}
      </View>
      </GestureHandlerRootView>
    </Modal>
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
/** ระหว่างรอ: จุดกำลังพิมพ์ + บอกว่าครูปัญญากำลังทำอะไร (เปลี่ยนข้อความทุก ~3.5 วินาที) */
const WAIT: Record<'chat' | 'consult' | 'plan', string[]> = {
  chat: ['กำลังค้นคลังความรู้…', 'กำลังเรียบเรียงคำตอบ…', 'ใกล้เสร็จแล้วครับ…'],
  consult: ['กำลังคิดคำถามถัดไป…'],
  plan: ['กำลังค้นแนวทางจากตำรา…', 'กำลังตรวจความปลอดภัยของยา…', 'กำลังสรุปแนวทางแผนไทย / แผนปัจจุบัน…', 'ใกล้เสร็จแล้วครับ…'],
};
function Typing({ kind = 'chat' }: { kind?: keyof typeof WAIT }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    const id = setInterval(() => setI((x) => Math.min(x + 1, WAIT[kind].length - 1)), 3500);
    return () => clearInterval(id);
  }, [kind]);
  return (
    <Animated.View entering={FadeIn} style={{ alignSelf: 'flex-start', gap: 6 }}>
      <View style={[styles.bubble, styles.ai, { flexDirection: 'row', gap: 5, paddingVertical: 16, alignSelf: 'flex-start' }]}>
        <Dot d={0} />
        <Dot d={140} />
        <Dot d={280} />
      </View>
      <Animated.View key={`${kind}${i}`} entering={FadeIn.duration(250)}>
        <T v="caption" color="rgba(255,255,255,0.55)" style={{ marginLeft: 6 }}>{WAIT[kind][i]}</T>
      </Animated.View>
    </Animated.View>
  );
}

/** ธีมมืดเหมือนหน้าโหมดเสียง (ก้อนแสง AI เด่นบนพื้นดำ) */
const DARK = '#000000';
const MINT = '#7CF0A8';

const styles = StyleSheet.create({
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderCurve: 'continuous', gap: 4 },
  user: { backgroundColor: palette.primary, borderBottomRightRadius: 6 },
  ai: { backgroundColor: 'rgba(255,255,255,0.1)', borderBottomLeftRadius: 6 },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 20, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)' },
  suggestIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(124,240,168,0.14)', alignItems: 'center', justifyContent: 'center' },
  herbStrip: { marginTop: 10, alignSelf: 'stretch', overflow: 'visible' },
  herbCard: { width: 104, gap: 2, padding: 6, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  herbImg: { width: 92, height: 92, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 4 },
  faqBox: { gap: 8, marginTop: 10, alignSelf: 'stretch' },
  optRowWide: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, alignSelf: 'stretch' },
  more: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center', paddingHorizontal: 6 },
  quizChoice: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  quizLetter: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: MINT },
  tip: { gap: 5, marginTop: 18, padding: 14, borderRadius: 20, borderCurve: 'continuous', backgroundColor: 'rgba(124,240,168,0.1)', borderWidth: 1, borderColor: 'rgba(124,240,168,0.3)' },
  tipBtn: { alignSelf: 'flex-start', marginTop: 6, height: 34, paddingHorizontal: 16, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: MINT },
  qaRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  qaCard: { flex: 1, gap: 4, padding: 14, borderRadius: 20, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  followBox: { gap: 6, marginTop: 10, marginLeft: 4, alignSelf: 'stretch', maxWidth: '92%' },
  followChip: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(124,240,168,0.25)' },
  optRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, maxWidth: '92%' },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  optPlan: { backgroundColor: MINT, borderColor: MINT },
  urgentBubble: { backgroundColor: 'rgba(217,83,74,0.32)', gap: 6 },
  callBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 4, height: 38, paddingHorizontal: 16, borderRadius: 19, backgroundColor: '#D9534A' },
  voiceCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'center', marginTop: 20, height: 50, paddingHorizontal: 26, borderRadius: 25, backgroundColor: MINT },
  actRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rate: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  consultLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginLeft: 4, paddingHorizontal: 12, minHeight: 34, borderRadius: 17, backgroundColor: 'rgba(124,240,168,0.14)', maxWidth: '88%' },
  sources: { marginTop: 8, marginLeft: 4, gap: 6, maxWidth: '88%' },
  sourceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sourceChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(124,240,168,0.14)', borderWidth: 1, borderColor: 'rgba(124,240,168,0.3)' },
  listen: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, marginLeft: 6, height: 28 },
  top: { ...column.read, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  dockFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150 },
  darkDock: { position: 'absolute', left: 24, right: 24, padding: 8, borderRadius: 32, borderCurve: 'continuous', backgroundColor: 'rgba(28,30,29,0.96)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.22)', boxShadow: '0px 10px 30px rgba(0,0,0,0.6)' },
  typeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, minHeight: 50, paddingHorizontal: 6, paddingVertical: 6, borderRadius: 25, backgroundColor: '#FFFFFF' },
  typeInput: { flex: 1, maxHeight: 120, fontSize: 17, color: '#1F2A24', paddingTop: 8, paddingBottom: 8, paddingHorizontal: 4 },
  send: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  voicePage: { backgroundColor: DARK, zIndex: 50 },
  toolbar: { flexDirection: 'row', alignItems: 'center', width: 92, height: 44, borderRadius: 22, paddingHorizontal: 4 },
  toolBtn: { width: 42, height: 44, alignItems: 'center', justifyContent: 'center' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.1)' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5A4E' },
  endBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 50, paddingHorizontal: 24, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.25)' },
  sheet: { flex: 1, backgroundColor: '#111312' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.12)' },
  swipeDel: { width: 78, marginLeft: 8, borderRadius: 18, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: '#E5484D' },
  clearAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', minHeight: 44, marginTop: 10, paddingHorizontal: 18, borderRadius: 22, backgroundColor: 'rgba(255,159,138,0.1)' },
  threadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
});
