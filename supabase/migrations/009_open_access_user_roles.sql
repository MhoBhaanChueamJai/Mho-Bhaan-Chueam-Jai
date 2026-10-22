-- เลิกระบบยืนยันตัวตนหมอ · ผู้ใช้เลือกบทบาทเอง (แพทย์แผนไทย / แพทย์แผนปัจจุบัน / ประชาชนทั่วไป / หมอพื้นบ้าน)
-- 1) ผู้ป่วย / ทะเบียนการรักษา / นัดหมาย: ทุกบัญชีที่เข้าสู่ระบบจัดการข้อมูลของตัวเองได้ (เดิมเฉพาะหมอที่ยืนยันแล้ว)
-- 2) ปิดช่องโหว่: ลบโปรไฟล์ตัวเองแล้วสร้างใหม่พร้อม role อื่น (เดิมตัวกันทำงานเฉพาะตอนแก้ไข ไม่กันตอนสร้าง)
-- 3) บทบาทผู้ใช้ (user_role) เก็บในโปรไฟล์ แก้เองได้
-- ข้อมูลการยืนยันเดิม (ตาราง verifications, คอลัมน์ cert_*) เก็บไว้ ไม่ลบ

do $$
declare t text;
begin
  foreach t in array array['patients', 'visits', 'appointments'] loop
    execute format('drop policy if exists "practitioner rows" on public.%I', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid())', t);
  end loop;
end $$;

-- บทบาทผู้ใช้ (เลือกเองตอนสมัคร/ในตั้งค่า)
-- ไม่มีค่าเริ่มต้น: null = ยังไม่ได้เลือก (แอปจะถามหลังเข้าสู่ระบบ)
-- public = ประชาชนทั่วไป (ไม่มีเมนูผู้ป่วย) · clinician = หมอ/บุคลากรสุขภาพ · ค่าอื่นเผื่อแยกบทบาทละเอียดในอนาคต
alter table public.profiles add column if not exists user_role text;
alter table public.profiles drop constraint if exists profiles_user_role_check;
alter table public.profiles add constraint profiles_user_role_check check (user_role is null or user_role in ('public', 'clinician', 'thai_medicine', 'modern_medicine', 'folk_healer'));

-- โปรไฟล์: อ่าน/แก้ของตัวเองได้ · ไม่ให้ลบหรือสร้างเองผ่าน API (สร้างโดย trigger ตอนสมัคร · ลบผ่าน delete_account)
drop policy if exists "own profile" on public.profiles;
drop policy if exists "own profile read" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- role ฝั่งระบบ (member/practitioner/admin) แก้จาก API ไม่ได้ทั้งตอนสร้างและแก้
create or replace function public.protect_profile_role()
returns trigger language plpgsql as $$
begin
  if nullif(current_setting('request.jwt.claims', true), '') is not null
     and coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.role := 'member';
      new.healer_types := '{}';
      new.cert_number := null; new.cert_province := null; new.cert_expiry := null; new.verified_at := null;
    else
      new.role := old.role;
      new.healer_types := old.healer_types;
      new.cert_number := old.cert_number;
      new.cert_province := old.cert_province;
      new.cert_expiry := old.cert_expiry;
      new.verified_at := old.verified_at;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role before insert or update on public.profiles
for each row execute function public.protect_profile_role();
