/**
 * Compaction Guard Hook
 * Snapshots critical state before compaction to prevent context loss.
 *
 * Fixed by Winnie:
 * - Correct memU endpoint and auth header
 * - Cross-platform paths (Windows + Linux/Mac)
 * - Valid memU schema (user_id, session_id, category enum)
 * - Reads from workspace-relative paths, not hardcoded Linux paths
 */

import { appendFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const MEMU_ENDPOINT =
  process.env.MEMU_ENDPOINT || "https://api-production-86f5.up.railway.app";
const MEMU_KEY = process.env.MEMU_KEY || process.env.X_MEMU_KEY || "";

function getWorkspace(): string {
  return (
    process.env.OPENCLAW_WORKSPACE ||
    (process.platform === "win32"
      ? join(process.env.USERPROFILE || "C:\\Users\\default", ".openclaw", "workspace")
      : join(process.env.HOME || "/tmp", ".openclaw/workspace"))
  );
}

function getSnapshotDir(): string {
  const dir = join(getWorkspace(), "snapshots");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function snapshotFile(): string {
  const date = new Date().toISOString().slice(0, 10);
  return join(getSnapshotDir(), `compaction-${date}.jsonl`);
}

async function writeToMemU(content: string, meta: Record<string, any>, sessionKey: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (MEMU_KEY) {
    headers["X-MemU-Key"] = MEMU_KEY;
  }

  try {
    await fetch(`${MEMU_ENDPOINT}/api/v1/memu/add`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        user_id: "openclaw-hook",
        session_id: sessionKey,
        category: "decision",
        content,
        metadata: meta,
        tags: ["compaction", "snapshot"],
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Non-blocking — local file is the backup
  }
}

function readActiveContext(): string {
  const workspace = getWorkspace();

  // Try multiple potential context file locations (cross-platform)
  const contextFiles = [
    join(workspace, "agent-coordination", "active-context.md"),
    join(workspace, "task-breakout.md"),
    join(workspace, "decision-log.md"),
  ];

  // Also check canonical mount paths (Linux/Mac only)
  if (process.platform !== "win32") {
    contextFiles.push(
      "/home/michael-fethe/agent_coordination/active-context.md",
      "/Volumes/EDrive-1/Projects/agent-coordination/active-context.md"
    );
  } else {
    contextFiles.push(
      "E:\\Projects\\agent-coordination\\active-context.md"
    );
  }

  for (const f of contextFiles) {
    try {
      if (existsSync(f)) {
        const content = readFileSync(f, "utf-8");
        return content.slice(0, 2000);
      }
    } catch {
      continue;
    }
  }
  return "";
}

const handler = async (event: any) => {
  const ts = new Date().toISOString();
  const sessionKey = event.sessionKey || "unknown";

  // Before compaction: snapshot what we might lose
  if (event.type === "session" && event.action === "compact:before") {
    const activeContext = readActiveContext();

    const snapshot = {
      event: "pre_compaction_snapshot",
      ts,
      sessionKey,
      activeContext: activeContext || "none_found",
      tokenCount: event.context?.tokenCount || null,
      messageCount: event.context?.messageCount || null,
      host: process.env.COMPUTERNAME || process.env.HOSTNAME || "unknown",
    };

    // Write to local file
    try {
      appendFileSync(snapshotFile(), JSON.stringify(snapshot) + "\n");
    } catch {
      // non-blocking
    }

    // Write to memU for cross-agent searchability
    await writeToMemU(
      `[PRE-COMPACTION] Session ${sessionKey} at ${ts}. Active context: ${activeContext.slice(0, 500) || "none"}`,
      {
        type: "pre_compaction",
        sessionKey,
        timestamp: ts,
      },
      sessionKey
    );

    console.log(
      `[compaction-guard] Pre-compaction snapshot saved for ${sessionKey}`
    );
  }

  // After compaction: log what happened
  if (event.type === "session" && event.action === "compact:after") {
    const record = {
      event: "post_compaction",
      ts,
      sessionKey,
      summaryLength: event.context?.summary
        ? String(event.context.summary).length
        : 0,
      host: process.env.COMPUTERNAME || process.env.HOSTNAME || "unknown",
    };

    try {
      appendFileSync(snapshotFile(), JSON.stringify(record) + "\n");
    } catch {
      // non-blocking
    }

    await writeToMemU(
      `[POST-COMPACTION] Session ${sessionKey} compacted at ${ts}. Summary length: ${record.summaryLength} chars.`,
      {
        type: "post_compaction",
        sessionKey,
        timestamp: ts,
        summaryLength: record.summaryLength,
      },
      sessionKey
    );

    console.log(
      `[compaction-guard] Post-compaction logged for ${sessionKey} (summary: ${record.summaryLength} chars)`
    );
  }
};

export default handler;
