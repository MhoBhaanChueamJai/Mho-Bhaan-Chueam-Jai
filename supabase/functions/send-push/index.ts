// ส่งแจ้งเตือนแบบ Push ไปทุกเครื่อง — Supabase Edge Function (Deno) ส่งตรงไป Apple (APNs) ไม่ผ่านบริการอื่น
// เรียกจาก Database Webhook: ตาราง announcements · INSERT · header x-push-secret = PUSH_SECRET
// ความลับที่ต้องตั้ง (Edge Functions → Secrets):
//   APNS_KEY_ID · APNS_TEAM_ID · APNS_PRIVATE_KEY (เนื้อไฟล์ .p8 ทั้งหมด) · APNS_BUNDLE_ID (th.bms.suebsan) · PUSH_SECRET
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { SignJWT, importPKCS8 } from 'npm:jose@5.9.6';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const PROD = 'https://api.push.apple.com';
const SANDBOX = 'https://api.sandbox.push.apple.com';

type Announcement = { id: string; kind: string; title: string; body: string; go: string | null; pushed_at: string | null };

/** JWT สำหรับ APNs (อายุได้ไม่เกิน 1 ชม. — สร้างใหม่ทุกครั้งที่ฟังก์ชันทำงาน) */
async function apnsJwt() {
  const pem = Deno.env.get('APNS_PRIVATE_KEY')!.replace(/\\n/g, '\n');
  const key = await importPKCS8(pem, 'ES256');
  return new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: Deno.env.get('APNS_KEY_ID')! }).setIssuer(Deno.env.get('APNS_TEAM_ID')!).setIssuedAt().sign(key);
}

/** ส่งเครื่องเดียว: ลอง production ก่อน ถ้า token เป็นของแอปที่ติดตั้งจาก Xcode (sandbox) ค่อยลอง sandbox */
async function sendOne(jwt: string, token: string, payload: string, collapse: string) {
  const headers = {
    authorization: `bearer ${jwt}`,
    'apns-topic': Deno.env.get('APNS_BUNDLE_ID') ?? 'th.bms.suebsan',
    'apns-push-type': 'alert',
    'apns-priority': '10',
    'apns-collapse-id': collapse.slice(0, 64),
  };
  let reason = '';
  for (const host of [PROD, SANDBOX]) {
    const r = await fetch(`${host}/3/device/${token}`, { method: 'POST', headers, body: payload });
    if (r.ok) return 'ok';
    reason = (await r.json().catch(() => ({})))?.reason ?? String(r.status);
    if (r.status === 410 || reason === 'Unregistered') return 'gone';
    if (reason !== 'BadDeviceToken') return reason; // ผิดอย่างอื่น (เช่น key ผิด) ไม่ต้องลองอีก host
  }
  return reason === 'BadDeviceToken' ? 'gone' : reason;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const secret = Deno.env.get('PUSH_SECRET');
  if (!secret || req.headers.get('x-push-secret') !== secret) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const input = await req.json().catch(() => ({}));
  // Database Webhook ส่ง { type, record } · เรียกเองส่ง { id }
  const id = input?.record?.id ?? input?.id;
  if (!id) return json({ error: 'no announcement id' }, 400);
  const { data: a, error } = await admin.from('announcements').select('*').eq('id', id).single<Announcement>();
  if (error || !a) return json({ error: 'announcement not found' }, 404);
  if (a.pushed_at && !input?.force) return json({ skipped: 'already pushed' });

  const tokens: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await admin.from('push_tokens').select('token').range(from, from + 999);
    tokens.push(...(data ?? []).map((t) => t.token));
    if (!data || data.length < 1000) break;
  }

  const jwt = await apnsJwt();
  const payload = JSON.stringify({
    aps: { alert: { title: a.title, body: a.body }, sound: 'default', 'thread-id': a.kind },
    // แอปอ่านข้อมูลจากคีย์ body (รูปแบบของ expo-notifications)
    body: { id: a.id, kind: a.kind, go: a.go ?? '/notifications' },
  });
  const result: Record<string, number> = {};
  const gone: string[] = [];
  for (let i = 0; i < tokens.length; i += 20) {
    const batch = tokens.slice(i, i + 20);
    const out = await Promise.all(batch.map((t) => sendOne(jwt, t, payload, a.id).catch((e) => String(e))));
    out.forEach((r, j) => {
      result[r] = (result[r] ?? 0) + 1;
      if (r === 'gone') gone.push(batch[j]);
    });
  }
  // ลบเครื่องที่ถอนแอป/token หมดอายุ
  if (gone.length) await admin.from('push_tokens').delete().in('token', gone);
  await admin.from('announcements').update({ pushed_at: new Date().toISOString() }).eq('id', a.id);
  return json({ sent: tokens.length, result });
});
