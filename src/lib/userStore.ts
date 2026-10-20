/**
 * รายการข้อมูลของหมอที่ไม่ใช่ผู้ป่วย (คลังยา รายการสื่อในตำรา) — เก็บในเครื่อง + สำรองเป็นไฟล์ส่วนตัวบนคลาวด์
 * โหลด: ใช้ของในเครื่องก่อน แล้วดึงจากคลาวด์ถ้าคลาวด์ใหม่กว่า · แก้ไข: บันทึกในเครื่องทันที แล้วอัปโหลด (รวบหลายครั้งเป็นครั้งเดียว)
 * บัญชีทดลอง (หลายคนใช้ร่วมกัน) และยังไม่เข้าสู่ระบบ → เก็บในเครื่องอย่างเดียว
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { loadUserJSON, saveUserJSON } from './cloud';
import { supabase, usernameToEmail } from './supabase';

type Box<T> = { items: T[]; savedAt: number; loaded: boolean; listeners: Set<() => void>; timer?: ReturnType<typeof setTimeout> };
const boxes = new Map<string, Box<any>>();

async function cloudOk() {
  const { data } = await supabase.auth.getSession();
  const email = data.session?.user.email?.toLowerCase();
  return !!email && email !== usernameToEmail('somchai').toLowerCase();
}

function box<T>(name: string): Box<T> {
  let b = boxes.get(name);
  if (!b) {
    boxes.set(name, (b = { items: [], savedAt: 0, loaded: false, listeners: new Set() }));
    const key = `suebsan.${name}.v1`;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (raw) {
          const j = JSON.parse(raw);
          b!.items = j.items ?? [];
          b!.savedAt = j.savedAt ?? 0;
        }
      })
      .catch(() => {})
      .finally(async () => {
        b!.loaded = true;
        b!.listeners.forEach((l) => l());
        try {
          if (!(await cloudOk())) return;
          const c = await loadUserJSON<T[]>(name);
          if (c && c.savedAt > b!.savedAt) {
            b!.items = c.data ?? [];
            b!.savedAt = c.savedAt;
            AsyncStorage.setItem(key, JSON.stringify({ items: b!.items, savedAt: b!.savedAt })).catch(() => {});
            b!.listeners.forEach((l) => l());
          }
        } catch {}
      });
  }
  return b;
}

export function setItems<T>(name: string, next: T[]) {
  const b = box<T>(name);
  b.items = next;
  b.savedAt = Date.now();
  b.listeners.forEach((l) => l());
  AsyncStorage.setItem(`suebsan.${name}.v1`, JSON.stringify({ items: next, savedAt: b.savedAt })).catch(() => {});
  if (b.timer) clearTimeout(b.timer);
  b.timer = setTimeout(async () => {
    if (await cloudOk().catch(() => false)) saveUserJSON(name, b.items).catch(() => {});
  }, 1500);
}

export function useItems<T>(name: string): [T[], (next: T[]) => void, boolean] {
  const b = box<T>(name);
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((x) => x + 1);
    b.listeners.add(l);
    return () => void b.listeners.delete(l);
  }, [b]);
  return [b.items, (next) => setItems(name, next), b.loaded];
}
