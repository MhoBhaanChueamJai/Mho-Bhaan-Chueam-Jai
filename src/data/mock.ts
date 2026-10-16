/** ข้อมูลตัวอย่าง (Mockup) ที่อิงสถานการณ์จริงของหมอพื้นบ้านไทย */

export const doctor = {
  name: 'พ่อหมอสมบัติ ใจดี',
  short: 'พ่อหมอสมบัติ',
  age: 68,
  type: 'หมอยาสมุนไพร',
  village: 'บ้านหนองบัว ต.ดอนแก้ว อ.แม่ริม จ.เชียงใหม่',
  license: 'หมอพื้นบ้านขึ้นทะเบียน สสจ.เชียงใหม่ เลขที่ ชม.0412/2564',
  years: 42,
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
};

const DONKAEW = { subdistrict: 'ดอนแก้ว', district: 'แม่ริม', province: 'เชียงใหม่' };

export const patients: Patient[] = [
  {
    id: 'p1',
    name: 'นางบุญมา ศรีคำ',
    sex: 'หญิง',
    age: 72,
    address: { houseNo: '45', moo: '3', village: 'บ้านหนองบัว', ...DONKAEW },
    phone: '081-234-5678',
    chronic: 'ความดันโลหิตสูง',
    allergies: 'แพ้ยาซัลฟา',
    weight: 58,
    height: 152,
    element: 'ลม',
    status: 'นัดวันนี้',
    meds: ['Amlodipine 5 มก.'],
    visits: [
      {
        no: 3,
        date: '08/10/2569',
        symptoms: 'ปวดเข่าลดลง เดินได้ไกลขึ้น ยังฝืดตอนเช้า',
        exam: 'เข่าบวมลดลง กดเจ็บด้านในเล็กน้อย งอเข่าได้มากขึ้น',
        diagnosis: 'ลมจับโปงแห้ง (ข้อเข่าเสื่อม)',
        treatment: 'นวดพื้นบ้าน 30 นาที + ประคบสมุนไพรไพล ขมิ้น ตะไคร้',
        result: 'ระดับปวด 7 → 4 (เต็ม 10)',
        followUp: 'นัด 15/10/2569 วัดความดันทุกครั้ง',
      },
      {
        no: 2,
        date: '04/10/2569',
        symptoms: 'ปวดเข่าทั้งสองข้าง ตอนเช้าเดินลำบาก',
        exam: 'เข่าบวมเล็กน้อย ความดัน 142/88',
        diagnosis: 'ลมจับโปงแห้ง',
        treatment: 'ประคบสมุนไพร + ยาต้มแก้ลมจับโปง (สูตรพ่อหมอ)',
        result: 'ระดับปวด 7 → 6',
        followUp: 'นัด 8/10/2569',
        note: 'แนะนำเลี่ยงนั่งพับเพียบ',
      },
      {
        no: 1,
        date: '01/10/2569',
        symptoms: 'ปวดเข่าทั้งสองข้าง 3 เดือน กำเริบเมื่ออากาศเย็น',
        exam: 'เข่าบวม กดเจ็บด้านใน มีเสียงกรอบแกรบเมื่องอ',
        diagnosis: 'ลมจับโปงแห้ง',
        treatment: 'นวดคลายกล้ามเนื้อรอบเข่า + ประคบ',
        result: 'ปวดลดลงเล็กน้อย',
        followUp: 'นัด 4/10/2569',
      },
    ],
  },
  {
    id: 'p2',
    name: 'นายจันทร์ แก้วมูล',
    sex: 'ชาย',
    age: 65,
    address: { houseNo: '112', moo: '5', village: 'บ้านดอนแก้ว', road: 'เชียงใหม่–ฝาง', ...DONKAEW },
    phone: '089-876-5432',
    chronic: 'ไม่มี',
    allergies: 'ไม่มี',
    weight: 71,
    height: 168,
    element: 'ไฟ',
    status: 'ติดตามอาการ',
    meds: [],
    visits: [
      {
        no: 1,
        date: '12/10/2569',
        symptoms: 'ท้องอืด แน่นท้องหลังอาหาร เรอบ่อย 2 สัปดาห์',
        exam: 'ท้องโป่งตึงเล็กน้อย ไม่มีกดเจ็บ',
        diagnosis: 'ธาตุไฟหย่อน อาหารไม่ย่อย',
        treatment: 'ขมิ้นชัน 2 แคปซูล หลังอาหาร 3 เวลา + ชาขิง',
        result: 'รอติดตาม',
        followUp: 'นัด 15/10/2569',
        note: 'ดื่มสุราเป็นประจำ แนะนำให้ลด',
      },
    ],
  },
  {
    id: 'p3',
    name: 'นางสาวฝน ปัญญาดี',
    sex: 'หญิง',
    age: 34,
    address: { houseNo: '9/1', moo: '3', village: 'บ้านหนองบัว', ...DONKAEW },
    phone: '062-555-0198',
    chronic: 'ไม่มี',
    allergies: 'ไม่มี',
    weight: 54,
    height: 160,
    element: 'น้ำ',
    status: 'ติดตามอาการ',
    meds: ['วิตามินบำรุงเลือด'],
    visits: [
      {
        no: 2,
        date: '10/10/2569',
        symptoms: 'หลังคลอด 3 สัปดาห์ ปวดเมื่อยตัว',
        exam: 'มดลูกเข้าอู่ดี น้ำนมไหลปกติ',
        diagnosis: 'ดูแลมารดาหลังคลอด (อยู่ไฟ)',
        treatment: 'อบสมุนไพร ใบมะขาม ตะไคร้ ไพล ใบส้มป่อย 20 นาที',
        result: 'สดชื่นขึ้น ปวดเมื่อยลดลง',
        followUp: 'นัด 15/10/2569',
      },
      {
        no: 1,
        date: '03/10/2569',
        symptoms: 'หลังคลอด 2 สัปดาห์ ต้องการอยู่ไฟ',
        exam: 'สัญญาณชีพปกติ ไม่มีไข้',
        diagnosis: 'ดูแลมารดาหลังคลอด',
        treatment: 'นวดคลายกล้ามเนื้อ + แนะนำอาหารบำรุงน้ำนม',
        result: 'ดี',
        followUp: 'เยี่ยมบ้านสัปดาห์ถัดไป',
      },
    ],
  },
  {
    id: 'p4',
    name: 'นายเสาร์ อินทร์ปัน',
    sex: 'ชาย',
    age: 79,
    address: { houseNo: '78', moo: '7', village: 'บ้านป่าไผ่', ...DONKAEW },
    phone: '053-111-222',
    chronic: 'โรคหัวใจ',
    allergies: 'ไม่มี',
    weight: 62,
    height: 165,
    element: 'ดิน',
    status: 'ส่งต่อ รพ.สต.',
    meds: ['Aspirin 81 มก.', 'ยาขยายหลอดเลือด'],
    visits: [
      {
        no: 1,
        date: '05/10/2569',
        symptoms: 'เจ็บแน่นหน้าอก เหนื่อยหอบ',
        exam: 'หายใจเร็ว เหงื่อออก',
        diagnosis: 'สงสัยภาวะหัวใจ — เกินขอบเขตหมอพื้นบ้าน',
        treatment: 'ไม่ให้การรักษา ส่งต่อทันที',
        result: 'ส่งต่อ รพ.สต.ดอนแก้ว',
        followUp: 'โทรติดตามกับญาติ',
        note: 'ครูปัญญาแจ้งสัญญาณอันตราย',
      },
    ],
  },
  {
    id: 'p5',
    name: 'นางคำปุ่น ทาสี',
    sex: 'หญิง',
    age: 58,
    address: { houseNo: '20', moo: '3', village: 'บ้านหนองบัว', ...DONKAEW },
    phone: '086-321-7788',
    chronic: 'ไม่มี',
    allergies: 'แพ้กุ้ง',
    weight: 60,
    height: 155,
    element: 'ลม',
    status: 'หายดี',
    meds: [],
    visits: [
      {
        no: 2,
        date: '28/09/2569',
        symptoms: 'นอนหลับได้ 6–7 ชม. ไม่ปวดศีรษะ',
        exam: 'คอบ่าไหล่ไม่ตึง',
        diagnosis: 'ลมปลายปัตคาด (หายแล้ว)',
        treatment: 'นวดคอบ่าไหล่ปิดคอร์ส',
        result: 'หายดี',
        followUp: 'ไม่ต้องนัด',
      },
      {
        no: 1,
        date: '14/09/2569',
        symptoms: 'นอนไม่หลับ ปวดศีรษะเรื้อรัง',
        exam: 'กล้ามเนื้อคอบ่าไหล่ตึงแข็ง',
        diagnosis: 'ลมปลายปัตคาด',
        treatment: 'นวดคอบ่าไหล่ + ยาหอมเทพจิตร',
        result: 'นอนหลับดีขึ้น',
        followUp: 'นวดทุก 3 วัน 4 ครั้ง',
      },
    ],
  },
];

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
  source: 'เสียงเล่า' | 'สแกนตำรา' | 'พิมพ์เอง' | 'เพื่อนแชร์';
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
};

export const wisdoms: Wisdom[] = [
  {
    id: 'w1',
    title: 'ยาต้มแก้ลมจับโปง (สูตรพ่อหมอสมบัติ)',
    kind: 'ตำรับยา',
    source: 'เสียงเล่า',
    date: '12 ต.ค. 2569',
    minutes: 6,
    summary: 'ตำรับสืบทอดจากพ่อหมอแก้ว ใช้รักษาอาการปวดบวมข้อเข่าในผู้สูงอายุธาตุลม',
    ingredients: ['เถาเอ็นอ่อน 1 กำมือ', 'โคคลาน 1 กำมือ', 'แก่นฝาง 15 กรัม', 'ไพล 3 แว่น', 'ขิงแก่ 3 แว่น'],
    method: 'ต้มกับน้ำ 3 ส่วน เคี่ยวให้เหลือ 1 ส่วน ดื่มครั้งละครึ่งแก้ว เช้า–เย็น ก่อนอาหาร 7 วัน',
    indication: 'ปวดเข่า ข้อบวม เดินลำบากช่วงเช้า',
    caution: 'ระวังในผู้ป่วยโรคไต และผู้ใช้ยาลดความดัน',
    verified: true,
  },
  {
    id: 'w2',
    title: 'ตำรายาแก้ไข้ป่า (สมุดข่อยวัดดอนแก้ว)',
    kind: 'ตำราโบราณ',
    source: 'สแกนตำรา',
    date: '2 ต.ค. 2569',
    summary: 'ถอดความจากสมุดข่อยอายุราว 120 ปี เก็บรักษาที่วัดดอนแก้ว 14 หน้า',
    ingredients: ['บอระเพ็ด', 'ฟ้าทะลายโจร', 'รากย่านาง', 'จันทน์แดง'],
    verified: false,
  },
  {
    id: 'w3',
    title: 'วิธีนวดคลายเส้นเอ็นข้อมือ',
    kind: 'วิธีรักษา',
    source: 'เสียงเล่า',
    date: '20 ก.ย. 2569',
    minutes: 11,
    summary: 'นวดตามแนวเส้นสิบ จุดสัญญาณข้อมือ 3 จุด ร่วมกับประคบไพล',
    verified: true,
  },
];

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
const inDays = (n: number) => dayKey(new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + n));

/** ตารางนัดตัวอย่าง (คีย์ = YYYY-MM-DD) — วางรอบ "วันนี้" ให้บัญชีใหม่เห็นนัดเสมอ */
export type Appt = { start: string; end: string; pid: string; what: string };
export const agenda: Record<string, Appt[]> = {
  [inDays(-3)]: [{ start: '10:00', end: '10:30', pid: 'p5', what: 'ติดตามอาการนอนไม่หลับ' }],
  [inDays(-2)]: [{ start: '09:30', end: '10:30', pid: 'p3', what: 'อบสมุนไพรหลังคลอด' }],
  [inDays(0)]: [
    { start: '09:00', end: '10:00', pid: 'p1', what: 'นวดประคบเข่า' },
    { start: '13:30', end: '14:00', pid: 'p2', what: 'ติดตามอาการท้องอืด' },
    { start: '16:00', end: '17:00', pid: 'p3', what: 'อบสมุนไพรหลังคลอด' },
  ],
  [inDays(1)]: [{ start: '14:00', end: '14:30', pid: 'p4', what: 'โทรติดตามหลังส่งต่อ รพ.สต.' }],
  [inDays(3)]: [{ start: '09:00', end: '10:00', pid: 'p1', what: 'นวดประคบเข่า ครั้งที่ 5' }],
  [inDays(5)]: [{ start: '13:00', end: '13:30', pid: 'p2', what: 'ประเมินผลยาขมิ้นชัน' }],
};

const TH_DAY = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const TH_MONTH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
/** เช่น "ศุกร์ 16 ตุลาคม" */
export const thaiDate = (d: Date) => `${TH_DAY[d.getDay()]} ${d.getDate()} ${TH_MONTH[d.getMonth()]}`;
/** เวลาปัจจุบัน HH:MM สำหรับเทียบกับเวลานัด */
export const nowHM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
