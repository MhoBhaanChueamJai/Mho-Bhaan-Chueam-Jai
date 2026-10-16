import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ModelKey } from '../api/ai';
import { agenda as seedAgenda, patients as seedPatients, wisdoms as seedWisdoms, type MB5Visit, type Patient, type Wisdom } from '../data/mock';
import * as cloud from '../lib/cloud';
import type { Agenda } from '../lib/cloud';
import { supabase } from '../lib/supabase';

type Settings = {
  model: ModelKey;
  voice: string;
  autoSpeak: boolean;
  haptics: boolean;
  doctorType: string;
  loggedIn: boolean;
  phone: string;
  /** ชื่อผู้ใช้ที่จำไว้ (ใช้กับ Face ID) */
  username: string;
  /** ล็อกแอปด้วยรหัส PIN */
  pinEnabled: boolean;
  /** ปลดล็อกด้วย Face ID / Touch ID */
  faceIdEnabled: boolean;
};

const defaults: Settings = {
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
};

/** บันทึกพฤติกรรมการค้นหา (เก็บในเครื่อง ใช้ให้ AI เดาสิ่งที่จะค้น) */
export type SearchLog = { q: string; at: number }[];
export type OpenLog = { pid: string; at: number }[];

type Ctx = {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
  wisdoms: Wisdom[];
  addWisdom: (w: Wisdom) => void;
  patients: Patient[];
  /** เพิ่มการรักษาครั้งใหม่ (ครั้งที่ n+1) ลงทะเบียนการรักษา ม.บ.5 ของผู้ป่วย */
  addVisit: (pid: string, visit: Omit<MB5Visit, 'no'>) => number;
  /** สร้างผู้ป่วยใหม่ (ข้อมูลทั่วไป ม.บ.5) — คืนค่า id */
  addPatient: (p: Omit<Patient, 'id' | 'visits'>, firstVisit?: Omit<MB5Visit, 'no'>) => string;
  /** ล้างข้อมูลที่บันทึกในเครื่อง กลับเป็นข้อมูลตัวอย่าง */
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
  /** โหลดข้อมูลจาก Supabase ใหม่ (เรียกหลังเข้าสู่ระบบ) */
  reloadCloud: () => Promise<void>;
};

const AppCtx = createContext<Ctx>(null as any);
const KEY = 'suebsan.v1';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [wisdoms, setWisdoms] = useState<Wisdom[]>(seedWisdoms);
  const [patients, setPatients] = useState<Patient[]>(seedPatients);
  const [unlocked, setUnlocked] = useState(false);
  const [searchLog, setSearchLog] = useState<SearchLog>([]);
  const [openLog, setOpenLog] = useState<OpenLog>([]);
  const [ready, setReady] = useState(false);
  const [agenda, setAgenda] = useState<Agenda>(seedAgenda);
  const [sync, setSync] = useState<Ctx['sync']>('local');
  const [syncError, setSyncError] = useState('');
  const [online, setOnline] = useState(false);

  /** เขียนขึ้นคลาวด์แบบไม่บล็อก UI — ล้มเหลวก็ยังมีข้อมูลในเครื่อง */
  const push = (fn: () => Promise<unknown>) => {
    if (!online) return;
    fn().catch((e) => {
      setSync('error');
      setSyncError(String(e?.message ?? e));
    });
  };

  const reloadCloud = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setOnline(false);
      setSync('local');
      return;
    }
    setSync('syncing');
    try {
      await cloud.seedIfEmpty();
      const d = await cloud.loadAll();
      setPatients(d.patients);
      setWisdoms(d.wisdoms);
      setAgenda(d.agenda);
      setSearchLog(d.events.filter((x) => x.kind === 'search').map((x) => ({ q: x.value, at: x.at })).slice(0, 30));
      setOpenLog(d.events.filter((x) => x.kind === 'open').map((x) => ({ pid: x.value, at: x.at })).slice(0, 50));
      setOnline(true);
      setSync('cloud');
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
        if (saved.patients?.length && saved.patients[0].visits) setPatients(saved.patients);
        if (saved.searchLog) setSearchLog(saved.searchLog);
        if (saved.openLog) setOpenLog(saved.openLog);
        if (saved.agenda) setAgenda(saved.agenda);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEY, JSON.stringify({ settings, wisdoms, patients, searchLog, openLog, agenda })).catch(() => {});
  }, [settings, wisdoms, patients, searchLog, openLog, agenda, ready]);

  const value = useMemo<Ctx>(
    () => ({
      settings,
      ready,
      update: (patch) => setSettings((s) => ({ ...s, ...patch })),
      wisdoms,
      addWisdom: (w) => {
        setWisdoms((list) => [w, ...list]);
        push(() => cloud.saveWisdom(w));
      },
      patients,
      addVisit: (pid, visit) => {
        const p = patients.find((x) => x.id === pid);
        const no = (p?.visits[0]?.no ?? 0) + 1;
        setPatients((list) => list.map((x) => (x.id === pid ? { ...x, visits: [{ ...visit, no }, ...x.visits] } : x)));
        push(() => cloud.saveVisit(pid, { ...visit, no }));
        return no;
      },
      addPatient: (p, firstVisit) => {
        const id = `p${Date.now()}`;
        const np: Patient = { ...p, id, visits: firstVisit ? [{ ...firstVisit, no: 1 }] : [] };
        setPatients((list) => [np, ...list]);
        push(() => cloud.savePatient(np));
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
      reloadCloud,
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
    [settings, wisdoms, patients, ready, unlocked, searchLog, openLog, agenda, sync, syncError, online],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export const useApp = () => useContext(AppCtx);
