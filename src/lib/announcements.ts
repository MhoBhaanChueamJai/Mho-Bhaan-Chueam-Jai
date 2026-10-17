/** ประกาศจากทางระบบ (อัปเดตระบบ · สมุนไพรใหม่ · คลังภูมิปัญญา · เนื้อหาใหม่) — เก็บสำเนาในเครื่องไว้ดูตอนออฟไลน์ */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

export type Announcement = { id: string; kind: 'system' | 'herb' | 'wisdom' | 'content'; title: string; body: string; go: string | null; created_at: string };

const KEY = 'suebsan.announcements';
let cache: Announcement[] = [];
let loaded = false;
const subs = new Set<(a: Announcement[]) => void>();
const emit = (a: Announcement[]) => {
  cache = a;
  subs.forEach((f) => f(a));
};

/** ดึงประกาศ 60 วันล่าสุด */
export async function refreshAnnouncements() {
  const since = new Date(Date.now() - 60 * 86400000).toISOString();
  const { data, error } = await supabase.from('announcements').select('id,kind,title,body,go,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(30);
  if (error || !data) return;
  emit(data as Announcement[]);
  AsyncStorage.setItem(KEY, JSON.stringify(data)).catch(() => {});
}

export function useAnnouncements() {
  const [list, setList] = useState(cache);
  useEffect(() => {
    subs.add(setList);
    if (!loaded) {
      loaded = true;
      AsyncStorage.getItem(KEY)
        .then((s) => s && !cache.length && emit(JSON.parse(s)))
        .catch(() => {});
    }
    return () => void subs.delete(setList);
  }, []);
  useFocusEffect(
    useCallback(() => {
      refreshAnnouncements().catch(() => {});
    }, []),
  );
  return list;
}
