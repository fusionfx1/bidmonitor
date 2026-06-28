# AGENTS.md - BidMonitor

อัปเดตเมื่อ: 2026-06-27

## กฎที่ต้องอ่านก่อนเริ่มงาน

1. อ่าน `AGENTS.md` นี้ทุกครั้งก่อนเริ่มแก้โค้ดหรือคอนฟิก
2. อ่าน `agent-setup.md` สำหรับแนวทางการติดตั้งเครื่องมือ/skills ระดับโปรเจกต์
3. อ่าน `project-memory/README.md` และสำคัญกว่าคือ `.repo-plugins/*` โดยเฉพาะ `safety-policy.md`, `deploy-policy.md`, `test-policy.md`
4. ไม่แก้ไขคอนฟิกที่เกี่ยวข้องกับระบบหน่วยความจำหรือโฟลเดอร์เสี่ยง (เช่น `.projectmem`, `project-memory/.obsidian`) หากไม่มีคำสั่งชัดเจนจากผู้ใช้

## กฎการกันชนกันของคอนฟิก

- ห้ามรันสคริปต์ติดตั้ง plugin ใหม่โดยไม่ระบุว่าแก้ปัญหาอะไรโดยตรง
- ก่อนเพิ่มคอนฟิกใหม่ ต้องตรวจว่าไฟล์เดิมมีฟีเจอร์คล้ายกันอยู่แล้วใน:
  - `.repo-plugins/`
  - `project-memory/`
  - `.obsidian/` และไฟล์ plugin config ที่เกี่ยวข้อง
- ถ้าเจอความขัดแย้ง ให้สรุปและเสนอทางเลือกก่อนเปลี่ยนไฟล์

## คำสั่งพิเศษที่เปิดใช้

- `/graphify` → ต้องทริกเกอร์ `graphify` ก่อนดำเนินการใด ๆ ที่เกี่ยวกับ knowledge graph (ตามกฎผู้ใช้)
- `oracle` → ใช้เมื่อรีวิว/วิเคราะห์สถาปัตยกรรมหรือขอความเห็นจาก ChatGPT/GPT-5.5 เท่านั้น

## สถานะติดตั้ง

- `agent-setup.md` ได้อยู่ที่ root แล้ว
- Memory stack มีอยู่ใน `project-memory/`
- Repo policies อยู่ใน `.repo-plugins/`
- มี `.cursor/mcp.json` แล้ว (เพิ่มตามคำขอชัดเจน "ติดตั้ง mcp" สำหรับ headroom + task-master-ai + obsidian-mcp-server)

