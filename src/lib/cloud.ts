/**
 * ชั้นข้อมูลบน Supabase: แปลงแถวในตาราง ↔ ชนิดข้อมูลของแอป, โหลดทั้งหมด, ใส่ข้อมูลตัวอย่างให้บัญชีใหม่, เขียนข้อมูล
 * ทุกฟังก์ชันโยน error ออกไป — ผู้เรียก (store) จะ fallback ไปใช้ข้อมูลในเครื่อง
 */
import { agenda as seedAgenda, patients as seedPatients, wisdoms as seedWisdoms, type Appt, type MB5Visit, type Patient, type Wisdom } from '../data/mock';
import { supabase } from './supabase';

export type Agenda = Record<string, Appt[]>;
export type CloudData = { patients: Patient[]; wisdoms: Wisdom[]; agenda: Agenda; events: { kind: 'search' | 'open'; value: string; at: number }[] };

/* ── แปลงแถว ↔ ชนิดของแอป ───────────────────────────── */
const patientToRow = (p: Patient) => ({
  id: p.id,
  name: p.name,
  sex: p.sex,
  age: p.age,
  birth_date: p.birthDate ?? null,
  address: p.address,
  phone: p.phone,
  chronic: p.chronic,
  allergies: p.allergies,
  weight: p.weight,
  height: p.height,
  element: p.element,
  status: p.status,
  meds: p.meds,
});
const visitToRow = (pid: string, v: MB5Visit) => ({
  patient_id: pid,
  no: v.no,
  date: v.date,
  symptoms: v.symptoms,
  exam: v.exam,
  diagnosis: v.diagnosis,
  treatment: v.treatment,
  result: v.result,
  follow_up: v.followUp,
  note: v.note ?? null,
});
const rowToVisit = (r: any): MB5Visit => ({
  no: r.no,
  date: r.date ?? '',
  symptoms: r.symptoms ?? '',
  exam: r.exam ?? '',
  diagnosis: r.diagnosis ?? '',
  treatment: r.treatment ?? '',
  result: r.result ?? '',
  followUp: r.follow_up ?? '',
  note: r.note ?? undefined,
});
const wisdomToRow = (w: Wisdom) => ({
  id: w.id,
  title: w.title,
  kind: w.kind,
  source: w.source,
  date: w.date,
  minutes: w.minutes ?? null,
  summary: w.summary,
  ingredients: w.ingredients ?? null,
  method: w.method ?? null,
  indication: w.indication ?? null,
  caution: w.caution ?? null,
  verified: w.verified,
  // ส่งเฉพาะเมื่อมีค่า (ใช้ได้แม้ฐานข้อมูลยังไม่มีคอลัมน์นี้)
  ...(w.sharedBy ? { shared_by: w.sharedBy } : {}),
  ...(w.shareCode ? { share_code: w.shareCode } : {}),
});
const rowToWisdom = (r: any): Wisdom => ({
  id: r.id,
  title: r.title,
  kind: r.kind,
  source: r.source,
  date: r.date ?? '',
  minutes: r.minutes ?? undefined,
  summary: r.summary ?? '',
  ingredients: r.ingredients ?? undefined,
  method: r.method ?? undefined,
  indication: r.indication ?? undefined,
  caution: r.caution ?? undefined,
  verified: !!r.verified,
  sharedBy: r.shared_by ?? undefined,
  shareCode: r.share_code ?? undefined,
});

const check = <T,>(r: { data: T | null; error: any }) => {
  if (r.error) throw r.error;
  return r.data as T;
};

/* ── โหลดข้อมูลทั้งหมดของบัญชีนี้ ───────────────────────── */
export async function loadAll(): Promise<CloudData> {
  const [p, v, a, w, e] = await Promise.all([
    supabase.from('patients').select('*').order('created_at', { ascending: false }),
    supabase.from('visits').select('*'),
    supabase.from('appointments').select('*').order('start_time'),
    supabase.from('wisdoms').select('*').order('created_at', { ascending: false }),
    supabase.from('user_events').select('kind,value,at').order('at', { ascending: false }).limit(80),
  ]);
  const prow = check<any[]>(p);
  const vrow = check<any[]>(v);
  const arow = check<any[]>(a);
  const wrow = check<any[]>(w);
  const erow = check<any[]>(e);

  const patients: Patient[] = prow.map((r) => ({
    id: r.id,
    name: r.name,
    sex: r.sex,
    age: r.age ?? 0,
    birthDate: r.birth_date ?? undefined,
    address: r.address ?? {},
    phone: r.phone ?? '',
    chronic: r.chronic ?? 'ไม่มี',
    allergies: r.allergies ?? 'ไม่มี',
    weight: Number(r.weight ?? 0),
    height: Number(r.height ?? 0),
    element: r.element ?? 'ดิน',
    status: r.status ?? 'ติดตามอาการ',
    meds: r.meds ?? [],
    visits: vrow
      .filter((x) => x.patient_id === r.id)
      .map(rowToVisit)
      .sort((x, y) => y.no - x.no),
  }));
  const agenda: Agenda = {};
  arow.forEach((r) => {
    (agenda[r.day] ??= []).push({ start: r.start_time, end: r.end_time ?? '', pid: r.patient_id, what: r.what ?? '' });
  });
  return {
    patients,
    wisdoms: wrow.map(rowToWisdom),
    agenda,
    events: erow.map((r) => ({ kind: r.kind, value: r.value, at: new Date(r.at).getTime() })),
  };
}

/** บัญชีใหม่ยังไม่มีข้อมูล → ใส่ข้อมูลตัวอย่างให้ลองใช้ */
export async function seedIfEmpty(): Promise<boolean> {
  const { count, error } = await supabase.from('patients').select('id', { count: 'exact', head: true });
  if (error) throw error;
  if ((count ?? 0) > 0) return false;
  if (!seedPatients.length && !seedWisdoms.length && !Object.keys(seedAgenda).length) return false; // ไม่มีข้อมูลตัวอย่างแล้ว
  if (seedPatients.length) check(await supabase.from('patients').insert(seedPatients.map(patientToRow)));
  const seedVisits = seedPatients.flatMap((p) => p.visits.map((v) => visitToRow(p.id, v)));
  if (seedVisits.length) check(await supabase.from('visits').insert(seedVisits));
  if (seedWisdoms.length) check(await supabase.from('wisdoms').insert(seedWisdoms.map(wisdomToRow)));
  check(
    await supabase.from('appointments').insert(
      Object.entries(seedAgenda).flatMap(([day, list]) => list.map((x) => ({ patient_id: x.pid, day, start_time: x.start, end_time: x.end, what: x.what }))),
    ),
  );
  return true;
}

/* ── เขียนข้อมูล ───────────────────────────────────────── */
export async function savePatient(p: Patient) {
  check(await supabase.from('patients').upsert(patientToRow(p)));
  if (p.visits.length) check(await supabase.from('visits').upsert(p.visits.map((v) => visitToRow(p.id, v))));
}
export async function saveVisit(pid: string, v: MB5Visit) {
  check(await supabase.from('visits').upsert(visitToRow(pid, v)));
}
export async function saveWisdom(w: Wisdom) {
  check(await supabase.from('wisdoms').upsert(wisdomToRow(w)));
}
/** ลบตำราของตัวเอง (สำเนาที่ได้รับจากเพื่อน = ลบเฉพาะในคลังเรา ต้นฉบับของเพื่อนไม่กระทบ) */
export async function deleteWisdom(id: string) {
  check(await supabase.from('wisdoms').delete().eq('id', id));
}

/** ลบข้อมูลตัวอย่างรุ่นเก่า (ผู้ป่วย/ประวัติ/นัดหมายตัวอย่าง) ออกจากคลาวด์ของบัญชีเดิม */
export async function deleteLegacySamples(patientIds: string[]) {
  if (!patientIds.length) return;
  check(await supabase.from('appointments').delete().in('patient_id', patientIds));
  check(await supabase.from('visits').delete().in('patient_id', patientIds));
  check(await supabase.from('patients').delete().in('id', patientIds));
}

export async function logEvent(kind: 'search' | 'open', value: string) {
  check(await supabase.from('user_events').insert({ kind, value }));
}
/** ลบข้อมูลทั้งหมดของบัญชีนี้แล้วใส่ข้อมูลตัวอย่างใหม่ */
export async function resetCloud() {
  for (const t of ['user_events', 'appointments', 'visits', 'wisdoms', 'patients']) {
    check(await supabase.from(t).delete().not('owner', 'is', null));
  }
  await seedIfEmpty();
}
