/**
 * Session Metrics Hook
 * Tracks session lifecycle and message volume metrics to daily JSONL files.
 */

import { appendFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

function getMetricsDir(): string {
  const workspace =
    process.env.OPENCLAW_WORKSPACE ||
    join(process.env.HOME || "/tmp", ".openclaw/workspace");
  const dir = join(workspace, "metrics");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function todayFile(): string {
  const date = new Date().toISOString().slice(0, 10);
  return join(getMetricsDir(), `${date}-sessions.jsonl`);
}

function logEntry(entry: Record<string, any>) {
  try {
    appendFileSync(todayFile(), JSON.stringify(entry) + "\n");
  } catch {
    // Don't block event processing
  }
}

// In-memory counters (reset on gateway restart)
const counters = {
  messagesReceived: 0,
  messagesSent: 0,
  commandsNew: 0,
  commandsReset: 0,
  commandsStop: 0,
  compactions: 0,
  startupTs: "",
};

const handler = async (event: any) => {
  const ts = event.timestamp?.toISOString() || new Date().toISOString();

  if (event.type === "gateway" && event.action === "startup") {
    counters.startupTs = ts;
    logEntry({
      event: "gateway_startup",
      ts,
      hostname: process.env.HOSTNAME || "unknown",
    });
    return;
  }

  if (event.type === "message" && event.action === "received") {
    counters.messagesReceived++;
    // Log every 10th message to keep file sizes reasonable
    if (counters.messagesReceived % 10 === 0) {
      logEntry({
        event: "message_volume_checkpoint",
        ts,
        received: counters.messagesReceived,
        sent: counters.messagesSent,
        sessionKey: event.sessionKey,
      });
    }
    return;
  }

  if (event.type === "message" && event.action === "sent") {
    counters.messagesSent++;
    return;
  }

  if (event.type === "command") {
    const key = `commands${event.action.charAt(0).toUpperCase()}${event.action.slice(1)}` as keyof typeof counters;
    if (typeof counters[key] === "number") {
      (counters[key] as number)++;
    }

    logEntry({
      event: `command_${event.action}`,
      ts,
      sessionKey: event.sessionKey,
      source: event.context?.commandSource,
      senderId: event.context?.senderId,
      totals: {
        new: counters.commandsNew,
        reset: counters.commandsReset,
        stop: counters.commandsStop,
      },
    });
    return;
  }

  if (event.type === "session" && event.action === "compact:after") {
    counters.compactions++;
    logEntry({
      event: "session_compacted",
      ts,
      sessionKey: event.sessionKey,
      compactionCount: counters.compactions,
      uptimeSince: counters.startupTs || "unknown",
    });
    return;
  }
};

export default handler;
