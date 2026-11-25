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
 * Razorpay Payment Integration (India Stack):
 * Supports INR payments, UPI (GPay, PhonePe, Paytm, BHIM), Cards, Netbanking and Wallets.
 * Creates hosted checkout orders and payment links, validates server-side webhook signatures via HMAC-SHA256,
 * and handles order settlement, refunds, and failed states.
 */

export const RAZORPAY_EVENTS = [
  'order.paid',
  'payment.captured',
  'payment.failed',
  'refund.processed',
];

const API_BASE = 'https://api.razorpay.com/v1';

export function isRazorpayKey(key: string): boolean {
  return /^rzp_(test|live)_[A-Za-z0-9]+$/.test(key);
}

function authHeader(acc: Account): string {
  const { key_id, key_secret } = acc.secrets;
  return `Basic ${Buffer.from(`${key_id ?? ''}:${key_secret ?? ''}`).toString('base64')}`;
}

/** One call to the Razorpay REST API with the sub-account's credentials. */
export async function razorpayApi(
  app: App,
  acc: Account,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<any> {
  return payJson(app, 'Razorpay', `${API_BASE}${path}`, {
    method,
    headers: {
      authorization: authHeader(acc),
      'content-type': 'application/json',
      accept: 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Proves the credentials (makes a lightweight call) for the settings page. */
export async function testRazorpay(app: App, acc: Account): Promise<{ ok: true; mode: string }> {
  const { key_id, key_secret } = acc.secrets;
  if (!key_id || !key_secret) throw new Error('Razorpay Key-ID und Key-Secret erforderlich');
  // Probe Razorpay API
  await razorpayApi(app, acc, 'GET', '/orders?count=1');
  return { ok: true, mode: key_id.startsWith('rzp_live_') ? 'live' : 'test' };
}

/**
 * Validates Razorpay webhook signature (HMAC-SHA256 of raw request body using webhook_secret).
 */
export function verifyRazorpayWebhook(
  rawBody: string,
  signature: string | string[] | undefined,
  webhookSecret: string,
): boolean {
  if (!rawBody || !signature || !webhookSecret) return false;
  const sig = String(Array.isArray(signature) ? signature[0] : signature).trim();
  try {
    const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Extracts provider state from a Razorpay payment or order response. */
export function paymentState(p: any): ProviderState {
  const status = p?.status;
  const amount = p?.amount !== undefined ? Math.round(Number(p.amount)) : undefined;
  const currency = p?.currency;
  const capture_ref = p?.id ?? '';
  if (status === 'captured') {
    return { status: 'paid', amount_cents: amount, currency, capture_ref };
  }
  if (status === 'authorized') {
    return { status: 'pending', amount_cents: amount, currency, capture_ref };
  }
  if (status === 'failed') {
    return { status: 'failed', amount_cents: amount, currency, capture_ref };
  }
  return { status: 'open', amount_cents: amount, currency, capture_ref };
}

export const razorpayProvider: PayProvider = {
  id: 'razorpay',
  label: 'Razorpay (UPI, Cards, Netbanking)',
  methods: (_app, _loc) => ['UPI', 'Kredit- und Debitkarte', 'Netbanking', 'Wallets'],
  ready: (app, loc) => {
    const a = accountOf(app, loc, 'razorpay');
    return !!(a?.secrets?.key_id && a?.secrets?.key_secret);
  },
  async create(app, s) {
    const acc = accountOf(app, s.location_id, 'razorpay');
    if (!acc?.secrets?.key_id || !acc.secrets.key_secret) {
      throw new Error('Razorpay ist für diesen Sub-Account nicht eingerichtet');
    }

    // 1. Create Order on Razorpay
    const order = await razorpayApi(app, acc, 'POST', '/orders', {
      amount: s.amount_cents,
      currency: s.currency || 'INR',
      receipt: s.id.slice(0, 40),
      notes: {
        pay_session: s.id,
        location_id: s.location_id,
        purpose: s.purpose,
      },
    });

    // 2. Generate Razorpay Payment Link for hosted checkout with UPI
    let checkoutUrl = '';
    try {
      const plink = await razorpayApi(app, acc, 'POST', '/payment_links', {
        amount: s.amount_cents,
        currency: s.currency || 'INR',
        accept_partial: false,
        reference_id: s.id,
        description: s.description || 'Order Payment',
        customer: {
          name: s.meta.name || undefined,
          email: s.meta.email || undefined,
        },
        callback_url: s.meta.return_url,
        callback_method: 'get',
        notes: {
          order_id: order.id,
          pay_session: s.id,
        },
      });
      checkoutUrl = plink.short_url || plink.url || '';
    } catch {
      // Fallback checkout link using order ID
      checkoutUrl = `https://api.razorpay.com/v1/checkout/embedded?order_id=${order.id}`;
    }

    return {
      provider_ref: order.id,
      url: checkoutUrl || `https://api.razorpay.com/v1/checkout/embedded?order_id=${order.id}`,
    };
  },
  async fetch(app, s) {
    const acc = accountOf(app, s.location_id, 'razorpay');
    if (!acc) throw new Error('Razorpay-Konto nicht gefunden');
    const order = await razorpayApi(app, acc, 'GET', `/orders/${encodeURIComponent(s.provider_ref)}`);
    if (order.status === 'paid') {
      const payments = await razorpayApi(app, acc, 'GET', `/orders/${encodeURIComponent(s.provider_ref)}/payments`);
      const captured = payments?.items?.find((p: any) => p.status === 'captured') || payments?.items?.[0];
      return {
        status: 'paid',
        amount_cents: captured?.amount ?? s.amount_cents,
        currency: captured?.currency ?? s.currency,
        capture_ref: captured?.id ?? '',
      };
    }
    return { status: 'open' };
  },
  async refund(app, s, amountCents) {
    const acc = accountOf(app, s.location_id, 'razorpay');
    if (!acc) throw new Error('Razorpay-Konto nicht gefunden');
    const paymentId = s.capture_ref;
    if (!paymentId) throw new Error('Keine erfasste Zahlung zum Erstatten gefunden');
    const res = await razorpayApi(app, acc, 'POST', `/payments/${encodeURIComponent(paymentId)}/refund`, {
      amount: amountCents,
      notes: { pay_session: s.id },
    });
    return { id: res.id };
  },
};

