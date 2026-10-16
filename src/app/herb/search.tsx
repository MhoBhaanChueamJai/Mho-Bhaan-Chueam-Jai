/**
 * ค้นหาสมุนไพร — เปิดจากปุ่มแว่นขยายบนหน้าคลังสมุนไพร (แอนิเมชันแบบค้นหาผู้ป่วย)
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Keyboard, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Sym, ios } from '../../components/ios';
import { Hi, SearchShell, SuggestCard, searchStyles } from '../../components/SearchShell';
import { Button, PressableScale, T } from '../../components/ui';
import { herbs, tasteTone } from '../../data/herbs';
import { elevation } from '../../theme';

/** อาการที่ค้นบ่อย: อาการแรกของสมุนไพรแต่ละชนิด (ตัดซ้ำ) */
const SYMPTOMS = Array.from(new Set(herbs.map((h) => h.uses[0].split(' ')[0]))).slice(0, 8);

export default function HerbSearch() {
  const [q, setQ] = useState('');
  const k = q.trim().toLowerCase();
  const results = useMemo(() => herbs.filter((h) => !k || [h.name, h.local, h.sci, ...h.uses].join(' ').toLowerCase().includes(k)), [k]);

  return (
    <SearchShell q={q} setQ={setQ} placeholder="ชื่อสมุนไพร หรืออาการ" label="ค้นหาสมุนไพร">
      {!k ? (
        <SuggestCard title="ค้นหาตามอาการ" note="อาการที่พบบ่อย" items={SYMPTOMS.map((s) => ({ q: s, icon: 'stethoscope' }))} onPick={setQ} />
      ) : null}

      <T v="caption" color={ios.secondary} style={searchStyles.sec}>
        {k ? `พบ ${results.length} ชนิด` : `สมุนไพรทั้งหมด ${herbs.length} ชนิด`}
      </T>

      <View style={{ gap: 10 }}>
        {results.map((h, i) => {
          const tone = tasteTone[h.taste];
          // แสดงสรรพคุณที่ตรงคำค้นก่อน
          const use = (k && h.uses.find((u) => u.toLowerCase().includes(k))) || h.uses[0];
          return (
            <Animated.View key={h.id} entering={FadeInDown.delay(Math.min(i, 8) * 40).duration(260)}>
              <PressableScale
                scaleTo={0.98}
                haptic="select"
                onPress={() => {
                  Keyboard.dismiss();
                  router.replace(`/herb/${h.id}`);
                }}
                style={[searchStyles.card, elevation.card]}
                accessibilityLabel={h.name}
              >
                <Image source={h.image} style={{ width: 64, height: 64, borderRadius: 14 }} contentFit="cover" />
                <View style={{ flex: 1, gap: 3 }}>
                  <Hi text={h.name} q={q.trim()} bold />
                  <Hi text={use} q={q.trim()} v="caption" color={ios.secondary} />
                  <View style={{ alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999, backgroundColor: tone.bg, marginTop: 2 }}>
                    <T v="micro" color={tone.fg}>รส{h.taste}</T>
                  </View>
                </View>
                <Sym name="chevron.right" size={13} color={ios.tertiary} weight="semibold" />
              </PressableScale>
            </Animated.View>
          );
        })}
      </View>

      {k && !results.length ? (
        <Animated.View entering={FadeIn} style={searchStyles.empty}>
          <Sym name="leaf" size={28} color={ios.tertiary} />
          <T v="body" style={{ fontWeight: '600', marginTop: 8 }}>ไม่พบ “{q.trim()}” ในคลัง</T>
          <Button label="ถามครูปัญญาแทน" style={{ marginTop: 16 }} onPress={() => router.replace({ pathname: '/assistant', params: { q } })} />
        </Animated.View>
      ) : null}
    </SearchShell>
  );
}
