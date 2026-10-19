import { MenuView } from '../components/Menu';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Alert } from '../lib/alert';
import { TextInput } from '../components/AppText';
import Animated, { FadeIn, FadeInDown, FadeInUp, useAnimatedKeyboard, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chat, chatQuick, transcribe, type ChatMsg } from '../api/ai';
import { AISphere } from '../components/AISphere';
import { useSpeaker, useVoiceRecorder } from '../components/audio';
import { Sym } from '../components/ios';
import { Waveform } from '../components/Orb';
import { createSpeech, listenOnce, type SpeechCtl } from '../components/speech';
import { Glass, GlassCircle, PressableScale, T, useHaptic } from '../components/ui';
import { askLaunch } from '../lib/askLaunch';
import { citedSources, think, tidyReply } from '../lib/brain';
import { deleteThread, getThread, loadChats, newThreadId, onChatsChange, saveThread, whenLabel, type ChatSource, type ChatThread, type StoredMsg } from '../lib/chatStore';
import { useApp } from '../store/app';
import { control, palette } from '../theme';

const SUGGEST = [
  { q: 'ผู้สูงอายุปวดเข่า ใช้สมุนไพรอะไรดี', sym: 'figure.walk' },
  { q: 'ตั้งตำรับยาแก้ท้องอืดจากขิง ข่า ตะไคร้ ผสมอย่างไร', sym: 'flask' },
  { q: 'ฟ้าทะลายโจร ห้ามใช้กับใคร', sym: 'exclamationmark.shield' },
  { q: 'ยาสมุนไพรกินคู่กับยาความดันได้ไหม', sym: 'pills' },
] as const;

type Msg = StoredMsg;

/** ประวัติการคุยที่ส่งให้ AI (ข้อความล่าสุด ~12 ข้อ ไม่รวมข้อความที่ล้มเหลว) */
const historyFor = (msgs: Msg[]): ChatMsg[] => msgs.filter((m) => !m.failed).slice(-12).map(({ role, content }) => ({ role, content }));

/** คำถามที่ใช้ค้นความรู้: คำถามล่าสุด + คำถามก่อนหน้า (คงบริบทเวลาถามต่อเนื่อง) */
const queryFor = (msgs: Msg[]) =>
  msgs
    .filter((x) => x.role === 'user')
    .slice(-2)
    .map((x) => x.content)
    .join(' ');

/** หน้าแชทครูปัญญา — พิมพ์/พูดทีละคำถาม · โหมดคุยด้วยเสียงต่อเนื่อง · ประวัติแชทหลายห้อง */
export default function Assistant() {
  const { q, voice } = useLocalSearchParams<{ q?: string; voice?: string }>();
  const insets = useSafeAreaInsets();
  const { settings, wisdoms } = useApp();
  const h = useHaptic();
  const tts = useSpeaker();
  const rec = useVoiceRecorder();
  const scroll = useRef<ScrollView>(null);
  const [threadId, setThreadId] = useState(newThreadId);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const msgsRef = useRef<Msg[]>([]);
  msgsRef.current = msgs;
  const mounted = useRef(true);
  useEffect(() => () => void (mounted.current = false), []);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
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
        const brain = think(queryFor(history), { wisdoms, mode });
        const messages: ChatMsg[] = [{ role: 'system', content: brain.system }, ...historyFor(history)];
        // แชท: 2 โมเดลช่วยกันคิดแล้วรวมคำตอบ (แม่นกว่า) · เสียง: โมเดลเดียวตอบเร็ว (คุยลื่นไม่เงียบนาน)
        const raw = mode === 'voice' ? await chatQuick(messages, 420) : await chat(messages, settings.model, brain.sources.length ? 1100 : 800);
        const reply = tidyReply(raw, mode);
        const a: Msg = { id: `a${Date.now()}`, role: 'assistant', content: reply, sources: citedSources(reply, brain), voice: mode === 'voice' };
        commit([...msgsRef.current, a]);
        return a;
      } catch {
        const e: Msg = { id: `e${Date.now()}`, role: 'assistant', content: 'ขออภัยครับ ตอนนี้เชื่อมต่อครูปัญญาไม่ได้ ลองใหม่อีกครั้งนะครับ', failed: true };
        commit([...msgsRef.current, e]);
        return e;
      }
    },
    [commit, settings.model, wisdoms],
  );

  const send = async (content: string) => {
    if (!content.trim() || busy) return;
    h.tap();
    setText('');
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
  };
  const openThread = async (id: string) => {
    const t = await getThread(id);
    if (!t) return;
    tts.stop();
    setThreadId(t.id);
    msgsRef.current = t.msgs;
    setMsgs(t.msgs);
    setHistoryOpen(false);
  };

  const openSource = (s: ChatSource) => router.push(s.kind === 'herb' ? `/herb/${s.id}` : `/wisdom/${s.id}`);
  const status = busy ? 'กำลังคิด…' : tts.speaking ? 'กำลังพูด…' : rec.isRecording ? 'กำลังฟัง…' : 'พร้อมช่วยคุณหมอ';

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
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 110, gap: 12 }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        showsVerticalScrollIndicator={false}
      >
        {/* ก้อนแสงครูปัญญา: ใหญ่ตอนยังไม่คุย · เล็กติดด้านบนเมื่อเริ่มคุย */}
        <View style={{ alignItems: 'center', paddingTop: msgs.length ? 0 : 12 }}>
          {/* ระหว่างโหมดเสียง ลูกแก้วของหน้าแชทถูกทับอยู่ → ไม่ต้องวาด (ประหยัดแบต) */}
          {voiceOn ? <View style={{ height: msgs.length ? 90 : 190 }} /> : <AISphere size={msgs.length ? 90 : 190} active={busy || tts.speaking || rec.isRecording} level={(tts.speaking ? tts.level : rec.level) as any} />}
        </View>
        {msgs.length === 0 && (
          <Animated.View entering={FadeIn.duration(300)}>
            <T v="h2" color="#FFFFFF" center style={{ marginTop: 8 }}>ถามอะไรก็ได้ครับ</T>
            <T v="callout" center color="rgba(255,255,255,0.6)" style={{ marginTop: 6, alignSelf: 'center', maxWidth: 310 }}>
              สมุนไพร การตั้งตำรับ-ผสมยา ธาตุเจ้าเรือน หรือความปลอดภัยของยา
            </T>
            {/* ปุ่มเข้าโหมดคุยด้วยเสียง */}
            <PressableScale haptic="press" scaleTo={0.97} onPress={() => (Keyboard.dismiss(), setVoiceOn(true))} style={styles.voiceCta} accessibilityLabel="คุยด้วยเสียง">
              <Sym name="waveform" size={20} color="#04150E" />
              <T v="bodyStrong" color="#04150E">คุยด้วยเสียง</T>
            </PressableScale>
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
              <View style={[styles.bubble, styles.ai, m.failed && { backgroundColor: 'rgba(217,83,74,0.25)' }]}>
                <T v="body" color="#FFFFFF">{m.content}</T>
              </View>
              {/* ที่มา: ตำราในคลังภูมิ / สมุนไพรในคลัง — กดเปิดดู */}
              {m.sources?.length ? (
                <View style={styles.sources}>
                  <T v="micro" color="rgba(255,255,255,0.55)" style={{ fontWeight: '600' }}>อ้างอิงจากคลัง</T>
                  <View style={styles.sourceRow}>
                    {m.sources.map((src) => (
                      <PressableScale key={`${src.kind}${src.id}`} haptic="select" onPress={() => openSource(src)} style={styles.sourceChip} accessibilityLabel={`เปิด ${src.title}`}>
                        <Sym name={src.kind === 'herb' ? 'leaf.fill' : 'book.closed.fill'} size={12} color={MINT} />
                        <T v="caption" color="#FFFFFF" numberOfLines={1} style={{ maxWidth: 220, fontWeight: '600' }}>{src.title}</T>
                      </PressableScale>
                    ))}
                  </View>
                </View>
              ) : null}
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
        <Animated.View style={scrollPad} />
      </ScrollView>

      {/* แถบมืดลอย: ไมค์ · ช่องพิมพ์ · ส่ง/คุยด้วยเสียง */}
      <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, dockLift]}>
        <View style={[styles.darkDock, { bottom: insets.bottom ? 24 : 16 }]}>
          <View style={styles.typeRow}>
            <PressableScale haptic="none" onPress={toggleMic} style={[styles.send, { backgroundColor: rec.isRecording ? palette.coral : palette.primarySoft }]} accessibilityLabel={rec.isRecording ? 'หยุดพูด' : 'พูด'}>
              <Sym name={rec.isRecording ? 'stop.fill' : 'mic.fill'} size={17} color={rec.isRecording ? palette.white : palette.primaryDeep} />
            </PressableScale>
            {rec.isRecording ? (
              <View style={{ flex: 1, height: 38, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }}>
                <Waveform level={rec.level} bars={16} />
              </View>
            ) : (
              <TextInput value={text} onChangeText={setText} placeholder="ถามครูปัญญา" placeholderTextColor="#9AA19D" multiline style={styles.typeInput} accessibilityLabel="พิมพ์คำถาม" />
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

      <HistorySheet visible={historyOpen} current={threadId} onClose={() => setHistoryOpen(false)} onOpen={openThread} onNew={() => (newChat(), setHistoryOpen(false))} />
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

/* ───────────── ประวัติแชท (แผ่นแบบ iOS) ───────────── */
function HistorySheet({ visible, current, onClose, onOpen, onNew }: { visible: boolean; current: string; onClose: () => void; onOpen: (id: string) => void; onNew: () => void }) {
  const [list, setList] = useState<ChatThread[]>([]);
  useEffect(() => {
    if (!visible) return;
    const reload = () => loadChats().then((l) => setList([...l]));
    reload();
    return onChatsChange(reload);
  }, [visible]);
  const remove = (t: ChatThread) =>
    Alert.alert('ลบแชทนี้?', t.title, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: () => deleteThread(t.id) },
    ]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
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
          <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
            {list.map((t) => {
              const lastA = [...t.msgs].reverse().find((m) => m.role === 'assistant' && !m.failed);
              const on = t.id === current;
              return (
                <MenuView
                  key={t.id}
                  shouldOpenOnLongPress
                  themeVariant="dark"
                  actions={[{ id: 'delete', title: 'ลบแชทนี้', image: 'trash', imageColor: '#E5484D', attributes: { destructive: true } }]}
                  onPressAction={({ nativeEvent }) => nativeEvent.event === 'delete' && remove(t)}
                >
                  <PressableScale haptic="select" scaleTo={0.98} onPress={() => onOpen(t.id)} style={[styles.threadRow, on && { borderColor: 'rgba(124,240,168,0.55)' }]} accessibilityLabel={`${t.title} ${whenLabel(t.updatedAt)}`}>
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
              );
            })}
            <T v="caption" color="rgba(255,255,255,0.4)" center style={{ marginTop: 6 }}>กดค้างที่แชทเพื่อลบ · เก็บไว้ในเครื่องนี้เท่านั้น</T>
          </ScrollView>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 }}>
            <Sym name="clock.arrow.circlepath" size={34} color="rgba(255,255,255,0.35)" />
            <T v="callout" color="rgba(255,255,255,0.6)" center>ยังไม่มีประวัติแชท</T>
          </View>
        )}
      </View>
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
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderCurve: 'continuous', gap: 4 },
  user: { backgroundColor: palette.primary, borderBottomRightRadius: 6 },
  ai: { backgroundColor: 'rgba(255,255,255,0.1)', borderBottomLeftRadius: 6 },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 20, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)' },
  suggestIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(124,240,168,0.14)', alignItems: 'center', justifyContent: 'center' },
  voiceCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'center', marginTop: 20, height: 50, paddingHorizontal: 26, borderRadius: 25, backgroundColor: MINT },
  sources: { marginTop: 8, marginLeft: 4, gap: 6, maxWidth: '88%' },
  sourceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sourceChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(124,240,168,0.14)', borderWidth: 1, borderColor: 'rgba(124,240,168,0.3)' },
  listen: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, marginLeft: 6, height: 28 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
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
  threadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
});
