import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const LOG_DIR = join(process.env.HOME || '/Users/mfethe', '.openclaw', 'logs');
const MEMU_URL = process.env.MEMU_BASE_URL || 'http://localhost:8000';
const NATS_MONITOR_URL = 'http://localhost:8222';

interface ProbeResult {
  name: string;
  ok: boolean;
  latencyMs: number;
  statusCode?: number;
  error?: string;
}

async function probe(name: string, url: string, timeoutMs = 3000): Promise<ProbeResult> {
  const start = Date.now();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    return { name, ok: res.ok, latencyMs: Date.now() - start, statusCode: res.status };
  } catch (err) {
    clearTimeout(t);
    const msg = err instanceof Error ? err.message : String(err);
    // Normalize timeout/abort errors
    const isTimeout = msg.includes('abort') || msg.includes('timeout');
    return {
      name,
      ok: false,
      latencyMs: Date.now() - start,
      error: isTimeout ? `timeout after ${timeoutMs}ms` : msg,
    };
  }
}

const handler = async (event: any): Promise<void> => {
  if (event.type !== 'gateway' || event.action !== 'startup') return;

  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

    const results = await Promise.all([
      probe('memu-local', `${MEMU_URL}/health`),
      probe('nats-monitor', `${NATS_MONITOR_URL}/healthz`),
    ]);

    const allOk = results.every(r => r.ok);
    const report = {
      timestamp: new Date().toISOString(),
      all_healthy: allOk,
      probes: results,
    };

    writeFileSync(join(LOG_DIR, 'health-probe.json'), JSON.stringify(report, null, 2));

    const failed = results.filter(r => !r.ok);
    if (failed.length > 0) {
      const names = failed.map(r => r.name).join(', ');
      event.messages?.push(`⚠️ Gateway health probe: ${names} UNREACHABLE at startup`);
    } else {
      console.log('[health-probe] All services healthy at startup');
    }
  } catch (err) {
    console.error('[health-probe] Error:', err instanceof Error ? err.message : String(err));
  }
};

export default handler;
