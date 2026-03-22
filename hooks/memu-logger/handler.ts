/**
 * memU Logger Hook
 * Persists message events to memU for durable, cross-agent searchable memory.
 */

const MEMU_ENDPOINT = process.env.MEMU_ENDPOINT || "http://localhost:8711";

interface MemUPayload {
  content: string;
  metadata: Record<string, string | number | boolean | undefined>;
  namespace?: string;
  tags?: string[];
}

async function writeToMemU(payload: MemUPayload): Promise<boolean> {
  try {
    const resp = await fetch(`${MEMU_ENDPOINT}/api/v1/memu/memories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
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

  // message:received — log inbound messages
  if (event.type === "message" && event.action === "received") {
    const { from, content, channelId, conversationId, messageId } =
      event.context || {};
    if (!content || content.length < 3) return; // skip trivial

    await writeToMemU({
      content: `[INBOUND ${channelId || "unknown"}] From ${from || "unknown"}: ${content}`,
      metadata: {
        type: "message_received",
        from: from || "",
        channel: channelId || "",
        conversationId: conversationId || "",
        messageId: messageId || "",
        timestamp: ts,
        sessionKey: event.sessionKey || "",
      },
      namespace: "conversation_log",
      tags: ["message", "inbound", channelId || "unknown"],
    });
  }

  // message:sent — log outbound messages
  if (event.type === "message" && event.action === "sent") {
    const { to, content, channelId, success } = event.context || {};
    if (!content || content.length < 3) return;

    // Truncate long agent responses to save storage
    const truncated =
      content.length > 500 ? content.slice(0, 500) + "..." : content;

    await writeToMemU({
      content: `[OUTBOUND ${channelId || "unknown"}] To ${to || "unknown"}: ${truncated}`,
      metadata: {
        type: "message_sent",
        to: to || "",
        channel: channelId || "",
        success: success !== false,
        timestamp: ts,
        sessionKey: event.sessionKey || "",
      },
      namespace: "conversation_log",
      tags: ["message", "outbound", channelId || "unknown"],
    });
  }

  // command:new — log session resets
  if (event.type === "command" && event.action === "new") {
    await writeToMemU({
      content: `[SESSION_RESET] Session ${event.sessionKey || "unknown"} was reset at ${ts}`,
      metadata: {
        type: "session_reset",
        sessionKey: event.sessionKey || "",
        source: event.context?.commandSource || "",
        timestamp: ts,
      },
      namespace: "session_events",
      tags: ["session", "reset"],
    });
  }
};

export default handler;
