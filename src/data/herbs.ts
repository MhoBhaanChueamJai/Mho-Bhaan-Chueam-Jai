import type { ImageSourcePropType } from 'react-native';

export type Taste = 'ขม' | 'ฝาด' | 'เผ็ดร้อน' | 'หอมเย็น' | 'เปรี้ยว' | 'มัน' | 'เค็ม' | 'หวาน' | 'เมาเบื่อ';

export type Herb = {
  id: string;
  name: string;
  local: string; // ชื่อท้องถิ่น
  sci: string;
  image: ImageSourcePropType;
  taste: Taste;
  element: 'ดิน' | 'น้ำ' | 'ลม' | 'ไฟ';
  part: string;
  uses: string[];
  howto: string;
  caution: string;
  nationalList?: boolean; // บัญชียาหลักแห่งชาติ (ยาจากสมุนไพร)
  credit: string;
};

export const herbs: Herb[] = [
  {
    id: 'andrographis',
    name: 'ฟ้าทะลายโจร',
    local: 'น้ำลายพังพอน, หญ้ากันงู',
    sci: 'Andrographis paniculata',
    image: require('../../assets/herbs/andrographis.jpg'),
    taste: 'ขม',
    element: 'ไฟ',
    part: 'ใบ, ทั้งต้น',
    uses: ['บรรเทาอาการเจ็บคอ', 'ลดไข้ หวัด', 'ท้องเสียไม่ติดเชื้อ'],
    howto: 'ผงแห้งบรรจุแคปซูล 1.5–3 กรัม วันละ 4 ครั้ง หลังอาหารและก่อนนอน ไม่เกิน 7 วัน',
    caution: 'ห้ามใช้ในหญิงตั้งครรภ์ ผู้ใช้ยาลดความดัน/ยาละลายลิ่มเลือด หากมีผื่น ใจสั่น ให้หยุดยา',
    nationalList: true,
    credit: 'Wikimedia Commons',
  },
  {
    id: 'turmeric',
    name: 'ขมิ้นชัน',
    local: 'ขมิ้นแกง, ขมิ้นหัว',
    sci: 'Curcuma longa',
    image: require('../../assets/herbs/turmeric.jpg'),
    taste: 'ฝาด',
    element: 'ดิน',
    part: 'เหง้า',
    uses: ['ท้องอืด ท้องเฟ้อ', 'แผลในกระเพาะอาหาร', 'ผื่นคันผิวหนัง'],
    howto: 'ผงเหง้าแห้ง 2–4 แคปซูล (500 มก.) วันละ 3–4 ครั้ง หลังอาหาร',
    caution: 'ระวังในผู้มีนิ่วในถุงน้ำดี และผู้ใช้ยาต้านการแข็งตัวของเลือด',
    nationalList: true,
    credit: 'Wikimedia Commons',
  },
  {
    id: 'plai',
    name: 'ไพล',
    local: 'ปูลอย, ว่านไฟ',
    sci: 'Zingiber montanum',
    image: require('../../assets/herbs/plai.jpg'),
    taste: 'เผ็ดร้อน',
    element: 'ลม',
    part: 'เหง้า',
    uses: ['ฟกช้ำ เคล็ดขัดยอก', 'ปวดเมื่อยกล้ามเนื้อ', 'ลูกประคบ'],
    howto: 'ใช้ทำลูกประคบร่วมกับขมิ้น ตะไคร้ ใบมะขาม หรือน้ำมันไพลทาถู วันละ 2–3 ครั้ง',
    caution: 'ไม่ใช้กับแผลเปิด ห้ามประคบภายใน 24 ชม. แรกของการบาดเจ็บ',
    nationalList: true,
    credit: 'Wikimedia Commons',
  },
  {
    id: 'ginger',
    name: 'ขิง',
    local: 'ขิงแกง, ขิงเผือก',
    sci: 'Zingiber officinale',
    image: require('../../assets/herbs/ginger.jpg'),
    taste: 'เผ็ดร้อน',
    element: 'ลม',
    part: 'เหง้าแก่',
    uses: ['คลื่นไส้ อาเจียน เมารถ', 'ท้องอืด', 'ขับลม'],
    howto: 'ต้มเหง้าสด 2–4 กรัม ดื่มเป็นชา หรือผงแห้ง 1 กรัม ก่อนเดินทาง 30 นาที',
    caution: 'ระวังในผู้มีภาวะเลือดออกง่าย หรือก่อนผ่าตัด',
    nationalList: true,
    credit: 'Köhler’s Medizinal-Pflanzen (public domain)',
  },
  {
    id: 'krachai',
    name: 'กระชาย',
    local: 'ขิงจีน, ว่านพระอาทิตย์',
    sci: 'Boesenbergia rotunda',
    image: require('../../assets/herbs/krachai.jpg'),
    taste: 'เผ็ดร้อน',
    element: 'ลม',
    part: 'เหง้า, ราก',
    uses: ['ปวดท้อง ท้องอืด', 'บำรุงกำลัง', 'แก้บิด'],
    howto: 'ต้มเหง้าสด 5–10 กรัม ดื่มวันละ 2 ครั้ง',
    caution: 'ใช้ต่อเนื่องนาน อาจระคายเคืองกระเพาะ ระวังในผู้มีโรคตับ',
    credit: 'Wikimedia Commons',
  },
  {
    id: 'boraphet',
    name: 'บอระเพ็ด',
    local: 'เครือเขาฮอ, จุ่งจะลิงตัวแม่',
    sci: 'Tinospora crispa',
    image: require('../../assets/herbs/boraphet.jpg'),
    taste: 'ขม',
    element: 'ไฟ',
    part: 'เถา',
    uses: ['แก้ไข้', 'เจริญอาหาร', 'ขับเหงื่อ'],
    howto: 'เถาสด 2 คืบ ต้มกับน้ำ 3 แก้ว เคี่ยวเหลือ 1 แก้ว ดื่มครั้งละ ⅓ แก้ว',
    caution: 'ห้ามใช้ในผู้ป่วยโรคตับ หญิงตั้งครรภ์ และผู้ใช้ยาเบาหวาน (อาจทำให้น้ำตาลต่ำ)',
    credit: 'Wikimedia Commons',
  },
  {
    id: 'senna',
    name: 'มะขามแขก',
    local: 'มะขามฝักแขก',
    sci: 'Senna alexandrina',
    image: require('../../assets/herbs/senna.jpg'),
    taste: 'เมาเบื่อ',
    element: 'น้ำ',
    part: 'ใบ, ฝัก',
    uses: ['แก้ท้องผูก', 'ระบาย'],
    howto: 'ใบแห้ง 3–10 กรัม ชงน้ำร้อน ดื่มก่อนนอน',
    caution: 'ไม่ควรใช้เกิน 7 วัน ห้ามใช้ในผู้มีลำไส้อุดตัน ปวดท้องไม่ทราบสาเหตุ',
    nationalList: true,
    credit: 'Wikimedia Commons',
  },
  {
    id: 'lemongrass',
    name: 'ตะไคร้',
    local: 'จะไคร, หัวสิงไค',
    sci: 'Cymbopogon citratus',
    image: require('../../assets/herbs/lemongrass.jpg'),
    taste: 'หอมเย็น',
    element: 'น้ำ',
    part: 'ต้น, เหง้า',
    uses: ['ขับปัสสาวะ', 'ขับลม แก้ท้องอืด', 'ลดความดันเล็กน้อย'],
    howto: 'ต้นสด 1 กำมือ (40–60 กรัม) ต้มดื่มวันละ 3 ครั้ง ก่อนอาหาร',
    caution: 'ระวังในผู้ป่วยโรคไตที่ต้องจำกัดน้ำ',
    credit: 'Wikimedia Commons',
  },
  {
    id: 'aloe',
    name: 'ว่านหางจระเข้',
    local: 'หางตะเข้',
    sci: 'Aloe vera',
    image: require('../../assets/herbs/aloe.jpg'),
    taste: 'ขม',
    element: 'น้ำ',
    part: 'วุ้นในใบ',
    uses: ['แผลไฟไหม้ น้ำร้อนลวก', 'ผิวไหม้แดด'],
    howto: 'ล้างยางเหลืองออก ใช้วุ้นใสทาบริเวณแผลวันละ 3–4 ครั้ง',
    caution: 'ล้างยางสีเหลืองออกให้หมด อาจระคายเคืองผิว ทดสอบที่ท้องแขนก่อน',
    credit: 'Wikimedia Commons',
  },
  {
    id: 'centella',
    name: 'บัวบก',
    local: 'ผักหนอก, ผักแว่น',
    sci: 'Centella asiatica',
    image: require('../../assets/herbs/centella.jpg'),
    taste: 'หอมเย็น',
    element: 'น้ำ',
    part: 'ทั้งต้น',
    uses: ['ช้ำใน', 'ร้อนใน', 'สมานแผล'],
    howto: 'ทั้งต้นสด 1 กำมือ ตำคั้นน้ำดื่ม หรือครีมบัวบก 1% ทาแผล',
    caution: 'ไม่ควรใช้ต่อเนื่องเกิน 6 สัปดาห์ ระวังในผู้ป่วยโรคตับ',
    nationalList: true,
    credit: 'Wikimedia Commons',
  },
  {
    id: 'galangal',
    name: 'ข่า',
    local: 'ข่าหลวง, กุก',
    sci: 'Alpinia galanga',
    image: require('../../assets/herbs/galangal.jpg'),
    taste: 'เผ็ดร้อน',
    element: 'ลม',
    part: 'เหง้า',
    uses: ['กลากเกลื้อน', 'ท้องอืด จุกเสียด', 'ลมพิษ'],
    howto: 'เหง้าแก่ตำกับเหล้าโรง ทาบริเวณกลากเกลื้อนวันละ 2 ครั้ง',
    caution: 'ไม่ใช้บนผิวหนังที่มีแผลเปิด',
    credit: 'Wikimedia Commons',
  },
  {
    id: 'kaffir',
    name: 'มะกรูด',
    local: 'มะขู, มะหูด',
    sci: 'Citrus hystrix',
    image: require('../../assets/herbs/kaffir.jpg'),
    taste: 'เปรี้ยว',
    element: 'ลม',
    part: 'ผิวผล, น้ำในผล',
    uses: ['ขับลม', 'แก้ไอ ขับเสมหะ', 'บำรุงเส้นผม'],
    howto: 'น้ำมะกรูดผสมเกลือเล็กน้อย จิบแก้ไอ หรือผิวผลต้มขับลม',
    caution: 'น้ำมันหอมระเหยเข้มข้น อาจระคายผิวเมื่อโดนแดด',
    credit: 'Wikimedia Commons',
  },
];

export const tastes: (Taste | 'ทั้งหมด')[] = ['ทั้งหมด', 'ขม', 'เผ็ดร้อน', 'หอมเย็น', 'ฝาด', 'เปรี้ยว', 'เมาเบื่อ'];

/** สีพาสเทลประจำรสยา */
export const tasteTone: Record<Taste, { bg: string; fg: string }> = {
  ขม: { bg: '#E2EEC0', fg: '#4F7A1F' },
  ฝาด: { bg: '#FCE6D8', fg: '#A8642B' },
  เผ็ดร้อน: { bg: '#FDE6E3', fg: '#D14B3C' },
  หอมเย็น: { bg: '#D4EBF2', fg: '#1C7A92' },
  เปรี้ยว: { bg: '#FBF1C9', fg: '#9A7A0E' },
  มัน: { bg: '#FCE6D8', fg: '#A8642B' },
  เค็ม: { bg: '#E3ECFE', fg: '#2860D8' },
  หวาน: { bg: '#FBE1EE', fg: '#C23D80' },
  เมาเบื่อ: { bg: '#E9E4FB', fg: '#7448C9' },
};

export const manuscriptImage = require('../../assets/herbs/manuscript.jpg');
