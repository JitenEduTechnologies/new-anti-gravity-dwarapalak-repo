import type { App, Module } from '../core/app.js';
import { bad, notFound, type Ctx } from '../core/http.js';
import {
  flushSupportOutbox,
  getSupportSyncConfig,
  isSupportSyncEnabled,
  syncSupportUpdates,
} from '../services/central-support-client.js';
import {
  ensureCentralSupportTables,
  getCentralReport,
  getCentralUpdatesForInstance,
  ingestCentralReport,
  listAllCentralReports,
  listCentralClients,
  registerCentralClient,
  updateCentralReport,
  verifyGatewaySignature,
} from '../services/central-support-receiver.js';

export const centralSupportGatewayModule: Module = {
  name: 'central-support-gateway',
  migrations: [
    [
      '001-init',
      `
      -- Tables are also ensured on demand by central-support-receiver
      CREATE TABLE IF NOT EXISTS central_support_clients (
        instance_id TEXT PRIMARY KEY,
        client_name TEXT NOT NULL,
        secret_key TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
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
      CREATE INDEX IF NOT EXISTS central_reports_instance ON central_support_reports(instance_id, status);
      CREATE TABLE IF NOT EXISTS central_support_nonces (
        nonce TEXT PRIMARY KEY,
        instance_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS central_nonces_ts ON central_support_nonces(timestamp);
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
      CREATE INDEX IF NOT EXISTS support_sync_outbox_retry ON support_sync_outbox(attempts, next_retry_at);
      `,
    ],
  ],
  register(app: App) {
    const { router } = app;
    ensureCentralSupportTables(app);

    // --- Public gateway ingest endpoint (HMAC authenticated) ---
    router.post('/api/support/gateway/ingest', 'public', async (ctx: Ctx) => {
      const rawBody = (ctx.req as any).rawBody ?? JSON.stringify(ctx.body ?? {});
      const auth = verifyGatewaySignature(app, ctx.req.headers, rawBody);
      if (!auth.valid || !auth.instance) {
        throw bad(auth.error || 'Authentication failed');
      }

      const envelope = typeof ctx.body === 'object' ? ctx.body : JSON.parse(rawBody || '{}');
      const res = ingestCentralReport(app, auth.instance.instance_id, auth.instance.client_name, envelope);
      return { ok: true, id: res.id, status: res.status };
    });

    // --- Public gateway sync endpoint (HMAC authenticated, strict tenant isolation) ---
    router.get('/api/support/gateway/sync', 'public', async (ctx: Ctx) => {
      const auth = verifyGatewaySignature(app, ctx.req.headers, '');
      if (!auth.valid || !auth.instance) {
        throw bad(auth.error || 'Authentication failed');
      }

      const since = ctx.query.get('since') || undefined;
      const reports = getCentralUpdatesForInstance(app, auth.instance.instance_id, since);
      return { ok: true, reports };
    });

    // --- Agency central dashboard endpoints (admin only) ---
    router.get('/api/support/central/reports', 'admin', async (ctx: Ctx) => {
      const instanceId = ctx.query.get('instance_id') || undefined;
      const status = ctx.query.get('status') || undefined;
      const kind = ctx.query.get('kind') || undefined;
      const search = ctx.query.get('q') || undefined;

      const reports = listAllCentralReports(app, { instanceId, status, kind, search });
      return { reports };
    });

    router.get('/api/support/central/reports/:id', 'admin', async (ctx: Ctx) => {
      const report = getCentralReport(app, ctx.params.id);
      if (!report) throw notFound('Report not found');
      let replies = [];
      let diag = {};
      try {
        replies = JSON.parse(report.replies);
      } catch {
        replies = [];
      }
      try {
        diag = JSON.parse(report.diagnostics);
      } catch {
        diag = {};
      }
      return { ...report, replies, diagnostics: diag };
    });

    router.patch('/api/support/central/reports/:id', 'admin', async (ctx: Ctx) => {
      const b = ctx.body ?? {};
      const report = getCentralReport(app, ctx.params.id);
      if (!report) throw notFound('Report not found');

      const updated = updateCentralReport(app, ctx.params.id, {
        status: b.status,
        publicNotes: b.public_notes,
        reply: b.reply ? { author: ctx.user!.name || 'JITEN Support Team', body: String(b.reply) } : undefined,
      });

      return { ok: true, report: updated };
    });

    router.post('/api/support/central/clients', 'admin', async (ctx: Ctx) => {
      const b = ctx.body ?? {};
      if (!b.instance_id || !b.client_name) {
        throw bad('instance_id and client_name are required');
      }
      const client = registerCentralClient(app, {
        instanceId: String(b.instance_id),
        clientName: String(b.client_name),
        secretKey: b.secret_key ? String(b.secret_key) : undefined,
      });
      return { ok: true, client };
    });

    router.get('/api/support/central/clients', 'admin', async () => {
      const clients = listCentralClients(app);
      return { clients };
    });

    // --- Client VPS sync control endpoints (admin only) ---
    router.get('/api/support/client/status', 'admin', async () => {
      const cfg = getSupportSyncConfig(app);
      const pendingRow = app.db.get<{ n: number }>('SELECT COUNT(*) as n FROM support_sync_outbox');
      return {
        sync_enabled: isSupportSyncEnabled(app),
        config: {
          enabled: cfg.enabled,
          endpoint: cfg.endpoint ? cfg.endpoint.replace(/:[^:@]+@/, ':***@') : '',
          instance_id: cfg.instanceId,
          client_name: cfg.clientName,
          has_key: Boolean(cfg.secretKey),
        },
        outbox_pending: pendingRow?.n ?? 0,
      };
    });

    router.post('/api/support/client/flush', 'admin', async () => {
      const res = await flushSupportOutbox(app);
      return { ok: true, ...res };
    });

    router.post('/api/support/client/sync', 'admin', async () => {
      const res = await syncSupportUpdates(app);
      return { ok: true, ...res };
    });
  },
};

