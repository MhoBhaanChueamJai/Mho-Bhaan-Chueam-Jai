/**
 * ครูปัญญาบันทึกการรักษา — โหมดเสียง (เปิดจากปุ่ม "บันทึกการรักษาครั้งที่ N" ในหน้าผู้ป่วย)
 * แบบเดียวกับซักประวัติผู้ป่วยใหม่: ถามทีละเรื่อง → สรุป → ถามยืนยัน → ใช้ = บันทึก · ไม่ = คุยต่อเพื่อแก้ไข
 */
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { VoiceSession } from '../../components/VoiceSession';
import { VISIT_TOPICS, optionsFor, visitHas, visitScribe, visitOpening, visitTurn, type VisitData } from '../../lib/visit';
import { NotFound } from '../../components/NotFound';
import type { Patient } from '../../data/mock';
import { useApp } from '../../store/app';

function VisitInner() {
  const { pid } = useLocalSearchParams<{ pid: string }>();
  const { patients } = useApp();
  const p = patients.find((x) => x.id === pid);
  if (!p) return <NotFound title="ไม่พบผู้ป่วย" />;
  return <VisitSession p={p} />;
}

/** บันทึกการรักษาด้วยเสียง — ใช้ได้ทั้งเป็นหน้าเอง และฝังในหน้าเล่าอาการ (ต่อเนื่องในหน้าเดียว) */
export function VisitSession({ p, morphFrom }: { p: Patient; morphFrom?: { x: number; y: number; size: number } }) {
  const { addVisit, wisdoms } = useApp();
  const no = (p.visits[0]?.no ?? 0) + 1;
  return (
    <VoiceSession
      morphFrom={morphFrom}
      title={`บันทึกการรักษาครั้งที่ ${no}`}
      scribe={(t) => visitScribe(p, t, wisdoms) as any}
      opening={visitOpening(p)}
      initialOptions={optionsFor(p, 'symptoms')}
      topics={VISIT_TOPICS as { key: string; label: string }[]}
      has={(d, k) => visitHas(d as VisitData, k)}
      turn={(k, h, a) => visitTurn(p, k as VisitData, h, a, wisdoms) as any}
      confirmQ="บันทึกการรักษาครั้งนี้เลยไหมครับ"
      yesBye="เรียบร้อยครับ บันทึกการรักษาให้แล้วนะครับ"
      noBye=""
      noContinues
      dockSaves
      doneLabel="บันทึกเสร็จแล้ว"
      canUse={(d) => !!(d.symptoms || d.diagnosis || d.treatment)}
      dockLabel={() => 'บันทึกการรักษา'}
      onFinish={(d, save) => {
        if (save) {
          const v = d as VisitData;
          const t = new Date();
          addVisit(p.id, {
            date: `${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}/${t.getFullYear() + 543}`,
            symptoms: [v.symptoms, v.duration ? `เป็นมา ${v.duration}` : ''].filter(Boolean).join(' · ') || '-',
            exam: v.exam || '-',
            diagnosis: v.diagnosis || '-',
            treatment: v.treatment || '-',
            result: v.result || 'รอติดตามผล',
            followUp: v.followUp || '-',
            note: v.caution ? `ของแสลง/ข้อห้าม: ${v.caution}` : undefined,
          });
        }
        router.back();
      }}
    />
  );
}

export default function VisitVoice() {
  return <VisitInner />;
}
