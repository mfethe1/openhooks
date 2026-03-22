---
name: cross-gateway-relay
description: "Relays agent task completions and coordination signals across gateways via NATS subjects, enabling multi-host agent collaboration."
homepage: https://github.com/mfethe1/openhooks
metadata:
  { "openclaw": { "emoji": "🔀", "events": ["message:sent", "command:new", "command:stop"], "requires": {} } }
---

# Cross-Gateway Relay

Enables agents running on different OpenClaw gateways to coordinate work by publishing structured task signals to NATS.

## What It Does

- On agent response (`message:sent`): publishes task completion signals to `openclaw.agent.task.completed`
- On session lifecycle (`command:new`, `command:stop`): publishes availability signals
- Other gateways subscribe and can route follow-up work to available agents

## NATS Subjects

```
openclaw.agent.task.completed    # agent finished a task
openclaw.agent.available         # agent ready for work
openclaw.agent.busy              # agent is processing
```

## Use Cases

1. **Lenny (Mac) finishes QA** → publishes completion → **Macklemore (Linux) picks up deploy**
2. **Winnie (Windows) detects frontend issue** → publishes alert → **any available agent investigates**
3. **Session reset on one gateway** → other gateways know that agent is now free

## Configuration

Same env vars as `nats-publisher` (NATS_URL, NATS_BIN).
