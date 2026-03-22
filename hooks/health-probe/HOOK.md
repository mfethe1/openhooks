---
name: health-probe
description: "Probe key services (memU, NATS) at gateway startup and log results"
homepage: https://docs.openclaw.ai/automation/hooks
metadata:
  {
    "openclaw":
      {
        "emoji": "🏥",
        "events": ["gateway:startup"],
        "install": [{ "id": "custom", "kind": "custom", "label": "Custom hook" }],
      },
  }
---

# Health Probe Hook

Pings memU, NATS monitoring, and key infra at gateway startup.
Writes results to `~/.openclaw/logs/health-probe.json` for diagnostics.

## What It Checks

| Service | URL | Expected |
|---------|-----|----------|
| memU (local) | http://localhost:8000/health | HTTP 200 |
| NATS monitor | http://localhost:8222/healthz | HTTP 200 |

## Output

`~/.openclaw/logs/health-probe.json` — last startup check results.
Injects a warning message if any service is unreachable at startup.
