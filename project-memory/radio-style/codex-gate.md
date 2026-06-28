# Codex Gate

Codex may implement only when:
- scope is clear
- memory has been read
- repo plugins have been read
- worktree is clean or isolated
- stop conditions are known

Codex must stop if:
- unrelated dirty files appear
- tests fail for related reasons
- deploy is required
- db push is required
- secret change is required
- scope expands beyond approved task