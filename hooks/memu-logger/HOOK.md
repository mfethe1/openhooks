---
name: memu-logger
description: "Log all agent messages and session events to memU shared memory"
homepage: https://docs.openclaw.ai/automation/hooks#memu-logger
metadata:
  {
    "openclaw":
      {
        "emoji": "🧠",
        "events": ["message:received", "message:sent", "command:new", "command:reset", "agent:bootstrap"],
        "requires": { "config": ["workspace.dir"] },
        "install": [{ "id": "custom", "kind": "custom", "label": "Custom hook" }],
      },
  }
---

# memU Logger Hook

Logs all agent messages and session lifecycle events to the memU shared memory system.

## What It Does

- **message:received** → stores inbound messages as `user_action` memories with sender/channel metadata
- **message:sent** → stores outbound messages as `observation` memories with success/failure metadata
- **command:new / command:reset** → stores session boundary events as `plan` memories (memory anchors)
- **agent:bootstrap** → stores session start with loaded workspace files as `fact` memories

## Configuration

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "memu-logger": {
          "enabled": true,
          "env": {
            "MEMU_BASE_URL": "http://localhost:8000",
            "MEMU_AGENT_ID": "macklemore"
          }
        }
      }
    }
  }
}
```

## Error Handling

All memU calls are fire-and-forget with 5s timeout. Hook failures never block agent processing.
