-- ── ตำราที่แชร์: ต้นฉบับแก้ไข → สำเนาของเพื่อนอัปเดตตาม ─────────────────
-- รหัสแชร์ผูกกับตำราต้นฉบับ (wisdom_id) · สำเนาฝั่งผู้รับจำรหัสไว้ (share_code)
-- ผู้รับขอเนื้อหาล่าสุดผ่าน get_shared_wisdom(รหัส) เท่านั้น (อ่านตารางของคนอื่นตรงๆ ไม่ได้)
-- ต้นฉบับถูกลบ → ฟังก์ชันไม่คืนค่า สำเนาฝั่งผู้รับยังอยู่ตามเดิม

alter table public.wisdom_shares add column if not exists wisdom_id text;
alter table public.wisdoms add column if not exists share_code text;

create or replace function public.get_shared_wisdom(p_code text)
returns table (title text, kind text, summary text, ingredients text[], method text, indication text, caution text)
language sql security definer set search_path = public stable as $$
  select w.title, w.kind, w.summary, w.ingredients, w.method, w.indication, w.caution
  from public.wisdom_shares s
  join public.wisdoms w on w.owner = s.owner and w.id = s.wisdom_id
  where s.code = upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'))
  limit 1;
$$;
revoke all on function public.get_shared_wisdom(text) from public, anon;
grant execute on function public.get_shared_wisdom(text) to authenticated;
