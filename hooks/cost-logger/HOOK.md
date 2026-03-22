---
name: cost-logger
description: "Log model usage and estimated token costs per session to CSV for analysis"
homepage: https://docs.openclaw.ai/automation/hooks
metadata:
  {
    "openclaw":
      {
        "emoji": "💰",
        "events": ["message:sent"],
        "install": [{ "id": "custom", "kind": "custom", "label": "Custom hook" }],
      },
  }
---

# Cost Logger Hook

Logs outbound message metadata to `~/.openclaw/logs/cost-log.csv` for token/cost analysis.

## Output

CSV at `~/.openclaw/logs/cost-log.csv`:
```
timestamp,session_key,channel,to,content_length,agent,is_group,success
2026-03-21T20:00:00Z,agent:main:main,telegram,-1003259411852,1234,macklemore,false,true
```

## Notes

- Skips HEARTBEAT_OK messages to reduce noise
- CSV-safe: commas in recipient fields are replaced with semicolons
- Silent fail: never throws, so it never breaks message delivery
