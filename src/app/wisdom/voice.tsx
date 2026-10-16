/**
 * ครูปัญญาช่วยบันทึกภูมิปัญญาด้วยเสียง (เปิดจากหน้าเพิ่มภูมิปัญญา) — ใช้หน้าจอเสียงชุดเดียวกับบันทึกการรักษา
 * ตรวจทานเสร็จ → ส่งข้อมูลกลับไปเติมฟอร์ม
 */
import { router } from 'expo-router';
import React from 'react';
import { VoiceSession } from '../../components/VoiceSession';
import { WISDOM_OPTIONS, WISDOM_TOPICS, setWisdomResult, wisdomHas, wisdomOpening, wisdomScribe, wisdomTurn, type WisdomData } from '../../lib/wisdomTalk';

export default function WisdomVoice() {
  return (
    <VoiceSession
      title="บันทึกภูมิปัญญา"
      opening={wisdomOpening()}
      initialOptions={WISDOM_OPTIONS.title}
      scribe={(t) => wisdomScribe(t) as any}
      topics={WISDOM_TOPICS as { key: string; label: string }[]}
      has={(d, k) => wisdomHas(d as WisdomData, k)}
      turn={(k, h, a) => wisdomTurn(k as WisdomData, h, a) as any}
      confirmQ="จะใช้ข้อมูลนี้เลยไหมครับ"
      yesBye="เรียบร้อยครับ"
      noBye=""
      noContinues
      doneLabel="บันทึกเสร็จแล้ว"
      canUse={(d) => !!d.title}
      dockLabel={() => 'ใช้ข้อมูลนี้'}
      onFinish={(d) => {
        setWisdomResult({ ...(d as WisdomData), source: 'เสียงเล่า' });
        router.back();
      }}
    />
  );
}
