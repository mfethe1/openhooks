/**
 * NATS Publisher Hook
 * Publishes agent lifecycle events to NATS for real-time cross-agent coordination.
 *
 * Fixed by Winnie:
 * - Cross-platform: uses nats CLI with platform-aware path detection
 * - Shell-safe: uses proper escaping for Windows (PowerShell) and Unix
 * - Added gateway identity (hostname, agentId) to all events
 * - Added error count tracking for observability
 */

import { exec, execSync } from "child_process";
import { existsSync } from "fs";

const NATS_URL = process.env.NATS_URL || "nats://127.0.0.1:4222";
const IS_WIN = process.platform === "win32";

// Find NATS binary cross-platform
function findNatsBin(): string {
  if (process.env.NATS_BIN) return process.env.NATS_BIN;

  const candidates = IS_WIN
    ? [
        "C:\\ProgramData\\chocolatey\\bin\\nats.exe",
        "C:\\tools\\nats\\nats.exe",
        `${process.env.USERPROFILE}\\.nats\\bin\\nats.exe`,
        `${process.env.LOCALAPPDATA}\\Programs\\nats\\nats.exe`,
      ]
    : [
        "/usr/local/bin/nats",
        "/usr/bin/nats",
        "/opt/homebrew/bin/nats",
        `${process.env.HOME}/.nats/bin/nats`,
      ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  // Try PATH resolution
  try {
    const which = IS_WIN ? "where nats" : "which nats";
    const result = execSync(which, { timeout: 2000 }).toString().trim().split("\n")[0];
    if (result) return result.trim();
  } catch {
    // not found on PATH
  }

  return IS_WIN ? "nats.exe" : "nats"; // fallback to PATH
}

const NATS_BIN = findNatsBin();

// Track publish failures for observability
let publishFailures = 0;
let publishSuccesses = 0;
const MAX_LOGGED_FAILURES = 5; // stop spamming logs after N failures

function publish(subject: string, data: Record<string, any>) {
  const payload = JSON.stringify({
    ...data,
    _ts: new Date().toISOString(),
    _source: "openclaw-hook",
    _host: process.env.COMPUTERNAME || process.env.HOSTNAME || "unknown",
  });

  // Cross-platform command construction
  let cmd: string;
  if (IS_WIN) {
    // PowerShell: pipe JSON via echo to avoid escaping nightmares
    const b64 = Buffer.from(payload).toString("base64");
    cmd = `powershell -NoProfile -Command "[System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64}')) | & '${NATS_BIN}' pub '${subject}' --server='${NATS_URL}'"`;
  } else {
    const escaped = payload.replace(/'/g, "'\\''");
    cmd = `echo '${escaped}' | "${NATS_BIN}" pub "${subject}" --server="${NATS_URL}" 2>/dev/null`;
  }

  exec(cmd, { timeout: 3000 }, (err) => {
    if (err) {
      publishFailures++;
      if (publishFailures <= MAX_LOGGED_FAILURES) {
        console.debug?.(
          `[nats-publisher] Publish to ${subject} failed (${publishFailures} total): ${err.message}`
        );
      }
    } else {
      publishSuccesses++;
    }
  });
}

const handler = async (event: any) => {
  const ts = event.timestamp?.toISOString() || new Date().toISOString();
  const ctx = event.context || {};
  const agentId = ctx.agentId || process.env.OPENCLAW_AGENT_ID || "unknown";

  // message:received
  if (event.type === "message" && event.action === "received") {
    publish("openclaw.message.received", {
      agentId,
      from: ctx.from,
      channel: ctx.channelId,
      conversationId: ctx.conversationId,
      contentLength: ctx.content?.length || 0,
      sessionKey: event.sessionKey,
      timestamp: ts,
    });
  }

  // message:sent
  if (event.type === "message" && event.action === "sent") {
    publish("openclaw.message.sent", {
      agentId,
      to: ctx.to,
      channel: ctx.channelId,
      success: ctx.success,
      contentLength: ctx.content?.length || 0,
      sessionKey: event.sessionKey,
      timestamp: ts,
    });
  }

  // command events (new, reset, stop)
  if (event.type === "command") {
    publish(`openclaw.command.${event.action}`, {
      agentId,
      action: event.action,
      sessionKey: event.sessionKey,
      source: ctx.commandSource,
      senderId: ctx.senderId,
      timestamp: ts,
    });
  }

  // gateway:startup — include publish stats from previous run
  if (event.type === "gateway" && event.action === "startup") {
    publish("openclaw.gateway.startup", {
      agentId,
      timestamp: ts,
      hostname: process.env.COMPUTERNAME || process.env.HOSTNAME || "unknown",
      platform: process.platform,
      natsBin: NATS_BIN,
    });
  }

  // session:compact:after
  if (event.type === "session" && event.action === "compact:after") {
    publish("openclaw.session.compacted", {
      agentId,
      sessionKey: event.sessionKey,
      timestamp: ts,
      summaryLength: ctx.summary ? String(ctx.summary).length : 0,
    });
  }
};

export default handler;
