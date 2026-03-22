---
name: nats-bridge
description: "Publish OpenClaw events to NATS JetStream for cross-agent coordination"
homepage: https://docs.openclaw.ai/automation/hooks
metadata:
  {
    "openclaw":
      {
        "emoji": "📡",
        "events": ["message:received", "message:sent", "command:new", "command:reset", "command:stop", "agent:bootstrap", "gateway:startup"],
        "install": [{ "id": "custom", "kind": "custom", "label": "Custom hook" }],
      },
  }
---

# NATS Bridge Hook

Publishes all OpenClaw agent events to NATS JetStream for cross-agent coordination and real-time event streaming.

## Subject Taxonomy

- `openclaw.messages.received` — inbound messages
- `openclaw.messages.sent` — outbound messages
- `openclaw.commands.{action}` — slash commands (new, reset, stop)
- `openclaw.agents.{name}.events` — agent-specific event stream
- `openclaw.coordination.bootstrap` — session start events
- `openclaw.coordination.status` — status updates

## Requirements

- NATS server running on localhost:4222 (already running with JetStream)
- nats npm package (auto-installed via package.json)

## Fallback

If NATS is unavailable, hook degrades silently. Never blocks agent processing.
