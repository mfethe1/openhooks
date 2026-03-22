---
name: nats-publisher
description: "Publish agent lifecycle events to NATS for real-time cross-agent coordination and observability"
metadata: { "openclaw": { "emoji": "📡", "events": ["message:received", "message:sent", "command:new", "command:reset", "command:stop", "gateway:startup", "session:compact:after"], "requires": { "config": ["workspace.dir"] } } }
---

# NATS Publisher Hook

Publishes structured events to NATS subjects so all agents and monitoring systems get real-time visibility into gateway activity.

## Subject Hierarchy

- `openclaw.message.received` — inbound messages
- `openclaw.message.sent` — outbound messages  
- `openclaw.command.<action>` — command events (new, reset, stop)
- `openclaw.gateway.startup` — gateway boot
- `openclaw.session.compacted` — context compaction events
- `openclaw.health.heartbeat` — periodic health pings

## Why

NATS gives us temporal decoupling between agents. Rosie can subscribe to `openclaw.message.received` and build analytics. Macklemore can watch `openclaw.gateway.startup` for infra alerts. All without polling or shared files.

## Configuration

Connects to `nats://127.0.0.1:4222` by default. Set `NATS_URL` env to override.
