---
name: claude-anti-rationalization
description: "Stop hook for Claude Code — detects premature stopping with incomplete work and forces continuation"
metadata: { "target": "claude-code", "hookType": "Stop", "emoji": "🚫" }
---

# Claude Code Anti-Rationalization Stop Hook

Catches when Claude Code tries to stop with incomplete work and rationalizes why it's "done."

## What It Does

Detects two classes of patterns in the final message:
1. **Rationalization patterns**: "I'll leave the rest to you", "feel free to", "beyond the scope"
2. **Incomplete work indicators**: TODO, FIXME, "still need to", "placeholder"

When both are present, it blocks the stop and forces continuation. When only rationalization is detected, it challenges the agent to either justify completion or keep working.

## Installation

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "bash <path-to>/anti-rationalization-stop.sh"
      }]
    }]
  }
}
```

## Why

Agents frequently stop short and defer remaining work to the user with polite language. This hook enforces completion discipline — finish what you started.
