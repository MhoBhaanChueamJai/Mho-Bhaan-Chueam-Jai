import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { chatJSON, llm, ocrImage } from '../api/ai';

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

const FIELDS = `{"name":"คำนำหน้า ชื่อ สกุล (ภาษาไทย)","sex":"ชาย|หญิง (จากคำนำหน้า)","bDay":"วันเกิด 1-31","bMonth":"เดือนเกิด 1-12","bYear":"ปีเกิด พ.ศ. 4 หลัก","address":"ที่อยู่เต็มตามที่พิมพ์บนบัตรทุกคำ รวมเลขที่ หมู่ ซอย ถนน ตำบล อำเภอ จังหวัด (ห้ามตัดทิ้ง)"}`;

const parse = (raw: string): IdCardData => {
  const m = raw.match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : {};
};

/** อ่านได้อย่างน้อยหนึ่งช่อง (ที่เหลือให้ผู้ใช้กรอกเอง) */
export const hasAnyField = (d?: IdCardData | null) => !!d && Object.values(d).some((v) => typeof v === 'string' && v.trim());

/**
 * รูปบัตร → อ่านข้อมูล (ห้ามคืนเลขบัตรประชาชน)
 * บัตรมักมีแสงสะท้อนทับตัวหนังสือ → ให้ Gemma 4 ดูภาพเองพร้อมข้อความจาก OCR (Typhoon) ช่วยกันอ่าน
 * ภาพล้มเหลว → ใช้ข้อความ OCR อย่างเดียว · ช่องที่อ่านไม่ออกเว้นว่าง ไม่เดา
 */
export async function readIdCard(uri: string, mime = 'image/jpeg'): Promise<IdCardData> {
  const [ocr, img] = await Promise.all([
    ocrImage(uri, mime).catch(() => ''),
    manipulateAsync(uri, [{ resize: { width: 1400 } }], { compress: 0.85, format: SaveFormat.JPEG, base64: true }).catch(() => null),
  ]);
  const ask = `${ocr ? `ข้อความที่ OCR อ่านได้ (อาจผิดหรือขาดตรงที่มีแสงสะท้อน):\n${ocr}\n\n` : ''}ช่องที่อ่านไม่ได้ให้เป็น "" ห้ามเดา ห้ามใส่เลขบัตรประชาชน ตอบ JSON เท่านั้น:\n${FIELDS}`;
  if (img?.base64) {
    try {
      const raw = await llm(
        [
          {
            role: 'user',
            content: [
              { type: 'text', text: `ภาพนี้คือด้านหน้าบัตรประจำตัวประชาชนไทย อาจมีแสงสะท้อนบังตัวหนังสือบางส่วน ให้อ่านจากภาพโดยตรง ใช้ข้อความ OCR ช่วยตรวจทาน\n\n${ask}` },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img.base64}` } },
            ],
          },
        ],
        { maxTokens: 600, timeoutMs: 60_000, temperature: 0.1 },
      );
      const r = parse(raw);
      if (hasAnyField(r)) return r;
    } catch {}
  }
  if (!ocr) return {};
  return (await chatJSON<IdCardData>([{ role: 'user', content: `ข้อความจากบัตรประจำตัวประชาชนไทย (OCR):\n${ocr}\n\n${ask}` }])) ?? {};
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
