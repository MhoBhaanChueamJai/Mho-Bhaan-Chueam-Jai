/**
 * ครูปัญญาช่วยบันทึกภูมิปัญญาด้วยเสียง (เปิดจากหน้าเพิ่มภูมิปัญญา พร้อมประเภทที่เลือก)
 * หัวข้อที่ถามเปลี่ยนตามประเภท (ตำรับยา / วิธีรักษา / คาถา·พิธี / ตำราโบราณ) — ตรวจทานเสร็จส่งกลับไปเติมฟอร์ม
 */
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { VoiceSession } from '../../components/VoiceSession';
import { kindOf, optionsFor, setWisdomResult, topicsFor, wisdomHas, wisdomOpening, wisdomScribe, wisdomTurn, type WisdomData } from '../../lib/wisdomTalk';

export default function WisdomVoice() {
  const { kind: k } = useLocalSearchParams<{ kind?: string }>();
  const kind = kindOf(k);
  const topics = topicsFor(kind);
  return (
    <VoiceSession
      title={`บันทึก${kind}`}
      opening={wisdomOpening(kind)}
      initialOptions={optionsFor(kind, 'title')}
      scribe={(t) => wisdomScribe(kind, t) as any}
      topics={topics as { key: string; label: string }[]}
      has={(d, key) => wisdomHas(d as WisdomData, key)}
      turn={(d, h, a) => wisdomTurn(kind, d as WisdomData, h, a) as any}
      confirmQ="จะใช้ข้อมูลนี้เลยไหมครับ"
      yesBye="เรียบร้อยครับ"
      noBye=""
      noContinues
      doneLabel="บันทึกเสร็จแล้ว"
      canUse={(d) => !!d.title}
      dockLabel={() => 'ใช้ข้อมูลนี้'}
      onFinish={(d) => {
        setWisdomResult({ ...(d as WisdomData), kind, source: 'เสียงเล่า' });
        router.back();
      }}
    />
  );
}
