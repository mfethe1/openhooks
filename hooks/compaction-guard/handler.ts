/**
 * Compaction Guard Hook
 * Snapshots critical state before compaction to prevent context loss.
 */

import { appendFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const MEMU_ENDPOINT = process.env.MEMU_ENDPOINT || "http://localhost:8711";

function getSnapshotDir(): string {
  const workspace =
    process.env.OPENCLAW_WORKSPACE ||
    join(process.env.HOME || "/tmp", ".openclaw/workspace");
  const dir = join(workspace, "snapshots");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function snapshotFile(): string {
  const date = new Date().toISOString().slice(0, 10);
  return join(getSnapshotDir(), `compaction-${date}.jsonl`);
}

async function writeToMemU(content: string, meta: Record<string, any>) {
  try {
    await fetch(`${MEMU_ENDPOINT}/api/v1/memu/memories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        metadata: meta,
        namespace: "compaction_snapshots",
        tags: ["compaction", "snapshot"],
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Non-blocking — local file is the backup
  }
}

function readActiveContext(): string {
  // Try to read active-context.md or BACKLOG.md for current state
  const workspace =
    process.env.OPENCLAW_WORKSPACE ||
    join(process.env.HOME || "/tmp", ".openclaw/workspace");

  const contextFiles = [
    join(workspace, "agent-coordination/active-context.md"),
    "/home/michael-fethe/agent_coordination/active-context.md",
  ];

  for (const f of contextFiles) {
    try {
      if (existsSync(f)) {
        const content = readFileSync(f, "utf-8");
        // Truncate to keep snapshot reasonable
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
      }
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
      }
    );

    console.log(
      `[compaction-guard] Post-compaction logged for ${sessionKey} (summary: ${record.summaryLength} chars)`
    );
  }
};

export default handler;
