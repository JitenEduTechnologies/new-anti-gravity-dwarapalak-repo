import { useState } from 'react';
import { ago, api, dt } from '../api';
import { Icon } from '../icons';
import { useSession } from '../session';
import { Badge, Copy, Empty, Field, Input, MergeHint, Modal, Select, Spinner, Tabs, Textarea, act, confirmAsk, toast, useLoad } from '../ui';
import { AgencyAiProvider } from './AiProvider';
import { SignupLink } from '../referrals';
import { useT } from '../i18n';

/**
 * „KI-Werkzeuge verbinden“: Codex, Claude Code, Cursor (key + copy-paste setup), ChatGPT and Claude.ai
 * (OAuth, no key), connection test, keys with „zuletzt benutzt“, connected apps and – per sub-account –
 * GitHub for Codex. The same page exists for the agency (agency keys, admins only).
 */

const TOOLS: [string, string][] = [
  ['codex', 'Codex (CLI, IDE-Erweiterung)'],
  ['claude-code', 'Claude Code'],
  ['cursor', 'Cursor'],
  ['other', 'Anderes KI-Werkzeug'],
];
const TOOL_LABEL: Record<string, string> = { codex: 'Codex', 'claude-code': 'Claude Code', cursor: 'Cursor', other: 'Sonstiges' };
const KEY_PLACEHOLDER = '<DEIN-SCHLÜSSEL>';

/** A copyable multi-line snippet. */
function Snippet({ code, label }: { code: string; label?: string }) {
  return (
    <div className="snippet">
      {label && <div className="snippet-label">{label}</div>}
      <pre>
        <code>{code}</code>
      </pre>
      <div className="snippet-copy">
        <Copy text={code} />
      </div>
    </div>
  );
}

export function codexToml(mcpUrl: string) {
  return `# ~/.codex/config.toml\n[mcp_servers.gohigh]\nurl = "${mcpUrl}"\nbearer_token_env_var = "GOHIGH_API_KEY"`;
}

function agentsMd(o: { brand: string; mcpUrl: string; agency: boolean; locName?: string; locId?: string }) {
  const scope = o.agency
    ? `The connection applies agency-wide: each project is a sub-account – location_id comes from \`ghl_list_projects\`.`
    : `The connection applies exclusively to sub-account "${o.locName ?? ''}" (location_id \`${o.locId ?? ''}\`); other sub-accounts are inaccessible.`;
  return `## ${o.brand} (CRM) via MCP

The CRM for this project runs on ${o.brand}. The MCP server \`gohigh\` (${o.mcpUrl}) is connected.
${scope}

- Read project profile first: \`ghl_list_projects\`, \`ghl_get_project\` (goals, links, repos, metrics).
- Contacts & Deals: \`ghl_search_contacts\`, \`ghl_get_contact\`, \`ghl_upsert_contact\`, \`ghl_list_opportunities\`, \`ghl_create_opportunity\`, \`ghl_update_opportunity\`.
- Tasks: \`ghl_list_tasks\`, \`ghl_create_task\`, \`ghl_complete_task\`.
- Inbox: \`ghl_list_conversations\`, \`ghl_get_conversation\`; \`ghl_send_message\` sends live – ask first.
- Content: \`ghl_create_social_post\` and \`ghl_create_blog_post\` create drafts.
- Link work: link this Codex task or Claude session to the project via \`ghl_update_project\` (\`codex_sessions\` / \`claude_sessions\`).

Rules: Writing tools take effect immediately and are logged. Never commit the API key to the repository – set it in \`GOHIGH_API_KEY\` (or authenticate via OAuth).`;
}

/** Copy-paste setup for every tool; with a fresh key it is filled in. */
function SetupGuide({ mcpUrl, apiKey, agency, tour }: { mcpUrl: string; apiKey?: string; agency: boolean; tour?: boolean }) {
  const t = useT('aiprovider');
  const session = useSession();
  const [tab, setTab] = useState('codex');
  const key = apiKey || KEY_PLACEHOLDER;
  const loc = session.locations.find((l) => l.id === session.locationId);
  const brand = session.branding.name || 'HyperLevel';
  return (
    <div data-tour={tour ? 'ai-tools-setup' : undefined}>
      <Tabs
        tabs={[
          ['codex', 'Codex'],
          ['claude-code', 'Claude Code'],
          ['cursor', 'Cursor'],
          ['chatgpt', 'ChatGPT'],
          ['claude-ai', 'Claude.ai'],
          ['agents-md', 'AGENTS.md'],
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'codex' && (
        <>
          <p className="small">
            {t('Gilt für die Codex CLI und die Codex-Erweiterung in VS Code, Cursor & Co. – beide lesen ~/.codex/config.toml.')}
          </p>
          <Snippet label={t('1. In ~/.codex/config.toml eintragen')} code={codexToml(mcpUrl)} />
          <Snippet label={t('2. Schlüssel als Umgebungsvariable setzen (z. B. in ~/.zshrc oder ~/.bashrc)')} code={`export GOHIGH_API_KEY="${key}"`} />
          <Snippet label={t('Oder alles per Befehl')} code={`codex mcp add gohigh --url ${mcpUrl} --bearer-token-env-var GOHIGH_API_KEY`} />
          <Snippet label={t('Ohne Schlüssel (Anmeldung im Browser per OAuth)')} code={`codex mcp add gohigh --url ${mcpUrl}\ncodex mcp login gohigh`} />
          <p className="muted small">{t('Prüfen: codex mcp list – in Codex fragt z. B. „Welche Aufgaben sind in {brand} offen?“.', { brand })}</p>
        </>
      )}
      {tab === 'claude-code' && (
        <>
          <Snippet label={t('Im Terminal')} code={`claude mcp add --transport http gohigh ${mcpUrl} --header "Authorization: Bearer ${key}"`} />
          <p className="muted small">
            {t('Mit --scope project landet die Verbindung in .mcp.json des Repos – dann den Schlüssel nicht einchecken. Ohne --header meldet sich Claude Code per OAuth an (/mcp → „Authenticate“).')}
          </p>
        </>
      )}
      {tab === 'cursor' && (
        <>
          <Snippet label={t('~/.cursor/mcp.json (oder .cursor/mcp.json im Projekt)')} code={JSON.stringify({ mcpServers: { gohigh: { url: mcpUrl, headers: { Authorization: `Bearer ${key}` } } } }, null, 2)} />
          <p className="muted small">{t('Danach in Cursor unter Einstellungen → MCP den Server „gohigh“ einschalten. Projekt-Dateien mit Schlüssel nicht einchecken.')}</p>
        </>
      )}
      {tab === 'chatgpt' && (
        <ol className="steps small">
          <li>{t('ChatGPT → Einstellungen → Apps & Konnektoren → Erweitert → Entwicklermodus einschalten.')}</li>
          <li>
            {t('„Erstellen“ (Konnektor/App): Name {brand}, MCP-Server-URL {url}, Authentifizierung OAuth.', { brand, url: mcpUrl })}
          </li>
          <li>{t('ChatGPT öffnet die {brand}-Anmeldung: einloggen, {scope} wählen, „Zulassen“.', { brand, scope: agency ? t('Agentur oder Sub-Account') : t('Sub-Account') })}</li>
          <li>{t('Im Chat über „+“ → Entwicklermodus den Konnektor auswählen. Getrennt wird hier unter „Verbundene Apps“.')}</li>
        </ol>
      )}
      {tab === 'claude-ai' && (
        <ol className="steps small">
          <li>{t('Claude.ai (oder Claude Desktop) → Einstellungen → Konnektoren → „Benutzerdefinierten Konnektor hinzufügen“.')}</li>
          <li>
            {t('Name {brand}, URL {url} – ohne Client-ID/Secret (die App registriert sich selbst).', { brand, url: mcpUrl })}
          </li>
          <li>{t('„Verbinden“ → {brand}-Anmeldung → {scope} wählen → „Zulassen“.', { brand, scope: agency ? t('Agentur oder Sub-Account') : t('Sub-Account') })}</li>
          <li>{t('Im Chat unter „Suchen und Werkzeuge“ den Konnektor einschalten.')}</li>
        </ol>
      )}
      {tab === 'agents-md' && (
        <>
          <p className="small">{t('In die AGENTS.md (Codex) oder CLAUDE.md (Claude Code) deiner Repos – damit der Agent weiß, was die {brand}-Werkzeuge können:', { brand })}</p>
          <Snippet code={agentsMd({ brand, mcpUrl, agency, locName: loc?.name, locId: loc?.id })} />
        </>
      )}
    </div>
  );
}

function TestResult({ r }: { r: any }) {
  const t = useT('aiprovider');
  if (!r) return null;
  return r.ok ? (
    <p className="ai-test ok">
      <Icon name="ok" /> {t('Verbunden mit {server} · Protokoll {protocol} · {tools} Werkzeuge ({sample} …) · {ms} ms', { server: r.server, protocol: r.protocol, tools: r.tools, sample: r.sample.slice(0, 4).join(', '), ms: r.ms })}
    </p>
  ) : (
    <p className="ai-test err">
      {t('Fehler bei {step}: {error}', { step: r.step, error: r.error })}
    </p>
  );
}

function TestConnection({ agency }: { agency: boolean }) {
  const t = useT('aiprovider');
  const [key, setKey] = useState('');
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="card" data-tour="ai-tools-test">
      <h2>{t('Verbindung testen')}</h2>
      <p className="muted small">{t('Schickt mit dem Schlüssel ein echtes MCP-„initialize“ und „tools/list“ an diese Instanz – genau wie Codex oder Claude Code.')}</p>
      <div className="row">
        <div className="grow">
          <Input type="password" autoComplete="off" value={key} onChange={setKey} placeholder={agency ? t('pghla_… oder pghl_…') : 'pghl_…'} />
        </div>
        <button
          className="btn secondary"
          disabled={!key.trim() || busy}
          onClick={async () => {
            setBusy(true);
            setRes(await act(() => api.post(agency ? '/api/agency/ai-tools/test' : '/api/ai-tools/test', { key: key.trim() })));
            setBusy(false);
          }}
        >
          {t('Testen')}
        </button>
      </div>
      <TestResult r={res} />
    </div>
  );
}

function NewKeyModal({ created, mcpUrl, agency, onClose }: { created: any; mcpUrl: string; agency: boolean; onClose: () => void }) {
  const t = useT('aiprovider');
  const [res, setRes] = useState<any>(null);
  return (
    <Modal title={t('{name} – jetzt einrichten', { name: created.name })} onClose={onClose} wide>
      <p>
        {t('Der Schlüssel wird nur dieses eine Mal angezeigt – gleich einrichten oder im Passwort-Manager speichern.')}{' '}
        {agency ? (created.scope === 'read' ? <Badge>{t('Agentur · nur lesen')}</Badge> : <Badge tone="purple">{t('Agentur · lesen & schreiben')}</Badge>) : <Badge tone="blue">{t('nur dieser Sub-Account')}</Badge>}
      </p>
      <Snippet code={created.key} />
      <p>
        <button className="btn secondary" onClick={async () => setRes(await act(() => api.post(agency ? '/api/agency/ai-tools/test' : '/api/ai-tools/test', { key: created.key })))}>
          {t('Verbindung testen')}
        </button>
      </p>
      <TestResult r={res} />
      <SetupGuide mcpUrl={mcpUrl} apiKey={created.key} agency={agency} />
    </Modal>
  );
}

export function AiTools({ agency = false }: { agency?: boolean }) {
  const t = useT('aiprovider');
  const session = useSession();
  const base = agency ? '/api/agency/ai-tools' : '/api/ai-tools';
  const data = useLoad(() => api.get<any>(base), [session.locationId, agency]);
  const [tool, setTool] = useState('codex');
  const [label, setLabel] = useState('');
  const [scope, setScope] = useState('write');
  const [created, setCreated] = useState<any>(null);
  if (!data.data) return data.error ? <Empty>{data.error}</Empty> : <Spinner />;
  const d = data.data;
  const loc = session.locations.find((l) => l.id === session.locationId);
  const brand = session.branding.name || 'HyperLevel';
  return (
    <div className="ai-tools">
      <div className="card ai-tools-intro" data-tour="ai-tools-intro">
        <Icon name="aiTools" size={22} />
        <div className="grow">
          <h2>{t('KI-Werkzeuge verbinden')}</h2>
          <p className="muted small">
            {agency
              ? t('Codex, Claude Code, Cursor, ChatGPT oder Claude.ai arbeiten direkt mit {brand}: alle Projekte, Kontakte, Deals, Aufgaben, Posteingang, Berichte. Agentur-Schlüssel gelten für alle Sub-Accounts.', { brand })
              : t('Codex, Claude Code, Cursor, ChatGPT oder Claude.ai arbeiten direkt mit „{loc}“: Kontakte, Deals, Aufgaben, Posteingang, Inhalte – nur dieser Sub-Account. Jede Änderung steht im Protokoll.', { loc: loc?.name ?? t('diesem Sub-Account') })}
          </p>
          <div className="ai-tools-url">
            <span className="muted small">{t('MCP-Adresse')}</span>
            <code>{d.mcp_url}</code>
            <Copy text={d.mcp_url} />
          </div>
        </div>
      </div>

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="card" style={{ flex: '1 1 340px' }} data-tour="ai-tools-new">
          <h2>
            <Icon name="key" size={18} /> {t('Mit Schlüssel: Codex, Claude Code, Cursor')}
          </h2>
          <p className="muted small">{t('Ein Klick erzeugt einen eigenen Schlüssel je Werkzeug und Gerät – so siehst du, was wann benutzt wurde, und kannst einzeln widerrufen.')}</p>
          <div className="grid2">
            <Field label={t('Werkzeug')}>
              <Select value={tool} onChange={setTool} options={TOOLS.map(([k, l]) => [k, t(l)])} />
            </Field>
            <Field label={t('Gerät / Zweck')}>
              <Input value={label} onChange={setLabel} placeholder={t('z. B. Laptop')} maxLength={60} />
            </Field>
          </div>
          {agency && (
            <Field label={t('Rechte')} hint={t('Agentur-Schlüssel gelten für alle Sub-Accounts.')}>
              <Select value={scope} onChange={setScope} options={[['write', t('Lesen & schreiben')], ['read', t('Nur lesen')]]} />
            </Field>
          )}
          <button
            className="btn"
            data-tour="ai-tools-create"
            onClick={async () => {
              const r = await act(() => api.post(`${base}/keys`, { tool, label: label.trim() || t('Laptop'), ...(agency ? { scope } : {}) }));
              if (r) {
                setCreated(r);
                setLabel('');
                data.reload();
              }
            }}
          >
            {agency ? t('Agentur-Schlüssel erzeugen') : t('Schlüssel erzeugen')}
          </button>
          {!agency && <p className="muted small">{t('Der Schlüssel gilt nur für diesen Sub-Account.')}{session.user.role === 'admin' ? t(' Agentur-Schlüssel für alle Sub-Accounts gibt es unter Agentur → KI-Werkzeuge.') : ''}</p>}
        </div>
        <div className="card" style={{ flex: '1 1 340px' }} data-tour="ai-tools-oauth">
          <h2>
            <Icon name="consent" size={18} /> {t('Ohne Schlüssel: ChatGPT & Claude.ai')}
          </h2>
          <p className="muted small">
            {t('ChatGPT (Konnektoren im Entwicklermodus), Claude.ai-Konnektoren und codex mcp login melden sich per OAuth an: einfach die MCP-Adresse eintragen, dann öffnet sich die {brand}-Anmeldung. Dort wählst du {scope} und ob die App nur lesen darf.', { brand, scope: agency ? t('den Sub-Account oder die ganze Agentur') : t('den Sub-Account') })}
          </p>
          <p className="muted small">{t('Zugänge laufen nach einer Stunde ab und werden von der App erneuert; trennen kannst du jederzeit unten unter „Verbundene Apps“.')}</p>
        </div>
      </div>

      <div className="card">
        <h2>{t('Einrichtung')}</h2>
        <SetupGuide mcpUrl={d.mcp_url} agency={agency} tour />
      </div>

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="card" style={{ flex: '1 1 380px' }} data-tour="ai-tools-keys">
          <h2>{t('Schlüssel')}</h2>
          {d.keys.length ? (
            <div className="table-wrap">
              <table className="t">
                <tbody>
                  {d.keys.map((k: any) => (
                    <tr key={k.id}>
                      <td>
                        <strong>{k.name}</strong> {k.tool && <Badge tone="blue">{TOOL_LABEL[k.tool] ? t(TOOL_LABEL[k.tool]) : k.tool}</Badge>} {agency && <Badge tone={k.scope === 'read' ? 'gray' : 'purple'}>{k.scope === 'read' ? t('lesen') : t('schreiben')}</Badge>}
                        <div className="muted small">
                          <span className="mono">{k.prefix}…</span> · {t('angelegt {date} · zuletzt benutzt {used}', { date: dt(k.created_at), used: k.last_used_at ? ago(k.last_used_at) : t('nie') })}
                        </div>
                      </td>
                      <td className="actions">
                        <button className="btn small ghost" onClick={async () => confirmAsk(t('Schlüssel „{name}“ widerrufen? Werkzeuge mit diesem Schlüssel verlieren sofort den Zugang.', { name: k.name })) && (await act(() => api.del(`${base}/keys/${k.id}`), t('Widerrufen'))) && data.reload()}>
                          {t('Widerrufen')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>{t('Noch keine Schlüssel.')}</Empty>
          )}
        </div>
        <div className="card" style={{ flex: '1 1 380px' }} data-tour="ai-tools-apps">
          <h2>{t('Verbundene Apps (OAuth)')}</h2>
          {d.apps.length ? (
            <div className="table-wrap">
              <table className="t">
                <tbody>
                  {d.apps.map((a: any) => (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.client_name}</strong> <Badge tone={a.access === 'read' ? 'gray' : 'purple'}>{a.access === 'read' ? t('nur lesen') : t('lesen & schreiben')}</Badge>
                        <div className="muted small">
                          {t('{host} · freigegeben von {user} {ago} · zuletzt benutzt {used}', { host: a.known ?? a.redirect_host, user: a.user_name, ago: ago(a.created_at), used: a.last_used_at ? ago(a.last_used_at) : t('nie') })}
                        </div>
                      </td>
                      <td className="actions">
                        <button className="btn small ghost" onClick={async () => confirmAsk(t('„{name}“ trennen? Die App verliert sofort den Zugang.', { name: a.client_name })) && (await act(() => api.del(`${base}/apps/${a.id}`), t('Getrennt'))) && data.reload()}>
                          {t('Trennen')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>{t('Noch keine App per OAuth verbunden.')}</Empty>
          )}
        </div>
      </div>

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 380px' }}>
          <TestConnection agency={agency} />
        </div>
        <div style={{ flex: '1 1 380px' }}>{agency ? <AgencyAiProvider /> : <GithubCodex />}</div>
      </div>

      {created && <NewKeyModal created={created} mcpUrl={d.mcp_url} agency={agency} onClose={() => setCreated(null)} />}
    </div>
  );
}

/** GitHub token + default repository for the workflow action „GitHub-Issue für Codex anlegen“. */
export function GithubCodex() {
  const t = useT('aiprovider');
  const s = useLoad(() => api.get<any>('/api/github-codex/settings'), []);
  const [token, setToken] = useState('');
  const [repo, setRepo] = useState<string | null>(null);
  if (!s.data) return s.error ? <Empty>{s.error}</Empty> : <Spinner />;
  const save = async (patch: any) => {
    const r = await act(() => api.put('/api/github-codex/settings', patch), t('Gespeichert'));
    if (r) (s.setData(r), setToken(''), setRepo(null));
  };
  return (
    <div className="card" data-tour="ai-tools-github">
      <h2>
        <Icon name="github" size={18} /> {t('GitHub für Codex')} <SignupLink id="github" />
      </h2>
      <p className="muted small">
        {t('Für die Workflow-Aktion „GitHub-Issue für Codex anlegen“: Sie legt ein Issue mit dem Kontext des Kontakts und einer Zeile @codex … an – Codex übernimmt es als Aufgabe. Im Repository muss die Codex-GitHub-Integration eingeschaltet sein.')}
      </p>
      <Field label={t('GitHub-Token')} hint={t('Fein granularer Token mit „Issues: lesen & schreiben“ für die gewünschten Repositories. Wird verschlüsselt gespeichert und nie wieder angezeigt.')}>
        {s.data.token_set && !token ? (
          <div className="row" style={{ alignItems: 'center' }}>
            <Badge tone="green">{t('hinterlegt {hint}', { hint: s.data.token_hint })}</Badge>
            <button className="btn small secondary" onClick={() => setToken(' ')}>
              {t('Ersetzen')}
            </button>
            <button className="btn small secondary" onClick={() => confirmAsk(t('Token entfernen?')) && save({ token: null })}>
              {t('Entfernen')}
            </button>
          </div>
        ) : (
          <Input type="password" autoComplete="off" value={token.trim()} onChange={setToken} placeholder="github_pat_…" />
        )}
      </Field>
      <Field label={t('Standard-Repository')}>
        <Input value={repo ?? s.data.default_repo} onChange={setRepo} placeholder="besitzer/repository" />
      </Field>
      <div className="row">
        <button className="btn" onClick={() => save({ ...(token.trim() ? { token: token.trim() } : {}), ...(repo !== null ? { default_repo: repo } : {}) })}>
          {t('Speichern')}
        </button>
        <button
          className="btn secondary"
          disabled={!s.data.token_set}
          onClick={async () => {
            const r = await act(() => api.post('/api/github-codex/test', {}));
            if (r) toast(t('Zugriff ok: {repo}', { repo: r.repo }));
          }}
        >
          {t('Zugriff prüfen')}
        </button>
      </div>
    </div>
  );
}

/** Workflow step „GitHub-Issue für Codex anlegen“. */
export function GithubIssueStep({ step, set }: { step: any; set: (p: any) => void }) {
  const t = useT('aiprovider');
  const s = useLoad(() => api.get<any>('/api/github-codex/settings'), []);
  return (
    <>
      {s.data && !s.data.token_set && <p className="muted small">{t('Erst unter Einstellungen → KI-Werkzeuge → „GitHub für Codex“ einen Token hinterlegen.')}</p>}
      <Field label={t('Repository')} hint={t('besitzer/name – leer = Standard{default}. Codex muss dort per GitHub-Integration aktiv sein.', { default: s.data?.default_repo ? ` (${s.data.default_repo})` : '' })}>
        <Input value={step.repo} onChange={(v) => set({ repo: v })} placeholder={s.data?.default_repo || 'acme/website'} />
      </Field>
      <Field label={t('Titel')}>
        <Input value={step.title} onChange={(v) => set({ title: v })} placeholder={t('Fehler gemeldet von {name}', { name: '{{contact.first_name}}' })} />
      </Field>
      <Field label={t('Beschreibung (optional)')} hint={t('Kontakt, E-Mail, Firma und ein Link zum Kontakt werden automatisch angehängt.')}>
        <Textarea value={step.body} onChange={(v) => set({ body: v })} rows={4} />
      </Field>
      <Field label={t('Coding-Agent')}>
        <Select value={step.agent ?? 'codex'} onChange={(v) => set({ agent: v })} options={[['codex', '@codex'], ['claude', '@claude']]} />
      </Field>
      <Field label={t('Auftrag an den Agenten')} hint={t('Steht im Issue als Zeile „@codex …“ bzw. „@claude …“ – der Agent übernimmt das Issue dann als Aufgabe.')}>
        <Textarea value={step.prompt} onChange={(v) => set({ prompt: v })} rows={3} placeholder={t('Bitte den Fehler finden, beheben und einen Pull Request öffnen.')} />
      </Field>
      <Field label={t('Labels (optional, mit Komma)')}>
        <Input value={step.labels} onChange={(v) => set({ labels: v })} placeholder={t('bug, kunde')} />
      </Field>
      <MergeHint />
    </>
  );
}
