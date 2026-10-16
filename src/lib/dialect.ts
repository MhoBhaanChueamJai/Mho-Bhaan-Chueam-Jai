/** ภาษาที่หมอใช้คุยกับครูปัญญา (ตั้งในหน้าตั้งค่า) — ใช้บอก AI ให้ฟังและตีความได้แม่นขึ้น */
export type Dialect = 'central' | 'isan' | 'north' | 'south';

export const DIALECTS: { id: Dialect; label: string; note: string }[] = [
  { id: 'central', label: 'ภาษากลาง', note: 'ภาษาไทยกลาง' },
  { id: 'isan', label: 'อีสาน', note: 'ภาษาอีสาน / ลาว' },
  { id: 'north', label: 'เหนือ', note: 'คำเมือง' },
  { id: 'south', label: 'ใต้', note: 'ภาษาใต้' },
];

let current: Dialect = 'central';
export const setDialect = (d: Dialect) => {
  current = d;
};
export const getDialect = () => current;

/** ข้อความแนบให้ AI: ผู้พูดใช้ภาษาถิ่นอะไร */
export function dialectHint(): string {
  switch (current) {
    case 'isan':
      return 'หมอพูดภาษาอีสาน (ลาว) เป็นหลัก เช่น บ่ = ไม่, แม่น = ใช่, เจ็บแอว = ปวดเอว, เป็นหยัง = เป็นอะไร, หลาย = มาก ตีความเป็นภาษาไทยกลางให้ถูกต้อง';
    case 'north':
      return 'หมอพูดคำเมือง (ภาษาเหนือ) เป็นหลัก เช่น บ่ = ไม่, เจ้า = ครับ/ค่ะ, ปวดหัว = เจ็บหัว, กิ๋น = กิน, ลำ = อร่อย ตีความเป็นภาษาไทยกลางให้ถูกต้อง';
    case 'south':
      return 'หมอพูดภาษาใต้เป็นหลัก เช่น ไม่หอ = ไม่มี, หรอย = อร่อย, แหลง = พูด, ม่าย = ไม่ ตีความเป็นภาษาไทยกลางให้ถูกต้อง';
    default:
      return 'หมอพูดภาษาไทยกลางเป็นหลัก แต่อาจมีคำภาษาถิ่นปน ให้ตีความจากบริบท';
  }
}
