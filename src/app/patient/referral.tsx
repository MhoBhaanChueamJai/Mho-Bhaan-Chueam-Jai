/**
 * ส่งต่อผู้ป่วย — เปิดต่อจากหน้าบันทึกการรักษา (เลือกผลการรักษา/สถานะ "ส่งต่อ" แล้วกด "บันทึกและส่งต่อ")
 * ส่งข้อมูลให้สถานพยาบาลปลายทาง → บันทึกประวัติการส่งต่อ → พิมพ์หนังสือส่งต่อ (PDF)
 * การส่งข้อมูลตอนนี้เป็นการจำลอง (ยังไม่เชื่อมระบบสถานพยาบาลจริง) ให้เห็นขั้นตอนการทำงาน
 */
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { NotFound } from '../../components/NotFound';
import { Sym, ios } from '../../components/ios';
import { Button, GlassDock, T, useHaptic } from '../../components/ui';
import { useDoctor } from '../../components/useDoctor';
import { FACILITIES } from '../../data/facilities';
import { type ReferralRecord } from '../../data/mock';
import { printReferral, thTime } from '../../lib/referral';
import { useApp } from '../../store/app';
import { elevation, palette } from '../../theme';
import { column } from '../../components/layout';

const SEND_STEPS = ['เตรียมข้อมูลผู้ป่วยและการรักษา', 'ส่งข้อมูลไปยังสถานพยาบาลปลายทาง', 'ปลายทางได้รับข้อมูลแล้ว'];

export default function Referral() {
  const q = useLocalSearchParams<{ pid: string; fid?: string; reason?: string; urgent?: string; visitNo?: string }>();
  const { patients, updatePatient } = useApp();
  const dr = useDoctor();
  const h = useHaptic();
  const p = patients.find((x) => x.id === q.pid);
  const to = (FACILITIES.find((f) => f.id === q.fid) ?? FACILITIES[0]).name;
  const urgent = q.urgent === '1';
  const visitNo = Number(q.visitNo) || p?.visits[0]?.no;
  const [step, setStep] = useState(0);
  const [sent, setSent] = useState<ReferralRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  // ส่งข้อมูลให้สถานพยาบาลปลายทาง (จำลอง: เตรียมข้อมูล → ส่ง → ปลายทางได้รับ) แล้วบันทึกประวัติการส่งต่อ
  useEffect(() => {
    if (!p || started.current) return;
    started.current = true;
    (async () => {
      for (let i = 0; i < SEND_STEPS.length; i++) {
        setStep(i);
        await new Promise((r) => setTimeout(r, 700));
      }
      const d = new Date();
      const rec: ReferralRecord = {
        no: `RF${String(d.getFullYear() + 543).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
        to,
        at: d.getTime(),
        visitNo,
        urgent,
        reason: (q.reason ?? '').trim(),
      };
      updatePatient(p.id, { referrals: [rec, ...(p.referrals ?? [])] });
      h.success();
      setSent(rec);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!p]);

  if (!p) return <NotFound />;

  const print = async () => {
    if (busy || !sent) return;
    setBusy(true);
    await printReferral(p, sent, dr);
    setBusy(false);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'ส่งต่อผู้ป่วย', gestureEnabled: !!sent }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={[styles.page, column.read]}>
        {sent ? (
          <>
            <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.done}>
              <Sym name="checkmark.circle.fill" size={44} color="#FFFFFF" />
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(120)} style={{ gap: 4 }}>
              <T v="h2" center>ส่งข้อมูลแล้ว</T>
              <T v="callout" color={ios.secondary} center>{to} ได้รับข้อมูลผู้ป่วยแล้ว</T>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(200)} style={[styles.card, elevation.e1, { paddingVertical: 4 }]}>
              {[
                ['เลขที่ส่งต่อ', sent.no],
                ['ผู้ป่วย', p.name],
                ['ส่งถึง', to],
                ['การรักษาครั้งที่', String(sent.visitNo ?? '-')],
                ['เวลาที่ส่ง', `${thTime(sent.at)} น.`],
                ['ความเร่งด่วน', urgent ? 'ด่วน' : 'ปกติ'],
              ].map(([k, val], i) => (
                <View key={k} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ios.separator }]}>
                  <T v="body" color={ios.secondary} style={{ width: 120 }}>{k}</T>
                  <T v="body" style={{ flex: 1, textAlign: 'right', fontWeight: '600' }} color={k === 'ความเร่งด่วน' && urgent ? palette.coral : palette.ink}>{val}</T>
                </View>
              ))}
            </Animated.View>
            <T v="caption" color={ios.tertiary} style={{ marginHorizontal: 4 }}>เก็บไว้ในประวัติการส่งต่อของผู้ป่วยแล้ว พิมพ์ใบเดิมซ้ำได้ที่หน้าผู้ป่วย</T>
          </>
        ) : (
          <Animated.View entering={FadeIn} style={[styles.card, elevation.e1, { gap: 14, marginTop: 8 }]}>
            <T v="bodyStrong">กำลังส่งข้อมูลให้ {to}</T>
            {SEND_STEPS.map((t, i) => (
              <View key={t} style={styles.step}>
                <Sym name={i < step ? 'checkmark.circle.fill' : i === step ? 'paperplane.fill' : 'circle'} size={18} color={i <= step ? palette.primary : ios.tertiary} />
                <T v="body" color={i <= step ? palette.ink : ios.tertiary}>{t}</T>
              </View>
            ))}
          </Animated.View>
        )}
      </ScrollView>
      {sent ? (
        <GlassDock>
          <View style={{ flex: 1, gap: 10 }}>
            <Button label={busy ? 'กำลังสร้างเอกสาร…' : 'พิมพ์หนังสือส่งต่อ'} icon={<Sym name="printer.fill" size={17} color="#FFFFFF" />} disabled={busy} onPress={print} style={{ height: 52 }} />
            <Button label="เสร็จ" kind="secondary" onPress={() => router.back()} style={{ height: 52 }} />
          </View>
        </GlassDock>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 200, gap: 14 },
  card: { padding: 16, borderRadius: 22, backgroundColor: palette.surface },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 50, gap: 10 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  done: { alignSelf: 'center', width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary, marginTop: 12 },
});
