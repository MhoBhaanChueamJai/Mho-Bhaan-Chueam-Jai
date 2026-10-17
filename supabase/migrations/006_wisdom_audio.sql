-- โหมดเล่า: เก็บเสียงเล่าต้นฉบับของตำรา
-- 1) คอลัมน์ audio ในตาราง wisdoms (รายการไฟล์ [{ path, sec }])
alter table public.wisdoms add column if not exists audio jsonb;

-- 2) ที่เก็บไฟล์เสียง (ส่วนตัว — เจ้าของเท่านั้นที่ฟัง/อัป/ลบได้) โฟลเดอร์ = รหัสผู้ใช้
insert into storage.buckets (id, name, public)
values ('wisdom-audio', 'wisdom-audio', false)
on conflict (id) do nothing;

drop policy if exists "wisdom audio read own" on storage.objects;
create policy "wisdom audio read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'wisdom-audio' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "wisdom audio insert own" on storage.objects;
create policy "wisdom audio insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'wisdom-audio' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "wisdom audio update own" on storage.objects;
create policy "wisdom audio update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'wisdom-audio' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "wisdom audio delete own" on storage.objects;
create policy "wisdom audio delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'wisdom-audio' and (storage.foldername(name))[1] = auth.uid()::text);

-- 3) ยืนยันหมอพื้นบ้าน: ค้นหนังสือรับรองซ้ำได้เร็ว (1 ใบ = 1 บัญชี)
create index if not exists profiles_cert_number on public.profiles (cert_number);
create index if not exists verifications_nid_hash on public.verifications (national_id_hash) where status = 'verified';
