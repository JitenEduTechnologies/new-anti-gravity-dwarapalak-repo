import { resolve } from 'node:path';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp } from './helpers.js';

const hasDistWeb = existsSync(resolve('./dist-web/index.html'));

describe('Phase 5 — Production & Web Smoke Verification', () => {
  let t: Awaited<ReturnType<typeof startTestApp>>;

  beforeAll(async () => {
    t = await startTestApp({ webDir: resolve('./dist-web') });
    await t.setup();
  });

  afterAll(async () => {
    await t.close();
  });

  it.skipIf(!hasDistWeb)('GET / returns 200 with HTML Content-Type and proper document structure', async () => {
    const res = await t.api.raw('/', { method: 'GET' });
    expect(res.status).toBe(200);
    const contentType = res.headers.get('content-type') || '';
    expect(contentType).toContain('text/html');
    const body = await res.text();
    expect(body.toLowerCase()).toContain('<!doctype html>');
    expect(body).toContain('<html');
    expect(body).toContain('<title>Dwarapalak</title>');
    expect(body).toContain('</html>');
  });

  it.skipIf(!hasDistWeb)('GET /app returns 200 with HTML Content-Type serving the app shell', async () => {
    const res = await t.api.raw('/app', { method: 'GET' });
    expect(res.status).toBe(200);
    const contentType = res.headers.get('content-type') || '';
    expect(contentType).toContain('text/html');
    const body = await res.text();
    expect(body.toLowerCase()).toContain('<!doctype html>');
    expect(body).toContain('<title>Dwarapalak</title>');
  });

  it('GET /healthz returns 200 with ok or non-fatal degraded status', async () => {
    const res = await t.api.raw('/healthz', { method: 'GET' });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body.trim()).toMatch(/^(ok|degraded: )/);
  });

  it.skipIf(!hasDistWeb)('serves static assets from dist-web/assets with correct MIME types', async () => {
    const indexHtml = readFileSync(resolve('./dist-web/index.html'), 'utf-8');
    const match = indexHtml.match(/src="(\/assets\/[^"]+\.js)"/);
    expect(match).toBeTruthy();
    const assetPath = match![1];
    const res = await t.api.raw(assetPath, { method: 'GET' });
    expect(res.status).toBe(200);
    const contentType = res.headers.get('content-type') || '';
    expect(contentType).toMatch(/javascript/);
    const body = await res.text();
    expect(body.length).toBeGreaterThan(100);
  });

  it.skipIf(!hasDistWeb)('dist-web includes all newly localized namespaces in built assets', () => {
    expect(existsSync(resolve('./dist-web/index.html'))).toBe(true);
    const assetFiles = readdirSync(resolve('./dist-web/assets'));
    let foundCollabws = false;
    let foundFinops = false;
    let foundAgency = false;
    let foundWorkspace = false;
    for (const file of assetFiles) {
      if (file.endsWith('.js')) {
        const content = readFileSync(resolve('./dist-web/assets', file), 'utf-8');
        if (content.includes('collabws') || content.includes('Workspace')) foundCollabws = true;
        if (content.includes('finops') || content.includes('Accounting')) foundFinops = true;
        if (content.includes('agency') || content.includes('Sub-Accounts')) foundAgency = true;
        if (content.includes('workspace') || content.includes('Knowledge')) foundWorkspace = true;
      }
    }
    expect(foundCollabws).toBe(true);
    expect(foundFinops).toBe(true);
    expect(foundAgency).toBe(true);
    expect(foundWorkspace).toBe(true);
  });

  it('/api/language endpoint negotiates English based on Accept-Language header', async () => {
    const resEn = await (await t.api.raw('/api/language', { headers: { 'accept-language': 'en-US,en;q=0.9' } })).json();
    expect(resEn).toEqual({ lang: 'en', locales: ['de', 'en'] });

    const resDe = await (await t.api.raw('/api/language', { headers: { 'accept-language': 'de-DE,de;q=0.9' } })).json();
    expect(resDe).toEqual({ lang: 'de', locales: ['de', 'en'] });
  });
});
