# 🪝 OpenHooks

Custom [OpenClaw](https://github.com/openclaw/openclaw) hooks for quality, persistence, observability, and cross-agent coordination.

## Hooks

| Hook | Emoji | Events | Purpose |
|------|-------|--------|---------|
| [memu-logger](hooks/memu-logger/) | 🧠 | `message:received`, `message:sent`, `command:new` | Persist conversations to memU for searchable cross-session memory |
| [nats-publisher](hooks/nats-publisher/) | 📡 | `message:*`, `command:*`, `gateway:startup`, `session:compact:after` | Real-time event bus via NATS for cross-agent coordination |
| [quality-gate](hooks/quality-gate/) | 🔍 | `message:received`, `message:sent` | Track response quality — latency, error patterns, apology loops |
| [session-metrics](hooks/session-metrics/) | 📊 | All lifecycle events | Operational dashboarding — volumes, lifecycle, compaction frequency |
| [compaction-guard](hooks/compaction-guard/) | 🛡️ | `session:compact:before/after` | Snapshot critical state before compaction to prevent context loss |

## Installation

### Option 1: Copy individual hooks

```bash
# Copy any hook to your managed hooks directory
cp -r hooks/memu-logger ~/.openclaw/hooks/

# Enable it
openclaw hooks enable memu-logger

# Restart gateway
openclaw gateway restart
```

### Option 2: Link the entire repo

```bash
# Clone this repo
git clone https://github.com/mfethe1/openhooks.git

# Link each hook you want
for hook in memu-logger nats-publisher quality-gate session-metrics compaction-guard; do
  cp -r openhooks/hooks/$hook ~/.openclaw/hooks/
done

# Enable all
for hook in memu-logger nats-publisher quality-gate session-metrics compaction-guard; do
  openclaw hooks enable $hook
done

# Restart
openclaw gateway restart
```

### Option 3: Manual config

Add to your `~/.openclaw/openclaw.json`:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "memu-logger": { "enabled": true },
        "nats-publisher": { "enabled": true },
        "quality-gate": { "enabled": true },
        "session-metrics": { "enabled": true },
        "compaction-guard": { "enabled": true }
      }
    }
  }
}
```

## Prerequisites

| Hook | Requirements |
|------|-------------|
| memu-logger | memU running at `http://localhost:8711` (or set `MEMU_ENDPOINT`) |
| nats-publisher | NATS CLI at `/usr/local/bin/nats` (or set `NATS_BIN`) + NATS server |
| quality-gate | None (writes to `~/.openclaw/logs/`) |
| session-metrics | `workspace.dir` configured |
| compaction-guard | memU (optional, falls back to local file) |

## Design Principles

1. **Never block the message pipeline** — all external calls are fire-and-forget with timeouts
2. **Privacy by default** — NATS gets metadata only; content goes to memU (trusted, internal)
3. **Graceful degradation** — if memU or NATS is down, hooks silently continue
4. **Delta-only metrics** — checkpoint at intervals, not every single event

## NATS Subject Hierarchy

```
openclaw.message.received    # inbound messages (metadata only)
openclaw.message.sent        # outbound messages (metadata only)
openclaw.command.new         # /new command
openclaw.command.reset       # /reset command
openclaw.command.stop        # /stop command
openclaw.gateway.startup     # gateway boot
openclaw.session.compacted   # context compaction events
```

Subscribe to all: `nats sub "openclaw.>"`

## Output Files

- `~/.openclaw/logs/quality-metrics.jsonl` — quality anomaly tracking
- `<workspace>/metrics/YYYY-MM-DD-sessions.jsonl` — daily session metrics
- `<workspace>/snapshots/compaction-YYYY-MM-DD.jsonl` — compaction snapshots

## License

MIT
