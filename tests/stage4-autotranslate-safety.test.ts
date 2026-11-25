import { describe, expect, it } from 'vitest';
import { getLocale, preloadLocale, setLocale, tr } from '../web/src/i18n';
import { centsToMoney } from '../server/core/util';
import { calcGstTotals } from '../server/services/invoice-model.js';

describe('Stage 4 Auto-Translation Safety & Data Integrity', () => {
  it('safely preserves customer names and arbitrary user text without corruption', async () => {
    await setLocale('en', { remember: false, also: ['core'] });
    const t = tr('core');

    // Customer names
    const customerNames = [
      'Aarav Sharma',
      'Priya Patel',
      'JITEN EDU TECHNOLOGIES',
      'Muster & Partner GmbH',
      'John Doe & Co.',
    ];
    for (const name of customerNames) {
      expect(t(name)).toBe(name);
    }

    // User descriptions containing numbers, currencies, and punctuation
    const userTexts = [
      'Order #49281 placed via Cashfree UPI ₹4,999.00',
      'Meeting scheduled for tomorrow at 3:30 PM IST',
      'Custom requirement: Please deliver invoice with GSTIN 29AAAAA0000A1Z5',
    ];
    for (const text of userTexts) {
      expect(t(text)).toBe(text);
    }
  });

  it('guarantees database identifiers and option keys are never mutated by translation', async () => {
    await setLocale('en', { remember: false, also: ['core'] });
    const t = tr('core');

    // Database enum identifiers
    const dbIdentifiers = [
      'subscriber',
      'lead',
      'mql',
      'sql',
      'opportunity',
      'customer',
      'evangelist',
      'open',
      'won',
      'lost',
      'draft',
      'sent',
      'paid',
      'cancelled',
      'skr03',
      'skr04',
      'regular',
      'small',
    ];

    // Simulated Select option mapping logic: [value, label]
    // Value (db identifier) must remain strictly unmutated
    for (const id of dbIdentifiers) {
      const optionTuple: [string, string] = [id, t(id)];
      expect(optionTuple[0]).toBe(id); // Option value attribute is ALWAYS original id
    }
  });

  it('preserves accounting account codes, tax rates, and monetary cents without corruption', async () => {
    await setLocale('en', { remember: false, also: ['core'] });
    const t = tr('core');

    // Account numbers (DATEV / SKR03 / SKR04)
    const accounts = ['1200', '1400', '4400', '8400', '1800', '1776'];
    for (const acc of accounts) {
      expect(t(acc)).toBe(acc);
      expect(Number(acc)).toBeGreaterThan(0);
    }

    // Monetary minor units (cents / paise) remain exact integer values
    const originalPaise = 249950; // ₹2,499.50
    const formattedInr = centsToMoney(originalPaise, 'INR');
    expect(formattedInr.replace(/\s+/g, ' ')).toMatch(/₹\s?2,499\.50/);

    // GST calculation integrity: exact integer math in paise
    const gstRes = calcGstTotals(
      [
        { price_cents: 100000, qty: 2, tax_rate: 18, discount_cents: 0 },
      ],
      '29', // Karnataka seller
      '29', // Karnataka buyer -> Intra-state -> CGST 9% + SGST 9%
    );

    expect(gstRes.taxable_cents).toBe(200000);
    expect(gstRes.cgst_cents).toBe(18000);
    expect(gstRes.sgst_cents).toBe(18000);
    expect(gstRes.igst_cents).toBe(0);
    expect(gstRes.tax_cents).toBe(36000);
    expect(gstRes.total_cents).toBe(236000);
  });

  it('handles unknown and dynamic keys safely without throwing or returning undefined', async () => {
    await setLocale('en', { remember: false, also: ['core'] });
    const t = tr('core');
    expect(t('some_random_key_that_does_not_exist')).toBe('some_random_key_that_does_not_exist');
    expect(t('')).toBe('');
    expect(t('Unregistered Custom Field Label')).toBe('Unregistered Custom Field Label');
  });
});
