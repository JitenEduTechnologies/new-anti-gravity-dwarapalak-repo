import { useEffect, useState } from 'react';
import { api, dt } from '../api';
import { Icon } from '../icons';
import { useSession } from '../session';
import { Badge, Check, Empty, Field, Link, Spinner, Textarea, act, confirmAsk, useLoad } from '../ui';
import { Note, PostureBadge, PurgeDialog, type Json } from './CogneeKit';
import { tr, useT } from '../i18n';
import './cognee.css';

/**
 * Einstellungen → Gedächtnis (docs/cognee.md): ask the memory, decide what the sub-account shares (opt-in, per data type, with
 * redaction), the governance status (what is shared, counts, last sync, errors, access control of the server, the last
 * actions from the audit log) and the notes people asked it to remember.
 */

export function CogneeSettings() {
  const t = useT('cognee');
  const info = useLoad(() => api.get<Json>('/api/cognee/info'), []);
  const cfg = useLoad(() => api.get<Json>('/api/cognee/admin/settings'), []);
  const status = useLoad(() => api.get<Json>('/api/cognee/admin/status'), []);
  const session = useSession();
  const [purge, setPurge] = useState<string[] | null>(null);
  const reload = () => {
    void info.reload();
    void cfg.reload();
    void status.reload();
  };
  // The sync runs in the background: look again every few seconds while the page is open.
  useEffect(() => {
    const timer = window.setInterval(() => void status.reload(), 10_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!info.data || !cfg.data || !status.data) return <Spinner />;
  const labels: Record<string, string> = Object.fromEntries((cfg.data.catalog as Json[]).map((c) => [c.key, c.label]));
  return (
    <>
      <div className="card" data-tour="cognee-intro">
        <h2>{t('Wissensgedächtnis (Cognee)')}</h2>
        <p className="muted small">
          {t('Ein Wissensgraph aus dem, was dieser Sub-Account freigibt – zum Fragen („Wie läuft unser Onboarding ab?“), für den KI-Agenten und für MCP-Clients wie Claude. Es wird nur geteilt, was du unten ausdrücklich einschaltest; Standard ist')} <strong>{t('aus')}</strong>. {t('Die Daten liegen auf dem Cognee-Server der Agentur, getrennt in eigenen Datasets dieses Sub-Accounts. Alles, was gesendet, durchsucht oder gelöscht wird, steht im Protokoll (nur Anzahlen, nie Inhalte).')}
        </p>
        {!cfg.data.connection.configured && (
          <Note level="warning">
            {t('Die Agentur hat den Cognee-Server noch nicht eingerichtet.')}{' '}
            {session.user.role === 'admin' ? <Link to="agency/integrations/setup">{t('Jetzt einrichten')}</Link> : t('Bitte dort nachfragen – bis dahin wird nichts übertragen.')}
          </Note>
        )}
      </div>
      {info.data.can_ask && <Ask info={info.data} />}
      <Opt cfg={cfg.data} status={status.data} onSaved={(r) => (r.offer_delete.length ? setPurge(r.offer_delete) : undefined, reload())} />
      <Status status={status.data} labels={labels} onChange={reload} onPurge={(types) => setPurge(types)} />
      {info.data.can_remember && <Memories onChange={reload} />}
      {purge && (
        <PurgeDialog
          types={purge}
          labels={labels}
          url="/api/cognee/admin/purge"
          onClose={() => {
            setPurge(null);
            reload();
          }}
        />
      )}
    </>
  );
}

// --- "Gedächtnis fragen" ------------------------------------------------------------------------------------------------------

function Source({ link, title }: { link: string; title: string }) {
  if (link.startsWith('/app/')) return <Link to={link}>{title}</Link>;
  if (/^https:\/\//.test(link))
    return (
      <a href={link} target="_blank" rel="noopener noreferrer">
        {title}
      </a>
    );
  return <strong>{title}</strong>;
}

function Ask({ info }: { info: Json }) {
  const t = useT('cognee');
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState(false);
  const [r, setR] = useState<Json | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!q.trim()) return;
    setBusy(true);
    const out = await act(() => api.get<Json>(`/api/cognee/recall?q=${encodeURIComponent(q.trim())}${answer ? '&mode=answer' : ''}`));
    setBusy(false);
    if (out) setR(out);
  };
  return (
    <div className="card" data-tour="cognee-ask">
      <h2>{t('Gedächtnis fragen')}</h2>
      <form
        className="cg-ask"
        onSubmit={(e) => {
          e.preventDefault();
          void go();
        }}
      >
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Frage oder Stichworte, z. B. Wie läuft der Onboarding-Call ab?')} aria-label={t('Frage an das Gedächtnis')} maxLength={500} />
        <button className="btn" disabled={busy || !q.trim()}>
          <Icon name="search" size={14} /> {busy ? t('Sucht …') : t('Fragen')}
        </button>
      </form>
      <Check checked={answer} onChange={setAnswer} label={t('Antwort formulieren lassen (nutzt das Sprachmodell des Cognee-Servers und kann dort Kosten verursachen)')} />
      <p className="muted small">{t('Durchsucht: {types}. Du siehst nur Treffer aus Bereichen, auf die du Zugriff hast.', { types: info.types.map((tp: Json) => tp.label).join(', ') })}</p>
      {r?.answer && <div className="cg-answer">{r.answer}</div>}
      {r && !r.results.length && <Empty>{r.note ?? t('Keine Treffer.')}</Empty>}
      {r && r.results.length > 0 && (
        <ul className="cg-hits">
          {r.results.map((h: Json, i: number) => (
            <li key={`${h.type}-${i}`} className="cg-hit">
              <div className="cg-hit-head">
                <Badge tone="blue">{h.type_label}</Badge>
                <Source link={h.link} title={h.title} />
              </div>
              <p className="small">{h.snippet}</p>
            </li>
          ))}
        </ul>
      )}
      {r?.note && r.results.length > 0 && <p className="muted small">{r.note}</p>}
    </div>
  );
}

// --- what is shared ---------------------------------------------------------------------------------------------------------------

function Opt({ cfg, status, onSaved }: { cfg: Json; status: Json; onSaved: (r: Json) => void }) {
  const t = useT('cognee');
  const [d, setD] = useState<Json>({ enabled: cfg.enabled, types: cfg.types, redact: cfg.redact, members_ask: cfg.members_ask });
  useEffect(() => setD({ enabled: cfg.enabled, types: cfg.types, redact: cfg.redact, members_ask: cfg.members_ask }), [cfg]);
  const items: Record<string, number> = Object.fromEntries((status.types as Json[]).map((tp) => [tp.key, tp.items]));
  const dirty = JSON.stringify(d) !== JSON.stringify({ enabled: cfg.enabled, types: cfg.types, redact: cfg.redact, members_ask: cfg.members_ask });
  const maySwitchOn = cfg.connection.locations_may_enable;
  const personalOn = (cfg.catalog as Json[]).filter((c) => c.personal && d.types[c.key]);
  return (
    <div className="card" data-tour="cognee-types">
      <h2>{t('Was geteilt wird')}</h2>
      <Check checked={d.enabled} onChange={(x) => setD({ ...d, enabled: x })} label={<strong>{t('Wissensgedächtnis für diesen Sub-Account einschalten')}</strong>} tour="cognee-enable" />
      {!maySwitchOn && !cfg.enabled && <p className="muted small">{t('Die Agentur schaltet das Gedächtnis selbst ein – frag dort nach.')}</p>}
      <div className="cg-types" style={{ opacity: d.enabled ? 1 : 0.55 }}>
        {(cfg.catalog as Json[]).map((c) => (
          <div key={c.key} className={`cg-type${d.enabled && d.types[c.key] ? ' on' : ''}`}>
            <div className="cg-type-head">
              <Check checked={!!d.types[c.key]} onChange={(x) => setD({ ...d, types: { ...d.types, [c.key]: x } })} label={c.label} />
              {c.personal && <Badge tone="yellow">{t('personenbezogen')}</Badge>}
              {items[c.key] > 0 && <span className="muted small">{t('{count} in Cognee', { count: items[c.key] })}</span>}
            </div>
            <p className="muted small" style={{ margin: '2px 0 0 26px' }}>
              {c.description}
              {c.warning && <> <strong>{c.warning}</strong></>}
            </p>
            {d.types[c.key] && (
              <div className="cg-type-sub">
                <Check checked={!!d.redact[c.key]} onChange={(x) => setD({ ...d, redact: { ...d.redact, [c.key]: x } })} label={t('E-Mail-Adressen, Telefonnummern und IBANs vor dem Senden schwärzen')} />
              </div>
            )}
          </div>
        ))}
      </div>
      <Check checked={d.members_ask} onChange={(x) => setD({ ...d, members_ask: x })} label={t('Mitglieder (Kunden-Logins) dürfen das Gedächtnis befragen – nur zu Bereichen, auf die sie Zugriff haben')} />
      {d.enabled && personalOn.length > 0 && <Note level="warning">{t('Personenbezogene Daten werden geteilt: {types}. Auftragsverarbeitung und Rechtsgrundlage sollten geklärt sein. Wird eine Person nach DSGVO gelöscht, löscht HyperLevel ihre Daten auch in Cognee.', { types: personalOn.map((c) => c.label).join(', ') })}</Note>}
      <p className="muted small">{t('Das Schwärzen ist eine Sicherung, keine Anonymisierung: Namen und Freitext bleiben. Wer die Schwärzung später ein- oder ausschaltet, schickt alles Betroffene neu und ersetzt die alte Fassung.')}</p>
      <button
        className="btn"
        disabled={!dirty}
        onClick={async () => {
          const r = await act(() => api.put<Json>('/api/cognee/admin/settings', { enabled: d.enabled, types: d.types, redact: d.redact, members_ask: d.members_ask }), tr('cognee')('Gespeichert'));
          if (r) onSaved(r);
        }}
        data-tour="cognee-save"
      >
        {t('Speichern')}
      </button>
    </div>
  );
}

// --- the governance status ----------------------------------------------------------------------------------------------------------

function PhaseBadge({ t: row }: { t: Json }) {
  const trBadge = useT('cognee');
  if (!row.active) return row.has_data ? <Badge tone="yellow">{trBadge('aus – Daten liegen noch in Cognee')}</Badge> : <Badge>{trBadge('aus')}</Badge>;
  if (row.last_error) return <Badge tone="red">{trBadge('Fehler')}</Badge>;
  if (row.phase === 'cognify') return <Badge tone="blue">{trBadge('Wissensgraph wird gebaut')}</Badge>;
  if (row.retry_at) return <Badge tone="yellow">{trBadge('wartet')}</Badge>;
  return row.last_sync_at ? <Badge tone="green">{trBadge('aktuell')}</Badge> : <Badge tone="blue">{trBadge('wartet auf den ersten Abgleich')}</Badge>;
}

const ACTIONS: Record<string, string> = {
  'cognee.push': 'Gesendet',
  'cognee.search': 'Befragt',
  'cognee.delete': 'Gelöscht',
  'cognee.erase': 'DSGVO',
  'cognee.purge': 'Löschen angestoßen',
  'cognee.settings': 'Freigaben',
  'cognee.remember': 'Gemerkt',
  'cognee.forget': 'Vergessen',
  'cognee.sync': 'Abgleich',
};

function Status({ status, labels, onChange, onPurge }: { status: Json; labels: Record<string, string>; onChange: () => void; onPurge: (types: string[]) => void }) {
  const t = useT('cognee');
  const leftovers = (status.types as Json[]).filter((tp) => !tp.active && tp.has_data);
  return (
    <div className="card" data-tour="cognee-status">
      <h2>
        {t('Status')} <PostureBadge state={status.access_control.state} />
      </h2>
      {(status.warnings as Json[]).map((w, i) => (
        <Note key={i} level={w.level}>
          {w.text}
        </Note>
      ))}
      <p className="muted small">
        {status.access_control.hint}
        {status.access_control.checked_at ? ` (${t('geprüft {date}', { date: dt(status.access_control.checked_at) })})` : ''}
      </p>
      <div className="table-wrap">
        <table className="t cg-status">
          <thead>
            <tr>
              <th>{t('Daten')}</th>
              <th>{t('Zustand')}</th>
              <th>{t('Einträge')}</th>
              <th>{t('Letzter Abgleich')}</th>
              <th>{t('Dataset in Cognee')}</th>
            </tr>
          </thead>
          <tbody>
            {(status.types as Json[]).map((tp) => (
              <tr key={tp.key}>
                <td>
                  {tp.label}
                  {tp.redact && tp.active && <div className="muted small">{t('geschwärzt')}</div>}
                </td>
                <td>
                  <PhaseBadge t={tp} />
                  {tp.last_error && <div className="small" style={{ color: 'var(--red)', maxWidth: 360 }}>{tp.last_error}</div>}
                  {tp.retry_at && <div className="muted small">{t('nächster Versuch {date}', { date: dt(tp.retry_at) })}</div>}
                  {tp.skipped > 0 && <div className="muted small">{t('{count} Eintrag/Einträge von Cognee abgelehnt', { count: tp.skipped })}</div>}
                </td>
                <td>{tp.items}</td>
                <td>{tp.last_sync_at ? dt(tp.last_sync_at) : '–'}</td>
                <td>
                  <code>{tp.dataset}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cg-actions">
        <button
          className="btn secondary"
          disabled={!status.enabled}
          onClick={async () => {
            if (await act(() => api.post('/api/cognee/admin/sync', {}), tr('cognee')('Abgleich gestartet'))) window.setTimeout(onChange, 1500);
          }}
        >
          <Icon name="refresh" size={14} /> {t('Jetzt abgleichen')}
        </button>
        <button
          className="btn secondary"
          disabled={!status.enabled}
          title={t('Schaut jeden Datensatz noch einmal an – Unverändertes kostet nichts')}
          onClick={async () => {
            if (confirmAsk(t('Alles neu abgleichen? Jeder freigegebene Datensatz wird noch einmal geprüft; nur Geändertes wird gesendet.')) && (await act(() => api.post('/api/cognee/admin/sync', { full: true }), tr('cognee')('Voller Abgleich gestartet')))) window.setTimeout(onChange, 1500);
          }}
        >
          {t('Alles neu abgleichen')}
        </button>
        {leftovers.length > 0 && (
          <button className="btn danger" onClick={() => onPurge(leftovers.map((tp) => tp.key))} data-tour="cognee-purge">
            <Icon name="trash" size={14} /> {t('Daten in Cognee löschen …')}
          </button>
        )}
      </div>
      {status.pending_deletions > 0 && <p className="muted small">{t('{count} Löschung(en) werden an Cognee gesendet (bei Fehlern wiederholt HyperLevel sie automatisch).', { count: status.pending_deletions })}</p>}
      {leftovers.length > 0 && <p className="muted small">{t('Noch in Cognee, aber nicht mehr freigegeben: {types}.', { types: leftovers.map((tp) => labels[tp.key] ?? tp.key).join(', ') })}</p>}
      <h3 style={{ margin: '14px 0 2px' }}>{t('Letzte Vorgänge')}</h3>
      {(status.audit as Json[]).length === 0 ? (
        <p className="muted small">{t('Noch nichts. Das ganze Protokoll steht unter Einstellungen → API & Webhooks bzw. Agentur → Protokoll (Aktionen „cognee.…“).')}</p>
      ) : (
        <ul className="cg-log small">
          {(status.audit as Json[]).map((a, i) => (
            <li key={i}>
              <time>{dt(a.at)}</time>
              <span>
                <strong>{ACTIONS[a.action] ? t(ACTIONS[a.action]) : a.action}:</strong> {a.summary}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- remembered notes --------------------------------------------------------------------------------------------------------------------

function Memories({ onChange }: { onChange: () => void }) {
  const t = useT('cognee');
  const list = useLoad(() => api.get<Json[]>('/api/cognee/memories'), []);
  const [text, setText] = useState('');
  return (
    <div className="card" data-tour="cognee-memories">
      <h2>{t('Gemerkte Hinweise')}</h2>
      <p className="muted small">{t('Was hier steht, landet im Gedächtnis und kann gefunden werden – auch vom KI-Agenten (Tool „ghl_memory_remember“). Keine Passwörter oder Zugangsdaten eintragen.')}</p>
      <Field label={t('Neuer Hinweis')}>
        <Textarea value={text} onChange={setText} rows={3} maxLength={4000} placeholder={t('z. B. Rechnungen gehen immer an die Buchhaltung, nie an die Geschäftsleitung.')} />
      </Field>
      <button
        className="btn"
        disabled={!text.trim()}
        onClick={async () => {
          if (await act(() => api.post('/api/cognee/remember', { text: text.trim() }), tr('cognee')('Gemerkt'))) {
            setText('');
            void list.reload();
            onChange();
          }
        }}
      >
        {t('Merken')}
      </button>
      {!list.data ? (
        <Spinner />
      ) : (
        list.data.map((m) => (
          <div key={m.id} className="cg-mem">
            <div>
              <p>{m.text}</p>
              <span className="muted small">
                {dt(m.created_at)}
                {m.created_by_name ? ` · ${m.created_by_name}` : ''} · {m.synced ? t('im Gedächtnis') : t('wird übertragen')}
              </span>
            </div>
            <button
              className="btn small ghost danger-text"
              onClick={async () => {
                if (!confirmAsk(t('Diesen Hinweis löschen? Er wird auch in Cognee entfernt.'))) return;
                if (await act(() => api.del(`/api/cognee/memories/${m.id}`), tr('cognee')('Gelöscht'))) {
                  void list.reload();
                  onChange();
                }
              }}
            >
              <Icon name="trash" size={13} /> {t('Löschen')}
            </button>
          </div>
        ))
      )}
    </div>
  );
}
