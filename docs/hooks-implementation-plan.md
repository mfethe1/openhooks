# OpenClaw Hooks Implementation — Research & Plan

**Date:** 2026-03-21
**Owner:** Lenny (QA)
**Status:** IMPLEMENTED — 5 hooks created, pending enable + restart

---

## Research Summary

### Best Practices for Event-Driven Agent Hooks

1. **Fire-and-forget pattern**: Hooks must NEVER block the message processing pipeline. All external calls (memU, NATS, file I/O) should be async with timeouts and silent failure.

2. **Privacy by default**: Don't publish raw message content over NATS — publish metadata (lengths, channels, timestamps). Content goes only to memU (trusted, internal).

3. **Structured subject hierarchy**: NATS subjects should follow `openclaw.<domain>.<action>` pattern for easy subscription filtering.

4. **Delta-only metrics**: Don't log every single event — use checkpointing (every Nth message) to keep file sizes manageable while preserving trends.

5. **Compaction protection is critical**: The #1 reliability issue in long-running agent sessions is context loss during compaction. Pre-compaction snapshots to memU make recovery possible.

6. **Quality detection beats quality reporting**: Catching apology loops, error dumps, and repetitive content in real-time prevents degraded responses from reaching users.

### NATS Integration Pattern

- NATS CLI (`/usr/local/bin/nats`) is the most reliable approach since it avoids npm dependency issues inside the gateway's module resolution.
- Fire-and-forget publishing via `child_process.exec` with 3s timeout.
- Subject hierarchy enables targeted subscriptions:
  - Rosie → `openclaw.message.*` for analytics
  - Macklemore → `openclaw.gateway.*` for infra alerts
  - Lenny → `openclaw.quality.*` for QA monitoring

### memU Integration Pattern

- Direct HTTP POST to memU's REST API with 5s timeout.
- Namespace separation: `conversation_log`, `session_events`, `compaction_snapshots`
- Tags for faceted search: `["message", "inbound", "telegram"]`

---

## Hooks Created

### 1. 🧠 memu-logger
**Events:** `message:received`, `message:sent`, `command:new`
**Purpose:** Persistent cross-session memory — every conversation is searchable by any agent.
**Impact:** Eliminates "what did we discuss last week?" amnesia across session resets.

### 2. 📡 nats-publisher  
**Events:** `message:received`, `message:sent`, `command:*`, `gateway:startup`, `session:compact:after`
**Purpose:** Real-time event bus for cross-agent coordination and monitoring.
**Impact:** Agents can react to events immediately instead of polling files.

### 3. 🔍 quality-gate
**Events:** `message:received`, `message:sent`
**Purpose:** Track response quality (latency, length, error patterns, apology loops).
**Impact:** Catches quality degradation before humans notice. Logs to `~/.openclaw/logs/quality-metrics.jsonl`.

### 4. 📊 session-metrics
**Events:** `command:*`, `session:compact:after`, `gateway:startup`, `message:*`
**Purpose:** Operational dashboarding — message volumes, session lifecycle, compaction frequency.
**Impact:** Answers "how busy are we?" and "what's our uptime?" without external monitoring.

### 5. 🛡️ compaction-guard
**Events:** `session:compact:before`, `session:compact:after`
**Purpose:** Snapshot critical context before compaction to prevent amnesia.
**Impact:** Recoverable state after compaction — the biggest single reliability improvement.

---

## Activation Plan

```bash
# Enable internal hooks system + all 5 hooks
# via config.patch to hooks.internal.enabled + entries
```

After enable: restart gateway. Then verify:
1. Send a test message → check `quality-metrics.jsonl` and memU
2. Run `nats sub "openclaw.>"` → verify events flowing
3. Trigger `/new` → check compaction-guard snapshot created

---

## Future Hooks (Backlog)

- **rate-limiter**: Track API call rates and auto-throttle before hitting limits
- **error-circuit-breaker**: Auto-disable failing model fallback chains
- **cost-tracker**: Log token usage per session for billing visibility
- **anomaly-alerter**: NATS → Telegram alerts when quality-gate detects sustained degradation
