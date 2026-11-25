import { afterEach, describe, expect, it } from 'vitest';
import { startTestApp } from './helpers.js';

const worlds: Awaited<ReturnType<typeof startTestApp>>[] = [];

afterEach(async () => {
  await Promise.all(worlds.splice(0).map((world) => world.close()));
});

describe('SaaS entry and India-first setup', () => {
  it('advertises account creation only while a usable public signup route is open', async () => {
    const world = await startTestApp();
    worlds.push(world);
    await world.setup();

    expect((await world.api.get('/api/auth/methods')).data.signup_url).toBeUndefined();

    const plan = (await world.api.post('/api/saas/plans', {
      name: 'Free test plan',
      features: ['dashboard', 'contacts'],
      limits: { contacts: 50 },
    })).data;
    expect(plan.free).toBe(true);
    await world.api.put('/api/saas/settings', { signup_enabled: true });

    expect((await world.api.get('/api/auth/methods')).data.signup_url).toBe('/signup');
    expect((await world.api.get('/signup')).status).toBe(200);

    await world.api.put('/api/saas/settings', { signup_enabled: false });
    expect((await world.api.get('/api/auth/methods')).data.signup_url).toBeUndefined();
    expect((await world.api.get('/signup')).status).toBe(404);
  });

  it('uses Indian regional defaults when the first administrator chooses India during setup', async () => {
    const world = await startTestApp();
    worlds.push(world);
    const setup = await world.api.post('/api/auth/setup', {
      email: 'owner@example.in',
      password: 'secure-password-123',
      name: 'Business Owner',
      locationName: 'India Test Business',
      timezone: 'Asia/Kolkata',
    });
    expect(setup.status).toBe(200);

    const row = world.app.db.get<{ timezone: string; settings: string }>(
      'SELECT timezone, settings FROM locations WHERE name = ?',
      'India Test Business',
    );
    expect(row?.timezone).toBe('Asia/Kolkata');
    expect(JSON.parse(row!.settings).regional).toMatchObject({
      country: 'IN',
      locale: 'en-IN',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      phone_country: '+91',
    });
  });
});
