import { createHmac, timingSafeEqual } from 'node:crypto';
import type { App } from '../core/app.js';
import {
  accountOf,
  payJson,
  type Account,
  type PayProvider,
  type ProviderState,
} from './pay-registry.js';

/**
 * Cashfree Payment Gateway Integration (India Stack):
 * Supports INR payments, UPI (Google Pay, PhonePe, Paytm, BHIM, Cred), Cards (Visa, MasterCard, RuPay),
 * Netbanking across 50+ banks, Wallets, and Pay Later.
 * Creates orders, provides payment session URLs, verifies HMAC-SHA256 webhook signatures,
 * and handles order settlement, refunds, and failed states.
 */

export const CASHFREE_EVENTS = [
  'PAYMENT_SUCCESS_WEBHOOK',
  'PAYMENT_FAILED_WEBHOOK',
  'PAYMENT_USER_DROPPED_WEBHOOK',
  'REFUND_STATUS_WEBHOOK',
  'order.paid',
];

const API_BASE_SANDBOX = 'https://sandbox.cashfree.com/pg';
const API_BASE_PROD = 'https://api.cashfree.com/pg';

export function isCashfreeAppId(key: string): boolean {
  return /^[A-Za-z0-9_.-]{4,100}$/.test(key);
}

export function cashfreeBaseUrl(acc: Account): string {
  const mode = String(acc.secrets.mode || acc.options.mode || '').toLowerCase();
  return mode === 'live' || mode === 'production' ? API_BASE_PROD : API_BASE_SANDBOX;
}

export function cashfreeHeaders(acc: Account): Record<string, string> {
  const { app_id, secret_key } = acc.secrets;
  return {
    'x-client-id': app_id ?? '',
    'x-client-secret': secret_key ?? '',
    'x-api-version': '2023-08-01',
    'content-type': 'application/json',
    accept: 'application/json',
  };
}

/** One call to the Cashfree PG REST API with the sub-account's credentials. */
export async function cashfreeApi(
  app: App,
  acc: Account,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<any> {
  const baseUrl = cashfreeBaseUrl(acc);
  return payJson(app, 'Cashfree', `${baseUrl}${path}`, {
    method,
    headers: {
      ...cashfreeHeaders(acc),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Proves the credentials (makes a lightweight call) for the settings page. */
export async function testCashfree(app: App, acc: Account): Promise<{ ok: true; mode: string }> {
  const { app_id, secret_key } = acc.secrets;
  if (!app_id || !secret_key) throw new Error('Cashfree App-ID und Secret-Key erforderlich');
  const mode = cashfreeBaseUrl(acc) === API_BASE_PROD ? 'live' : 'sandbox';
  // Probe Cashfree API (orders list with limit 1)
  await cashfreeApi(app, acc, 'GET', '/orders?order_limit=1');
  return { ok: true, mode };
}

/**
 * Validates Cashfree webhook signature (HMAC-SHA256 of timestamp + raw request body using secret_key).
 */
export function verifyCashfreeWebhook(
  rawBody: string,
  signature: string | string[] | undefined,
  timestamp: string | string[] | undefined,
  webhookSecret: string,
): boolean {
  if (!rawBody || !signature || !webhookSecret) return false;
  const sig = String(Array.isArray(signature) ? signature[0] : signature).trim();
  const ts = timestamp ? String(Array.isArray(timestamp) ? timestamp[0] : timestamp).trim() : '';

  try {
    const payload = ts ? `${ts}${rawBody}` : rawBody;
    const hmac = createHmac('sha256', webhookSecret).update(payload);
    
    // Check both Base64 and Hex encodings
    const expectedBase64 = hmac.digest('base64');
    const expectedHex = createHmac('sha256', webhookSecret).update(payload).digest('hex');

    const checkMatch = (expected: string) => {
      if (sig.length !== expected.length) return false;
      const a = Buffer.from(sig, 'utf8');
      const b = Buffer.from(expected, 'utf8');
      return timingSafeEqual(a, b);
    };

    return checkMatch(expectedBase64) || checkMatch(expectedHex);
  } catch {
    return false;
  }
}

/** Extracts provider state from a Cashfree order or payment response. */
export function cashfreePaymentState(order: any, payment?: any): ProviderState {
  const orderStatus = String(order?.order_status ?? '').toUpperCase();
  const paymentStatus = String(payment?.payment_status ?? '').toUpperCase();

  const amountRupees = payment?.payment_amount ?? order?.order_amount;
  const amountCents = amountRupees !== undefined ? Math.round(Number(amountRupees) * 100) : undefined;
  const currency = payment?.payment_currency || order?.order_currency || 'INR';
  const capture_ref = String(payment?.cf_payment_id ?? order?.cf_order_id ?? '');

  if (orderStatus === 'PAID' || paymentStatus === 'SUCCESS') {
    return { status: 'paid', amount_cents: amountCents, currency, capture_ref };
  }
  if (paymentStatus === 'PENDING' || orderStatus === 'ACTIVE') {
    return { status: 'pending', amount_cents: amountCents, currency, capture_ref };
  }
  if (orderStatus === 'EXPIRED') {
    return { status: 'expired', amount_cents: amountCents, currency, capture_ref };
  }
  if (orderStatus === 'TERMINATED' || paymentStatus === 'FAILED' || paymentStatus === 'USER_DROPPED') {
    return { status: 'failed', amount_cents: amountCents, currency, capture_ref };
  }
  return { status: 'open', amount_cents: amountCents, currency, capture_ref };
}

export const cashfreeProvider: PayProvider = {
  id: 'cashfree',
  label: 'Cashfree (UPI, Cards, Netbanking)',
  methods: (_app, _loc) => ['UPI', 'Kredit- und Debitkarte', 'Netbanking', 'Wallets', 'Pay Later'],
  ready: (app, loc) => {
    const a = accountOf(app, loc, 'cashfree');
    return !!(a?.secrets?.app_id && a?.secrets?.secret_key);
  },
  async create(app, s) {
    const acc = accountOf(app, s.location_id, 'cashfree');
    if (!acc?.secrets?.app_id || !acc.secrets.secret_key) {
      throw new Error('Cashfree ist für diesen Sub-Account nicht eingerichtet');
    }

    const orderAmount = Number((s.amount_cents / 100).toFixed(2));
    const orderId = s.id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 45) || `cf_${Date.now()}`;
    const customerId = (s.meta.email ? s.meta.email.replace(/[^A-Za-z0-9_-]/g, '_') : s.id).slice(0, 45) || 'cust_default';
    const customerPhone = String(s.meta.phone || '9999999999').replace(/[^0-9]/g, '').slice(-10) || '9999999999';

    // Create Order on Cashfree
    const order = await cashfreeApi(app, acc, 'POST', '/orders', {
      order_id: orderId,
      order_amount: orderAmount,
      order_currency: s.currency || 'INR',
      customer_details: {
        customer_id: customerId,
        customer_email: s.meta.email || 'customer@example.com',
        customer_phone: customerPhone,
        customer_name: s.meta.name || undefined,
      },
      order_meta: {
        return_url: s.meta.return_url
          ? `${s.meta.return_url}${s.meta.return_url.includes('?') ? '&' : '?'}cf_order_id={order_id}`
          : undefined,
        notify_url: `${app.baseUrl()}/hooks/cashfree/${s.location_id}`,
      },
      order_note: (s.description || 'Order Payment').slice(0, 200),
      order_tags: {
        pay_session: s.id,
        location_id: s.location_id,
      },
    });

    const isSandbox = cashfreeBaseUrl(acc) === API_BASE_SANDBOX;
    const checkoutHost = isSandbox ? 'payments-test.cashfree.com' : 'payments.cashfree.com';
    const defaultCheckout = order.payment_session_id
      ? `https://${checkoutHost}/order/#${order.payment_session_id}`
      : `https://${checkoutHost}/orders/${order.order_id || orderId}`;

    const checkoutUrl = order.payment_link || defaultCheckout;

    return {
      provider_ref: String(order.order_id || order.cf_order_id || orderId),
      url: checkoutUrl,
    };
  },
  async fetch(app, s) {
    const acc = accountOf(app, s.location_id, 'cashfree');
    if (!acc) throw new Error('Cashfree-Konto nicht gefunden');

    const order = await cashfreeApi(app, acc, 'GET', `/orders/${encodeURIComponent(s.provider_ref)}`);
    if (order.order_status === 'PAID') {
      let captureRef = String(order.cf_order_id ?? s.provider_ref);
      try {
        const payments = await cashfreeApi(app, acc, 'GET', `/orders/${encodeURIComponent(s.provider_ref)}/payments`);
        const successful = Array.isArray(payments) ? payments.find((p: any) => p.payment_status === 'SUCCESS') : undefined;
        if (successful?.cf_payment_id) {
          captureRef = String(successful.cf_payment_id);
        }
      } catch {
        // Fall back to order ID
      }
      return {
        status: 'paid',
        amount_cents: Math.round(Number(order.order_amount) * 100),
        currency: order.order_currency || s.currency,
        capture_ref: captureRef,
      };
    }
    if (order.order_status === 'EXPIRED') {
      return { status: 'expired' };
    }
    if (order.order_status === 'TERMINATED') {
      return { status: 'failed' };
    }
    return { status: 'open' };
  },
  async refund(app, s, amountCents) {
    const acc = accountOf(app, s.location_id, 'cashfree');
    if (!acc) throw new Error('Cashfree-Konto nicht gefunden');

    const refundAmount = Number((amountCents / 100).toFixed(2));
    const refundId = `rf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const res = await cashfreeApi(app, acc, 'POST', `/orders/${encodeURIComponent(s.provider_ref)}/refunds`, {
      refund_amount: refundAmount,
      refund_id: refundId,
      refund_note: `Refund for session ${s.id}`.slice(0, 100),
    });

    return { id: String(res.cf_refund_id || res.refund_id || refundId) };
  },
};

