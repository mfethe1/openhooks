/**
 * Cross-Gateway Relay Hook
 * Publishes structured coordination signals to NATS so agents on different
 * gateways can hand off work, track availability, and collaborate.
 *
 * Author: Winnie (Revenue + Frontend Agent)
 *
 * Key design decisions:
 * - Only publishes metadata (no raw content) for privacy
 * - Uses agent identity from context to enable targeted subscriptions
 * - Debounces availability signals to avoid NATS spam
 */

import { exec, execSync } from "child_process";
import { existsSync } from "fs";

const NATS_URL = process.env.NATS_URL || "nats://127.0.0.1:4222";
const IS_WIN = process.platform === "win32";
const GATEWAY_ID =
  process.env.OPENCLAW_GATEWAY_ID ||
  process.env.COMPUTERNAME ||
  process.env.HOSTNAME ||
  "unknown";

function findNatsBin(): string {
  if (process.env.NATS_BIN) return process.env.NATS_BIN;
  const candidates = IS_WIN
    ? [
        "C:\\ProgramData\\chocolatey\\bin\\nats.exe",
        `${process.env.USERPROFILE}\\.nats\\bin\\nats.exe`,
      ]
    : ["/usr/local/bin/nats", "/usr/bin/nats", "/opt/homebrew/bin/nats"];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  try {
    const which = IS_WIN ? "where nats" : "which nats";
    const result = execSync(which, { timeout: 2000 }).toString().trim().split("\n")[0];
    if (result) return result.trim();
  } catch {}
  return IS_WIN ? "nats.exe" : "nats";
}

const NATS_BIN = findNatsBin();

function publish(subject: string, data: Record<string, any>) {
  const payload = JSON.stringify({
    ...data,
    _ts: new Date().toISOString(),
    _source: "cross-gateway-relay",
    _gateway: GATEWAY_ID,
  });

  let cmd: string;
  if (IS_WIN) {
    const b64 = Buffer.from(payload).toString("base64");
    cmd = `powershell -NoProfile -Command "[System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64}')) | & '${NATS_BIN}' pub '${subject}' --server='${NATS_URL}'"`;
  } else {
    const escaped = payload.replace(/'/g, "'\\''");
    cmd = `echo '${escaped}' | "${NATS_BIN}" pub "${subject}" --server="${NATS_URL}" 2>/dev/null`;
  }

  exec(cmd, { timeout: 3000 });
}

// Debounce availability signals (at most one per 30s)
let lastAvailableSignal = 0;
const AVAILABILITY_DEBOUNCE_MS = 30000;

const handler = async (event: any) => {
  const ts = new Date().toISOString();
  const ctx = event.context || {};
  const agentId = ctx.agentId || process.env.OPENCLAW_AGENT_ID || "main";
  const sessionKey = event.sessionKey || "unknown";

  // message:sent — task completion signal
  if (event.type === "message" && event.action === "sent") {
    const contentLen = ctx.content?.length || 0;

    // Only signal substantial responses (skip acks, reactions, short replies)
    if (contentLen < 50) return;

    // Detect if this looks like a task completion (heuristic)
    const content = (ctx.content || "").toLowerCase();
    const isTaskCompletion =
      content.includes("done") ||
      content.includes("completed") ||
      content.includes("shipped") ||
      content.includes("merged") ||
      content.includes("deployed") ||
      content.includes("fixed") ||
      content.includes("✅") ||
      contentLen > 500; // substantial responses are usually task outputs

    if (isTaskCompletion) {
      publish("openclaw.agent.task.completed", {
        agentId,
        sessionKey,
        channel: ctx.channelId || "unknown",
        responseLength: contentLen,
        timestamp: ts,
      });
    }
  }

  // command:new — agent is available for new work
  if (event.type === "command" && event.action === "new") {
    const now = Date.now();
    if (now - lastAvailableSignal < AVAILABILITY_DEBOUNCE_MS) return;
    lastAvailableSignal = now;

    publish("openclaw.agent.available", {
      agentId,
      sessionKey,
      source: ctx.commandSource || "unknown",
      timestamp: ts,
    });
  }

  // command:stop — agent going offline
  if (event.type === "command" && event.action === "stop") {
    publish("openclaw.agent.offline", {
      agentId,
      sessionKey,
      timestamp: ts,
    });
  }
};

export default handler;
