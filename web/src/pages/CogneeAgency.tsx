import { useEffect, useState } from 'react';
import { api, dt } from '../api';
import { Icon } from '../icons';
import { useSession } from '../session';
import { Badge, Check, Field, Input, Modal, Select, Spinner, act, confirmAsk, toast, useLoad } from '../ui';
import { Note, PostureBadge, PurgeDialog, type Json } from './CogneeKit';
import { tr, useT } from '../i18n';
import './cognee.css';

/**
 * Agentur → Integrationen → Einrichtung → „Wissensgedächtnis (Cognee)“ (docs/cognee.md): the address and the login of the
 * self-hosted Cognee server, a test of every step, and all sub-accounts at a glance (what they share, item counts, last sync,
 * errors) with a login of their own per sub-account for stronger separation.
 */

export function CogneeAgencySetup() {
  const t = useT('cognee');
  const s = useLoad(() => api.get<Json>('/api/agency/cognee'), []);
  const [f, setF] = useState<Json | null>(null);
  const [test, setTest] = useState<Json | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const v = s.data;
    if (v && !f) setF({ base_url: v.base_url ?? '', auth_mode: v.auth_mode ?? 'password', email: v.email ?? '', secret: '', allow_private: v.configured ? !!v.allow_private : false, locations_may_enable: v.configured ? v.locations_may_enable !== false : true, allow_open_server: !!v.allow_open_server });
  }, [s.data, f]);
  if (!s.data || !f) return <Spinner />;
  const v = s.data;
  const set = (p: Json) => setF({ ...f, ...p });
  const password = f.auth_mode === 'password';
  const body = () => ({ base_url: f.base_url, auth_mode: f.auth_mode, ...(password ? { email: f.email, ...(f.secret ? { password: f.secret } : {}) } : f.secret ? { api_key: f.secret } : {}), allow_private: f.allow_private, locations_may_enable: f.locations_may_enable, allow_open_server: f.allow_open_server });
  const runTest = async () => setTest((await act(() => api.post<Json>('/api/agency/cognee/test', {}))) ?? null);
  const save = async () => {
    setBusy(true);
    const r = await act(() => api.put<Json>('/api/agency/cognee', body()), tr('cognee')('Gespeichert'));
    setBusy(false);
    if (!r) return;
    set({ secret: '' });
    await s.reload();
    await runTest();
  };
  const hostLooksInternal = /^https?:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|[a-z0-9-]+(:\d+)?(\/|$))/i.test(f.base_url);

  return (
    <div className="card" style={{ flex: '1 1 420px' }} data-tour="cognee-agency">
      <h2>{t('Wissensgedächtnis (Cognee)')}</h2>
      <p className="muted small">
        {t('Verbindet HyperLevel mit einem selbst gehosteten')} <a href="https://github.com/topoteretes/cognee" target="_blank" rel="noopener">{t('Cognee')}</a>{t('-Server (Wissensgraph, Apache-2.0) über dessen REST-Schnittstelle. Jeder Sub-Account entscheidet selbst, ob und welche Daten er teilt – Standard: aus. Jeder Sub-Account bekommt eigene Datasets (')}<code>{t('gh_<ID>_<Typ>')}</code>{t('), andere Datasets werden nie gelesen oder beschrieben. Einrichtung, Server-Einstellungen und was gesendet wird:')} <code>docs/cognee.md</code>
      </p>
      <Note level="info">{t('Auf dem Cognee-Server muss')} <code>{t('ENABLE_BACKEND_ACCESS_CONTROL=true')}</code> {t('gesetzt sein, und HyperLevel sollte einen eigenen Cognee-Nutzer bekommen – so liegt jedes Dataset getrennt.')}</Note>
      {v.configured && v.posture?.state === 'open' && (
        <Note level="critical">
          {t('Der Cognee-Server antwortet ohne Anmeldung – die Zugriffskontrolle ist aus. Es wird nichts übertragen, bis')} <code>{t('ENABLE_BACKEND_ACCESS_CONTROL=true')}</code> {t('gesetzt ist.')} {v.posture.reason}
        </Note>
      )}
      <Field label={t('Adresse des Cognee-Servers')} hint={t('z. B. https://cognee.example.com – oder http://cognee:8000 im selben Docker-Netz. Ohne http:// nur im eigenen Netz.')}>
        <Input value={f.base_url} onChange={(x) => set({ base_url: x })} placeholder="https://cognee.example.com" autoComplete="off" />
      </Field>
      <Field label={t('Anmeldung')}>
        <Select value={f.auth_mode} onChange={(x) => set({ auth_mode: x, secret: '' })} options={[['password', t('E-Mail und Passwort (Cognee-Nutzer für HyperLevel)')], ['api_key', t('API-Schlüssel (Cognee → /api/v1/auth/api-keys)')]]} />
      </Field>
      {password && (
        <Field label={t('E-Mail des Cognee-Nutzers')}>
          <Input type="email" value={f.email} onChange={(x) => set({ email: x })} placeholder="gohigh@example.com" autoComplete="off" />
        </Field>
      )}
      <Field label={password ? t('Passwort') : t('API-Schlüssel')} hint={t('Wird verschlüsselt gespeichert und nie wieder angezeigt. Leer lassen = bisherigen Wert behalten.')}>
        <Input type="password" value={f.secret} onChange={(x) => set({ secret: x })} autoComplete="new-password" placeholder={v.configured && v.secret_set && v.auth_mode === f.auth_mode ? `•••••••• ${v.hint}` : ''} />
      </Field>
      <Check checked={f.allow_private} onChange={(x) => set({ allow_private: x })} label={`${t('Internes Netz erlauben (Cognee läuft im selben Docker-Netz oder LAN)')}${hostLooksInternal && !f.allow_private ? t(' – vermutlich nötig') : ''}`} />
      <Check checked={f.locations_may_enable} onChange={(x) => set({ locations_may_enable: x })} label={t('Sub-Account-Admins dürfen das Gedächtnis selbst einschalten (aus: nur die Agentur)')} />
      <button type="button" className="btn small ghost" onClick={() => setMore(!more)}>
        {more ? '▾' : '▸'} {t('Weitere Einstellungen')}
      </button>
      {more && <Check checked={f.allow_open_server} onChange={(x) => set({ allow_open_server: x })} label={t('Auch an einen Server ohne Zugriffskontrolle senden (nicht empfohlen – Sub-Accounts liegen dort nicht getrennt)')} />}
      <div className="row" style={{ gap: 6, marginTop: 8 }}>
        <button className="btn" disabled={busy || !f.base_url || (password && !f.email) || (!v.configured && !f.secret)} onClick={save} data-tour="cognee-save">
          {t('Speichern & testen')}
        </button>
        {v.configured && (
          <button className="btn secondary" onClick={runTest} data-tour="cognee-test">
            {t('Verbindung testen')}
          </button>
        )}
        {v.configured && (
          <button
            className="btn ghost"
            onClick={async () => {
              if (!confirmAsk(t('Verbindung zu Cognee entfernen? Das geht nur, wenn kein Sub-Account mehr Daten teilt oder in Cognee liegen hat.'))) return;
              try {
                await api.del('/api/agency/cognee');
                toast(tr('cognee')('Entfernt'));
                setF(null);
                setTest(null);
                void s.reload();
              } catch (e) {
                if (confirmAsk(`${(e as Error).message}\n\n${t('Trotzdem entfernen? Die Daten bleiben dann auf dem Server und lassen sich über HyperLevel nicht mehr löschen.')}`)) {
                  await act(() => api.del('/api/agency/cognee?force=1'), tr('cognee')('Entfernt'));
                  setF(null);
                  setTest(null);
                  void s.reload();
                }
              }
            }}
          >
            {t('Entfernen')}
          </button>
        )}
      </div>
      {test && <TestResult r={test} />}
      {v.configured && !test && v.last_test && (
        <p className="muted small">
          {t('Letzter Test {date}:', { date: dt(v.last_test.at) })} {v.last_test.ok ? <Badge tone="green">{t('ok')}</Badge> : <Badge tone="red">{t('fehlgeschlagen')}</Badge>} <PostureBadge state={v.posture?.state} />
        </p>
      )}
      {v.configured && <CogneeOverview />}
    </div>
  );
}

function TestResult({ r }: { r: Json }) {
  const t = useT('cognee');
  return (
    <div data-tour="cognee-test-result">
      <ul className="cg-steps">
        {r.steps.map((st: Json) => (
          <li key={st.key}>
            <Badge tone={st.ok ? (st.warn ? 'yellow' : 'green') : 'red'}>{st.ok ? (st.warn ? t('unklar') : t('ok')) : t('Fehler')}</Badge>
            <span className="cg-step-label">{st.label}</span>
            <span className="muted small">{st.detail}</span>
          </li>
        ))}
      </ul>
      {r.ok && <Note level="ok">{t('Verbunden{version}. Sub-Accounts können das Gedächtnis jetzt unter Einstellungen → Gedächtnis einschalten.', { version: r.version ? ` ${t('mit Cognee')} ${r.version}` : '' })}</Note>}
    </div>
  );
}

/** All sub-accounts: what is shared, counts, last sync, errors – and the agency's own switches. */
function CogneeOverview() {
  const t = useT('cognee');
  const o = useLoad(() => api.get<Json>('/api/agency/cognee/overview'), []);
  const [purge, setPurge] = useState<{ id: string; types: string[]; labels: Record<string, string> } | null>(null);
  const [account, setAccount] = useState<Json | null>(null);
  const session = useSession();
  if (!o.data) return <Spinner />;
  const rows: Json[] = o.data.locations;
  const active = rows.filter((r) => r.enabled).length;
  return (
    <div style={{ marginTop: 16 }} data-tour="cognee-overview">
      <h3 style={{ marginBottom: 4 }}>{t('Sub-Accounts im Überblick')}</h3>
      <p className="muted small">
        {t('{active} von {total} Sub-Accounts teilen Daten. Eingeschaltet wird in den Einstellungen des Sub-Accounts (Reiter „Gedächtnis“); hier siehst du den Stand und kannst ausschalten.', { active, total: rows.length })}
      </p>
      <div className="table-wrap">
        <table className="t cg-status">
          <thead>
            <tr>
              <th>{t('Sub-Account')}</th>
              <th>{t('Freigabe')}</th>
              <th>{t('Einträge')}</th>
              <th>{t('Letzter Abgleich')}</th>
              <th>{t('Zugang')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>
                  {r.enabled ? <Badge tone="green">{t('an')}</Badge> : <Badge>{t('aus')}</Badge>} {r.enabled && <span className="muted small">{t('{count} Datentyp/Datentypen', { count: r.types.length })}</span>}
                  {r.errors > 0 && (
                    <>
                      {' '}
                      <Badge tone="red">{t('{count} Fehler', { count: r.errors })}</Badge>
                    </>
                  )}
                </td>
                <td>
                  {r.items}
                  {r.pending_deletions > 0 && <span className="muted small"> · {t('{count} Löschung(en) offen', { count: r.pending_deletions })}</span>}
                </td>
                <td>{r.last_sync_at ? dt(r.last_sync_at) : '–'}</td>
                <td>
                  <button className="btn small ghost" onClick={() => setAccount(r)}>
                    {r.account === 'override' ? <Badge tone="blue">{t('eigener: {label}', { label: r.account_label })}</Badge> : t('Agentur-Zugang')}
                  </button>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {r.enabled && (
                    <button
                      className="btn small secondary"
                      onClick={async () => {
                        if (!confirmAsk(t('Teilen für „{name}“ ausschalten? Es wird nichts mehr übertragen; die vorhandenen Daten in Cognee kannst du danach löschen.', { name: r.name }))) return;
                        const res = await act(() => api.put<Json>(`/api/agency/cognee/locations/${r.id}/settings`, { enabled: false }), tr('cognee')('Ausgeschaltet'));
                        if (res) {
                          const labels = Object.fromEntries((res.settings.catalog as Json[]).map((c) => [c.key, c.label]));
                          if (res.offer_delete.length) setPurge({ id: r.id, types: res.offer_delete, labels });
                          void o.reload();
                        }
                      }}
                    >
                      {t('Ausschalten')}
                    </button>
                  )}
                  {!r.enabled && r.items > 0 && (
                    <button
                      className="btn small secondary"
                      onClick={() => setPurge({ id: r.id, types: Object.keys(r.by_type).filter((tp) => r.by_type[tp] > 0), labels: o.data!.labels })}
                    >
                      {t('Daten löschen …')}
                    </button>
                  )}{' '}
                  <button className="btn small ghost" onClick={() => session.switchLocation(r.id, 'settings/memory')} title={t('Einstellungen → Gedächtnis dieses Sub-Accounts')}>
                    <Icon name="settings" size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {purge && (
        <PurgeDialog
          types={purge.types}
          labels={purge.labels}
          url={`/api/agency/cognee/locations/${purge.id}/purge`}
          onClose={() => {
            setPurge(null);
            void o.reload();
          }}
        />
      )}
      {account && (
        <AccountDialog
          row={account}
          onClose={() => {
            setAccount(null);
            void o.reload();
          }}
        />
      )}
    </div>
  );
}

/** A Cognee login of its own for one sub-account: even Cognee then keeps its data apart from the others. */
function AccountDialog({ row, onClose }: { row: Json; onClose: () => void }) {
  const t = useT('cognee');
  const [mode, setMode] = useState('password');
  const [email, setEmail] = useState('');
  const [secret, setSecret] = useState('');
  const [result, setResult] = useState<Json | null>(null);
  const own = row.account === 'override';
  return (
    <Modal
      title={t('Cognee-Zugang für {name}', { name: row.name })}
      onClose={onClose}
      footer={
        <>
          {own && (
            <button
              className="btn ghost danger-text"
              onClick={async () => {
                if (await act(() => api.del(`/api/agency/cognee/locations/${row.id}/account`), tr('cognee')('Zugang entfernt'))) onClose();
              }}
            >
              {t('Eigenen Zugang entfernen')}
            </button>
          )}
          <button
            className="btn"
            disabled={!secret || (mode === 'password' && !email)}
            onClick={async () => {
              if (await act(() => api.put(`/api/agency/cognee/locations/${row.id}/account`, mode === 'password' ? { auth_mode: 'password', email, password: secret } : { auth_mode: 'api_key', api_key: secret }), tr('cognee')('Gespeichert'))) {
                setSecret('');
                setResult((await act(() => api.post<Json>(`/api/agency/cognee/locations/${row.id}/test`, {}))) ?? null);
              }
            }}
          >
            {t('Speichern & testen')}
          </button>
        </>
      }
    >
      <p className="muted small">
        {t('Standard ist der Zugang der Agentur (ein Cognee-Nutzer für alle). Mit einem eigenen Cognee-Nutzer für diesen Sub-Account gehören seine Datasets diesem Nutzer – die Trennung gilt dann auch in Cognee selbst. Wechseln geht nur, solange in Cognee noch keine Daten dieses Sub-Accounts liegen.')}
      </p>
      <p>
        {t('Jetzt:')} {own ? <Badge tone="blue">{t('eigener Zugang ({label})', { label: row.account_label })}</Badge> : <Badge>{t('Zugang der Agentur')}</Badge>}
      </p>
      <Field label={t('Anmeldung')}>
        <Select value={mode} onChange={setMode} options={[['password', t('E-Mail und Passwort')], ['api_key', t('API-Schlüssel')]]} />
      </Field>
      {mode === 'password' && (
        <Field label={t('E-Mail des Cognee-Nutzers')}>
          <Input type="email" value={email} onChange={setEmail} autoComplete="off" />
        </Field>
      )}
      <Field label={mode === 'password' ? t('Passwort') : t('API-Schlüssel')}>
        <Input type="password" value={secret} onChange={setSecret} autoComplete="new-password" />
      </Field>
      {result && <TestResult r={result} />}
    </Modal>
  );
}
