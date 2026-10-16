-- วันเดือนปีเกิดของผู้ป่วย (ค.ศ.) — ใช้คำนวณอายุและธาตุเจ้าเรือน
alter table public.patients add column if not exists birth_date date;
