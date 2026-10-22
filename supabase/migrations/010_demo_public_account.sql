-- บัญชีทดลองใช้ฝั่งประชาชน (somsri · สมศรี มีสุข) — ปุ่ม "ทดลองใช้" หน้าเข้าสู่ระบบ เลือกได้ แพทย์ (somchai) / ประชาชน (somsri)
-- ใช้ร่วมกันหลายคน จึงลบบัญชีไม่ได้ เหมือน somchai (migration 007)
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  mail text;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  select email into mail from auth.users where id = uid;
  if mail in ('somchai@mhobhaan.app', 'somsri@mhobhaan.app') then
    raise exception 'demo account cannot be deleted';
  end if;
  delete from auth.users where id = uid;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ประเภทผู้ใช้ของบัญชีทดลอง (แอปตั้งในเครื่องอยู่แล้ว · ใส่ไว้ให้ตรงกันบนคลาวด์)
update public.profiles p set user_role = v.k
from (values ('somchai@mhobhaan.app', 'clinician'), ('somsri@mhobhaan.app', 'public')) v(e, k), auth.users u
where u.email = v.e and p.id = u.id;
