/**
 * ครูปัญญาซักประวัติผู้ป่วยใหม่ — โหมดเสียง (เปิดจากปุ่มไมค์ในหน้าเพิ่มผู้ป่วย)
 * ครบแล้ววิเคราะห์ธาตุเจ้าเรือนจากวันเกิด → ถามยืนยัน → ใช้ = บันทึกผู้ป่วย · ไม่ = เติมลงฟอร์มให้แก้ต่อ
 */
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { VoiceSession, type VoiceData } from '../../components/VoiceSession';
import { ageFrom, elementFromMonth, normalizeBirth, toISO } from '../../lib/birth';
import { ELEMENT_PROFILE, ageSamutthan } from '../../lib/elements';
import { TOPICS, openingFor, hasTopic, intakeTurn, setIntakeResult, type IntakeData } from '../../lib/intake';

/** ประโยควิเคราะห์ธาตุเจ้าเรือนจากวันเกิด (+ อายุสมุฏฐาน) — คำนวณเอง ไม่ให้ AI เดา */
function elementNote(d: VoiceData) {
  const b = normalizeBirth(d);
  const iso = toISO(b.bDay, b.bMonth, b.bYear);
  if (!iso) return '';
  const el = elementFromMonth(Number(iso.slice(5, 7)));
  const p = ELEMENT_PROFILE[el];
  const ag = ageSamutthan(ageFrom(iso));
  return `จากวันเกิด ผู้ป่วยอายุ ${ageFrom(iso)} ปี เป็นธาตุ${el}นะครับ คนธาตุ${el}มักมีปัญหา${p.prone.slice(0, 2).join(' กับ ')} รสยาที่เหมาะคือรส${p.tastes.join(' รส')} และตอนนี้อยู่ใน${ag.stage} ที่${ag.dosha.split(' ')[0]}เด่นครับ`;
}

export default function VoiceIntake() {
  const { then } = useLocalSearchParams<{ then?: string }>();
  return (
    <VoiceSession
      title="ครูปัญญาซักประวัติ"
      opening={openingFor()}
      topics={TOPICS as { key: string; label: string }[]}
      has={(d, k) => hasTopic(d as IntakeData, k as any)}
      turn={(k, h, a) => intakeTurn(k as IntakeData, h, a) as any}
      closing={elementNote}
      confirmQ="จะใช้ข้อมูลนี้บันทึกผู้ป่วยเลยไหมครับ"
      yesBye="เรียบร้อยครับ บันทึกผู้ป่วยให้แล้วนะครับ"
      noBye="ได้ครับ ผมใส่ข้อมูลไว้ในฟอร์มให้แล้ว แก้ไขได้เลยครับ"
      doneLabel="ซักประวัติเสร็จแล้ว"
      canUse={(d) => !!d.name}
      dockLabel={() => 'ใช้ข้อมูลนี้'}
      onFinish={(d, save) => {
        setIntakeResult({ ...(d as IntakeData), save });
        // เปิดจากเมนูเพิ่มผู้ป่วย → ไปฟอร์มต่อเลย (ฟอร์มรับข้อมูล/บันทึกให้) · เปิดจากฟอร์ม → กลับฟอร์มเดิม
        if (then === 'new') router.replace('/patient/new');
        else router.back();
      }}
    />
  );
}
