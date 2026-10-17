-- แจ้งเตือนแบบ Push: ประกาศจากทางระบบ (อัปเดตระบบ · สมุนไพรใหม่ · คลังภูมิปัญญา · เนื้อหาใหม่)
-- ทางระบบเพิ่มแถวใน announcements (Table Editor / SQL) → Database Webhook เรียก Edge Function send-push
-- → ส่ง push ไปทุกเครื่องผ่าน APNs + แอปแสดงประกาศเดียวกันในหน้าแจ้งเตือน

-- เครื่องที่รับ push (device token ของ APNs)
create table if not exists public.push_tokens (
  token text primary key,
  owner uuid references auth.users on delete cascade,
  platform text not null default 'ios',
  updated_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
-- ไม่มี policy = แอปอ่าน/แก้ตารางตรงๆ ไม่ได้ ลงทะเบียนผ่านฟังก์ชันด้านล่างเท่านั้น (Edge Function ใช้ service role)

-- ลงทะเบียน/ย้ายเจ้าของ token (เรียกได้ทั้งบัญชีจริงและบัญชีทดลองใช้)
create or replace function public.register_push_token(p_token text, p_platform text default 'ios')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 300 then
    raise exception 'invalid token';
  end if;
  insert into public.push_tokens (token, owner, platform, updated_at)
  values (p_token, auth.uid(), coalesce(p_platform, 'ios'), now())
  on conflict (token) do update set owner = excluded.owner, platform = excluded.platform, updated_at = now();
end $$;
revoke all on function public.register_push_token(text, text) from public;
grant execute on function public.register_push_token(text, text) to anon, authenticated;

-- ประกาศจากทางระบบ (ทุกคนอ่านได้ · เพิ่มได้เฉพาะผู้ดูแลผ่าน Dashboard/SQL)
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'system' check (kind in ('system', 'herb', 'wisdom', 'content')),
  title text not null,
  body text not null default '',
  -- หน้าที่เปิดเมื่อกด เช่น /herbs · /vault · /herb/<id> · /about
  go text,
  created_at timestamptz not null default now(),
  pushed_at timestamptz
);
alter table public.announcements enable row level security;
drop policy if exists "announcements readable" on public.announcements;
create policy "announcements readable" on public.announcements for select to anon, authenticated using (true);
create index if not exists announcements_created_idx on public.announcements (created_at desc);
