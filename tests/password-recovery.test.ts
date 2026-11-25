import { afterEach, describe, expect, it } from 'vitest';
import { sha256 } from '../server/core/util.js';
import { startTestApp } from './helpers.js';

const EMAIL = 'chef@example.com';
const GENERIC = 'If an account can reset its password, we’ll email a secure link shortly.';
const worlds: Awaited<ReturnType<typeof startTestApp>>[] = [];

async function world() {
  const t = await startTestApp();
  worlds.push(t);
  await t.setup();
  const sent: any[] = [];
  t.app.services.authMailer = async (_location: unknown, mail: unknown) => (sent.push(mail), { status: 'sent' });
  const audit: any[] = [];
  t.app.services.audit = (event: unknown) => audit.push(event);
  return { t, sent, audit };
}

function rawToken(sent: any[]) {
  const found = /#reset=([A-Za-z0-9_-]{40,100})/.exec(sent.at(-1)?.text ?? '');
  expect(found, 'reset link in the isolated fake mail transport').not.toBeNull();
  return found![1];
}

afterEach(async () => {
  await Promise.all(worlds.splice(0).map((t) => t.close()));
});

describe('secure password recovery', () => {
  it('uses the same public response for known, unknown, and invalid email addresses', async () => {
    const { t, sent } = await world();
    const known = await t.api.post('/api/auth/password-recovery/request', { email: EMAIL });
    const unknown = await t.api.post('/api/auth/password-recovery/request', { email: 'nobody@example.com' });
    const invalid = await t.api.post('/api/auth/password-recovery/request', { email: 'not-an-email' });

    expect(known).toMatchObject({ status: 200, data: { ok: true, message: GENERIC } });
    expect(unknown.data).toEqual(known.data);
    expect(invalid.data).toEqual(known.data);
    expect(sent).toHaveLength(1);

    const tokenValue = rawToken(sent);
    const stored = t.app.db.get<{ token_hash: string }>('SELECT token_hash FROM password_reset_tokens');
    expect(stored?.token_hash).toBe(sha256(tokenValue));
    expect(stored?.token_hash).not.toBe(tokenValue);
    expect(JSON.stringify(t.app.db.all('SELECT * FROM password_reset_tokens'))).not.toContain(tokenValue);
  });

  it('returns the generic response without waiting for the mail provider', async () => {
    const { t } = await world();
    let release!: (result: { status: string }) => void;
    const delivery = new Promise<{ status: string }>((resolve) => { release = resolve; });
    t.app.services.authMailer = async () => delivery;

    const response = await t.api.post('/api/auth/password-recovery/request', { email: EMAIL });
    expect(response).toMatchObject({ status: 200, data: { ok: true, message: GENERIC } });
    release({ status: 'sent' });
  });

  it('expires the token after one use and invalidates every session when the password changes', async () => {
    const { t, sent, audit } = await world();
    await t.api.post('/api/auth/password-recovery/request', { email: EMAIL });
    const tokenValue = rawToken(sent);
    const oldCookie = t.api.cookie;

    const changed = await t.api.post('/api/auth/password-recovery/consume', { token: tokenValue, password: 'new-password-123' });
    expect(changed.status).toBe(200);
    expect(t.app.db.get('SELECT token_hash FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = ?)', EMAIL)).toBeUndefined();
    expect(audit.map((e) => e.action)).toContain('password.reset.completed');
    expect(JSON.stringify(audit.map(({ ctx: _ctx, ...event }) => event))).not.toContain(tokenValue);
    expect((await t.api.get('/api/me')).status).toBe(401);

    expect((await t.api.post('/api/auth/password-recovery/consume', { token: tokenValue, password: 'another-password-123' })).status).toBe(400); // oss-check: allow
    t.api.clearCookie();
    expect((await t.api.post('/api/auth/login', { email: EMAIL, password: 'geheim123' })).status).toBe(401);
    expect((await t.api.post('/api/auth/login', { email: EMAIL, password: 'new-password-123' })).status).toBe(200);
    expect(oldCookie).toContain('pghl_session=');
  });

  it('rejects expired links and keeps the account unchanged', async () => {
    const { t, sent } = await world();
    await t.api.post('/api/auth/password-recovery/request', { email: EMAIL });
    const tokenValue = rawToken(sent);
    t.app.db.run("UPDATE password_reset_tokens SET expires_at = '2000-01-01T00:00:00.000Z' WHERE token_hash = ?", sha256(tokenValue));

    expect((await t.api.post('/api/auth/password-recovery/consume', { token: tokenValue, password: 'new-password-123' })).status).toBe(400);
    t.api.clearCookie();
    expect((await t.api.post('/api/auth/login', { email: EMAIL, password: 'geheim123' })).status).toBe(200);
  });

  it('rate-limits delivery without changing the enumeration-resistant response', async () => {
    const { t, sent } = await world();
    const responses = [];
    for (let n = 0; n < 5; n++) responses.push(await t.api.post('/api/auth/password-recovery/request', { email: EMAIL }));
    expect(responses.every((r) => r.status === 200 && r.data.message === GENERIC)).toBe(true);
    expect(sent.length).toBeLessThanOrEqual(3);
  });

  it('revokes an undelivered token when the test transport fails', async () => {
    const { t, sent } = await world();
    t.app.services.authMailer = async () => {
      throw new Error('synthetic transport failure');
    };
    const response = await t.api.post('/api/auth/password-recovery/request', { email: EMAIL });
    expect(response).toMatchObject({ status: 200, data: { ok: true, message: GENERIC } });
    expect(t.app.db.get('SELECT token_hash FROM password_reset_tokens WHERE used_at IS NULL')).toBeUndefined();
    expect(sent).toHaveLength(0);
  });
});
