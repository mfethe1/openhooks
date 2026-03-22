// memu-logger/handler.ts
// Logs agent messages and session events to memU shared memory
// Fire-and-forget: all memU calls have 5s timeout, failures are silent

const MEMU_BASE_URL = process.env.MEMU_BASE_URL || 'http://localhost:8000';
const MEMU_API_KEY = process.env.MEMU_API_KEY || '';
const AGENT_ID = process.env.MEMU_AGENT_ID || 'macklemore';

// 30s dedup window to prevent duplicate logging
const recentMessages = new Map<string, number>();
const DEDUP_WINDOW_MS = 30_000;

function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < Math.min(content.length, 200); i++) {
    hash = ((hash << 5) - hash) + content.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
}

function isDuplicate(content: string): boolean {
  const key = hashContent(content);
  const now = Date.now();
  const last = recentMessages.get(key);
  if (last && (now - last) < DEDUP_WINDOW_MS) return true;
  recentMessages.set(key, now);
  // Cleanup old entries periodically
  if (recentMessages.size > 500) {
    for (const [k, ts] of recentMessages.entries()) {
      if (now - ts > DEDUP_WINDOW_MS * 2) recentMessages.delete(k);
    }
  }
  return false;
}

function agentFromSessionKey(sessionKey: string): string {
  // Session key format: agent:main:<channel>:... or agent:<name>:...
  // For subagents: agent:main:subagent:<uuid>
  const parts = (sessionKey || '').split(':');
  if (parts[0] === 'agent' && parts[1] === 'main') return AGENT_ID;
  if (parts[0] === 'agent' && parts[1]) return parts[1];
  return AGENT_ID;
}

// Detect whether we're talking to local or Railway production
function storePath(): string {
  const isProduction = MEMU_BASE_URL.includes('railway.app');
  return isProduction ? '/api/v1/memu/upsert' : '/memories';
}

async function storeMemory(payload: {
  content: string;
  memory_type: string;
  agent_id: string;
  metadata?: Record<string, unknown>;
  confidence?: number;
  ttl_days?: number;
}): Promise<void> {
  // No API key = skip silently
  if (!MEMU_API_KEY) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const body = {
      content: payload.content,
      memory_type: payload.memory_type,
      agent_id: payload.agent_id,
      confidence: payload.confidence ?? 1.0,
      metadata: {
        ...payload.metadata,
        ttl_days: payload.ttl_days || 14,
        source: 'memu-logger-hook',
        timestamp: new Date().toISOString(),
      },
    };

    const res = await fetch(`${MEMU_BASE_URL}${storePath()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': MEMU_API_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      // Log to stderr but never throw — fail-silent
      console.error(`[memu-logger] store failed: ${res.status} ${res.statusText}`);
    }
  } catch {
    // Network error, timeout, etc. — fully silent
  } finally {
    clearTimeout(timeout);
  }
}

const handler = async (event: any): Promise<void> => {
  try {
    const agentId = agentFromSessionKey(event.sessionKey || '');

    // ── message:received ─────────────────────────────────────────────────
    if (event.type === 'message' && event.action === 'received') {
      const content = event.context?.content || '';
      if (!content || content.trim() === 'HEARTBEAT_OK') return;
      if (isDuplicate(`recv:${event.context?.messageId ?? content}`)) return;

      const from = event.context?.from || event.context?.senderName || 'unknown';
      const channel = event.context?.channelId || 'unknown';

      void storeMemory({
        content: `[INBOUND from ${from} via ${channel}] ${content.slice(0, 2000)}`,
        memory_type: 'user_action',
        agent_id: agentId,
        metadata: {
          event: 'message:received',
          from,
          sender_name: event.context?.senderName,
          sender_username: event.context?.senderUsername,
          channel,
          message_id: event.context?.messageId,
          conversation_id: event.context?.conversationId,
          is_group: event.context?.isGroup ?? event.context?.metadata?.isGroup ?? false,
          group_id: event.context?.groupId,
          session_key: event.sessionKey,
          tags: ['inbound', 'message', channel],
        },
        ttl_days: 14,
        confidence: 1.0,
      });
    }

    // ── message:sent ──────────────────────────────────────────────────────
    else if (event.type === 'message' && event.action === 'sent') {
      const content = event.context?.content || '';
      if (!content || content.trim() === 'HEARTBEAT_OK') return;
      if (isDuplicate(`sent:${event.context?.messageId ?? content}`)) return;

      const to = event.context?.to || 'unknown';
      const channel = event.context?.channelId || 'unknown';
      const success = event.context?.success !== false;
      const statusTag = success ? 'sent_ok' : 'send_failed';

      void storeMemory({
        content: `[OUTBOUND to ${to} via ${channel}] [${statusTag}] ${content.slice(0, 2000)}`,
        memory_type: 'observation',
        agent_id: agentId,
        metadata: {
          event: 'message:sent',
          to,
          channel,
          success,
          error: event.context?.error,
          message_id: event.context?.messageId,
          conversation_id: event.context?.conversationId,
          is_group: event.context?.isGroup ?? false,
          group_id: event.context?.groupId,
          session_key: event.sessionKey,
          tags: ['outbound', 'message', statusTag, channel],
        },
        ttl_days: 14,
        confidence: success ? 1.0 : 0.7,
      });
    }

    // ── command:new / command:reset ───────────────────────────────────────
    else if (event.type === 'command' && (event.action === 'new' || event.action === 'reset')) {
      const boundaryType = event.action === 'new' ? 'SESSION_START' : 'SESSION_RESET';
      const ts = event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString();

      void storeMemory({
        content: `[${boundaryType}] /${event.action} command issued — agent: ${agentId}, session: ${event.sessionKey}, at: ${ts}`,
        memory_type: 'plan',
        agent_id: agentId,
        metadata: {
          event: `command:${event.action}`,
          boundary_type: boundaryType,
          session_key: event.sessionKey,
          command: event.action,
          source: event.context?.commandSource,
          sender_id: event.context?.senderId,
          workspace_dir: event.context?.workspaceDir,
          tags: ['session_boundary', event.action, agentId],
        },
        ttl_days: 30, // Session anchors kept longer
        confidence: 1.0,
      });
    }

    // ── agent:bootstrap ───────────────────────────────────────────────────
    else if (event.type === 'agent' && event.action === 'bootstrap') {
      const bootstrapAgentId = event.context?.agentId ?? agentId;
      const files = (event.context?.bootstrapFiles || [])
        .filter((f: any) => !f.missing)
        .map((f: any) => f.name || f.path || String(f));
      const fileList = files.length > 0 ? files.join(', ') : 'none';

      void storeMemory({
        content: `[BOOTSTRAP] Agent ${bootstrapAgentId} started — session: ${event.sessionKey}, workspace: ${event.context?.workspaceDir ?? 'unknown'}, loaded: ${fileList}`,
        memory_type: 'fact',
        agent_id: bootstrapAgentId,
        metadata: {
          event: 'agent:bootstrap',
          agent_id: bootstrapAgentId,
          session_key: event.sessionKey,
          session_id: event.context?.sessionId,
          workspace_dir: event.context?.workspaceDir,
          bootstrap_files: files,
          tags: ['bootstrap', 'session_start', bootstrapAgentId],
        },
        ttl_days: 30,
        confidence: 1.0,
      });
    }
  } catch {
    // Never throw from a hook — protect agent runtime above all else
  }
};

export default handler;
