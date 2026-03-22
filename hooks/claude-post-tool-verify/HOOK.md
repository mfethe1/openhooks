---
name: claude-post-tool-verify
description: "PostToolUse verification hook for Claude Code — runs linting and syntax checks after file modifications"
metadata: { "target": "claude-code", "hookType": "PostToolUse", "emoji": "✅" }
---

# Claude Code Post-Tool Verify

Runs automatic syntax/lint checks after Claude Code writes or edits files.

## What It Does

- **TypeScript/TSX**: runs `npx tsc --noEmit` on modified files
- **Python**: runs `py_compile` syntax check
- **JSON**: validates JSON structure
- **Shell**: runs `shellcheck` or `bash -n` syntax validation

## Installation

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "bash <path-to>/post-tool-verify.sh"
      }]
    }]
  }
}
```

Only runs on successful tool operations (exit code 0).
