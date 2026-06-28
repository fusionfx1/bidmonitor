# Harness — Google Ads Script Project Memory

Harness คือระบบกลางสำหรับ Google Ads Script + Google Sheet Bridge + Dashboard + Supabase Edge Functions

Harness นี้ใช้สำหรับ monitor และ review recommendations เท่านั้นในเฟสแรก

Primary mode:
- local-first
- account-scoped
- read-only
- review-only

Current rule:
ห้าม deploy, db push, หรือเปลี่ยน function secrets ถ้า owner ไม่สั่งชัดเจน
