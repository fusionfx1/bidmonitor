# Taskmaster + LM Studio Setup (BidMonitor)

**Date**: 2026-06-28
**Context**: Configured for local development with RTX 3090, using local LLM via LM Studio for Taskmaster in Cursor/Codex environment.

## Overview
- Taskmaster (task-master-ai) is used for breaking down PRDs (e.g., bitmonitor-course-adaptation-plan.md) into tasks, expanding, and managing workflow.
- Integrated with LM Studio for local inference (no cloud costs, private).
- Obsidian vault at `project-memory/` for durable memory.
- MCP servers configured for both Cursor (.cursor/mcp.json) and Codex (.codex/config.toml).

## LM Studio Configuration
- Local OpenAI-compatible server running at `http://localhost:1234/v1`.
- Model loaded: `qwen3.6-35b-a3b-uncensored-hauhaucs-aggressive` (or switched to cloud `claude-opus-4-7-thinking-medium` for some roles).
- Quantization suitable for 24GB VRAM (Q4/Q5 recommended for 35B model).
- Start server in LM Studio before using.

## Taskmaster Config (`.taskmaster/config.json`)
- Providers set to `openai` for compatibility with LM Studio.
- Models:
  - main: claude-opus-4-7-thinking-medium (or local equivalent)
  - research: claude-opus-4-7-thinking-medium
  - fallback: claude-opus-4-7-thinking-medium
- ollamaBaseURL still present but overridden by OPENAI_BASE_URL for LM Studio.
- System prompt injected for strict adherence to project rules (safety, review_only mode, use project-memory, no direct mutations, etc.).

## MCP Configurations
### .cursor/mcp.json
```json
"task-master-ai": {
  "command": "npx",
  "args": ["-y", "task-master-ai"],
  "env": {
    "ANTHROPIC_API_KEY": "${env:ANTHROPIC_API_KEY}",
    "OPENAI_API_KEY": "lm-studio",
    "OPENAI_BASE_URL": "http://localhost:1234/v1",
    "XAI_API_KEY": "${env:XAI_API_KEY}",
    "PERPLEXITY_API_KEY": "${env:PERPLEXITY_API_KEY}"
  }
}
```

### .codex/config.toml
- task-master-ai section:
  - command: npx task-master-ai
  - cwd: H:/DEV/github_sandbox/bidmonitor
  - env with OPENAI_BASE_URL and keys (updated to support cloud/local).
- Main model set to `claude-opus-4-7-thinking-medium`.

## System Prompt (Injected in config)
The system prompt emphasizes:
- Strict adherence to AGENTS.md, harness/SAFETY_GATE.md, .repo-plugins policies.
- review_only mode by default.
- Use project memory (project-memory/, .taskmaster/, etc.).
- Atomic tasks with dependencies, test strategy.
- English for technical output.
- Channel "aggressive" energy into thoroughness but stay within safety boundaries.
- For PRD: follow exactly, structured JSON output.

Full prompt is embedded in .taskmaster/config.json under each model.

## Usage
1. Start LM Studio server with the model.
2. Set env vars if needed:
   ```powershell
   $env:OPENAI_API_KEY = "lm-studio"
   $env:OPENAI_BASE_URL = "http://localhost:1234/v1"
   ```
3. Run CLI: `task-master list`, `task-master next`, `task-master expand --id=1`, `task-master parse-prd ...`
4. In Cursor/Codex: Use task-master-ai MCP tools.
5. For cloud: Update config to use anthropic/openai providers with real keys (e.g., Claude Opus).

## Safety Notes
- Always respect review_only, no Google Ads mutate, no secrets in frontend.
- Use deterministic rules first.
- All changes must go through proposal/audit.

## Related
- PRD: bitmonitor-course-adaptation-plan.md parsed to tasks.
- Tasks created in .taskmaster/tasks/tasks.json (13 high-level tasks covering health, contracts, UI, safety).
- Obsidian MCP: obsidian-mcp-server@latest with key (ensure Obsidian Local REST API plugin running).

Next steps: Test with `task-master next`, expand tasks, or use in agent for PRD breakdown.
