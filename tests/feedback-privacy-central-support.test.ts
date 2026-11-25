import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHmac, randomBytes } from 'node:crypto';
import { startTestApp } from './helpers.js';
import { cleanUrl, redact } from '../server/services/feedback.js';
import {
  enqueueSupportReport,
  flushSupportOutbox,
  getSupportSyncConfig,
  isSupportSyncEnabled,
  signSupportPayload,
  syncSupportUpdates,
} from '../server/services/central-support-client.js';
import {
  getCentralUpdatesForInstance,
  listAllCentralReports,
  registerCentralClient,
  updateCentralReport,
  verifyGatewaySignature,
} from '../server/services/central-support-receiver.js';

let t: Awaited<ReturnType<typeof startTestApp>>;
let adminId = '';
let homeLoc = '';
let kundeLoc = '';
let otherLoc = '';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function login(email: string, password: string) {
  t.api.clearCookie();
  const r = await t.api.post('/api/auth/login', { email, password });
  expect(r.status, JSON.stringify(r.data)).toBe(200);
}
const asAdmin = () => login('chef@example.com', 'geheim123');
const asMia = () => login('mia@kunde.de', 'mia12345');
const asLisa = () => login('lisa@andere.de', 'lisa12345');

beforeAll(async () => {
  t = await startTestApp();
  const me = await t.setup();
  adminId = me.user.id;
  homeLoc = t.api.location;
  kundeLoc = (await t.api.post('/api/locations', { name: 'Kunde A' })).data.id;
  otherLoc = (await t.api.post('/api/locations', { name: 'Kunde B' })).data.id;

  expect((await t.api.post('/api/users', { email: 'mia@kunde.de', name: 'Mia Kunde', password: 'mia12345', role: 'member', locations: [kundeLoc], permissions: ['contacts'] })).status).toBe(200);
  expect((await t.api.post('/api/users', { email: 'lisa@andere.de', name: 'Lisa Andere', password: 'lisa12345', role: 'member', locations: [otherLoc], permissions: ['contacts'] })).status).toBe(200);
});

afterAll(async () => {
  await t.close();
});

describe('Feedback Privacy & Sensitive Data Redaction', () => {
  it('redacts session cookies, connection URIs, private keys and auth headers', () => {
    const raw = `
      Error connecting to postgres://app_user:s3cr3tP@ss@db.internal:5432/production_db
      Cookie: connect.sid=s%3Aabcdef123456.signature; pghl_session=sess_9876543210
      Authorization: Basic dXNlcjpwYXNzd29yZA==
      Bearer token: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDN-xxxx
      ${'-----BEGIN '}RSA PRIVATE KEY----- // oss-check: allow
      MIIEowIBAAKCAQEA0Y1+xyz123...
      -----END RSA PRIVATE KEY-----
    `;

    const sanitized = redact(raw);

    expect(sanitized).not.toContain('postgres://app_user:s3cr3tP@ss@db.internal:5432/production_db');
    expect(sanitized).toContain('[Verbindungs-URI entfernt]');

    expect(sanitized).not.toContain('connect.sid=s%3Aabcdef123456.signature');
    expect(sanitized).not.toContain('pghl_session=sess_9876543210');
    expect(sanitized).toContain('[Cookie entfernt]');

    expect(sanitized).not.toContain('dXNlcjpwYXNzd29yZA==');
    expect(sanitized).toContain('[Auth-Header entfernt]');

    expect(sanitized).not.toContain('MIIEowIBAAKCAQEA0Y1+xyz123');
    expect(sanitized).toContain('[Privater Schlüssel entfernt]');
  });

  it('cleanUrl removes sensitive parameters from query and hash', () => {
    const url = 'https://app.dwarapalak.io/dashboard?token=xyz123&session=sess456&email=user@test.de&password=secret#access_token=token789';
    const cleaned = cleanUrl(url);

    expect(cleaned).not.toContain('xyz123');
    expect(cleaned).not.toContain('sess456');
    expect(cleaned).not.toContain('user@test.de');
    expect(cleaned).not.toContain('secret');
    expect(cleaned).not.toContain('token789');
  });

  it('screenshot files are strictly restricted to admin and linked reporter', async () => {
    await asMia();
    const res = await t.api.post('/api/feedback/reports', {
      category: 'bug',
      what: 'Vertraulicher Fehler mit Screenshot',
      screenshot: PNG,
    });
    expect(res.status).toBe(200);
    const reportId = res.data.id;

    const fileRow = t.app.db.get<{ id: string }>('SELECT id FROM feedback_files WHERE feedback_id = ?', reportId);
    expect(fileRow).toBeDefined();
    const fileId = fileRow!.id;

    // Mia (reporter) CAN download her file
    const miaGet = await t.api.get(`/api/feedback/files/${fileId}`);
    expect(miaGet.status).toBe(200);

    // Lisa (unrelated client user) CANNOT download Mia's file -> 404
    await asLisa();
    const lisaGet = await t.api.get(`/api/feedback/files/${fileId}`);
    expect(lisaGet.status).toBe(404);

    // Admin CAN download the file
    await asAdmin();
    const adminGet = await t.api.get(`/api/feedback/files/${fileId}`);
    expect(adminGet.status).toBe(200);
  });

  it('respects explicit consent_diagnostics=false and consent_screenshot=false', async () => {
    await asMia();

    // Case 1: consent_diagnostics = false -> diagnostics are minimized and flagged consent: false
    const r1 = await t.api.post('/api/feedback/reports', {
      category: 'bug',
      what: 'Fehler ohne Diagnosedaten',
      consent_diagnostics: false,
      diagnostics: { user_agent: 'SecretBrowser/1.0', url: 'https://secret.com/page' },
    });
    expect(r1.status).toBe(200);
    const item1 = (await t.api.get(`/api/feedback/reports/${r1.data.id}`)).data;
    expect(item1.diagnostics.consent).toBe(false);
    expect(item1.diagnostics.removed).toBe(true);
    expect(item1.diagnostics.user_agent).toBeUndefined();
    expect(item1.diagnostics.url).toBeUndefined();

    // Case 2: consent_screenshot = false -> screenshot is NOT saved even if data URL passed
    const r2 = await t.api.post('/api/feedback/reports', {
      category: 'bug',
      what: 'Fehler ohne Screenshot-Zustimmung',
      screenshot: PNG,
      consent_screenshot: false,
    });
    expect(r2.status).toBe(200);
    const files = t.app.db.all('SELECT id FROM feedback_files WHERE feedback_id = ?', r2.data.id);
    expect(files).toHaveLength(0);
  });
});

describe('Central Support System for JITEN EDU TECHNOLOGIES', () => {
  const instanceId = 'dwarapalak-vps-test-01';
  const clientName = 'Test Client Agency VPS';
  const secretKey = 'super-secret-hmac-key-for-testing';

  beforeAll(() => {
    registerCentralClient(t.app, { instanceId, clientName, secretKey });
  });

  it('central support sync is disabled by default', () => {
    delete process.env.DWARAPALAK_SUPPORT_SYNC_ENABLED;
    delete process.env.DWARAPALAK_SUPPORT_ENDPOINT;
    t.app.db.run('DELETE FROM agency_settings WHERE key = ?', 'dwarapalak_central_support');

    expect(isSupportSyncEnabled(t.app)).toBe(false);

    // Enqueueing does nothing when disabled
    enqueueSupportReport(t.app, 'test-id-1', 'create', { title: 'Test' });
    const count = (t.app.db.get<{ n: number }>('SELECT COUNT(*) as n FROM support_sync_outbox') || { n: 0 }).n;
    expect(count).toBe(0);
  });

  it('rejects gateway requests with missing or invalid HMAC signatures', async () => {
    const rawBody = JSON.stringify({ action: 'create', feedback_id: 'fb-100', payload: { title: 'Test' } });
    const ts = Math.floor(Date.now() / 1000);
    const nonce = 'nonce-invalid-test';

    // Missing headers
    const badReq1 = verifyGatewaySignature(t.app, {}, rawBody);
    expect(badReq1.valid).toBe(false);

    // Invalid signature
    const badReq2 = verifyGatewaySignature(t.app, {
      'x-dwarapalak-instance-id': instanceId,
      'x-dwarapalak-signature': '0000000000000000000000000000000000000000000000000000000000000000',
      'x-dwarapalak-timestamp': String(ts),
      'x-dwarapalak-nonce': nonce,
    }, rawBody);
    expect(badReq2.valid).toBe(false);
    expect(badReq2.error).toContain('Invalid HMAC signature');

    // Expired timestamp (> 300 seconds ago)
    const oldTs = ts - 400;
    const oldSig = signSupportPayload(secretKey, oldTs, nonce, rawBody);
    const badReq3 = verifyGatewaySignature(t.app, {
      'x-dwarapalak-instance-id': instanceId,
      'x-dwarapalak-signature': oldSig,
      'x-dwarapalak-timestamp': String(oldTs),
      'x-dwarapalak-nonce': nonce,
    }, rawBody);
    expect(badReq3.valid).toBe(false);
    expect(badReq3.error).toContain('expired');
  });

  it('accepts valid gateway requests and prevents replay attacks with nonces', async () => {
    const rawBody = JSON.stringify({
      action: 'create',
      feedback_id: 'fb-remote-123',
      payload: { title: 'Dwarapalak Bug Report', body: 'App crashes on checkout', severity: 'hoch' },
    });
    const ts = Math.floor(Date.now() / 1000);
    const nonce = randomBytes(16).toString('hex');
    const signature = signSupportPayload(secretKey, ts, nonce, rawBody);

    const headers = {
      'x-dwarapalak-instance-id': instanceId,
      'x-dwarapalak-signature': signature,
      'x-dwarapalak-timestamp': String(ts),
      'x-dwarapalak-nonce': nonce,
    };

    // First attempt: valid
    const validReq = verifyGatewaySignature(t.app, headers, rawBody);
    expect(validReq.valid).toBe(true);
    expect(validReq.instance?.client_name).toBe(clientName);

    // Second attempt with exact same nonce: replay attack rejected
    const replayReq = verifyGatewaySignature(t.app, headers, rawBody);
    expect(replayReq.valid).toBe(false);
    expect(replayReq.error).toContain('Replay attack');
  });

  it('ingests reports into central system and enforces multi-tenant isolation', async () => {
    const instA = 'instance-alpha';
    const instB = 'instance-beta';
    const keyA = 'key-alpha';
    const keyB = 'key-beta';

    registerCentralClient(t.app, { instanceId: instA, clientName: 'Alpha Client', secretKey: keyA });
    registerCentralClient(t.app, { instanceId: instB, clientName: 'Beta Client', secretKey: keyB });

    const sendToGateway = async (inst: string, key: string, payload: any) => {
      const rawBody = JSON.stringify(payload);
      const ts = Math.floor(Date.now() / 1000);
      const nonce = randomBytes(16).toString('hex');
      const sig = signSupportPayload(key, ts, nonce, rawBody);

      return t.api.raw('/api/support/gateway/ingest', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-dwarapalak-instance-id': inst,
          'x-dwarapalak-signature': sig,
          'x-dwarapalak-timestamp': String(ts),
          'x-dwarapalak-nonce': nonce,
        },
        body: rawBody,
      });
    };

    // Alpha reports a bug
    const rA = await sendToGateway(instA, keyA, {
      action: 'create',
      feedback_id: 'fb-alpha-001',
      payload: { title: 'Alpha Bug', body: 'Alpha details', severity: 'kritisch' },
    });
    expect(rA.status).toBe(200);

    // Beta reports a bug
    const rB = await sendToGateway(instB, keyB, {
      action: 'create',
      feedback_id: 'fb-beta-001',
      payload: { title: 'Beta Bug', body: 'Beta details', severity: 'gering' },
    });
    expect(rB.status).toBe(200);

    // Strict Tenant Isolation: Alpha can only sync its own updates
    const updatesA = getCentralUpdatesForInstance(t.app, instA);
    expect(updatesA.map((u) => u.remote_feedback_id)).toContain('fb-alpha-001');
    expect(updatesA.map((u) => u.remote_feedback_id)).not.toContain('fb-beta-001');

    // Strict Tenant Isolation: Beta can only sync its own updates
    const updatesB = getCentralUpdatesForInstance(t.app, instB);
    expect(updatesB.map((u) => u.remote_feedback_id)).toContain('fb-beta-001');
    expect(updatesB.map((u) => u.remote_feedback_id)).not.toContain('fb-alpha-001');

    // Agency admin sees both on the central dashboard
    await asAdmin();
    const centralReports = listAllCentralReports(t.app, {});
    expect(centralReports.map((c) => c.remote_feedback_id)).toContain('fb-alpha-001');
    expect(centralReports.map((c) => c.remote_feedback_id)).toContain('fb-beta-001');
  });

  it('outbox queue retries with exponential backoff if gateway is offline without crashing', async () => {
    // Configure sync to a simulated failing endpoint
    t.app.db.run(
      'INSERT OR REPLACE INTO agency_settings (key, value) VALUES (?, ?)',
      'dwarapalak_central_support',
      JSON.stringify({
        enabled: true,
        endpoint: 'https://fake-offline-gateway.local/api/support/gateway',
        instanceId: 'test-offline-inst',
        secretKey: 'fake-key',
        clientName: 'Offline Test VPS',
      }),
    );

    expect(isSupportSyncEnabled(t.app)).toBe(true);

    // Enqueue an item
    enqueueSupportReport(t.app, 'fb-offline-1', 'create', { title: 'Offline Test Report' });

    const mockFailingFetch = async () => {
      throw new Error('Connection refused (gateway offline)');
    };

    // Flush outbox
    const result = await flushSupportOutbox(t.app, mockFailingFetch as any);
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);

    // Item must remain in outbox with attempts = 1 and exponential backoff
    const outboxRow = t.app.db.get<any>('SELECT * FROM support_sync_outbox WHERE feedback_id = ?', 'fb-offline-1');
    expect(outboxRow).toBeDefined();
    expect(outboxRow.attempts).toBe(1);
    expect(outboxRow.last_error).toContain('Connection refused');
    expect(outboxRow.next_retry_at).toBeDefined();

    // Clean up agency setting
    t.app.db.run('DELETE FROM agency_settings WHERE key = ?', 'dwarapalak_central_support');
  });

  it('supports agency replying and updating status with bidirectional sync', async () => {
    const instId = 'instance-sync-test';
    const sKey = 'key-sync-test';
    registerCentralClient(t.app, { instanceId: instId, clientName: 'Sync Test Client', secretKey: sKey });

    // Client creates a local feedback item
    await asMia();
    const fbRes = await t.api.post('/api/feedback/reports', {
      category: 'bug',
      what: 'Sync Test Bug Title',
      severity: 'hoch',
    });
    expect(fbRes.status).toBe(200);
    const localFbId = fbRes.data.id;

    // Simulate sending to central gateway
    const centralRes = await t.api.raw('/api/support/gateway/ingest', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-dwarapalak-instance-id': instId,
        'x-dwarapalak-signature': signSupportPayload(sKey, Math.floor(Date.now() / 1000), 'nonce-1', JSON.stringify({
          action: 'create',
          feedback_id: localFbId,
          payload: { title: 'Sync Test Bug Title', body: 'Sync Test Bug Details' },
        })),
        'x-dwarapalak-timestamp': String(Math.floor(Date.now() / 1000)),
        'x-dwarapalak-nonce': 'nonce-1',
      },
      body: JSON.stringify({
        action: 'create',
        feedback_id: localFbId,
        payload: { title: 'Sync Test Bug Title', body: 'Sync Test Bug Details' },
      }),
    });
    expect(centralRes.status).toBe(200);
    const centralReportId = (await centralRes.json()).id;

    // JITEN EDU TECHNOLOGIES agency staff updates status and adds team reply on central system
    updateCentralReport(t.app, centralReportId, {
      status: 'in_arbeit',
      publicNotes: 'Wir untersuchen das Problem aktiv.',
      reply: { author: 'JITEN Lead Engineer', body: 'Das Problem wurde reproduziert und wird im nächsten Release behoben.' },
    });

    // Configure local sync
    t.app.db.run(
      'INSERT OR REPLACE INTO agency_settings (key, value) VALUES (?, ?)',
      'dwarapalak_central_support',
      JSON.stringify({
        enabled: true,
        endpoint: 'http://localhost/api/support/gateway',
        instanceId: instId,
        secretKey: sKey,
        clientName: 'Sync Test Client',
      }),
    );

    // Mock fetch that calls local central receiver directly
    const mockSyncFetch = async () => {
      const updates = getCentralUpdatesForInstance(t.app, instId);
      return {
        ok: true,
        json: async () => ({ reports: updates }),
      };
    };

    // Client syncs updates
    const syncRes = await syncSupportUpdates(t.app, mockSyncFetch as any);
    expect(syncRes.synced).toBeGreaterThan(0);

    // Verify local feedback item updated with public note and ticket timeline has team reply
    const updatedLocal = t.app.db.get<any>('SELECT * FROM feedback_items WHERE id = ?', localFbId);
    expect(updatedLocal.public_note).toBe('Wir untersuchen das Problem aktiv.');

    const events = t.app.db.all<any>('SELECT * FROM ticket_events WHERE ticket_id = ?', updatedLocal.ticket_id);
    expect(events.some((e) => e.body.includes('reproduziert und wird im nächsten Release behoben'))).toBe(true);

    // Clean up
    t.app.db.run('DELETE FROM agency_settings WHERE key = ?', 'dwarapalak_central_support');
  });
});

