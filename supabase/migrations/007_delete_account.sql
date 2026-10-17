-- ลบบัญชีผู้ใช้ (เรียกจากแอป: หน้าตั้งค่า → ลบบัญชี)
-- ลบผู้ใช้ใน auth.users → ข้อมูลทุกตารางที่ owner อ้างถึงผู้ใช้นี้ถูกลบตาม (on delete cascade):
--   profiles · patients · visits · appointments · wisdoms · user_events · verifications · wisdom_shares
-- ไฟล์เสียงใน Storage แอปลบผ่าน Storage API ก่อนเรียกฟังก์ชันนี้ (ลบ storage.objects ตรงๆ ด้วย SQL ไม่ได้)
-- บัญชีทดลองใช้ (ใช้ร่วมกันหลายคน) ลบไม่ได้
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
  if mail = 'somchai@mhobhaan.app' then
    raise exception 'demo account cannot be deleted';
  end if;
  delete from auth.users where id = uid;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
