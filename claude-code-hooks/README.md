# Claude Code Hooks

Python hooks for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (formerly Claude CLI).

These complement the OpenClaw TypeScript hooks in `hooks/` — they run in the Claude Code hook system, not OpenClaw's.

## Hooks

| Hook | Type | Description |
|------|------|-------------|
| [pre-tool-security](pre-tool-security/) | PreToolUse | Block dangerous commands and protected path access |
| [git-checkpoint](git-checkpoint/) | PreToolUse (Bash) | Auto-checkpoint before destructive operations |
| [deps-planning](deps-planning/) | UserPromptSubmit | Inject DEPS planning for complex tasks |

## Requirements

- Python 3.10+
- Claude Code with hooks support
- Git (for git-checkpoint hook)

## Quick Install

```bash
# Copy all hooks
cp pre-tool-security/hook.py ~/.claude/hooks/optimized_pre_tool_hook.py
cp git-checkpoint/hook.py ~/.claude/hooks/git_checkpoint_hook.py
cp deps-planning/hook.py ~/.claude/hooks/deps_planning_hook.py
```

Then configure in `.claude/settings.json` — see each hook's README for the specific config block.

## Design Principles

1. **Fast-path first** — skip expensive checks for low-risk tools
2. **Hard-block the unrecoverable** — `rm -rf /`, force-push to main, fork bombs
3. **Checkpoint the risky** — git stash before destructive ops
4. **Nudge, don't block** — DEPS planning is advisory, not a gate
5. **Cross-platform** — Windows, Linux, macOS (handles encoding, path separators)
