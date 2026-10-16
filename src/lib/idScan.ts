import { chatJSON, ocrImage } from '../api/ai';

/** ข้อมูลที่อ่านได้จากบัตรประชาชน (ไม่มีเลขบัตร) */
export type IdCardData = {
  name?: string;
  sex?: string;
  bDay?: string;
  bMonth?: string;
  bYear?: string; // พ.ศ.
  address?: string; // ที่อยู่เต็มตามบัตร (รวมซอย ถนน)
  houseNo?: string;
  moo?: string;
  village?: string;
  subdistrict?: string;
  district?: string;
  province?: string;
};

/** รูปบัตร → OCR → AI แยกข้อมูล (ห้ามคืนเลขบัตรประชาชน) */
export async function readIdCard(uri: string, mime = 'image/jpeg'): Promise<IdCardData> {
  const text = await ocrImage(uri, mime);
  const r = await chatJSON<IdCardData>([
    {
      role: 'user',
      content: `ข้อความจากบัตรประจำตัวประชาชนไทย (OCR):\n${text}\n\nแยกข้อมูลตอบ JSON เท่านั้น ห้ามใส่เลขบัตรประชาชน ช่องที่อ่านไม่ได้ให้เป็น "":
{"name":"คำนำหน้า ชื่อ สกุล (ภาษาไทย)","sex":"ชาย|หญิง (จากคำนำหน้า)","bDay":"วันเกิด 1-31","bMonth":"เดือนเกิด 1-12","bYear":"ปีเกิด พ.ศ. 4 หลัก","address":"ที่อยู่เต็มตามที่พิมพ์บนบัตรทุกคำ รวมเลขที่ หมู่ ซอย ถนน ตำบล อำเภอ จังหวัด (ห้ามตัดทิ้ง)"}`,
    },
  ]);
  return r ?? {};
}

/** ส่งผลการอ่านบัตรจากหน้ากล้อง (/id-scan) กลับไปหน้าที่เปิด */
let pending: IdCardData | null = null;
export const setIdScanResult = (r: IdCardData) => {
  pending = r;
};
export const takeIdScanResult = () => {
  const r = pending;
  pending = null;
  return r;
};
