/**
 * memU Logger Hook
 * Persists message events to memU for durable, cross-agent searchable memory.
 *
 * Fixed by Winnie:
 * - Correct memU endpoint: /api/v1/memu/add (not /memories)
 * - Added required X-MemU-Key auth header
 * - Added required user_id and valid category enum
 * - Added session_id for schema compliance
 * - Supports both local and remote memU endpoints
 */

const MEMU_ENDPOINT =
  process.env.MEMU_ENDPOINT || "https://api-production-86f5.up.railway.app";
const MEMU_KEY = process.env.MEMU_KEY || process.env.X_MEMU_KEY || "";

interface MemUPayload {
  user_id: string;
  session_id: string;
  category: "eval" | "decision" | "task" | "working" | "lesson";
  content: string;
  metadata?: Record<string, string | number | boolean | undefined>;
  tags?: string[];
}

async function writeToMemU(payload: MemUPayload): Promise<boolean> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (MEMU_KEY) {
    headers["X-MemU-Key"] = MEMU_KEY;
  }

  try {
    const resp = await fetch(`${MEMU_ENDPOINT}/api/v1/memu/add`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.error(`[memu-logger] memU rejected write (${resp.status}): ${body.slice(0, 200)}`);
    }
    return resp.ok;
  } catch (err) {
    console.error(
      `[memu-logger] Write failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return false;
  }
}

const handler = async (event: any) => {
  const ts = event.timestamp?.toISOString() || new Date().toISOString();
  const sessionKey = event.sessionKey || "unknown";

  // message:received - log inbound messages
  if (event.type === "message" && event.action === "received") {
    const { from, content, channelId, conversationId, messageId } =
      event.context || {};
    if (!content || content.length < 3) return;

    await writeToMemU({
      user_id: "openclaw-hook",
      session_id: sessionKey,
      category: "working",
      content: `[INBOUND ${channelId || "unknown"}] From ${from || "unknown"}: ${content.slice(0, 500)}`,
      metadata: {
        type: "message_received",
        from: from || "",
        channel: channelId || "",
        conversationId: conversationId || "",
        messageId: messageId || "",
        timestamp: ts,
        sessionKey,
      },
      tags: ["message", "inbound", channelId || "unknown"],
    });
  }

  // message:sent - log outbound messages
  if (event.type === "message" && event.action === "sent") {
    const { to, content, channelId, success } = event.context || {};
    if (!content || content.length < 3) return;

    const truncated =
      content.length > 500 ? content.slice(0, 500) + "..." : content;

    await writeToMemU({
      user_id: "openclaw-hook",
      session_id: sessionKey,
      category: "working",
      content: `[OUTBOUND ${channelId || "unknown"}] To ${to || "unknown"}: ${truncated}`,
      metadata: {
        type: "message_sent",
        to: to || "",
        channel: channelId || "",
        success: success !== false,
        timestamp: ts,
        sessionKey,
      },
      tags: ["message", "outbound", channelId || "unknown"],
    });
  }

  // command:new - log session resets with decision category
  if (event.type === "command" && event.action === "new") {
    await writeToMemU({
      user_id: "openclaw-hook",
      session_id: sessionKey,
      category: "decision",
      content: `[SESSION_RESET] Session ${sessionKey} was reset at ${ts}. Source: ${event.context?.commandSource || "unknown"}`,
      metadata: {
        type: "session_reset",
        sessionKey,
        source: event.context?.commandSource || "",
        timestamp: ts,
      },
      tags: ["session", "reset"],
    });
  }
};

export default handler;
