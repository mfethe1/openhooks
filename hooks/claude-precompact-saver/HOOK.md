---
name: claude-precompact-saver
description: "Notification hook for Claude Code — saves critical state checkpoint before context compression"
metadata: { "target": "claude-code", "hookType": "Notification", "emoji": "💾" }
---

# Claude Code Pre-Compact Context Saver

Detects context compression warnings and saves a checkpoint file with critical state before compression runs.

## What It Does

Monitors Notification events for context-related keywords (compress, truncate, limit, window, token). When detected, saves a timestamped checkpoint to `~/.claude/checkpoints/` so the agent can recover working state after context compression.

## Installation

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Notification": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "bash <path-to>/precompact-context-saver.sh"
      }]
    }]
  }
}
```

## Output

`~/.claude/checkpoints/precompact-<timestamp>.md` — recovery checkpoint files
