-- สมัครด้วย Google: ข้อมูลบัญชีมาเป็น full_name / name (ไม่มี first_name / last_name แบบที่แอปส่งตอนสมัครด้วยอีเมล)
-- → แยกชื่อ-นามสกุลจากชื่อเต็มให้ (คำแรก = ชื่อ ที่เหลือ = นามสกุล)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  md jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text := nullif(trim(coalesce(md ->> 'full_name', md ->> 'name', '')), '');
  fn text := coalesce(nullif(md ->> 'first_name', ''), md ->> 'given_name', split_part(full_name, ' ', 1));
  ln text := coalesce(nullif(md ->> 'last_name', ''), md ->> 'family_name', nullif(trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)), ''));
begin
  insert into public.profiles (id, username, display_name, first_name, last_name, email)
  values (
    new.id,
    md ->> 'username',
    coalesce(nullif(trim(concat(md ->> 'first_name', ' ', md ->> 'last_name')), ''), full_name, md ->> 'display_name', split_part(new.email, '@', 1)),
    nullif(fn, ''),
    ln,
    new.email
  )
  on conflict (id) do nothing;
  return new;
end $$;
