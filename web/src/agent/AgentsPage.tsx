import { Suspense, useState } from 'react';
import { Bot, Download, Laptop, MessageSquare, Plus, Upload } from 'lucide-react';
import { ago, api, dt } from '../api';
import { Icon } from '../icons';
import { useSession, can } from '../session';
import { Slot } from '../slots';
import { Badge, Check, CodeBox, Copy, Empty, Field, Input, Modal, PageHead, Select, Spinner, Stat, Tabs, Textarea, act, confirmAsk, navigate, toast, useLoad } from '../ui';
import { useT } from '../i18n';
import { AgentEditor } from './AgentEditor';
import { MODE_LABEL } from './Panel';
import { AiConnections } from '../pages/AiConnections';
import { lazyPages } from '../lazy';
import './agent.css';
import { SortableGrid } from '../sortable/Sortable';

// "Mit KI erstellen" (docs/agent.md#build-with-ai) – a chunk of its own.
const { AgentAiCreate } = lazyPages(() => import('./AgentAiCreate'), 'AgentAiCreate');

/**
 * „KI-Agenten“: your own AI co-workers (like Custom GPTs) with a template gallery, approvals from
 * automations, how to use HyperLevel from ChatGPT/Claude with your subscription (connector, Custom GPT
 * actions, local bridge), models (KI-Anbieter) and usage.
 */

const openAgent = (agentId: string | null, prompt?: string) => window.dispatchEvent(new CustomEvent('pghl:agent', { detail: { agentId, prompt, reload: true } }));
// i18n-ignore
const VIS: Record<string, string> = { private: 'Nur ich', team: 'Agentur-Team', location: 'Alle im Sub-Account' };

function AgentList() {
  const t = useT('collabws');
  const list = useLoad(() => api.get<any[]>('/api/agents'), []);
  const boot = useLoad(() => api.get('/api/agent/bootstrap'), []);
  const [edit, setEdit] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);
  const [aiCreate, setAiCreate] = useState(false);
  const download = async (a: any) => {
    const data = await act(() => api.get(`/api/agents/${a.id}/export`));
    if (!data) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${a.name.replace(/[^\wäöüÄÖÜß-]+/g, '-')}.agent.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  if (!list.data) return <Spinner />;
  const d = boot.data?.default_agent;
  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="btn" onClick={() => setEdit({})} data-tour="agents-new">
          <Plus size={15} /> {t('Neuer Agent')}
        </button>
        <button className="btn ai" onClick={() => setAiCreate(true)} data-tour="agents-ai">
          <Icon name="ai" size={15} /> {t('Mit KI erstellen')}
        </button>
        <button className="btn secondary" onClick={() => navigate('agents/templates')}>
          {t('Aus Vorlage')}
        </button>
        <button className="btn secondary" onClick={() => setImporting(true)}>
          <Upload size={15} /> {t('Importieren')}
        </button>
      </div>
      {boot.data && !boot.data.connection && !(boot.data.models ?? []).length && (
        <div className="card" style={{ marginBottom: 14 }}>
          <strong>{t('Noch kein KI-Modell verbunden.')}</strong> {t('Trag unter')} <a href="/app/settings/ai-providers" onClick={(e) => (e.preventDefault(), navigate('settings/ai-providers'))}>{t('KI-Anbieter (BYOK)')}</a> {t('einen Schlüssel ein – OpenAI, Anthropic, Gemini, OpenRouter, Groq, Mistral, ein lokales Modell (Ollama) … – oder nutze dein ChatGPT/Claude-Abo über die')} <a href="/app/agents/bridge" onClick={(e) => (e.preventDefault(), navigate('agents/bridge'))}>{t('Bridge')}</a>.
        </div>
      )}
      <SortableGrid id="agents-list" className="agents-grid" data-tour="agents-list">
        {d && (
          <div className="card">
            <div className="agent-card-head">
              <span className="agent-card-avatar">{d.emoji}</span>
              <div>
                <h3>{d.name}</h3>
                <span className="muted small">{t('Eingebaut ·')} {MODE_LABEL[d.mode]}</span>
              </div>
            </div>
            <div className="agent-card-desc">{d.description}</div>
            <div className="agent-card-actions">
              <button className="btn small" onClick={() => openAgent(null)}>
                <MessageSquare size={13} /> {t('Chat')}
              </button>
            </div>
          </div>
        )}
        {list.data.map((a) => (
          <div key={a.id} className="card" data-tour="agent-card">
            <div className="agent-card-head">
              <span className="agent-card-avatar" style={a.color ? { background: `${a.color}22` } : undefined}>
                {a.emoji}
              </span>
              <div style={{ minWidth: 0 }}>
                <h3>{a.name}</h3>
                <span className="muted small">
                  {MODE_LABEL[a.mode]} · {t(VIS[a.visibility])}
                  {a.owner_id !== undefined && !a.can_edit ? ` · ${t('· von …').replace('…', a.owner)}` : ''}
                </span>
              </div>
            </div>
            <div className="agent-card-desc">{a.description || <span className="muted">{t('Keine Rolle beschrieben.')}</span>}</div>
            <div className="row small muted">
              {a.schedules?.length ? <Badge tone="blue">{a.schedules.length} {t('Zeitplan')}</Badge> : null}
              {a.responder?.enabled ? <Badge tone="purple">{t('Auto-Antwort:')} {a.responder.channels.join(', ')}</Badge> : null}
              {a.tools ? <Badge>{a.tools.length} {t('Werkzeuge')}</Badge> : <Badge>{t('alle Werkzeuge')}</Badge>}
            </div>
            <div className="agent-card-actions">
              <button className="btn small" onClick={() => openAgent(a.id)}>
                <MessageSquare size={13} /> {t('Chat')}
              </button>
              {a.can_edit && (
                <button className="btn small secondary" onClick={() => setEdit(a)}>
                  {t('Bearbeiten')}
                </button>
              )}
              <button
                className="btn small secondary"
                onClick={async () => {
                  const c = await act(() => api.post(`/api/agents/${a.id}/clone`), t('Kopie angelegt'));
                  if (c) void list.reload();
                }}
              >
                {t('Klonen')}
              </button>
              <button className="btn small ghost" title={t('Als JSON exportieren')} onClick={() => void download(a)}>
                <Download size={13} />
              </button>
              {a.can_edit && (
                <button
                  className="btn small ghost"
                  onClick={async () => {
                    if (confirmAsk(t('„…“ löschen?').replace('…', a.name)) && (await act(() => api.del(`/api/agents/${a.id}`), t('Gelöscht')))) void list.reload();
                  }}
                >
                  {t('Löschen')}
                </button>
              )}
            </div>
          </div>
        ))}
      </SortableGrid>
      {!list.data.length && <Empty>{t('Noch keine eigenen Agenten. Leg einen an oder nimm eine Vorlage – z. B. „Vertriebs-Assistent“ oder „Support-Agent“.')}</Empty>}
      {edit && (
        <AgentEditor
          agent={edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            void list.reload();
            window.dispatchEvent(new CustomEvent('pghl:agent-changed'));
          }}
        />
      )}
      {aiCreate && (
        <Suspense fallback={null}>
          <AgentAiCreate onClose={() => setAiCreate(false)} onCreated={(a) => (setAiCreate(false), void list.reload(), setEdit(a))} />
        </Suspense>
      )}
      {importing && <ImportAgent onClose={() => setImporting(false)} onDone={() => (setImporting(false), void list.reload())} />}
    </>
  );
}

function ImportAgent({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useT('collabws');
  const [text, setText] = useState('');
  return (
    <Modal
      title={t('Agent importieren')}
      onClose={onClose}
      footer={
        <button
          className="btn"
          disabled={!text.trim()}
          onClick={async () => {
            let data: any;
            try {
              data = JSON.parse(text);
            } catch {
              return toast(t('Das ist kein gültiges JSON.'));
            }
            if (await act(() => api.post('/api/agents/import', data), t('Importiert'))) onDone();
          }}
        >
          {t('Importieren')}
        </button>
      }
    >
      <Field label={t('Exportierte Datei (.agent.json)')}>
        <input type="file" accept=".json,application/json" onChange={async (e) => setText((await e.target.files?.[0]?.text()) ?? '')} />
      </Field>
      <Field label={t('… oder JSON einfügen')}>
        <Textarea value={text} onChange={setText} rows={8} />
      </Field>
      <p className="muted small">{t('Sichtbarkeit, Modell-Verbindung und Auto-Antwort werden nicht übernommen – der Agent ist erst einmal privat.')}</p>
    </Modal>
  );
}

function Templates() {
  const t = useT('collabws');
  const list = useLoad(() => api.get<any[]>('/api/agents/templates'), []);
  const [edit, setEdit] = useState<any | null>(null);
  if (!list.data) return <Spinner />;
  return (
    <>
      <p className="muted">{t('Fertige KI-Mitarbeiter mit passenden Werkzeugen, Anweisungen und Startfragen. Danach kannst du alles anpassen.')}</p>
      <div className="agents-grid" data-tour="agents-templates">
        {list.data.map((t) => (
          <div key={t.key} className="card agent-template" style={{ ['--tpl' as any]: t.color }}>
            <div className="agent-card-head">
              <span className="agent-card-avatar">{t.emoji}</span>
              <div>
                <h3>{t.name}</h3>
                <span className="muted small">{MODE_LABEL[t.mode]}</span>
              </div>
            </div>
            <div className="agent-card-desc">{t.description}</div>
            {t.suggestion && <div className="small muted">{t('Idee:')} {t.suggestion}</div>}
            <div className="agent-card-actions">
              <button
                className="btn small"
                data-tour="template-use"
                onClick={async () => {
                  const a = await act(() => api.post('/api/agents', { template: t.key }), t('„…“ angelegt').replace('…', t.name));
                  if (a) setEdit(a);
                }}
              >
                {t('Verwenden')}
              </button>
            </div>
          </div>
        ))}
      </div>
      {edit && <AgentEditor agent={edit} onClose={() => (setEdit(null), navigate('agents'))} onSaved={() => (setEdit(null), navigate('agents'))} />}
    </>
  );
}

function Approvals() {
  const t = useT('collabws');
  const list = useLoad(() => api.get<any[]>('/api/agent/approvals'), []);
  if (!list.data) return <Spinner />;
  return (
    <>
      <p className="muted">{t('Wenn Agenten automatisch laufen (Workflows, Zeitpläne, MCP), führen sie nichts aus, was eine Bestätigung braucht – es landet hier. Du siehst genau, was passieren würde.')}</p>
      {!list.data.length && <Empty>{t('Nichts wartet auf dich.')}</Empty>}
      {list.data.map((p) => (
        <div key={p.id} className="card agent-confirm" style={{ marginBottom: 10 }}>
          <div className="agent-confirm-head">
            {p.agent} · {ago(p.created_at)}
          </div>
          <div className="agent-confirm-title">{p.summary}</div>
          <dl className="agent-args">
            {Object.entries(p.args ?? {}).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{typeof v === 'string' ? v : JSON.stringify(v)}</dd>
              </div>
            ))}
          </dl>
          <div className="row">
            <button className="btn" onClick={async () => (await act(() => api.post(`/api/agent/approvals/${p.id}`, { approve: true }), t('Ausgeführt'))) && list.reload()}>
              {t('Ausführen')}
            </button>
            <button className="btn secondary" onClick={async () => (await act(() => api.post(`/api/agent/approvals/${p.id}`, { approve: false }), t('Abgelehnt'))) && list.reload()}>
              {t('Ablehnen')}
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

const LEGAL =
  // i18n-ignore
  'ChatGPT- und Claude-Abos (Plus, Pro, Max) sind für die persönliche Nutzung in den Apps der Anbieter gedacht. HyperLevel nutzt sie nur auf den offiziellen Wegen: als Werkzeug in ChatGPT/Claude (Konnektor, Custom GPT) oder über die offiziellen CLIs auf deinem eigenen Rechner. HyperLevel speichert keine Abo-Zugangsdaten. Für Automationen, Teams und Kunden bitte API-Schlüssel (KI-Anbieter) nutzen.';

function ConnectInfo() {
  const t = useT('collabws');
  const session = useSession();
  const info = useLoad(() => api.get('/api/agent/connect'), []);
  const keys = useLoad(() => api.get<any[]>('/api/agent/gpt-actions/keys'), []);
  const tools = useLoad(() => api.get<any[]>('/api/agent/gpt-actions/tools'), []);
  const [creating, setCreating] = useState(false);
  const [sel, setSel] = useState<string[] | null>(null);
  const [allowWrite, setAllowWrite] = useState(false);
  const [name, setName] = useState('Mein HyperLevel-GPT');
  const [fresh, setFresh] = useState<any>(null);
  if (!info.data) return <Spinner />;
  const i = info.data;
  const chosen = sel ?? (tools.data ?? []).filter((t) => t.default).map((t) => t.name);
  return (
    <>
      <div className="card" data-tour="agent-connector">
        <h2>{t('1. HyperLevel als Werkzeug in ChatGPT oder Claude (empfohlen)')}</h2>
        <p>
          {t('Du chattest in')} <strong>ChatGPT</strong> oder {/* i18n-ignore */}<strong>Claude.ai</strong> {t('mit deinem eigenen Abo – HyperLevel ist dort ein Konnektor (MCP, Anmeldung per OAuth). Die Einrichtung steht auf der Seite')}{' '}
          <a href={`/app/${i.ai_tools_page}`} onClick={(e) => (e.preventDefault(), navigate(i.ai_tools_page))}>
            {t('KI-Werkzeuge')}
          </a>
          .
        </p>
        <Field label={t('Konnektor-Adresse (MCP-Server)')}>
          <CodeBox text={i.mcp_url} />
        </Field>
        <ol className="agent-steps small">
          <li>{t('ChatGPT: Einstellungen → Apps & Konnektoren → Entwicklermodus → „Erstellen“ → URL einfügen, Authentifizierung OAuth.')}</li>
          <li>{t('Claude.ai: Einstellungen → Konnektoren → „Benutzerdefinierten Konnektor hinzufügen“ → URL einfügen.')}</li>
          <li>{t('Bei HyperLevel anmelden, Sub-Account wählen, „Zulassen“ – fertig. Die KI kann dann Kontakte suchen, Deals pflegen, Aufgaben anlegen … mit deinen Rechten.')}</li>
        </ol>
        {!i.oauth && <p className="muted small">{t('Hinweis: Auf diesem Server ist OAuth für MCP nicht aktiv – dann mit einem Schlüssel (KI-Werkzeuge) verbinden.')}</p>}
      </div>
      <div className="card" data-tour="agent-gpt-actions">
        <h2>{t('2. Eigener Custom GPT mit HyperLevel-Aktionen')}</h2>
        <p className="small">{t('In ChatGPT unter „GPTs erstellen“ → Konfigurieren → „Aktion erstellen“: das Schema per URL importieren, Authentifizierung „API-Schlüssel“ → Typ „Bearer“ und den Schlüssel von hier eintragen. ChatGPT fragt vor jeder Aktion, die etwas ändert.')}</p>
        {!i.gpt_actions.enabled && <p className="muted">{t('Custom-GPT-Aktionen sind für diese Agentur ausgeschaltet.')}</p>}
        {fresh && (
          <div className="card" style={{ background: 'var(--brand-soft)' }}>
            <strong>{t('Schlüssel – wird nur jetzt angezeigt:')}</strong>
            <CodeBox text={fresh.key} />
            <Field label={t('Schema-URL für „Aus URL importieren“')}>
              <CodeBox text={fresh.openapi_url} />
            </Field>
          </div>
        )}
        {i.gpt_actions.enabled && (
          <button className="btn small" onClick={() => setCreating(true)}>
            {t('Schlüssel & Schema anlegen')}
          </button>
        )}
        {!!keys.data?.length && (
          <table className="agent-table-plain" style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>{t('Name')}</th>
                <th>{t('Werkzeuge')}</th>
                <th>{t('Rechte')}</th>
                <th>{t('Zuletzt')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {keys.data.map((k) => (
                <tr key={k.id}>
                  <td>
                    {k.name} <span className="muted small">{k.prefix}…</span>
                  </td>
                  <td>{k.tools.length}</td>
                  <td>{k.allow_sensitive ? t('auch versenden') : k.allow_write ? t('lesen & ändern') : t('nur lesen')}</td>
                  <td>{k.last_used_at ? ago(k.last_used_at) : '–'}</td>
                  <td>
                    <Copy text={k.openapi_url} label={t('Schema-URL')} />{' '}
                    <button className="btn small ghost" onClick={async () => confirmAsk(t('Schlüssel löschen? Der GPT verliert den Zugriff.')) && (await act(() => api.del(`/api/agent/gpt-actions/keys/${k.id}`))) && keys.reload()}>
                      {t('Löschen')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {creating && (
          <Modal
            title={t('Schlüssel für einen Custom GPT')}
            onClose={() => setCreating(false)}
            wide
            footer={
              <button
                className="btn"
                onClick={async () => {
                  const r = await act(() => api.post('/api/agent/gpt-actions/keys', { name, tools: chosen, allow_write: allowWrite }));
                  if (r) {
                    setFresh(r);
                    setCreating(false);
                    void keys.reload();
                  }
                }}
              >
                {t('Anlegen')}
              </button>
            }
          >
            <Field label="Name">
              <Input value={name} onChange={setName} />
            </Field>
            <Check checked={allowWrite} onChange={setAllowWrite} label={t('Darf ändern (Kontakte, Aufgaben, Deals …) – sonst nur lesen')} />
            <p className="muted small">{t('Höchstens')} {i.gpt_actions.max_operations} {t('Aktionen (Grenze von ChatGPT). Versenden/Löschen gibt nur ein Agentur-Admin frei.')}</p>
            <div className="agent-tool-groups">
              {Object.entries(
                (tools.data ?? []).reduce((m: Record<string, any[]>, t) => ((m[t.group] ??= []).push(t), m), {}),
              ).map(([g, list]) => (
                <div key={g} className="agent-tool-group">
                  <div className="agent-tool-group-head">{g}</div>
                  {(list as any[]).map((t) => (
                    <Check key={t.name} checked={chosen.includes(t.name)} onChange={(v) => setSel(v ? [...chosen, t.name].slice(0, i.gpt_actions.max_operations) : chosen.filter((x) => x !== t.name))} label={<span>{t.title}{t.klass !== 'read' && <span className={`agent-klass k-${t.klass}`}>{t.klass === 'sensitive' ? t('versendet') : t('ändert')}</span>}</span>} />
                  ))}
                </div>
              ))}
            </div>
          </Modal>
        )}
      </div>
      <div className="card">
        <h2>{t('3. Mit deinem Abo direkt hier im Chat')}</h2>
        <p className="small">
          {t('Experimentell: Die')} <a href="/app/agents/bridge" onClick={(e) => (e.preventDefault(), navigate('agents/bridge'))}>{t('lokale Bridge')}</a> {t('startet Codex CLI (ChatGPT-Abo) oder Claude Code (Claude-Abo) auf deinem Rechner und streamt die Antwort in diesen Chat.')}
        </p>
      </div>
      <p className="agent-legal">{t(LEGAL)}</p>
      {session.user.role === 'admin' && <AgencySwitches />}
    </>
  );
}

function AgencySwitches() {
  const t = useT('collabws');
  const s = useLoad(() => api.get('/api/agent/agency-settings'), []);
  if (!s.data) return null;
  const save = async (patch: any) => {
    const r = await act(() => api.put('/api/agent/agency-settings', patch), t('Gespeichert'));
    if (r) s.setData(r);
  };
  return (
    <div className="card">
      <h3>{t('Für die ganze Agentur (Admin)')}</h3>
      <Check checked={!!s.data.bridge_enabled} onChange={(v) => void save({ bridge_enabled: v })} label={t('Lokale Bridge erlauben (experimentell)')} tour="agent-bridge-toggle" />
      <Check checked={s.data.gpt_actions_enabled !== false} onChange={(v) => void save({ gpt_actions_enabled: v })} label={t('Custom-GPT-Aktionen erlauben')} />
      <Check checked={s.data.web_fetch_allowed !== false} onChange={(v) => void save({ web_fetch_allowed: v })} label={t('Agenten dürfen Webseiten lesen (wenn am Agenten eingeschaltet)')} />
    </div>
  );
}

function Bridge() {
  const t = useT('collabws');
  const session = useSession();
  const st = useLoad(() => api.get('/api/agent/bridge'), []);
  const [code, setCode] = useState<any>(null);
  if (!st.data) return <Spinner />;
  return (
    <>
      <div className="card" data-tour="agent-bridge">
        <h2>
          <Laptop size={18} style={{ verticalAlign: -3 }} /> {t('Mit deinem eigenen Abo (lokale Bridge)')}
        </h2>
        <p>
          <Badge tone="yellow">{t('Experimentell')}</Badge> <strong>{t('Läuft auf deinem Rechner mit deinem eigenen Abo – nur für dich selbst.')}</strong>
        </p>
        <p className="small">
          {t('Die Bridge ist ein kleines Node-Skript ohne Abhängigkeiten. Sie hält eine ausgehende Verbindung zu HyperLevel (keine offenen Ports), nimmt deine Chat-Aufträge an und startet die offizielle CLI, bei der du schon angemeldet bist:')} <strong>{t('Codex CLI')}</strong> {t('(„Sign in with ChatGPT“, Plus/Pro) oder')} <strong>{t('Claude Code')}</strong> {t('(Claude Pro/Max). Die CLI arbeitet nur mit den HyperLevel-Werkzeugen – mit deinen Rechten und Bestätigungen hier im Chat. Deine Abo-Anmeldung verlässt deinen Rechner nie.')}
        </p>
        {!st.data.enabled ? (
          <p className="muted">{session.user.role === 'admin' ? t('Erst unter „In ChatGPT & Claude“ → „Lokale Bridge erlauben“ einschalten.') : t('Die Bridge ist für diese Agentur nicht freigeschaltet – frag deinen Agentur-Admin.')}</p>
        ) : (
          <>
            <ol className="agent-steps small">
              <li>
                {/* i18n-ignore */}Node.js 18+ und <strong>{t('Codex CLI')}</strong> (<code>{t('npm i -g @openai/codex')}</code>{t(', dann')} <code>{t('codex login')}</code>{t(') oder')} <strong>{t('Claude Code')}</strong> (<code>{t('npm i -g @anthropic-ai/claude-code')}</code>{t(', dann')} <code>claude</code> {t('und anmelden) installieren.')}
              </li>
              <li>
                {t('Skript laden:')} <a href={st.data.script_url}>{t('gohigh-bridge.mjs herunterladen')}</a>
              </li>
              <li>
                {t('Koppeln:')}{' '}
                <button
                  className="btn small"
                  onClick={async () => {
                    const r = await act(() => api.post('/api/agent/bridge/code', {}));
                    if (r) setCode(r);
                  }}
                  data-tour="agent-bridge-code"
                >
                  {t('Einmal-Code erzeugen')}
                </button>
                {code && (
                  <div style={{ marginTop: 8 }}>
                    <CodeBox text={code.command} />
                    <span className="muted small">{t('Gültig bis')} {dt(code.expires_at)}.</span>
                  </div>
                )}
              </li>
              <li>
                {t('Starten:')} <code>{t('node gohigh-bridge.mjs')}</code> {t('– laufen lassen, solange du sie nutzen willst. Im Chat dann oben als Modell „Mein Abo über die Bridge“ wählen.')}
              </li>
            </ol>
            <h3>{t('Deine Geräte')}</h3>
            {!st.data.devices.length && <p className="muted small">{t('Noch kein Gerät gekoppelt.')}</p>}
            {st.data.devices.map((d: any) => (
              <div key={d.id} className="row" style={{ alignItems: 'center', marginBottom: 6 }}>
                <Badge tone={d.online ? 'green' : 'gray'}>{d.online ? t('verbunden') : t('offline')}</Badge>
                <strong>{d.name}</strong>
                <span className="muted small">{t('zuletzt')} {d.last_seen_at ? ago(d.last_seen_at) : '–'}</span>
                <Select value={d.cli} onChange={async (v) => (await act(() => api.patch(`/api/agent/bridge/devices/${d.id}`, { cli: v }))) && st.reload()} options={[['claude', t('Claude Code')], ['codex', t('Codex CLI')]]} />
                <button className="btn small ghost" onClick={async () => confirmAsk(t('Gerät entfernen?')) && (await act(() => api.del(`/api/agent/bridge/devices/${d.id}`))) && st.reload()}>
                  {t('Entfernen')}
                </button>
              </div>
            ))}
          </>
        )}
      </div>
      <p className="agent-legal">{t(LEGAL)}</p>
    </>
  );
}

function Usage() {
  const t = useT('collabws');
  const session = useSession();
  const u = useLoad(() => api.get('/api/agent/usage'), []);
  const s = useLoad(() => api.get('/api/agent/settings'), []);
  if (!u.data) return <Spinner />;
  const d = u.data;
  const usd = (v: number) => `${(v ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} $`;
  const saveSettings = async (patch: any) => {
    const r = await act(() => api.put('/api/agent/settings', patch), t('Gespeichert'));
    if (r) s.setData({ ...s.data, ...r });
  };
  return (
    <>
      <SortableGrid id="agents.kpis" className="agent-kpis">
        <Stat label={t('KI-Agent diesen Monat')} value={usd(d.agent.cost_usd)} sub={t('… Modell-Aufrufe · … Tokens').replace('…', String(d.agent.calls)).replace('…', d.agent.tokens.toLocaleString('de-DE'))} tour="agent-usage" />
        <Stat label={t('Alle KI-Aufrufe')} value={usd(d.total.cost_usd)} sub={t('Monatslimit …').replace('…', usd(d.limit_usd))} />
      </SortableGrid>
      <p className="muted small">{t('Agent-Aufrufe zählen auf das Monatslimit des KI-Assistenten (Einstellungen → KI-Assistent). Kosten je Verbindung siehst du unter KI-Anbieter.')}</p>
      <SortableGrid id="agents.costs" className="grid2">
        <div className="card">
          <h3>{t('Je Agent')}</h3>
          <table className="agent-table-plain">
            <tbody>
              {d.by_agent.map((a: any) => (
                <tr key={a.agent_id ?? 'default'}>
                  <td>{a.name}</td>
                  <td>{a.runs} {t('Läufe')}</td>
                  <td>{usd(a.cost_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>{t('Je Person')}</h3>
          <table className="agent-table-plain">
            <tbody>
              {d.by_user.map((a: any) => (
                <tr key={a.user_id}>
                  <td>{a.name}</td>
                  <td>{a.runs} {t('Läufe')}</td>
                  <td>{usd(a.cost_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SortableGrid>
      {s.data && can(session, 'settings') && (
        <div className="card">
          <h3>{t('Einstellungen für diesen Sub-Account')}</h3>
          <Check checked={s.data.enabled !== false} onChange={(v) => void saveSettings({ enabled: v })} label={t('KI-Agent im Sub-Account einschalten')} />
          <Field label={t('Modus des eingebauten HyperLevel Agent')}>
            <Select value={s.data.default_mode} onChange={(v) => void saveSettings({ default_mode: v })} options={Object.entries(MODE_LABEL)} />
          </Field>
          <Check checked={!!s.data.web_fetch} onChange={(v) => void saveSettings({ web_fetch: v })} label={t('HyperLevel Agent darf öffentliche Webseiten lesen')} />
        </div>
      )}
      <div className="card">
        <h3>{t('Letzte Läufe')}</h3>
        <table className="agent-table-plain">
          <thead>
            <tr>
              <th>{t('Wann')}</th>
              <th>{t('Agent')}</th>
              <th>{t('Weg')}</th>
              <th>{t('Status')}</th>
              <th>{t('Schritte')}</th>
              <th>{t('Kosten')}</th>
            </tr>
          </thead>
          <tbody>
            {d.recent.map((r: any) => (
              <tr key={r.id}>
                <td>{dt(r.started_at)}</td>
                <td>{r.agent}</td>
                <td>{r.source}</td>
                <td>{r.error ? <span title={r.error}>{r.status}</span> : r.status}</td>
                <td>{r.steps}</td>
                <td>{usd(r.cost_usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function AgentsPage({ tab = 'agents' }: { tab?: string }) {
  const t = useT('collabws');
  const session = useSession();
  const tabs: [string, string][] = [
    ['agents', t('Agenten')],
    ['templates', t('Vorlagen')],
    ['approvals', t('Freigaben')],
    ['connect', t('In ChatGPT & Claude')],
    ['bridge', t('Mit deinem Abo')],
    ...(can(session, 'settings') ? ([['models', t('Modelle')], ['tests', t('Prompt-Tests')]] as [string, string][]) : []),
    ['usage', t('Nutzung')],
  ];
  return (
    <>
      <PageHead title={t('KI-Agenten')} sub={t('Dein KI-Team: erledigt Aufgaben im CRM mit deinen Rechten – mit Bestätigung vor Änderungen.')}>
        <button className="btn" onClick={() => openAgent(null)} data-tour="agents-chat">
          <Bot size={15} /> {t('Chat öffnen')}
        </button>
      </PageHead>
      <Tabs tabs={tabs} value={tab} onChange={(t) => navigate(t === 'agents' ? 'agents' : `agents/${t}`)} />
      {tab === 'agents' && <AgentList />}
      {tab === 'templates' && <Templates />}
      {tab === 'approvals' && <Approvals />}
      {tab === 'connect' && <ConnectInfo />}
      {tab === 'bridge' && <Bridge />}
      {tab === 'models' && <AiConnections />}
      {tab === 'tests' && <Slot name="agents.tests" />}
      {tab === 'usage' && <Usage />}
    </>
  );
}
