import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { App } from '../core/app.js';
import { id, now } from '../core/util.js';

export interface CentralClient {
  instance_id: string;
  client_name: string;
  secret_key: string;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface CentralReport {
  id: string;
  instance_id: string;
  remote_feedback_id: string;
  client_name: string;
  kind: string;
  title: string;
  body: string;
  expected: string;
  steps: string;
  severity: string;
  area: string;
  platform: string;
  diagnostics: string;
  status: string;
  public_notes: string;
  replies: string;
  created_at: string;
  updated_at: string;
}

export function ensureCentralSupportTables(app: App) {
  app.db.run(`
    CREATE TABLE IF NOT EXISTS central_support_clients (
      instance_id TEXT PRIMARY KEY,
      client_name TEXT NOT NULL,
      secret_key TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  app.db.run(`
    CREATE TABLE IF NOT EXISTS central_support_reports (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL REFERENCES central_support_clients(instance_id) ON DELETE CASCADE,
      remote_feedback_id TEXT NOT NULL,
      client_name TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      expected TEXT NOT NULL DEFAULT '',
      steps TEXT NOT NULL DEFAULT '',
      severity TEXT NOT NULL DEFAULT '',
      area TEXT NOT NULL DEFAULT '',
      platform TEXT NOT NULL DEFAULT 'web',
      diagnostics TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'neu',
      public_notes TEXT NOT NULL DEFAULT '',
      replies TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(instance_id, remote_feedback_id)
    );
  `);
  app.db.run(`
    CREATE INDEX IF NOT EXISTS central_reports_instance ON central_support_reports(instance_id, status);
  `);
  app.db.run(`
    CREATE TABLE IF NOT EXISTS central_support_nonces (
      nonce TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  app.db.run(`
    CREATE INDEX IF NOT EXISTS central_nonces_ts ON central_support_nonces(timestamp);
  `);
}

export function registerCentralClient(
  app: App,
  input: { instanceId: string; clientName: string; secretKey?: string },
): CentralClient {
  ensureCentralSupportTables(app);
  const secretKey = input.secretKey || randomBytes(32).toString('hex');
  const ts = now();
  app.db.run(
    `INSERT INTO central_support_clients (instance_id, client_name, secret_key, active, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?)
     ON CONFLICT(instance_id) DO UPDATE SET client_name = excluded.client_name, updated_at = excluded.updated_at`,
    input.instanceId,
    input.clientName,
    secretKey,
    ts,
    ts,
  );
  return app.db.get<CentralClient>('SELECT * FROM central_support_clients WHERE instance_id = ?', input.instanceId)!;
}

export function getCentralClient(app: App, instanceId: string): CentralClient | undefined {
  ensureCentralSupportTables(app);
  return app.db.get<CentralClient>('SELECT * FROM central_support_clients WHERE instance_id = ? AND active = 1', instanceId);
}

export function listCentralClients(app: App): CentralClient[] {
  ensureCentralSupportTables(app);
  return app.db.all<CentralClient>('SELECT instance_id, client_name, active, created_at, updated_at FROM central_support_clients ORDER BY created_at DESC');
}

export function verifyGatewaySignature(
  app: App,
  headers: Record<string, string | string[] | undefined>,
  rawBody: string,
): { valid: boolean; instance?: CentralClient; error?: string } {
  ensureCentralSupportTables(app);

  const getHeader = (name: string): string => {
    const val = headers[name.toLowerCase()] ?? headers[name];
    if (Array.isArray(val)) return val[0] || '';
    return typeof val === 'string' ? val : '';
  };

  const instanceId = getHeader('x-dwarapalak-instance-id');
  const signature = getHeader('x-dwarapalak-signature');
  const timestampStr = getHeader('x-dwarapalak-timestamp');
  const nonce = getHeader('x-dwarapalak-nonce');

  if (!instanceId || !signature || !timestampStr || !nonce) {
    return { valid: false, error: 'Missing security authentication headers' };
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    return { valid: false, error: 'Invalid timestamp header' };
  }

  const currentSeconds = Math.floor(Date.now() / 1000);
  // Enforce 300 second replay window
  if (Math.abs(currentSeconds - timestamp) > 300) {
    return { valid: false, error: 'Request timestamp expired or out of allowed window' };
  }

  // Check nonce replay
  const existingNonce = app.db.get('SELECT 1 FROM central_support_nonces WHERE nonce = ?', nonce);
  if (existingNonce) {
    return { valid: false, error: 'Replay attack detected: nonce already used' };
  }

  const client = getCentralClient(app, instanceId);
  if (!client) {
    return { valid: false, error: 'Unknown or inactive Dwarapalak client instance' };
  }

  // Verify HMAC-SHA256 signature
  const expectedSig = createHmac('sha256', client.secret_key)
    .update(`${timestamp}.${nonce}.${rawBody}`)
    .digest('hex');

  const sigBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSig, 'utf8');

  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, error: 'Invalid HMAC signature' };
  }

  // Save nonce
  app.db.run(
    'INSERT INTO central_support_nonces (nonce, instance_id, timestamp, created_at) VALUES (?, ?, ?, ?)',
    nonce,
    instanceId,
    timestamp,
    now(),
  );

  // Clean old nonces older than 10 minutes
  const cleanupCutoff = currentSeconds - 600;
  app.db.run('DELETE FROM central_support_nonces WHERE timestamp < ?', cleanupCutoff);

  return { valid: true, instance: client };
}

export function ingestCentralReport(app: App, instanceId: string, clientName: string, envelope: any): { id: string; status: string } {
  ensureCentralSupportTables(app);
  const action = envelope.action || 'create';
  const remoteFeedbackId = envelope.feedback_id;
  const payload = envelope.payload ?? {};

  const existing = app.db.get<CentralReport>(
    'SELECT * FROM central_support_reports WHERE instance_id = ? AND remote_feedback_id = ?',
    instanceId,
    remoteFeedbackId,
  );

  const ts = now();

  if (action === 'message' && existing) {
    let replies: any[] = [];
    try {
      replies = JSON.parse(existing.replies);
    } catch {
      replies = [];
    }

    replies.push({
      id: id(),
      body: payload.body || envelope.body || '',
      author: payload.author || clientName,
      at: payload.at || ts,
    });

    app.db.run(
      'UPDATE central_support_reports SET replies = ?, updated_at = ? WHERE id = ?',
      JSON.stringify(replies),
      ts,
      existing.id,
    );

    return { id: existing.id, status: existing.status };
  }

  if (existing) {
    // Already created, update details if provided
    app.db.run(
      `UPDATE central_support_reports
       SET title = ?, body = ?, diagnostics = ?, updated_at = ?
       WHERE id = ?`,
      payload.title || existing.title,
      payload.body || existing.body,
      typeof payload.diagnostics === 'string' ? payload.diagnostics : JSON.stringify(payload.diagnostics ?? {}),
      ts,
      existing.id,
    );
    return { id: existing.id, status: existing.status };
  }

  const reportId = id();
  app.db.run(
    `INSERT INTO central_support_reports (
      id, instance_id, remote_feedback_id, client_name, kind, title, body,
      expected, steps, severity, area, platform, diagnostics, status,
      public_notes, replies, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'neu', '', '[]', ?, ?)`,
    reportId,
    instanceId,
    remoteFeedbackId,
    clientName,
    payload.kind || 'bug',
    payload.title || 'Support-Anfrage',
    payload.body || '',
    payload.expected || '',
    payload.steps || '',
    payload.severity || '',
    payload.area || '',
    payload.platform || 'web',
    typeof payload.diagnostics === 'string' ? payload.diagnostics : JSON.stringify(payload.diagnostics ?? {}),
    ts,
    ts,
  );

  return { id: reportId, status: 'neu' };
}

export function getCentralUpdatesForInstance(app: App, instanceId: string, since?: string) {
  ensureCentralSupportTables(app);
  let rows: CentralReport[];
  if (since) {
    rows = app.db.all<CentralReport>(
      'SELECT * FROM central_support_reports WHERE instance_id = ? AND updated_at > ? ORDER BY updated_at ASC',
      instanceId,
      since,
    );
  } else {
    rows = app.db.all<CentralReport>(
      'SELECT * FROM central_support_reports WHERE instance_id = ? ORDER BY updated_at ASC',
      instanceId,
    );
  }

  return rows.map((r) => {
    let replies: any[] = [];
    try {
      replies = JSON.parse(r.replies);
    } catch {
      replies = [];
    }
    return {
      id: r.id,
      remote_feedback_id: r.remote_feedback_id,
      status: r.status,
      public_notes: r.public_notes,
      replies,
      updated_at: r.updated_at,
    };
  });
}

export function listCentralReports(
  app: App,
  filters: { instanceId?: string; status?: string; kind?: string; search?: string },
) {
  ensureCentralSupportTables(app);
  const where: string[] = [];
  const params: any[] = [];

  if (filters.instanceId) {
    where.push('instance_id = ?');
    params.push(filters.instanceId);
  }
  if (filters.status) {
    where.push('status = ?');
    params.push(filters.status);
  }
  if (filters.kind) {
    where.push('kind = ?');
    params.push(filters.kind);
  }
  if (filters.search) {
    where.push('(title LIKE ? OR body LIKE ? OR client_name LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }

  const query = `
    SELECT * FROM central_support_reports
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY created_at DESC LIMIT 500
  `;

  return app.db.all<CentralReport>(query, ...params);
}

export const listAllCentralReports = listCentralReports;

export function getCentralReport(app: App, reportId: string): CentralReport | undefined {
  ensureCentralSupportTables(app);
  return app.db.get<CentralReport>('SELECT * FROM central_support_reports WHERE id = ?', reportId);
}

export function updateCentralReport(
  app: App,
  reportId: string,
  update: { status?: string; publicNotes?: string; reply?: { author: string; body: string } },
): CentralReport | undefined {
  ensureCentralSupportTables(app);
  const rep = getCentralReport(app, reportId);
  if (!rep) return undefined;

  const ts = now();
  let replies: any[] = [];
  try {
    replies = JSON.parse(rep.replies);
  } catch {
    replies = [];
  }

  if (update.reply) {
    replies.push({
      id: id(),
      body: update.reply.body,
      author: update.reply.author || 'JITEN EDU Support Team',
      at: ts,
    });
  }

  const nextStatus = update.status ?? rep.status;
  const nextNotes = update.publicNotes ?? rep.public_notes;

  app.db.run(
    'UPDATE central_support_reports SET status = ?, public_notes = ?, replies = ?, updated_at = ? WHERE id = ?',
    nextStatus,
    nextNotes,
    JSON.stringify(replies),
    ts,
    reportId,
  );

  return getCentralReport(app, reportId);
}

