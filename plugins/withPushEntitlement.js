/**
 * สิทธิ์ Push (aps-environment) — ใส่เฉพาะเมื่อ ENABLE_PUSH=1
 * ทีมพัฒนาแบบ Personal (Apple ID ฟรี) เปิด Push Notifications ไม่ได้ → ถ้ามีสิทธิ์นี้ build ลงเครื่องจริงไม่ผ่าน
 * เมื่อสมัคร Apple Developer Program แล้ว: ENABLE_PUSH=1 npx expo prebuild -p ios
 */
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = (config) =>
  withEntitlementsPlist(config, (c) => {
    if (process.env.ENABLE_PUSH === '1') c.modResults['aps-environment'] = c.modResults['aps-environment'] || 'development';
    else delete c.modResults['aps-environment'];
    return c;
  });
