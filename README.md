# QuizHub — Next.js + TypeScript + Supabase + Google Sheets

เว็บแอปข้อสอบจาก CSV สำหรับผู้ดูแลนำเข้าข้อสอบ และผู้เข้าสอบทำข้อสอบโดยกรอกชื่อ นามสกุล และรหัสนักศึกษาได้โดยไม่ต้องสมัครสมาชิก ผลตรวจจะถูกเก็บใน Supabase และส่งสรุปไป Google Sheets เมื่อกำหนดค่าการเชื่อมต่อแล้ว

## Requirements
- Node.js 20.9+
- npm
- Supabase project
- Google account สำหรับสร้าง Google Sheet และ Apps Script (ไม่บังคับ แต่จำเป็นหากต้องการส่งผลลง Sheets)

## 1. ติดตั้งและตั้งค่า

```bash
npm install
cp .env.example .env.local
```

ตั้งค่าใน `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — ใช้เฉพาะฝั่งเซิร์ฟเวอร์ ห้ามขึ้นต้นด้วย `NEXT_PUBLIC_` ห้ามส่งให้ผู้เข้าสอบ และห้าม commit ลง Git
- `GOOGLE_SHEETS_WEBHOOK_URL` — URL ของ Google Apps Script Web App (ดูหัวข้อ Google Sheets ด้านล่าง)
- `GOOGLE_SHEETS_WEBHOOK_SECRET` — secret ที่กำหนดเองให้ตรงกับ Apps Script

## 2. สร้างฐานข้อมูล

ใน Supabase Dashboard → SQL Editor ให้รัน `supabase/schema.sql` บนโปรเจกต์ฐานข้อมูลใหม่

หากเคยรัน schema รุ่นก่อนแล้ว อย่ารันไฟล์เดิมซ้ำตรง ๆ เพราะมี enum/ตารางอยู่แล้ว ให้ใช้ migration แยกเพิ่มคอลัมน์ `student_first_name`, `student_last_name`, `student_id` ใน `attempts` และปรับ `user_id` ให้ nullable:

```sql
alter table public.attempts alter column user_id drop not null;
alter table public.attempts add column if not exists student_first_name text;
alter table public.attempts add column if not exists student_last_name text;
alter table public.attempts add column if not exists student_id text;
```

## 3. สร้างบัญชีผู้ดูแล

1. เปิด `/login` แล้วสมัครบัญชีปกติ
2. ใน Supabase SQL Editor เปลี่ยนบทบาทบัญชีของคุณเป็น admin โดยแทนอีเมลจริง:

```sql
update public.profiles p
set role = 'admin'
from auth.users u
where p.id = u.id and u.email = 'your-email@example.com';
```

3. เข้าหน้า `/admin/import` เพื่อนำเข้า CSV

## 4. รูปแบบ CSV

ต้องเป็น UTF-8 CSV ที่มีหัวคอลัมน์ตรงตามนี้:

```csv
question,choice_a,choice_b,choice_c,choice_d,answer
ภาษา Python ใช้ทำอะไร,เขียนโปรแกรม,ตกแต่งภาพ,ตัดต่อเสียง,วาดรูป,A
HTML ใช้สำหรับอะไร,จัดการฐานข้อมูล,สร้างโครงสร้างเว็บ,เขียนระบบปฏิบัติการ,ตัดต่อวิดีโอ,B
```

`answer` ต้องเป็น A, B, C หรือ D; หนึ่งแถวคือหนึ่งข้อสอบ; ไฟล์ไม่เกิน 2 MB และ 500 ข้อต่อครั้ง โปรเจกต์นี้มีไฟล์ตัวอย่างที่แปลงจากชุดแบบฝึกหัดที่ผู้ใช้ส่งมาในแชตก่อนหน้าให้แล้ว

## 5. ตั้งค่า Google Sheets

1. สร้าง Google Spreadsheet ใหม่ และคัดลอก Spreadsheet ID จาก URL ส่วนที่อยู่ระหว่าง `/d/` กับ `/edit`.
2. เปิด [Google Apps Script](https://script.google.com/) สร้างโปรเจกต์ แล้วคัดลอกโค้ดจาก `google-apps-script/Code.gs` ไปวางใน `Code.gs`.
3. ใน Apps Script → Project Settings → Script Properties เพิ่ม:
   - `SPREADSHEET_ID` = ID ของ Google Spreadsheet
   - `WEBHOOK_SECRET` = สตริงสุ่มยาว ๆ ที่คุณสร้างเอง
4. Deploy → New deployment → เลือกประเภท **Web app**. ตั้ง **Execute as: Me** และสิทธิ์การเข้าถึงให้ Web App เรียกได้จากผู้ใช้งานเว็บภายนอก (โดยทั่วไปคือ Anyone หากนโยบายบัญชีอนุญาต). Deploy แล้วคัดลอก Web app URL ที่ลงท้ายด้วย `/exec`.
5. นำ URL ไปใส่ `GOOGLE_SHEETS_WEBHOOK_URL` และใช้ค่า secret เดียวกันใน `GOOGLE_SHEETS_WEBHOOK_SECRET` ของ `.env.local`.
6. รีสตาร์ต Next.js หลังแก้ `.env.local`. เมื่อมีการส่งข้อสอบ Apps Script จะสร้างแท็บ `ผลสอบ` และเพิ่มหนึ่งแถวต่อการสอบ โดยเก็บเวลา ชุดข้อสอบ ชื่อ นามสกุล รหัสนักศึกษา คะแนน คะแนนเต็ม เปอร์เซ็นต์ และรายละเอียดคำตอบ JSON.

อย่าเปิดเผย `WEBHOOK_SECRET` หรือ service-role key. หากนโยบาย Google Workspace ไม่อนุญาตให้เปิด Web App ให้ผู้ใช้นอกองค์กรเข้าถึง ต้องใช้วิธีเชื่อมต่อ Google Sheets API ด้วย OAuth/service account แทน

## 6. รันเว็บ

```bash
npm run dev
```

- `/login` — สมัคร/เข้าสู่ระบบบัญชีผู้ดูแล
- `/dashboard` — รายการข้อสอบและลิงก์ให้ผู้เข้าสอบ
- `/admin/import` — นำเข้า CSV (เฉพาะ admin)
- `/exam/[id]` — ลิงก์สาธารณะสำหรับผู้เข้าสอบ: กรอกชื่อ นามสกุล รหัสนักศึกษา ตอบครบทุกข้อ ส่งคำตอบ และรับคะแนน
- `/quiz/[id]` — เส้นทางเดิมสำหรับผู้ใช้ที่เข้าสู่ระบบ
- `POST /api/exam/submit` — ตรวจเฉลยฝั่งเซิร์ฟเวอร์ บันทึกคะแนน และส่งสรุปไป Sheets

## ข้อควรทราบ

- เฉลยไม่ถูกส่งไปยังเบราว์เซอร์ ผู้เข้าสอบเห็นเฉพาะคะแนนหลังส่ง
- การส่งไป Google Sheets เป็น integration เสริม หากยังไม่ตั้งค่า webhook ผลสอบจะยังบันทึกใน Supabase แต่ `sheetSaved` จะเป็น false
- MVP นี้ยังไม่ใช่ระบบสอบเดิมพันสูง: ยังไม่มีการจำกัดจำนวนครั้ง/ป้องกันการเข้าสอบซ้ำ, rate limiting, timer, transaction ครอบคลุมการบันทึกคะแนนและรายละเอียด, หรือการตรวจยืนยันตัวตนกับทะเบียนนักศึกษา. รหัสนักศึกษาที่กรอกเป็นเพียงข้อมูลที่ผู้ใช้ระบุ ไม่ได้ยืนยันว่าเป็นเจ้าของรหัสจริง
- ทดสอบใน Supabase จริงและตรวจสิทธิ์การเข้าถึงก่อนนำไปใช้สอบจริงหรือเก็บข้อมูลส่วนบุคคลจำนวนมาก
