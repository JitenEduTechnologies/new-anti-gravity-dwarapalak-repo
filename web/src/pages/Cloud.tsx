import { useEffect, useState, type ReactNode } from 'react';
import { api, d, money } from '../api';
import { Icon } from '../icons';
import { useSession } from '../session';
import { Badge, Empty, Field, Modal, Select, Spinner, Tabs, Textarea, act, navigate, toast, useLoad } from '../ui';
import { CloudClients, CloudTeam } from './CloudTeam';
import { MeterBar, PHASE_TONE, REASONS, type CloudMe, type Tenant } from './CloudKit';
import { CloudData } from './CloudData';
import { tr, useT } from '../i18n';

/**
 * Einstellungen → Cloud-Konto: the customer's side of the hosted service. Overview with the fair-use meters and the
 * start checklist, plan and invoices, team, client accounts and white-label (Agentur), data export, support access and
 * deleting the account. Everything is for the signed-in customer's own tenant (the server never takes a tenant id).
 */

const METERS: [keyof Tenant['meters'], string, string][] = [
  ['emails', 'E-Mails diesen Monat', ''],
  ['sms', 'SMS diesen Monat', ''],
  ['ai', 'KI-Aufrufe diesen Monat', ''],
  ['storage_mb', 'Medien-Speicher', ' MB'],
];

function Checklist() {
  const t = useT('cloud');
  const o = useLoad(() => api.get<{ items: { key: string; label: string; hint: string; to: string; done: boolean }[]; done: number; total: number }>('/api/cloud/onboarding'), []);
  const x = o.data;
  if (!x || x.done === x.total) return null;
  return (
    <div className="card cloud-check" data-tour="cloud-checklist">
      <h3 style={{ marginTop: 0 }}>
        {t('Los geht’s')} <span className="muted small">{t('{done} von {total} erledigt', { done: x.done, total: x.total })}</span>
      </h3>
      <ul>
        {x.items.map((i) => (
          <li key={i.key} className={i.done ? 'done' : ''}>
            <Icon name={i.done ? 'ok' : 'pending'} size={18} />
            <div className="grow">
              <strong>{i.label}</strong>
              <div className="muted small">{i.hint}</div>
            </div>
            {!i.done && (
              <button className="btn small secondary" onClick={() => navigate(i.to)}>
                {t('Öffnen')}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Overview({ me, owner, onTab }: { me: CloudMe; owner: boolean; onTab: (tabKey: string) => void }) {
  const t = useT('cloud');
  const tenant = me.tenant;
  const every = tenant.plan.interval === 'year' ? t('Jahr') : t('Monat');
  return (
    <>
      <div className="card" data-tour="cloud-plan">
        <div className="saas-plan-head">
          <div>
            <div className="muted small">{t('Dein Tarif')}</div>
            <h2>
              {tenant.plan.name} <Badge tone={PHASE_TONE[tenant.phase] ?? 'gray'}>{t(tenant.phase_label)}</Badge> {tenant.cancel_at_period_end && <Badge tone="yellow">{t('gekündigt')}</Badge>}
            </h2>
            <p className="muted">{tenant.plan.key === 'solo' ? t('Eine Person, alle Funktionen.') : tenant.plan.key === 'team' ? t('Unbegrenzt Nutzer, alle Funktionen.') : t('Unbegrenzt Nutzer und Kunden-Accounts, White-Label inklusive.')}</p>
          </div>
          <div className="saas-price">
            {tenant.comped ? t('geschenkt') : money(tenant.plan.price_cents, tenant.plan.currency)}
            {!tenant.comped && <span className="muted">{t(' / {every}', { every })}</span>}
          </div>
        </div>
        <ul className="saas-facts">
          {tenant.phase === 'trial' && tenant.trial_end && <li>{t('Testphase bis {date}{extra}', { date: d(tenant.trial_end), extra: tenant.billing === 'manual' ? t(' – danach schreibgeschützt, solange kein Tarif gewählt ist') : '' })}</li>}
          {tenant.current_period_end && tenant.billing === 'stripe' && <li>{tenant.cancel_at_period_end ? t('Endet am {date}', { date: d(tenant.current_period_end) }) : t('Nächste Verlängerung: {date}', { date: d(tenant.current_period_end) })}</li>}
          {tenant.comped && tenant.comp_until && <li>{t('Geschenkt bis {date}', { date: d(tenant.comp_until) })}</li>}
          {tenant.phase === 'past_due' && tenant.grace_until && <li>{t('Bitte Zahlung bis {date} erledigen – danach wird das Konto schreibgeschützt.', { date: d(tenant.grace_until) })}</li>}
          {tenant.read_only && <li>{t('Das Konto ist schreibgeschützt: alles bleibt les- und exportierbar.')}</li>}
          {tenant.deletion && <li>{t('Löschung geplant am {date}.', { date: d(tenant.deletion.at) })}</li>}
          <li>{tenant.entitlements.users === null ? t('Unbegrenzt Nutzer') : t('{count} von {max} Nutzer', { count: tenant.counts.users, max: tenant.entitlements.users })}{tenant.entitlements.client_accounts ? t(' · {count} Kunden-Accounts', { count: tenant.counts.clients }) : ''}</li>
          {tenant.subdomain && <li>{t('Deine Adresse:')} <span className="mono">{tenant.subdomain}</span></li>}
        </ul>
        {owner && (
          <div className="actions">
            <button className="btn secondary" onClick={() => onTab('plan')}>
              <Icon name="card" /> {t('Tarif & Rechnungen')}
            </button>
          </div>
        )}
      </div>
      <Checklist />
      <div className="card" data-tour="cloud-meters">
        <h3 style={{ marginTop: 0 }}>{t('Fair Use – dein Verbrauch')}</h3>
        <p className="muted small" style={{ marginTop: 0 }}>{t('Alle Funktionen sind in jedem Tarif frei. Nur teure Ressourcen haben Grenzen, pro Sub-Account und Monat.')}</p>
        <div className="saas-meters">
          {METERS.map(([k, l, u]) => (
            <MeterBar key={k} label={t(l)} m={tenant.meters[k]} unit={u} />
          ))}
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>{t('Mit eigenem KI-Schlüssel (Einstellungen → KI-Anbieter) rechnest du KI direkt mit deinem Anbieter ab.')}</p>
      </div>
      {me.support_email && (
        <p className="muted small">
          {t('Fragen zu Tarif oder Rechnung?')} <a href={`mailto:${me.support_email}`}>{me.support_email}</a>
          {me.status_url && (
            <>
              {' '}
              · <a href={me.status_url} target="_blank" rel="noopener noreferrer">{t('Status')}</a>
            </>
          )}
        </p>
      )}
    </>
  );
}

// --- plan & invoices --------------------------------------------------------------------------------

interface Card {
  key: 'solo' | 'team' | 'agency';
  name: string;
  tagline: string;
  price_month_cents: number;
  price_year_cents: number;
  users: number | null;
  highlights: string[];
}

function CancelModal({ t: tenant, onClose, onDone }: { t: Tenant; onClose: () => void; onDone: () => void }) {
  const t = useT('cloud');
  const [reason, setReason] = useState('price');
  const [comment, setComment] = useState('');
  return (
    <Modal
      title={t('Abo kündigen')}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            {t('Abbrechen')}
          </button>
          <button className="btn danger" onClick={async () => (await act(() => api.post('/api/cloud/cancel', { reason, comment }), tr('cloud')('Gekündigt'))) && (onDone(), onClose())}>
            {t('Zum Ende des Zeitraums kündigen')}
          </button>
        </>
      }
    >
      <p>
        {t('Dein Abo „{name}“ läuft bis {date} weiter, danach ist das Konto schreibgeschützt. Du kannst die Kündigung bis dahin zurücknehmen und jederzeit alle Daten exportieren.', { name: tenant.plan.name, date: d(tenant.current_period_end ?? tenant.trial_end) || t('zum Ende des Zeitraums') })}
      </p>
      <Field label={t('Warum kündigst du? (hilft uns, besser zu werden)')}>
        <Select value={reason} onChange={setReason} options={REASONS.map(([k, l]) => [k, t(l)] as [string, string])} />
      </Field>
      <Field label={t('Möchtest du etwas ergänzen? (optional)')}>
        <Textarea value={comment} onChange={setComment} maxLength={1000} />
      </Field>
    </Modal>
  );
}

function PlanTab({ me, reload }: { me: CloudMe; reload: () => void }) {
  const t = useT('cloud');
  const tenant = me.tenant;
  const plans = useLoad(() => api.get<{ plans: Card[]; yearly_discount_percent: number; price_note: string }>('/api/cloud/plans'), []);
  const invoices = useLoad(() => api.get<{ items: { id: string; number: string; status: string; amount_cents: number; currency: string; created: string; hosted_url: string; pdf_url: string }[]; portal: boolean }>('/api/cloud/invoices'), []);
  const [interval, setInterval] = useState<'month' | 'year'>(tenant.plan.interval);
  const [cancel, setCancel] = useState(false);
  if (!plans.data) return <Spinner />;
  const note = plans.data.price_note === 'net' ? t('zzgl. USt.') : plans.data.price_note === 'gross' ? t('inkl. USt.') : '';
  const choose = async (c: Card) => {
    if (tenant.billing === 'stripe' && !tenant.read_only) {
      if (c.key === tenant.plan.key && interval === tenant.plan.interval) return;
      if (!window.confirm(t('Auf „{name}“ ({interval}) wechseln? Der Preis wird anteilig verrechnet.', { name: c.name, interval: interval === 'year' ? t('jährlich') : t('monatlich') }))) return;
      if (await act(() => api.post('/api/cloud/plan', { plan: c.key, interval }), tr('cloud')('Tarif geändert'))) reload();
    } else if (tenant.billing === 'manual' && !tenant.read_only && tenant.status !== 'canceled' && tenant.stripe === false && tenant.phase !== 'comped') {
      // Trial without payment data: switch the plan first, paying is the next step.
      if (c.key !== tenant.plan.key && (await act(() => api.post('/api/cloud/plan', { plan: c.key, interval }), tr('cloud')('Tarif geändert')))) reload();
    } else if (tenant.phase === 'comped') {
      toast(tr('cloud')('Dein Tarif ist geschenkt – Änderungen macht der Anbieter.'));
    }
  };
  const subscribe = async (c: Card) => {
    const r = await act(() => api.post<{ url: string }>('/api/cloud/subscribe', { plan: c.key, interval }));
    if (r?.url) window.location.href = r.url;
  };
  const needsSubscribe = (tenant.billing === 'manual' && tenant.phase !== 'comped') || (tenant.phase === 'canceled' && !tenant.deletion);
  return (
    <>
      <div className="cloud-interval" role="group" aria-label={t('Abrechnung')}>
        <button className={interval === 'month' ? 'on' : ''} onClick={() => setInterval('month')}>
          {t('Monatlich')}
        </button>
        <button className={interval === 'year' ? 'on' : ''} onClick={() => setInterval('year')}>
          {t('Jährlich')} {plans.data.yearly_discount_percent > 0 && <Badge tone="green">-{plans.data.yearly_discount_percent} %</Badge>}
        </button>
      </div>
      <div className="cloud-plans" data-tour="cloud-plans">
        {plans.data.plans.map((c) => {
          const current = c.key === tenant.plan.key;
          const price = interval === 'year' ? Math.round(c.price_year_cents / 12) : c.price_month_cents;
          return (
            <div key={c.key} className={`card cloud-plan${current ? ' current' : ''}`}>
              <h3>
                {c.name} {current && <Badge tone="blue">{t('aktuell')}</Badge>}
              </h3>
              <p className="muted small">{c.tagline}</p>
              <div className="cloud-price">
                {money(price)}
                <span className="muted">{t(' / Monat {note}', { note })}</span>
              </div>
              {interval === 'year' && <div className="muted small">{t('{price} pro Jahr', { price: money(c.price_year_cents) })}</div>}
              <ul>
                {c.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
              {needsSubscribe ? (
                <button className="btn" onClick={() => subscribe(c)}>
                  {current ? t('Jetzt abonnieren') : t('{name} abonnieren', { name: c.name })}
                </button>
              ) : (
                <button className={`btn${current && interval === tenant.plan.interval ? ' secondary' : ''}`} disabled={(current && interval === tenant.plan.interval) || tenant.read_only} onClick={() => choose(c)}>
                  {current && interval === tenant.plan.interval ? t('Dein Tarif') : current ? t('Intervall ändern') : t('Wechseln')}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="actions" style={{ margin: '14px 0' }}>
        {tenant.stripe && (
          <button
            className="btn secondary"
            onClick={async () => {
              const r = await act(() => api.post<{ url: string }>('/api/cloud/portal', {}));
              if (r?.url) window.location.href = r.url;
            }}
          >
            <Icon name="card" /> {t('Zahlungsmethode & Rechnungsadresse')}
          </button>
        )}
        {tenant.cancel_at_period_end ? (
          <button className="btn secondary" onClick={async () => (await act(() => api.post('/api/cloud/cancel', { undo: true }), tr('cloud')('Abo läuft weiter'))) && reload()}>
            {t('Kündigung zurücknehmen')}
          </button>
        ) : (
          tenant.status !== 'canceled' && (
            <button className="btn ghost" onClick={() => setCancel(true)}>
              {t('Abo kündigen')}
            </button>
          )
        )}
      </div>
      <div className="card" data-tour="cloud-invoices">
        <h3 style={{ marginTop: 0 }}>{t('Rechnungen')}</h3>
        {invoices.data?.items.length ? (
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>{t('Nummer')}</th>
                  <th>{t('Datum')}</th>
                  <th>{t('Betrag')}</th>
                  <th>{t('Status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invoices.data.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.number || '–'}</td>
                    <td>{d(i.created)}</td>
                    <td>{money(i.amount_cents, i.currency)}</td>
                    <td>{i.status === 'paid' ? <Badge tone="green">{t('bezahlt')}</Badge> : i.status === 'open' ? <Badge tone="yellow">{t('offen')}</Badge> : <Badge>{i.status}</Badge>}</td>
                    <td className="nowrap">
                      {i.hosted_url && (
                        <a href={i.hosted_url} target="_blank" rel="noopener noreferrer">
                          {t('Ansehen')}
                        </a>
                      )}{' '}
                      {i.pdf_url && (
                        <a href={i.pdf_url} target="_blank" rel="noopener noreferrer">
                          {t('PDF')}
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{tenant.stripe ? t('Noch keine Rechnung – die erste kommt nach der Testphase.') : t('Sobald du ein Abo abschließt, erscheinen deine Rechnungen hier.')}</Empty>
        )}
      </div>
      {cancel && <CancelModal t={tenant} onClose={() => setCancel(false)} onDone={reload} />}
    </>
  );
}

// --- the page -----------------------------------------------------------------------------------------

/** `fallback`: shown to sub-accounts that are no cloud customer (e.g. the operator's own, or a SaaS customer of an agency). */
export function CloudAccount({ fallback }: { fallback?: ReactNode }) {
  const t = useT('cloud');
  const session = useSession();
  const me = useLoad(() => api.get<CloudMe>('/api/cloud/me'), [session.locationId]);
  const q = new URLSearchParams(location.search).get('tab');
  const [tab, setTab] = useState(q ?? 'overview');
  const m = me.data;
  // After paying at Stripe the customer comes back with ?abo=ok&session_id=…: take the subscription over at once.
  useEffect(() => {
    const sid = new URLSearchParams(location.search).get('session_id');
    if (!sid || !m || m.role !== 'owner') return;
    void api.post('/api/cloud/subscribe/confirm', { session_id: sid }).then(() => {
      history.replaceState(null, '', location.pathname);
      void me.reload();
      void session.reload();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!m]);
  if (!m) return me.loading ? <Spinner /> : (fallback ?? <Empty>{t('Dieses Konto gehört zu keinem Cloud-Tarif.')}</Empty>);
  if (!m.customer) return <>{fallback ?? <Empty>{t('Dieses Konto gehört zu keinem Cloud-Tarif.')}</Empty>}</>;
  if (m.limited) return <Empty>{m.read_only ? t('Dieser Kunden-Account ist schreibgeschützt.') : t('Die Verwaltung deines Kunden-Accounts liegt bei deiner Agentur.')}</Empty>;
  const tenant = m.tenant;
  const owner = m.role === 'owner';
  const tabs: [string, string][] = [
    ['overview', t('Übersicht')],
    ...(owner ? ([['plan', t('Tarif & Rechnungen')]] as [string, string][]) : []),
    ['team', t('Team')],
    ...(tenant.entitlements.client_accounts ? ([['clients', t('Kunden & White-Label')]] as [string, string][]) : []),
    ...(owner ? ([['data', t('Daten & Konto')]] as [string, string][]) : []),
  ];
  const reload = () => {
    void me.reload();
    void session.reload();
  };
  const active = tabs.some(([k]) => k === tab) ? tab : 'overview';
  return (
    <div className="cloud" data-tour="cloud-account">
      {tenant.deletion && (
        <div className="saas-banner error" role="alert">
          <Icon name="lock" size={18} />
          <span className="grow">
            {t('Dein Konto wird am {date} gelöscht. {reason}', { date: d(tenant.deletion.at), reason: tenant.deletion.reason === 'self' ? t('Du hast die Löschung angefordert.') : t('Exportiere vorher deine Daten – oder schließe ein Abo ab.') })}
          </span>
          {owner && tenant.deletion.reason === 'self' && (
            <button className="btn small secondary" onClick={async () => (await act(() => api.post('/api/cloud/delete/undo', {}), tr('cloud')('Löschung zurückgenommen'))) && reload()}>
              {t('Löschung zurücknehmen')}
            </button>
          )}
          {owner && tenant.deletion.reason !== 'self' && (
            <button className="btn small secondary" onClick={() => setTab('data')}>
              {t('Daten exportieren')}
            </button>
          )}
        </div>
      )}
      {owner && !!m.legal.pending.length && (
        <div className="saas-banner info" role="status">
          <Icon name="shield" size={18} />
          <span className="grow">{t('Unsere Bedingungen wurden aktualisiert ({docs}). Bitte sieh sie dir an und bestätige.', { docs: m.legal.pending.map((p) => p.doc.toUpperCase()).join(', ') })}</span>
          <a href="/cloud/legal/agb" target="_blank" rel="noopener noreferrer">
            {t('Lesen')}
          </a>
          <button className="btn small" onClick={async () => (await act(() => api.post('/api/cloud/legal/accept', {}), tr('cloud')('Danke'))) && reload()}>
            {t('Bestätigen')}
          </button>
        </div>
      )}
      <Tabs tabs={tabs} value={active} onChange={setTab} />
      {active === 'overview' && <Overview me={m} owner={owner} onTab={setTab} />}
      {active === 'plan' && owner && <PlanTab me={m} reload={reload} />}
      {active === 'team' && <CloudTeam me={m} owner={owner} reload={reload} />}
      {active === 'clients' && <CloudClients me={m} owner={owner} reload={reload} />}
      {active === 'data' && owner && <CloudData me={m} reload={reload} />}
    </div>
  );
}
