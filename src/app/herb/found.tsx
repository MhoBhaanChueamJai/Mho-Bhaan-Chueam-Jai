/**
 * ผลสแกนสมุนไพร — Sheet ของ iOS หน้าตาเดียวกับหน้าสมุนไพร (แบบแผ่นรับตำราที่แชร์)
 * ป้ายความมั่นใจ · อันดับใกล้เคียงกดสลับ · ปุ่มปิดบนซ้าย · แถบลอย: ถ่ายใหม่ / ถามครูปัญญา
 * ตรงกับคลัง = ข้อมูลในคลัง · ไม่มีในคลัง = ข้อมูลจากครูปัญญา (มีคำเตือน)
 */
import { router } from 'expo-router';
import React, { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Herb, Taste } from '../../data/herbs';
import { getLastScan } from '../../lib/herbScan';
import { palette } from '../../theme';
import { HerbView } from './[id]';
import { SHEET_NATIVE, SheetFrame } from '../../components/nav/SheetFrame';

export default function HerbFound() {
  const insets = useSafeAreaInsets();
  // ความสูงชัดเจน (Sheet ของ iOS บางครั้งวัดความสูงเนื้อหาเป็น 0)
  const { height: SH } = useWindowDimensions();
  const sheetH: number | '100%' = SHEET_NATIVE ? SH - insets.top - 10 : '100%';
  const scan = getLastScan();
  const [pick, setPick] = useState(0);
  if (!scan || !scan.result.guesses.length) return <View style={{ height: sheetH, backgroundColor: palette.bg }} />;

  const { photo, result } = scan;
  const g = result.guesses[pick];
  // ไม่มีในคลัง → สร้างข้อมูลจากผลของครูปัญญา (ภาพ = ภาพที่ถ่าย)
  const herb: Herb =
    g.herb ??
    ({
      id: 'scan',
      name: g.name,
      local: '',
      sci: g.sci,
      image: { uri: photo },
      taste: g.taste.replace(/^รส/, '') as Taste,
      element: '' as Herb['element'],
      part: g.part,
      uses: g.uses,
      howto: g.howto,
      caution: g.caution,
      credit: '',
    } as Herb);
  const note = g.herb
    ? undefined
    : g.uses.length || g.howto
      ? 'ยังไม่มีในคลังสมุนไพร ข้อมูลมาจากครูปัญญา ควรตรวจสอบกับตำราก่อนใช้'
      : 'ยังไม่มีในคลังสมุนไพร กด “ถามครูปัญญา” เพื่อดูสรรพคุณและวิธีใช้';

  return (
    <SheetFrame>
    <View style={{ height: sheetH, backgroundColor: palette.bg }}>
      <HerbView
        key={pick}
        herb={herb}
        preview={{
          confidence: g.confidence,
          inLibrary: !!g.herb,
          alts: result.guesses.map((x, i) => ({ name: x.name, on: i === pick, onPress: () => setPick(i) })),
          note,
          onClose: () => router.back(),
          onRetake: () => router.back(),
        }}
      />
    </View>
    </SheetFrame>
  );
}
