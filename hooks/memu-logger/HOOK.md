---
name: memu-logger
description: "Log all message events (received/sent) to memU for persistent cross-session memory and searchable conversation history"
metadata: { "openclaw": { "emoji": "🧠", "events": ["message:received", "message:sent", "command:new"], "requires": { "config": ["workspace.dir"] } } }
---

# memU Logger Hook

Captures inbound and outbound messages and persists them to memU (the shared Postgres+pgvector memory system) so all agents have searchable, durable conversation history.

## What It Does

- **message:received**: Logs sender, content, channel, and timestamp to memU
- **message:sent**: Logs outbound content, recipient, channel, and success status
- **command:new**: Logs session reset events so agents know when context was cleared

## Why

Without this hook, conversation context is volatile — lost on compaction or session reset. memU persistence means any agent can search "what did Michael say about X last Tuesday" and get an answer.

## Configuration

Set `MEMU_ENDPOINT` env var (defaults to `http://localhost:8711`).
