-- หมอบ้านเชื่อมใจ — โครงสร้างฐานข้อมูล (Supabase / Postgres)
-- ทุกตารางผูกกับเจ้าของ (owner = auth.uid()) และเปิด RLS: หมอแต่ละคนเห็นเฉพาะข้อมูลของตัวเอง
-- วิธีใช้: Supabase Dashboard › SQL Editor › วางไฟล์นี้ทั้งไฟล์ › Run

-- ── โปรไฟล์หมอพื้นบ้าน ─────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  display_name text,
  doctor_type text default 'herbal',
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ── ผู้ป่วย (ข้อมูลทั่วไปตามแบบ ม.บ.5) ───────────────────────────
create table if not exists public.patients (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  sex text,
  age int,
  address jsonb default '{}'::jsonb,
  phone text,
  chronic text,
  allergies text,
  weight numeric,
  height numeric,
  element text,
  status text default 'ติดตามอาการ',
  meds text[] default '{}',
  created_at timestamptz default now(),
  primary key (owner, id)
);

-- ── ทะเบียนการรักษา (แถวในแบบ ม.บ.5) ───────────────────────────
create table if not exists public.visits (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  patient_id text not null,
  no int not null,
  date text,
  symptoms text,
  exam text,
  diagnosis text,
  treatment text,
  result text,
  follow_up text,
  note text,
  created_at timestamptz default now(),
  primary key (owner, patient_id, no),
  foreign key (owner, patient_id) references public.patients (owner, id) on delete cascade
);

-- ── นัดหมาย ───────────────────────────────────────────────────
create table if not exists public.appointments (
  id bigint generated always as identity primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  patient_id text not null,
  day date not null,
  start_time text not null,
  end_time text,
  what text,
  created_at timestamptz default now(),
  foreign key (owner, patient_id) references public.patients (owner, id) on delete cascade
);
create index if not exists appointments_owner_day on public.appointments (owner, day);

-- ── คลังภูมิปัญญา (ตำรับยา/ตำราโบราณ) ─────────────────────────
create table if not exists public.wisdoms (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  title text not null,
  kind text,
  source text,
  date text,
  minutes int,
  summary text,
  ingredients text[],
  method text,
  indication text,
  caution text,
  verified boolean default false,
  created_at timestamptz default now(),
  primary key (owner, id)
);

-- ── พฤติกรรมการใช้งาน (ให้ครูปัญญาแนะนำคำค้น) ──────────────────
create table if not exists public.user_events (
  id bigint generated always as identity primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('search', 'open')),
  value text not null,
  at timestamptz default now()
);
create index if not exists user_events_owner_at on public.user_events (owner, at desc);

-- ── Row Level Security ───────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.visits enable row level security;
alter table public.appointments enable row level security;
alter table public.wisdoms enable row level security;
alter table public.user_events enable row level security;

do $$
declare t text;
begin
  foreach t in array array['patients', 'visits', 'appointments', 'wisdoms', 'user_events'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid())', t);
  end loop;
end $$;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- สร้างโปรไฟล์อัตโนมัติเมื่อสมัครบัญชี (ชื่อผู้ใช้มาจาก metadata ตอน signUp)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)), new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();
