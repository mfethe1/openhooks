---
name: edrive-watcher
description: "Check Edrive mount status at bootstrap and log degraded mode to workspace"
homepage: https://docs.openclaw.ai/automation/hooks
metadata:
  {
    "openclaw":
      {
        "emoji": "💾",
        "events": ["agent:bootstrap"],
        "requires": { "config": ["workspace.dir"] },
        "install": [{ "id": "custom", "kind": "custom", "label": "Custom hook" }],
      },
  }
---

# Edrive Mount Watcher Hook

Checks Edrive mount state at every agent bootstrap and writes a status flag file.
Prevents silent failures when /Volumes/Edrive is unavailable.

## What It Does

1. Checks if /Volumes/Edrive exists and is accessible
2. Writes `.edrive-status.json` to workspace with mount state, timestamp, and active path
3. Sends a warning message if Edrive is unavailable (degraded mode)
4. Logs mount transitions (online→offline, offline→online) for reliability tracking
