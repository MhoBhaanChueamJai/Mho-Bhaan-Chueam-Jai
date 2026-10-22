/**
 * ข้อมูลสุขภาพของผู้ใช้เอง (หน้าข้อมูลส่วนตัว) — วันเกิด อายุ เพศ น้ำหนัก ส่วนสูง → ธาตุเจ้าเรือน
 * คนทั่วไปถามเรื่องตัวเอง → ครูปัญญาใช้ข้อมูลนี้ประกอบคำแนะนำ (เก็บในเครื่องเท่านั้น)
 * ตั้งค่าจาก store เหมือนบทบาท ให้ prompt ที่อยู่นอก React อ่านได้
 */
import type { Patient } from '../data/mock';
import { ageFrom, elementFromMonth } from './birth';
import type { PlanPerson } from './plan';
import { kindOf } from './roles';

export type MyHealth = { birth?: string; age?: number; sex?: 'ชาย' | 'หญิง'; weight?: number; height?: number; element?: Patient['element'] };

/** อายุ: จากวันเกิด (ถ้ามี) ไม่งั้นใช้ที่กรอกไว้ */
export const myAge = (h?: MyHealth) => (h?.birth ? ageFrom(h.birth) : h?.age);
/** ธาตุเจ้าเรือน: ที่เลือกเอง หรือคำนวณจากเดือนเกิด */
export const myElement = (h?: MyHealth): Patient['element'] | undefined => h?.element ?? (h?.birth ? elementFromMonth(Number(h.birth.slice(5, 7))) : undefined);
export const myBmi = (h?: MyHealth) => (h?.weight && h?.height ? h.weight / (h.height / 100) ** 2 : undefined);
export const bmiLabel = (b: number) => (b < 18.5 ? 'น้ำหนักน้อย' : b < 23 ? 'ปกติ' : b < 25 ? 'น้ำหนักเกิน' : b < 30 ? 'อ้วนระดับ 1' : 'อ้วนระดับ 2');

let ME: MyHealth | null = null;
/** ใช้เฉพาะคนทั่วไป (หมอถามเรื่องผู้ป่วย ไม่ใช่ตัวเอง) */
export const setMe = (h?: MyHealth, kind?: string | null) => {
  ME = kindOf(kind) === 'public' && h ? h : null;
};
export const hasMe = () => !!ME && !!(myAge(ME) || ME.sex || myElement(ME) || ME.weight);

/** สรุปสั้นสำหรับ prompt */
export function meLine(h: MyHealth | null = ME): string {
  if (!h) return '';
  const bmi = myBmi(h);
  const el = myElement(h);
  return [
    h.sex,
    myAge(h) ? `อายุ ${myAge(h)} ปี` : '',
    el ? `ธาตุเจ้าเรือน${el}` : '',
    h.weight ? `น้ำหนัก ${h.weight} กก.` : '',
    h.height ? `ส่วนสูง ${h.height} ซม.` : '',
    bmi ? `BMI ${bmi.toFixed(1)} (${bmiLabel(bmi)})` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** บล็อกใน prompt แชท: ใช้เมื่อผู้ใช้ถามเรื่องตัวเอง */
export function meBrief(): string {
  const line = hasMe() ? meLine() : '';
  return line
    ? `ข้อมูลสุขภาพของผู้ใช้ (บันทึกไว้ในโปรไฟล์): ${line}\nถ้าผู้ใช้ถามเรื่องตัวเอง ให้ใช้ข้อมูลนี้ประกอบคำแนะนำได้เลยโดยไม่ต้องถามซ้ำ เช่น ธาตุเจ้าเรือนกับรสยา/อาหารที่เหมาะ ช่วงวัย น้ำหนักตัว · ถ้าถามแทนคนอื่น (ลูก พ่อแม่ เพื่อน) ห้ามใช้ข้อมูลนี้`
    : '';
}

/** ใช้เติมข้อมูลคนไข้ในแนวทางรักษา เมื่อปรึกษาให้ตัวเอง */
export function mePerson(): Partial<PlanPerson> {
  if (!hasMe()) return {};
  return { sex: ME!.sex, age: myAge(ME!), element: myElement(ME!) };
}

/** ใช้ตรวจกลุ่มเสี่ยง (อายุ) */
export const meRisk = () => (hasMe() ? { age: myAge(ME!) } : null);
