import { existsSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const EDRIVE_PRIMARY = '/Volumes/Edrive/Projects/agent-coordination';
const EDRIVE_SECONDARY = '/Volumes/EDrive-1/Projects/agent-coordination';
const LOCAL_FALLBACK = '/Users/mfethe/agent_coordination';
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || '/Users/mfethe/openclaw-shared/workspace';
const LOG_DIR = join(process.env.HOME || '/Users/mfethe', '.openclaw', 'logs');

interface EdriveStatus {
  timestamp: string;
  edrive_mounted: boolean;
  active_path: string;
  degraded: boolean;
  last_online?: string;
  last_offline?: string;
}

function checkPath(p: string): boolean {
  try {
    return existsSync(p) && statSync(p).isDirectory();
  } catch {
    return false;
  }
}

const handler = async (event: any): Promise<void> => {
  if (event.type !== 'agent' || event.action !== 'bootstrap') return;

  try {
    const statusFile = join(WORKSPACE, '.edrive-status.json');
    const now = new Date().toISOString();

    // Check mount state
    const primaryOk = checkPath(EDRIVE_PRIMARY);
    const secondaryOk = !primaryOk && checkPath(EDRIVE_SECONDARY);
    const edriveMounted = primaryOk || secondaryOk;
    const activePath = primaryOk ? EDRIVE_PRIMARY : secondaryOk ? EDRIVE_SECONDARY : LOCAL_FALLBACK;

    // Read previous status
    let prevStatus: EdriveStatus | null = null;
    try {
      prevStatus = JSON.parse(readFileSync(statusFile, 'utf8'));
    } catch { /* no prior status */ }

    const status: EdriveStatus = {
      timestamp: now,
      edrive_mounted: edriveMounted,
      active_path: activePath,
      degraded: !edriveMounted,
      last_online: edriveMounted ? now : prevStatus?.last_online,
      last_offline: !edriveMounted ? now : prevStatus?.last_offline,
    };

    writeFileSync(statusFile, JSON.stringify(status, null, 2));

    // Also write log entry
    try {
      if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
      const logEntry = JSON.stringify({
        timestamp: now,
        sessionKey: event.sessionKey,
        mounts: {
          [EDRIVE_PRIMARY]: primaryOk,
          [EDRIVE_SECONDARY]: secondaryOk,
          [LOCAL_FALLBACK]: checkPath(LOCAL_FALLBACK),
        },
        active_path: activePath,
        degraded: !edriveMounted,
      }) + '\n';
      const { appendFileSync } = await import('fs');
      appendFileSync(join(LOG_DIR, 'edrive-mount.log'), logEntry);
    } catch { /* log write failure is non-fatal */ }

    // Detect transitions and alert
    const wasOnline = prevStatus?.edrive_mounted;
    if (wasOnline && !edriveMounted) {
      event.messages?.push('⚠️ **Edrive went OFFLINE** — switching to local fallback at ' + LOCAL_FALLBACK);
    } else if (wasOnline === false && edriveMounted) {
      event.messages?.push('✅ **Edrive back ONLINE** — coordination root restored at ' + activePath);
    } else if (!edriveMounted) {
      // Already in degraded mode, just log quietly (no repeat alerts)
      console.log('[edrive-watcher] DEGRADED — using local fallback');
    }
  } catch (err) {
    console.error('[edrive-watcher] Error:', err instanceof Error ? err.message : String(err));
  }
};

export default handler;
