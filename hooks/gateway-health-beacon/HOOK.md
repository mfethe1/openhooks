---
name: gateway-health-beacon
description: "Publishes periodic health beacons to NATS and memU so all gateways can discover each other and verify cross-system connectivity."
homepage: https://github.com/mfethe1/openhooks
metadata:
  { "openclaw": { "emoji": "💓", "events": ["gateway:startup", "message:sent"], "requires": {} } }
---

# Gateway Health Beacon

Enables multi-gateway discovery and health monitoring over NATS + memU.

## What It Does

- On `gateway:startup`: publishes a registration beacon to NATS (`openclaw.gateway.register`) and writes to memU
- Every 50 outbound messages: publishes a heartbeat with uptime, message count, and error stats
- Other gateways subscribe to `openclaw.gateway.>` to maintain a live registry

## NATS Subjects

```
openclaw.gateway.register    # initial boot announcement
openclaw.gateway.heartbeat   # periodic health check
openclaw.gateway.shutdown     # graceful shutdown notice
```

## memU Records

Written with category `eval` and tags `["gateway", "health"]` for cross-agent searchability.

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `NATS_URL` | `nats://127.0.0.1:4222` | NATS server URL |
| `NATS_BIN` | auto-detect | Path to `nats` CLI binary |
| `MEMU_ENDPOINT` | Railway production | memU API base URL |
| `MEMU_KEY` | (none) | memU auth key |
| `OPENCLAW_GATEWAY_ID` | hostname | Unique gateway identifier |
