# Pre-Tool Security Hook (Claude Code)

**Type:** PreToolUse  
**Runtime:** Python 3.10+  
**Platform:** Windows, Linux, macOS

## What It Does

Consolidated security gate that runs before every tool use in Claude Code. Checks for:

- **Protected paths** — blocks access to `.ssh`, `.gnupg`, `.aws/credentials`, `.env`, etc.
- **Dangerous commands** — blocks `rm -rf /`, fork bombs, `mkfs`, etc.
- **Rate limiting** — optional integration with rate_limit_guard module
- **Fast-path optimization** — skips expensive checks for read-only/low-risk tools

## Installation

```bash
# Copy to Claude Code hooks directory
cp hook.py ~/.claude/hooks/optimized_pre_tool_hook.py
```

Then add to your `.claude/settings.json`:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": ["python3 ~/.claude/hooks/optimized_pre_tool_hook.py"]
      }
    ]
  }
}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 + `{}` | Allow |
| 0 + deny JSON | Block with reason |
| 2 + stderr | Block (simple) |

## Configuration

No environment variables required. Behavior is controlled by the built-in pattern lists in the hook source.
