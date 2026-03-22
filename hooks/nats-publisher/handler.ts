/**
 * NATS Publisher Hook
 * Publishes agent lifecycle events to NATS for real-time cross-agent coordination.
 * Uses the `nats` CLI binary (fire-and-forget) to avoid npm dependency issues.
 */

import { exec } from "child_process";

const NATS_URL = process.env.NATS_URL || "nats://127.0.0.1:4222";
const NATS_BIN = process.env.NATS_BIN || "/usr/local/bin/nats";

function publish(subject: string, data: Record<string, any>) {
  const payload = JSON.stringify({
    ...data,
    _ts: new Date().toISOString(),
    _source: "openclaw-hook",
  });

  // Fire-and-forget: don't await, don't block
  const escaped = payload.replace(/'/g, "'\\''");
  exec(
    `${NATS_BIN} pub "${subject}" '${escaped}' --server="${NATS_URL}" 2>/dev/null`,
    { timeout: 3000 },
    (err) => {
      if (err) {
        // Silent fail — NATS being down shouldn't block the gateway
        console.debug?.(
          `[nats-publisher] Publish to ${subject} failed: ${err.message}`
        );
      }
    }
  );
}

const handler = async (event: any) => {
  const ts = event.timestamp?.toISOString() || new Date().toISOString();
  const ctx = event.context || {};

  // message:received
  if (event.type === "message" && event.action === "received") {
    publish("openclaw.message.received", {
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
      action: event.action,
      sessionKey: event.sessionKey,
      source: ctx.commandSource,
      senderId: ctx.senderId,
      timestamp: ts,
    });
  }

  // gateway:startup
  if (event.type === "gateway" && event.action === "startup") {
    publish("openclaw.gateway.startup", {
      timestamp: ts,
      hostname: process.env.HOSTNAME || "unknown",
    });
  }

  // session:compact:after
  if (event.type === "session" && event.action === "compact:after") {
    publish("openclaw.session.compacted", {
      sessionKey: event.sessionKey,
      timestamp: ts,
      summaryLength: ctx.summary ? String(ctx.summary).length : 0,
    });
  }
};

export default handler;
