import { setDialect, type Dialect } from '../lib/dialect';
import { setMe, type MyHealth } from '../lib/me';
import { ROLE_PICKER, kindOf, roleOf, setCurrentRole, type UserKind, type UserRole } from '../lib/roles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { ModelKey } from '../api/ai';
import { DEMO_APPTS, DEMO_PATIENTS } from '../data/demoPatients';
import { isoIn } from '../lib/reminders';
import { LIBRARY } from '../data/library';
import { clearChats } from '../lib/chatStore';
import { removeClips } from '../lib/wisdomAudio';
import { LEGACY_SAMPLE_PATIENTS, isLegacyWisdom, agenda as seedAgenda, patients as seedPatients, wisdoms as seedWisdoms, type MB5Visit, type Patient, type Wisdom } from '../data/mock';
import * as cloud from '../lib/cloud';
import type { Agenda } from '../lib/cloud';
import { supabase, usernameToEmail } from '../lib/supabase';

type Settings = {
  /** เวลาที่ซิงก์คลาวด์สำเร็จล่าสุด (ms) — ใช้แยกข้อมูลที่บันทึกในเครื่องระหว่างออฟไลน์ */
  lastSyncAt?: number;
  /** ภาษาที่ใช้คุยกับครูปัญญา */
  dialect: Dialect;
  model: ModelKey;
  voice: string;
  autoSpeak: boolean;
  haptics: boolean;
  doctorType: string;
  loggedIn: boolean;
  phone: string;
  /** ชื่อผู้ใช้ที่จำไว้ (ใช้กับ Face ID) */
  username: string;
  /** ใส่ผู้ป่วยตัวอย่างของโหมดทดลองในเครื่องนี้แล้ว */
  demoSeeded?: boolean;
  /** ใส่นัดตัวอย่างให้บัญชีทดลองแล้ว (ใส่ครั้งเดียว) */
  demoAppts?: boolean;
  /** ภาพโปรไฟล์ที่หมอเลือกเอง (ไฟล์ในเครื่อง) — ไม่มี = ภาพหมอเริ่มต้น */
  avatarUri?: string;
  /** ข้อมูลสุขภาพของผู้ใช้เอง (วันเกิด อายุ เพศ น้ำหนัก ส่วนสูง ธาตุ) — ครูปัญญาใช้ตอนคนทั่วไปถามเรื่องตัวเอง */
  me?: MyHealth;
  /** ตัวการ์ตูนที่เลือก (คีย์ใน AVATAR_PRESETS) — ใช้เมื่อไม่มีภาพถ่าย */
  avatarPreset?: string;
  /** อีเมล/ชื่อผู้ใช้ที่ใช้เข้าสู่ระบบครั้งล่าสุด (เติมให้ในช่องล็อกอิน) */
  loginId?: string;
  /** ล็อกแอปด้วยรหัส PIN */
  pinEnabled: boolean;
  /** ปลดล็อกด้วย Face ID / Touch ID */
  faceIdEnabled: boolean;
  /** สิทธิ์ล่าสุดที่รู้ (จำไว้ใช้ตอนออฟไลน์) */
  role: 'member' | 'practitioner' | 'admin';
  /** บทบาทที่ผู้ใช้เลือก (ยังไม่เลือก = ถามบนหน้าหลัก, AI ใช้แบบประชาชนทั่วไป) */
  userRole?: UserRole;
  /** ประเภทผู้ใช้: ประชาชนทั่วไป / หมอ-บุคลากรสุขภาพ (ยังไม่เลือก = undefined → ถามหลังเข้าสู่ระบบ) */
  userKind?: UserKind;
  /** เห็นคำแนะนำฟีเจอร์ใหม่ในหน้าครูปัญญาแล้ว */
  assistantTip?: boolean;
  /** ย้ายผู้ป่วยจากไฟล์สำรองส่วนตัวขึ้นตารางคลาวด์แล้ว (หลังเลิกระบบยืนยันตัวตนหมอ) */
  patientFileMigrated?: boolean;
  /** แจ้งเตือนที่เปิดอ่านแล้ว (id) */
  readNotices: string[];
  /** แจ้งเตือนที่ปัดล้างแล้ว (id) */
  dismissedNotices?: string[];
};

const defaults: Settings = {
  readNotices: [],
  dialect: 'central',
  model: 'gemma',
  voice: 'female',
  autoSpeak: true,
  haptics: true,
  doctorType: 'herbal',
  loggedIn: false,
  phone: '',
  username: '',
  pinEnabled: false,
  faceIdEnabled: false,
  role: 'member',
};

/** บันทึกพฤติกรรมการค้นหา (เก็บในเครื่อง ใช้ให้ AI เดาสิ่งที่จะค้น) */
export type Profile = {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  role: 'member' | 'practitioner' | 'admin';
  healer_types: string[];
  cert_number: string | null;
  cert_province: string | null;
  cert_expiry: string | null;
  verified_at: string | null;
};
export type SearchLog = { q: string; at: number }[];
export type OpenLog = { pid: string; at: number }[];

type Ctx = {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
  wisdoms: Wisdom[];
  addWisdom: (w: Wisdom) => void;
  /** แก้ข้อมูลตำรา (เช่น ยืนยันว่าตรวจทานแล้ว) */
  updateWisdom: (id: string, patch: Partial<Wisdom>) => void;
  /** ลบออกจากคลังของเรา */
  removeWisdom: (id: string) => void;
  patients: Patient[];
  /** แก้ข้อมูลผู้ป่วยบางช่อง (เช่น สถานะ) */
  updatePatient: (id: string, patch: Partial<Omit<Patient, 'id' | 'visits'>>) => void;
  /** ลบผู้ป่วย (ทั้งในเครื่องและบนคลาวด์ พร้อมประวัติการรักษา) */
  removePatient: (id: string) => void;
  /** เพิ่มการรักษาครั้งใหม่ (ครั้งที่ n+1) ลงทะเบียนการรักษา ม.บ.5 ของผู้ป่วย */
  addVisit: (pid: string, visit: Omit<MB5Visit, 'no'>) => number;
  /** สร้างผู้ป่วยใหม่ (ข้อมูลทั่วไป ม.บ.5) — คืนค่า id */
  addPatient: (p: Omit<Patient, 'id' | 'visits'>, firstVisit?: Omit<MB5Visit, 'no'>) => string;
  /** ล้างข้อมูลที่บันทึกในเครื่อง กลับเป็นข้อมูลตัวอย่าง */
  /** ล้างข้อมูลในเครื่องเท่านั้น (ใช้ตอนออกจากระบบ) — ไม่แตะข้อมูลบนคลาวด์ */
  clearLocal: () => void;
  resetData: () => void;
  /** ปลดล็อกแล้วในรอบการใช้งานนี้ (ไม่บันทึก — เปิดแอปใหม่ต้องปลดล็อกอีกครั้ง) */
  unlocked: boolean;
  setUnlocked: (v: boolean) => void;
  searchLog: SearchLog;
  openLog: OpenLog;
  logSearch: (q: string) => void;
  logOpen: (pid: string) => void;
  /** นัดหมายรายวัน (คีย์ YYYY-MM-DD) */
  agenda: Agenda;
  /** สถานะการเชื่อมต่อฐานข้อมูล */
  sync: 'local' | 'syncing' | 'cloud' | 'error';
  syncError: string;
  /** โหมดทดลอง: ข้อมูลอยู่ในเครื่องนี้เท่านั้น */
  demo: boolean;
  /** จำนวนรายการที่ส่งขึ้นคลาวด์ไม่สำเร็จ รอส่งใหม่ */
  pendingCount: number;
  /** ซิงก์ตอนนี้: ส่งรายการที่ค้าง แล้วโหลดข้อมูลล่าสุด */
  syncNow: () => Promise<void>;
  /** โหลดข้อมูลจาก Supabase ใหม่ (เรียกหลังเข้าสู่ระบบ) */
  reloadCloud: () => Promise<void>;
  /** โปรไฟล์สมาชิก (null = ยังไม่เข้าสู่ระบบ/ออฟไลน์) */
  profile: Profile | null;
  /** บทบาทที่ผู้ใช้เลือก (ยังไม่เลือก = undefined) */
  userRole?: UserRole;
  /** ข้อมูลผู้ป่วยเก็บในเครื่องนี้อย่างเดียว (บัญชีทดลองใช้ / ยังไม่ได้ยืนยันกับทะเบียน) — ลบแอปหรือเปลี่ยนเครื่องแล้วหาย */
  patientsLocalOnly: boolean;
};

const AppCtx = createContext<Ctx>(null as any);

/** ตำราซ้ำ (id เดียวกัน หรือสำเนาที่รับจากเพื่อนเล่มเดียวกัน) → เก็บเล่มแรกเล่มเดียว */
function dedupeWisdoms(list: Wisdom[]): Wisdom[] {
  const seen = new Set<string>();
  return list.filter((w) => {
    const keys = [`id:${w.id}`, w.shareCode ? `code:${w.shareCode}` : '', w.sharedBy ? `from:${w.sharedBy}|${w.title}` : ''].filter(Boolean);
    if (keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k));
    return true;
  });
}
const KEY = 'suebsan.v1';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaults);
  // ให้ส่วน AI (นอก React) รู้ภาษาถิ่นที่ตั้งไว้
  useEffect(() => setDialect(settings.dialect ?? 'central'), [settings.dialect]);
  useEffect(() => setCurrentRole(settings.userRole), [settings.userRole]);
  useEffect(() => setMe(settings.me, settings.userKind), [settings.me, settings.userKind]);
  // mine = ตำราของผู้ใช้ (บันทึกเครื่อง/คลาวด์) · wisdoms = ของผู้ใช้ + ตำราเริ่มต้นในระบบ
  const [mine, setMineRaw] = useState<Wisdom[]>(seedWisdoms);
  const setWisdoms = (v: Wisdom[] | ((l: Wisdom[]) => Wisdom[])) =>
    setMineRaw((l) => dedupeWisdoms((typeof v === 'function' ? v(l) : v).filter((x) => !isLegacyWisdom(x) && !x.builtin)));
  const wisdoms = useMemo(() => [...mine, ...LIBRARY], [mine]);
  const [patients, setPatientsRaw] = useState<Patient[]>(seedPatients);
  // กรองผู้ป่วยตัวอย่างรุ่นเก่าออกเสมอ
  const setPatients = (v: Patient[] | ((l: Patient[]) => Patient[])) =>
    setPatientsRaw((l) => (typeof v === 'function' ? v(l) : v).filter((x) => !LEGACY_SAMPLE_PATIENTS.includes(x.id)));
  const [unlocked, setUnlocked] = useState(false);
  const [searchLog, setSearchLog] = useState<SearchLog>([]);
  const [openLog, setOpenLog] = useState<OpenLog>([]);
  const [ready, setReady] = useState(false);
  const [agenda, setAgendaRaw] = useState<Agenda>(seedAgenda);
  // นัดหมายของผู้ป่วยตัวอย่างรุ่นเก่า → ตัดออก
  const setAgenda = (a: Agenda) =>
    setAgendaRaw(
      Object.fromEntries(
        Object.entries(a)
          .map(([d, l]) => [d, l.filter((x) => !LEGACY_SAMPLE_PATIENTS.includes(x.pid))] as const)
          .filter(([, l]) => l.length),
      ),
    );
  const [sync, setSync] = useState<Ctx['sync']>('local');
  const [syncError, setSyncError] = useState('');
  const [online, setOnline] = useState(false);
  const [demo, setDemo] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  /**
   * เขียนขึ้นคลาวด์แบบไม่บล็อก UI — ล้มเหลว (เน็ตหลุด) → เก็บเข้าคิวรอส่งใหม่ ไม่ทิ้งเงียบๆ
   * key = ข้อมูลชิ้นไหน (เช่น w:id) — บันทึกครั้งใหม่ของชิ้นเดิมแทนที่คิวเก่า (ไม่ส่งของเก่าทับของใหม่)
   */
  const pending = useRef(new Map<string, () => Promise<unknown>>());
  const [pendingCount, setPendingCount] = useState(0);
  // บัญชีที่ยังไม่ได้ยืนยันกับทะเบียน (ตารางผู้ป่วยไม่ให้สิทธิ์) → ไม่เขียนลงตาราง แต่สำรองทั้งชุดเป็นไฟล์ส่วนตัวบนคลาวด์แทน
  const patientsLocal = useRef(false);
  const pushPatient = (fn: () => Promise<unknown>, key: string) => {
    if (patientsLocal.current) return;
    push(fn, key);
  };
  const push = (fn: () => Promise<unknown>, key = `x${Date.now()}${Math.random()}`) => {
    if (!online) return;
    pending.current.delete(key);
    setPendingCount(pending.current.size);
    fn().catch((e) => {
      pending.current.set(key, fn);
      setPendingCount(pending.current.size);
      setSync('error');
      setSyncError(String(e?.message ?? e));
    });
  };
  /** ส่งรายการที่ค้างในคิวใหม่ทั้งหมด */
  const flushPending = async () => {
    for (const [k, fn] of [...pending.current]) {
      try {
        await fn();
        if (pending.current.get(k) === fn) pending.current.delete(k);
      } catch {
        break; // ยังส่งไม่ได้ (เน็ตยังไม่มา) → ลองใหม่รอบหน้า
      }
    }
    setPendingCount(pending.current.size);
    if (!pending.current.size) setSync((x) => (x === 'error' ? 'cloud' : x));
  };

  // กลับเข้าแอป → ส่งรายการที่ค้างอยู่ใหม่
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active' && pending.current.size) flushPending().catch(() => {});
    });
    return () => sub.remove();
  }, [online]);

  const reloadCloud = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setOnline(false);
      setSync('local');
      return;
    }
    setSync('syncing');
    try {
      const pr = await supabase.from('profiles').select('first_name,last_name,display_name,email,role,healer_types,cert_number,cert_province,cert_expiry,verified_at').eq('id', data.session.user.id).maybeSingle();
      const prof = (pr.data as Profile | null) ?? null;
      setProfile(prof);
      if (prof?.role) setSettings((s) => ({ ...s, role: prof.role }));
      // โหมดทดลอง (บัญชีสาธิตที่หลายคนใช้ร่วมกัน): ข้อมูลอยู่ในเครื่องนี้เท่านั้น ไม่โหลด/ไม่ส่งขึ้นคลาวด์
      // — กันไม่ให้ผู้ทดลองเห็นข้อมูลผู้ป่วยที่คนอื่นบันทึกไว้ในบัญชีเดียวกัน
      const isDemo = (data.session.user.email ?? '').toLowerCase() === usernameToEmail('somchai').toLowerCase();
      setDemo(isDemo);
      // บทบาทผู้ใช้ (คอลัมน์ใหม่ใน migration 009) — มีคอลัมน์นี้ = ฐานข้อมูลเปิดให้ทุกบัญชีบันทึกผู้ป่วยแล้ว
      // บัญชีทดลองใช้ร่วมกันหลายคน → บทบาทอยู่ในเครื่องเท่านั้น (ไม่อ่าน/ไม่เขียนคลาวด์)
      const ur = isDemo ? { data: null, error: true } : await supabase.from('profiles').select('user_role').eq('id', data.session.user.id).maybeSingle();
      const opened = !ur.error;
      const cloudRole = (ur.data as { user_role?: string } | null)?.user_role;
      // คอลัมน์ user_role เก็บบทบาท (ถ้าเปิดการเลือกบทบาท) หรือประเภทผู้ใช้ public/clinician (ตอนนี้)
      const local = ROLE_PICKER ? settings.userRole : settings.userKind;
      if (opened && !cloudRole && local) {
        // เลือกไว้ในเครื่องก่อนฐานข้อมูลพร้อม → ส่งขึ้นคลาวด์
        supabase.from('profiles').update({ user_role: local }).eq('id', data.session.user.id).then(() => {});
      } else if (cloudRole) setSettings((st) => (ROLE_PICKER ? { ...st, userRole: roleOf(cloudRole) } : kindOf(cloudRole) ? { ...st, userKind: kindOf(cloudRole) } : st));
      if (isDemo) {
        // ใส่ผู้ป่วยตัวอย่างให้ลองใช้ (ครั้งแรกที่เข้าโหมดนี้ในเครื่อง — ลบแล้วไม่ใส่ซ้ำ)
        if (!settings.demoSeeded) {
          setPatients((list) => (list.length ? list : DEMO_PATIENTS));
          setSettings((st) => ({ ...st, demoSeeded: true }));
        }
        // นัดตัวอย่าง (นับจากวันนี้): เลยนัด · วันนี้ · ในสัปดาห์ · สัปดาห์หน้า — ใส่ครั้งเดียว ไม่ทับนัดที่หมอตั้งเอง
        if (!settings.demoAppts) {
          setPatients((list) => list.map((p) => (DEMO_APPTS[p.id] != null && !p.followUpOn ? { ...p, status: 'ติดตามอาการ', followUpOn: isoIn(DEMO_APPTS[p.id]) } : p)));
          setSettings((st) => ({ ...st, demoAppts: true }));
        }
        setOnline(false);
        setSync('local');
        setSyncError('');
        return;
      }
      // บัญชีที่เคยยืนยันตัวตนแล้ว ใช้ตารางคลาวด์มาตลอด · บัญชีอื่นเคยเก็บผู้ป่วยในไฟล์สำรองส่วนตัว
      const wasLocal = !(prof?.role === 'practitioner' || prof?.role === 'admin');
      // ฐานข้อมูลเปิดแล้ว (migration 009) → ทุกบัญชีใช้ตาราง · ยังไม่เปิด → แบบเดิม
      const practitioner = !wasLocal || opened;
      // ย้ายผู้ป่วยจากไฟล์สำรองขึ้นตารางครั้งเดียว
      const migrating = opened && wasLocal && !settings.patientFileMigrated;
      let fileMerged: Patient[] | null = null;
      patientsLocal.current = !practitioner;
      // ข้อมูลผู้ป่วยตัวอย่าง: ใส่ให้บัญชีที่ใช้ตารางคลาวด์ (ไม่มีข้อมูลเลย)
      if (practitioner) await cloud.seedIfEmpty();
      const d = await cloud.loadAll();
      // ── รวมข้อมูล (ไม่ทับ): ของที่บันทึกในเครื่องหลังซิงก์ครั้งล่าสุดแต่ยังไม่ขึ้นคลาวด์ → เก็บไว้และอัปโหลด ──
      const since = settings.lastSyncAt ?? 0;
      const idTime = (id: string) => Number(id.replace(/^[a-z]+/, '')) || 0;
      // ยังไม่ได้ยืนยันกับทะเบียน: ผู้ป่วยอยู่ในไฟล์ส่วนตัวบนคลาวด์ → รวมกับของในเครื่อง
      if (wasLocal) {
        const f = await cloud.loadPatientFile();
        if (f) {
          const cloudNewer = f.savedAt > since; // มีเครื่องอื่นบันทึกหลังซิงก์ครั้งล่าสุดของเครื่องนี้
          const localMap = new Map(patients.map((x) => [x.id, x]));
          const cloudIds = new Set(f.patients.map((x) => x.id));
          const merged: Patient[] = [];
          for (const cp of f.patients) {
            const lp = localMap.get(cp.id);
            if (!lp) {
              if (cloudNewer) merged.push(cp); // ลบในเครื่องนี้ไปแล้ว (คลาวด์ไม่ได้ใหม่กว่า) → ไม่เอากลับมา
              continue;
            }
            const base = cloudNewer ? cp : lp;
            const byNo = new Map([...cp.visits, ...lp.visits].map((v) => [v.no, v]));
            base.visits.forEach((v) => byNo.set(v.no, v));
            merged.push({ ...base, visits: [...byNo.values()].sort((a, b) => b.no - a.no) });
          }
          for (const lp of patients) if (!cloudIds.has(lp.id) && (!cloudNewer || idTime(lp.id) > since)) merged.push(lp);
          fileMerged = merged;
          if (!practitioner) setPatients(merged);
        }
      }
      const cloudP = new Map(d.patients.map((x) => [x.id, x]));
      const upP: Patient[] = [];
      const upV: { pid: string; v: MB5Visit }[] = [];
      for (const lp of practitioner ? (fileMerged ?? patients) : []) {
        const cp = cloudP.get(lp.id);
        if (!cp) {
          if (migrating || idTime(lp.id) > since) {
            d.patients.unshift(lp);
            upP.push(lp);
          }
          continue;
        }
        // ประวัติการรักษาที่เพิ่มในเครื่อง (เลขครั้งมากกว่าบนคลาวด์)
        const maxNo = Math.max(0, ...cp.visits.map((v) => v.no));
        const extra = lp.visits.filter((v) => v.no > maxNo);
        if (extra.length) {
          cp.visits = [...extra, ...cp.visits].sort((a, b) => b.no - a.no);
          extra.forEach((v) => upV.push({ pid: cp.id, v }));
        }
      }
      const cloudW = new Set(d.wisdoms.map((x) => x.id));
      const upW = mine.filter((w) => !cloudW.has(w.id) && !w.builtin && idTime(w.id) > since);
      d.wisdoms = [...upW, ...d.wisdoms];
      // เสียงเล่าในเครื่อง (ไฟล์ที่ยังไม่ได้/อัปไม่ได้ขึ้นคลาวด์) → คงไว้กับตำราเล่มเดิม
      const localAudio = new Map(mine.filter((w) => w.audio?.length).map((w) => [w.id, w.audio!]));
      d.wisdoms = d.wisdoms.map((w) => {
        const la = localAudio.get(w.id);
        if (!la) return w;
        const byPath = new Map((w.audio ?? []).map((c) => [c.path, c]));
        return { ...w, audio: la.map((c) => ({ ...c, path: c.path ?? undefined, ...(c.path && byPath.get(c.path) ? { sec: byPath.get(c.path)!.sec } : {}) })) };
      });
      // ผู้ป่วยใหม่จากไฟล์สำรอง: ส่งประวัติการรักษาทุกครั้งขึ้นด้วย
      if (migrating) upP.forEach((x) => x.visits.forEach((v) => upV.push({ pid: x.id, v })));
      Promise.all([...upP.map((x) => cloud.savePatient(x)), ...upV.map((x) => cloud.saveVisit(x.pid, x.v)), ...upW.map((x) => cloud.saveWisdom(x))])
        .then(() => { if (migrating) setSettings((st) => ({ ...st, patientFileMigrated: true })); })
        .catch(() => {});
      setSettings((st) => ({ ...st, lastSyncAt: Date.now() }));
      // ยังไม่ได้ยืนยันกับทะเบียน: คลาวด์ไม่มีข้อมูลผู้ป่วยให้ → ใช้ของในเครื่องต่อ (ไม่ทับ)
      // ข้อมูลที่ไม่มีช่องในตารางคลาวด์ (ประวัติส่งต่อ นัดติดตาม ใบยินยอม) → คงของในเครื่องไว้
      const extras = new Map((fileMerged ?? patients).map((x) => [x.id, { referrals: x.referrals, followUpOn: x.followUpOn, consent: x.consent }]));
      if (practitioner) setPatients(d.patients.map((x) => ({ ...x, ...Object.fromEntries(Object.entries(extras.get(x.id) ?? {}).filter(([, v]) => v !== undefined)) })));
      // ผู้ป่วย/ประวัติ/นัดหมายตัวอย่างรุ่นเก่าในคลาวด์ → ลบทิ้ง
      const legacyP = d.patients.filter((x) => LEGACY_SAMPLE_PATIENTS.includes(x.id)).map((x) => x.id);
      if (legacyP.length) cloud.deleteLegacySamples(legacyP).catch(() => {});
      setWisdoms(d.wisdoms);
      // ตำราตัวอย่างรุ่นเก่าในคลาวด์ → ลบทิ้ง
      d.wisdoms.filter(isLegacyWisdom).forEach((x) => cloud.deleteWisdom(x.id).catch(() => {}));
      setAgenda(d.agenda);
      setSearchLog(d.events.filter((x) => x.kind === 'search').map((x) => ({ q: x.value, at: x.at })).slice(0, 30));
      setOpenLog(d.events.filter((x) => x.kind === 'open').map((x) => ({ pid: x.value, at: x.at })).slice(0, 50));
      setOnline(true);
      setSync('cloud');
      flushPending().catch(() => {});
      setSyncError('');
    } catch (e: any) {
      // ยังไม่ได้สร้างตาราง / ไม่มีเน็ต → ใช้ข้อมูลในเครื่องต่อ
      setOnline(false);
      setSync('error');
      setSyncError(String(e?.message ?? e));
    }
  };

  // มี session ค้างจากครั้งก่อน → โหลดจากคลาวด์, ออกจากระบบ → กลับเป็นโหมดในเครื่อง
  useEffect(() => {
    if (!ready) return;
    reloadCloud();
    const { data } = supabase.auth.onAuthStateChange((ev) => {
      if (ev === 'SIGNED_OUT') {
        setOnline(false);
        setSync('local');
        setProfile(null);
      }
    });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (saved.settings) setSettings({ ...defaults, ...saved.settings });
        if (saved.wisdoms?.length) setWisdoms(saved.wisdoms);
        if (saved.patients && (!saved.patients.length || saved.patients[0].visits)) setPatients(saved.patients);
        if (saved.searchLog) setSearchLog(saved.searchLog);
        if (saved.openLog) setOpenLog(saved.openLog);
        if (saved.agenda) setAgenda(saved.agenda);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEY, JSON.stringify({ settings, wisdoms: mine, patients, searchLog, openLog, agenda })).catch(() => {});
  }, [settings, mine, patients, searchLog, openLog, agenda, ready]);

  // บัญชีที่ยังไม่ได้ยืนยัน: ผู้ป่วยเปลี่ยน → อัปโหลดไฟล์สำรองขึ้นคลาวด์ (รวบหลายการแก้ไขเป็นครั้งเดียว)
  const fileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!online || demo || !patientsLocal.current) return;
    if (fileTimer.current) clearTimeout(fileTimer.current);
    const snapshot = patients;
    fileTimer.current = setTimeout(() => {
      push(async () => {
        await cloud.savePatientFile(snapshot);
        setSettings((st) => ({ ...st, lastSyncAt: Date.now() }));
      }, 'patients-file');
    }, 1200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients, online, demo]);

  const value = useMemo<Ctx>(
    () => ({
      settings,
      ready,
      update: (patch) => setSettings((s) => ({ ...s, ...patch })),
      wisdoms,
      removeWisdom: (id) => {
        if (LIBRARY.some((x) => x.id === id)) return;
        // ลบไฟล์เสียงเล่าของเล่มนี้ด้วย (ในเครื่อง + คลาวด์)
        removeClips(mine.find((x) => x.id === id)?.audio).catch(() => {});
        setWisdoms((list) => list.filter((x) => x.id !== id));
        push(() => cloud.deleteWisdom(id), `w:${id}`);
      },
      updateWisdom: (id, patch) => {
        setWisdoms((list) =>
          list.map((x) => {
            if (x.id !== id) return x;
            const next = { ...x, ...patch };
            push(() => cloud.saveWisdom(next), `w:${next.id}`);
            return next;
          }),
        );
      },
      addWisdom: (w) => {
        // ตำราที่รับจากเพื่อน: มีรหัสแชร์นี้ (หรือเรื่องเดียวกันจากคนเดียวกัน) ในคลังแล้ว → ไม่เพิ่มซ้ำเด็ดขาด
        const exists = (l: Wisdom[]) => l.some((x) => (w.shareCode && x.shareCode === w.shareCode) || (w.sharedBy && x.sharedBy === w.sharedBy && x.title === w.title));
        if ((w.shareCode || w.sharedBy) && exists(mine)) return;
        // ตำราเริ่มต้นในระบบที่เพื่อนแชร์มา มีอยู่ในคลังทุกคนแล้ว → ไม่เพิ่มสำเนา
        if (w.sharedBy && LIBRARY.some((x) => x.title === w.title)) return;
        setWisdoms((list) => (w.shareCode || w.sharedBy) && exists(list) ? list : [w, ...list]);
        push(() => cloud.saveWisdom(w), `w:${w.id}`);
      },
      patients,
      updatePatient: (id, patch) => {
        const cur = patients.find((x) => x.id === id);
        if (!cur) return;
        const next = { ...cur, ...patch };
        setPatients((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)));
        pushPatient(() => cloud.savePatient(next), `p:${id}`);
      },
      removePatient: (id) => {
        setPatients((list) => list.filter((x) => x.id !== id));
        pushPatient(() => cloud.deletePatient(id), `p:${id}`);
      },
      addVisit: (pid, visit) => {
        const p = patients.find((x) => x.id === pid);
        const no = (p?.visits[0]?.no ?? 0) + 1;
        setPatients((list) => list.map((x) => (x.id === pid ? { ...x, visits: [{ ...visit, no }, ...x.visits] } : x)));
        pushPatient(() => cloud.saveVisit(pid, { ...visit, no }), `v:${pid}:${no}`);
        return no;
      },
      addPatient: (p, firstVisit) => {
        const id = `p${Date.now()}`;
        const np: Patient = { ...p, id, visits: firstVisit ? [{ ...firstVisit, no: 1 }] : [] };
        setPatients((list) => [np, ...list]);
        pushPatient(() => cloud.savePatient(np), `p:${np.id}`);
        return id;
      },
      unlocked,
      setUnlocked,
      searchLog,
      openLog,
      logSearch: (q) => {
        const k = q.trim();
        if (k.length < 2) return;
        setSearchLog((l) => [{ q: k, at: Date.now() }, ...l.filter((x) => x.q !== k)].slice(0, 30));
        push(() => cloud.logEvent('search', k));
      },
      logOpen: (pid) => {
        setOpenLog((l) => [{ pid, at: Date.now() }, ...l].slice(0, 50));
        push(() => cloud.logEvent('open', pid));
      },
      agenda,
      sync,
      syncError,
      pendingCount,
      demo,
      syncNow: async () => {
        await flushPending();
        await reloadCloud();
      },
      reloadCloud,
      profile,
      userRole: settings.userRole,
      patientsLocalOnly: demo,
      clearLocal: () => {
        // ประวัติแชทครูปัญญาเป็นข้อมูลส่วนตัวของผู้ใช้คนนี้ → ล้างเมื่อออกจากระบบ
        clearChats().catch(() => {});
        setSettings((st) => ({ ...st, avatarUri: undefined, avatarPreset: undefined, me: undefined, demoSeeded: undefined, demoAppts: undefined, userRole: undefined, userKind: undefined, patientFileMigrated: undefined }));
        setOnline(false);
        setDemo(false);
        setPatients([]);
        setWisdoms([]);
        setAgenda({});
        setSearchLog([]);
        setOpenLog([]);
        setProfile(null);
      },
      /** ล้างทั้งในเครื่องและบนคลาวด์ (ต้องยืนยันจากผู้ใช้ก่อนเรียกเสมอ) */
      resetData: () => {
        setPatients(seedPatients);
        setWisdoms(seedWisdoms);
        setAgenda(seedAgenda);
        setSearchLog([]);
        setOpenLog([]);
        push(() => cloud.resetCloud());
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, wisdoms, patients, ready, unlocked, searchLog, openLog, agenda, sync, syncError, online, profile, pendingCount, demo],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export const useApp = () => useContext(AppCtx);
