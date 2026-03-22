---
name: compaction-guard
description: "Guard against context loss during compaction — snapshot critical state to memU and file before compaction runs"
metadata: { "openclaw": { "emoji": "🛡️", "events": ["session:compact:before", "session:compact:after"], "requires": { "config": ["workspace.dir"] } } }
---

# Compaction Guard Hook

Protects against context loss during session compaction:
- **Before compaction**: Snapshots active task state, recent decisions, and in-flight work items
- **After compaction**: Verifies critical context survived and logs compaction metadata

## Why

Compaction is the #1 cause of context loss in long-running agent sessions. Without this guard, agents "forget" what they were working on mid-task. This hook ensures critical state is preserved in memU and a local snapshot file, making it recoverable even after aggressive compaction.

## Output

- memU namespace `compaction_snapshots` — searchable snapshots
- `<workspace>/snapshots/compaction-<date>.jsonl` — local backup
