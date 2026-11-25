import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { performance } from 'node:perf_hooks';
import { statSync } from 'node:fs';
import { startTestApp } from './helpers.js';
import { upsertContact } from '../server/services/contacts.js';
import { isSideEffectProcessed, recordSideEffect } from '../server/core/events.js';

function calcPercentiles(durations: number[]) {
  const s = [...durations].sort((a, b) => a - b);
  return {
    min: Number(s[0].toFixed(2)),
    p50: Number(s[Math.floor(s.length * 0.5)].toFixed(2)),
    p95: Number(s[Math.floor(s.length * 0.95)].toFixed(2)),
    p99: Number(s[Math.floor(s.length * 0.99)].toFixed(2)),
    max: Number(s[s.length - 1].toFixed(2)),
    avg: Number((s.reduce((a, b) => a + b, 0) / s.length).toFixed(2)),
  };
}

describe('Enterprise Workload & Scale Assessment (Bounded Local Test)', () => {
  let t: Awaited<ReturnType<typeof startTestApp>>;
  let loc = '';

  beforeAll(async () => {
    t = await startTestApp();
    await t.setup();
    loc = t.api.location;
  }, 60_000);

  afterAll(async () => {
    await t.close();
  });

  it('measures lead ingestion throughput and latency under burst traffic', async () => {
    const BATCH_SIZE = 500;
    const latencies: number[] = [];

    const t0 = performance.now();
    for (let i = 0; i < BATCH_SIZE; i++) {
      const start = performance.now();
      const contact = upsertContact(t.app, loc, {
        first_name: `Lead${i}`,
        last_name: `Synthetic`,
        email: `lead_${i}_${Date.now()}@synthetic-benchmark.test`,
        phone: `+4917000${String(i).padStart(5, '0')}`,
        source: 'ad_campaign_burst',
      });
      t.app.events.emit(loc, 'contact.created', {
        contactId: contact.id,
        email: contact.email,
        source: 'ad_campaign_burst',
      });
      latencies.push(performance.now() - start);
    }
    const totalTimeMs = performance.now() - t0;
    await t.app.events.flush();

    const stats = calcPercentiles(latencies);
    const throughput = Number(((BATCH_SIZE / totalTimeMs) * 1000).toFixed(1));

    console.log(`[WORKLOAD-LEAD-INGESTION] Count: ${BATCH_SIZE}, Total: ${totalTimeMs.toFixed(1)}ms, Throughput: ${throughput} leads/s`);
    console.log(`[WORKLOAD-LEAD-INGESTION-LATENCY] p50: ${stats.p50}ms, p95: ${stats.p95}ms, p99: ${stats.p99}ms, avg: ${stats.avg}ms`);

    expect(throughput).toBeGreaterThan(50); // Minimum expectation: at least 50 leads/sec
    expect(stats.p95).toBeLessThan(50); // 95th percentile under 50ms
  });

  it('measures concurrent orders and payments with duplicate prevention under ad burst', async () => {
    const TOTAL_ORDERS = 300;
    const DUPLICATE_RATE = 0.2; // 20% duplicate webhooks
    const latencies: number[] = [];
    let duplicateSuppressed = 0;
    let successfulSideEffects = 0;

    const t0 = performance.now();

    // Run in chunks of 20 concurrent requests
    const CONCURRENCY = 20;
    for (let i = 0; i < TOTAL_ORDERS; i += CONCURRENCY) {
      const chunk = Array.from({ length: Math.min(CONCURRENCY, TOTAL_ORDERS - i) }, (_, k) => i + k);
      await Promise.all(
        chunk.map(async (idx) => {
          const start = performance.now();
          // Generate key (every 5th key repeats an earlier key to test duplicate webhook handling)
          const isDuplicate = idx % 5 === 0 && idx > 0;
          const orderIndex = isDuplicate ? idx - 1 : idx;
          const idempotencyKey = `stripe_evt_order_${orderIndex}_burst`;

          const eventId = t.app.events.emit(
            loc,
            'payment.received',
            {
              orderId: `ord_${orderIndex}`,
              amount: 4999,
              currency: 'EUR',
              customer: `cust_${orderIndex}@example.com`,
            },
            { idempotencyKey }
          );

          if (isSideEffectProcessed(t.app.db, loc, idempotencyKey)) {
            duplicateSuppressed++;
          } else {
            const recorded = recordSideEffect(t.app.db, loc, idempotencyKey, 'charge_card', { orderId: `ord_${orderIndex}` });
            if (recorded) successfulSideEffects++;
            else duplicateSuppressed++;
          }

          latencies.push(performance.now() - start);
        })
      );
    }

    const totalTimeMs = performance.now() - t0;
    await t.app.events.flush();

    const stats = calcPercentiles(latencies);
    const throughput = Number(((TOTAL_ORDERS / totalTimeMs) * 1000).toFixed(1));

    console.log(`[WORKLOAD-ORDERS-PAYMENTS] Count: ${TOTAL_ORDERS}, Total: ${totalTimeMs.toFixed(1)}ms, Throughput: ${throughput} orders/s`);
    console.log(`[WORKLOAD-ORDERS-PAYMENTS-LATENCY] p50: ${stats.p50}ms, p95: ${stats.p95}ms, p99: ${stats.p99}ms, avg: ${stats.avg}ms`);
    console.log(`[WORKLOAD-ORDERS-DUPLICATES] Recorded: ${successfulSideEffects}, Duplicates Blocked: ${duplicateSuppressed}`);

    expect(successfulSideEffects).toBeGreaterThan(0);
    expect(duplicateSuppressed).toBeGreaterThanOrEqual(TOTAL_ORDERS * DUPLICATE_RATE - 5);
    expect(stats.p95).toBeLessThan(100);
  });

  it('measures SQLite write contention under parallel concurrent CRM operations', async () => {
    const NUM_WORKERS = 15;
    const OPS_PER_WORKER = 25;
    const totalOps = NUM_WORKERS * OPS_PER_WORKER;
    const errors: string[] = [];
    const latencies: number[] = [];

    const t0 = performance.now();

    await Promise.all(
      Array.from({ length: NUM_WORKERS }, async (_, workerId) => {
        for (let op = 0; op < OPS_PER_WORKER; op++) {
          const start = performance.now();
          try {
            t.app.db.tx(() => {
              // Mix of insert, update, select
              const contactId = `worker_${workerId}_contact_${op}`;
              t.app.db.insert('contacts', {
                id: contactId,
                location_id: loc,
                first_name: `Worker${workerId}`,
                last_name: `Op${op}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              t.app.db.run(
                'UPDATE contacts SET tags = ? WHERE id = ? AND location_id = ?',
                JSON.stringify(['vip', `batch_${workerId}`]),
                contactId,
                loc
              );
              t.app.db.get('SELECT * FROM contacts WHERE id = ?', contactId);
            });
            latencies.push(performance.now() - start);
          } catch (err: any) {
            errors.push(String(err?.message || err));
          }
        }
      })
    );

    const totalTimeMs = performance.now() - t0;
    const stats = calcPercentiles(latencies);
    const throughput = Number(((totalOps / totalTimeMs) * 1000).toFixed(1));

    console.log(`[WORKLOAD-CONTENTION] Total Ops: ${totalOps}, Contention Errors: ${errors.length}, Throughput: ${throughput} tx/s`);
    console.log(`[WORKLOAD-CONTENTION-LATENCY] p50: ${stats.p50}ms, p95: ${stats.p95}ms, p99: ${stats.p99}ms, avg: ${stats.avg}ms`);

    expect(errors).toHaveLength(0); // Zero SQLITE_BUSY or transaction rollback errors
    expect(stats.p95).toBeLessThan(100);
  });

  it('measures durable event queue throughput, recovery, and resource metrics', async () => {
    const memBefore = process.memoryUsage();
    const QUEUE_ITEMS = 400;

    // Enqueue items in durable_events
    const t0 = performance.now();
    for (let i = 0; i < QUEUE_ITEMS; i++) {
      t.app.events.emit(
        loc,
        'appointment.booked',
        {
          appointmentId: `apt_scale_${i}`,
          service: 'Enterprise Demo',
          time: new Date().toISOString(),
        },
        { durable: true }
      );
    }
    const enqueueTimeMs = performance.now() - t0;

    // Simulate crash recovery
    const recovered = t.app.events.recoverInterruptedEvents();

    // Process all events
    const tProcess = performance.now();
    let totalDrained = 0;
    let batchCount = 0;
    do {
      batchCount = await t.app.events.processDurableEvents(100);
      totalDrained += batchCount;
    } while (batchCount > 0);
    const processTimeMs = performance.now() - tProcess;

    const memAfter = process.memoryUsage();
    const dbSize = statSync(t.app.config.dbFile).size;

    console.log(`[WORKLOAD-QUEUE] Enqueued: ${QUEUE_ITEMS} in ${enqueueTimeMs.toFixed(1)}ms, Drained: ${totalDrained} in ${processTimeMs.toFixed(1)}ms`);
    console.log(`[WORKLOAD-RESOURCES] RSS: ${(memAfter.rss / 1024 / 1024).toFixed(1)}MB (delta: ${((memAfter.rss - memBefore.rss) / 1024 / 1024).toFixed(1)}MB)`);
    console.log(`[WORKLOAD-RESOURCES] HeapUsed: ${(memAfter.heapUsed / 1024 / 1024).toFixed(1)}MB (delta: ${((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(1)}MB)`);
    console.log(`[WORKLOAD-RESOURCES] DB Size: ${(dbSize / 1024 / 1024).toFixed(2)}MB`);

    expect(totalDrained).toBe(QUEUE_ITEMS);
    expect((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toBeLessThan(150); // No memory leak
  });
});
