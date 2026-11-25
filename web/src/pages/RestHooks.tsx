import { useEffect, useState } from 'react';
import { api, dt } from '../api';
import { Icon } from '../icons';
import { act, Badge, CodeBox, confirmAsk, Empty, Field, Input, Modal, pressable, Select, Spinner, useLoad } from '../ui';
import { MoreFields } from '../areas/fields';
import { useT } from '../i18n';

/** Einstellungen → API & Webhooks: REST-hook subscriptions (Zapier/Make/n8n) and the delivery log. */

const SOURCE: Record<string, string> = { zapier: 'Zapier', make: 'Make', n8n: 'n8n', api: 'API' };
const HOOK_STATUS: Record<string, [string, 'green' | 'gray' | 'red']> = { active: ['aktiv', 'green'], paused: ['pausiert', 'gray'], disabled: ['deaktiviert', 'red'] };
const DELIVERY: Record<string, [string, 'green' | 'yellow' | 'red' | 'gray' | 'blue']> = {
  success: ['zugestellt', 'green'],
  retrying: ['wird wiederholt', 'yellow'],
  pending: ['läuft', 'blue'],
  failed: ['fehlgeschlagen', 'red'],
  gone: ['410 Gone', 'red'],
  cancelled: ['abgebrochen', 'gray'],
};

function NewHook({ triggers, onClose, onDone }: { triggers: any[]; onClose: () => void; onDone: () => void }) {
  const t = useT('settings');
  const [f, setF] = useState<any>({ event: 'contact.created', target_url: '', label: '', filters: {} });
  const trig = triggers.find((x) => x.key === f.event);
  const save = async () => {
    const r = await act(() => api.post('/api/hooks', { ...f, source: 'api' }), t('Abo angelegt'));
    if (r) onDone();
  };
  return (
    <Modal
      title={t('Neues Abo')}
      onClose={onClose}
      footer={
        <button className="btn" disabled={!f.target_url} onClick={save}>
          {t('Abonnieren')}
        </button>
      }
    >
      <p className="muted small" style={{ marginTop: 0 }}>
        {t('Zapier, Make und n8n legen ihre Abos selbst an. Hier kannst du eine eigene URL von Hand eintragen.')}
      </p>
      <Field label={t('Auslöser')}>
        <Select value={f.event} onChange={(v) => setF({ ...f, event: v, filters: {} })} options={triggers.map((x) => [x.key, x.label])} />
      </Field>
      {trig && <p className="muted small">{trig.description}</p>}
      <Field label={t('Ziel-URL')}>
        <Input value={f.target_url} onChange={(v) => setF({ ...f, target_url: v })} placeholder="https://…" autoFocus />
      </Field>
      <MoreFields id="resthook-new" label={t('Filter und Bezeichnung')}>
        {(trig?.filters ?? []).map((flt: any) => (
          <Field key={flt.key} label={flt.label}>
            <Input value={f.filters[flt.key] ?? ''} onChange={(v) => setF({ ...f, filters: { ...f.filters, [flt.key]: v } })} />
          </Field>
        ))}
        <Field label={t('Bezeichnung (optional)')}>
          <Input value={f.label} onChange={(v) => setF({ ...f, label: v })} />
        </Field>
      </MoreFields>
    </Modal>
  );
}

function DeliveryDetail({ id, onClose, onChange }: { id: string; onClose: () => void; onChange: () => void }) {
  const t = useT('settings');
  const d = useLoad(() => api.get(`/api/hooks/deliveries/${id}`), [id]);
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    setBusy(true);
    const r = await act(() => api.post(`/api/hooks/deliveries/${id}/retry`, {}), t('Erneut gesendet'));
    setBusy(false);
    if (r) (d.setData(r), onChange());
  };
  const x = d.data;
  return (
    <Modal
      title={t('Zustellung')}
      wide
      onClose={onClose}
      footer={
        x && x.status !== 'pending' ? (
          <button className="btn" disabled={busy} onClick={retry}>
            <Icon name="refresh" /> {t('Erneut senden')}
          </button>
        ) : undefined
      }
    >
      {!x ? (
        <Spinner />
      ) : (
        <>
          <div className="hook-facts">
            <div>
              <span className="muted small">{t('Status')}</span>
              <Badge tone={DELIVERY[x.status]?.[1] ?? 'gray'}>{DELIVERY[x.status] ? t(DELIVERY[x.status][0]) : x.status}</Badge>
            </div>
            <div>
              <span className="muted small">{t('Auslöser')}</span>
              <code>{x.event}</code>
            </div>
            <div>
              <span className="muted small">{t('Versuche')}</span>
              {x.attempts}
            </div>
            <div>
              <span className="muted small">{t('HTTP')}</span>
              {x.response_status ?? '–'}
            </div>
            <div>
              <span className="muted small">{t('Dauer')}</span>
              {x.duration_ms != null ? t('{ms} ms', { ms: x.duration_ms }) : '–'}
            </div>
            <div>
              <span className="muted small">{t('Nächster Versuch')}</span>
              {x.next_attempt_at ? dt(x.next_attempt_at) : '–'}
            </div>
          </div>
          <p className="small mono hook-url">{x.target_url}</p>
          {x.error && <p className="hook-error">{x.error}</p>}
          <h3 className="integ-h">{t('Nutzdaten (Payload)')}</h3>
          <pre className="hook-pre">{JSON.stringify(x.payload, null, 2)}</pre>
          {x.response_body ? (
            <>
              <h3 className="integ-h">{t('Antwort')}</h3>
              <pre className="hook-pre">{x.response_body}</pre>
            </>
          ) : null}
        </>
      )}
    </Modal>
  );
}

export function RestHooksPanel() {
  const t = useT('settings');
  const triggers = useLoad(() => api.get<any[]>('/api/hooks/triggers'), []);
  const hooks = useLoad(() => api.get<any[]>('/api/hooks'), []);
  const [status, setStatus] = useState('');
  const [limit, setLimit] = useState(25);
  const log = useLoad(() => api.get<any>(`/api/hooks/deliveries?limit=${limit}${status ? `&status=${status}` : ''}`), [status, limit]);
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState('');
  useEffect(() => {
    // Keep the log fresh while retries are pending.
    if (!log.data?.deliveries?.some((d: any) => d.status === 'retrying' || d.status === 'pending')) return;
    const timer = setInterval(() => void log.reload(), 15_000);
    return () => clearInterval(timer);
  }, [log.data]);
  const reloadAll = () => (hooks.reload(), log.reload());
  const counts = log.data?.counts_7d ?? {};
  return (
    <div className="rest-hooks">
      <div className="card" data-tour="rest-hooks">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>{t('REST-Hooks: Zapier, Make & n8n')}</h2>
          <div className="row" style={{ gap: 6 }}>
            <a className="btn small secondary" data-tour="rest-hooks-docs" href="/api/docs.html" target="_blank" rel="noopener">
              {t('API-Referenz')} <Icon name="external" size={13} />
            </a>
            <button className="btn small" onClick={() => setAdding(true)} disabled={!triggers.data}>
              {t('+ Abo')}
            </button>
          </div>
        </div>
        <p className="muted small">
          {t('Sofort-Auslöser für Automatisierungs-Tools: POST /api/hooks abonniert, DELETE /api/hooks/:id bestellt ab. Jede Zustellung trägt x-pghl-signature, Fehler werden bis zu 6× wiederholt.')}
        </p>
        {!hooks.data ? (
          <Spinner />
        ) : hooks.data.length ? (
          <div className="table-wrap">
            <table className="t hook-table">
              <thead>
                <tr>
                  <th>{t('Auslöser')}</th>
                  <th>{t('Ziel')}</th>
                  <th>{t('Status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {hooks.data.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <strong>{h.trigger_label}</strong>
                      {h.label && <div className="small">{h.label}</div>}
                      {Object.keys(h.filters ?? {}).length > 0 && (
                        <div className="muted small">
                          {Object.entries(h.filters)
                            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                            .join(' · ')}
                        </div>
                      )}
                    </td>
                    <td>
                      <Badge tone="purple">{SOURCE[h.source] ?? h.source}</Badge> <span className="mono small hook-url">{h.target_url}</span>
                    </td>
                    <td>
                      <Badge tone={HOOK_STATUS[h.status]?.[1] ?? 'gray'}>{HOOK_STATUS[h.status] ? t(HOOK_STATUS[h.status][0]) : h.status}</Badge>
                      <div className="muted small">{h.disabled_reason || h.last_status || t('noch nichts gesendet')}</div>
                    </td>
                    <td className="hook-btns">
                      <button className="btn small secondary" onClick={() => act(() => api.post(`/api/hooks/${h.id}/test`, {}), t('Beispiel gesendet')).then(reloadAll)}>
                        {t('Testen')}
                      </button>
                      {h.status === 'active' ? (
                        <button className="btn small ghost" onClick={() => act(() => api.patch(`/api/hooks/${h.id}`, { status: 'paused' })).then(reloadAll)}>
                          {t('Pausieren')}
                        </button>
                      ) : (
                        <button className="btn small ghost" onClick={() => act(() => api.patch(`/api/hooks/${h.id}`, { status: 'active' }), t('Wieder aktiv')).then(reloadAll)}>
                          {t('Aktivieren')}
                        </button>
                      )}
                      <button className="btn small ghost" aria-label={t('Abo löschen')} onClick={() => confirmAsk(t('Abo löschen? Das Tool bekommt dann keine Ereignisse mehr.')) && act(() => api.del(`/api/hooks/${h.id}`)).then(reloadAll)}>
                        <Icon name="trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{t('Noch keine Abos. Verbinde Zapier, Make oder n8n mit einem API-Schlüssel – die Abos erscheinen dann hier.')}</Empty>
        )}
      </div>

      <div className="card" data-tour="rest-hooks-log">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>{t('Zustell-Protokoll')}</h2>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <span className="muted small hook-counts">
              {t('7 Tage: {success} zugestellt · {retrying} in Wiederholung · {failed} fehlgeschlagen', { success: counts.success ?? 0, retrying: counts.retrying ?? 0, failed: (counts.failed ?? 0) + (counts.gone ?? 0) })}
            </span>
            <div style={{ width: 180 }}>
              <Select value={status} onChange={setStatus} placeholder={t('Alle Status')} options={Object.entries(DELIVERY).map(([k, [l]]) => [k, t(l)])} />
            </div>
            <button className="btn small secondary" onClick={() => log.reload()} aria-label={t('Aktualisieren')}>
              <Icon name="refresh" />
            </button>
          </div>
        </div>
        {!log.data ? (
          <Spinner />
        ) : log.data.deliveries.length ? (
          <>
            <div className="table-wrap">
              <table className="t hook-table">
                <thead>
                  <tr>
                    <th>{t('Zeit')}</th>
                    <th>{t('Auslöser')}</th>
                    <th>{t('Ziel')}</th>
                    <th>{t('Status')}</th>
                    <th className="num">{t('Versuche')}</th>
                    <th className="num">{t('HTTP')}</th>
                  </tr>
                </thead>
                <tbody>
                  {log.data.deliveries.map((d: any) => (
                    <tr key={d.id} className="click" {...pressable(() => setDetail(d.id))}>
                      <td className="nowrap">{dt(d.created_at)}</td>
                      <td>
                        <code>{d.event}</code>
                      </td>
                      <td className="mono small hook-url">{d.target_url}</td>
                      <td>
                        <Badge tone={DELIVERY[d.status]?.[1] ?? 'gray'}>{DELIVERY[d.status] ? t(DELIVERY[d.status][0]) : d.status}</Badge>
                        {d.error && <div className="muted small">{d.error}</div>}
                      </td>
                      <td className="num">{d.attempts}</td>
                      <td className="num">{d.response_status ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {log.data.total > log.data.deliveries.length && (
              <p style={{ textAlign: 'center' }}>
                <button className="btn small secondary" onClick={() => setLimit(Math.min(200, limit + 50))}>
                  {t('Mehr laden ({count} von {total})', { count: log.data.deliveries.length, total: log.data.total })}
                </button>
              </p>
            )}
          </>
        ) : (
          <Empty>{status ? t('Noch keine Zustellungen mit diesem Status.') : t('Noch keine Zustellungen.')}</Empty>
        )}
      </div>
      {adding && triggers.data && <NewHook triggers={triggers.data} onClose={() => setAdding(false)} onDone={() => (setAdding(false), reloadAll())} />}
      {detail && <DeliveryDetail id={detail} onClose={() => setDetail('')} onChange={reloadAll} />}
      <ApiQuickRef />
    </div>
  );
}

function ApiQuickRef() {
  const t = useT('settings');
  const origin = location.origin;
  return (
    <div className="card" data-tour="api-quickref">
      <h2>{t('Schnellstart')}</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        {t('Fertige Verbindungen liegen im Repo unter integrations/zapier, integrations/make und integrations/n8n. OpenAPI für Postman, Insomnia oder n8n:')}
      </p>
      <CodeBox text={`${origin}/api/openapi.json`} />
      {/* i18n-ignore */}
      <pre className="hook-pre" style={{ marginTop: 10 }}>{`curl -X POST ${origin}/api/hooks \\
  -H "Authorization: Bearer pghl_…" -H 'content-type: application/json' \\
  -d '{"target_url":"https://example.com/hook","event":"opportunity.won"}'`}</pre>
    </div>
  );
}
