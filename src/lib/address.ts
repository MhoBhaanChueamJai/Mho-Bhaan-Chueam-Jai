import type { Patient } from '../data/mock';

type Address = Patient['address'];

/** ส่วนที่อยู่ → ข้อความบรรทัดเดียว เช่น "78 หมู่ 8 บ้านหนองบัว ต.สร้อยพร้าว อ.หนองหาน จ.อุดรธานี" */
export function formatAddress(a: Partial<Address>): string {
  return [
    a.houseNo,
    a.moo ? `หมู่ ${a.moo}` : '',
    a.village,
    a.subdistrict ? `ต.${a.subdistrict.replace(/^(ตำบล|ต\.)\s*/, '')}` : '',
    a.district ? `อ.${a.district.replace(/^(อำเภอ|อ\.)\s*/, '')}` : '',
    a.province ? `จ.${a.province.replace(/^(จังหวัด|จ\.)\s*/, '')}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** ข้อความที่อยู่ช่องเดียว → แยกเป็นส่วน (เดาตามคำนำ หมู่ / ต. / อ. / จ.) */
export function parseAddress(text: string): Address {
  const t = ` ${text.replace(/\s+/g, ' ').trim()} `;
  const grab = (re: RegExp) => (t.match(re)?.[1] ?? '').trim();
  const province = grab(/(?:จังหวัด|จ\.)\s*([^\s]+)/);
  const district = grab(/(?:อำเภอ|อ\.)\s*([^\s]+)/);
  const subdistrict = grab(/(?:ตำบล|ต\.)\s*([^\s]+)/);
  const moo = grab(/(?:หมู่ที่|หมู่|ม\.)\s*(\d+)/);
  const houseNo = grab(/^\s*(\d+(?:\/\d+)?)/);
  const village = grab(/(บ้าน[^\s]+)/);
  return { houseNo, moo, village, subdistrict, district, province };
}
