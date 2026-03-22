/**
 * Gateway Health Beacon Hook
 * Enables multi-gateway discovery and cross-system health monitoring.
 *
 * Author: Winnie (Revenue + Frontend Agent)
 *
 * Publishes to NATS so all gateways can discover each other.
 * Writes to memU so agents can query gateway fleet health.
 * Heartbeats every N messages to avoid spamming.
 */

import { exec, execSync } from "child_process";
import { existsSync } from "fs";

const NATS_URL = process.env.NATS_URL || "nats://127.0.0.1:4222";
const MEMU_ENDPOINT =
  process.env.MEMU_ENDPOINT || "https://api-production-86f5.up.railway.app";
const MEMU_KEY = process.env.MEMU_KEY || process.env.X_MEMU_KEY || "";
const IS_WIN = process.platform === "win32";
const GATEWAY_ID =
  process.env.OPENCLAW_GATEWAY_ID ||
  process.env.COMPUTERNAME ||
  process.env.HOSTNAME ||
  "unknown";
const HEARTBEAT_INTERVAL = 50; // messages between heartbeats

// Runtime stats
const stats = {
  startedAt: "",
  messagesSent: 0,
  messagesReceived: 0,
  errors: 0,
  lastHeartbeat: "",
};

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

function publishNats(subject: string, data: Record<string, any>) {
  const payload = JSON.stringify(data);
  let cmd: string;
  if (IS_WIN) {
    const b64 = Buffer.from(payload).toString("base64");
    cmd = `powershell -NoProfile -Command "[System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64}')) | & '${NATS_BIN}' pub '${subject}' --server='${NATS_URL}'"`;
  } else {
    const escaped = payload.replace(/'/g, "'\\''");
    cmd = `echo '${escaped}' | "${NATS_BIN}" pub "${subject}" --server="${NATS_URL}" 2>/dev/null`;
  }

  exec(cmd, { timeout: 3000 }, (err) => {
    if (err) stats.errors++;
  });
}

async function writeMemU(content: string, meta: Record<string, any>) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (MEMU_KEY) headers["X-MemU-Key"] = MEMU_KEY;

  try {
    await fetch(`${MEMU_ENDPOINT}/api/v1/memu/add`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        user_id: "openclaw-hook",
        session_id: `gateway:${GATEWAY_ID}`,
        category: "eval",
        content,
        metadata: meta,
        tags: ["gateway", "health"],
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {}
}

function uptimeSeconds(): number {
  if (!stats.startedAt) return 0;
  return Math.floor((Date.now() - new Date(stats.startedAt).getTime()) / 1000);
}

const handler = async (event: any) => {
  const ts = new Date().toISOString();

  // gateway:startup — register this gateway
  if (event.type === "gateway" && event.action === "startup") {
    stats.startedAt = ts;

    const beacon = {
      gatewayId: GATEWAY_ID,
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      startedAt: ts,
      natsBin: NATS_BIN,
      _ts: ts,
      _source: "gateway-health-beacon",
    };

    publishNats("openclaw.gateway.register", beacon);

    await writeMemU(
      `[GATEWAY_BOOT] ${GATEWAY_ID} started at ${ts} on ${process.platform}/${process.arch}`,
      {
        type: "gateway_register",
        gatewayId: GATEWAY_ID,
        platform: process.platform,
        timestamp: ts,
      }
    );

    console.log(`[gateway-health-beacon] Registered gateway ${GATEWAY_ID}`);
  }

  // Track message counts
  if (event.type === "message" && event.action === "received") {
    stats.messagesReceived++;
  }

  if (event.type === "message" && event.action === "sent") {
    stats.messagesSent++;

    // Periodic heartbeat
    if (stats.messagesSent % HEARTBEAT_INTERVAL === 0) {
      stats.lastHeartbeat = ts;

      const heartbeat = {
        gatewayId: GATEWAY_ID,
        uptime: uptimeSeconds(),
        messagesSent: stats.messagesSent,
        messagesReceived: stats.messagesReceived,
        natsErrors: stats.errors,
        _ts: ts,
        _source: "gateway-health-beacon",
      };

      publishNats("openclaw.gateway.heartbeat", heartbeat);

      await writeMemU(
        `[GATEWAY_HEARTBEAT] ${GATEWAY_ID} uptime=${uptimeSeconds()}s sent=${stats.messagesSent} recv=${stats.messagesReceived} errors=${stats.errors}`,
        {
          type: "gateway_heartbeat",
          gatewayId: GATEWAY_ID,
          uptime: uptimeSeconds(),
          messagesSent: stats.messagesSent,
          messagesReceived: stats.messagesReceived,
          timestamp: ts,
        }
      );
    }
  }
};

export default handler;
