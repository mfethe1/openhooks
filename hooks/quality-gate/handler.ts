/**
 * Quality Gate Hook
 * Tracks response quality metrics and flags anomalies.
 */

import { appendFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";

const LOG_PATH = join(
  process.env.HOME || "/tmp",
  ".openclaw/logs/quality-metrics.jsonl"
);

// Ensure log directory exists
const logDir = dirname(LOG_PATH);
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

// In-memory sliding window for latency tracking
const pendingReceived = new Map<
  string,
  { ts: number; contentLength: number }
>();

// Quality thresholds
const THRESHOLDS = {
  minResponseLength: 10, // suspiciously short
  maxResponseLength: 15000, // excessively long
  maxLatencyMs: 120000, // 2 min — something is wrong
  apologyPatterns: [
    /^I('m| am) sorry/i,
    /I apologize/i,
    /I('m| am) unable to/i,
    /I can('t|not) help/i,
    /something went wrong/i,
  ],
};

function logMetric(metric: Record<string, any>) {
  try {
    appendFileSync(LOG_PATH, JSON.stringify(metric) + "\n");
  } catch {
    // silently fail — don't block message flow
  }
}

function detectQualityIssues(content: string): string[] {
  const issues: string[] = [];

  if (content.length < THRESHOLDS.minResponseLength) {
    issues.push("suspiciously_short");
  }
  if (content.length > THRESHOLDS.maxResponseLength) {
    issues.push("excessively_long");
  }

  for (const pattern of THRESHOLDS.apologyPatterns) {
    if (pattern.test(content)) {
      issues.push("apology_pattern");
      break;
    }
  }

  // Detect error dumps
  if (
    content.includes("Error:") &&
    content.includes("at ") &&
    content.includes(".js:")
  ) {
    issues.push("error_dump_in_response");
  }

  // Detect repetition (same 50+ char block repeated)
  const chunks = content.match(/.{50}/g);
  if (chunks) {
    const seen = new Set<string>();
    for (const chunk of chunks) {
      if (seen.has(chunk)) {
        issues.push("repetitive_content");
        break;
      }
      seen.add(chunk);
    }
  }

  return issues;
}

const handler = async (event: any) => {
  const now = Date.now();
  const ctx = event.context || {};

  // Track received messages for latency calculation
  if (event.type === "message" && event.action === "received") {
    const key = event.sessionKey || "unknown";
    pendingReceived.set(key, {
      ts: now,
      contentLength: ctx.content?.length || 0,
    });

    // Cleanup old entries (>5 min)
    for (const [k, v] of pendingReceived.entries()) {
      if (now - v.ts > 300000) pendingReceived.delete(k);
    }
    return;
  }

  // Analyze sent messages
  if (event.type === "message" && event.action === "sent") {
    const key = event.sessionKey || "unknown";
    const content = ctx.content || "";
    const pending = pendingReceived.get(key);
    const latencyMs = pending ? now - pending.ts : undefined;

    // Detect quality issues
    const issues = detectQualityIssues(content);

    // Check latency anomaly
    if (latencyMs && latencyMs > THRESHOLDS.maxLatencyMs) {
      issues.push("high_latency");
    }

    // Check send failure
    if (ctx.success === false) {
      issues.push("send_failed");
    }

    const metric = {
      ts: new Date().toISOString(),
      sessionKey: key,
      channel: ctx.channelId || "unknown",
      responseLength: content.length,
      inputLength: pending?.contentLength || 0,
      latencyMs: latencyMs || null,
      success: ctx.success !== false,
      issues: issues.length > 0 ? issues : undefined,
      isAnomaly: issues.length > 0,
    };

    logMetric(metric);

    // Clean up pending
    if (pending) pendingReceived.delete(key);

    // If anomaly detected, push a message for the user
    if (issues.length > 0 && issues.some((i) => i !== "apology_pattern")) {
      console.warn(
        `[quality-gate] Anomaly detected: ${issues.join(", ")} | session=${key} latency=${latencyMs}ms len=${content.length}`
      );
    }
  }
};

export default handler;
