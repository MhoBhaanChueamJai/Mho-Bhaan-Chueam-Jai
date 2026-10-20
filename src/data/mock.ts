/** ข้อมูลตัวอย่าง (Mockup) ที่อิงสถานการณ์จริงของหมอพื้นบ้านไทย */

/** ชื่อแสดงแทนเมื่อบัญชียังไม่ได้ตั้งชื่อ (ไม่มีข้อมูลหมอตัวอย่างแล้ว) */
export const doctor = {
  name: 'คุณหมอ',
  short: 'คุณหมอ',
};

/** 6 ประเภทหมอพื้นบ้านที่ได้รับการรับรอง + สถิติปี 2564 */
export const doctorTypes = [
  { key: 'herbal', label: 'หมอยาสมุนไพร', icon: 'leaf', tint: '#2C6A4F', count: '~24,700' },
  { key: 'massage', label: 'หมอนวดพื้นบ้าน', icon: 'hand', tint: '#4F7CA8', count: '~24,700' },
  { key: 'bone', label: 'หมอกระดูก', icon: 'bone', tint: '#8A6239', count: '—' },
  { key: 'midwife', label: 'หมอตำแย', icon: 'baby', tint: '#C8664A', count: '22,691' },
  { key: 'venom', label: 'หมอรักษาสัตว์พิษ', icon: 'shield', tint: '#B08A1E', count: '—' },
  { key: 'ritual', label: 'หมอพิธีกรรม', icon: 'flame', tint: '#8E5C7E', count: '26,109' },
] as const;

export const nationStats = { wisdomRecords: '250,000+', year: '2564' };

/** ที่อยู่ตามแบบ ม.บ.5 */
export type Address = { houseNo: string; moo: string; village: string; road?: string; soi?: string; subdistrict: string; district: string; province: string; full?: string /* ข้อความที่อยู่เต็มตามที่กรอก/ตามบัตร */ };

/** หนึ่งแถวใน "ทะเบียนการรักษา" แบบ ม.บ.5 */
export type MB5Visit = {
  no: number; // ครั้งที่
  date: string; // ว/ด/ป
  symptoms: string; // อาการเจ็บป่วย
  exam: string; // ตรวจร่างกาย
  diagnosis: string; // วินิจฉัยโรค
  treatment: string; // การรักษา
  result: string; // ผลการรักษา
  followUp: string; // การติดตามผล
  note?: string; // หมายเหตุ
};

/** แบบ ม.บ.5 — ทะเบียนการรักษา ประวัติการรักษา และผลการรักษาผู้ป่วย (กรมการแพทย์แผนไทยฯ) */
export type Patient = {
  id: string;
  // ข้อมูลทั่วไป
  name: string;
  sex: 'ชาย' | 'หญิง';
  age: number;
  birthDate?: string; // วันเกิด ค.ศ. YYYY-MM-DD
  address: Address;
  phone: string;
  chronic: string; // โรคประจำตัว
  allergies: string; // การแพ้ยา/อาหาร
  weight: number; // กิโลกรัม
  height: number; // เซนติเมตร
  // ทะเบียนการรักษา
  visits: MB5Visit[];
  // ข้อมูลเสริมของแอป
  element: 'ดิน' | 'น้ำ' | 'ลม' | 'ไฟ';
  status: 'ติดตามอาการ' | 'นัดวันนี้' | 'หายดี' | 'ส่งต่อ รพ.สต.';
  meds: string[];
  // ประวัติการส่งต่อ (กันส่งข้อมูลซ้ำ · พิมพ์ใบเดิมซ้ำได้)
  referrals?: ReferralRecord[];
  // นัดติดตามอาการครั้งถัดไป (YYYY-MM-DD) — แจ้งเตือนเช้าวันนัด
  followUpOn?: string;
  // ใบยินยอมให้เก็บข้อมูล (PDPA)
  consent?: PatientConsent;
};

export type PatientConsent = { at: number; signer: string; relation: string; sig: string; witness?: string };

export type ReferralRecord = { no: string; to: string; at: number; visitNo?: number; urgent: boolean; reason: string; extra?: string };

/** ผู้ป่วยตัวอย่างถูกเอาออกแล้ว */
export const patients: Patient[] = [];
/** id ผู้ป่วยตัวอย่างรุ่นเก่า (ลบออกจากเครื่อง/คลาวด์ของผู้ใช้เดิม) */
export const LEGACY_SAMPLE_PATIENTS = ['p1', 'p2', 'p3', 'p4', 'p5'];

/** อาการล่าสุด / วันที่ล่าสุด จากทะเบียนการรักษา */
export const lastVisit = (p: Patient) => p.visits[0];
export const fullAddress = (a: Address) =>
  // มีข้อความเต็มตามที่กรอก/ตามบัตร (รวมซอย ถนน) → ใช้ตามนั้น
  a.full ||
  [a.houseNo, a.moo && `หมู่ ${a.moo}`, a.village, a.road && `ถ.${a.road}`, a.soi && `ซ.${a.soi}`, a.subdistrict && `ต.${a.subdistrict}`, a.district && `อ.${a.district}`, a.province && `จ.${a.province}`]
    .filter(Boolean)
    .join(' ');

export const today = {
  dateLabel: 'วันพฤหัสบดีที่ 15 ตุลาคม 2569',
  lunar: 'ขึ้น 9 ค่ำ เดือน 12',
  weather: 'อากาศเย็น 22°',
  season: 'คิมหันตฤดู → เหมันตฤดู',
  seasonTip: 'ช่วงเปลี่ยนฤดู ธาตุน้ำกำเริบ ระวังหวัด น้ำมูก ควรกินอาหารรสเผ็ดร้อน เช่น ขิง ข่า ตะไคร้',
};

export const appointments = [
  { time: '09:00', name: 'แม่บุญมา ศรีคำ', what: 'นวดประคบเข่า', patientId: 'p1' },
  { time: '13:30', name: 'ลุงจันทร์ แก้วมูล', what: 'ติดตามอาการท้องอืด', patientId: 'p2' },
  { time: '16:00', name: 'น้องฝน ปัญญาดี', what: 'อบสมุนไพรหลังคลอด', patientId: 'p3' },
];

export type Wisdom = {
  id: string;
  title: string;
  kind: 'ตำรับยา' | 'วิธีรักษา' | 'คาถา/พิธี' | 'ตำราโบราณ';
  source: 'เสียงเล่า' | 'สแกนตำรา' | 'พิมพ์เอง' | 'เพื่อนแชร์' | 'ตำราอ้างอิง';
  /** ชื่อหมอที่แชร์ตำรานี้มาให้ (source = เพื่อนแชร์) */
  sharedBy?: string;
  /** สำเนาที่ได้รับจากเพื่อน: รหัสแชร์ (ใช้ขอเนื้อหาล่าสุดเมื่อเพื่อนแก้ต้นฉบับ) */
  shareCode?: string;
  date: string;
  minutes?: number;
  summary: string;
  ingredients?: string[];
  method?: string;
  indication?: string;
  caution?: string;
  verified: boolean;
  /** ตำราเริ่มต้นในระบบ (อ่าน/แชร์ได้ แก้ไข/ลบไม่ได้) */
  builtin?: boolean;
  /** แหล่งอ้างอิง */
  refs?: WisdomRef[];
  /** เสียงเล่าต้นฉบับ (โหมดเล่า) — ไฟล์ในเครื่อง + ที่เก็บบนคลาวด์ */
  audio?: WisdomAudio[];
};
export type WisdomAudio = { uri?: string; path?: string; sec: number };
export type WisdomRef = { title: string; org?: string; year?: string; url?: string };

/** ตำราตัวอย่างถูกเอาออกแล้ว — ตำราเริ่มต้นในระบบอยู่ที่ data/library.ts */
export const wisdoms: Wisdom[] = [];
/** id ของตำราตัวอย่างรุ่นเก่า (ลบออกจากเครื่อง/คลาวด์ของผู้ใช้เดิม) */
export const LEGACY_SAMPLE_WISDOMS = ['w1', 'w2', 'w3'];
/** ตำราทดสอบ/สำเนาตัวอย่างที่เกิดระหว่างพัฒนา (ชื่อขึ้นต้นด้วยข้อความนี้) → ลบออก */
/** ตำราทดสอบที่ค้างจากช่วงพัฒนา — จับเฉพาะชื่อเต็มตรงตัว + แหล่งที่มาตรงกัน (ไม่จับคำขึ้นต้น กันลบตำราจริงของหมอ) */
const LEGACY_TEST: { title: string; source: string }[] = [
  { title: 'ตำรายาแก้ไข้ป่า (ถอดความ)', source: 'เพื่อนแชร์' },
  { title: 'ยาแคปซูลขมิ้นชัน', source: 'สแกนตำรา' },
  { title: 'ยาต้มแก้ลมจับโปง (สูตรพ่อหมอสมบัติ)', source: 'เพื่อนแชร์' },
];
export const isLegacyWisdom = (w: { id: string; title: string; source?: string }) =>
  LEGACY_SAMPLE_WISDOMS.includes(w.id) || LEGACY_TEST.some((t) => w.title === t.title && w.source === t.source && /^w17\d{11}$/.test(w.id) && Number(w.id.slice(1)) < 1792200000000 /* ก่อน 17 ต.ค. 2569 */);

/** ต้นไม้ภูมิปัญญา — ความคืบหน้าการบันทึกองค์ความรู้ */
export const legacy = { recorded: 37, goal: 60, minutes: 214, apprentices: 3 };

/** คิวผู้ป่วยวันนี้ (การ์ดตัวเลขวงกลมบนหน้าหลัก) */
export const todayQueue = [
  { time: '08:00', name: 'ป้าคำปุ่น ทาสี', done: true },
  { time: '09:00', name: 'แม่บุญมา ศรีคำ', done: true },
  { time: '10:30', name: 'ตาแก้ว มูลเมือง', done: true },
  { time: '13:30', name: 'ลุงจันทร์ แก้วมูล · ติดตามอาการท้องอืด', done: false },
  { time: '16:00', name: 'น้องฝน ปัญญาดี', done: false },
];

/** ตารางนัด 7 วัน (แถบวันที่แบบ ref) */
export const week = [
  { d: 12, w: 'อา.' },
  { d: 13, w: 'จ.' },
  { d: 14, w: 'อ.' },
  { d: 15, w: 'พ.', today: true },
  { d: 16, w: 'พฤ.' },
  { d: 17, w: 'ศ.' },
  { d: 18, w: 'ส.' },
];

export const schedule = [
  { time: '09:00', patientId: 'p1', what: 'นวดประคบเข่า', range: '09:00 – 10:00 น.' },
  { time: '11:00', patientId: null, what: '', range: '' },
  { time: '13:30', patientId: 'p2', what: 'ติดตามอาการท้องอืด', range: '13:30 – 14:00 น.' },
  { time: '16:00', patientId: 'p3', what: 'อบสมุนไพรหลังคลอด', range: '16:00 – 17:00 น.' },
];

/** อวตาร์ (DiceBear "Avataaars" by Pablo Stanley — ใช้ได้ฟรีเชิงพาณิชย์) */
export const avatars: Record<string, number> = {
  doctor: require('../../assets/avatars/doctor.png'),
  p1: require('../../assets/avatars/p1.png'),
  p2: require('../../assets/avatars/p2.png'),
  p3: require('../../assets/avatars/p3.png'),
  p4: require('../../assets/avatars/p4.png'),
  p5: require('../../assets/avatars/p5.png'),
  q3: require('../../assets/avatars/q3.png'),
};

/** อวาตาร์ 3D สำหรับผู้ป่วยใหม่ (เลือกตามเพศและช่วงวัย) */
const GENERIC = {
  child: { ชาย: require('../../assets/avatars/generic/child_m.png'), หญิง: require('../../assets/avatars/generic/child_f.png') },
  young: { ชาย: require('../../assets/avatars/generic/young_m.png'), หญิง: require('../../assets/avatars/generic/young_f.png') },
  adult: { ชาย: require('../../assets/avatars/generic/adult_m.png'), หญิง: require('../../assets/avatars/generic/adult_f.png') },
  senior: { ชาย: require('../../assets/avatars/generic/senior_m.png'), หญิง: require('../../assets/avatars/generic/senior_f.png') },
} as const;

/** รูปผู้ป่วย: มีรูปเฉพาะคนใช้รูปนั้น ไม่มีก็ใช้อวาตาร์ตามเพศ/อายุ */
export function avatarFor(p: Pick<Patient, 'id' | 'sex' | 'age'>): number {
  if (avatars[p.id]) return avatars[p.id];
  const band = p.age < 13 ? 'child' : p.age < 30 ? 'young' : p.age < 55 ? 'adult' : 'senior';
  return GENERIC[band][p.sex === 'ชาย' ? 'ชาย' : 'หญิง'];
}

/** วันนี้ (เที่ยงคืน ตามเวลาเครื่อง) */
export const TODAY = (() => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
})();
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** ตารางนัดตัวอย่าง (คีย์ = YYYY-MM-DD) — วางรอบ "วันนี้" ให้บัญชีใหม่เห็นนัดเสมอ */
export type Appt = { start: string; end: string; pid: string; what: string };
/** นัดหมายตัวอย่างถูกเอาออกแล้ว */
export const agenda: Record<string, Appt[]> = {};

const TH_DAY = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const TH_MONTH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
/** เช่น "ศุกร์ 16 ตุลาคม" */
export const thaiDate = (d: Date) => `${TH_DAY[d.getDay()]} ${d.getDate()} ${TH_MONTH[d.getMonth()]}`;
/** เวลาปัจจุบัน HH:MM สำหรับเทียบกับเวลานัด */
export const nowHM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
