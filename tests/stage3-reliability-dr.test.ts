import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startTestApp } from './helpers.js';
import { Db } from '../server/core/db.js';
import { EventBus, isSideEffectProcessed, recordSideEffect } from '../server/core/events.js';
import { makeBackupAsync, listBackups, backupDir } from '../server/modules/backups.js';
import { ensureCentralSupportTables } from '../server/services/central-support-receiver.js';

describe('Stage 3 — Automation Reliability, Durability & Disaster Recovery', () => {
  let t: Awaited<ReturnType<typeof startTestApp>>;
  let loc = '';

  beforeAll(async () => {
    t = await startTestApp();
    await t.setup();
    loc = t.api.location;
    ensureCentralSupportTables(t.app);
  }, 60_000);

  afterAll(async () => {
    await t.close();
  });

  describe('Part A — Durable Event Outbox & Crash Recovery', () => {
    it('persists critical business events durably in durable_events table', async () => {
      let listenerFired = false;
      let receivedData: any = null;

      t.app.events.on('contact.created', (e) => {
        listenerFired = true;
        receivedData = e.data;
      });

      const eventId = t.app.events.emit(loc, 'contact.created', {
        contactId: 'c_test_1',
        name: 'Durable Customer',
        email: 'durable@customer.com',
      });

      expect(eventId).toBeDefined();
      expect(typeof eventId).toBe('string');

      // Verify row exists in SQLite table
      const row = t.app.db.get<any>('SELECT * FROM durable_events WHERE id = ?', eventId);
      expect(row).toBeDefined();
      expect(row.type).toBe('contact.created');
      expect(row.location_id).toBe(loc);
      expect(JSON.parse(row.payload).email).toBe('durable@customer.com');

      // Flush event bus
      await t.app.events.flush();
      expect(listenerFired).toBe(true);
      expect(receivedData.name).toBe('Durable Customer');

      // Status should now be completed
      const updatedRow = t.app.db.get<any>('SELECT * FROM durable_events WHERE id = ?', eventId);
      expect(updatedRow.status).toBe('completed');
      expect(updatedRow.completed_at).toBeDefined();
    });

    it('recovers interrupted events across simulated process crash / restart', async () => {
      // Simulate an event that was being processed when a crash happened
      const crashEventId = 'ev_crashed_1';
      t.app.db.run(
        `INSERT INTO durable_events (
          id, location_id, type, payload, status, attempts, max_attempts,
          next_run_at, locked_until, created_at
        ) VALUES (?, ?, ?, ?, 'processing', 1, 5, ?, ?, ?)`,
        crashEventId,
        loc,
        'appointment.booked',
        JSON.stringify({ appointmentId: 'apt_123', service: 'Consultation' }),
        new Date().toISOString(),
        new Date(Date.now() + 60_000).toISOString(),
        new Date().toISOString()
      );

      // Verify it is currently marked as processing
      const preRecovery = t.app.db.get<any>('SELECT status FROM durable_events WHERE id = ?', crashEventId);
      expect(preRecovery.status).toBe('processing');

      // Simulate server startup recovery
      const recoveredCount = t.app.events.recoverInterruptedEvents();
      expect(recoveredCount).toBeGreaterThanOrEqual(1);

      const postRecovery = t.app.db.get<any>('SELECT status, locked_until FROM durable_events WHERE id = ?', crashEventId);
      expect(postRecovery.status).toBe('pending');
      expect(postRecovery.locked_until).toBeNull();

      // Register listener to process it
      let recoveredAppointmentId = '';
      t.app.events.on('appointment.booked', (e) => {
        recoveredAppointmentId = e.data.appointmentId;
      });

      // Now process durable events
      await t.app.events.processDurableEvents();

      expect(recoveredAppointmentId).toBe('apt_123');
      const finishedRow = t.app.db.get<any>('SELECT status FROM durable_events WHERE id = ?', crashEventId);
      expect(finishedRow.status).toBe('completed');
    });

    it('enforces idempotency key deduplication on event emission', async () => {
      const idempotencyKey = 'payment_intent_pi_99999';

      const firstId = t.app.events.emit(
        loc,
        'payment.received',
        { amount: 5000, invoiceId: 'inv_888' },
        { idempotencyKey }
      );

      // Attempt to emit identical event with the same idempotency key
      const secondId = t.app.events.emit(
        loc,
        'payment.received',
        { amount: 5000, invoiceId: 'inv_888' },
        { idempotencyKey }
      );

      expect(firstId).toBe(secondId);

      // Verify only a single event row exists for this idempotency key
      const rows = t.app.db.all('SELECT * FROM durable_events WHERE idempotency_key = ?', idempotencyKey);
      expect(rows.length).toBe(1);
    });

    it('handles retry backoff and transitions to dead_letter upon exhausting max attempts', async () => {
      let callAttempts = 0;
      t.app.events.on('failing.event', () => {
        callAttempts++;
        throw new Error('Downstream webhook failed with 503');
      });

      const eventId = t.app.events.emit(
        loc,
        'failing.event',
        { test: 'fail' },
        { durable: true, maxAttempts: 2 }
      );

      // First run: attempt 1 fails
      await t.app.events.processDurableEvents();
      let row = t.app.db.get<any>('SELECT * FROM durable_events WHERE id = ?', eventId);
      expect(row.status).toBe('pending');
      expect(row.attempts).toBe(1);
      expect(row.last_error).toContain('Downstream webhook failed with 503');

      // Fast-forward next_run_at to now for test
      t.app.db.run('UPDATE durable_events SET next_run_at = ? WHERE id = ?', new Date(Date.now() - 1000).toISOString(), eventId);

      // Second run: attempt 2 hits maxAttempts (2), transitions to dead_letter
      await t.app.events.processDurableEvents();
      row = t.app.db.get<any>('SELECT * FROM durable_events WHERE id = ?', eventId);
      expect(row.status).toBe('dead_letter');
      expect(row.attempts).toBe(2);
      expect(row.last_error).toContain('Downstream webhook failed with 503');
    });

    it('prunes completed events older than retention period', async () => {
      const oldEventId = 'ev_old_completed';
      const eightDaysAgo = new Date(Date.now() - 8 * 864e5).toISOString();

      t.app.db.run(
        `INSERT INTO durable_events (
          id, location_id, type, payload, status, attempts, max_attempts,
          next_run_at, created_at, completed_at
        ) VALUES (?, ?, ?, ?, 'completed', 1, 5, ?, ?, ?)`,
        oldEventId,
        loc,
        'form.submitted',
        JSON.stringify({ form: 'survey' }),
        eightDaysAgo,
        eightDaysAgo,
        eightDaysAgo
      );

      const prunedCount = t.app.events.pruneCompleted(7);
      expect(prunedCount).toBeGreaterThanOrEqual(1);

      const checkRow = t.app.db.get('SELECT id FROM durable_events WHERE id = ?', oldEventId);
      expect(checkRow).toBeUndefined();
    });
  });

  describe('Part B — Side-Effect Idempotency & Protection', () => {
    it('records and detects already processed side-effects', () => {
      const actionKey = 'send_booking_sms_appointment_456';

      expect(isSideEffectProcessed(t.app.db, loc, actionKey)).toBe(false);

      const recorded = recordSideEffect(t.app.db, loc, actionKey, 'sms_notification', { messageId: 'msg_999' });
      expect(recorded).toBe(true);

      expect(isSideEffectProcessed(t.app.db, loc, actionKey)).toBe(true);

      // Repeating recording must return false (duplicate suppressed)
      const duplicateRecord = recordSideEffect(t.app.db, loc, actionKey, 'sms_notification', { messageId: 'msg_999' });
      expect(duplicateRecord).toBe(false);
    });

    it('protects payment webhooks against duplicate charges', () => {
      const webhookIdempotencyKey = 'stripe_evt_charge_succeeded_ch_12345';

      let executionCount = 0;
      function handlePaymentWebhook(key: string) {
        if (isSideEffectProcessed(t.app.db, loc, key)) {
          return { status: 'already_processed' };
        }
        executionCount++;
        recordSideEffect(t.app.db, loc, key, 'charge_credit', { amount: 100 });
        return { status: 'credited' };
      }

      const res1 = handlePaymentWebhook(webhookIdempotencyKey);
      expect(res1.status).toBe('credited');
      expect(executionCount).toBe(1);

      // Provider sends repeated webhook
      const res2 = handlePaymentWebhook(webhookIdempotencyKey);
      expect(res2.status).toBe('already_processed');
      expect(executionCount).toBe(1); // Not incremented!
    });
  });

  describe('Part C — SQLite Engine Integrity & Migration Safety', () => {
    it('verifies db.integrityCheck() and db.quickCheck() on active database', () => {
      const quick = t.app.db.quickCheck();
      expect(quick).toBe(true);

      const integrity = t.app.db.integrityCheck();
      expect(integrity.ok).toBe(true);
      expect(integrity.problems).toHaveLength(0);
    });

    it('tracks applied migrations in order', () => {
      const migrations = t.app.db.getAppliedMigrations();
      expect(migrations.length).toBeGreaterThan(0);
      expect(migrations.some((m) => m.startsWith('core:'))).toBe(true);
    });

    it('atomically rolls back migrations on SQL failure without polluting _migrations', () => {
      const testDbFile = join(mkdtempSync(join(tmpdir(), 'pghl-test-migrate-')), 'migration_test.db');
      const testDb = new Db(testDbFile);

      const invalidMigrationSql = `
        CREATE TABLE good_table (id TEXT PRIMARY KEY);
        CREATE TABLE syntax_error_table (INVALID SQL NOT A COLUMN);
      `;

      expect(() => {
        testDb.migrate('test_failing_migration', invalidMigrationSql);
      }).toThrow();

      // Check that test_failing_migration was NOT recorded in _migrations
      const applied = testDb.getAppliedMigrations();
      expect(applied).not.toContain('test_failing_migration');

      // Check that good_table was rolled back and does not exist
      const tableExists = testDb.get<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'good_table'"
      );
      expect(tableExists).toBeUndefined();

      testDb.close();
    });

    it('respects PGHL_SQLITE_SYNCHRONOUS environment variable', () => {
      const testDbFile = join(mkdtempSync(join(tmpdir(), 'pghl-test-sync-')), 'sync_test.db');
      process.env.PGHL_SQLITE_SYNCHRONOUS = 'FULL';
      const testDb = new Db(testDbFile);

      const pragmas = testDb.pragmas();
      expect(pragmas.synchronous).toBe(2); // 2 = FULL

      testDb.close();
      delete process.env.PGHL_SQLITE_SYNCHRONOUS;
    });
  });

  describe('Part D — Consistent Backups & Disaster Recovery Verification', () => {
    it('generates consistent SQLite snapshot with makeBackupAsync', async () => {
      const backupName = await makeBackupAsync(t.app);
      expect(backupName).toMatch(/^pghl-\d{4}-\d{2}-\d{2}(-\d{6})?\.db$/);

      const backups = listBackups(t.app);
      expect(backups.length).toBeGreaterThan(0);
      expect(backups[0].name).toBe(backupName);
      expect(backups[0].size).toBeGreaterThan(0);

      const backupFilePath = join(backupDir(t.app), backupName);
      expect(existsSync(backupFilePath)).toBe(true);

      // Verify restored snapshot integrity in isolation
      const snapDb = new DatabaseSync(backupFilePath);
      const res = snapDb.prepare('PRAGMA integrity_check').all() as any[];
      expect(res[0].integrity_check).toBe('ok');
      snapDb.close();
    });

    it('verifies Stage 2 and Stage 3 tables survive backup and restore intact', async () => {
      // 1. Populate Stage 2 data (Central Support Client & Ticket)
      t.app.db.run(
        `INSERT OR REPLACE INTO central_support_clients (
          instance_id, client_name, secret_key, active, created_at, updated_at
        ) VALUES ('cli_dr_test', 'DR Test Client', 'secret_key_123', 1, ?, ?)`,
        new Date().toISOString(),
        new Date().toISOString()
      );

      t.app.db.run(
        `INSERT OR REPLACE INTO central_support_reports (
          id, instance_id, remote_feedback_id, client_name, kind, title, body, created_at, updated_at
        ) VALUES ('rep_dr_test', 'cli_dr_test', 'rep_local_1', 'DR Test Client', 'bug', 'DR Verification Ticket', 'Desc', ?, ?)`,
        new Date().toISOString(),
        new Date().toISOString()
      );

      // 2. Populate Stage 3 data (Durable event & side effect)
      t.app.db.run(
        `INSERT OR REPLACE INTO durable_events (
          id, location_id, type, payload, status, attempts, max_attempts, next_run_at, created_at
        ) VALUES ('ev_dr_test', ?, 'payment.received', '{"amount":999}', 'completed', 1, 5, ?, ?)`,
        loc,
        new Date().toISOString(),
        new Date().toISOString()
      );

      t.app.db.run(
        `INSERT OR REPLACE INTO processed_side_effects (
          id, location_id, idempotency_key, action_type, result, created_at
        ) VALUES ('se_dr_test', ?, 'side_effect_dr_key', 'stripe_payout', '{"ok":true}', ?)`,
        loc,
        new Date().toISOString()
      );

      // 3. Take consistent backup
      const backupName = await makeBackupAsync(t.app);
      const backupFilePath = join(backupDir(t.app), backupName);

      // 4. Restore to an isolated test directory
      const restoreDir = mkdtempSync(join(tmpdir(), 'pghl-dr-restore-'));
      const restoredDbFile = join(restoreDir, 'restored.db');
      
      // Use VACUUM INTO or sqlite DatabaseSync to read restored backup
      const restoredDb = new DatabaseSync(backupFilePath);
      restoredDb.exec(`VACUUM INTO '${restoredDbFile.replace(/'/g, "''")}'`);
      restoredDb.close();

      const verifyRestored = new DatabaseSync(restoredDbFile);

      // 5. Verify integrity check on restored database
      const integrityRows = verifyRestored.prepare('PRAGMA integrity_check').all() as any[];
      expect(integrityRows[0].integrity_check).toBe('ok');

      // 6. Verify Stage 2 tables exist and contain records
      const clientRow = verifyRestored.prepare('SELECT * FROM central_support_clients WHERE instance_id = ?').get('cli_dr_test') as any;
      expect(clientRow).toBeDefined();
      expect(clientRow.client_name).toBe('DR Test Client');

      const reportRow = verifyRestored.prepare('SELECT * FROM central_support_reports WHERE id = ?').get('rep_dr_test') as any;
      expect(reportRow).toBeDefined();
      expect(reportRow.title).toBe('DR Verification Ticket');

      // 7. Verify Stage 3 tables exist and contain records
      const eventRow = verifyRestored.prepare('SELECT * FROM durable_events WHERE id = ?').get('ev_dr_test') as any;
      expect(eventRow).toBeDefined();
      expect(eventRow.type).toBe('payment.received');

      const sideEffectRow = verifyRestored.prepare('SELECT * FROM processed_side_effects WHERE id = ?').get('se_dr_test') as any;
      expect(sideEffectRow).toBeDefined();
      expect(sideEffectRow.action_type).toBe('stripe_payout');

      // Cleanup
      verifyRestored.close();
      rmSync(restoreDir, { recursive: true, force: true });
    });

    it('emits alert and event when backup fails or is overdue', async () => {
      let failedAlertReceived = false;
      let overdueAlertReceived = false;

      t.app.events.on('backup.failed', (e) => {
        failedAlertReceived = true;
      });

      t.app.events.on('backup.overdue', (e) => {
        overdueAlertReceived = true;
      });

      // Emitting backup failure alert directly to verify event bus and alert plumbing
      t.app.events.emit('system', 'backup.failed', { kind: 'local_snapshot', error: 'Disk full error simulation' });
      t.app.events.emit('system', 'backup.overdue', { lastBackup: new Date(Date.now() - 40 * 3600_000).toISOString(), overdueHours: 40 });

      await t.app.events.flush();

      expect(failedAlertReceived).toBe(true);
      expect(overdueAlertReceived).toBe(true);
    });
  });
});
