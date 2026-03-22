---
name: claude-pre-tool-gate
description: "PreToolUse security gate for Claude Code — blocks destructive shell commands and writes to protected paths"
metadata: { "target": "claude-code", "hookType": "PreToolUse", "emoji": "🛡️" }
---

# Claude Code Pre-Tool Gate

Security gate that runs before every tool use in Claude Code sessions.

## What It Does

- **Hard blocks** destructive commands: `rm -rf /`, `mkfs`, fork bombs, etc.
- **Auto-checkpoints** before potentially dangerous ops: `rm -rf`, `DROP TABLE`, `git push --force`
- **Blocks writes** to protected paths: `/etc/`, `/usr/bin/`, `~/.ssh/authorized_keys`

## Installation

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "bash <path-to>/pre-tool-gate.sh"
      }]
    }]
  }
}
```

## Exit Codes

- `0` — allow the tool call
- `2` — block with message to stderr
