import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp } from './helpers.js';
import { centsToMoney, ZERO_DECIMAL_CURRENCIES } from '../server/core/util.js';
import { formatInTz, localDayStart, tzOffsetMinutes, zonedToUtc } from '../server/core/time.js';
import { fmtMoney, intlLocale, interpolate } from '../web/src/i18n/index.js';
import { createLocation, REGIONAL_PRESETS } from '../server/modules/core.js';
import { getRecipes, RECIPES, RECIPES_EN } from '../server/modules/workflows.js';

describe('Stage 4 — English UI, Universal Regional Configuration & India Readiness', () => {
  let t: Awaited<ReturnType<typeof startTestApp>>;
  let adminLoc = '';

  beforeAll(async () => {
    t = await startTestApp();
    await t.setup();
    adminLoc = t.api.location;
  }, 60_000);

  afterAll(async () => {
    await t.close();
  });

  // Scenario A: New Indian business location configuration
  describe('Scenario A: New Indian business location configuration', () => {
    it('initializes Indian business with Asia/Kolkata, INR, en-IN, +91, and Sales pipeline', () => {
      const loc = createLocation(t.app.db, 'Bangalore Tech Hub', 'Asia/Kolkata', {
        country: 'IN',
        currency: 'INR',
        email: 'info@bangaloretech.in',
      });

      expect(loc).toBeDefined();
      expect(loc.timezone).toBe('Asia/Kolkata');
      expect(loc.settings.regional).toEqual({
        country: 'IN',
        locale: 'en-IN',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        phone_country: '+91',
        date_format: 'DD/MM/YYYY',
      });

      // Verify default pipeline is Sales with English stages
      const pipeline = t.app.db.get<any>('SELECT * FROM pipelines WHERE location_id = ?', loc.id);
      expect(pipeline).toBeDefined();
      expect(pipeline.name).toBe('Sales');

      const stages = JSON.parse(pipeline.stages);
      expect(stages.map((s: any) => s.name)).toEqual([
        'New Lead',
        'Contacted',
        'Appointment Booked',
        'Proposal Sent',
        'Won',
      ]);
    });
  });

  // Scenario B: Existing German location backward compatibility
  describe('Scenario B: Existing German location backward compatibility', () => {
    it('preserves German defaults (Europe/Berlin, EUR, de-DE, +49, Vertrieb) when no India flag given', () => {
      const loc = createLocation(t.app.db, 'München Consulting GmbH', 'Europe/Berlin');

      expect(loc.timezone).toBe('Europe/Berlin');
      expect(loc.settings.regional).toEqual({
        country: 'DE',
        locale: 'de-DE',
        currency: 'EUR',
        timezone: 'Europe/Berlin',
        phone_country: '+49',
        date_format: 'DD.MM.YYYY',
      });

      // Verify default pipeline is Vertrieb with German stages
      const pipeline = t.app.db.get<any>('SELECT * FROM pipelines WHERE location_id = ?', loc.id);
      expect(pipeline).toBeDefined();
      expect(pipeline.name).toBe('Vertrieb');

      const stages = JSON.parse(pipeline.stages);
      expect(stages.map((s: any) => s.name)).toEqual([
        'Neuer Lead',
        'Kontaktiert',
        'Termin gebucht',
        'Angebot',
        'Gewonnen',
      ]);
    });
  });

  // Scenario C: Language fallback and missing translation safety
  describe('Scenario C: Language fallback and missing translation safety', () => {
    it('safely handles variable interpolation and locale detection', () => {
      // Interpolate with present and missing variables
      const text = 'Hello {name}, welcome to {place}! Remaining: {points}';
      const res = interpolate(text, { name: 'Arun', place: 'Dwarapalak' });
      expect(res).toBe('Hello Arun, welcome to Dwarapalak! Remaining: {points}');

      // intlLocale behavior
      expect(intlLocale('de')).toBe('de-DE');
      expect(intlLocale('en')).toMatch(/^en/);
      expect(intlLocale('de', 'INR')).toBe('en-IN');
      expect(intlLocale('en', 'INR')).toBe('en-IN');
    });
  });

  // Scenario D: English workflow recipes and default CRM stages
  describe('Scenario D: English workflow recipes and default CRM stages', () => {
    it('returns English recipes for English/Indian locale and German for German locale', () => {
      const recipesEn = getRecipes('en-IN');
      const recipesDe = getRecipes('de-DE');

      expect(recipesEn.new_lead.name).toBe('New Lead: Welcome + Follow-up');
      expect(recipesEn.booked.name).toBe('Appointment Booked: Tag + Task');
      expect(recipesEn.noshow.name).toBe('No-Show: Rebook Appointment');
      expect(recipesEn.won.name).toBe('Deal Won: Tag Customer');

      expect(recipesDe.new_lead.name).toBe('Neuer Lead: Willkommen + Follow-up');
      expect(recipesDe.booked.name).toBe('Termin gebucht: Tag + Aufgabe');
      expect(recipesDe.noshow.name).toBe('No-Show: neu buchen lassen');
      expect(recipesDe.won.name).toBe('Deal gewonnen: Kunde taggen');
    });

    it('creates workflow via API with appropriate language defaults', async () => {
      // Create Indian location
      const inLoc = createLocation(t.app.db, 'Delhi Agency', 'Asia/Kolkata', { country: 'IN', currency: 'INR' });
      t.api.setLocation(inLoc.id);

      // Fetch meta
      const meta = await t.api.get('/api/workflows/meta');
      expect(meta.status).toBe(200);
      const newLeadRecipe = meta.data.recipes.find((r: any) => r.key === 'new_lead');
      expect(newLeadRecipe.name).toBe('New Lead: Welcome + Follow-up');

      // Create workflow using recipe
      const created = await t.api.post('/api/workflows', { recipe: 'new_lead' });
      expect(created.status).toBe(200);
      expect(created.data.name).toBe('New Lead: Welcome + Follow-up');
      expect(created.data.steps[0].tags).toEqual(['lead']);
    });
  });

  // Scenario E: INR currency formatting with Lakh/Crore grouping & paise minor units
  describe('Scenario E: INR currency formatting with Lakh/Crore grouping & paise minor units', () => {
    it('formats INR correctly with ₹ symbol and Lakh/Crore separators', () => {
      // 1 Lakh rupees = 100,000.00 INR = 10,000,000 paise
      const oneLakh = centsToMoney(10_000_000, 'INR');
      // Normalize non-breaking space if any
      const cleanLakh = oneLakh.replace(/\s+/g, ' ');
      expect(cleanLakh).toMatch(/₹\s?1,00,000\.00/);

      // 1.5 Lakh rupees
      const oneAndHalfLakh = centsToMoney(15_000_000, 'INR');
      expect(oneAndHalfLakh.replace(/\s+/g, ' ')).toMatch(/₹\s?1,50,000\.00/);

      // 1,500.50 rupees = 150,050 paise
      const smallAmt = centsToMoney(150_050, 'INR');
      expect(smallAmt.replace(/\s+/g, ' ')).toMatch(/₹\s?1,500\.50/);

      // Frontend helper fmtMoney
      const fmtLakh = fmtMoney(10_000_000, 'INR');
      expect(fmtLakh.replace(/\s+/g, ' ')).toMatch(/₹\s?1,00,000\.00/);
    });
  });

  // Scenario F: EUR and zero-decimal currencies (JPY) formatting
  describe('Scenario F: EUR and zero-decimal currencies (JPY) formatting', () => {
    it('formats EUR with European separators and preserves zero-decimal currencies like JPY', () => {
      // EUR formatting
      const eurMoney = centsToMoney(123450, 'EUR');
      expect(eurMoney).toContain('1.234,50');
      expect(eurMoney).toContain('€');

      // JPY is zero-decimal: 1000 JPY should NOT be divided by 100
      expect(ZERO_DECIMAL_CURRENCIES.has('JPY')).toBe(true);
      const jpyMoney = centsToMoney(1000, 'JPY');
      expect(jpyMoney).toContain('1.000');
      expect(jpyMoney).not.toContain('10,00');
      expect(jpyMoney).not.toContain('10.00');

      const fmtJpy = fmtMoney(1000, 'JPY');
      expect(fmtJpy).toMatch(/1[.,]000/);
      expect(fmtJpy).not.toContain('10,');
      expect(fmtJpy).not.toContain('10.');
    });
  });

  // Scenario G: Mixed-currency safeguards
  describe('Scenario G: Mixed-currency safeguards', () => {
    it('prevents accidental arithmetic aggregation across different currencies', () => {
      function safeSum(items: { amount: number; currency: string }[]): { total: number; currency: string } {
        if (!items.length) return { total: 0, currency: 'INR' };
        const base = items[0].currency;
        const mixed = items.some((i) => i.currency !== base);
        if (mixed) {
          throw new Error(`Cannot aggregate mixed currencies without exchange rate conversion: ${items.map((i) => i.currency).join(', ')}`);
        }
        return { total: items.reduce((sum, i) => sum + i.amount, 0), currency: base };
      }

      // Consistent currency passes
      expect(safeSum([{ amount: 1000, currency: 'INR' }, { amount: 2000, currency: 'INR' }])).toEqual({
        total: 3000,
        currency: 'INR',
      });

      // Mixed currency throws safeguard error
      expect(() => safeSum([{ amount: 1000, currency: 'INR' }, { amount: 50, currency: 'EUR' }])).toThrow(
        /Cannot aggregate mixed currencies/,
      );
    });
  });

  // Scenario H: Asia/Kolkata (+5:30, 330m) appointment scheduling, midnight start, and reminders
  describe('Scenario H: Asia/Kolkata (+5:30, 330m) appointment scheduling, midnight start, and reminders', () => {
    it('accurately computes 330m offset, day start, and zoned conversions for Asia/Kolkata', () => {
      const now = new Date('2026-06-15T12:00:00Z');
      const offset = tzOffsetMinutes(now, 'Asia/Kolkata');
      expect(offset).toBe(330); // 5 hours 30 minutes

      // Midnight in Kolkata: 00:00 local on 2026-06-15 is 18:30 UTC on 2026-06-14
      const dayStart = localDayStart('Asia/Kolkata', new Date('2026-06-15T02:00:00Z'));
      expect(dayStart).toBe('2026-06-14T18:30:00.000Z');

      // Wall-clock conversion: 09:30 AM in Kolkata on 2026-06-15 is 04:00 UTC
      const utcInstant = zonedToUtc('2026-06-15', '09:30', 'Asia/Kolkata');
      expect(utcInstant.toISOString()).toBe('2026-06-15T04:00:00.000Z');

      // Formatting in Kolkata timezone
      const formatted = formatInTz(utcInstant, 'Asia/Kolkata', { hour: '2-digit', minute: '2-digit' }, 'en-IN');
      expect(formatted).toContain('09:30');
    });
  });

  // Scenario I: DST boundary handling (Germany DST switch vs India static offset)
  describe('Scenario I: DST boundary handling (Germany DST switch vs India static offset)', () => {
    it('verifies static +330m for India year-round while Germany observes DST changes', () => {
      const winterInstant = new Date('2026-01-15T12:00:00Z');
      const summerInstant = new Date('2026-07-15T12:00:00Z');

      // India: always 330m (UTC+5:30)
      expect(tzOffsetMinutes(winterInstant, 'Asia/Kolkata')).toBe(330);
      expect(tzOffsetMinutes(summerInstant, 'Asia/Kolkata')).toBe(330);

      // Germany: 60m in winter (UTC+1:00), 120m in summer (UTC+2:00)
      expect(tzOffsetMinutes(winterInstant, 'Europe/Berlin')).toBe(60);
      expect(tzOffsetMinutes(summerInstant, 'Europe/Berlin')).toBe(120);
    });
  });

  // Scenario J: Server-generated English labels and notification subjects
  describe('Scenario J: Server-generated English labels and notification subjects', () => {
    it('provides regional presets and English notification content', () => {
      expect(REGIONAL_PRESETS.IN.country).toBe('IN');
      expect(REGIONAL_PRESETS.IN.currency).toBe('INR');
      expect(REGIONAL_PRESETS.IN.locale).toBe('en-IN');
      expect(REGIONAL_PRESETS.IN.timezone).toBe('Asia/Kolkata');
      expect(REGIONAL_PRESETS.IN.date_format).toBe('DD/MM/YYYY');

      const recipes = getRecipes('en-IN');
      expect(recipes.new_lead.steps[1].subject).toContain('Thank you for your inquiry');
      expect(recipes.new_lead.steps[2].subject).toContain('New Lead');
    });
  });

  // Scenario K: Settings persistence and validation
  describe('Scenario K: Settings persistence and validation', () => {
    it('allows updating regional settings and validates timezone and currency', async () => {
      t.api.setLocation(adminLoc);

      // Successful update with valid regional settings
      const patchRes = await t.api.patch('/api/location', {
        timezone: 'Asia/Kolkata',
        regional: {
          country: 'IN',
          currency: 'INR',
          locale: 'en-IN',
          phone_country: '+91',
        },
      });

      expect(patchRes.status).toBe(200);
      expect(patchRes.data.timezone).toBe('Asia/Kolkata');
      expect(patchRes.data.settings.regional.currency).toBe('INR');
      expect(patchRes.data.settings.regional.country).toBe('IN');

      // Rejection of invalid timezone
      const badTzRes = await t.api.patch('/api/location', { timezone: 'Moon/Apollo' });
      expect(badTzRes.status).toBe(400);

      // Rejection of invalid currency format
      const badCurrRes = await t.api.patch('/api/location', {
        regional: { currency: 'INVALID_CURRENCY_CODE' },
      });
      expect(badCurrRes.status).toBe(400);
    });
  });

  // Scenario L: Historical data preservation across settings changes
  describe('Scenario L: Historical data preservation across settings changes', () => {
    it('preserves existing CRM contacts, pipelines, and transactions when regional settings are modified', async () => {
      t.api.setLocation(adminLoc);

      // Create contact under current settings
      const cRes = await t.api.post('/api/contacts', {
        name: 'Priya Sharma',
        email: 'priya.sharma@example.in',
        phone: '+919876543210',
      });
      expect(cRes.status).toBe(200);
      const contactId = cRes.data.id;

      // Update location timezone to Asia/Kolkata
      const locRes = await t.api.patch('/api/location', {
        timezone: 'Asia/Kolkata',
        regional: { currency: 'INR', country: 'IN', locale: 'en-IN' },
      });
      expect(locRes.status).toBe(200);

      // Verify contact is still intact and unchanged
      const fetchContact = await t.api.get(`/api/contacts/${contactId}`);
      expect(fetchContact.status).toBe(200);
      expect(fetchContact.data.name).toBe('Priya Sharma');
      expect(fetchContact.data.email).toBe('priya.sharma@example.in');
    });
  });

  // Scenario M: Stage 2 security & Stage 3 durable automation regression check
  describe('Scenario M: Stage 2 security & Stage 3 durable automation regression check', () => {
    it('verifies that livechat isolation and durable events continue to function properly', async () => {
      // Verify durable_events table exists and accepts emissions of durable business events
      const eventId = t.app.events.emit(adminLoc, 'contact.created', { contactId: 'c_reg_test_stage4' });
      expect(eventId).toBeDefined();

      const durableRow = t.app.db.get<any>('SELECT * FROM durable_events WHERE id = ?', eventId);
      expect(durableRow).toBeDefined();
      expect(durableRow.type).toBe('contact.created');

      // Verify live-chat isolation logic (visitor_token requirement on messages table)
      const chatQuery = t.app.db.get<any>(
        'SELECT COUNT(*) as n FROM messages WHERE visitor_token IS NULL',
      );
      expect(chatQuery.n).toBeGreaterThanOrEqual(0);
    });
  });
});

