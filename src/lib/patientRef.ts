/**
 * จำผู้ป่วยในแชท — คุณหมอเอ่ยชื่อผู้ป่วย (ชื่อเต็มหรือชื่อเล่นที่ไม่มีคำนำหน้า) → ดึงข้อมูลและประวัติการรักษามาให้ครูปัญญา
 * ค้นจากข้อความล่าสุดย้อนขึ้นไป: ถามต่อเนื่อง ("แล้วควรให้ยาอะไรต่อ") ยังคงหมายถึงผู้ป่วยคนเดิม
 */
import type { Patient } from '../data/mock';
import type { PatientCtx } from './brain';

const PREFIX = /^(นาย|นางสาว|นาง|เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|ยาย|ตา|ป้า|ลุง)/;
const flat = (s: string) => s.replace(/\s+/g, '');

/** ชื่อที่ใช้จับ: ชื่อเต็ม (ไม่มีคำนำหน้า) และชื่อตัว (อย่างน้อย 3 ตัวอักษร) */
const keys = (p: Patient) => {
  const bare = p.name.replace(PREFIX, '').trim();
  const first = bare.split(/\s+/)[0] ?? '';
  return [flat(bare), first.length >= 3 ? first : ''].filter(Boolean);
};

export function findPatient(texts: string[], patients: Patient[]): Patient | null {
  for (const t of [...texts].reverse()) {
    const f = flat(t);
    const hit = patients.filter((p) => keys(p).some((k) => f.includes(k)));
    // ชื่อซ้ำกันหลายคน → ไม่เดา
    if (hit.length === 1) return hit[0];
  }
  return null;
}

export function patientCtx(p: Patient): PatientCtx {
  return {
    name: p.name,
    age: p.age,
    sex: p.sex,
    element: p.element,
    chronic: p.chronic,
    allergies: p.allergies,
    meds: p.meds,
    status: p.status,
    visits: p.visits.slice(0, 3).map((v) => ({ no: v.no, date: v.date, symptoms: v.symptoms, diagnosis: v.diagnosis, treatment: v.treatment, result: v.result })),
  };
}
