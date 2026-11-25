import type { Db } from './db.js';
import { id, now } from './util.js';

export interface AppEvent {
  locationId: string;
  type: string;
  /** Usually carries contactId and the record that changed. */
  data: Record<string, any>;
  at: string;
}

export type Listener = (e: AppEvent) => void | Promise<void>;

export interface EmitOptions {
  durable?: boolean;
  idempotencyKey?: string;
  maxAttempts?: number;
}

export interface DurableEventRow {
  id: string;
  location_id: string;
  type: string;
  payload: string;
  status: 'pending' | 'processing' | 'completed' | 'dead_letter';
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  next_run_at: string;
  locked_until: string | null;
  created_at: string;
  completed_at: string | null;
  idempotency_key: string | null;
}

/**
 * Business-critical event types that must be persisted durably to SQLite outbox
 * so they survive server crashes and power loss.
 */
export const DEFAULT_DURABLE_EVENTS = new Set<string>([
  'form.submitted',
  'contact.created',
  'contact.updated',
  'contact.deleted',
  'contact.tag_added',
  'contact.tag_removed',
  'appointment.booked',
  'appointment.status_changed',
  'appointment.cancelled',
  'appointment.rescheduled',
  'payment.received',
  'invoice.paid',
  'invoice.sent',
  'opportunity.created',
  'opportunity.stage_changed',
  'opportunity.status_changed',
  'contract.signed',
  'ticket.created',
  'ticket.status_changed',
  'message.received',
  'support.report_queued',
  'feedback.created',
  'backup.failed',
  'backup.overdue',
]);

/**
 * Event bus with durable SQLite outbox persistence and in-process dispatch.
 * Critical events are committed synchronously to SQLite so they cannot be lost
 * across process crashes. Idempotency keys protect against duplicate processing.
 */
export class EventBus {
  private listeners = new Map<string, Listener[]>();
  private pending = new Set<Promise<void>>();
  private db?: Db;
  private processingPromise?: Promise<void>;

  attachDb(db: Db): void {
    this.db = db;
    this.initTables();
  }

  detachDb(): void {
    this.db = undefined;
  }

  private initTables(): void {
    if (!this.db) return;
    this.db.raw.exec(`
      CREATE TABLE IF NOT EXISTS durable_events (
        id TEXT PRIMARY KEY,
        location_id TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 5,
        last_error TEXT,
        next_run_at TEXT NOT NULL,
        locked_until TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        idempotency_key TEXT UNIQUE
      );
      CREATE INDEX IF NOT EXISTS idx_durable_events_pending ON durable_events(status, next_run_at);
      CREATE INDEX IF NOT EXISTS idx_durable_events_location ON durable_events(location_id, type);

      CREATE TABLE IF NOT EXISTS processed_side_effects (
        id TEXT PRIMARY KEY,
        location_id TEXT NOT NULL,
        idempotency_key TEXT UNIQUE,
        action_type TEXT NOT NULL,
        result TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_processed_side_effects_key ON processed_side_effects(idempotency_key);
    `);
  }

  on(type: string, fn: Listener): void {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }

  off(type: string, fn: Listener): void {
    const list = this.listeners.get(type);
    if (!list) return;
    const filtered = list.filter((f) => f !== fn);
    if (filtered.length) this.listeners.set(type, filtered);
    else this.listeners.delete(type);
  }

  emit(locationId: string, type: string, data: Record<string, any> = {}, options?: EmitOptions): string | void {
    const isDurable = options?.durable ?? (DEFAULT_DURABLE_EVENTS.has(type) && !!this.db);

    if (isDurable && this.db) {
      const eventId = id();
      const createdAt = now();
      const payloadStr = JSON.stringify(data);
      const idempotencyKey = options?.idempotencyKey ?? null;
      const maxAttempts = options?.maxAttempts ?? 5;

      try {
        if (idempotencyKey) {
          const existing = this.db.get<DurableEventRow>(
            'SELECT id FROM durable_events WHERE idempotency_key = ?',
            idempotencyKey
          );
          if (existing) {
            return existing.id;
          }
        }

        this.db.run(
          `INSERT INTO durable_events (
            id, location_id, type, payload, status, attempts, max_attempts,
            next_run_at, created_at, idempotency_key
          ) VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?)`,
          eventId,
          locationId,
          type,
          payloadStr,
          maxAttempts,
          createdAt,
          createdAt,
          idempotencyKey
        );

        // Schedule async outbox processing without blocking current caller
        this.triggerProcessing();
        return eventId;
      } catch (err: any) {
        if (idempotencyKey && String(err?.message).includes('UNIQUE')) {
          const existing = this.db.get<DurableEventRow>(
            'SELECT id FROM durable_events WHERE idempotency_key = ?',
            idempotencyKey
          );
          return existing?.id;
        }
        console.error(`[events] Failed to persist durable event ${type}:`, err);
        // Fall back to ephemeral dispatch so the event is not silently lost
      }
    }

    // Ephemeral in-process dispatch
    const e: AppEvent = { locationId, type, data, at: now() };
    const fns = [...(this.listeners.get(type) ?? []), ...(this.listeners.get('*') ?? [])];
    for (const fn of fns) {
      const p = new Promise<void>((resolve) => setImmediate(resolve))
        .then(() => fn(e))
        .catch((err) => console.error(`[events] ${type} listener failed:`, err))
        .finally(() => this.pending.delete(p));
      this.pending.add(p);
    }
  }

  /**
   * Resets any interrupted 'processing' events from a previous crash back to 'pending'.
   */
  recoverInterruptedEvents(): number {
    if (!this.db) return 0;
    const res = this.db.run(
      `UPDATE durable_events
       SET status = 'pending', locked_until = NULL
       WHERE status = 'processing'`
    );
    return res.changes;
  }

  /**
   * Processes due durable events from SQLite outbox.
   */
  async processDurableEvents(limit = 50): Promise<number> {
    if (!this.db) return 0;

    try {
      // First reclaim locks that have expired (lock timeout 60s)
      const currentNow = now();
      this.db.run(
        `UPDATE durable_events
         SET status = 'pending', locked_until = NULL
         WHERE status = 'processing' AND locked_until IS NOT NULL AND locked_until <= ?`,
        currentNow
      );

      const dueEvents = this.db.all<DurableEventRow>(
        `SELECT * FROM durable_events
         WHERE status = 'pending' AND next_run_at <= ?
         ORDER BY created_at ASC
         LIMIT ?`,
        currentNow,
        limit
      );

      if (!dueEvents.length) return 0;

      let processedCount = 0;

      for (const ev of dueEvents) {
        const lockExpiry = new Date(Date.now() + 60_000).toISOString();
        const updated = this.db.run(
          `UPDATE durable_events
           SET status = 'processing', locked_until = ?, attempts = attempts + 1
           WHERE id = ? AND status = 'pending'`,
          lockExpiry,
          ev.id
        );

        if (updated.changes === 0) continue; // Concurrently picked up

        let payload: Record<string, any> = {};
        try {
          payload = JSON.parse(ev.payload);
        } catch {
          payload = {};
        }

        const appEvent: AppEvent = {
          locationId: ev.location_id,
          type: ev.type,
          data: payload,
          at: ev.created_at,
        };

        const fns = [...(this.listeners.get(ev.type) ?? []), ...(this.listeners.get('*') ?? [])];
        let hasError = false;
        let lastErrMsg = '';

        for (const fn of fns) {
          try {
            await fn(appEvent);
          } catch (err: any) {
            hasError = true;
            lastErrMsg = String(err?.message || err);
            console.error(`[events] durable ${ev.type} listener failed:`, err);
          }
        }

        const currentAttempts = ev.attempts + 1;
        if (!hasError) {
          this.db.run(
            `UPDATE durable_events
             SET status = 'completed', completed_at = ?, locked_until = NULL, last_error = NULL
             WHERE id = ?`,
            now(),
            ev.id
          );
          processedCount++;
        } else {
          if (currentAttempts >= ev.max_attempts) {
            this.db.run(
              `UPDATE durable_events
               SET status = 'dead_letter', last_error = ?, locked_until = NULL
               WHERE id = ?`,
              lastErrMsg.slice(0, 1000),
              ev.id
            );
          } else {
            // Exponential backoff: 2s, 4s, 8s, 16s... up to 1 hr
            const delayMs = Math.min(3600_000, Math.pow(2, currentAttempts) * 1000);
            const nextRun = new Date(Date.now() + delayMs).toISOString();
            this.db.run(
              `UPDATE durable_events
               SET status = 'pending', last_error = ?, next_run_at = ?, locked_until = NULL
               WHERE id = ?`,
              lastErrMsg.slice(0, 1000),
              nextRun,
              ev.id
            );
          }
        }
      }

      return processedCount;
    } catch (err: any) {
      if (String(err?.message || err).includes('not open')) return 0;
      throw err;
    }
  }

  private triggerProcessing(): void {
    if (this.processingPromise) return;
    this.processingPromise = (async () => {
      await new Promise<void>((resolve) => setImmediate(resolve));
      try {
        await this.processDurableEvents();
      } catch (err) {
        console.error('[events] processDurableEvents failed:', err);
      }
    })().finally(() => {
      this.processingPromise = undefined;
    });
  }

  /**
   * Prunes completed durable events older than retentionDays.
   */
  pruneCompleted(retentionDays = 7): number {
    if (!this.db) return 0;
    const cutoff = new Date(Date.now() - retentionDays * 864e5).toISOString();
    const res = this.db.run(
      `DELETE FROM durable_events WHERE status = 'completed' AND completed_at < ?`,
      cutoff
    );
    return res.changes;
  }

  /** Waits until every listener (and anything they emitted) has run. Used by tests and the CLI. */
  async flush(): Promise<void> {
    while (this.pending.size) await Promise.all([...this.pending]);
    if (this.db) {
      let count = 0;
      do {
        count = await this.processDurableEvents();
      } while (count > 0);
    }
  }
}

/**
 * Checks whether an external side-effect (e.g. sending SMS, charging payment) has already succeeded.
 */
export function isSideEffectProcessed(db: Db, locationId: string, idempotencyKey: string): boolean {
  const row = db.get('SELECT id FROM processed_side_effects WHERE location_id = ? AND idempotency_key = ?', locationId, idempotencyKey);
  return !!row;
}

/**
 * Records an external side-effect as processed. Returns true if newly recorded, false if already processed.
 */
export function recordSideEffect(db: Db, locationId: string, idempotencyKey: string, actionType: string, result: unknown = null): boolean {
  try {
    db.run(
      `INSERT INTO processed_side_effects (id, location_id, idempotency_key, action_type, result, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id(),
      locationId,
      idempotencyKey,
      actionType,
      result !== null && result !== undefined ? JSON.stringify(result) : null,
      now()
    );
    return true;
  } catch (e: any) {
    if (String(e?.message).includes('UNIQUE')) {
      return false;
    }
    throw e;
  }
}
