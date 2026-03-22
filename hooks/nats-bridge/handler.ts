// nats-bridge/handler.ts
// Publishes OpenClaw events to NATS JetStream for cross-agent coordination
// Fire-and-forget: NATS failures never block agent processing

import { connect, StringCodec, type NatsConnection } from 'nats';

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';
const AGENT_NAME = process.env.OPENCLAW_AGENT_NAME || 'macklemore';
const sc = StringCodec();

// Singleton connection — reconnects automatically
let nc: NatsConnection | null = null;
let connecting = false;

async function getNats(): Promise<NatsConnection | null> {
  if (nc && !nc.isClosed()) return nc;
  if (connecting) return null;

  connecting = true;
  try {
    nc = await connect({
      servers: [NATS_URL],
      timeout: 2000,
      maxReconnectAttempts: 3,
      reconnectTimeWait: 1000,
    });
    connecting = false;
    console.log('[nats-bridge] Connected to NATS');
    nc.closed().then(() => { nc = null; });
    return nc;
  } catch (err) {
    connecting = false;
    nc = null;
    return null; // Degrade silently
  }
}

async function publish(subject: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const conn = await getNats();
    if (!conn) return;
    conn.publish(subject, sc.encode(JSON.stringify({
      ...payload,
      agent: AGENT_NAME,
      ts: Date.now(),
    })));
  } catch {
    // Silent fail
  }
}

const handler = async (event: any): Promise<void> => {
  try {
    const base = { session_key: event.sessionKey };

    if (event.type === 'message' && event.action === 'received') {
      const content = event.context?.content || '';
      if (content.trim() === 'HEARTBEAT_OK') return;
      void publish('openclaw.messages.received', {
        ...base,
        from: event.context?.from,
        channel: event.context?.channelId,
        content: content.slice(0, 500), // Truncate for NATS payload size
        conversation_id: event.context?.conversationId,
        message_id: event.context?.messageId,
      });
      void publish(`openclaw.agents.${AGENT_NAME}.events`, {
        ...base,
        event_type: 'message_received',
        from: event.context?.from,
        channel: event.context?.channelId,
      });
    }

    else if (event.type === 'message' && event.action === 'sent') {
      const content = event.context?.content || '';
      if (content.trim() === 'HEARTBEAT_OK') return;
      void publish('openclaw.messages.sent', {
        ...base,
        to: event.context?.to,
        channel: event.context?.channelId,
        success: event.context?.success !== false,
        content: content.slice(0, 500),
      });
    }

    else if (event.type === 'command') {
      void publish(`openclaw.commands.${event.action}`, {
        ...base,
        action: event.action,
        source: event.context?.commandSource,
        sender_id: event.context?.senderId,
      });
      void publish(`openclaw.agents.${AGENT_NAME}.events`, {
        ...base,
        event_type: `command_${event.action}`,
      });
    }

    else if (event.type === 'agent' && event.action === 'bootstrap') {
      void publish('openclaw.coordination.bootstrap', {
        ...base,
        agent: AGENT_NAME,
        workspace_dir: event.context?.workspaceDir,
        files: event.context?.bootstrapFiles?.length || 0,
      });
    }

    else if (event.type === 'gateway' && event.action === 'startup') {
      void publish('openclaw.coordination.status', {
        ...base,
        status: 'gateway_started',
        agent: AGENT_NAME,
      });
    }
  } catch {
    // Never throw from a hook
  }
};

export default handler;
