# 🪝 OpenHooks

Custom [OpenClaw](https://github.com/openclaw/openclaw) hooks for quality, persistence, observability, and cross-agent coordination.

## Hooks

### OpenClaw Internal Hooks

| Hook | Emoji | Events | Purpose |
|------|-------|--------|---------|
| [memu-logger](hooks/memu-logger/) | 🧠 | `message:received`, `message:sent`, `command:new` | Persist conversations to memU for searchable cross-session memory |
| [nats-publisher](hooks/nats-publisher/) | 📡 | `message:*`, `command:*`, `gateway:startup`, `session:compact:after` | Real-time event bus via NATS for cross-agent coordination |
| [quality-gate](hooks/quality-gate/) | 🎯 | `message:received`, `message:sent` | Track response quality — latency, error patterns, apology loops |
| [session-metrics](hooks/session-metrics/) | 📊 | All lifecycle events | Operational dashboarding — volumes, lifecycle, compaction frequency |
| [compaction-guard](hooks/compaction-guard/) | 🛡️ | `session:compact:before/after` | Snapshot critical state before compaction to prevent context loss |
| [gateway-health-beacon](hooks/gateway-health-beacon/) | 💓 | `gateway:startup`, `message:sent` | Multi-gateway discovery and health monitoring over NATS + memU |
| [cross-gateway-relay](hooks/cross-gateway-relay/) | 🔀 | `message:sent`, `command:new`, `command:stop` | Cross-gateway task coordination signals for multi-host agent collaboration |

### Claude Code Hooks

| Hook | Emoji | Hook Type | Purpose |
|------|-------|-----------|---------|
| [claude-pre-tool-gate](hooks/claude-pre-tool-gate/) | 🛡️ | `PreToolUse` | Block destructive commands and writes to protected paths |
| [claude-post-tool-verify](hooks/claude-post-tool-verify/) | ✅ | `PostToolUse` | Auto-run lint/syntax checks after file modifications |
| [claude-anti-rationalization](hooks/claude-anti-rationalization/) | 🚫 | `Stop` | Detect premature stopping with incomplete work and force continuation |
| [claude-precompact-saver](hooks/claude-precompact-saver/) | 💾 | `Notification` | Save critical state checkpoint before context compression |

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

### Option 2: Install all hooks

```bash
# Clone this repo
git clone https://github.com/mfethe1/openhooks.git

# Copy all hooks
for hook in memu-logger nats-publisher quality-gate session-metrics compaction-guard gateway-health-beacon cross-gateway-relay; do
  cp -r openhooks/hooks/$hook ~/.openclaw/hooks/
done

# Enable all
for hook in memu-logger nats-publisher quality-gate session-metrics compaction-guard gateway-health-beacon cross-gateway-relay; do
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
        "compaction-guard": { "enabled": true },
        "gateway-health-beacon": { "enabled": true },
        "cross-gateway-relay": { "enabled": true }
      }
    }
  }
}
```

### Claude Code Installation

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "bash /path/to/openhooks/hooks/claude-pre-tool-gate/pre-tool-gate.sh" }]
    }],
    "PostToolUse": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "bash /path/to/openhooks/hooks/claude-post-tool-verify/post-tool-verify.sh" }]
    }],
    "Stop": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "bash /path/to/openhooks/hooks/claude-anti-rationalization/anti-rationalization-stop.sh" }]
    }],
    "Notification": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "bash /path/to/openhooks/hooks/claude-precompact-saver/precompact-context-saver.sh" }]
    }]
  }
}
```

## Prerequisites

| Hook | Requirements |
|------|-------------|
| memu-logger | memU running (or set `MEMU_ENDPOINT` + `MEMU_KEY`) |
| nats-publisher | NATS CLI on PATH (or set `NATS_BIN`) + NATS server |
| quality-gate | None (writes to `~/.openclaw/logs/`) |
| session-metrics | `workspace.dir` configured |
| compaction-guard | memU (optional, falls back to local file) |
| gateway-health-beacon | NATS CLI + memU (both optional, graceful degradation) |
| cross-gateway-relay | NATS CLI + NATS server |

## Design Principles

1. **Never block the message pipeline** — all external calls are fire-and-forget with timeouts
2. **Privacy by default** — NATS gets metadata only; content goes to memU (trusted, internal)
3. **Graceful degradation** — if memU or NATS is down, hooks silently continue
4. **Delta-only metrics** — checkpoint at intervals, not every single event
5. **Cross-platform** — all hooks work on Windows, Linux, and macOS
6. **Correct memU schema** — uses `/api/v1/memu/add` with required `user_id`, `session_id`, `category` enum, and `X-MemU-Key` auth

## NATS Subject Hierarchy

```
openclaw.message.received       # inbound messages (metadata only)
openclaw.message.sent           # outbound messages (metadata only)
openclaw.command.new            # /new command
openclaw.command.reset          # /reset command
openclaw.command.stop           # /stop command
openclaw.gateway.startup        # gateway boot
openclaw.gateway.register       # gateway fleet registration
openclaw.gateway.heartbeat      # periodic gateway health
openclaw.session.compacted      # context compaction events
openclaw.agent.task.completed   # agent finished a task
openclaw.agent.available        # agent ready for work
openclaw.agent.offline          # agent going offline
```

Subscribe to all: `nats sub "openclaw.>"`

## Output Files

- `~/.openclaw/logs/quality-metrics.jsonl` — quality anomaly tracking
- `<workspace>/metrics/YYYY-MM-DD-sessions.jsonl` — daily session metrics
- `<workspace>/snapshots/compaction-YYYY-MM-DD.jsonl` — compaction snapshots

## Architecture: Cross-Gateway Communication

```
┌─────────────────┐     NATS      ┌─────────────────┐
│  Gateway A       │◄────────────►│  Gateway B       │
│  (Windows)       │              │  (Mac/Linux)     │
│                  │              │                  │
│  Winnie (main)   │              │  Lenny, Rosie    │
│  Macklemore      │              │  Macklemore      │
│                  │              │                  │
│  health-beacon ──┤──► NATS ◄──├── health-beacon   │
│  cross-relay   ──┤──► NATS ◄──├── cross-relay     │
│  memu-logger   ──┤──► memU ◄──├── memu-logger     │
└─────────────────┘              └─────────────────┘
```

All gateways publish to the same NATS server and memU instance.
Agents discover each other via `openclaw.gateway.register` subjects.
Task handoffs flow through `openclaw.agent.task.completed` → `openclaw.agent.available`.

## License

MIT
