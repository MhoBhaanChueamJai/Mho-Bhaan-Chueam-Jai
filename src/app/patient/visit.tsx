/**
 * ครูปัญญาบันทึกการรักษา — โหมดเสียง (เปิดจากปุ่ม "บันทึกการรักษาครั้งที่ N" ในหน้าผู้ป่วย)
 * แบบเดียวกับซักประวัติผู้ป่วยใหม่: ถามทีละเรื่อง → สรุป → ถามยืนยัน → ใช้ = บันทึก · ไม่ = คุยต่อเพื่อแก้ไข
 */
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { PractitionerGate } from '../../components/PractitionerGate';
import { VoiceSession } from '../../components/VoiceSession';
import { Sym } from '../../components/ios';
import { GlassCircle } from '../../components/ui';
import { VISIT_TOPICS, optionsFor, visitHas, visitOpening, visitTurn, type VisitData } from '../../lib/visit';
import { useApp } from '../../store/app';

function VisitInner() {
  const { pid } = useLocalSearchParams<{ pid: string }>();
  const { patients, addVisit } = useApp();
  const p = patients.find((x) => x.id === pid);
  if (!p) return null;
  const no = (p.visits[0]?.no ?? 0) + 1;
  return (
    <VoiceSession
      title={`บันทึกการรักษาครั้งที่ ${no}`}
      topRight={(stop) => (
        // โหมดฟังบทสนทนา: ครูปัญญาฟังหมอคุยกับผู้ป่วยแล้วจัดลงหัวข้อให้
        <GlassCircle
          label="ฟังบทสนทนา"
          tint="rgba(255,255,255,0.12)"
          onPress={() => {
            stop();
            router.replace({ pathname: '/patient/scribe', params: { pid: p.id } });
          }}
        >
          <Sym name="ear" size={19} color="#FFFFFF" />
        </GlassCircle>
      )}
      opening={visitOpening(p)}
      initialOptions={optionsFor(p, 'symptoms')}
      topics={VISIT_TOPICS as { key: string; label: string }[]}
      has={(d, k) => visitHas(d as VisitData, k)}
      turn={(k, h, a) => visitTurn(p, k as VisitData, h, a) as any}
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
            symptoms: v.symptoms || '-',
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
  return (
    <PractitionerGate>
      <VisitInner />
    </PractitionerGate>
  );
}
