-- ระบบสมาชิก + ยืนยันตัวตนหมอพื้นบ้าน
-- role: member (สมัครทั่วไป) → practitioner (ยืนยันกับทะเบียนกรมการแพทย์แผนไทยฯ แล้ว)
-- การเปลี่ยน role ทำได้เฉพาะฝั่งเซิร์ฟเวอร์ (Edge Function ที่ใช้ service role) เท่านั้น

alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists role text not null default 'member';
alter table public.profiles add column if not exists healer_types text[] default '{}';
alter table public.profiles add column if not exists cert_number text;
alter table public.profiles add column if not exists cert_province text;
alter table public.profiles add column if not exists cert_expiry date;
alter table public.profiles add column if not exists verified_at timestamptz;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('member', 'practitioner', 'admin'));
-- username ไม่บังคับแล้ว (สมัครด้วยอีเมล)
alter table public.profiles alter column username drop not null;

-- คำขอยืนยันตัวตน (เขียนได้เฉพาะ Edge Function; ผู้ใช้อ่านของตัวเองได้)
create table if not exists public.verifications (
  id bigint generated always as identity primary key,
  owner uuid not null references auth.users (id) on delete cascade,
  title text,
  first_name text not null,
  last_name text not null,
  age int,
  national_id_hash text not null,
  national_id_last4 text,
  education text,
  healer_types text[] default '{}',
  cert_number text not null,
  status text not null check (status in ('verified', 'rejected')),
  reason text,
  registry jsonb,
  created_at timestamptz default now()
);
create index if not exists verifications_owner on public.verifications (owner, created_at desc);
alter table public.verifications enable row level security;
drop policy if exists "read own verifications" on public.verifications;
create policy "read own verifications" on public.verifications for select to authenticated using (owner = auth.uid());

-- กันผู้ใช้แก้ role / ข้อมูลการรับรองของตัวเอง (อนุญาตเฉพาะ service role)
create or replace function public.protect_profile_role()
returns trigger language plpgsql as $$
begin
  -- มี JWT (เรียกผ่าน API) และไม่ใช่ service role → ห้ามแก้ส่วนการรับรอง
  -- ไม่มี JWT = เข้าฐานข้อมูลตรงจาก dashboard/ผู้ดูแล → อนุญาต
  if nullif(current_setting('request.jwt.claims', true), '') is not null
     and coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '') <> 'service_role' then
    new.role := old.role;
    new.healer_types := old.healer_types;
    new.cert_number := old.cert_number;
    new.cert_province := old.cert_province;
    new.cert_expiry := old.cert_expiry;
    new.verified_at := old.verified_at;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role before update on public.profiles
for each row execute function public.protect_profile_role();

-- สมัครบัญชีใหม่ → สร้างโปรไฟล์จาก metadata (ชื่อ นามสกุล)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name, first_name, last_name, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    coalesce(nullif(trim(concat(new.raw_user_meta_data ->> 'first_name', ' ', new.raw_user_meta_data ->> 'last_name')), ''), new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.email
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- การรักษาผู้ป่วย (ผู้ป่วย / ทะเบียนการรักษา / นัดหมาย) — เฉพาะหมอพื้นบ้านที่ยืนยันแล้ว
create or replace function public.is_practitioner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('practitioner', 'admin'));
$$;

do $$
declare t text;
begin
  foreach t in array array['patients', 'visits', 'appointments'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('drop policy if exists "practitioner rows" on public.%I', t);
    execute format('create policy "practitioner rows" on public.%I for all to authenticated using (owner = auth.uid() and public.is_practitioner()) with check (owner = auth.uid() and public.is_practitioner())', t);
  end loop;
end $$;

-- บัญชีทดสอบเดิม (somchai) ให้เป็นหมอพื้นบ้านเพื่อไม่ให้ข้อมูลที่มีอยู่ใช้งานไม่ได้
update public.profiles set role = 'practitioner', healer_types = array['herbal'] where username = 'somchai';
