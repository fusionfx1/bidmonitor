# Agent Tools & Skills Setup (แบบพกพา สำหรับโปรเจกต์ใหม่)

เอกสารนี้เป็นคู่มือแบบทั่วไป (project-agnostic) สำหรับติดตั้ง tooling, skills และ memory system เดียวกับที่ใช้ในโปรเจกต์ต่าง ๆ

อัพเดทจาก `final-install-list.md` + รูปแบบที่พิสูจน์แล้ว (Obsidian memory vault + MCP + knowledge graph + Taskmaster planning)

**ใช้ได้เลยกับโปรเจกต์ใหม่** — ไม่มีส่วนเฉพาะของโปรเจกต์ใด ๆ

---

## 1. Repo / Tool หลักที่ติดตั้ง

รวม repos/tools หลักที่ใช้เป็นฐาน (อัพเดทจาก final-install-list.md + Obsidian integrations)

| # | Repo / Tool | ประเภท | วิธีติดตั้ง (ตัวอย่างบน Windows + PowerShell) |
|---|-------------|--------|---------------------------------------------|
| 1 | `JuliusBrussee/caveman` | Skill pack (ลด output token) | `irm https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.ps1 \| iex` |
| 2 | `chopratejas/headroom` | MCP server (บีบ input token) | `pip install "headroom-ai[mcp]"` แล้ว `headroom mcp install` |
| 3 | `Egonex-AI/Understand-Anything` | Codebase knowledge graph + Cursor plugin + dashboard | `iwr -useb https://raw.githubusercontent.com/Egonex-AI/Understand-Anything/main/install.ps1 \| iex` → `codex` แล้ว `pnpm install` ใน `%USERPROFILE%\.understand-anything\repo` |
| 4 | `cyanheads/obsidian-mcp-server` | MCP server สำหรับ Obsidian vault (อ่าน/เขียน/search notes) | npx/bunx obsidian-mcp-server@latest + ต้องติดตั้ง Obsidian "Local REST API" plugin และใส่ OBSIDIAN_API_KEY |
| 5 | `eugeniughelbur/obsidian-second-brain` | AI command layer สำหรับ Obsidian (45+ commands + research) | Clone repo → รัน `install.sh` (link ไป ~/.claude/skills/obsidian-second-brain และ commands) |
| 6 | `eyaltoledano/claude-task-master` (package: task-master-ai) | Task planning & management สำหรับ AI (PRD → tasks, dependencies, next-task, research) | `npx -y task-master-ai` (MCP แนะนำ) หรือ `npm install -g task-master-ai` + เพิ่มใน `.cursor/mcp.json` |

**หมายเหตุ Obsidian:**
- obsidian-git และ Smart Connections เป็น Community Plugins ติดตั้งภายใน Obsidian (ไม่ใช่ npm/pip)
- ต้องเปิด vault `project-memory/` ก่อน แล้วค่อยติดตั้ง plugin เหล่านั้นใน Obsidian UI
- รายละเอียดการตั้งค่า + MCP config ดูในส่วน 3 ด้านล่าง

**หมายเหตุ Taskmaster:**
- ใช้เป็น MCP server หลัก (แนะนำ) หรือ CLI
- ต้องมี API key อย่างน้อย 1 ตัว (Anthropic / OpenAI / Perplexity / xAI ฯลฯ) หรือใช้ Claude Code
- เริ่มต้นด้วย `task-master init` หรือพิมพ์ใน chat ว่า "Initialize taskmaster-ai in my project"
- ทำงานคู่กับ PRD ได้ดี (parse-prd → generate tasks + dependencies)

**คำสั่งที่ใช้บ่อย (พิมพ์ใน chat หรือใช้ CLI):**
- Initialize taskmaster in my project
- Parse my PRD at .taskmaster/docs/prd.txt
- What's the next task I should work on?
- Help me implement task 3
- Research the latest best practices for ...
- Show tasks 1,3,5
- task-master list / task-master next (CLI)

**ตัวอย่างเพิ่ม MCP (`.cursor/mcp.json`):**

```json
{
  "mcpServers": {
    "task-master-ai": {
      "command": "npx",
      "args": ["-y", "task-master-ai"],
      "env": {
        "ANTHROPIC_API_KEY": "YOUR_KEY",
        "PERPLEXITY_API_KEY": "YOUR_KEY",
        "XAI_API_KEY": "YOUR_KEY"
        // เพิ่ม key ตามที่ใช้
      }
    }
  }
}
```

### หลังติดตั้ง

- Restart Cursor / IDE หลังติดตั้ง
- ถ้า skill ไม่ขึ้น → Settings → Plugins → เพิ่ม `https://github.com/Egonex-AI/Understand-Anything`
- Paths สำคัญ:
  - Repo: `%USERPROFILE%\.understand-anything\repo`
  - Skills: `%USERPROFILE%\.agents\skills\understand*`

#### Obsidian Community Plugins (ติดตั้งใน Obsidian app)
- **obsidian-git** → สำหรับ git sync อัตโนมัติกับ repo
- **Smart Connections** (และ visualizer) → semantic search ใน vault

รายละเอียดการตั้งค่าเต็มอยู่ในส่วน 3 ด้านล่าง

#### Obsidian MCP / Second Brain
- obsidian-mcp-server: เพิ่มใน `.cursor/mcp.json` (หรือ global) ตามตัวอย่างในส่วน 3
- obsidian-second-brain: รัน `install.sh` หลัง clone

---
  - Skills: `%USERPROFILE%\.agents\skills\understand*`
  - Plugin: `%USERPROFILE%\.understand-anything-plugin`

**คำสั่งที่ใช้บ่อยในโปรเจกต์ (พิมพ์ใน chat):**

```
/understand
/understand-dashboard
/understand-chat <คำถาม>
/understand-diff
/understand-onboard
/understand-explain <path>
/understand-domain
```

หลังจากรัน `/understand` ครั้งแรก สามารถ commit `.understand-anything/knowledge-graph.json` ได้ (optional)

**ตั้ง auto-update ครั้งเดียว (แนะนำ):**

```powershell
.\scripts\setup-understand-auto.ps1
```

(หรือคัดลอก logic ไปใช้ในโปรเจกต์ใหม่)

---

## 2. Skills ที่เก็บไว้ (General)

ส่วนใหญ่มาจาก mattpocock/skills collection และ skill อื่นที่ใช้บ่อย

### Skills ที่แนะนำ

| Skill | หมวด | ใช้ทำอะไร |
|-------|------|----------|
| `diagnose` | engineering | debug แบบมีระเบียบวิธี |
| `grill-with-docs` | engineering | stress-test แผนเทียบกับ docs/ADR |
| `improve-codebase-architecture` | engineering | หาจุด refactor/ปรับ architecture |
| `prototype` | engineering | สร้าง prototype ทดลอง |
| `review` | engineering | review โค้ดสองแกน (standards + spec) |
| `tdd` | engineering | red-green-refactor |
| `to-issues` | engineering | แตกแผนเป็น issues |
| `to-prd` | engineering | แปลงบริบทเป็น PRD |
| `triage` | engineering | จัดการ issue workflow |
| `zoom-out` | engineering | ดูภาพรวมโค้ด |
| `grill-me` | productivity | สัมภาษณ์เค้นแผนจนเคลียร์ |
| `handoff` | productivity | สรุป conversation ส่งต่อ agent |
| `setup-pre-commit` | misc | ตั้ง Husky + lint-staged |
| `write-a-skill` | productivity | สร้าง skill ใหม่ |
| `caveman` | productivity | Ultra-compressed (มี sub-commands) |

**หมายเหตุ caveman:** ใช้เวอร์ชัน JuliusBrussee (แทนตัวเก่า) มีคำสั่ง `/caveman`, `/caveman-commit`, `/caveman-review`, `/caveman-stats`, `/caveman-compress`

### วิธีติดตั้ง Skills

- ใช้ Cursor / Claude Code skill marketplace
- หรือ clone/copy ไปไว้ที่ `.agents/skills/` (project-local) และ `~/.claude/skills/` (global)

ตัวอย่างโครงสร้างในโปรเจกต์ใหม่:

```
.agents/skills/
  caveman/
  diagnose/
  grill-me/
  handoff/
  review/
  tdd/
  to-issues/
  ...
```

---

## 3. Project Memory ด้วย Obsidian (ส่วนที่ 4-5 จากตารางด้านบน)

รายละเอียดการติดตั้งและใช้งาน obsidian-mcp-server กับ obsidian-second-brain รวมถึง community plugins (obsidian-git, Smart Connections)

ใช้ Obsidian vault เป็น durable memory สำหรับ agent + มนุษย์ (git-synced)

### โครงสร้างที่แนะนำ (`project-memory/`)

```
project-memory/
  00_Project_Overview.md
  01_Current_Architecture.md
  02_Operating_Policy.md
  03_Forbidden_Assumptions.md
  04_Agent_Load_Order.md
  Decisions/
  Incidents/
  Runbooks/
  Latest_Status.md
  decisions.md
  architecture.md
  incidents.md
  agent-rules.md
  ...
```

ที่ root โปรเจกต์ก็ควรมี:
- `AGENTS.md`
- `LESSONS_LEARNED.md`

### ขั้นตอนติดตั้ง (ทั่วไป)

1. สร้างโฟลเดอร์ `project-memory/`
2. เปิดเป็น vault ใน Obsidian
3. เปิด Community plugins

#### A. obsidian-git (commit & sync อัตโนมัติ)

- Plugin: **obsidian-git**
- ติดตั้งและเปิดใช้งาน
- Settings → Obsidian Git:
  - **Custom base path:** `..` (ชี้ไปที่ root ของ git repo)
  - Custom Git directory path: ว่าง
  - Git executable path (Windows): `C:\Program Files\Git\cmd\git.exe`
- แนะนำตั้ง auto:
  - Auto commit: 10 นาที
  - Auto pull: 10 นาที
  - Auto push: 20 นาที
  - Pull on startup: on
- Restart Obsidian แล้วทดสอบ `Obsidian Git: Commit-and-sync`

#### B. Smart Connections (semantic search)

- Plugin: **Smart Connections** (https://github.com/brianpetro/obsidian-smart-connections)
- ติดตั้ง + เปิดใช้ + Restart
- รอ embedding/index เสร็จ
- ใช้ Connections view หรือ Lookup view
- `.smart-env/` หรือ cache ไม่ต้อง commit

#### C. obsidian-mcp-server (ให้ agent อ่าน/เขียน vault ได้)

**ต้องมีก่อน:**
- ติดตั้ง community plugin **Obsidian Local REST API** (coddingtonbear) v4+
- เปิด non-encrypted HTTP server และ generate API key

**เพิ่มใน MCP config** (เช่น `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "obsidian-mcp-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "obsidian-mcp-server@latest"],
      "env": {
        "OBSIDIAN_API_KEY": "your-key-here"
      }
    }
  }
}
```

หรือใช้ `bunx obsidian-mcp-server@latest`

เครื่องมือสำคัญ: get_note, search_notes, append_to_note, patch_note, manage_tags ฯลฯ

#### D. obsidian-second-brain (ชุดคำสั่ง AI สำหรับ Obsidian)

- Clone หรือ copy โฟลเดอร์
- รัน `install.sh` (จะ link commands ไป `~/.claude/commands/` และ skill ไป `~/.claude/skills/`)
- สำหรับ research commands ให้ตั้ง API keys ใน `~/.config/obsidian-second-brain/.env`

**สร้าง vault ใหม่จากศูนย์ (แนะนำ):**

```bash
python scripts/bootstrap_vault.py --path ./project-memory --name "Your Name" --preset default
```

---

## 4. Checklist สำหรับโปรเจกต์ใหม่

- [ ] ติดตั้ง core tools (caveman + headroom + Understand-Anything + obsidian-mcp-server + obsidian-second-brain + task-master-ai)
- [ ] ติดตั้ง Obsidian Community Plugins: obsidian-git + Smart Connections (ใน Obsidian app)
- [ ] เพิ่ม Taskmaster MCP (หรือติดตั้ง global) + ตั้ง API keys
- [ ] Restart IDE
- [ ] สร้าง `project-memory/` + เปิดใน Obsidian
- [ ] ติดตั้ง obsidian-git + Smart Connections + ตั้งค่า
- [ ] (แนะนำ) ติดตั้ง Local REST API + เพิ่ม obsidian-mcp-server ใน config
- [ ] ติดตั้ง obsidian-second-brain
- [ ] รัน `/understand` ใน root โปรเจกต์
- [ ] ตั้ง understand auto hooks
- [ ] วาง skills ทั่วไปใน `.agents/skills/`
- [ ] สร้าง `AGENTS.md` + ไฟล์ memory พื้นฐาน

---

## 5. หมายเหตุ

- ให้ถือ `final-install-list.md` (หรือไฟล์นี้) เป็นแหล่งข้อมูลหลักในแต่ละโปรเจกต์
- Skills บางตัวเคยถูกลบเพราะไม่จำเป็น (writing tools, scaffolding บางตัว ฯลฯ) — นำกลับมาเฉพาะที่ใช้จริง
- ปกป้อง `project-memory/.obsidian/plugins/**` ด้วย git safety
- headroom + caveman ช่วยเรื่อง token efficiency ใช้ได้ทุกที่

---

**วิธีใช้:** คัดลอกไฟล์นี้ไปยังโปรเจกต์ใหม่เป็น `agent-setup.md` หรือรวมเข้ากับ `final-install-list.md` ของโปรเจกต์นั้น

อัพเดทเวอร์ชันและคำสั่งตาม upstream เมื่อมีเปลี่ยนแปลง