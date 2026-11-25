import { createHmac, randomBytes } from 'node:crypto';
import type { App } from '../core/app.js';
import { now, id } from '../core/util.js';
import { getItem } from './feedback-store.js';

export interface SupportSyncConfig {
  enabled: boolean;
  endpoint: string;
  instanceId: string;
  secretKey: string;
  clientName: string;
}

export interface OutboxItem {
  id: string;
  feedback_id: string;
  action: 'create' | 'message' | 'status';
  payload: any;
  attempts: number;
  last_error: string | null;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
}

export function ensureSupportClientTable(app: App) {
  app.db.run(`
    CREATE TABLE IF NOT EXISTS support_sync_outbox (
      id TEXT PRIMARY KEY,
      feedback_id TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      next_retry_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  app.db.run(`
    CREATE INDEX IF NOT EXISTS support_sync_outbox_retry ON support_sync_outbox(attempts, next_retry_at);
  `);
}

export function getSupportSyncConfig(app: App): SupportSyncConfig {
  let dbConf: Partial<SupportSyncConfig> = {};
  try {
    const row = app.db.get('SELECT value FROM agency_settings WHERE key = ?', 'dwarapalak_central_support');
    if (row?.value) dbConf = JSON.parse(row.value);
  } catch {
    dbConf = {};
  }

  const enabledEnv = (process.env.DWARAPALAK_SUPPORT_SYNC_ENABLED ?? '').trim().toLowerCase();
  const enabled = enabledEnv === 'true' || (enabledEnv !== 'false' && Boolean(dbConf.enabled));
  const endpoint = (process.env.DWARAPALAK_SUPPORT_ENDPOINT ?? dbConf.endpoint ?? '').trim();
  const instanceId = (process.env.DWARAPALAK_INSTANCE_ID ?? dbConf.instanceId ?? '').trim();
  const secretKey = (process.env.DWARAPALAK_SUPPORT_KEY ?? dbConf.secretKey ?? '').trim();
  const clientName = (process.env.DWARAPALAK_CLIENT_NAME ?? dbConf.clientName ?? 'Dwarapalak Client VPS').trim();

  return { enabled, endpoint, instanceId, secretKey, clientName };
}

export function isSupportSyncEnabled(app: App): boolean {
  const c = getSupportSyncConfig(app);
  return Boolean(c.enabled && c.endpoint && c.instanceId && c.secretKey);
}

export function signSupportPayload(secret: string, timestamp: number, nonce: string, bodyJson: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${nonce}.${bodyJson}`).digest('hex');
}

export function enqueueSupportReport(app: App, feedbackId: string, action: 'create' | 'message' | 'status', payload: any) {
  if (!isSupportSyncEnabled(app)) return;
  try {
    ensureSupportClientTable(app);
    const itemId = id();
    const ts = now();
    app.db.run(
      `INSERT INTO support_sync_outbox (id, feedback_id, action, payload, attempts, last_error, next_retry_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, NULL, NULL, ?, ?)`,
      itemId,
      feedbackId,
      action,
      JSON.stringify(payload),
      ts,
      ts,
    );
  } catch (err: any) {
    // Failure to enqueue must never crash local feedback creation
    console.error('[CentralSupportClient] Enqueue error:', err?.message || err);
  }
}

export async function flushSupportOutbox(app: App, customFetch?: typeof fetch): Promise<{ sent: number; failed: number; pending: number }> {
  ensureSupportClientTable(app);
  const cfg = getSupportSyncConfig(app);
  if (!cfg.enabled || !cfg.endpoint || !cfg.instanceId || !cfg.secretKey) {
    const pendingCount = (app.db.get<{ n: number }>('SELECT COUNT(*) as n FROM support_sync_outbox') || { n: 0 }).n;
    return { sent: 0, failed: 0, pending: pendingCount };
  }

  const fetchFn = customFetch ?? globalThis.fetch;
  const currentTime = now();
  const rows = app.db.all<any>(
    `SELECT * FROM support_sync_outbox
     WHERE (next_retry_at IS NULL OR (next_retry_at <= ? AND next_retry_at != 'abandoned'))
     ORDER BY created_at ASC LIMIT 50`,
    currentTime,
  );

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    let payloadObj: any;
    try {
      payloadObj = JSON.parse(row.payload);
    } catch {
      payloadObj = row.payload;
    }

    const envelope = {
      instance_id: cfg.instanceId,
      client_name: cfg.clientName,
      feedback_id: row.feedback_id,
      action: row.action,
      payload: payloadObj,
      queued_at: row.created_at,
    };

    const bodyJson = JSON.stringify(envelope);
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = randomBytes(16).toString('hex');
    const signature = signSupportPayload(cfg.secretKey, timestamp, nonce, bodyJson);

    try {
      const url = cfg.endpoint.endsWith('/') ? `${cfg.endpoint}ingest` : `${cfg.endpoint}/ingest`;
      const res = await fetchFn(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-dwarapalak-signature': signature,
          'x-dwarapalak-instance-id': cfg.instanceId,
          'x-dwarapalak-timestamp': String(timestamp),
          'x-dwarapalak-nonce': nonce,
          'x-dwarapalak-client-name': encodeURIComponent(cfg.clientName),
        },
        body: bodyJson,
      });

      if (res.ok) {
        app.db.run('DELETE FROM support_sync_outbox WHERE id = ?', row.id);
        sent++;
      } else {
        const errorText = await res.text().catch(() => String(res.status));
        const attempts = row.attempts + 1;
        const nextRetry = attempts >= 5
          ? 'abandoned'
          : new Date(Date.now() + Math.pow(2, attempts) * 5000).toISOString();
        app.db.run(
          'UPDATE support_sync_outbox SET attempts = ?, last_error = ?, next_retry_at = ?, updated_at = ? WHERE id = ?',
          attempts,
          `HTTP ${res.status}: ${errorText.slice(0, 300)}`,
          nextRetry,
          now(),
          row.id,
        );
        failed++;
      }
    } catch (err: any) {
      const attempts = row.attempts + 1;
      const nextRetry = attempts >= 5
        ? 'abandoned'
        : new Date(Date.now() + Math.pow(2, attempts) * 5000).toISOString();
      app.db.run(
        'UPDATE support_sync_outbox SET attempts = ?, last_error = ?, next_retry_at = ?, updated_at = ? WHERE id = ?',
        attempts,
        `Network error: ${String(err?.message || err).slice(0, 300)}`,
        nextRetry,
        now(),
        row.id,
      );
      failed++;
    }
  }

  const remaining = (app.db.get<{ n: number }>('SELECT COUNT(*) as n FROM support_sync_outbox') || { n: 0 }).n;
  return { sent, failed, pending: remaining };
}

export async function syncSupportUpdates(app: App, customFetch?: typeof fetch): Promise<{ synced: number }> {
  const cfg = getSupportSyncConfig(app);
  if (!cfg.enabled || !cfg.endpoint || !cfg.instanceId || !cfg.secretKey) {
    return { synced: 0 };
  }

  const fetchFn = customFetch ?? globalThis.fetch;
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = randomBytes(16).toString('hex');
  const signature = signSupportPayload(cfg.secretKey, timestamp, nonce, '');

  try {
    const url = cfg.endpoint.endsWith('/') ? `${cfg.endpoint}sync` : `${cfg.endpoint}/sync`;
    const res = await fetchFn(url, {
      method: 'GET',
      headers: {
        'x-dwarapalak-signature': signature,
        'x-dwarapalak-instance-id': cfg.instanceId,
        'x-dwarapalak-timestamp': String(timestamp),
        'x-dwarapalak-nonce': nonce,
      },
    });

    if (!res.ok) return { synced: 0 };

    const data: any = await res.json();
    const updates = Array.isArray(data?.reports) ? data.reports : [];
    let synced = 0;

    for (const u of updates) {
      const item = getItem(app, u.remote_feedback_id);
      if (!item) continue;

      // Update public note if provided
      if (u.public_notes && u.public_notes !== item.public_note) {
        app.db.run('UPDATE feedback_items SET public_note = ?, updated_at = ? WHERE id = ?', u.public_notes, now(), item.id);
        synced++;
      }

      // Sync replies from central team
      if (Array.isArray(u.replies)) {
        for (const rep of u.replies) {
          if (!rep?.body) continue;
          const exists = app.db.get('SELECT 1 FROM ticket_events WHERE ticket_id = ? AND body = ?', item.ticket_id, rep.body);
          if (!exists) {
            app.db.run(
              `INSERT INTO ticket_events (id, location_id, ticket_id, user_id, type, body, data, created_at)
               VALUES (?, ?, ?, NULL, 'reply', ?, ?, ?)`,
              id(),
              item.support_location_id,
              item.ticket_id,
              rep.body,
              JSON.stringify({ author: rep.author || 'JITEN Support Team', via: 'central_gateway' }),
              rep.at || now(),
            );
            synced++;
          }
        }
      }
    }

    return { synced };
  } catch (err: any) {
    console.error('[CentralSupportClient] Sync error:', err?.message || err);
    return { synced: 0 };
  }
}

