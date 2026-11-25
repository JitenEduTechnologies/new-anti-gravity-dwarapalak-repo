import { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n';
import { api, dt } from '../api';
import { Icon } from '../icons';
import { useSession } from '../session';
import { Badge, Check, CodeBox, Empty, Field, Input, MergeHint, Modal, PageHead, Select, Spinner, Tabs, TagInput, Textarea, act, confirmAsk, navigate, toast, toastError, useLoad } from '../ui';
import { IntegrationsCatalog } from './Integrations';
import { DirectConnectors } from './Connectors';
import { SignupLink } from '../referrals';
import { NangoApps, NangoSuggestions } from './Nango';
import { McpServers } from './McpServers';
import { PageSuspense, lazyPages } from '../lazy';

const { BooksSync } = lazyPages(() => import('./BooksSync'), 'BooksSync');

/**
 * Apps & Integrationen (sub-account): the integrations catalogue plus everything Composio – 250+
 * apps to connect, app events as workflow triggers, the allow-list for the AI and MCP – and the
 * direct connectors. Workflow step editors for app actions live here too.
 */

type Json = Record<string, any>;
interface Toolkit {
  slug: string;
  name: string;
  logo: string;
  description: string;
  categories: string[];
  tools_count: number;
  triggers_count: number;
  no_auth: boolean;
  managed_auth: boolean;
  connection: string | null;
}
interface Conn {
  id: string;
  toolkit: string;
  toolkit_name: string;
  logo: string;
  status: string;
  status_reason: string;
  scope: string;
  created_at: string;
}

const getComposioStatus = (t: (s: string) => string, status: string): [string, 'green' | 'yellow' | 'red' | 'gray' | 'blue'] => {
  const map: Record<string, [string, 'green' | 'yellow' | 'red' | 'gray' | 'blue']> = {
    active: [t('verbunden'), 'green'],
    pending: [t('wird verbunden'), 'blue'],
    expired: [t('abgelaufen – neu verbinden'), 'yellow'],
    failed: [t('fehlgeschlagen'), 'red'],
    error: [t('Fehler'), 'red'],
    inactive: [t('inaktiv'), 'gray'],
    revoked: [t('widerrufen'), 'gray'],
  };
  return map[status] ?? [status, 'gray'];
};
const getSourceLabel = (t: (s: string) => string, src: string): string => {
  const map: Record<string, string> = {
    agency: t('Schlüssel der Agentur'),
    location: t('eigener Schlüssel dieses Sub-Accounts'),
    env: t('Schlüssel aus der Server-Umgebung'),
  };
  return map[src] ?? src;
};
const getComposioContactTargets = (t: (s: string) => string): [string, string][] => [
  ['email', t('E-Mail')],
  ['phone', t('Telefon')],
  ['first_name', t('Vorname')],
  ['last_name', t('Nachname')],
  ['name', t('Name (wird geteilt)')],
  ['company', t('Firma')],
  ['address', t('Adresse')],
  ['city', t('Ort')],
  ['postal_code', t('PLZ')],
  ['country', t('Land')],
  ['website', t('Website')],
  ['tags', t('Tags')],
];

const clip = (s: unknown, n: number) => {
  const t = String(s ?? '');
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

function AppLogo({ src, name, size = 32 }: { src?: string; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span className="cx-logo cx-logo-fallback" style={{ width: size, height: size }} aria-hidden>
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return <img className="cx-logo" src={src} alt="" width={size} height={size} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
}

/** After Composio sends the browser back (?composio=ok|pending|error&app=…): toast once, clean the address. */
function useComposioReturn(onDone?: () => void) {
  const t = useT('connectors');
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const st = q.get('composio');
    if (!st) return;
    if (st === 'ok') toast(t('{app} verbunden', { app: q.get('app') ?? t('App') }));
    else if (st === 'pending') toast(t('{app}: Verbindung wird noch geprüft – gleich „Aktualisieren“', { app: q.get('app') ?? t('App') }));
    else toastError(q.get('msg') || t('Verbinden fehlgeschlagen'));
    history.replaceState(null, '', location.pathname);
    onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

async function connectApp(toolkit: string) {
  const r = await act(() => api.post<{ url: string }>('/api/composio/connections', { toolkit }));
  if (r?.url) location.href = r.url;
}

// --- dynamic form from an action's JSON schema --------------------------------------------------------

export function schemaType(s: Json | undefined): string {
  if (!s) return 'string';
  const t = Array.isArray(s.type) ? s.type.find((x: string) => x !== 'null') : s.type;
  if (t) return t;
  const alt = (s.anyOf ?? s.oneOf ?? []).find((x: Json) => x.type && x.type !== 'null');
  if (alt) return schemaType(alt);
  if (s.properties) return 'object';
  if (s.items) return 'array';
  return 'string';
}

/** Form for an action's inputs. Values stay text (merge fields allowed); the server converts them. */
export function SchemaForm({ schema, values, onChange, merge = true }: { schema: Json | undefined; values: Json; onChange: (v: Json) => void; merge?: boolean }) {
  const t = useT('connectors');
  const [more, setMore] = useState(false);
  const props = Object.entries<Json>(schema?.properties ?? {});
  const req = new Set<string>(schema?.required ?? []);
  const required = props.filter(([k]) => req.has(k));
  const optional = props.filter(([k]) => !req.has(k));
  if (!props.length) return <p className="muted small">{t('Diese Aktion braucht keine Eingaben.')}</p>;
  const set = (k: string, v: string) => onChange({ ...values, [k]: v });
  const field = ([k, s]: [string, Json]) => {
    const fType = schemaType(s);
    const label = `${s.title || k}${req.has(k) ? ' *' : ''}`;
    const v = values?.[k] === undefined || values?.[k] === null ? '' : typeof values[k] === 'object' ? JSON.stringify(values[k]) : String(values[k]);
    const desc = s.description ? clip(s.description, 180) : '';
    if (Array.isArray(s.enum) && s.enum.length) return <Field key={k} label={label} hint={desc || undefined}><Select value={v} onChange={(x) => set(k, x)} placeholder="–" options={s.enum.map(String)} /></Field>;
    if (fType === 'boolean') return <Field key={k} label={label} hint={desc || undefined}><Select value={v} onChange={(x) => set(k, x)} placeholder="–" options={[['true', t('Ja')], ['false', t('Nein')]]} /></Field>;
    if (fType === 'object' || fType === 'array') {
      const hint = `${desc ? `${desc} – ` : ''}${fType === 'array' ? t('eine Angabe pro Zeile oder JSON-Liste') : t('als JSON')}`;
      return <Field key={k} label={label} hint={hint}><Textarea value={v} onChange={(x) => set(k, x)} rows={3} /></Field>;
    }
    const long = fType === 'string' && /body|text|content|message|description|html|markdown|comment|note|summary/i.test(k);
    const ph = s.default !== undefined ? String(s.default) : Array.isArray(s.examples) && s.examples.length ? String(s.examples[0]) : fType === 'integer' || fType === 'number' ? t('Zahl') : '';
    return <Field key={k} label={label} hint={desc || undefined}>{long ? <Textarea value={v} onChange={(x) => set(k, x)} rows={4} placeholder={ph} /> : <Input value={v} onChange={(x) => set(k, x)} placeholder={ph} />}</Field>;
  };
  return (
    <div className="cx-form" data-tour="composio-form">
      {required.map(field)}
      {optional.length > 0 && (
        <>
          <button type="button" className="btn small ghost" onClick={() => setMore(!more)}>
            {more ? '▾' : '▸'} {t('Weitere Felder (')} {optional.length})
          </button>
          {(more || optional.some(([k]) => values?.[k] !== undefined && values[k] !== '')) && optional.map(field)}
        </>
      )}
      {merge && <MergeHint />}
    </div>
  );
}

// --- Apps hub -----------------------------------------------------------------------------------------

export function AppsHub({ tab = 'catalog' }: { tab?: string }) {
  const t = useT('connectors');
  const value = ['catalog', 'composio', 'events', 'ai', 'direct', 'books', 'nango', 'mcp'].includes(tab) ? tab : 'catalog';
  return (
    <>
      <PageHead title={t('Apps & Integrationen')} sub={t('Eingebaute Integrationen, 250+ Apps über Composio und direkte Verbindungen – alles, was dieser Sub-Account verbunden hat.')} />
      <Tabs
        tabs={[
          ['catalog', t('Katalog')],
          ['composio', t('Composio-Apps')],
          ['events', t('App-Ereignisse')],
          ['ai', 'KI & MCP'],
          ['direct', t('Direkt-Verbindungen')],
          ['books', t('Buchhaltung')],
          ['nango', 'Nango'],
          ['mcp', t('MCP-Server')],
        ]}
        value={value}
        onChange={(t) => navigate(t === 'catalog' ? 'apps' : `apps/${t}`)}
      />
      {value === 'catalog' && (
        <IntegrationsCatalog
          agency={false}
          after={(q) => (
            <>
              <ComposioSuggestions q={q} />
              <NangoSuggestions q={q} />
            </>
          )}
        />
      )}
      {value === 'composio' && <ComposioApps />}
      {value === 'events' && <ComposioEvents />}
      {value === 'ai' && <ComposioAi />}
      {value === 'direct' && <DirectConnectors />}
      {value === 'books' && (
        <PageSuspense>
          <BooksSync />
        </PageSuspense>
      )}
      {value === 'nango' && <NangoApps />}
      {value === 'mcp' && <McpServers />}
    </>
  );
}

/** Under the native catalogue: matching Composio apps (or the most used ones), with logo and „Verbinden“. */
function ComposioSuggestions({ q }: { q: string }) {
  const t = useT('connectors');
  const st = useLoad(() => api.get<Json>('/api/composio'), []);
  const [list, setList] = useState<Toolkit[] | null>(null);
  const [err, setErr] = useState('');
  const term = q.trim();
  useEffect(() => {
    if (!st.data?.configured) return;
    const timer = setTimeout(() => {
      api
        .get<{ items: Toolkit[] }>(`/api/composio/toolkits${term.length >= 2 ? `?search=${encodeURIComponent(term)}` : ''}`)
        .then((r) => (setList(r.items.slice(0, 12)), setErr('')))
        .catch((e) => setErr(e.message));
    }, 250);
    return () => clearTimeout(timer);
  }, [term, st.data?.configured]);
  if (!st.data) return null;
  return (
    <div className="cx-suggest" data-tour="apps-composio-suggest">
      <h3 className="integ-h">
        <Icon name="apps" size={14} /> {term.length >= 2 ? t('„{term}“ über Composio', { term }) : t('Über 250 weitere Apps über Composio')}
      </h3>
      {!st.data.configured ? (
        <p className="muted small">
          {t('Slack, Notion, HubSpot, Shopify, Google Sheets, Calendly & Co. mit verwalteter Anmeldung:')} {st.data.is_admin ? t('trag unter Agentur → Integrationen → Einrichtung einen Composio-Schlüssel ein.') : t('die Agentur muss Composio einmal einrichten.')}
        </p>
      ) : err ? (
        <p className="muted small">{err}</p>
      ) : !list ? (
        <Spinner />
      ) : list.length ? (
        <>
          <div className="cx-grid">
            {list.map((t) => (
              <ToolkitCard key={t.slug} t={t} />
            ))}
          </div>
          <p className="small">
            <a href="/app/apps/composio" onClick={(e) => (e.preventDefault(), navigate('apps/composio'))}>{t('Alle Composio-Apps durchsuchen →')}</a>
          </p>
        </>
      ) : (
        <p className="muted small">{t('Keine Composio-App gefunden.')}</p>
      )}
    </div>
  );
}

function ToolkitCard({ t: tk }: { t: Toolkit }) {
  const t = useT('connectors');
  const st = tk.connection ? getComposioStatus(t, tk.connection) : null;
  return (
    <div className="card cx-tk">
      <div className="cx-tk-head">
        <AppLogo src={tk.logo} name={tk.name} />
        <div className="cx-tk-title">
          <strong>{tk.name}</strong>
          <span className="muted small">{tk.categories.slice(0, 2).join(' · ') || t('App')}</span>
        </div>
      </div>
      <p className="cx-tk-desc small">{clip(tk.description, 120)}</p>
      <div className="cx-tk-foot">
        <span className="muted small">
          {tk.tools_count} {t('Aktionen')}{tk.triggers_count ? ` · ${tk.triggers_count} ${t('Ereignisse')}` : ''}
        </span>
        {tk.no_auth ? (
          <Badge tone="blue">{t('ohne Anmeldung')}</Badge>
        ) : st && tk.connection === 'active' ? (
          <Badge tone={st[1]}>{st[0]}</Badge>
        ) : (
          <button className="btn small" onClick={() => void connectApp(tk.slug)}>
            {tk.connection ? t('Neu verbinden') : t('Verbinden')}
          </button>
        )}
      </div>
    </div>
  );
}

// --- Composio-Apps: key, connected apps, catalogue -------------------------------------------------------

function ComposioApps() {
  const st = useLoad(() => api.get<Json>('/api/composio'), []);
  useComposioReturn(() => void st.reload());
  if (st.error) return <Empty>{st.error}</Empty>;
  if (!st.data) return <Spinner />;
  return (
    <div className="cx">
      <ComposioKeyCard v={st.data} onChange={st.reload} />
      {st.data.configured && <Connections conns={st.data.connections} onChange={st.reload} />}
      {st.data.configured && <Catalogue />}
    </div>
  );
}

function ComposioKeyCard({ v, onChange }: { v: Json; onChange: () => void }) {
  const t = useT('connectors');
  const [key, setKey] = useState('');
  const [open, setOpen] = useState(false);
  const [test, setTest] = useState<Json | null>(null);
  return (
    <div className="card" data-tour="apps-composio-status">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Composio</h2>
        {v.configured ? <Badge tone="green">{t('eingerichtet')}</Badge> : <Badge>{t('nicht eingerichtet')}</Badge>}
      </div>
      <p className="muted small">
        {t('Composio verbindet 250+ Apps mit verwalteter Anmeldung (OAuth, API-Schlüssel). Dieser Sub-Account ist bei Composio der Nutzer')} <code>{v.user_id}</code> {t('– seine Verbindungen sind von anderen Sub-Accounts getrennt.')}
      </p>
      {v.configured ? (
        <p className="small">
          {t('Verwendet:')} <strong>{getSourceLabel(t, v.source)}</strong> {v.key_hint && <code>{v.key_hint}</code>}
        </p>
      ) : (
        <p className="small">{v.is_admin ? t('Trag den Schlüssel einmal für die Agentur ein (Agentur → Integrationen → Einrichtung) oder hier nur für diesen Sub-Account.') : t('Die Agentur hat Composio noch nicht eingerichtet. Optional kannst du hier einen eigenen Schlüssel eintragen.')}</p>
      )}
      <div className="row" style={{ gap: 6 }}>
        {v.configured && (
          <button className="btn small secondary" onClick={async () => setTest((await act(() => api.post('/api/composio/test'))) ?? null)}>{t('Verbindung testen')}</button>
        )}
        <button className="btn small ghost" onClick={() => setOpen(!open)}>
          {v.override ? t('Eigenen Schlüssel ändern') : t('Eigenen Schlüssel für diesen Sub-Account')}
        </button>
        {v.override && (
          <button className="btn small ghost" onClick={async () => confirmAsk(t('Eigenen Composio-Schlüssel entfernen? Apps, die damit verbunden wurden, funktionieren dann nicht mehr.')) && (await act(() => api.put('/api/composio/settings', { api_key: null }), t('Entfernt'))) && onChange()}>{t('Eigenen Schlüssel entfernen')}</button>
        )}
      </div>
      {test && (
        <p className="small">
          <Badge tone="green">OK</Badge> {test.auth_configs} {test.auth_configs === 1 ? t('Auth-Konfiguration') : t('Auth-Konfigurationen')} {t('im Composio-Projekt')}
          {test.webhook ? (test.webhook.exists ? (test.webhook.ours ? t(t(t(t(' · Webhook zeigt auf HyperLevel')))) : t(t(' · Webhook zeigt woandershin (App-Ereignisse kommen trotzdem an)'))) : t(t(' · Webhook wird beim ersten App-Ereignis angelegt'))) : ''}
        </p>
      )}
      {open && (
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="grow">
            <Field label={t('Composio-API-Schlüssel')} hint={<>{t('Composio → Settings → API Keys. Wird verschlüsselt gespeichert und nie wieder angezeigt.')} <SignupLink id="composio" /></>}>
              <Input type="password" value={key} onChange={setKey} autoComplete="off" placeholder={v.override ? `${t('gespeichert')} ${v.override_hint}` : 'ak_…'} />
            </Field>
          </div>
          <button
            className="btn"
            style={{ marginBottom: 12 }}
            disabled={!key}
            onClick={async () => {
              if (await act(() => api.put('/api/composio/settings', { api_key: key }), t('Gespeichert'))) (setKey(''), setOpen(false), onChange());
            }}
          >
            {t('Speichern')}
          </button>
        </div>
      )}
    </div>
  );
}

function Connections({ conns, onChange }: { conns: Conn[]; onChange: () => void }) {
  const t = useT('connectors');
  const [busy, setBusy] = useState(false);
  return (
    <div className="card" data-tour="apps-composio-connected">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>{t('Verbundene Apps')}</h2>
        <button
          className="btn small secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            if (await act(() => api.get('/api/composio/connections?refresh=1'), t('Status aktualisiert'))) onChange();
            setBusy(false);
          }}
        >
          <Icon name="refresh" size={13} /> {t('Aktualisieren')}
        </button>
      </div>
      {conns.length ? (
        <div className="cx-conns">
          {conns.map((c) => {
            const s = getComposioStatus(t, c.status);
            return (
              <div key={c.id} className="cx-conn">
                <AppLogo src={c.logo} name={c.toolkit_name} size={28} />
                <div className="cx-conn-main">
                  <strong>{c.toolkit_name}</strong>
                  <span className="muted small">
                    seit {dt(c.created_at)}
                    {c.status_reason ? ` · ${clip(c.status_reason, 80)}` : ''}
                  </span>
                </div>
                <Badge tone={s[1]}>{s[0]}</Badge>
                {c.status !== 'active' && c.status !== 'pending' && (
                  <button className="btn small" onClick={() => void connectApp(c.toolkit)}>{t('Neu verbinden')}</button>
                )}
                <button className="btn small ghost" onClick={async () => confirmAsk(t('{name} trennen? Auch bei Composio wird die Verbindung gelöscht; Workflows mit dieser App schlagen dann fehl.', { name: c.toolkit_name || c.toolkit })) && (await act(() => api.del(`/api/composio/connections/${c.id}`), t('Getrennt'))) && onChange()}>
                  {t('Trennen')}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="muted">{t('Noch keine App verbunden – unten suchen und „Verbinden“.')}</p>
      )}
    </div>
  );
}

function Catalogue() {
  const t = useT('connectors');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [items, setItems] = useState<Toolkit[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const cats = useLoad(() => api.get<{ id: string; name: string }[]>('/api/composio/categories').catch(() => []), []);
  const load = async (more = false) => {
    try {
      const p = new URLSearchParams();
      if (q.trim()) p.set('search', q.trim());
      if (cat) p.set('category', cat);
      if (more && cursor) p.set('cursor', cursor);
      const r = await api.get<{ items: Toolkit[]; next_cursor: string | null }>(`/api/composio/toolkits?${p}`);
      setItems(more ? [...(items ?? []), ...r.items] : r.items);
      setCursor(r.next_cursor);
      setErr('');
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, cat]);
  return (
    <div className="card" data-tour="apps-composio-catalog">
      <h2>{t('App-Katalog')}</h2>
      <div className="integ-toolbar">
        <input type="search" placeholder={t('Suchen: Shopify, HubSpot, Typeform, Calendly …')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('Composio-Apps durchsuchen')} />
        {(cats.data ?? []).length > 0 && (
          <div className="chips">
            <button className={`chip${cat === '' ? ' on' : ''}`} onClick={() => setCat('')}>{t('Alle')}</button>
            {(cats.data ?? []).slice(0, 14).map((c) => (
              <button key={c.id} className={`chip${cat === c.id ? ' on' : ''}`} onClick={() => setCat(cat === c.id ? '' : c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
      {err ? (
        <Empty>{err}</Empty>
      ) : !items ? (
        <Spinner />
      ) : items.length ? (
        <>
          <div className="cx-grid">
            {items.map((t) => (
              <ToolkitCard key={t.slug} t={t} />
            ))}
          </div>
          {cursor && (
            <p style={{ textAlign: 'center' }}>
              <button className="btn secondary" onClick={() => void load(true)}>{t('Mehr laden')}</button>
            </p>
          )}
        </>
      ) : (
        <Empty>{t('Keine App passt zur Suche.')}</Empty>
      )}
    </div>
  );
}

// --- App-Ereignisse (triggers) ----------------------------------------------------------------------------

function ComposioEvents() {
  const t = useT('connectors');
  const st = useLoad(() => api.get<Json>('/api/composio'), []);
  const list = useLoad(() => api.get<{ webhook_url: string | null; items: Json[] }>('/api/composio/triggers'), []);
  const [adding, setAdding] = useState(false);
  const [log, setLog] = useState<Json | null>(null);
  const [mapping, setMapping] = useState<Json | null>(null);
  if (!st.data || !list.data) return <Spinner />;
  if (!st.data.configured) return <Empty>{t('Erst Composio einrichten (Reiter „Composio-Apps“).')}</Empty>;
  const active = (st.data.connections as Conn[]).filter((c) => c.status === 'active');
  return (
    <div className="cx">
      <div className="card" data-tour="apps-events">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>{t('App-Ereignisse')}</h2>
          <button className="btn" disabled={!active.length} onClick={() => setAdding(true)} data-tour="apps-events-new">
            {t('+ App-Ereignis')}
          </button>
        </div>
        <p className="muted small">
        <p className="muted small">
          {t('Eine neue Shopify-Bestellung, eine Typeform-Antwort, eine Calendly-Buchung oder ein GitHub-Issue legt den Kontakt an (per E-Mail/Telefon) und startet Workflows mit dem Auslöser')} <strong>{t('„App-Ereignis (Composio)“')}</strong>{t('. Alle Felder stehen dort als')} <code>{'{{event.trigger_payload.<feld>}}'}</code> {t('bereit.')}
        </p>
          <code>{'{{event.<feld>}}'}</code> bereit.
        </p>
        {!active.length && <p className="small">{t('Erst eine App verbinden (Reiter „Composio-Apps“).')}</p>}
        {list.data.items.length ? (
          <div className="cx-table">
            <table className="t">
              <thead>
                <tr>
                  <th>{t('Ereignis')}</th>
                  <th>Status</th>
                  <th>{t('Empfangen')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.name}</strong>
                      <div className="muted small">
                        {r.toolkit_name} · {r.trigger_slug}
                        {r.tags.length ? ` · ${t('Tags:')} ${r.tags.join(', ')}` : ''}
                      </div>
                      {r.last_error && <div className="small" style={{ color: 'var(--red)' }}>{r.last_error}</div>}
                    </td>
                    <td>{r.status === 'active' ? <Badge tone="green">aktiv</Badge> : r.status === 'paused' ? <Badge>pausiert</Badge> : <Badge tone="red">{t('Fehler')}</Badge>}</td>
                    <td className="small">
                      {r.events}× {r.last_event_at ? <span className="muted">· {t('zuletzt')} {dt(r.last_event_at)}</span> : null}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button className="btn small ghost" onClick={() => setLog(r)}>{t('Protokoll')}</button>
                      <button className="btn small ghost" onClick={() => setMapping(r)}>{t('Felder')}</button>
                      <button className="btn small ghost" onClick={async () => (await act(() => api.patch(`/api/composio/triggers/${r.id}`, { status: r.status === 'active' ? 'paused' : 'active' }), r.status === 'active' ? t('Pausiert') : t('Aktiv'))) && list.reload()}>
                        {r.status === 'active' ? t('Pausieren') : t('Aktivieren')}
                      </button>
                      <button className="btn small ghost" onClick={async () => confirmAsk(t('„{name}“ löschen? Auch bei Composio wird der Auslöser entfernt.', { name: r.name })) && (await act(() => api.del(`/api/composio/triggers/${r.id}`), t('Gelöscht'))) && list.reload()}>
                        {t('Löschen')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">{t('Noch kein App-Ereignis abonniert.')}</p>
        )}
        {list.data.webhook_url && (
          <p className="muted small">
            {t('Composio liefert an')} <code>{list.data.webhook_url}</code> {t('(signiert, Wiederholungen werden erkannt).')}
          </p>
        )}
      </div>
      {adding && <NewTrigger conns={active} onClose={() => setAdding(false)} onDone={() => (setAdding(false), list.reload())} />}
      {log && <TriggerLog row={log} onClose={() => setLog(null)} />}
      {mapping && <TriggerMapping row={mapping} onClose={() => setMapping(null)} onDone={() => (setMapping(null), list.reload())} />}
    </div>
  );
}

function NewTrigger({ conns, onClose, onDone }: { conns: Conn[]; onClose: () => void; onDone: () => void }) {
  const t = useT('connectors');
  const [toolkit, setToolkit] = useState(conns[0]?.toolkit ?? '');
  const types = useLoad(() => (toolkit ? api.get<Json[]>(`/api/composio/triggers/types?toolkit=${encodeURIComponent(toolkit)}`) : Promise.resolve([])), [toolkit]);
  const [slug, setSlug] = useState('');
  const [config, setConfig] = useState<Json>({});
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const type = (types.data ?? []).find((x) => x.slug === slug);
  return (
    <Modal
      title={t('App-Ereignis abonnieren')}
      onClose={onClose}
      footer={
        <button
          className="btn"
          disabled={!slug || busy}
          onClick={async () => {
            setBusy(true);
            const r = await act(() => api.post('/api/composio/triggers', { toolkit, trigger_slug: slug, config, tags }), t('Abonniert – jetzt im Workflow den Auslöser „App-Ereignis (Composio)“ wählen'));
            setBusy(false);
            if (r) onDone();
          }}
        >{t('Abonnieren')}</button>
      }
    >
      <Field label={t('App')}>
        <Select value={toolkit} onChange={(v) => (setToolkit(v), setSlug(''), setConfig({}))} options={conns.map((c) => [c.toolkit, c.toolkit_name] as [string, string])} />
      </Field>
      {types.error ? (
        <p className="muted">{types.error}</p>
      ) : !types.data ? (
        <Spinner />
      ) : types.data.length ? (
        <Field label={t('Ereignis')}>
          <Select value={slug} onChange={(v) => (setSlug(v), setConfig({}))} placeholder={t('wählen…')} options={types.data.map((x) => [x.slug, x.name] as [string, string])} />
        </Field>
      ) : (
        <p className="muted">{t('Diese App hat bei Composio keine Ereignisse.')}</p>
      )}
      {type && (
        <>
          {type.description && <p className="muted small">{clip(type.description, 300)}</p>}
          <SchemaForm schema={type.config} values={config} onChange={setConfig} merge={false} />
          {type.instructions && <p className="muted small">{clip(type.instructions, 400)}</p>}
        </>
      )}
      <Field label={t('Tags für den Kontakt (optional)')}>
        <TagInput value={tags} onChange={setTags} />
      </Field>
      <p className="muted small">{t('Ohne Feldzuordnung sucht HyperLevel E-Mail, Telefon und Name selbst im Ereignis. Die Zuordnung lässt sich danach unter „Felder“ einstellen.')}</p>
    </Modal>
  );
}

function TriggerLog({ row, onClose }: { row: Json; onClose: () => void }) {
  const t = useT('connectors');
  const ev = useLoad(() => api.get<Json[]>(`/api/composio/triggers/${row.id}/events`), [row.id]);
  const [open, setOpen] = useState<string | null>(null);
  const LABEL: Record<string, [string, 'green' | 'yellow' | 'gray' | 'red']> = { ok: [t('Kontakt + Workflows'), 'green'], no_contact: [t('ohne Kontakt'), 'yellow'], ignored: [t('ignoriert'), 'gray'] };
  return (
    <Modal title={`${t('Protokoll:')} ${row.name}`} onClose={onClose} wide>
      {!ev.data ? (
        <Spinner />
      ) : ev.data.length ? (
        <table className="t">
          <tbody>
            {ev.data.map((e) => (
              <tr key={e.id}>
                <td className="small" style={{ whiteSpace: 'nowrap' }}>{dt(e.created_at)}</td>
                <td>
                  <Badge tone={(LABEL[e.status] ?? [e.status, 'gray'])[1]}>{(LABEL[e.status] ?? [e.status])[0]}</Badge> <span className="muted small">{e.detail}</span>
                  {open === e.id && <pre className="cx-pre">{JSON.stringify(e.payload, null, 2)}</pre>}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {e.contact_id && (
                    <button className="btn small ghost" onClick={() => (onClose(), navigate(`contacts/${e.contact_id}`))}>{t('Kontakt')}</button>
                  )}
                  <button className="btn small ghost" onClick={() => setOpen(open === e.id ? null : e.id)}>{t('Daten')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Empty>{t('Noch kein Ereignis empfangen.')}</Empty>
      )}
    </Modal>
  );
}

function TriggerMapping({ row, onClose, onDone }: { row: Json; onClose: () => void; onDone: () => void }) {
  const t = useT('connectors');
  const fields = useLoad(() => api.get<Json[]>('/api/custom-fields'), []);
  const [map, setMap] = useState<{ from: string; to: string }[]>(row.mapping ?? []);
  const [tags, setTags] = useState<string[]>(row.tags ?? []);
  const [sample, setSample] = useState('');
  const [preview, setPreview] = useState<Json | null>(null);
  const targets: [string, string][] = [...getComposioContactTargets(t), ...(fields.data ?? []).map((f) => [`custom.${f.key}`, `${t('Feld:')} ${f.label}`] as [string, string])];
  const run = async () => {
    let payload: unknown;
    if (sample.trim()) {
      try {
        payload = JSON.parse(sample);
      } catch {
        return toastError(t('Beispiel ist kein gültiges JSON'));
      }
    }
    const r = await act(() => api.post(`/api/composio/triggers/${row.id}/preview`, { mapping: map, ...(payload ? { payload } : {}) }));
    if (r) setPreview(r);
  };
  return (
    <Modal
      title={`${t('Felder:')} ${row.name}`}
      onClose={onClose}
      wide
      footer={
        <button className="btn" onClick={async () => (await act(() => api.patch(`/api/composio/triggers/${row.id}`, { mapping: map, tags }), t('Gespeichert'))) && onDone()}>
          {t('Speichern')}
        </button>
      }
    >
      <p className="muted small">
        {t('Leer = automatisch (erste E-Mail-Adresse, Telefonnummer und Name im Ereignis). Pfade mit Punkten, z. B.')} <code>customer.email</code> {t('oder')} <code>answers.0.email</code>.
      </p>
      {map.map((m, i) => (
        <div key={i} className="row" style={{ marginBottom: 6 }}>
          <div className="grow">
            <Input value={m.from} onChange={(v) => setMap(map.map((x, j) => (j === i ? { ...x, from: v } : x)))} placeholder={t('Pfad im Ereignis')} list="cx-paths" />
          </div>
          <div className="grow">
            <Select value={m.to} onChange={(v) => setMap(map.map((x, j) => (j === i ? { ...x, to: v } : x)))} placeholder={t('Kontaktfeld')} options={targets} />
          </div>
          <button className="icon-btn" aria-label={t('Entfernen')} onClick={() => setMap(map.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <datalist id="cx-paths">
        {(preview?.paths ?? []).map((p: Json) => (
          <option key={p.path} value={p.path}>
            {p.sample}
          </option>
        ))}
      </datalist>
      <button className="btn small secondary" onClick={() => setMap([...map, { from: '', to: 'email' }])}>
        {t('+ Zuordnung')}
      </button>
      <Field label={t('Tags für den Kontakt')}>
        <TagInput value={tags} onChange={setTags} />
      </Field>
      <Field label={t('Beispiel-Ereignis (optional, JSON)')} hint={t('Leer = das zuletzt empfangene Ereignis.')}>
        <Textarea value={sample} onChange={setSample} rows={4} />
      </Field>
      <button className="btn small secondary" onClick={() => void run()}>{t('Vorschau')}</button>
      {preview && (
        <p className="small">
          {preview.ok ? <Badge tone="green">{t('Kontakt')}</Badge> : <Badge tone="yellow">{t('kein Kontakt')}</Badge>} <code>{JSON.stringify(preview.contact)}</code>
        </p>
      )}
    </Modal>
  );
}

// --- KI & MCP: allow-list, test, calls ----------------------------------------------------------------------

function ComposioAi() {
  const t = useT('connectors');
  const session = useSession();
  const st = useLoad(() => api.get<Json>('/api/composio'), []);
  const calls = useLoad(() => api.get<Json[]>('/api/composio/calls'), []);
  const [allow, setAllow] = useState<string[] | null>(null);
  useEffect(() => {
    if (st.data && allow === null) setAllow(st.data.allow ?? []);
  }, [st.data]);
  if (!st.data || allow === null) return <Spinner />;
  if (!st.data.configured) return <Empty>{t('Erst Composio einrichten (Reiter „Composio-Apps“).')}</Empty>;
  const active = (st.data.connections as Conn[]).filter((c) => c.status === 'active');
  const dirty = JSON.stringify(allow) !== JSON.stringify(st.data.allow ?? []);
  const orphan = allow.filter((a) => !a.endsWith(':*') && !active.some((c) => a.toLowerCase().startsWith(`${c.toolkit.replace(/-/g, '_')}_`)));
  return (
    <div className="cx">
      <div className="card" data-tour="apps-ai-allow">
        <h2>{t('Freigaben für KI & MCP')}</h2>
        <p className="muted small">
          {t('Nur diese App-Aktionen darf der KI-Assistent (Schritt „KI-Agent mit Apps“) und ein MCP-Client wie Claude oder Codex über')} <code>ghl_composio_action</code> {t('ausführen. Workflows mit „App-Aktion ausführen“ brauchen keine Freigabe.')}
        </p>
        {active.length ? (
          active.map((c) => <AllowApp key={c.id} conn={c} allow={allow} setAllow={setAllow} />)
        ) : (
          <p className="muted">{t('Erst eine App verbinden.')}</p>
        )}
        {orphan.length > 0 && (
          <div className="chips" style={{ marginTop: 8 }}>
            <span className="muted small">{t('Weitere Freigaben:')}</span>
            {orphan.map((a) => (
              <span key={a} className="chip on">
                {a}
                <button className="icon-btn" aria-label={t('{name} entfernen', { name: a })} onClick={() => setAllow(allow.filter((x) => x !== a))}>
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <p>
          <button className="btn" disabled={!dirty} onClick={async () => (await act(() => api.put('/api/composio/allow', { allow }), t('Freigaben gespeichert'))) && st.reload()}>{t('Speichern')}</button>
        </p>
      </div>
      <AiTest />
      <div className="card" data-tour="apps-ai-mcp">
        <h2>{t('MCP: Claude & Codex in allen Apps')}</h2>
        {/* i18n-ignore */}
        <p className="muted small">
          {t('Der MCP-Server von HyperLevel (')}<code>/api/mcp</code>{t(', Schlüssel unter Einstellungen → API & Webhooks oder Agentur → API & MCP) hat das Werkzeug')} <code>ghl_composio_action</code>: <code>mode: "search"</code> {t('findet freigegebene Aktionen samt Eingaben,')} <code>mode: "execute"</code> {t('führt eine aus – immer im Sub-Account des Schlüssels bzw. der übergebenen')} <code>location_id</code>.
        </p>
        <CodeBox text={`{"location_id": "${session.locationId}", "mode": "execute", "tool": "SLACK_SEND_MESSAGE", "arguments": {"channel": "#vertrieb", "text": "Neuer Lead!"}}`} />
      </div>
      <div className="card">
        <h2>{t('Letzte Aufrufe')}</h2>
        {calls.data?.length ? (
          <div className="cx-table">
            <table className="t">
              <tbody>
                {calls.data.slice(0, 25).map((c) => (
                  <tr key={c.id}>
                    <td className="small" style={{ whiteSpace: 'nowrap' }}>{dt(c.created_at)}</td>
                    <td>
                      <code>{c.tool}</code> <span className="muted small">{t('über')} {({ workflow: t('Workflow'), ui: t('Oberfläche'), api: 'API', mcp: 'MCP', ai: t('KI') } as Json)[c.source] ?? c.source}</span>
                      {c.error && <div className="small" style={{ color: 'var(--red)' }}>{clip(c.error, 160)}</div>}
                    </td>
                    <td>{c.ok ? <Badge tone="green">OK</Badge> : <Badge tone="red">{t('Fehler')}</Badge>}</td>
                    <td className="muted small">{c.ms} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">{t('Noch keine App-Aktion ausgeführt.')}</p>
        )}
      </div>
    </div>
  );
}

function AllowApp({ conn, allow, setAllow }: { conn: Conn; allow: string[]; setAllow: (v: string[]) => void }) {
  const t = useT('connectors');
  const all = `${conn.toolkit}:*`;
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Json[] | null>(null);
  const mine = allow.filter((a) => !a.endsWith(':*'));
  const search = async () => {
    const r = await act(() => api.get<{ items: Json[] }>(`/api/composio/tools?toolkit=${encodeURIComponent(conn.toolkit)}&search=${encodeURIComponent(q)}`));
    if (r) setFound(r.items.slice(0, 15));
  };
  return (
    <div className="cx-allow">
      <div className="cx-allow-head">
        <AppLogo src={conn.logo} name={conn.toolkit_name} size={24} />
        <strong>{conn.toolkit_name}</strong>
        <Check checked={allow.includes(all)} onChange={(on) => setAllow(on ? [...allow, all] : allow.filter((a) => a !== all))} label={t('alle Aktionen')} />
      </div>
      {!allow.includes(all) && (
        <>
          <div className="chips">
            {mine
              .filter((a) => a.toLowerCase().startsWith(`${conn.toolkit.replace(/-/g, '_')}_`))
              .map((a) => (
                <span key={a} className="chip on">
                  {a}
                  <button className="icon-btn" aria-label={t('{name} entfernen', { name: a })} onClick={() => setAllow(allow.filter((x) => x !== a))}>
                    ✕
                  </button>
                </span>
              ))}
          </div>
          <div className="row" style={{ alignItems: 'center', marginTop: 6 }}>
            <div className="grow">
              <Input value={q} onChange={setQ} placeholder={t('Aktion suchen, z. B. „nachricht senden“')} onKeyDown={(e) => e.key === 'Enter' && void search()} />
            </div>
            <button className="btn small secondary" onClick={() => void search()}>{t('Suchen')}</button>
          </div>
          {found && (
            <div className="cx-found">
              {found.length ? (
                found.map((tk: Json) => (
                  <div key={tk.slug} className="cx-found-row">
                    <span>
                      <code>{tk.slug}</code> <span className="muted small">{clip(tk.description, 100)}</span>
                    </span>
                    {allow.includes(tk.slug) ? (
                      <Badge tone="green">{t('freigegeben')}</Badge>
                    ) : (
                      <button className="btn small" onClick={() => setAllow([...allow, tk.slug])}>
                        {t('+ Freigeben')}
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="muted small">{t('Nichts gefunden.')}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AiTest() {
  const t = useT('connectors');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Json | null>(null);
  return (
    <div className="card" data-tour="apps-ai-test">
      <h2>{t('KI mit Apps ausprobieren')}</h2>
      <p className="muted small">{t('Der KI-Assistent plant Schritt für Schritt, sucht freigegebene Aktionen und führt sie aus. Jeder Schritt zählt aufs KI-Monatslimit; Aktionen wirken echt in der App.')}</p>
      <Field label={t('Aufgabe')}>
        <Textarea value={prompt} onChange={setPrompt} rows={3} placeholder={t('z. B. Schick in Slack #vertrieb eine kurze Zusammenfassung der neuen Leads von heute.')} />
      </Field>
      <button
        className="btn"
        disabled={!prompt.trim() || busy}
        onClick={async () => {
          setBusy(true);
          setRes((await act(() => api.post('/api/composio/ai', { prompt }))) ?? null);
          setBusy(false);
        }}
      >
        {busy ? t('Läuft …') : t('Ausführen')}
      </button>
      {res && (
        <div className="cx-agent">
          <ol className="small">
            {res.steps.map((s: Json, i: number) => (
              <li key={i}>
                <strong>{s.action === 'search' ? t('Suche') : s.action === 'execute' ? `${t('Aktion')} ${s.tool}` : t('Antwort')}</strong> {s.ok === false && <Badge tone="red">{t('Fehler')}</Badge>} <span className="muted">{clip(s.detail, 240)}</span>
              </li>
            ))}
          </ol>
          <p>{res.answer}</p>
        </div>
      )}
    </div>
  );
}

// --- Agentur → Integrationen → Einrichtung ----------------------------------------------------------------

export function ComposioAgencySetup() {
  const t = useT('connectors');
  const s = useLoad(() => api.get<Json>('/api/agency/composio'), []);
  const [key, setKey] = useState('');
  const [test, setTest] = useState<Json | null>(null);
  if (!s.data) return <Spinner />;
  const v = s.data;
  return (
    <div className="card" style={{ flex: '1 1 340px' }} data-tour="composio-agency">
      <h2>{t('Composio (250+ Apps)')}<SignupLink id="composio" /></h2>
      <p className="muted small">
        {t('Ein Projekt-Schlüssel von')} <a href="https://composio.dev" target="_blank" rel="noopener">Composio</a> {t('für alle Sub-Accounts: Slack, Notion, HubSpot, Shopify, Google Sheets & Co. mit verwalteter Anmeldung. Jeder Sub-Account verbindet seine eigenen Konten; ein Sub-Account kann auch einen eigenen Schlüssel nutzen.')}
      </p>
      <Field label={t('API-Schlüssel')} hint={t('Composio → Settings → API Keys (Projekt-Schlüssel). Wird verschlüsselt gespeichert.')}>
        <Input type="password" value={key} onChange={setKey} autoComplete="off" placeholder={v.key_set ? `•••••••• ${v.key_hint} (${v.source === 'env' ? t('aus der Umgebung') : t('gespeichert')})` : 'ak_…'} />
      </Field>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn" disabled={!key} onClick={async () => (await act(() => api.put('/api/agency/composio', { api_key: key }), t('Gespeichert'))) && (setKey(''), s.reload())}>{t('Speichern')}</button>
        {v.key_set && (
          <button className="btn secondary" onClick={async () => setTest((await act(() => api.post('/api/agency/composio/test'))) ?? null)}>{t('Verbindung testen')}</button>
        )}
        {v.key_set && v.source !== 'env' && (
          <button className="btn ghost" onClick={async () => confirmAsk(t('Composio-Schlüssel der Agentur entfernen? Verbundene Apps der Sub-Accounts funktionieren dann nicht mehr.')) && (await act(() => api.del('/api/agency/composio'), t('Entfernt'))) && s.reload()}>{t('Entfernen')}</button>
        )}
      </div>
      {test && (
        <p className="small">
          <Badge tone="green">{t('verbunden')}</Badge> {test.auth_configs} {test.auth_configs === 1 ? t('Auth-Konfiguration') : t('Auth-Konfigurationen')}{test.webhook ? (test.webhook.exists ? (test.webhook.ours ? t(' · Webhook zeigt auf HyperLevel') : t(' · Webhook zeigt auf eine andere Adresse')) : t(' · noch kein Webhook')) : ''}
        </p>
      )}
      <p className="muted small">
        {v.connections} {t('verbundene Apps in')} {v.locations} {t('Sub-Accounts')}{v.overrides ? ` · ${v.overrides} ${t('Sub-Account(s) mit eigenem Schlüssel')}` : ''}{t('. App-Ereignisse kommen an')} <code>{v.webhook_url}</code> {t('– HyperLevel richtet den Webhook beim ersten Abo selbst ein.')}
      </p>
    </div>
  );
}

// --- Workflow editor parts ----------------------------------------------------------------------------------

/** Step "App-Aktion ausführen (Composio)": app → action (searchable) → form from the action's schema → result mapping. */
export function ComposioActionStep({ step, set, customFields }: { step: Json; set: (p: Json) => void; customFields: Json[] }) {
  const t = useT('connectors');
  const conns = useLoad(() => api.get<Conn[]>('/api/composio/connections').catch(() => [] as Conn[]), []);
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);
  const toolkit = step.toolkit ?? '';
  const tools = useLoad(() => (toolkit ? api.get<{ items: Json[] }>(`/api/composio/tools?toolkit=${encodeURIComponent(toolkit)}${term ? `&search=${encodeURIComponent(term)}` : ''}`) : Promise.resolve({ items: [] })), [toolkit, term]);
  const tool = useLoad(() => (step.tool ? api.get<Json>(`/api/composio/tools/${encodeURIComponent(step.tool)}`) : Promise.resolve(null)), [step.tool]);
  const active = (conns.data ?? []).filter((c) => c.status === 'active');
  const map: { from: string; to: string }[] = step.map ?? [];
  const targets: [string, string][] = [...getComposioContactTargets(t).filter(([k]) => !['name', 'tags'].includes(k)), ...customFields.map((f) => [`custom.${f.key}`, `Feld: ${f.label}`] as [string, string])];
  if (!conns.data) return <Spinner />;
  if (!active.length && !step.tool)
    return (
      <p className="muted">
        {t('Noch keine App verbunden.')}{' '}
        <a href="/app/apps/composio" onClick={(e) => (e.preventDefault(), navigate('apps/composio'))}>
          {t('Apps → Composio-Apps')}
        </a>
      </p>
    );
  return (
    <>
      <Field label={t('App')}>
        <Select value={toolkit} onChange={(v) => set({ toolkit: v, tool: '', arguments: {} })} placeholder={t('wählen…')} options={active.map((c) => [c.toolkit, c.toolkit_name] as [string, string])} />
      </Field>
      {toolkit && (
        <Field label={t('Aktion')} hint={step.tool ? undefined : t('Suchen, z. B. „send“, „create“, „row“')}>
          <Input value={q} onChange={setQ} placeholder={t('Aktion suchen …')} />
          <div className="cx-pick">
            {(tools.data?.items ?? []).slice(0, 30).map((tk: Json) => (
              <button key={tk.slug} type="button" className={`cx-pick-row${tk.slug === step.tool ? ' on' : ''}`} onClick={() => set({ tool: tk.slug, arguments: {} })}>
                <strong>{tk.name}</strong> <span className="muted small">{clip(tk.description, 90)}</span>
              </button>
            ))}
            {tools.data && !tools.data.items.length && <span className="muted small">{t('Nichts gefunden.')}</span>}
          </div>
        </Field>
      )}
      {step.tool && (
        <>
          <p className="small">
            {t('Gewählt:')} <code>{step.tool}</code> {tool.data && !tool.data.connected && <Badge tone="yellow">{t('App nicht verbunden')}</Badge>}
          </p>
          {tool.error ? <p className="muted small">{tool.error}</p> : !tool.data ? <Spinner /> : <SchemaForm schema={tool.data.input_parameters} values={step.arguments ?? {}} onChange={(v) => set({ arguments: v })} />}
          <h4 className="integ-h">{t('Ergebnis übernehmen (optional)')}</h4>
          <p className="muted small">
          <p className="muted small">
            {t('Pfad im Ergebnis → Kontaktfeld, z. B.')} <code>data.id</code> {t('oder')} <code>data.user.email</code> {t('→ eigenes Feld. Spätere Schritte lesen das Ergebnis als')} <code>{'{{event.composio_action.data.<pfad>}}'}</code>.
          </p>
          </p>
          {map.map((m, i) => (
            <div key={i} className="row" style={{ marginBottom: 6 }}>
              <div className="grow">
                <Input value={m.from} onChange={(v) => set({ map: map.map((x, j) => (j === i ? { ...x, from: v } : x)) })} placeholder={t('z. B. data.id')} />
              </div>
              <div className="grow">
                <Select value={m.to} onChange={(v) => set({ map: map.map((x, j) => (j === i ? { ...x, to: v } : x)) })} placeholder={t('Kontaktfeld')} options={targets} />
              </div>
              <button className="icon-btn" aria-label={t('Entfernen')} onClick={() => set({ map: map.filter((_, j) => j !== i) })}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn small secondary" onClick={() => set({ map: [...map, { from: '', to: '' }] })}>
            {t('+ Zuordnung')}
          </button>
          <p className="muted small">{t('Fehler (z. B. App abgelehnt) stehen im Verlauf des Kontakts; kurze Ausfälle bei Composio werden automatisch wiederholt. „Bei Fehler stoppen“ in den Workflow-Einstellungen beendet den Workflow dann.')}</p>
        </>
      )}
    </>
  );
}

/** Step "KI-Agent mit Apps": a task for the AI that may use the allow-listed app actions. */
export function ComposioAiStep({ step, set, customFields }: { step: Json; set: (p: Json) => void; customFields: Json[] }) {
  const t = useT('connectors');
  return (
    <>
      <Field label={t('Aufgabe für die KI')} hint={t('Die KI darf nur Aktionen nutzen, die unter Apps → KI & MCP freigegeben sind.')}>
        <Textarea value={step.prompt} onChange={(v) => set({ prompt: v })} rows={5} placeholder={t('z. B. Lege für {{contact.name}} ({{contact.email}}) einen Deal in HubSpot an und poste ihn in Slack #vertrieb.')} />
      </Field>
      <MergeHint />
      <Field label={t('Antwort speichern in (optional)')}>
        <Select value={step.save_field} onChange={(v) => set({ save_field: v })} placeholder={t('nicht speichern')} options={customFields.map((f) => [`custom.${f.key}`, `Feld: ${f.label}`] as [string, string])} />
      </Field>
    </>
  );
}

/** Trigger filter for "App-Ereignis (Composio)". */
export function ComposioTriggerFilter({ config, set }: { config: Json; set: (p: Json) => void }) {
  const t = useT('connectors');
  const list = useLoad(() => api.get<{ items: Json[] }>('/api/composio/triggers').catch(() => ({ items: [] as Json[] })), []);
  const items = list.data?.items ?? [];
  const opts = useMemo(() => items.map((r) => [r.id, `${r.toolkit_name}: ${r.name}`] as [string, string]), [items]);
  return (
    <>
      <Field label={t('App-Ereignis')}>
        <Select value={config.subscription_id} onChange={(v) => set({ subscription_id: v })} placeholder={t('jedes App-Ereignis')} options={opts} />
      </Field>
      <p className="muted small">
        {items.length ? '' : t('Noch kein App-Ereignis abonniert.') + ' '}
        <a href="/app/apps/events" onClick={(e) => (e.preventDefault(), navigate('apps/events'))}>
          {t('Apps → App-Ereignisse')}
        </a>{' '}
        {t('– Felder des Ereignisses stehen als')} <code>{'{{event.trigger_payload.<feld>}}'}</code> {t('bereit, dazu')} <code>{'{{event.event_name}}'}</code> {t('und')} <code>{'{{event.app}}'}</code>.
      </p>
    </>
  );
}
