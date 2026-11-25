/**
 * Isolated SaaS preview bootstrap (test-only, local loopback).
 *
 * Starts the CRM against a disposable database and captures auth e-mails
 * (password reset, invitations, …) to a file instead of sending them, so the
 * recovery flow can be verified end-to-end without a live mail provider.
 *
 * Run from the isolated SaaS worktree only:
 *
 *   PGHL_PORT=4701 PGHL_DATA_DIR=<disposable> PGHL_BASE_URL=http://localhost:5174 \
 *   PGHL_MAIL_CAPTURE=<capture-file> node --no-warnings --import tsx scripts/preview-saas.ts
 */
import { appendFileSync } from 'node:fs';
import { createApp } from '../server/core/app.js';
import { loadConfig } from '../server/config.js';
import { MODULES } from '../server/modules/index.js';

const config = loadConfig();
const instance = createApp(config, MODULES);

// Test-only email capture: auth mails are written to a file, never sent.
const capture = process.env.PGHL_MAIL_CAPTURE || 'preview-mail.log';
instance.app.services.authMailer = async (_loc: unknown, mail: { to: string; subject: string; text: string }) => {
  appendFileSync(capture, `\n=== ${new Date().toISOString()} ===\nTO: ${mail.to}\nSUBJECT: ${mail.subject}\n${mail.text}\n`);
  return { status: 'sent' };
};

await instance.listen();
console.log(`SaaS preview running at ${config.baseUrl} (host ${config.host}:${config.port}, data ${config.dataDir}, mail capture ${capture})`);

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await instance.close();
    process.exit(0);
  });
}
