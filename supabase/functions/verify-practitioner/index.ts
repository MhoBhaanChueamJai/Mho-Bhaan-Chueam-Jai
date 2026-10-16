// ยืนยันตัวตนหมอพื้นบ้าน — ทำงานฝั่งเซิร์ฟเวอร์ (Supabase Edge Function, Deno)
// 1) ตรวจเลขบัตรประชาชน (checksum) + อายุ
// 2) ค้นทะเบียนหมอพื้นบ้านที่ได้รับการรับรอง กรมการแพทย์แผนไทยฯ
//    https://www.dtam.moph.go.th/traditional-cert/
//    แล้วเทียบ ชื่อ–นามสกุล ↔ เลขที่หนังสือรับรอง (รวมเลขต่ออายุ), วันหมดอายุ, ประเภทหมอพื้นบ้าน
// 3) ผ่าน → profiles.role = 'practitioner' (ผู้ใช้แก้ role เองไม่ได้ ดู trigger protect_profile_role)
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const DTAM = 'https://www.dtam.moph.go.th/wp-admin/admin-ajax.php?action=ninja_tables_dt_public&table_id=45792';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** ประเภทหมอพื้นบ้าน: คีย์ในแอป ↔ คอลัมน์ในทะเบียนกรม */
const TYPES: Record<string, { col: string; label: string }> = {
  midwife: { col: 'is_midwife', label: 'หมอตำแย' },
  herbal: { col: 'is_herbalist', label: 'หมอยาสมุนไพร' },
  massage: { col: 'is_massage', label: 'หมอนวดพื้นบ้าน' },
  bone: { col: 'หมอกระดูก', label: 'หมอกระดูก' },
  venom: { col: 'is_venom_healer', label: 'หมอรักษาสัตว์พิษกัด' },
  ritual: { col: 'is_ritual_healer', label: 'หมอพิธีกรรม' },
};

function validThaiId(id: string) {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}
const norm = (s: string) => (s ?? '').replace(/\s+/g, '').trim();
/** เลขหนังสือ: "นพ 00106" → "นพ106" (ตัดช่องว่าง/จุด/ศูนย์นำหน้า) */
const normCert = (s: string) => {
  const t = (s ?? '').replace(/[\s.\-/]/g, '');
  const m = t.match(/^(\D*)(\d+)$/);
  return m ? `${m[1]}${Number(m[2])}` : t;
};
const MON: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
/** "14-Oct-73" (ปี พ.ศ. 2 หลัก) → Date ค.ศ. */
function parseExpiry(s: string): Date | null {
  const m = (s ?? '').match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
  if (!m) return null;
  const be = 2500 + Number(m[3]);
  return new Date(Date.UTC(be - 543, MON[m[2].toLowerCase()] ?? 0, Number(m[1])));
}
const sha256 = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`mbcj:${s}`))), (b) => b.toString(16).padStart(2, '0')).join('');

async function searchRegistry(term: string) {
  const body = new URLSearchParams({ draw: '1', start: '0', length: '50', 'search[value]': term });
  const r = await fetch(DTAM, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: 'https://www.dtam.moph.go.th/traditional-cert/', 'User-Agent': 'Mozilla/5.0 MhoBhaanChueamJai' },
    body,
  });
  if (!r.ok) throw new Error(`registry ${r.status}`);
  const d = await r.json();
  return (d.data ?? []) as Record<string, string>[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: u, error: ue } = await admin.auth.getUser(jwt);
    if (ue || !u.user) return json({ ok: false, reason: 'กรุณาเข้าสู่ระบบก่อน' }, 401);
    const uid = u.user.id;

    const b = await req.json();
    const title = String(b.title ?? '').trim();
    const first = String(b.first_name ?? '').trim();
    const last = String(b.last_name ?? '').trim();
    const age = Number(b.age);
    const nid = String(b.national_id ?? '').replace(/\D/g, '');
    const education = String(b.education ?? '').trim();
    const cert = String(b.cert_number ?? '').trim();
    const types: string[] = Array.isArray(b.healer_types) ? b.healer_types.filter((t: string) => TYPES[t]) : [];

    const base = {
      owner: uid,
      title,
      first_name: first,
      last_name: last,
      age: Number.isFinite(age) ? age : null,
      national_id_hash: await sha256(nid),
      national_id_last4: nid.slice(-4),
      education,
      healer_types: types,
      cert_number: cert,
    };
    const reject = async (reason: string, registry: unknown = null) => {
      await admin.from('verifications').insert({ ...base, status: 'rejected', reason, registry });
      return json({ ok: false, reason });
    };

    // ── ตรวจข้อมูลพื้นฐาน ──
    if (!first || !last) return json({ ok: false, reason: 'กรอกชื่อและนามสกุลให้ครบ' });
    if (!validThaiId(nid)) return reject('เลขบัตรประชาชนไม่ถูกต้อง (ตรวจสอบเลข 13 หลักอีกครั้ง)');
    if (!Number.isFinite(age) || age < 20 || age > 110) return reject('อายุต้องอยู่ระหว่าง 20–110 ปี');
    if (!education) return reject('กรุณาระบุวุฒิการศึกษา');
    if (!types.length) return reject('เลือกประเภทหมอพื้นบ้านอย่างน้อย 1 ประเภท');
    if (!cert) return reject('กรอกเลขที่หนังสือรับรองการเป็นหมอพื้นบ้าน');

    // ── ค้นทะเบียนกรมการแพทย์แผนไทยฯ ──
    const rows = await searchRegistry(first);
    const byName = rows.filter((r) => norm(r.first_name) === norm(first) && norm(r.last_name) === norm(last));
    if (!byName.length) return reject(`ไม่พบชื่อ "${first} ${last}" ในทะเบียนหมอพื้นบ้านที่ได้รับการรับรอง`);

    const want = normCert(cert);
    const hit = byName.find((r) => [r.certificate_number, r.renew_certificate_number_1].filter(Boolean).some((c) => normCert(c) === want));
    // ไม่เปิดเผยเลขจริงในทะเบียน (กันคนแอบอ้างนำไปกรอกซ้ำ)
    if (!hit) return reject('เลขที่หนังสือรับรองไม่ตรงกับชื่อในทะเบียน');

    const expiry = [parseExpiry(hit.renew_expiry_date_1), parseExpiry(hit.expiry_date)].filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] ?? null;
    const registry = {
      title: hit.title,
      first_name: hit.first_name,
      last_name: hit.last_name,
      province: hit.province_name,
      health_zone: hit.health_zone,
      certificate_number: hit.certificate_number,
      renew_certificate_number: hit.renew_certificate_number_1 || null,
      expiry: expiry?.toISOString().slice(0, 10) ?? null,
      types: Object.entries(TYPES)
        .filter(([, t]) => hit[t.col] === '1')
        .map(([k]) => k),
    };
    if (expiry && expiry.getTime() < Date.now()) return reject(`หนังสือรับรองหมดอายุแล้ว (${registry.expiry}) กรุณาต่ออายุก่อน`, registry);
    const notInRegistry = types.filter((t) => !registry.types.includes(t));
    if (notInRegistry.length) {
      const labels = (ks: string[]) => ks.map((k) => TYPES[k].label).join(', ');
      return reject(`ประเภทหมอพื้นบ้านไม่ตรงกับทะเบียน — ไม่ได้รับรองเป็น ${labels(notInRegistry)}`, registry);
    }

    // ── ผ่าน: บันทึก + ยกระดับสิทธิ์ ──
    await admin.from('verifications').insert({ ...base, status: 'verified', registry });
    const { error: pe } = await admin
      .from('profiles')
      .update({
        role: 'practitioner',
        first_name: hit.first_name,
        last_name: hit.last_name,
        display_name: `${hit.first_name} ${hit.last_name}`,
        healer_types: registry.types,
        cert_number: hit.renew_certificate_number_1 || hit.certificate_number,
        cert_province: hit.province_name,
        cert_expiry: registry.expiry,
        verified_at: new Date().toISOString(),
      })
      .eq('id', uid);
    if (pe) throw pe;
    return json({ ok: true, registry });
  } catch (e) {
    return json({ ok: false, reason: `ตรวจสอบไม่สำเร็จ: ${(e as Error).message}` }, 500);
  }
});
