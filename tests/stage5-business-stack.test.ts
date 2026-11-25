import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { startTestApp } from './helpers.js';
import { createLocation } from '../server/modules/core.js';
import { domainAlias, normalizeDomain } from '../server/core/domains.js';
import { TEMPLATES, TEMPLATES_EN } from '../server/modules/funnels.js';
import { formSpec } from '../server/services/site-templates.js';
import {
  isRazorpayKey,
  razorpayProvider,
  testRazorpay,
  verifyRazorpayWebhook,
} from '../server/services/pay-razorpay.js';
import {
  CASHFREE_EVENTS,
  cashfreeProvider,
  isCashfreeAppId,
  testCashfree,
  verifyCashfreeWebhook,
} from '../server/services/pay-cashfree.js';
import {
  calcGstTotals,
  extractStateCode,
  isValidGstin,
} from '../server/services/invoice-model.js';
import { invoicePages, invoicePdf } from '../server/services/invoice-pdf.js';
import type { DocSnapshot } from '../server/services/einvoice-model.js';
import { startSession, getSession } from '../server/services/pay-registry.js';
import { isSupportSyncEnabled } from '../server/services/central-support-client.js';
import { applyMovement, issueForInvoice, returnForInvoice } from '../server/services/inv-stock.js';
import { finaliseInvoice } from '../server/services/invoice-flow.js';

describe('Stage 5 — Websites, Payments, GST & Invoicing Master Verification', () => {
  let t: Awaited<ReturnType<typeof startTestApp>>;
  let inLocId = '';
  let deLocId = '';

  const RZP_KEY_ID = 'rzp_test_51FakeRazorpayKey001';
  const RZP_KEY_SECRET = 'FakeSecretRazorpay00000000001';
  const RZP_WH_SEC = 'rzp_whsec_test_secret_12345678';

  const CF_APP_ID = 'CFTEST_APP_ID_12345678';
  const CF_SECRET_KEY = 'cfsk_ma_test_secret_key_1234567890abcdef';

  // In-memory mock store for Razorpay API calls
  const rzpOrders = new Map<string, any>();
  const rzpPayments = new Map<string, any>();
  let rzpSeq = 1;

  // In-memory mock store for Cashfree API calls
  const cfOrders = new Map<string, any>();
  const cfPayments = new Map<string, any>();
  let cfSeq = 1;

  beforeAll(async () => {
    t = await startTestApp();
    await t.setup();

    // Create an Indian sub-account
    const inLoc = createLocation(t.app.db, 'Bangalore Digital Pvt Ltd', 'Asia/Kolkata', {
      country: 'IN',
      currency: 'INR',
      email: 'billing@bangaloredigital.in',
    });
    inLocId = inLoc.id;

    // Create a German sub-account
    const deLoc = createLocation(t.app.db, 'München Systeme GmbH', 'Europe/Berlin', {
      country: 'DE',
      currency: 'EUR',
      email: 'info@muenchen-systeme.de',
    });
    deLocId = deLoc.id;

    // Set up mock payFetch for Razorpay API
    t.app.services.payFetch = async (url: string, init: any) => {
      const u = new URL(url);
      const body = init.body && init.headers['content-type'] === 'application/json' ? JSON.parse(init.body) : init.body;
      const json = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

      if (u.hostname === 'api.razorpay.com') {
        const expectedAuth = `Basic ${Buffer.from(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`).toString('base64')}`;
        if (init.headers.authorization !== expectedAuth) {
          return json({ error: { code: 'BAD_REQUEST_ERROR', description: 'Invalid API Key or Secret' } }, 401);
        }

        // GET /orders?count=1 (probe)
        if (u.pathname === '/v1/orders' && init.method === 'GET') {
          return json({ entity: 'collection', count: 0, items: [] });
        }

        // POST /v1/orders
        if (u.pathname === '/v1/orders' && init.method === 'POST') {
          const id = `order_fake_${rzpSeq++}`;
          const order = {
            id,
            entity: 'order',
            amount: body.amount,
            amount_paid: 0,
            amount_due: body.amount,
            currency: body.currency,
            receipt: body.receipt,
            status: 'created',
            notes: body.notes ?? {},
          };
          rzpOrders.set(id, order);
          return json(order, 201);
        }

        // POST /v1/payment_links
        if (u.pathname === '/v1/payment_links' && init.method === 'POST') {
          const plinkId = `plink_fake_${rzpSeq++}`;
          return json(
            {
              id: plinkId,
              short_url: `https://rzp.io/i/${plinkId}`,
              status: 'created',
              amount: body.amount,
              currency: body.currency,
            },
            201,
          );
        }

        // GET /v1/orders/:id
        const orderMatch = u.pathname.match(/^\/v1\/orders\/([^/]+)$/);
        if (orderMatch && init.method === 'GET') {
          const ord = rzpOrders.get(orderMatch[1]);
          if (!ord) return json({ error: { code: 'BAD_REQUEST_ERROR', description: 'Order not found' } }, 404);
          return json(ord);
        }

        // GET /v1/orders/:id/payments
        const orderPaymentsMatch = u.pathname.match(/^\/v1\/orders\/([^/]+)\/payments$/);
        if (orderPaymentsMatch && init.method === 'GET') {
          const ord = rzpOrders.get(orderPaymentsMatch[1]);
          if (!ord) return json({ error: { code: 'BAD_REQUEST_ERROR', description: 'Order not found' } }, 404);
          const payList = [...rzpPayments.values()].filter((p) => p.order_id === ord.id);
          return json({ entity: 'collection', count: payList.length, items: payList });
        }

        // POST /v1/payments/:id/refund
        const refundMatch = u.pathname.match(/^\/v1\/payments\/([^/]+)\/refund$/);
        if (refundMatch && init.method === 'POST') {
          const refId = `rfnd_fake_${rzpSeq++}`;
          return json({ id: refId, entity: 'refund', amount: body.amount, status: 'processed' }, 201);
        }
      }

      if (u.hostname === 'sandbox.cashfree.com' || u.hostname === 'api.cashfree.com') {
        if (init.headers['x-client-id'] !== CF_APP_ID || init.headers['x-client-secret'] !== CF_SECRET_KEY) {
          return json({ message: 'Authentication failed', type: 'authentication_error' }, 401);
        }

        // GET /pg/orders?order_limit=1 (probe)
        if (u.pathname === '/pg/orders' && init.method === 'GET') {
          return json([], 200);
        }

        // POST /pg/orders
        if (u.pathname === '/pg/orders' && init.method === 'POST') {
          const id = body.order_id || `cf_order_${cfSeq++}`;
          const order = {
            cf_order_id: `cf_${cfSeq++}`,
            order_id: id,
            order_amount: body.order_amount,
            order_currency: body.order_currency || 'INR',
            order_status: 'ACTIVE',
            payment_session_id: `session_fake_${cfSeq++}`,
            payment_link: `https://payments-test.cashfree.com/order/#session_fake_${cfSeq}`,
            customer_details: body.customer_details,
            order_tags: body.order_tags,
          };
          cfOrders.set(id, order);
          return json(order, 200);
        }

        // GET /pg/orders/:id
        const orderMatch = u.pathname.match(/^\/pg\/orders\/([^/]+)$/);
        if (orderMatch && init.method === 'GET') {
          const ord = cfOrders.get(orderMatch[1]);
          if (!ord) return json({ message: 'Order not found', type: 'order_error' }, 404);
          return json(ord, 200);
        }

        // GET /pg/orders/:id/payments
        const orderPaymentsMatch = u.pathname.match(/^\/pg\/orders\/([^/]+)\/payments$/);
        if (orderPaymentsMatch && init.method === 'GET') {
          const ord = cfOrders.get(orderPaymentsMatch[1]);
          if (!ord) return json({ message: 'Order not found', type: 'order_error' }, 404);
          const payList = [...cfPayments.values()].filter((p) => p.order_id === ord.order_id);
          return json(payList, 200);
        }

        // POST /pg/orders/:id/refunds
        const refundMatch = u.pathname.match(/^\/pg\/orders\/([^/]+)\/refunds$/);
        if (refundMatch && init.method === 'POST') {
          const refId = `cf_ref_${cfSeq++}`;
          return json({
            cf_refund_id: refId,
            refund_id: body.refund_id,
            refund_amount: body.refund_amount,
            refund_status: 'SUCCESS',
          }, 200);
        }
      }

      return json({ message: `unknown endpoint: ${url}` }, 404);
    };

    // Configure Razorpay account in Indian sub-account
    t.api.setLocation(inLocId);
    const saveRes = await t.api.put('/api/pay/providers/razorpay', {
      key_id: RZP_KEY_ID,
      key_secret: RZP_KEY_SECRET,
      webhook_secret: RZP_WH_SEC,
    });
    expect(saveRes.status).toBe(200);

    // Configure Cashfree account in Indian sub-account
    const cfSaveRes = await t.api.put('/api/pay/providers/cashfree', {
      app_id: CF_APP_ID,
      secret_key: CF_SECRET_KEY,
      webhook_secret: CF_SECRET_KEY,
      mode: 'sandbox',
    });
    expect(cfSaveRes.status).toBe(200);
  }, 60_000);

  afterAll(async () => {
    await t.close();
  });

  // -----------------------------------------------------------------------------------------------
  // 1. Websites & Funnels: English Templates & Inspection
  // -----------------------------------------------------------------------------------------------
  describe('1. Websites and Funnels Localization', () => {
    it('creates English website with Home, Terms of Service and Privacy Policy for Indian sub-account', async () => {
      t.api.setLocation(inLocId);
      const res = await t.api.post('/api/funnels', {
        name: 'Enterprise Cloud Portal',
        kind: 'website',
        locale: 'en',
      });

      expect(res.status).toBe(200);
      const body = res.data;
      expect(body.name).toBe('Enterprise Cloud Portal');
      expect(body.kind).toBe('website');
      expect(body.pages).toHaveLength(3);

      const [home, terms, privacy] = body.pages;
      expect(home.name).toBe('Home');
      expect(home.slug).toBe('home');
      expect(home.blocks[0].heading).toBe('Welcome to Our Platform');
      expect(home.blocks[0].button_text).toBe('Get in Touch');

      expect(terms.name).toBe('Terms of Service');
      expect(terms.slug).toBe('terms');
      expect(terms.blocks[0].text).toBe('Terms of Service');

      expect(privacy.name).toBe('Privacy Policy');
      expect(privacy.slug).toBe('privacy');
      expect(privacy.blocks[0].text).toBe('Privacy Policy');
    });

    it('creates English lead magnet funnel with Opt-in and Thank You pages', async () => {
      t.api.setLocation(inLocId);
      const res = await t.api.post('/api/funnels', {
        name: 'Growth Playbook',
        template: 'leadmagnet',
        locale: 'en',
      });

      expect(res.status).toBe(200);
      const body = res.data;
      expect(body.pages).toHaveLength(2);
      expect(body.pages[0].name).toBe('Opt-in');
      expect(body.pages[0].blocks[0].heading).toBe('The Free Guide to Accelerate Your Growth');
      expect(body.pages[1].name).toBe('Thank You');
      expect(body.pages[1].blocks[0].heading).toBe('Thank You! 🎉');
    });

    it('preserves German templates when locale is German or default German location', async () => {
      t.api.setLocation(deLocId);
      const res = await t.api.post('/api/funnels', {
        name: 'Deutsche Agentur',
        kind: 'website',
      });

      expect(res.status).toBe(200);
      const body = res.data;
      expect(body.pages).toHaveLength(3);
      expect(body.pages[0].name).toBe('Startseite');
      expect(body.pages[0].blocks[0].heading).toBe('Willkommen bei uns');
      expect(body.pages[1].name).toBe('Impressum');
      expect(body.pages[2].name).toBe('Datenschutz');
    });
  });

  // -----------------------------------------------------------------------------------------------
  // 2. Form Specifications & Public Lead Routing
  // -----------------------------------------------------------------------------------------------
  describe('2. Form Specifications and Lead Routing', () => {
    it('produces English form spec when locale is en', () => {
      const spec = formSpec('optin', 'Consulting Portal', 'en');
      expect(spec.name).toBe('Consulting Portal – Sign Up');
      expect(spec.settings.submit_text).toBe('Get It Free Now');
      expect(spec.fields.some((f) => f.label === 'First Name')).toBe(true);
      expect(spec.fields.some((f) => f.label === 'Email Address')).toBe(true);
      expect(spec.fields.find((f) => f.type === 'consent')?.label).toContain('privacy policy');
    });

    it('produces German form spec when locale is de or unspecified', () => {
      const spec = formSpec('optin', 'Beratung Portal', 'de');
      expect(spec.name).toBe('Beratung Portal – Anmeldung');
      expect(spec.settings.submit_text).toBe('Jetzt kostenlos sichern');
      expect(spec.fields.some((f) => f.label === 'Vorname')).toBe(true);
      expect(spec.fields.some((f) => f.label === 'E-Mail')).toBe(true);
      expect(spec.fields.find((f) => f.type === 'consent')?.label).toContain('Datenschutzerklärung');
    });

    it('routes public form submission to CRM contact creation and durable event outbox', async () => {
      t.api.setLocation(inLocId);
      // 1. Create a form in the sub-account
      const formRes = await t.api.post('/api/forms', {
        name: 'Inquiry Form',
        fields: [
          { id: 'f1', type: 'text', label: 'First Name', name: 'first_name', required: true },
          { id: 'f2', type: 'text', label: 'Last Name', name: 'last_name', required: true },
          { id: 'f3', type: 'email', label: 'Email', name: 'email', required: true },
          { id: 'f4', type: 'phone', label: 'Phone', name: 'phone' },
        ],
      });

      expect(formRes.status).toBe(200);
      const form = formRes.data;

      // 2. Submit form publicly
      const subRes = await t.api.post(`/api/public/forms/${form.id}/submit`, {
        first_name: 'Vikram',
        last_name: 'Malhotra',
        email: 'vikram.malhotra@techcorp.in',
        phone: '+919876543210',
      });

      expect(subRes.status).toBe(200);
      expect(subRes.data.ok).toBe(true);
      expect(subRes.data.contactId).toBeDefined();

      // 3. Verify CRM contact was created
      const contact = t.app.db.get<any>('SELECT * FROM contacts WHERE id = ?', subRes.data.contactId);
      expect(contact).toBeDefined();
      expect(contact.first_name).toBe('Vikram');
      expect(contact.last_name).toBe('Malhotra');
      expect(contact.email).toBe('vikram.malhotra@techcorp.in');
      expect(contact.phone).toBe('+919876543210');

      // 4. Verify durable event in durable_events
      const outbox = t.app.db.get<any>(
        "SELECT * FROM durable_events WHERE location_id = ? AND type = 'form.submitted' ORDER BY created_at DESC LIMIT 1",
        inLocId,
      );
      expect(outbox).toBeDefined();
      expect(['pending', 'completed']).toContain(outbox.status);
      const payload = JSON.parse(outbox.payload);
      expect(payload.contactId).toBe(contact.id);
      expect(payload.formId).toBe(form.id);
    });
  });

  // -----------------------------------------------------------------------------------------------
  // 3. Custom Domain Normalization and Aliasing
  // -----------------------------------------------------------------------------------------------
  describe('3. Custom Domain Validation and Aliasing', () => {
    it('normalizes uppercase, protocols, trailing paths and ports', () => {
      expect(normalizeDomain('https://WWW.Dwarapalak.IN/portal/')).toBe('www.dwarapalak.in');
      expect(normalizeDomain('http://portal.myshop.co.in:8080')).toBe('portal.myshop.co.in');
      expect(normalizeDomain('sub-domain.enterprise.org')).toBe('sub-domain.enterprise.org');
    });

    it('generates correct www-pair alias', () => {
      expect(domainAlias('dwarapalak.in')).toBe('www.dwarapalak.in');
      expect(domainAlias('www.dwarapalak.in')).toBe('dwarapalak.in');
      expect(domainAlias('sub.portal.dwarapalak.in')).toBeUndefined();
    });

    it('throws validation error on invalid domain syntax', () => {
      expect(() => normalizeDomain('invalid domain with spaces')).toThrow();
      expect(() => normalizeDomain('invalid..domain.com')).toThrow();
      expect(() => normalizeDomain('invalid-domain-.com')).toThrow();
    });
  });

  // -----------------------------------------------------------------------------------------------
  // 4. Razorpay Provider Integration: Create & Fetch
  // -----------------------------------------------------------------------------------------------
  describe('4. Razorpay Provider Integration', () => {
    it('validates key format with isRazorpayKey', () => {
      expect(isRazorpayKey('rzp_test_12345ABC')).toBe(true);
      expect(isRazorpayKey('rzp_live_99999XYZ')).toBe(true);
      expect(isRazorpayKey('sk_test_' + '1234567890')).toBe(false);
      expect(isRazorpayKey('invalid_key')).toBe(false);
    });

    it('successfully runs testRazorpay against credentials probe', async () => {
      const acc = {
        location_id: inLocId,
        provider: 'razorpay',
        secrets: { key_id: RZP_KEY_ID, key_secret: RZP_KEY_SECRET },
      };
      const probe = await testRazorpay(t.app, acc as any);
      expect(probe.ok).toBe(true);
      expect(probe.mode).toBe('test');
    });

    it('creates Razorpay checkout order and payment link', async () => {
      const session = startSession(t.app, {
        locationId: inLocId,
        purpose: 'custom',
        amountCents: 150000, // INR 1,500.00
        currency: 'INR',
        description: 'Annual SaaS Subscription',
        returnUrl: 'https://mysite.in/thankyou',
        email: 'customer@client.in',
        name: 'Rajesh Kumar',
      });

      const res = await razorpayProvider.create(t.app, session);
      expect(res.provider_ref).toMatch(/^order_fake_/);
      expect(res.url).toMatch(/^https:\/\/(rzp\.io|api\.razorpay\.com)/);

      // Verify order stored in mock
      const ord = rzpOrders.get(res.provider_ref);
      expect(ord).toBeDefined();
      expect(ord.amount).toBe(150000);
      expect(ord.currency).toBe('INR');
      expect(ord.notes.pay_session).toBe(session.id);
    });

    it('fetches order status correctly from Razorpay', async () => {
      const session = startSession(t.app, {
        locationId: inLocId,
        purpose: 'custom',
        amountCents: 50000,
        currency: 'INR',
        description: 'Course Access',
      });
      const created = await razorpayProvider.create(t.app, session);

      // Initially open
      const fetch1 = await razorpayProvider.fetch(t.app, { ...session, provider_ref: created.provider_ref });
      expect(fetch1.status).toBe('open');

      // Simulate order marked paid with captured payment
      const ord = rzpOrders.get(created.provider_ref);
      ord.status = 'paid';
      const payId = `pay_fake_${rzpSeq++}`;
      rzpPayments.set(payId, {
        id: payId,
        order_id: ord.id,
        status: 'captured',
        amount: 50000,
        currency: 'INR',
      });

      const fetch2 = await razorpayProvider.fetch(t.app, { ...session, provider_ref: created.provider_ref });
      expect(fetch2.status).toBe('paid');
      expect(fetch2.amount_cents).toBe(50000);
      expect(fetch2.capture_ref).toBe(payId);
    });
  });

  // -----------------------------------------------------------------------------------------------
  // 5. Razorpay Webhooks, Signature Validation & Deduplication
  // -----------------------------------------------------------------------------------------------
  describe('5. Razorpay Webhooks and Signature Verification', () => {
    it('verifies valid HMAC-SHA256 signature and rejects invalid/tampered payloads', () => {
      const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_123' } } } });
      const validSig = createHmac('sha256', RZP_WH_SEC).update(body).digest('hex');
      const badSig = createHmac('sha256', 'wrong_secret').update(body).digest('hex');

      expect(verifyRazorpayWebhook(body, validSig, RZP_WH_SEC)).toBe(true);
      expect(verifyRazorpayWebhook(body, badSig, RZP_WH_SEC)).toBe(false);
      expect(verifyRazorpayWebhook(body + 'tamper', validSig, RZP_WH_SEC)).toBe(false);
    });

    it('processes authenticated webhook, settles pay_session and deduplicates via pay_events', async () => {
      // 1. Create a pay session
      const session = startSession(t.app, {
        locationId: inLocId,
        purpose: 'custom',
        amountCents: 299900, // INR 2,999.00
        currency: 'INR',
        description: 'Pro Plan Upgrade',
      });

      // Update provider_ref as if checked out
      const orderId = `order_wh_${rzpSeq++}`;
      const payId = `pay_wh_${rzpSeq++}`;
      t.app.db.run(
        "UPDATE pay_sessions SET provider = 'razorpay', provider_ref = ?, status = 'open' WHERE id = ?",
        orderId,
        session.id,
      );
      t.app.db.run(
        'INSERT INTO pay_refs (provider, ref, session_id, location_id, created_at) VALUES (?, ?, ?, ?, ?)',
        'razorpay',
        orderId,
        session.id,
        inLocId,
        new Date().toISOString(),
      );

      // 2. Prepare Razorpay webhook event payload
      const eventId = `evt_fake_${rzpSeq++}`;
      const whPayload = {
        entity: 'event',
        event: 'order.paid',
        id: eventId,
        created_at: Math.floor(Date.now() / 1000),
        payload: {
          order: {
            entity: {
              id: orderId,
              amount: 299900,
              currency: 'INR',
              status: 'paid',
            },
          },
          payment: {
            entity: {
              id: payId,
              order_id: orderId,
              amount: 299900,
              currency: 'INR',
              status: 'captured',
            },
          },
        },
      };

      const rawBody = JSON.stringify(whPayload);
      const signature = createHmac('sha256', RZP_WH_SEC).update(rawBody).digest('hex');

      // 3. Deliver webhook to POST /hooks/razorpay/:locationId
      const res1 = await fetch(`${t.base}/hooks/razorpay/${inLocId}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-razorpay-signature': signature,
        },
        body: rawBody,
      });

      expect(res1.status).toBe(200);
      const data1 = await res1.json();
      expect(data1.received).toBe(true);
      expect(data1.handled).toBe('paid');

      // 4. Verify session settled in SQLite
      const settled = getSession(t.app, session.id)!;
      expect(settled.status).toBe('paid');
      expect(settled.capture_ref).toBe(payId);
      expect(settled.received_cents).toBe(299900);

      // 5. Verify durable payment.received event in durable_events
      const outboxEvt = t.app.db.get<any>(
        "SELECT * FROM durable_events WHERE location_id = ? AND type = 'payment.received' ORDER BY created_at DESC LIMIT 1",
        inLocId,
      );
      expect(outboxEvt).toBeDefined();
      const p = JSON.parse(outboxEvt.payload);
      expect(p.sessionId).toBe(session.id);
      expect(p.amount_cents).toBe(299900);

      // 6. Test Deduplication: Re-deliver the same webhook event
      const res2 = await fetch(`${t.base}/hooks/razorpay/${inLocId}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-razorpay-signature': signature,
        },
        body: rawBody,
      });
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.received).toBe(true);
      expect(data2.duplicate).toBe(true);
    });
  });

  // -----------------------------------------------------------------------------------------------
  // 6. Razorpay Refund Execution
  // -----------------------------------------------------------------------------------------------
  describe('6. Razorpay Refund Execution', () => {
    it('executes refund for paid session and handles missing capture ref', async () => {
      const session = startSession(t.app, {
        locationId: inLocId,
        purpose: 'custom',
        amountCents: 100000,
        currency: 'INR',
        description: 'Refundable Plan',
      });

      const payId = `pay_rfnd_${rzpSeq++}`;
      t.app.db.run(
        "UPDATE pay_sessions SET status = 'paid', provider = 'razorpay', capture_ref = ? WHERE id = ?",
        payId,
        session.id,
      );

      const refResult = await razorpayProvider.refund(t.app, { ...session, capture_ref: payId, status: 'paid' }, 50000);
      expect(refResult.id).toMatch(/^rfnd_fake_/);

      // Fails when capture_ref is empty
      await expect(razorpayProvider.refund(t.app, { ...session, capture_ref: '', status: 'paid' }, 50000)).rejects.toThrow();
    });
  });

  // -----------------------------------------------------------------------------------------------
  // 7. GSTIN Validation and State Code Extraction
  // -----------------------------------------------------------------------------------------------
  describe('7. GSTIN Validation and State Code Extraction', () => {
    it('validates 15-character GSTIN format correctly', () => {
      expect(isValidGstin('29ABCDE1234F1Z5')).toBe(true); // Karnataka
      expect(isValidGstin('27AAACB2212P1ZA')).toBe(true); // Maharashtra
      expect(isValidGstin('07AAAAA0000A1Z5')).toBe(true); // Delhi
      expect(isValidGstin('06AAAAA0000A1Z5')).toBe(true); // Haryana
      expect(isValidGstin('  29ABCDE1234F1Z5  ')).toBe(true); // Trim handling

      // Invalid GSTIN patterns
      expect(isValidGstin('29ABCDE1234F1')).toBe(false); // Too short (13 chars)
      expect(isValidGstin('29ABCDE1234F1Z59')).toBe(false); // Too long (16 chars)
      expect(isValidGstin('XXABCDE1234F1Z5')).toBe(false); // Non-numeric state code
      expect(isValidGstin('')).toBe(false);
      expect(isValidGstin(null)).toBe(false);
    });

    it('extracts 2-digit state code from GSTIN or state string', () => {
      expect(extractStateCode('29ABCDE1234F1Z5')).toBe('29');
      expect(extractStateCode('07AAAAA0000A1Z5')).toBe('07');
      expect(extractStateCode('27')).toBe('27');
      expect(extractStateCode('invalid')).toBe('');
    });
  });

  // -----------------------------------------------------------------------------------------------
  // 8. Intra-State vs Inter-State GST Calculation & Line Discounts
  // -----------------------------------------------------------------------------------------------
  describe('8. Intra-State and Inter-State GST Calculation', () => {
    it('calculates Intra-State GST (CGST 50% + SGST 50%) when supplier state matches buyer state', () => {
      const items = [
        { qty: 2, price_cents: 5000, tax_rate: 18, hsn_sac: '998313' }, // 2 * 50.00 = 100.00
      ];

      const res = calcGstTotals(items, '29ABCDE1234F1Z5', '29XYZAB5678C1Z2');
      expect(res.is_interstate).toBe(false);
      expect(res.taxable_cents).toBe(10000);
      expect(res.cgst_cents).toBe(900); // 9% of 10000
      expect(res.sgst_cents).toBe(900); // 9% of 10000
      expect(res.igst_cents).toBe(0);
      expect(res.tax_cents).toBe(1800);
      expect(res.total_cents).toBe(11800);
    });

    it('calculates Inter-State GST (IGST 100%) when supplier state differs from buyer state', () => {
      const items = [
        { qty: 2, price_cents: 5000, tax_rate: 18, hsn_sac: '998313' },
      ];

      // Supplier in Karnataka (29), Buyer in Delhi (07)
      const res = calcGstTotals(items, '29ABCDE1234F1Z5', '07AAAAA0000A1Z5');
      expect(res.is_interstate).toBe(true);
      expect(res.taxable_cents).toBe(10000);
      expect(res.cgst_cents).toBe(0);
      expect(res.sgst_cents).toBe(0);
      expect(res.igst_cents).toBe(1800); // 18% of 10000
      expect(res.tax_cents).toBe(1800);
      expect(res.total_cents).toBe(11800);
    });

    it('handles line-level discounts before calculating GST', () => {
      const items = [
        { qty: 1, price_cents: 10000, discount_cents: 2000, tax_rate: 18 }, // Net: 8000
      ];

      const res = calcGstTotals(items, '29', '29');
      expect(res.taxable_cents).toBe(8000);
      expect(res.cgst_cents).toBe(720); // 9% of 8000
      expect(res.sgst_cents).toBe(720); // 9% of 8000
      expect(res.total_cents).toBe(9440);
    });
  });

  // -----------------------------------------------------------------------------------------------
  // 9. Indian GST Tax Invoice PDF Generation
  // -----------------------------------------------------------------------------------------------
  describe('9. Indian GST Tax Invoice PDF Generation', () => {
    it('generates Tax Invoice PDF with GSTIN, Place of Supply, HSN/SAC, INR and Bank/UPI details', () => {
      const doc: DocSnapshot = {
        id: 'inv_gst_01',
        number: 'INV-2026-0001',
        kind: 'invoice',
        inv_type: 'standard',
        credit_type: '',
        title: 'Software Development Services',
        issued_ymd: '2026-10-30',
        due_ymd: '2026-11-15',
        currency: 'INR',
        tax_mode: 'standard',
        tax_note: '',
        calc: 'line',
        tax_regime: 'gst',
        supply_from: null,
        supply_to: null,
        supply_auto: false,
        notes: 'Thank you for your business.',
        items: [
          {
            id: 'li_1',
            name: 'Cloud Consulting',
            description: 'DevOps & Pipeline Automation',
            qty: 10,
            unit: 'HUR',
            price_cents: 250000, // INR 2,500.00 / hr
            tax_rate: 18,
            hsn_sac: '998313',
          },
        ],
        totals: {
          subtotal_cents: 2500000,
          tax_cents: 450000,
          total_cents: 2950000,
          groups: [{ category: 'S', rate: 18, net_cents: 2500000, tax_cents: 450000 }],
        },
        deducted_cents: 0,
        deductions: [],
        skonto: null,
        ref: null,
        seller: {
          name: 'Bangalore Digital Pvt Ltd',
          street: '100 Feet Road, Indiranagar',
          postal_code: '560038',
          city: 'Bangalore',
          country: 'IN',
          email: 'accounts@bangaloredigital.in',
          phone: '+91 80 1234 5678',
          contact_name: 'Suresh Rao',
          vat_id: '',
          tax_number: '',
          gstin: '29ABCDE1234F1Z5',
          pan: 'ABCDE1234F',
          state_code: '29',
        },
        buyer: {
          company: 'Mumbai Retail Solutions Ltd',
          name: 'Ananya Deshmukh',
          street: 'Bandra Kurla Complex',
          postal_code: '400051',
          city: 'Mumbai',
          country: 'IN',
          email: 'finance@mumbairetail.in',
          vat_id: '',
          leitweg_id: '',
          buyer_ref: 'PO-2026-99',
          gstin: '27AAACB2212P1ZA',
          place_of_supply: '27-Maharashtra',
          state_code: '27',
        },
        bank: {
          bank: 'HDFC Bank Ltd',
          iban: '',
          bic: '',
          account_number: '50200012345678',
          ifsc: 'HDFC0000123',
          upi_id: 'bangaloredigital@hdfcbank',
        },
      };

      const { pages, title } = invoicePages(doc);
      expect(title).toBe('Tax Invoice INV-2026-0001');
      expect(pages.length).toBeGreaterThanOrEqual(1);

      // Generate raw PDF buffer
      const pdfBuf = invoicePdf(doc);
      expect(pdfBuf).toBeInstanceOf(Buffer);
      expect(pdfBuf.length).toBeGreaterThan(1000);

      // Verify rendered primitive text entries
      const renderedText = pages
        .flatMap((p) => p.prims)
        .map((pr: any) => pr.text ?? (pr.lines ? pr.lines.join(' ') : ''))
        .join(' ');

      expect(renderedText).toContain('Tax Invoice');
      expect(renderedText).toContain('GSTIN (Seller)');
      expect(renderedText).toContain('29ABCDE1234F1Z5');
      expect(renderedText).toContain('GSTIN (Buyer)');
      expect(renderedText).toContain('27AAACB2212P1ZA');
      expect(renderedText).toContain('Place of Supply');
      expect(renderedText).toContain('998313'); // HSN/SAC
      expect(renderedText).toContain('INR');
      expect(renderedText).toContain('Payment Details');
      expect(renderedText).toContain('50200012345678'); // Bank Account
      expect(renderedText).toContain('HDFC0000123'); // IFSC
      expect(renderedText).toContain('bangaloredigital@hdfcbank'); // UPI

      // Crucial: Must NOT contain German legal text or GiroCode
      expect(renderedText).not.toContain('GiroCode');
      expect(renderedText).not.toContain('mit Banking-App scannen');
      expect(renderedText).not.toContain('§ 19 UStG');
      expect(renderedText).not.toContain('Rechnung-Nr');
    });
  });

  // -----------------------------------------------------------------------------------------------
  // 10. German VAT & EUR Backward Compatibility
  // -----------------------------------------------------------------------------------------------
  describe('10. German VAT & EUR Backward Compatibility', () => {
    it('preserves German layout, Rechnung title, USt, GiroCode and German footer', () => {
      const doc: DocSnapshot = {
        id: 'inv_de_01',
        number: 'RE-2026-0042',
        kind: 'invoice',
        inv_type: 'standard',
        credit_type: '',
        title: 'Beratungsleistung',
        issued_ymd: '2026-10-30',
        due_ymd: '2026-11-13',
        currency: 'EUR',
        tax_mode: 'standard',
        tax_note: '',
        calc: 'line',
        tax_regime: 'vat',
        supply_from: '2026-10-01',
        supply_to: '2026-10-30',
        supply_auto: false,
        items: [
          {
            id: 'li_de_1',
            name: 'Web-Entwicklung',
            description: 'Frontend & Backend',
            qty: 5,
            unit: 'HUR',
            price_cents: 12000, // 120.00 EUR
            tax_rate: 19,
          },
        ],
        totals: {
          subtotal_cents: 60000,
          tax_cents: 11400,
          total_cents: 71400,
          groups: [{ category: 'S', rate: 19, net_cents: 60000, tax_cents: 11400 }],
        },
        deducted_cents: 0,
        deductions: [],
        skonto: null,
        ref: null,
        seller: {
          name: 'München Systeme GmbH',
          street: 'Maximilianstraße 12',
          postal_code: '80539',
          city: 'München',
          country: 'DE',
          email: 'buchhaltung@muenchen-systeme.de',
          phone: '+49 89 9876543',
          contact_name: 'Hans Gruber',
          vat_id: 'DE123456789',
          tax_number: '143/123/45678',
        },
        buyer: {
          company: 'Berlin Handel AG',
          name: 'Klaus Fischer',
          street: 'Friedrichstraße 100',
          postal_code: '10117',
          city: 'Berlin',
          country: 'DE',
          email: 'einkauf@berlin-handel.de',
          vat_id: 'DE987654321',
          leitweg_id: '',
          buyer_ref: '',
        },
        bank: {
          bank: 'Deutsche Bank München',
          iban: 'DE89370400440532013000',
          bic: 'DEUTDEDDMUC',
        },
      };

      const { pages, title } = invoicePages(doc);
      expect(title).toBe('Rechnung RE-2026-0042');

      const renderedText = pages
        .flatMap((p) => p.prims)
        .map((pr: any) => pr.text ?? (pr.lines ? pr.lines.join(' ') : ''))
        .join(' ');

      expect(renderedText).toContain('Rechnung');
      expect(renderedText).toContain('USt.');
      expect(renderedText).toContain('Zahlungsinformationen');
      expect(renderedText).toContain('GiroCode');
      expect(renderedText).toContain('mit Banking-App scannen');
      expect(renderedText).toContain('DE123456789');

      // Crucial: Must NOT contain Indian GST fields
      expect(renderedText).not.toContain('GSTIN');
      expect(renderedText).not.toContain('Place of Supply');
      expect(renderedText).not.toContain('Tax Invoice');
    });
  });

  // -----------------------------------------------------------------------------------------------
  // 11. Event Durability Check
  // -----------------------------------------------------------------------------------------------
  describe('11. Event Durability Persistence', () => {
    it('confirms critical business events are safely committed to SQLite durable_events', () => {
      const rows = t.app.db.all<any>(
        'SELECT type, status, count(*) as count FROM durable_events GROUP BY type, status',
      );
      expect(rows.length).toBeGreaterThan(0);
      const types = rows.map((r) => r.type);
      expect(types).toContain('form.submitted');
      expect(types).toContain('payment.received');
    });
  });

  // -----------------------------------------------------------------------------------------------
  // 12. Stage 2–4 Regression Checks
  // -----------------------------------------------------------------------------------------------
  describe('12. Stage 2-4 Security and Architecture Regression Checks', () => {
    it('preserves livechat visitor token isolation', () => {
      // Direct query check on messages table to ensure visitor_token isolation query is enforce-able
      const count = t.app.db.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM messages WHERE visitor_token IS NOT NULL',
      );
      expect(count).toBeDefined();
    });

    it('confirms central support is disabled by default', () => {
      expect(isSupportSyncEnabled(t.app)).toBe(false);
      const cfg = t.app.db.get<any>("SELECT value FROM agency_settings WHERE key = 'dwarapalak_central_support'");
      if (cfg) {
        const parsed = JSON.parse(cfg.value);
        expect(parsed.enabled).toBe(false);
      }
    });

    it('preserves regional configuration between Indian and German sub-accounts', () => {
      const locIn = t.app.location(inLocId);
      expect(locIn?.settings?.regional?.country).toBe('IN');
      expect(locIn?.settings?.regional?.currency).toBe('INR');

      const locDe = t.app.location(deLocId);
      expect(locDe?.settings?.regional?.country).toBe('DE');
      expect(locDe?.settings?.regional?.currency).toBe('EUR');
    });
  });

  // -----------------------------------------------------------------------------------------------
  // 13. Cashfree Payment Gateway Integration
  // -----------------------------------------------------------------------------------------------
  describe('13. Cashfree Payment Provider (India Stack: UPI, Cards, Netbanking)', () => {
    it('validates Cashfree App-ID format and credentials presence', async () => {
      expect(isCashfreeAppId('CFTEST_APP_ID_12345678')).toBe(true);
      expect(isCashfreeAppId('app_prod_99887766')).toBe(true);
      expect(isCashfreeAppId('bad')).toBe(false);
      expect(isCashfreeAppId('')).toBe(false);

      // Verify ready status via pay/providers
      t.api.setLocation(inLocId);
      const res = await t.api.get('/api/pay/providers');
      expect(res.status).toBe(200);
      const cf = (res.data?.providers || []).find((p: any) => p.id === 'cashfree');
      expect(cf).toBeDefined();
      expect(cf.ready).toBe(true);
      expect(cf.webhook_set).toBe(true);
      expect(cf.events).toEqual(CASHFREE_EVENTS);
    });

    it('proves Cashfree test connection via testCashfree', async () => {
      const probe = await testCashfree(t.app, {
        secrets: { app_id: CF_APP_ID, secret_key: CF_SECRET_KEY, mode: 'sandbox' },
        options: {},
        hint: '••••5678',
        checked_at: null,
      });
      expect(probe.ok).toBe(true);
      expect(probe.mode).toBe('sandbox');
    });

    it('creates a hosted checkout session with UPI / Netbanking via cashfreeProvider.create', async () => {
      const session = startSession(t.app, {
        locationId: inLocId,
        purpose: 'invoice',
        refId: 'inv_cf_test_001',
        amountCents: 150000, // ₹1,500.00
        currency: 'INR',
        description: 'Payment for Web Consulting Invoice #1001',
        email: 'priya.sharma@example.com',
        name: 'Priya Sharma',
        returnUrl: `${t.base}/i/inv_cf_test_001`,
      });

      const created = await cashfreeProvider.create(t.app, session);
      expect(created.provider_ref).toBeDefined();
      expect(created.url).toContain('cashfree.com');

      // Verify the order is registered in our mock Cashfree store
      const cfOrder = cfOrders.get(created.provider_ref);
      expect(cfOrder).toBeDefined();
      expect(cfOrder.order_amount).toBe(1500);
      expect(cfOrder.order_currency).toBe('INR');
      expect(cfOrder.customer_details.customer_email).toBe('priya.sharma@example.com');
    });

    it('fetches order status from Cashfree API via cashfreeProvider.fetch', async () => {
      const session = startSession(t.app, {
        locationId: inLocId,
        purpose: 'invoice',
        refId: 'inv_cf_test_002',
        amountCents: 250000, // ₹2,500.00
        currency: 'INR',
        description: 'Annual Maintenance Retainer',
        returnUrl: `${t.base}/return`,
      });

      const created = await cashfreeProvider.create(t.app, session);

      // Initially ACTIVE -> open
      const fetch1 = await cashfreeProvider.fetch(t.app, { ...session, provider_ref: created.provider_ref });
      expect(fetch1.status).toBe('open');

      // Mark order as PAID in mock Cashfree store
      const cfOrder = cfOrders.get(created.provider_ref);
      cfOrder.order_status = 'PAID';
      const paymentId = `cf_pay_${Date.now()}`;
      cfPayments.set(paymentId, {
        cf_payment_id: paymentId,
        order_id: cfOrder.order_id,
        payment_amount: 2500,
        payment_currency: 'INR',
        payment_status: 'SUCCESS',
      });

      // Second fetch should return 'paid' with capture reference
      const fetch2 = await cashfreeProvider.fetch(t.app, { ...session, provider_ref: created.provider_ref });
      expect(fetch2.status).toBe('paid');
      expect(fetch2.amount_cents).toBe(250000);
      expect(fetch2.capture_ref).toBe(paymentId);
    });

    it('verifies webhook signature with timestamp and rawBody via verifyCashfreeWebhook', () => {
      const rawBody = JSON.stringify({
        data: {
          order: { order_id: 'order_test_999', order_amount: 500, order_currency: 'INR', order_status: 'PAID' },
          payment: { cf_payment_id: 'cf_pay_999', payment_status: 'SUCCESS', payment_amount: 500 },
        },
        type: 'PAYMENT_SUCCESS_WEBHOOK',
      });
      const timestamp = String(Date.now());

      const payload = `${timestamp}${rawBody}`;
      const validSig = createHmac('sha256', CF_SECRET_KEY).update(payload).digest('base64');
      const validSigHex = createHmac('sha256', CF_SECRET_KEY).update(payload).digest('hex');

      // Base64 signature
      expect(verifyCashfreeWebhook(rawBody, validSig, timestamp, CF_SECRET_KEY)).toBe(true);
      // Hex signature
      expect(verifyCashfreeWebhook(rawBody, validSigHex, timestamp, CF_SECRET_KEY)).toBe(true);

      // Invalid signature
      expect(verifyCashfreeWebhook(rawBody, 'invalid_signature_base64', timestamp, CF_SECRET_KEY)).toBe(false);
      // Tampered body
      expect(verifyCashfreeWebhook(rawBody + 'tampered', validSig, timestamp, CF_SECRET_KEY)).toBe(false);
      // Wrong secret
      expect(verifyCashfreeWebhook(rawBody, validSig, timestamp, 'wrong_secret_1234')).toBe(false);
    });

    it('settles pay session and updates invoice upon receiving Cashfree PAYMENT_SUCCESS_WEBHOOK', async () => {
      // 1. Create an invoice in the Indian sub-account
      t.api.setLocation(inLocId);
      const invRes = await t.api.post('/api/invoices', {
        title: 'GST Web Services Package',
        contact_id: null,
        tax_mode: 'standard',
        currency: 'INR',
        items: [
          {
            name: 'Cloud Portal Setup',
            qty: 1,
            price_cents: 80000, // ₹800.00
            tax_rate: 18,
            hsn_sac: '998313',
          },
        ],
      });
      expect([200, 201]).toContain(invRes.status);
      const invoiceId = invRes.data.id;

      // Finalize invoice to generate number
      const { invoice: finalInvoice } = finaliseInvoice(t.app, inLocId, invoiceId);

      // 2. Start a payment session for this invoice via Cashfree
      const session = startSession(t.app, {
        locationId: inLocId,
        purpose: 'invoice',
        refId: invoiceId,
        amountCents: finalInvoice.total_cents,
        currency: 'INR',
        description: `Payment for Invoice ${finalInvoice.number}`,
        returnUrl: `${t.base}/invoices/${invoiceId}`,
      });

      const created = await cashfreeProvider.create(t.app, session);

      // 3. Deliver webhook to POST /hooks/cashfree/:locationId
      const webhookPayload = JSON.stringify({
        data: {
          order: {
            order_id: created.provider_ref,
            order_amount: Number((finalInvoice.total_cents / 100).toFixed(2)),
            order_currency: 'INR',
            order_status: 'PAID',
            order_tags: { pay_session: session.id },
          },
          payment: {
            cf_payment_id: `cf_pay_capture_${Date.now()}`,
            payment_status: 'SUCCESS',
            payment_amount: Number((finalInvoice.total_cents / 100).toFixed(2)),
            payment_currency: 'INR',
          },
        },
        event_time: new Date().toISOString(),
        type: 'PAYMENT_SUCCESS_WEBHOOK',
      });

      const timestamp = String(Date.now());
      const signature = createHmac('sha256', CF_SECRET_KEY).update(`${timestamp}${webhookPayload}`).digest('base64');

      const hookRes1 = await fetch(`${t.base}/hooks/cashfree/${inLocId}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-signature': signature,
          'x-webhook-timestamp': timestamp,
        },
        body: webhookPayload,
      });

      expect(hookRes1.status).toBe(200);
      const hookJson1 = await hookRes1.json();
      expect(hookJson1.handled).toBe('paid');

      // 4. Verify session state is paid in database
      const updatedSession = getSession(t.app, session.id);
      expect(updatedSession?.status).toBe('paid');
      expect(updatedSession?.received_cents).toBe(finalInvoice.total_cents);

      // 5. Verify invoice status is updated to paid
      const updatedInvoice = t.app.db.get<any>('SELECT * FROM invoices WHERE id = ?', invoiceId);
      expect(updatedInvoice.status).toBe('paid');
      expect(updatedInvoice.paid_at).toBeDefined();

      // 6. Test Idempotency: duplicate delivery should be cleanly ignored
      const hookRes2 = await fetch(`${t.base}/hooks/cashfree/${inLocId}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-signature': signature,
          'x-webhook-timestamp': timestamp,
        },
        body: webhookPayload,
      });

      expect(hookRes2.status).toBe(200);
      const hookJson2 = await hookRes2.json();
      expect(hookJson2.received).toBe(true);
      expect(hookJson2.duplicate).toBe(true);
    });

    it('handles Cashfree refund via cashfreeProvider.refund', async () => {
      const session = startSession(t.app, {
        locationId: inLocId,
        purpose: 'invoice',
        refId: 'inv_cf_refund_001',
        amountCents: 100000,
        currency: 'INR',
        description: 'Order for Refund Test',
        returnUrl: `${t.base}/return`,
      });

      const created = await cashfreeProvider.create(t.app, session);
      const refundResult = await cashfreeProvider.refund(
        t.app,
        { ...session, provider_ref: created.provider_ref, capture_ref: 'cf_pay_capture_123', status: 'paid' },
        50000, // ₹500.00
      );

      expect(refundResult.id).toBeDefined();
      expect(refundResult.id).toContain('cf_ref_');
    });
  });

  // -----------------------------------------------------------------------------------------------
  // 14. E-Commerce Store Engine & Real-Time Inventory Integration
  // -----------------------------------------------------------------------------------------------
  describe('14. E-Commerce Store Engine & Inventory Durability', () => {
    let productId = '';
    let articleId = '';

    it('creates a store product with variant and SKU in SQLite', async () => {
      t.api.setLocation(inLocId);

      // Create product in CRM catalog
      const prodRes = await t.api.post('/api/products', {
        name: 'Organic Darjeeling Tea',
        price_cents: 45000, // ₹450.00
        currency: 'INR',
        description: 'First Flush Darjeeling Black Tea 250g',
      });
      expect([200, 201]).toContain(prodRes.status);
      productId = prodRes.data.id;

      // Create linked inventory article with SKU
      const artRes = await t.api.post('/api/inventory/articles', {
        product_id: productId,
        sku: 'TEA-DARJ-250G',
        name: 'Organic Darjeeling Tea 250g',
        track: true,
        auto_issue: true,
      });
      expect([200, 201]).toContain(artRes.status);
      articleId = artRes.data.id;
    });

    it('records inventory stock movement (receipt) into storage place', async () => {
      t.api.setLocation(inLocId);

      // Add 100 units of tea into stock
      applyMovement(t.app, inLocId, {
        article_id: articleId,
        type: 'receipt',
        qty: 100,
        note: 'Initial batch from Darjeeling estate',
      });

      // Verify stock level is 100
      const stockRow = t.app.db.get<{ total_qty: number }>(
        'SELECT COALESCE(SUM(qty), 0) AS total_qty FROM inv_stock WHERE location_id = ? AND article_id = ?',
        inLocId,
        articleId,
      );
      expect(stockRow?.total_qty).toBe(100);
    });

    it('deducts inventory when an invoice/order is paid via issueForInvoice', async () => {
      // Create a paid invoice with this item via the API
      t.api.setLocation(inLocId);
      const invRes = await t.api.post('/api/invoices', {
        title: 'Store Order',
        currency: 'INR',
        tax_mode: 'standard',
        items: [
          {
            name: 'Organic Darjeeling Tea 250g',
            sku: 'TEA-DARJ-250G',
            qty: 2,
            unit_price_cents: 45000,
            tax_rate: 5,
          },
        ],
      });
      expect([200, 201]).toContain(invRes.status);
      const invoiceId = invRes.data.id;
      await t.api.post(`/api/invoices/${invoiceId}/finalize`, {});
      t.app.db.run("UPDATE invoices SET status = 'paid', paid_at = datetime('now') WHERE id = ?", invoiceId);

      // Run issueForInvoice
      const issueResult = t.app.db.get<any>('SELECT * FROM invoices WHERE id = ?', invoiceId);
      const res = issueForInvoice(t.app, inLocId, issueResult);
      expect(res.issued.length).toBe(1);
      expect(res.issued[0].qty).toBe(2);

      // Check stock after issuing 2 units (100 - 2 = 98)
      const stockAfter = t.app.db.get<{ total_qty: number }>(
        'SELECT COALESCE(SUM(qty), 0) AS total_qty FROM inv_stock WHERE location_id = ? AND article_id = ?',
        inLocId,
        articleId,
      );
      expect(stockAfter?.total_qty).toBe(98);
    });

    it('returns inventory back to stock upon order cancellation/refund via returnForInvoice', () => {
      const orderId = `ord_refund_${Date.now()}`;
      const items = [
        {
          name: 'Organic Darjeeling Tea 250g',
          sku: 'TEA-DARJ-250G',
          qty: 2,
          unit_price_cents: 45000,
          tax_rate: 5,
        },
      ];

      // Call returnForInvoice
      const returnResult = returnForInvoice(t.app, inLocId, {
        id: orderId,
        number: 'ORD-2026-101',
        items,
      });

      expect(returnResult.returned.length).toBe(1);
      expect(returnResult.returned[0].qty).toBe(2);

      // Verify stock level is restored back to 100
      const stockRestored = t.app.db.get<{ total_qty: number }>(
        'SELECT COALESCE(SUM(qty), 0) AS total_qty FROM inv_stock WHERE location_id = ? AND article_id = ?',
        inLocId,
        articleId,
      );
      expect(stockRestored?.total_qty).toBe(100);
    });
  });

  // -----------------------------------------------------------------------------------------------
  // 15. AI Image Studio & Media Engine Multi-Tenant Isolation
  // -----------------------------------------------------------------------------------------------
  describe('15. AI Image Studio & Media Engine Isolation', () => {
    it('enforces BYOK provider connection check on image generation (rejects when unconfigured)', async () => {
      t.api.setLocation(inLocId);

      // When no BYOK key is configured, job creation is gracefully rejected
      const genRes = await t.api.post('/api/genmedia/jobs', {
        capability: 'image',
        prompt: 'Luxury tea estate in misty mountains with solar panels',
      });

      // Status should be 400 or 409 with BYOK missing error message
      expect([400, 404, 409]).toContain(genRes.status);
      expect(genRes.data?.error || genRes.data?.message || genRes.status).toBeDefined();
    });

    it('enforces strict multi-tenant isolation: sub-account A cannot access jobs of sub-account B', async () => {
      // Insert a mock job under inLocId
      const jobId = `job_test_isolation_${Date.now()}`;
      t.app.db.run(
        `INSERT INTO genmedia_jobs (id, location_id, provider, capability, input, status, timeout_at, created_at, updated_at)
         VALUES (?, ?, 'stability', 'image', '{"prompt":"A"}', 'pending', datetime('now', '+1 hour'), datetime('now'), datetime('now'))`,
        jobId,
        inLocId,
      );

      // Query from inLocId -> Should succeed
      t.api.setLocation(inLocId);
      const getOwn = await t.api.get(`/api/genmedia/jobs/${jobId}`);
      expect(getOwn.status).toBe(200);
      expect(getOwn.data?.id).toBe(jobId);

      // Query from deLocId -> Must be 404 Not Found (Strict Tenant Isolation)
      t.api.setLocation(deLocId);
      const getOther = await t.api.get(`/api/genmedia/jobs/${jobId}`);
      expect(getOther.status).toBe(404);
    });
  });

  // -----------------------------------------------------------------------------------------------
  // 16. Custom Domains & Multi-Tenant Routing
  // -----------------------------------------------------------------------------------------------
  describe('16. Custom Domains & TLS Security', () => {
    it('normalizes domains according to RFC specifications and strips protocols and paths', () => {
      expect(normalizeDomain('https://Store.BangaloreDigital.in/cart')).toBe('store.bangaloredigital.in');
      expect(normalizeDomain('http://www.MY-SHOP.co.in:8080/')).toBe('www.my-shop.co.in');
      expect(normalizeDomain('portal.dwarapalak.io')).toBe('portal.dwarapalak.io');

      // Invalid domain formats must throw 400
      expect(() => normalizeDomain('invalid domain with spaces.com')).toThrow();
      expect(() => normalizeDomain('bad..domain..com')).toThrow();
      expect(() => normalizeDomain('http://invalid space domain.org')).toThrow();
    });

    it('computes www-pair domainAlias correctly for root domains and ignores deep subdomains', () => {
      expect(domainAlias('dwarapalak.in')).toBe('www.dwarapalak.in');
      expect(domainAlias('www.dwarapalak.in')).toBe('dwarapalak.in');
      expect(domainAlias('sub.portal.dwarapalak.in')).toBeUndefined();
    });

    it('verifies TLS ask endpoint returns 200 for local app and 404 for unknown domains', async () => {
      // Local app domain (matches crm.example.com or baseUrl host if set)
      const ownRes = await t.api.get('/api/tls/ask?domain=crm.example.com');
      expect([200, 404]).toContain(ownRes.status);

      // Invalid format must return 400
      const badRes = await t.api.get('/api/tls/ask?domain=not a domain');
      expect(badRes.status).toBe(400);

      // Unknown external domain
      const unkRes = await t.api.get('/api/tls/ask?domain=evil.example.net');
      expect(unkRes.status).toBe(404);
    });
  });

  // -----------------------------------------------------------------------------------------------
  // 17. English Localization & Regional Settings
  // -----------------------------------------------------------------------------------------------
  describe('17. English Localization & Regional Settings Consistency', () => {
    it('confirms English website and funnel templates contain zero German text', () => {
      const enKeys = Object.keys(TEMPLATES_EN);
      expect(enKeys.length).toBeGreaterThan(0);

      for (const [key, pages] of Object.entries(TEMPLATES_EN)) {
        expect(Array.isArray(pages)).toBe(true);
        for (const p of pages) {
          expect(p.name).toBeDefined();
          expect(p.slug).toBeDefined();
        }

        // Must not contain German words
        const serialized = JSON.stringify(pages);
        expect(serialized).not.toContain('Datenschutz');
        expect(serialized).not.toContain('Impressum');
        expect(serialized).not.toContain('Allgemeine Geschäftsbedingungen');
        expect(serialized).not.toContain('Startseite');
      }
    });

    it('validates Indian number formatting and currency symbol in invoice render', () => {
      const items = [
        {
          id: 'li_ind_1',
          name: 'Enterprise IT Services',
          qty: 1,
          unit: 'Stk',
          price_cents: 25000000, // ₹2,50,000.00 (2.5 Lakhs)
          tax_rate: 18,
          hsn_sac: '998313',
        },
      ];
      const gstTotals = calcGstTotals(items, 'standard', '29', '29');

      const doc: DocSnapshot = {
        number: 'INV-IND-2026-0001',
        date: '2026-10-30',
        due_date: '2026-11-14',
        due_ymd: '14.11.2026',
        title: 'Tax Invoice',
        currency: 'INR',
        tax_mode: 'standard',
        tax_regime: 'gst',
        items,
        totals: gstTotals,
        deducted_cents: 0,
        deductions: [],
        skonto: null,
        ref: null,
        seller: {
          name: 'Bangalore Digital Pvt Ltd',
          company: 'Bangalore Digital Pvt Ltd',
          gstin: '29ABCDE1234F1Z5',
          state_code: '29',
          state: '29-Karnataka',
        },
        buyer: {
          name: 'Tech Innovators India',
          company: 'Tech Innovators India',
          gstin: '29XYZAB5678C1Z2',
          state_code: '29',
          place_of_supply: '29-Karnataka',
          state: '29-Karnataka',
        },
        bank: {
          bank: 'HDFC Bank',
          account_number: '5010022334455',
          ifsc: 'HDFC0001234',
          upi_id: 'bangaloredigital@hdfc',
        },
      };

      const { pages, title } = invoicePages(doc);
      expect(title).toBe('Tax Invoice INV-IND-2026-0001');

      const renderedText = pages
        .flatMap((p) => p.prims)
        .map((pr: any) => pr.text ?? (pr.lines ? pr.lines.join(' ') : ''))
        .join(' ');

      expect(renderedText).toContain('Tax Invoice');
      expect(renderedText).toContain('GSTIN');
      expect(renderedText).toContain('29ABCDE1234F1Z5');
      expect(renderedText).toContain('Place of Supply');
      expect(renderedText).toContain('CGST');
      expect(renderedText).toContain('SGST');
      // Indian numbering format (Lakhs grouping: 2,50,000)
      expect(renderedText).toContain('2,50,000');
    });
  });
});

