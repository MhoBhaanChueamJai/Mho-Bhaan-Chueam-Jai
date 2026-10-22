/**
 * แนะนำสมุนไพรตามสภาพอากาศวันนี้ (ตามตำแหน่งของคุณหมอ)
 * 1) ตำแหน่ง (expo-location, ปัดเหลือทศนิยม 2 ตำแหน่ง ~1 กม.) → อากาศจาก Open-Meteo (อุณหภูมิ รู้สึกเหมือน ความชื้น ฝน UV) + ฝุ่น PM2.5
 * 2) ครูปัญญาเลือกสมุนไพร 3 ตัวจากคลัง ที่ช่วยป้องกัน/บรรเทาโรคที่มากับอากาศแบบนี้ (เช่น ร้อนจัด → ลมแดด ไข้ร้อนใน)
 * 3) จำผลไว้ตามวัน + ลักษณะอากาศ (ไม่ถามซ้ำทุกครั้งที่เปิดหน้า) · ไม่มีตำแหน่ง/AI ล่ม → เลือกตามฤดู/อากาศแบบกฎตายตัว
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { chatJSON } from '../api/ai';
import { herbs, type Herb } from '../data/herbs';
import { seasonOf, thaiToday } from './herbDaily';
import { userNoun } from './roles';

/** ลักษณะท้องฟ้า (ใช้เลือกไอคอน สี และแอนิเมชัน) */
export type SkyKind = 'sun' | 'hot' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'heavy' | 'thunder' | 'cold' | 'dust' | 'sunrise' | 'sunset' | 'night';
export const SKY_LABEL: Record<SkyKind, string> = {
  sun: 'แดดออก',
  hot: 'ร้อนจัด',
  partly: 'มีเมฆบางส่วน',
  cloudy: 'เมฆมาก',
  fog: 'มีหมอก',
  drizzle: 'ฝนตกปรอยๆ',
  rain: 'ฝนตก',
  heavy: 'ฝนตกหนัก',
  thunder: 'ฝนฟ้าคะนอง',
  cold: 'อากาศหนาว',
  dust: 'ฝุ่นสูง',
  sunrise: 'พระอาทิตย์ขึ้น',
  sunset: 'พระอาทิตย์ตก',
  night: 'กลางคืน',
};

export type Weather = {
  sky: SkyKind;
  sunrise: string; // HH:MM เวลาไทย
  sunset: string;
  temp: number;
  feels: number;
  humidity: number;
  rainProb: number;
  rainy: boolean;
  uvMax: number;
  tmin: number;
  tmax: number;
  pm25: number | null;
  place: string;
  icon: string; // SF Symbol
  label: string; // ร้อนอบอ้าว / ฝนตก / หนาวเย็น / ฝุ่นสูง ...
  flags: string[]; // ลักษณะอากาศที่มีผลต่อสุขภาพ
};
export type HerbRec = { herb: Herb; risk: string; reason: string; tip: string };
export type WeatherRecs = { weather: Weather | null; recs: HerbRec[]; advice: string; source: 'ai' | 'rule' };

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

/** ขอข้อมูลพร้อมหมดเวลา (เน็ตช้า/ค้าง ไม่ให้หน้าค้างรอ) */
async function getJSON(url: string, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}
const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

/** สาเหตุที่ดูอากาศไม่ได้ */
export class WeatherError extends Error {
  constructor(public reason: 'permission' | 'network' | 'location') {
    super(reason);
  }
}

/** ตำแหน่ง → สภาพอากาศ (โยน WeatherError: permission = ไม่อนุญาตตำแหน่ง · network = เชื่อมต่อไม่ได้) */
export async function getWeather(ask = true): Promise<Weather> {
  const perm = ask ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
  if (perm.status !== 'granted') throw new WeatherError('permission');
  let pos: Location.LocationObject | null = null;
  try {
    pos = (await Location.getLastKnownPositionAsync({ maxAge: 3 * 3600_000 })) ?? (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 10_000));
  } catch {}
  if (!pos) throw new WeatherError('location');
  const lat = Math.round(pos.coords.latitude * 100) / 100;
  const lon = Math.round(pos.coords.longitude * 100) / 100;
  let fc: any, aq: any, geo: Location.LocationGeocodedAddress[];
  try {
    [fc, aq, geo] = await Promise.all([
      getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset&timezone=Asia%2FBangkok&forecast_days=1`),
      getJSON(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5`).catch(() => null),
      withTimeout(Location.reverseGeocodeAsync({ latitude: lat, longitude: lon }), 6000).catch(() => [] as Location.LocationGeocodedAddress[]),
    ]);
  } catch {
    throw new WeatherError('network');
  }
  // ไม่มีข้อมูลปัจจุบัน (API ตอบผิดรูป) → ห้ามแสดงเป็น 0° แทน
  if (!fc?.current || typeof fc.current.temperature_2m !== 'number') throw new WeatherError('network');
  const c = fc.current ?? {};
  const d = fc.daily ?? {};
  const g = geo[0];
  const w: Weather = {
    temp: Math.round(c.temperature_2m ?? 0),
    feels: Math.round(c.apparent_temperature ?? c.temperature_2m ?? 0),
    humidity: Math.round(c.relative_humidity_2m ?? 0),
    rainProb: Math.round(d.precipitation_probability_max?.[0] ?? 0),
    rainy: RAIN_CODES.has(c.weather_code) || (c.precipitation ?? 0) > 0.2,
    uvMax: Math.round(d.uv_index_max?.[0] ?? 0),
    tmin: Math.round(d.temperature_2m_min?.[0] ?? 0),
    tmax: Math.round(d.temperature_2m_max?.[0] ?? 0),
    pm25: aq?.current?.pm2_5 != null ? Math.round(aq.current.pm2_5) : null,
    place: g ? g.district || g.subregion || g.city || g.region || '' : '',
    sky: 'sun',
    sunrise: String(d.sunrise?.[0] ?? '').slice(11, 16),
    sunset: String(d.sunset?.[0] ?? '').slice(11, 16),
    icon: '',
    label: '',
    flags: [],
  };
  // ลักษณะอากาศที่มีผลต่อสุขภาพ
  if (w.feels >= 40) w.flags.push('ร้อนจัด เสี่ยงลมแดด');
  else if (w.feels >= 35) w.flags.push('ร้อนอบอ้าว');
  if (w.rainy || w.rainProb >= 60) w.flags.push('ฝนตก อากาศชื้น');
  if (w.tmin <= 18) w.flags.push('อากาศเย็น');
  if (w.tmax - w.tmin >= 10) w.flags.push('อุณหภูมิกลางวันกลางคืนต่างกันมาก');
  if (w.humidity >= 85 && !w.rainy) w.flags.push('ความชื้นสูง');
  if (w.pm25 != null && w.pm25 > 50) w.flags.push('ฝุ่น PM2.5 สูง');
  if (w.uvMax >= 8) w.flags.push('แดดแรง UV สูง');
  // ลักษณะท้องฟ้าจากรหัสอากาศ WMO (ฟ้าร้อง > ฝนหนัก > ฝน > ปรอยๆ > หมอก > ฝุ่น > หนาว > ร้อนจัด > เมฆ > แดด)
  const code: number = c.weather_code ?? 0;
  const precip: number = c.precipitation ?? 0;
  w.sky =
    code >= 95 ? 'thunder'
    : [65, 67, 82].includes(code) || precip >= 4 ? 'heavy'
    : [61, 63, 66, 80, 81].includes(code) ? 'rain'
    : code >= 51 && code <= 57 ? 'drizzle'
    : code === 45 || code === 48 ? 'fog'
    : w.pm25 != null && w.pm25 > 75 ? 'dust'
    : w.temp <= 18 ? 'cold'
    : w.feels >= 40 ? 'hot'
    : code === 3 ? 'cloudy'
    : code === 2 ? 'partly'
    : 'sun';
  // ช่วงพระอาทิตย์ขึ้น/ตก และกลางคืน (เฉพาะท้องฟ้าโปร่ง/มีเมฆ — ถ้าฝน/หมอก/ฝุ่น ให้แสดงสภาพนั้นก่อน)
  if (['sun', 'hot', 'partly', 'cloudy', 'cold'].includes(w.sky) && w.sunrise && w.sunset) {
    const mins = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
    const nowHM = String(c.time ?? '').slice(11, 16); // เวลาไทยจาก API (timezone=Asia/Bangkok)
    const now = mins(nowHM || '12:00');
    const rise = mins(w.sunrise);
    const set = mins(w.sunset);
    if (now >= rise - 30 && now <= rise + 60) w.sky = 'sunrise';
    else if (now >= set - 60 && now <= set + 30) w.sky = 'sunset';
    else if ((now > set + 30 || now < rise - 30) && w.sky !== 'cold') w.sky = 'night';
  }
  w.label = SKY_LABEL[w.sky] + (w.sky === 'sunrise' ? ` ${w.sunrise}` : w.sky === 'sunset' ? ` ${w.sunset}` : '');
  w.icon = '';
  return w;
}

/** ไม่มี AI/ตำแหน่ง: เลือกตามลักษณะอากาศ (หรือฤดู) แบบกฎตายตัว */
function ruleRecs(w: Weather | null): HerbRec[] {
  const byName = (n: string) => herbs.find((h) => h.name === n);
  const { m, d } = thaiToday();
  const season = seasonOf(m, d);
  const hot = w ? w.feels >= 33 : season.key === 'hot';
  const wet = w ? w.rainy || w.rainProb >= 60 || w.humidity >= 85 : season.key === 'rain';
  const cold = w ? w.tmin <= 20 : season.key === 'cold';
  const plan: [string, string][] = hot
    ? [['บัวบก', 'ร้อนใน อ่อนเพลียจากอากาศร้อน'], ['ตะไคร้', 'ท้องอืด ปัสสาวะน้อยช่วงอากาศร้อน'], ['ฟ้าทะลายโจร', 'เจ็บคอ ไข้ตัวร้อน']]
    : wet
      ? [['ขิง', 'หวัด ท้องอืด ช่วงฝนตก'], ['ฟ้าทะลายโจร', 'ไข้หวัด เจ็บคอ'], ['ไพล', 'ปวดเมื่อยจากอากาศชื้น']]
      : cold
        ? [['ขิง', 'หวัด หนาวสั่น'], ['มะกรูด', 'ไอ มีเสมหะ ช่วงอากาศเย็น'], ['ข่า', 'ท้องอืด ขับลม']]
        : [['ขมิ้นชัน', 'ท้องอืด ท้องเฟ้อ'], ['ตะไคร้', 'ขับลม'], ['บัวบก', 'อ่อนเพลีย']];
  return plan
    .map(([n, risk]) => {
      const h = byName(n);
      return h ? { herb: h, risk, reason: h.uses.slice(0, 2).join(' · '), tip: h.howto } : null;
    })
    .filter((x): x is HerbRec => !!x);
}

/** ผลเบื้องต้นทันที (กฎตายตัว) ระหว่างรอครูปัญญา */
export const quickRecs = (w: Weather | null): WeatherRecs => ({ weather: w, recs: ruleRecs(w), advice: '', source: 'rule' });

/** สมุนไพร 3 ตัวสำหรับอากาศวันนี้ (จำไว้ตามวัน + ลักษณะอากาศ) */
export async function recommendForWeather(w: Weather | null): Promise<WeatherRecs> {
  const { y, m, d } = thaiToday();
  if (!w) return { weather: null, recs: ruleRecs(null), advice: '', source: 'rule' };
  const bucket = [w.flags.join('|') || w.label, Math.round(w.feels / 3)].join(':');
  const key = `wxherb:${y}-${m}-${d}:${bucket}`;
  try {
    const saved = await AsyncStorage.getItem(key);
    if (saved) {
      const s = JSON.parse(saved) as { ids: string[]; risk: string[]; reason: string[]; tip: string[]; advice: string };
      const recs = s.ids.map((id, i) => ({ herb: herbs.find((h) => h.id === id)!, risk: s.risk[i], reason: s.reason[i], tip: s.tip[i] })).filter((r) => r.herb);
      if (recs.length) return { weather: w, recs, advice: s.advice, source: 'ai' };
    }
  } catch {}
  try {
    const season = seasonOf(m, d);
    const r = await chatJSON<{ advice?: string; picks?: { id?: string; risk?: string; reason?: string; tip?: string }[] }>([
      {
        role: 'user',
        content: `คุณคือครูปัญญา ผู้เชี่ยวชาญแพทย์แผนไทย ช่วยเลือกสมุนไพร 3 ชนิด (ไม่ซ้ำกัน) จากคลังด้านล่าง ที่ช่วยป้องกันหรือบรรเทาโรค/อาการที่มักมากับสภาพอากาศวันนี้
สภาพอากาศที่${w.place || 'ตำแหน่งของคุณหมอ'}: ${w.temp}°C (รู้สึกเหมือน ${w.feels}°C) ต่ำสุด ${w.tmin}° สูงสุด ${w.tmax}° ความชื้น ${w.humidity}% โอกาสฝน ${w.rainProb}% UV ${w.uvMax}${w.pm25 != null ? ` PM2.5 ${w.pm25}` : ''}
ลักษณะอากาศ: ${w.flags.join(', ') || w.label} · ฤดู: ${season.name} (${season.advice})
คลังสมุนไพร (id: ชื่อ รส ธาตุ — สรรพคุณ):
${herbs.map((h) => `${h.id}: ${h.name} รส${h.taste} ธาตุ${h.element} — ${h.uses.join(', ')}`).join('\n')}
กติกา: เลือกเฉพาะ id ในคลัง · ใช้สรรพคุณตามข้อมูลคลัง · วิธีใช้บอกแบบทั่วไปตามภูมิปัญญาไทย ห้ามระบุขนาดยาเป็นตัวเลข · ภาษาง่าย สั้น สำหรับ${userNoun()}
ตอบ JSON เท่านั้น:
{"advice":"คำแนะนำดูแลสุขภาพวันนี้ 1 ประโยค","picks":[{"id":"","risk":"โรค/อาการที่ต้องระวังกับอากาศนี้ (สั้น ไม่เกิน 6 คำ)","reason":"ทำไมสมุนไพรนี้ช่วยได้ 1 ประโยค","tip":"วิธีใช้เพื่อป้องกัน/บรรเทา 1 ประโยค"}]}`,
      },
    ]);
    const seen = new Set<string>();
    const recs = (r.picks ?? [])
      .map((p) => ({ herb: herbs.find((h) => h.id === p.id) as Herb, risk: String(p.risk ?? ''), reason: String(p.reason ?? ''), tip: String(p.tip ?? '') }))
      .filter((p) => p.herb && !seen.has(p.herb.id) && seen.add(p.herb.id))
      .slice(0, 3);
    if (recs.length < 3) throw new Error('not enough');
    const advice = String(r.advice ?? '');
    AsyncStorage.setItem(key, JSON.stringify({ ids: recs.map((x) => x.herb.id), risk: recs.map((x) => x.risk), reason: recs.map((x) => x.reason), tip: recs.map((x) => x.tip), advice })).catch(() => {});
    return { weather: w, recs, advice, source: 'ai' };
  } catch {
    return { weather: w, recs: ruleRecs(w), advice: '', source: 'rule' };
  }
}
