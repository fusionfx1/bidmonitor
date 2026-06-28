ได้ครับ นี่คือ **GOLD 2 — Longrun Stability / Ops Readiness Prompt** สำหรับส่งให้ Agent ทำต่อจาก Gold 1



\```md

\# GOLD 2 — Longrun Stability / Ops Readiness



\## Context



Gold 1 / Gate 6 ผ่านแล้ว:



\- Remote functions `bid-feed` และ `bid-feed-result` ACTIVE

\- ไม่ redeploy function

\- ไม่ `db push`

\- sync เฉพาะ `BID_FEED_TOKEN`

\- Remote smoke ผ่านครบ:

  \- scope isolation ผ่าน

  \- missing scope 400

  \- result logging แบบ dry-run ผ่าน

  \- anon insert ถูก RLS block

  \- cleanup test scope = 0/0



\## Goal



ทำ longrun validation หลัง Gate 6 เพื่อยืนยันว่า production-like flow เสถียรจริงเมื่อ Google Ads Script รันตามรอบ 1 ชั่วโมง และระบบ bid feed/result ทำงานแบบ scoped, read-safe, ไม่มี cross-account leak, ไม่มี mutation path, และมีหลักฐานพร้อม handoff ให้ Owner



\## Authority



คุณได้รับอนุญาตให้ทำเฉพาะงานต่อไปนี้:



1. Read-only inspection
2. Remote smoke แบบปลอดภัย
3. Insert/delete เฉพาะ test rows ที่ระบุ scope ชัดเจนและ cleanup ทันที
4. Query remote Supabase เพื่อเก็บ metrics/count/freshness
5. ตรวจ function list, REST behavior, RLS behavior
6. ตรวจ Google Sheet / Apps Script output แบบ read-only เท่านั้น
7. สรุปรายงานเป็น Gold 2 report



\## Hard Constraints



ห้ามทำสิ่งต่อไปนี้เด็ดขาด:



\- ห้าม `db push`

\- ห้ามสร้าง migration ใหม่

\- ห้าม deploy/redeploy function

\- ห้ามแก้ secrets ยกเว้น Owner สั่งชัดเจน

\- ห้ามใช้ service role ใน frontend

\- ห้าม Google Ads mutate/write/change bid/pause/enable

\- ห้าม Voluum apply/write

\- ห้าม `dryRun: false`

\- ห้าม `applyEnabled: true`

\- ห้ามแก้ production data นอกจาก test scope ที่สร้างเองและ cleanup เอง

\- ห้ามแก้ scope/account/customer/source_sheet_id ของข้อมูลจริง



\## Longrun Window



รันอย่างน้อย:



\- Minimum: 6 ชั่วโมง

\- Recommended: 12 ชั่วโมง

\- Ideal: 24 ชั่วโมง



ถ้าเวลาไม่พอ ให้ทำเป็น staged report:



\- T+0 baseline

\- T+1h check

\- T+3h check

\- T+6h decision

\- T+12h / T+24h optional extension



\## Scope IDs



ใช้ test scope แยกจาก production ชัดเจน:



\- account_id: `gold2-longrun-acct`

\- customer_id: `gold2-longrun-customer`

\- source_sheet_id: `gold2-longrun-sheet`

\- campaign/adgroup/name prefix: `GOLD2_SMOKE_`



ห้ามใช้ scope จริงของลูกค้าเป็น test write target



\## Gate 0 — Preflight



ทำก่อนเริ่มทุกอย่าง:



1. อ่าน repo status
2. ยืนยัน current branch
3. ยืนยันไม่มี dirty changes ที่เกี่ยวข้องกับงานนี้
4. อ่าน `goal/goal1.md`
5. อ่านไฟล์ function/shared ที่เกี่ยวข้อง:

   \- `supabase/functions/bid-feed/index.ts`

   \- `supabase/functions/bid-feed-result/index.ts`

   \- shared helpers ที่เกี่ยวข้อง

6. ยืนยัน remote project ref
7. ยืนยัน functions ACTIVE:

   \- `bid-feed`

   \- `bid-feed-result`



Stop ถ้า:

\- branch/repo ไม่ชัด

\- remote project ref ไม่ชัด

\- function ไม่ ACTIVE

\- เจอ pending destructive action



\## Gate 1 — Baseline Metrics



เก็บ baseline remote:



1. Count `bid_action_feed`
2. Count `bid_action_log`
3. Count by:

   \- `account_id`

   \- `customer_id`

   \- `source_sheet_id`

4. Latest timestamp:

   \- latest feed created/updated timestamp

   \- latest result/log timestamp

5. ตรวจว่า Gold 2 test scope เริ่มต้นเป็น 0



ต้องรายงาน:

\- total feed rows

\- total log rows

\- latest feed timestamp

\- latest log timestamp

\- gold2 test feed count

\- gold2 test log count



\## Gate 2 — Google Ads Script Hourly Sync Observation



เป้าหมายคือดูว่า Script ที่ตั้งรันทุก 1 ชั่วโมงส่งข้อมูล/อัปเดตข้อมูลจริงหรือไม่



ตรวจแบบ read-only:



1. Google Sheet มีข้อมูลใหม่หรือไม่
2. timestamp ล่าสุดของแต่ละ tab สำคัญ
3. row count เปลี่ยนไหมหลังผ่าน 1 รอบ sync
4. source_sheet_id ที่ระบบใช้ตรงกับ remote scope หรือไม่
5. ไม่มีข้อมูลจาก account อื่นปน scope



ถ้าไม่มีสิทธิ์ดู Apps Script execution log ให้ใช้หลักฐานจาก:

\- Sheet updated timestamp

\- row count delta

\- remote feed delta

\- dashboard/API freshness



Stop ถ้า:

\- ข้อมูลไม่ขยับเกิน 2 รอบ sync

\- scope หาย

\- account/customer/source_sheet_id ไม่สอดคล้องกัน

\- พบ cross-account rows



\## Gate 3 — Endpoint Longrun Smoke



รัน smoke ซ้ำแบบปลอดภัยทุก checkpoint:



Checkpoint:

\- T+0

\- T+1h

\- T+3h

\- T+6h

\- T+12h ถ้าทำต่อ

\- T+24h ถ้าทำต่อ



ตรวจทุกครั้ง:



\### bid-feed



1. valid token + valid scope ได้ `200`
2. response มีเฉพาะ scope ที่ขอ
3. missing scope ได้ `400`
4. wrong token ถูก deny
5. scope A ห้ามเห็น scope B
6. empty scope ต้องไม่ error แบบ 500



\### bid-feed-result



1. wrong token ถูก deny
2. missing token ถูก deny
3. mismatched scope ถูก deny
4. correct scoped dry-run payload เขียน log ได้
5. result log ต้องอยู่ใน scope เดียวกับ feed row เท่านั้น



\## Gate 4 — RLS / Security Regression



ยืนยันซ้ำ:



1. anon insert เข้า `bid_action_log` ต้องถูก block
2. anon insert เข้า table sensitive อื่นต้องไม่ผ่าน
3. read policy ต้องไม่เปิดข้อมูลเกินที่ function/API ตั้งใจ
4. frontend ไม่มี service role key
5. ไม่มี secret/token ถูก commit หรือ exposed



ค้นหา static scan:



\- `service_role`

\- `SUPABASE_SERVICE_ROLE`

\- `dryRun: false`

\- `applyEnabled: true`

\- Google Ads mutate operations

\- Voluum write/apply endpoints

\- hardcoded token/secrets



\## Gate 5 — Data Quality / Duplicate / Freshness



ตรวจ remote data หลังผ่านอย่างน้อย 1-3 รอบ sync:



1. ไม่มี duplicate ที่ผิดปกติใน feed
2. ไม่มี cross-account contamination
3. row timestamps สดตามรอบ script
4. feed items มี required fields ครบ
5. result logs ไม่โตผิดปกติจาก smoke
6. cleanup test rows แล้ว count กลับเป็น 0



ให้คำนวณ:



\- feed delta ต่อชั่วโมง

\- log delta ต่อชั่วโมง

\- duplicate suspect count

\- latest data age นาที

\- failed/denied smoke count



\## Gate 6 — Dashboard / Ops Readiness



ตรวจหน้า dashboard หรือ frontend ที่เกี่ยวข้อง:



1. มี indicator หรือข้อมูลให้รู้ว่า sync ล่าสุดเมื่อไหร่
2. แสดงจำนวน sync/run หรือ last updated ได้
3. ถ้ายังไม่มี indicator ให้บันทึกเป็น follow-up issue
4. dashboard ต้องไม่ expose secret
5. dashboard ต้องไม่ trigger write/apply โดยไม่ตั้งใจ



ถ้ายังไม่มี feature sync indicator:

\- ห้าม implement ถ้าไม่ได้รับอนุญาตในรอบนี้

\- ให้เสนอเป็น next task: `GOLD 3 — Sync Indicator + Ops Panel`



\## Gate 7 — Cleanup



ต้อง cleanup ทุก test data ที่สร้างเอง:



\- `gold2-longrun-acct`

\- `gold2-longrun-customer`

\- `gold2-longrun-sheet`

\- prefix `GOLD2_SMOKE_`



หลัง cleanup ต้องยืนยัน:



\- `bid_action_feed` test scope = 0

\- `bid_action_log` test scope = 0



ถ้า cleanup ไม่สำเร็จ ให้ถือว่า BLOCKED และรายงานทันที



\## Pass Criteria



Gold 2 ผ่านได้เมื่อ:



\- Longrun อย่างน้อย 6 ชั่วโมงผ่าน

\- function ทั้งสองยัง ACTIVE

\- endpoint smoke ผ่านทุก checkpoint

\- scope isolation ผ่านทุก checkpoint

\- RLS ยัง block anon insert

\- ไม่มี Google Ads mutation

\- ไม่มี Voluum apply

\- ไม่มี `dryRun: false`

\- ไม่มี `applyEnabled: true`

\- ไม่มี service role exposure

\- data freshness ไม่ stale เกิน 2 รอบ sync

\- cleanup test scope = 0/0



\## Block Criteria



หยุดทันทีถ้าเจอ:



\- cross-account data leak

\- endpoint 500 จาก valid request

\- anon insert ผ่าน

\- function inactive/missing

\- production data ถูกแก้โดยไม่ตั้งใจ

\- Google Ads mutate path ถูกเรียก

\- Voluum apply path ถูกเรียก

\- secret exposed

\- cleanup test rows ไม่สำเร็จ

\- remote schema ไม่ตรงกับ function expectation



\## Report Format



ส่งรายงานแบบนี้:



\# GOLD 2 Longrun Stability Report



\## Verdict



PASS / BLOCKED / PARTIAL



\## Longrun Window



\- Started:

\- Ended:

\- Duration:

\- Checkpoints completed:



\## Remote Status



\- Project ref:

\- bid-feed:

\- bid-feed-result:

\- db push:

\- deploy:

\- secrets changed:



\## Baseline



| Metric | Value |

| --- | --- |

| feed total | |

| log total | |

| latest feed timestamp | |

| latest log timestamp | |

| test feed count before | |

| test log count before | |



\## Checkpoint Results



| Time | bid-feed | bid-feed-result | RLS | Scope Isolation | Freshness | Notes |

| --- | --- | --- | --- | --- | --- | --- |

| T+0 | | | | | | |

| T+1h | | | | | | |

| T+3h | | | | | | |

| T+6h | | | | | | |



\## Google Ads Script Sync



| Check | Result |

| --- | --- |

| Sheet row count changed | |

| latest sync timestamp | |

| remote feed delta | |

| stale > 2 sync rounds | |

| scope consistent | |



\## Security / Safety



| Check | Result |

| --- | --- |

| No Google Ads mutation | |

| No Voluum apply | |

| No service role frontend exposure | |

| No dryRun false | |

| No applyEnabled true | |

| anon insert blocked | |

| wrong token denied | |



\## Cleanup



| Scope | feed count | log count |

| --- | --- | --- |

| gold2-longrun | 0 | 0 |



\## Findings



\- Finding 1

\- Finding 2



\## Follow-up



\- Required:

\- Recommended:

\- Optional:



\## Final Decision



Gold 2 is PASS/BLOCKED/PARTIAL because...

\```



สรุปตรง ๆ: **Gold 2 ไม่ใช่งาน deploy แล้ว** แต่เป็นงานพิสูจน์ว่า flow ที่ผ่าน Gate 6 แล้ว “อยู่รอดจริง” เมื่อรันยาวตามรอบ Google Ads Script 1 ชั่วโมง โดยยังคุมเรื่อง scope, RLS, freshness, cleanup และ no-mutation ให้ครบ.