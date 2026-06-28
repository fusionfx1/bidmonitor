# Safety Rules

Hard stop:
- ห้าม Google Ads write/mutate
- ห้าม pause campaign/ad group/keyword
- ห้ามเปลี่ยน bid จริง
- ห้าม deploy โดยไม่ได้รับอนุมัติ
- ห้าม db push โดยไม่ได้รับอนุมัติ
- ห้ามเปลี่ยน Supabase function secrets โดยไม่ได้รับอนุมัติ
- ห้าม expose Voluum secrets ใน frontend
- Voluum API ต้องผ่าน Edge Functions เท่านั้น

Default action mode:
- review_only
