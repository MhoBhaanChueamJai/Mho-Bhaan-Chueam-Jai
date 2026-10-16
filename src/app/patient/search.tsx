/**
 * ค้นหาผู้ป่วย — เปิดจากปุ่มแว่นขยายบนหัวจอหน้าผู้ป่วย
 * แอนิเมชัน: ปุ่มวงกลม 44pt ที่มุมขวาบน ยืดออกไปทางซ้ายจนเป็นช่องค้นหาเต็มแถว แล้วเปิดคีย์บอร์ด
 * กด "ยกเลิก" → ช่องหดกลับเป็นปุ่มวงกลม แล้วปิดหน้า
 */
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PractitionerGate } from '../../components/PractitionerGate';
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sym, ios } from '../../components/ios';
import { Avatar, PressableScale, T } from '../../components/ui';
import { avatars, lastVisit } from '../../data/mock';
import { statusTone } from '../../data/tones';
import { aiSuggestions, ruleSuggestions, type Suggestion } from '../../lib/searchSuggest';
import { useApp } from '../../store/app';
import { control, elevation, palette } from '../../theme';


const SUG_ICON: Record<Suggestion['icon'], any> = { clock: 'clock.arrow.circlepath', person: 'person.fill', calendar: 'calendar', sparkles: 'sparkles', stethoscope: 'stethoscope' };

/** ไฮไลต์คำที่ค้นในข้อความ */
function Hi({ text, q, v = 'body', color = ios.label, bold }: { text: string; q: string; v?: 'body' | 'subhead' | 'caption'; color?: string; bold?: boolean }) {
  if (!q) return <T v={v} color={color} numberOfLines={1} style={bold ? { fontWeight: '600' } : undefined}>{text}</T>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <T v={v} color={color} numberOfLines={1} style={bold ? { fontWeight: '600' } : undefined}>{text}</T>;
  return (
    <T v={v} color={color} numberOfLines={1} style={bold ? { fontWeight: '600' } : undefined}>
      {text.slice(0, i)}
      <T v={v} color={palette.primary} style={{ fontWeight: '700', backgroundColor: palette.primarySoft }}>{text.slice(i, i + q.length)}</T>
      {text.slice(i + q.length)}
    </T>
  );
}

function PatientSearchInner() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { patients, searchLog, openLog, logSearch, agenda } = useApp();
  const [sugs, setSugs] = useState<Suggestion[]>(() => ruleSuggestions(patients, searchLog, openLog, agenda));
  const [aiState, setAiState] = useState<'loading' | 'ai' | 'rule'>('loading');

  // ให้ครูปัญญาวิเคราะห์พฤติกรรม (แสดงคำแนะนำจากกฎไปก่อนระหว่างรอ)
  useEffect(() => {
    let alive = true;
    aiSuggestions(patients, searchLog, openLog, agenda)
      .then((r) => {
        if (!alive) return;
        if (r.length) {
          setSugs(r);
          setAiState('ai');
        } else setAiState('rule');
      })
      .catch(() => alive && setAiState('rule'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const input = useRef<TextInput>(null);
  const [q, setQ] = useState('');

  // 0 = ปุ่มวงกลม, 1 = ช่องค้นหาเต็มแถว
  const open = useSharedValue(0);
  const PAD = 16;
  const CANCEL = 64;
  const full = width - PAD * 2 - CANCEL;

  useEffect(() => {
    open.value = withSpring(1, { damping: 18, stiffness: 160, mass: 0.8 });
    const t = setTimeout(() => input.current?.focus(), 260);
    return () => clearTimeout(t);
  }, [open]);

  const close = () => {
    Keyboard.dismiss();
    open.value = withTiming(0, { duration: 260, easing: Easing.inOut(Easing.cubic) }, (done) => {
      if (done) runOnJS(router.back)();
    });
  };

  const fieldSt = useAnimatedStyle(() => ({
    width: interpolate(open.value, [0, 1], [control.icon, full]),
    marginRight: interpolate(open.value, [0, 1], [0, CANCEL]),
  }));
  const textSt = useAnimatedStyle(() => ({ opacity: interpolate(open.value, [0.5, 1], [0, 1], 'clamp') }));
  const cancelSt = useAnimatedStyle(() => ({ opacity: interpolate(open.value, [0.6, 1], [0, 1], 'clamp'), transform: [{ translateX: interpolate(open.value, [0, 1], [24, 0]) }] }));
  const bodySt = useAnimatedStyle(() => ({ opacity: interpolate(open.value, [0.3, 1], [0, 1], 'clamp'), transform: [{ translateY: interpolate(open.value, [0, 1], [12, 0]) }] }));

  const results = useMemo(() => {
    const k = q.trim().toLowerCase();
    return patients.filter((p) => {
      if (!k) return true;
      const v = lastVisit(p);
      return [p.name, p.phone, p.chronic, v?.diagnosis, v?.symptoms, p.address.village].filter(Boolean).join(' ').toLowerCase().includes(k);
    });
  }, [patients, q]);
  const searching = !!q.trim();

  return (
    <View style={[styles.page, { paddingTop: insets.top + 8 }]}>
      {/* แถบค้นหา: ปุ่มวงกลมยืดเป็นช่องพิมพ์ */}
      <View style={styles.bar}>
        <Animated.View style={[styles.field, fieldSt]}>
          <Sym name="magnifyingglass" size={17} color={ios.secondary} />
          <Animated.View style={[{ flex: 1 }, textSt]}>
            <TextInput
              ref={input}
              value={q}
              onChangeText={setQ}
              placeholder="ชื่อ อาการ หรือเบอร์โทร"
              placeholderTextColor={ios.tertiary}
              returnKeyType="search"
              onSubmitEditing={() => logSearch(q)}
              style={styles.input}
              accessibilityLabel="ค้นหาผู้ป่วย"
            />
          </Animated.View>
          {q ? (
            <PressableScale haptic="select" onPress={() => setQ('')} style={styles.clear} accessibilityLabel="ล้าง">
              <Sym name="xmark.circle.fill" size={17} color={ios.tertiary} />
            </PressableScale>
          ) : null}
        </Animated.View>
        <Animated.View style={[styles.cancelWrap, cancelSt]}>
          <PressableScale haptic="select" onPress={close} style={styles.cancel} accessibilityLabel="ยกเลิก">
            <T v="body" color={palette.primary}>ยกเลิก</T>
          </PressableScale>
        </Animated.View>
      </View>

      <Animated.View style={[{ flex: 1 }, bodySt]}>
        <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>

          {!searching && sugs.length ? (
            <Animated.View entering={FadeIn.duration(250)} style={[styles.aiCard, elevation.e1]}>
              <View style={styles.aiHead}>
                <View style={styles.aiBadge}>
                  <Sym name="sparkles" size={13} color="#FFFFFF" />
                </View>
                <T v="callout" style={{ fontWeight: '700', flex: 1 }}>ครูปัญญาแนะนำ</T>
                {aiState === 'loading' ? (
                  <ActivityIndicator size="small" color={palette.primary} />
                ) : (
                  <T v="micro" color={ios.tertiary}>{aiState === 'ai' ? 'วิเคราะห์จากการใช้งานของคุณ' : 'จากการใช้งานล่าสุด'}</T>
                )}
              </View>
              <View style={styles.chips}>
                {sugs.map((s, i) => (
                  <Animated.View key={s.q + i} entering={FadeInDown.delay(i * 50).duration(220)}>
                    <PressableScale
                      haptic="select"
                      scaleTo={0.95}
                      onPress={() => {
                        setQ(s.q);
                        logSearch(s.q);
                      }}
                      style={styles.chip}
                      accessibilityLabel={`ค้นหา ${s.q}${s.why ? ` (${s.why})` : ''}`}
                    >
                      <Sym name={SUG_ICON[s.icon]} size={14} color={palette.primary} />
                      <T v="callout" color={palette.primaryDeep} style={{ fontWeight: '600' }} numberOfLines={1}>{s.q}</T>
                    </PressableScale>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          ) : null}

          <T v="caption" color={ios.secondary} style={styles.sec}>
            {searching ? `พบ ${results.length} ราย` : `ผู้ป่วยทั้งหมด ${patients.length} ราย`}
          </T>

          <View style={{ gap: 10 }}>
            {results.map((p, i) => {
              const v = lastVisit(p);
              const st = statusTone[p.status];
              return (
                <Animated.View key={p.id} entering={FadeInDown.delay(Math.min(i, 8) * 40).duration(260)}>
                  <PressableScale
                    scaleTo={0.98}
                    haptic="select"
                    onPress={() => {
                      Keyboard.dismiss();
                      if (q.trim()) logSearch(q);
                      router.replace(`/patient/${p.id}`);
                    }}
                    style={[styles.card, elevation.e1]}
                    accessibilityLabel={p.name}
                  >
                    {/* รูปพร้อมวงสีตามสถานะ */}
                    <View style={[styles.ring, { borderColor: st.fg }]}>
                      <Avatar name={p.name} src={avatars[p.id]} size={50} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={styles.nameRow}>
                        <View style={{ flex: 1 }}>
                          <Hi text={p.name} q={q.trim()} bold />
                        </View>
                        <View style={[styles.status, { backgroundColor: st.bg }]}>
                          <View style={[styles.statusDot, { backgroundColor: st.fg }]} />
                          <T v="micro" color={st.fg}>{p.status}</T>
                        </View>
                      </View>
                      <T v="subhead" color={ios.secondary}>{p.sex} · {p.age} ปี · ธาตุ{p.element}</T>
                      <View style={styles.diag}>
                        <Sym name="stethoscope" size={13} color={palette.primary} />
                        <View style={{ flex: 1 }}>
                          <Hi text={v ? v.diagnosis : 'ยังไม่มีการรักษา'} q={q.trim()} v="subhead" color={ios.label} />
                        </View>
                      </View>
                    </View>
                    <Sym name="chevron.right" size={13} color={ios.tertiary} weight="semibold" />
                  </PressableScale>
                </Animated.View>
              );
            })}
          </View>

          {searching && !results.length ? (
            <Animated.View entering={FadeIn} style={styles.empty}>
              <Sym name="person.crop.circle.badge.questionmark" size={28} color={ios.tertiary} />
              <T v="body" style={{ fontWeight: '600', marginTop: 8 }}>ไม่พบผู้ป่วย</T>
              <T v="callout" color={ios.secondary} center>ลองค้นด้วยชื่อเล่น อาการ หรือเบอร์โทร</T>
            </Animated.View>
          ) : null}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F6F3' },
  bar: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 16, height: 52 },
  field: { height: control.icon, borderRadius: control.icon / 2, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingLeft: 13.5, paddingRight: 6, gap: 8, overflow: 'hidden' },
  input: { fontSize: 17, color: palette.ink, height: control.icon, outlineStyle: 'none' } as any,
  clear: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  cancelWrap: { position: 'absolute', right: 8 },
  cancel: { height: control.icon, paddingHorizontal: 8, justifyContent: 'center' },
  sec: { paddingHorizontal: 4, marginBottom: 8, marginTop: 16 },
  aiCard: { backgroundColor: palette.surface, borderRadius: 20, borderCurve: 'continuous', paddingVertical: 6, marginTop: 14 },
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6 },
  aiBadge: { width: 24, height: 24, borderRadius: 8, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: palette.primarySoft, maxWidth: 260 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.surface, borderRadius: 20, borderCurve: 'continuous', padding: 12, paddingRight: 14 },
  ring: { padding: 2.5, borderRadius: 999, borderWidth: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  diag: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, backgroundColor: '#F4F6F3', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5, alignSelf: 'flex-start', maxWidth: '100%' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 2 },
});

export default function PatientSearch() {
  return (
    <PractitionerGate>
      <PatientSearchInner />
    </PractitionerGate>
  );
}
