/**
 * ค้นหาคลังภูมิปัญญา — เปิดจากปุ่มแว่นขยายบนหน้าคลังภูมิ (แอนิเมชันแบบค้นหาผู้ป่วย)
 */
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Keyboard, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Sym, ios } from '../../components/ios';
import { Hi, SearchShell, SuggestCard, searchStyles } from '../../components/SearchShell';
import { PressableScale, T } from '../../components/ui';
import { useApp } from '../../store/app';
import { elevation, palette } from '../../theme';

export default function WisdomSearch() {
  const { wisdoms } = useApp();
  const [q, setQ] = useState('');
  const k = q.trim().toLowerCase();
  const results = useMemo(
    () => wisdoms.filter((w) => !k || [w.title, w.summary, w.kind, w.source, w.indication, ...(w.ingredients ?? [])].filter(Boolean).join(' ').toLowerCase().includes(k)),
    [wisdoms, k],
  );
  // คำแนะนำ: ประเภทภูมิปัญญา + สมุนไพรที่ใช้บ่อยในตำรับ
  const sugs = useMemo(() => {
    const kinds = Array.from(new Set(wisdoms.map((w) => w.kind))).map((x) => ({ q: x, icon: 'books.vertical' }));
    const ing = Array.from(new Set(wisdoms.flatMap((w) => w.ingredients ?? []).map((x) => x.split(' ')[0]))).slice(0, 5).map((x) => ({ q: x, icon: 'leaf' }));
    return [...kinds, ...ing];
  }, [wisdoms]);

  return (
    <SearchShell q={q} setQ={setQ} placeholder="ชื่อตำรับ อาการ หรือสมุนไพร" label="ค้นหาภูมิปัญญา">
      {!k ? <SuggestCard title="ค้นหาจากคลังของคุณ" items={sugs} onPick={setQ} /> : null}

      <T v="caption" color={ios.secondary} style={searchStyles.sec}>
        {k ? `พบ ${results.length} เรื่อง` : `ภูมิปัญญาทั้งหมด ${wisdoms.length} เรื่อง`}
      </T>

      <View style={{ gap: 10 }}>
        {results.map((w, i) => (
          <Animated.View key={w.id} entering={FadeInDown.delay(Math.min(i, 8) * 40).duration(260)}>
            <PressableScale
              scaleTo={0.98}
              haptic="select"
              onPress={() => {
                Keyboard.dismiss();
                router.replace(`/wisdom/${w.id}`);
              }}
              style={[searchStyles.card, elevation.card, { padding: 12 }]}
              accessibilityLabel={w.title}
            >
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: w.source === 'สแกนตำรา' ? '#FBEFD9' : palette.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Sym name={w.source === 'สแกนตำรา' ? 'doc.text' : 'mic.fill'} size={22} color={w.source === 'สแกนตำรา' ? palette.orange : palette.primary} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Hi text={w.title} q={q.trim()} bold />
                <Hi text={w.summary} q={q.trim()} v="subhead" color={ios.secondary} />
                <T v="micro" color={ios.tertiary}>
                  {w.kind} · {w.source} · {w.date}
                  {w.verified ? '' : ' · รอตรวจทาน'}
                </T>
              </View>
              <Sym name="chevron.right" size={13} color={ios.tertiary} weight="semibold" />
            </PressableScale>
          </Animated.View>
        ))}
      </View>

      {k && !results.length ? (
        <Animated.View entering={FadeIn} style={searchStyles.empty}>
          <Sym name="books.vertical" size={28} color={ios.tertiary} />
          <T v="body" style={{ fontWeight: '600', marginTop: 8 }}>ไม่พบภูมิปัญญา</T>
          <T v="callout" color={ios.secondary} center>ลองค้นด้วยชื่อสมุนไพรหรืออาการ</T>
        </Animated.View>
      ) : null}
    </SearchShell>
  );
}
