import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp } from './helpers.js';

describe('Phase 2: Live-Chat Privacy & Session Isolation', () => {
  let t: Awaited<ReturnType<typeof startTestApp>>;
  let locA = '';
  let locB = '';

  beforeAll(async () => {
    t = await startTestApp();
    await t.setup();
    locA = t.api.location;

    // Create a second location for cross-location isolation tests
    const resB = await t.api.post('/api/locations', { name: 'Location B', timezone: 'Europe/Berlin' });
    locB = resB.data.id;

    // Enable chat in both locations
    await t.api.patch('/api/location', { settings: { chat: { enabled: true } } });
    t.app.db.run('UPDATE locations SET settings = ? WHERE id = ?', JSON.stringify({ chat: { enabled: true } }), locB);
  });

  afterAll(async () => {
    await t.close();
  });

  it('two anonymous visitors entering the same email are isolated and do not see each other’s messages', async () => {
    const email = 'shared-lead@example.com';

    // Visitor 1 starts chat
    const r1 = await t.api.post(`/api/public/chat/${locA}/messages`, {
      body: 'Hello from Visitor 1',
      email,
      name: 'Alice Device 1',
    });
    expect(r1.status).toBe(200);
    const token1 = r1.data.visitor;
    expect(token1).toBeTruthy();

    // Visitor 2 starts chat with the exact same email
    const r2 = await t.api.post(`/api/public/chat/${locA}/messages`, {
      body: 'Hello from Visitor 2',
      email,
      name: 'Alice Device 2',
    });
    expect(r2.status).toBe(200);
    const token2 = r2.data.visitor;
    expect(token2).toBeTruthy();
    expect(token2).not.toBe(token1);

    // Visitor 1 polls: must ONLY see Visitor 1's messages
    const v1Messages = (await t.api.get(`/api/public/chat/${locA}/messages?visitor=${token1}`)).data.messages;
    expect(v1Messages.map((m: any) => m.body)).toEqual(['Hello from Visitor 1']);

    // Visitor 2 polls: must ONLY see Visitor 2's messages
    const v2Messages = (await t.api.get(`/api/public/chat/${locA}/messages?visitor=${token2}`)).data.messages;
    expect(v2Messages.map((m: any) => m.body)).toEqual(['Hello from Visitor 2']);
  });

  it('an anonymous visitor typing an existing customer’s email cannot read subsequent confidential chats or replies', async () => {
    // 1. Existing verified customer with VIP contact data
    const vip = (await t.api.post('/api/contacts', {
      first_name: 'Viktor',
      last_name: 'VIP',
      email: 'viktor-vip@firm.de',
      phone: '+49 171 7777777',
      company: 'Acme Corp',
    })).data;

    // 2. Legitimate visitor session for Viktor
    const vipChat = await t.api.post(`/api/public/chat/${locA}/messages`, {
      body: 'Hier ist Viktor: Bitte senden Sie mir den neuen Vertrag',
      email: 'viktor-vip@firm.de',
      name: 'Viktor',
    });
    expect(vipChat.status).toBe(200);
    const vipToken = vipChat.data.visitor;

    // 3. Attacker (Mallory) tries to eavesdrop by entering Viktor's email in another browser
    await new Promise((r) => setTimeout(r, 10));
    const attackerChat = await t.api.post(`/api/public/chat/${locA}/messages`, {
      body: 'Ich bin auch Viktor (Angreifer)',
      email: 'viktor-vip@firm.de',
      name: 'Mallory',
    });
    expect(attackerChat.status).toBe(200);
    const attackerToken = attackerChat.data.visitor;
    expect(attackerToken).not.toBe(vipToken);

    // 4. Staff replies with confidential data to Viktor
    const conv = t.app.db.get<any>('SELECT id FROM conversations WHERE contact_id = ?', vip.id);
    expect(conv).toBeTruthy();

    const staffReply = await t.api.post('/api/messages', {
      contact_id: vip.id,
      channel: 'chat',
      body: 'GEHEIM: Ihr neuer Vertragscode lautet DE-SEC-9988-CONFIDENTIAL',
    });
    expect(staffReply.status).toBe(200);

    // 5. Viktor also sends confidential follow-up
    await t.api.post(`/api/public/chat/${locA}/messages`, {
      visitor: vipToken,
      body: 'Habe Code erhalten, danke!',
    });

    // 6. Viktor polls: sees entire legitimate thread
    const vipSeen = (await t.api.get(`/api/public/chat/${locA}/messages?visitor=${vipToken}`)).data.messages;
    expect(vipSeen.map((m: any) => m.body)).toContain('Hier ist Viktor: Bitte senden Sie mir den neuen Vertrag');
    expect(vipSeen.map((m: any) => m.body)).toContain('GEHEIM: Ihr neuer Vertragscode lautet DE-SEC-9988-CONFIDENTIAL');
    expect(vipSeen.map((m: any) => m.body)).toContain('Habe Code erhalten, danke!');

    // 7. Attacker polls: MUST NOT see Viktor's message or the staff confidential reply!
    const attackerSeen = (await t.api.get(`/api/public/chat/${locA}/messages?visitor=${attackerToken}`)).data.messages;
    expect(attackerSeen.map((m: any) => m.body)).toEqual(['Ich bin auch Viktor (Angreifer)']);
    expect(JSON.stringify(attackerSeen)).not.toContain('DE-SEC-9988-CONFIDENTIAL');
    expect(JSON.stringify(attackerSeen)).not.toContain('neuen Vertrag');
  });

  it('routes staff replies to the correct visitor session and marks unverified sessions', async () => {
    // Visitor A starts chat
    const resA = await t.api.post(`/api/public/chat/${locA}/messages`, {
      body: 'Frage zu Angebot A',
      email: 'buyer-a@kunde.de',
      name: 'Kunde A',
    });
    const tokenA = resA.data.visitor;
    const contactA = t.app.db.get<any>('SELECT contact_id FROM chat_visitors WHERE token = ?', tokenA);

    // Staff replies to Visitor A
    await t.api.post('/api/messages', {
      contact_id: contactA.contact_id,
      channel: 'chat',
      body: 'Antwort zu Angebot A: 10% Rabatt',
    });

    // Visitor A sees the reply
    const msgsA = (await t.api.get(`/api/public/chat/${locA}/messages?visitor=${tokenA}`)).data.messages;
    expect(msgsA.map((m: any) => m.body)).toContain('Antwort zu Angebot A: 10% Rabatt');

    // Visitor B enters same email later
    const resB = await t.api.post(`/api/public/chat/${locA}/messages`, {
      body: 'Frage von zweitem Gerät',
      email: 'buyer-a@kunde.de',
      name: 'Kunde A2',
    });
    const tokenB = resB.data.visitor;

    // Verify visitor B message is tagged as unverified/multiple
    const msgB = t.app.db.get<any>('SELECT * FROM messages WHERE visitor_token = ?', tokenB);
    expect(msgB.source).toContain('Unverifiziert');

    // Visitor B does NOT see the 10% Rabatt reply given to session A
    const msgsB = (await t.api.get(`/api/public/chat/${locA}/messages?visitor=${tokenB}`)).data.messages;
    expect(msgsB.map((m: any) => m.body)).toEqual(['Frage von zweitem Gerät']);
  });

  it('enforces location isolation for visitor tokens', async () => {
    // Session created in Location A
    const resA = await t.api.post(`/api/public/chat/${locA}/messages`, {
      body: 'Message in Loc A',
      email: 'cross-loc@test.de',
      name: 'Cross Loc User',
    });
    const tokenLocA = resA.data.visitor;

    // Attempting to query Location B with Location A token must return empty
    const crossQuery = await t.api.get(`/api/public/chat/${locB}/messages?visitor=${tokenLocA}`);
    expect(crossQuery.data.messages).toEqual([]);

    // Attempting to post message in Location B with Location A token must not reuse session
    const crossPost = await t.api.post(`/api/public/chat/${locB}/messages`, {
      visitor: tokenLocA,
      body: 'Trying to inject in Loc B',
    });
    // Since token is not in Loc B, server creates a new visitor token in Loc B
    expect(crossPost.status).toBe(200);
    expect(crossPost.data.visitor).not.toBe(tokenLocA);
  });

  it('rejects invalid or empty visitor tokens gracefully', async () => {
    // Empty token
    const emptyRes = await t.api.get(`/api/public/chat/${locA}/messages?visitor=`);
    expect(emptyRes.data.messages).toEqual([]);

    // Non-existent random token
    const fakeToken = 'non_existent_token_1234567890';
    const fakeRes = await t.api.get(`/api/public/chat/${locA}/messages?visitor=${fakeToken}`);
    expect(fakeRes.data.messages).toEqual([]);
  });

  it('preserves existing CRM contact records and prevents contact field tampering by anonymous chat visitors', async () => {
    // Existing verified contact
    const contact = (await t.api.post('/api/contacts', {
      first_name: 'Original',
      last_name: 'Customer',
      email: 'original@customer.de',
      phone: '+49 123 4567890',
      company: 'Original Inc',
    })).data;

    // Visitor tries to spoof name and submit chat
    await t.api.post(`/api/public/chat/${locA}/messages`, {
      name: 'Hacked Name',
      email: 'original@customer.de',
      body: 'Trying to alter contact record',
    });

    // Verify contact record was NOT altered
    const fresh = (await t.api.get(`/api/contacts/${contact.id}`)).data;
    expect(fresh.first_name).toBe('Original');
    expect(fresh.last_name).toBe('Customer');
    expect(fresh.email).toBe('original@customer.de');
    expect(fresh.phone).toBe('+491234567890');
    expect(fresh.company).toBe('Original Inc');
  });

  it('legacy messages with visitor_token IS NULL cannot leak to visitors or across sessions', async () => {
    // 1. Create a customer
    const legacyContact = (await t.api.post('/api/contacts', {
      first_name: 'Old',
      last_name: 'Customer',
      email: 'legacy-contact@firm.de',
    })).data;

    // 2. Insert historical legacy messages (created prior to session, visitor_token IS NULL)
    const convId = 'conv-legacy-test-01';
    t.app.db.run(
      `INSERT INTO conversations (id, location_id, contact_id, unread, starred, last_message, last_message_at, created_at)
       VALUES (?, ?, ?, 0, 0, '', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')`,
      convId,
      locA,
      legacyContact.id,
    );

    // Old legacy chat message from 2025
    t.app.db.run(
      `INSERT INTO messages (id, location_id, conversation_id, contact_id, channel, direction, subject, body, status, error, source, visitor_token, created_at)
       VALUES ('msg-old-chat', ?, ?, ?, 'chat', 'out', '', 'Vertrauliche Alt-Meldung aus 2025', 'sent', '', 'Team', NULL, '2025-01-01T10:00:00Z')`,
      locA,
      convId,
      legacyContact.id,
    );

    // Concurrent non-chat message (email channel, visitor_token IS NULL)
    t.app.db.run(
      `INSERT INTO messages (id, location_id, conversation_id, contact_id, channel, direction, subject, body, status, error, source, visitor_token, created_at)
       VALUES ('msg-old-email', ?, ?, ?, 'email', 'in', 'Rechnung', 'Vertrauliche Bankverbindung per E-Mail', 'delivered', '', 'Email', NULL, ?)`,
      locA,
      convId,
      legacyContact.id,
      new Date().toISOString(),
    );

    // 3. Visitor joins today with that email
    const visitorRes = await t.api.post(`/api/public/chat/${locA}/messages`, {
      body: 'Hallo, ich habe heute eine Frage',
      email: 'legacy-contact@firm.de',
      name: 'Visitor Today',
    });
    expect(visitorRes.status).toBe(200);
    const vToken = visitorRes.data.visitor;

    // 4. Query messages for this visitor
    const messages = (await t.api.get(`/api/public/chat/${locA}/messages?visitor=${vToken}`)).data.messages;

    // Must ONLY see the visitor's own message from today
    expect(messages.map((m: any) => m.body)).toEqual(['Hallo, ich habe heute eine Frage']);
    expect(JSON.stringify(messages)).not.toContain('Vertrauliche Alt-Meldung');
    expect(JSON.stringify(messages)).not.toContain('Vertrauliche Bankverbindung');
  });
});

