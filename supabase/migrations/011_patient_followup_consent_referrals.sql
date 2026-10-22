-- ผู้ป่วย: เก็บนัดติดตามครั้งถัดไป ใบยินยอม (PDPA) และประวัติการส่งต่อ บนคลาวด์ด้วย
-- เดิมมีแค่ในเครื่องที่บันทึก → เปิดเครื่องอื่น/เว็บแล้วไม่เห็นนัด ลายเซ็นยินยอม และการส่งต่อ
alter table public.patients add column if not exists follow_up_on date;
alter table public.patients add column if not exists consent jsonb;
alter table public.patients add column if not exists referrals jsonb;
