/** ส่งรูปบัตรประชาชนที่ถ่าย/เลือก จากหน้ากล้อง (/id-scan) กลับไปหน้าที่เปิด */
let pending: { uri: string; mime: string } | null = null;
export const setIdScanResult = (r: { uri: string; mime: string }) => {
  pending = r;
};
export const takeIdScanResult = () => {
  const r = pending;
  pending = null;
  return r;
};
