import { createHmac } from 'node:crypto';
import type { App, LocationRow, Module } from '../core/app.js';
import { SESSION_COOKIE } from '../core/app.js';
import { HttpError } from '../core/http.js';
import { escapeHtml } from '../core/template.js';
import { hashPasswordAsync, normalizeEmail, now, sha256, token } from '../core/util.js';
import { deliverEmail, type OutMail } from '../services/messaging.js';

const RESET_TTL_MS = 30 * 60_000;
const LIMIT_WINDOW_MS = 60 * 60_000;
const GENERIC_MESSAGE = 'If an account can reset its password, we’ll email a secure link shortly.';

function safeBucket(app: App, bucket: string): string {
  return createHmac('sha256', app.config.secret).update(`password-recovery:${bucket}`).digest('hex');
}

function validEmail(value: unknown): string {
  const email = normalizeEmail(value);
  return email.length <= 320 && /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email) ? email : '';
}

function sender(app: App, user: { locations: string }): LocationRow | undefined {
  const policy = app.services.loginPolicy?.get?.();
  const preferred = policy?.mail_location_id && app.location(policy.mail_location_id);
  if (preferred) return preferred;
  let locations: string[] = [];
  try {
    locations = JSON.parse(user.locations || '[]');
  } catch {
    locations = [];
  }
  for (const locationId of locations) {
    const loc = app.location(locationId);
    if (loc) return loc;
  }
  const first = app.db.get<{ id: string }>('SELECT id FROM locations ORDER BY created_at, id LIMIT 1');
  return first ? app.location(first.id) : undefined;
}

export const passwordRecoveryModule: Module = {
  name: 'password-recovery',
  migrations: [
    [
      '001-init',
      `
      CREATE TABLE password_reset_tokens (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT
      );
      CREATE INDEX password_reset_user ON password_reset_tokens(user_id, created_at);
      CREATE TABLE password_reset_limits (
        bucket_hash TEXT PRIMARY KEY,
        window_start INTEGER NOT NULL,
        attempts INTEGER NOT NULL
      );
      `,
    ],
  ],
  register(app) {
    const { db, router } = app;
    const mailer = (loc: LocationRow, mail: OutMail) => (app.services.authMailer ?? deliverEmail)(loc, mail);

    function hitLimit(bucket: string, max: number, time = Date.now()): boolean {
      const key = safeBucket(app, bucket);
      const row = db.get<{ window_start: number; attempts: number }>('SELECT window_start, attempts FROM password_reset_limits WHERE bucket_hash = ?', key);
      if (!row || time - row.window_start >= LIMIT_WINDOW_MS) {
        db.run(
          `INSERT INTO password_reset_limits (bucket_hash, window_start, attempts) VALUES (?, ?, 1)
           ON CONFLICT(bucket_hash) DO UPDATE SET window_start = excluded.window_start, attempts = 1`,
          key,
          time,
        );
        return false;
      }
      const attempts = row.attempts + 1;
      db.run('UPDATE password_reset_limits SET attempts = ? WHERE bucket_hash = ?', attempts, key);
      return attempts > max;
    }

    router.post('/api/auth/password-recovery/request', 'public', async (ctx) => {
      const email = validEmail(ctx.body?.email);
      const limitedIp = hitLimit(`ip:${ctx.ip}`, 10);
      const limitedEmail = email ? hitLimit(`email:${email}`, 3) : false;
      const response = { ok: true, message: GENERIC_MESSAGE };
      if (!email || limitedIp || limitedEmail) return response;

      const user = db.get<{ id: string; email: string; name: string; locations: string; password_hash: string }>(
        'SELECT id, email, name, locations, password_hash FROM users WHERE email = ?',
        email,
      );
      // Invitation-only accounts have no password until their invitation is accepted.
      if (!user || !user.password_hash.startsWith('scrypt$')) return response;

      const raw = token(32);
      const created = now();
      const expires = new Date(Date.now() + RESET_TTL_MS).toISOString();
      db.tx(() => {
        db.run('UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL', created, user.id);
        db.insert('password_reset_tokens', { token_hash: sha256(raw), user_id: user.id, created_at: created, expires_at: expires });
        db.run('DELETE FROM password_reset_tokens WHERE expires_at < ? OR used_at < ?', created, new Date(Date.now() - 864e5).toISOString());
        db.run('DELETE FROM password_reset_limits WHERE window_start < ?', Date.now() - 864e5);
      });

      const loc = sender(app, user);
      if (!loc) {
        db.run('UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ?', now(), sha256(raw));
        return response;
      }

      const link = `${app.baseUrl()}/app#reset=${encodeURIComponent(raw)}`;
      const text = `Hello${user.name ? ` ${user.name}` : ''},\n\nUse this secure link to set a new password. It expires in 30 minutes and can only be used once:\n${link}\n\nIf you did not request this, you can ignore this email.`;
      try {
        const delivery = mailer(loc, {
          to: user.email,
          subject: 'Reset your Dwarapalak password',
          text,
          html: `<p>${escapeHtml(text).replace(/\n/g, '<br>').replace(escapeHtml(link), `<a href="${escapeHtml(link)}">Reset password</a>`)}</p>`,
        });
        void delivery.then((result: { status?: string }) => {
          if (result.status === 'failed') throw new Error('Email delivery failed');
          app.services.audit?.({ ctx, action: 'password.reset.requested', userId: user.id });
        }).catch(() => {
          // Do not leave an active token that was never delivered, and never log its value.
          db.run('UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ?', now(), sha256(raw));
          app.services.audit?.({ ctx, action: 'password.reset.delivery_failed', userId: user.id });
        });
      } catch {
        // A transport can also fail before returning its promise.
        db.run('UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ?', now(), sha256(raw));
        app.services.audit?.({ ctx, action: 'password.reset.delivery_failed', userId: user.id });
      }
      return response;
    });

    router.post('/api/auth/password-recovery/consume', 'public', async (ctx) => {
      const raw = typeof ctx.body?.token === 'string' ? ctx.body.token : '';
      const password = typeof ctx.body?.password === 'string' ? ctx.body.password : '';
      if (!/^[A-Za-z0-9_-]{40,100}$/.test(raw)) throw new HttpError(400, 'This reset link is invalid or expired. Request a new one.');
      if (password.length < 8 || password.length > 1024) throw new HttpError(400, 'Password must be between 8 and 1,024 characters.');
      if (hitLimit(`consume:${ctx.ip}`, 12)) throw new HttpError(429, 'Too many attempts. Request a new reset link.');

      const tokenHash = sha256(raw);
      const row = db.get<{ user_id: string }>(
        'SELECT user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?',
        tokenHash,
        now(),
      );
      if (!row) throw new HttpError(400, 'This reset link is invalid or expired. Request a new one.');
      const passwordHash = await hashPasswordAsync(password);
      const usedAt = now();
      const changed = db.tx(() => {
        if (!db.run('UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?', usedAt, tokenHash, usedAt).changes) return false;
        if (!db.run('UPDATE users SET password_hash = ? WHERE id = ?', passwordHash, row.user_id).changes) return false;
        db.run('DELETE FROM sessions WHERE user_id = ?', row.user_id);
        db.run('UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL', usedAt, row.user_id);
        return true;
      });
      if (!changed) throw new HttpError(400, 'This reset link is invalid or expired. Request a new one.');
      ctx.setCookie(SESSION_COOKIE, '', { maxAge: 0 });
      app.services.audit?.({ ctx, action: 'password.reset.completed', userId: row.user_id });
      return { ok: true };
    });
  },
};
