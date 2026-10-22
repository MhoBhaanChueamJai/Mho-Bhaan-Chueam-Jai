/**
 * คำถามแนะนำในหน้าถามครูปัญญา — ปรับตามตัวผู้ใช้ (ไม่เรียก AI · แสดงทันที)
 *  - คนทั่วไป: ธาตุเจ้าเรือน ช่วงวัย น้ำหนัก (BMI) เพศ จากข้อมูลสุขภาพของฉัน + ฤดูตอนนี้
 *  - หมอ: เรื่องดูแลผู้ป่วยตามฤดู ตั้งตำรับ ความปลอดภัย
 */
import type { SFSymbol } from 'expo-symbols';
import { ageSamutthan, seasonNow } from './elements';
import { myAge, myBmi, myElement, type MyHealth } from './me';
import { kindOf } from './roles';

export type Suggest = { q: string; sym: SFSymbol };

const SEASON_SYM = { ไฟ: 'sun.max.fill', ลม: 'cloud.rain.fill', น้ำ: 'drop.fill', ดิน: 'leaf.fill' } as const;

export function suggestFor(kind?: string | null, me?: MyHealth, now = new Date()): Suggest[] {
  const ss = seasonNow(now);
  const season = ss.name.split(' ')[0]; // "ฤดูหนาว"
  const out: Suggest[] = [];
  const add = (q: string, sym: SFSymbol) => !out.some((s) => s.q === q) && out.push({ q, sym });

  if (kindOf(kind) !== 'public') {
    // หมอ / บุคลากร: โรคตามฤดู + งานประจำ
    const bySeason = { ไฟ: 'ไข้ ร้อนใน', ลม: 'ปวดเมื่อย ลมกำเริบ', น้ำ: 'หวัด ไอมีเสมหะ', ดิน: 'ท้องอืด' }[ss.el];
    add(`${season} ผู้ป่วย${bySeason}เยอะ ใช้ตำรับไหนดี`, SEASON_SYM[ss.el]);
    add('ผู้สูงอายุปวดเข่า ใช้สมุนไพรอะไรดี', 'figure.walk');
    add('ตั้งตำรับยาแก้ท้องอืดจากขิง ข่า ตะไคร้ ผสมอย่างไร', 'flask');
    add('ยาสมุนไพรกินคู่กับยาความดันได้ไหม', 'pills');
    return out.slice(0, 4);
  }

  // คนทั่วไป: ใช้ข้อมูลสุขภาพของฉัน (ถ้ามี)
  const el = myElement(me);
  const age = myAge(me);
  const bmi = myBmi(me);
  if (el) add(`คนธาตุ${el}อย่างฉัน ควรกินอาหารรสอะไร เลี่ยงอะไร`, 'leaf.fill');
  if (bmi && bmi >= 23) add('อยากลดน้ำหนัก มีสมุนไพรหรืออาหารแผนไทยช่วยไหม', 'scalemass.fill');
  else if (bmi && bmi < 18.5) add('กินข้าวไม่ค่อยลง ผอม มีสมุนไพรช่วยเจริญอาหารไหม', 'scalemass.fill');
  if (age) {
    if (age >= 60) add('ผู้สูงอายุอย่างฉัน ปวดเข่า ใช้สมุนไพรอะไรได้บ้าง', 'figure.walk');
    else if (age >= 32) add(`อายุ ${age} ปวดเมื่อย นอนไม่ค่อยหลับ มีสมุนไพรช่วยไหม`, 'wind');
    else if (age >= 16) add('ร้อนใน เป็นสิวบ่อย มีสมุนไพรอะไรช่วยได้', 'flame.fill');
    else add(`เด็กอายุ ${age} ปี ใช้สมุนไพรอะไรได้ ต้องระวังอะไร`, 'heart.fill');
  }
  if (me?.sex === 'หญิง' && age && age >= 12 && age <= 50) add('ปวดประจำเดือน ใช้สมุนไพรอะไรได้บ้าง', 'heart.fill');
  // ฤดู: ดูแลตัวเองตามธาตุที่กำเริบในฤดูนี้
  add(`${season}แบบนี้ ควรดูแลตัวเองอย่างไรตามแผนไทย`, SEASON_SYM[ss.el]);
  // ไม่มีข้อมูลพอ → คำถามทั่วไปที่คนถามบ่อย
  if (!el) add('อยากรู้ธาตุเจ้าเรือนของตัวเอง ดูอย่างไร', 'leaf.fill');
  add('เป็นหวัด เจ็บคอ ใช้ยาสมุนไพรอะไรได้', 'drop.fill');
  add('ฟ้าทะลายโจร ห้ามใช้กับใคร', 'exclamationmark.shield');
  add('ยาสมุนไพรกินคู่กับยาความดันได้ไหม', 'pills');
  return out.slice(0, 4);
}

/** คำอธิบายสั้นใต้หัวข้อ: บอกว่าแนะนำจากอะไร */
export function suggestWhy(kind?: string | null, me?: MyHealth, now = new Date()): string {
  if (kindOf(kind) !== 'public') return '';
  const el = myElement(me);
  const age = myAge(me);
  const parts = [el ? `ธาตุ${el}` : '', age ? `${ageSamutthan(age).stage}` : '', seasonNow(now).name.split(' ')[0]].filter(Boolean);
  return el || age ? `แนะนำตาม${parts.join(' · ')}` : '';
}

