import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ModelKey } from '../api/ai';
import { patients as seedPatients, wisdoms as seedWisdoms, type MB5Visit, type Patient, type Wisdom } from '../data/mock';

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
};

const AppCtx = createContext<Ctx>(null as any);
const KEY = 'suebsan.v1';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [wisdoms, setWisdoms] = useState<Wisdom[]>(seedWisdoms);
  const [patients, setPatients] = useState<Patient[]>(seedPatients);
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (saved.settings) setSettings({ ...defaults, ...saved.settings });
        if (saved.wisdoms?.length) setWisdoms(saved.wisdoms);
        if (saved.patients?.length && saved.patients[0].visits) setPatients(saved.patients);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEY, JSON.stringify({ settings, wisdoms, patients })).catch(() => {});
  }, [settings, wisdoms, patients, ready]);

  const value = useMemo<Ctx>(
    () => ({
      settings,
      ready,
      update: (patch) => setSettings((s) => ({ ...s, ...patch })),
      wisdoms,
      addWisdom: (w) => setWisdoms((list) => [w, ...list]),
      patients,
      addVisit: (pid, visit) => {
        const p = patients.find((x) => x.id === pid);
        const no = (p?.visits[0]?.no ?? 0) + 1;
        setPatients((list) => list.map((x) => (x.id === pid ? { ...x, visits: [{ ...visit, no }, ...x.visits] } : x)));
        return no;
      },
      addPatient: (p, firstVisit) => {
        const id = `p${Date.now()}`;
        setPatients((list) => [{ ...p, id, visits: firstVisit ? [{ ...firstVisit, no: 1 }] : [] }, ...list]);
        return id;
      },
      unlocked,
      setUnlocked,
      resetData: () => {
        setPatients(seedPatients);
        setWisdoms(seedWisdoms);
      },
    }),
    [settings, wisdoms, patients, ready, unlocked],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export const useApp = () => useContext(AppCtx);
