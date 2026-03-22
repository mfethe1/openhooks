import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';

const LOG_FILE = join(process.env.HOME || '/Users/mfethe', '.openclaw', 'logs', 'cost-log.csv');
const AGENT = process.env.OPENCLAW_AGENT_NAME || 'macklemore';
const CSV_HEADER = 'timestamp,session_key,channel,to,content_length,agent,is_group,success\n';

function ensureLogFile(): void {
  const dir = dirname(LOG_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(LOG_FILE)) writeFileSync(LOG_FILE, CSV_HEADER);
}

const handler = async (event: any): Promise<void> => {
  if (event.type !== 'message' || event.action !== 'sent') return;

  try {
    ensureLogFile();

    const ts = new Date().toISOString();
    const sessionKey = (event.sessionKey || '').replace(/,/g, ';');
    const channel = (event.context?.channelId || '').replace(/,/g, ';');
    const to = (event.context?.to || '').replace(/,/g, ';'); // CSV-safe
    const contentLen = (event.context?.content || '').length;
    const isGroup = event.context?.isGroup ? 'true' : 'false';
    const success = event.context?.success !== false ? 'true' : 'false';

    // Skip HEARTBEAT_OK logs to reduce noise
    if ((event.context?.content || '').trim() === 'HEARTBEAT_OK') return;

    const row = `${ts},${sessionKey},${channel},${to},${contentLen},${AGENT},${isGroup},${success}\n`;
    appendFileSync(LOG_FILE, row);
  } catch {
    // Silent fail — never let logging break message delivery
  }
};

export default handler;
