---
name: quality-gate
description: "Track response quality metrics — latency, length, error rates — and log anomalies for QA review"
metadata: { "openclaw": { "emoji": "🔍", "events": ["message:received", "message:sent"], "requires": { "config": ["workspace.dir"] } } }
---

# Quality Gate Hook

Tracks response quality metrics across all agent interactions:
- **Response latency**: time between received → sent
- **Response length**: detect suspiciously short or excessively long responses
- **Error rate**: track failed sends
- **Content quality signals**: detect apology patterns, empty responses, error dumps

Writes metrics to a rolling JSONL file for dashboarding and to NATS for real-time alerts.

## Why

Without quality tracking, degraded responses go unnoticed until a human complains. This hook catches quality drift automatically — short responses might mean the model is struggling, long latency might mean fallback chains are firing, apology patterns might mean the agent is stuck in a failure loop.

## Output

`~/.openclaw/logs/quality-metrics.jsonl` — rolling metrics log
NATS subject `openclaw.quality.alert` — real-time anomaly alerts
