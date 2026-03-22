---
name: session-metrics
description: "Track session lifecycle metrics — starts, resets, compactions, message volumes — for operational dashboarding"
metadata: { "openclaw": { "emoji": "📊", "events": ["command:new", "command:reset", "command:stop", "session:compact:after", "gateway:startup", "message:received", "message:sent"], "requires": { "config": ["workspace.dir"] } } }
---

# Session Metrics Hook

Maintains a rolling daily metrics file tracking:
- Messages received/sent per session per channel
- Session lifecycle events (new, reset, stop)
- Compaction frequency and context sizes
- Gateway uptime tracking

## Output

`<workspace>/metrics/YYYY-MM-DD-sessions.jsonl` — daily metrics

## Why

Operational visibility without external monitoring. Answers questions like:
- "How many messages did we handle today?"
- "Which sessions compact most frequently?" (might need tuning)
- "What's our uptime since last restart?"
