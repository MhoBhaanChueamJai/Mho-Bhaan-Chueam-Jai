-- ── แชร์ตำรา/ภูมิปัญญาให้เพื่อนหมอ ด้วยรหัสแชร์ ─────────────────────
-- ผู้แชร์สร้างรหัส (เก็บสำเนาตำรา ณ ตอนแชร์) → เพื่อนกรอกรหัส/เปิดลิงก์ → ดูตัวอย่างแล้วเก็บเข้าคลังของตัวเอง
-- อ่านได้ผ่านฟังก์ชัน get_wisdom_share เท่านั้น (ไม่เปิดให้ select ทั้งตาราง → เดารหัสไล่ดูไม่ได้)

create table if not exists public.wisdom_shares (
  code text primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_name text,
  payload jsonb not null,
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '30 days'
);
alter table public.wisdom_shares enable row level security;

drop policy if exists "own shares" on public.wisdom_shares;
create policy "own shares" on public.wisdom_shares for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

create or replace function public.get_wisdom_share(p_code text)
returns table (from_name text, payload jsonb, created_at timestamptz)
language sql security definer set search_path = public stable as $$
  select s.from_name, s.payload, s.created_at
  from public.wisdom_shares s
  where s.code = upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'))
    and s.expires_at > now()
  limit 1;
$$;
revoke all on function public.get_wisdom_share(text) from public, anon;
grant execute on function public.get_wisdom_share(text) to authenticated;

-- ตำราที่ได้รับจากเพื่อน: เก็บชื่อผู้แชร์ไว้
alter table public.wisdoms add column if not exists shared_by text;
