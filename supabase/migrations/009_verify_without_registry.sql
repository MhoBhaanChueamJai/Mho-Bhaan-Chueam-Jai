-- ยืนยันตัวตนหมอพื้นบ้านแบบไม่ตรวจกับทะเบียนกรมการแพทย์แผนไทยฯ (ช่วงให้ผู้ทดสอบที่ไม่ใช่หมอจริงใช้งานได้)
-- แอปเรียก rpc('verify_practitioner_self', …) → บันทึกข้อมูลที่กรอก (ไม่กรอกก็ได้) + เปลี่ยน role เป็น practitioner ทันที
-- กลับไปตรวจกับทะเบียนจริง: ให้แอปเรียก Edge Function verify-practitioner เหมือนเดิม แล้ว drop ฟังก์ชันนี้

-- trigger กัน role: อนุญาตเพิ่มเมื่อเปลี่ยนผ่านฟังก์ชันนี้ (ตั้งค่า app.self_verify ภายในธุรกรรม)
create or replace function public.protect_profile_role()
returns trigger language plpgsql as $$
begin
  if nullif(current_setting('request.jwt.claims', true), '') is not null
     and coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '') <> 'service_role'
     and coalesce(current_setting('app.self_verify', true), '') <> '1' then
    new.role := old.role;
    new.healer_types := old.healer_types;
    new.cert_number := old.cert_number;
    new.cert_province := old.cert_province;
    new.cert_expiry := old.cert_expiry;
    new.verified_at := old.verified_at;
  end if;
  return new;
end $$;

create or replace function public.verify_practitioner_self(
  p_title text,
  p_first_name text,
  p_last_name text,
  p_healer_types text[],
  p_cert_number text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  perform set_config('app.self_verify', '1', true);
  update public.profiles
     set role = case when role = 'admin' then role else 'practitioner' end,
         -- ช่องที่ไม่กรอก = ใช้ข้อมูลเดิมของบัญชี
         first_name = coalesce(nullif(trim(coalesce(p_first_name, '')), ''), first_name),
         last_name = coalesce(nullif(trim(coalesce(p_last_name, '')), ''), last_name),
         display_name = coalesce(nullif(trim(concat(trim(coalesce(p_first_name, '')), ' ', trim(coalesce(p_last_name, '')))), ''), display_name),
         healer_types = coalesce(p_healer_types, healer_types),
         cert_number = nullif(trim(coalesce(p_cert_number, '')), ''),
         verified_at = now()
   where id = uid;
  perform set_config('app.self_verify', '', true);
end $$;

revoke all on function public.verify_practitioner_self(text, text, text, text[], text) from public, anon;
grant execute on function public.verify_practitioner_self(text, text, text, text[], text) to authenticated;
