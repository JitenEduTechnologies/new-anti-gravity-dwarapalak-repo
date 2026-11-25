import { useState } from 'react';
import { api, d, dt, money } from '../api';
import { Icon } from '../icons';
import { act, Badge, Empty, Field, Input, Modal, pressable, Select, Spinner, Stat, Tabs, Textarea, useLoad } from '../ui';
import { useSession } from '../session';
import { useT } from '../i18n';
import { PHASE_TONE, REASONS } from './CloudKit';
import { CloudSettingsForm } from './CloudSettings';
import { Slot } from '../slots';
import { SortableGrid } from '../sortable/Sortable';

/**
 * Agentur → Cloud: the operator console of the hosted service. Numbers (MRR, churn, trial conversion), the customer list
 * with the actions the operator has (extend a trial, comp a plan, change a plan, open the account with the customer's
 * consent, delete), the settings of the service, the legal texts and signups that failed; abuse and the waitlist plug in as slots.
 */

// EVENTS, PLANS, PHASES are localized inside components via eventLabel, planLabel, phaseLabel helpers
function getEventLabel(e: string, t: (k: string) => string) {
  switch (e) {
    case 'provisioned': return t('Konto angelegt');
    case 'trial_started': return t('Testphase gestartet');
    case 'trial_converted': return t('Testphase → Abo');
    case 'trial_expired': return t('Testphase abgelaufen');
    case 'trial_extended': return t('Testphase verlängert');
    case 'subscribed': return t('Abo abgeschlossen');
    case 'checkout_started': return t('Bezahlseite geöffnet');
    case 'payment_failed': return t('Zahlung fehlgeschlagen');
    case 'payment_recovered': return t('Zahlung nachgeholt');
    case 'reactivated': return t('Wieder freigeschaltet');
    case 'read_only': return t('Schreibgeschützt');
    case 'canceled': return t('Abo beendet');
    case 'cancel_scheduled': return t('Gekündigt');
    case 'cancel_undone': return t('Kündigung zurückgenommen');
    case 'plan_changed': return t('Tarif geändert');
    case 'comped': return t('Tarif geschenkt');
    case 'comp_ended': return t('Geschenk ausgelaufen');
    case 'deletion_scheduled': return t('Löschung geplant');
    case 'deletion_undone': return t('Löschung zurückgenommen');
    case 'deleted': return t('Gelöscht');
    case 'export': return t('Daten exportiert');
    case 'support_consent': return t('Support-Freigabe');
    case 'support_open': return t('Support hat geöffnet');
    case 'member_invited': return t('Nutzer eingeladen');
    case 'member_removed': return t('Nutzer entfernt');
    case 'client_created': return t('Kunden-Account angelegt');
    case 'client_deleted': return t('Kunden-Account gelöscht');
    case 'branding_changed': return t('White-Label geändert');
    case 'domain_changed': return t('Domain geändert');
    case 'legal_accepted': return t('Bedingungen bestätigt');
    case 'mail_failed': return t('E-Mail fehlgeschlagen');
    case 'provision_failed': return t('Einrichtung fehlgeschlagen');
    case 'signup_blocked': return t('Anmeldung blockiert');
    case 'b2b_confirmed': return t('Unternehmer bestätigt');
    case 'abuse_reported': return t('Missbrauch gemeldet');
    case 'abuse_sending_paused': return t('Versand pausiert');
    case 'abuse_sending_resumed': return t('Versand wieder frei');
    case 'abuse_sites_offline': return t('Websites offline');
    case 'abuse_sites_online': return t('Websites wieder online');
    case 'abuse_suspended': return t('Konto gesperrt');
    case 'abuse_unsuspended': return t('Sperre aufgehoben');
    default: return e;
  }
}

const pct = (n: number | null | undefined) => (n === null || n === undefined ? '–' : `${String(n).replace('.', ',')} %`);

function Overview({ go }: { go: (t: string) => void }) {
  const t = useT('agency');
  const o = useLoad(() => api.get('/api/cloud/console/overview'), []);
  const x = o.data;
  if (!x) return <Spinner />;
  const h = x.health;
  const checks: [boolean, string, string?][] = [
    [h.stripe_connected, t('Stripe ist verbunden'), t('Schlüssel unter Agentur → SaaS → Einstellungen')],
    [h.webhook_set, t('Webhook-Secret ist hinterlegt'), t('ohne Webhook entstehen keine Konten nach der Zahlung')],
    [h.signup_open, t('Anmeldung ist offen'), t('Einstellungen → Anmeldung')],
    [h.mail_ready, t('System-Mails werden wirklich verschickt (Absender mit SMTP oder Mail-Dienst, nicht „nur speichern“)'), t('Einstellungen → Domain & Mail')],
    [!h.legal_open, t('Rechtstexte sind vollständig ausgefüllt'), t('{n} Dokument(e) mit offenen Platzhaltern', { n: h.legal_open })],
    [!!h.cloud_domain, t('Cloud-Domain für <name>.domain gesetzt'), t('optional – sonst pfadbasiert')],
    [!h.saas_signup_open, t('Die SaaS-Anmeldeseite (/signup) ist aus'), t('im Cloud-Modus laufen Anmeldungen über /start')],
    [!!h.sites_domain, t('Eigene Domain für Kunden-Websites gesetzt (PGHL_CLOUD_SITES_DOMAIN)'), t('sonst sind Kunden-Websites nur über ihre eigene, bestätigte Domain erreichbar – nie unter der Login-Adresse')],
    [!!h.offsite_backup, t('Off-site-Backup ist eingerichtet'), t('PGHL_BACKUP_S3_* und PGHL_BACKUP_KEY – Status unter Agentur → System')],
  ];
  return (
    <>
      <SortableGrid id="cloud-stats" className="stats" data-tour="cloud-stats">
        <Stat label="MRR" value={money(x.mrr_cents, x.currency)} sub={t("ARR {arr}", { arr: money(x.arr_cents, x.currency) })} />
        <Stat label={t("Zahlende Kunden")} value={x.paying} sub={t("{total} Konten gesamt, {recent} neu in 30 Tagen", { total: x.total, recent: x.new_30d })} />
        <Stat label={t("Testphasen")} value={x.counts.trial} sub={t("noch ohne Umsatz")} />
        <Stat label={t("Testphase → Abo")} value={pct(x.trial.conversion_percent)} sub={t("{converted} umgestiegen, {expired} abgelaufen (90 Tage)", { converted: x.trial.converted_90d, expired: x.trial.expired_90d })} />
        <Stat label={t("Churn (30 Tage)")} value={pct(x.churn.rate_percent)} sub={t("{n} beendet", { n: x.churn.lost_30d })} />
        <Stat label={t("Zahlung offen")} value={x.counts.past_due + x.counts.read_only} sub={t("{n} davon schreibgeschützt", { n: x.counts.read_only })} />
      </SortableGrid>
      <SortableGrid id="cloud.cards" className="grid2 saas-grid">
        <div className="card" data-tour="cloud-health">
          <h3 style={{ marginTop: 0 }}>{t("Einrichtung")}</h3>
          <ul className="cloud-checks">
            {checks.map(([ok, label, hint]) => (
              <li key={label} className={ok ? 'ok' : 'todo'}>
                <Icon name={ok ? 'ok' : 'pending'} size={18} />
                <div>
                  {label}
                  {!ok && hint && <div className="muted small">{hint}</div>}
                </div>
              </li>
            ))}
          </ul>
          <button className="btn secondary small" onClick={() => go('settings')}>
            {t('Zu den Einstellungen')}
          </button>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t("Kunden je Tarif")}</h3>
          <div className="table-wrap">
<table className="t">
            <thead>
              <tr>
                <th>{t("Tarif")}</th>
                <th>{t("Konten")}</th>
                <th>{t("MRR")}</th>
              </tr>
            </thead>
            <tbody>
              {x.plans.map((p: any) => (
                <tr key={p.key}>
                  <td>{p.name}</td>
                  <td>
                    {p.count}
                    {p.trialing ? <span className="muted small"> ({p.trialing} {t('Test')})</span> : null}
                  </td>
                  <td>{money(p.mrr_cents, x.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
</div>
          {x.failed_signups > 0 && (
            <p className="notice-warn" style={{ marginTop: 12 }}>
              {x.failed_signups} {t('Anmeldung(en) mit Zahlung konnten nicht eingerichtet werden.')}{' '}
              <a href="#" onClick={(e) => (e.preventDefault(), go('signups'))}>
                Ansehen
              </a>
            </p>
          )}
        </div>
      </SortableGrid>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t("Letzte Ereignisse")}</h3>
        {x.events.length ? (
          <div className="table-wrap">
<table className="t">
            <tbody>
              {x.events.map((e: any) => (
                <tr key={e.id}>
                  <td className="nowrap muted">{dt(e.at)}</td>
                  <td>{e.tenant_name || <span className="muted">{t('gelöschtes Konto')}</span>}</td>
                  <td>{getEventLabel(e.type, t)}</td>
                  <td className="muted small">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
</div>
        ) : (
          <Empty>{t('Noch nichts passiert.')}</Empty>
        )}
      </div>
    </>
  );
}

function TenantModal({ id, onClose, onChange }: { id: string; onClose: () => void; onChange: () => void }) {
  const t = useT('agency');
  const session = useSession();
  const tenant = useLoad(() => api.get(`/api/cloud/console/tenants/${id}`), [id]);
  const [days, setDays] = useState('7');
  const [plan, setPlan] = useState('team');
  const [months, setMonths] = useState('');
  const [confirm, setConfirm] = useState('');
  const [notes, setNotes] = useState<string | null>(null);
  const x = tenant.data;
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    if (await act(fn, ok)) {
      void tenant.reload();
      onChange();
    }
  };
  return (
    <Modal title={x ? x.name : 'Kunde'} wide onClose={onClose}>
      {!x ? (
        <Spinner />
      ) : (
        <>
          <div className="row">
            <div className="grow">
              <p>
                <Badge tone={PHASE_TONE[x.phase] ?? 'gray'}>{x.phase_label}</Badge> {x.plan.name} · {x.plan.interval === 'year' ? 'jährlich' : 'monatlich'} · {x.billing === 'stripe' ? 'Stripe' : 'ohne Stripe'}
              </p>
              <p className="muted small">
                {x.email} {t('· angelegt')} {d(x.created_at)}
                {x.trial_end && ` · ${t("Testphase bis {dt}", { dt: d(x.trial_end) })}`}
                {x.current_period_end && ` · ${t("Laufzeit bis {dt}", { dt: d(x.current_period_end) })}`}
                {x.deletion && ` · ${t("Löschung {dt}", { dt: d(x.deletion.at) })}`}
              </p>
              <p className="muted small">
                {x.users} {t('Nutzer')}{x.entitlements.client_accounts ? `, ${x.clients} ${t('Kunden-Accounts')}` : ''} {t('· E-Mails')} {x.meters.emails.used.toLocaleString('de-DE')} {t('· Support-Zugriff')} {x.support.active ? `${t('bis')} ${d(x.support.until)}` : t('nicht freigegeben')}
              </p>
              {x.cancel_reason && (
                <p className="muted small">
                  {t('Kündigungsgrund:')} {REASONS.find(([k]) => k === x.cancel_reason)?.[1] ?? x.cancel_reason}
                  {x.cancel_comment ? ` – „${x.cancel_comment}“` : ''}
                </p>
              )}
            </div>
          </div>
          <div className="actions" style={{ margin: '8px 0 14px' }}>
            <button
              className="btn"
              disabled={!x.support.active}
              title={x.support.active ? 'Konto im Support öffnen' : 'Der Kunde hat den Support-Zugriff nicht freigegeben'}
              onClick={async () => {
                const r = await act(() => api.post<{ location_id: string }>(`/api/cloud/console/tenants/${id}/open`, { reason: 'Support' }));
                if (r?.location_id) {
                  onClose();
                  session.switchLocation(r.location_id);
                }
              }}
            >
              <Icon name="eye" /> {t("Konto öffnen")}
            </button>
          </div>
          <div className="grid2">
            <Field label={t("Testphase verlängern (Tage)")}>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <Input value={days} onChange={setDays} />
                <button className="btn secondary" onClick={() => run(() => api.post(`/api/cloud/console/tenants/${id}/extend-trial`, { days: Number(days) }), t('Testphase verlängert'))}>{t("Verlängern")}</button>
              </div>
            </Field>
            <Field label={t("Tarif ändern")}>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <Select value={plan} onChange={setPlan} options={[['solo', 'Cloud Solo'], ['team', 'Cloud Team & Company'], ['agency', t('Cloud Agentur')]] as [string, string][]} />
                <button className="btn secondary" onClick={() => run(() => api.post(`/api/cloud/console/tenants/${id}/plan`, { plan }), t('Tarif geändert'))}>{t("Ändern")}</button>
              </div>
            </Field>
            <Field label={t("Tarif schenken (Monate, leer = unbefristet)")}>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <Input value={months} onChange={setMonths} placeholder="z. B. 3" />
                <button className="btn secondary" onClick={() => run(() => api.post(`/api/cloud/console/tenants/${id}/comp`, { plan, ...(months ? { months: Number(months) } : {}) }), t('Tarif geschenkt'))}>{t("Schenken")}</button>
              </div>
            </Field>
            <Field label={t("Notiz (nur für dich)")}>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <Input value={notes ?? x.notes} onChange={setNotes} />
                <button className="btn secondary" disabled={notes === null} onClick={() => run(() => api.patch(`/api/cloud/console/tenants/${id}`, { notes }), t('Gespeichert'))}>
                  Speichern
                </button>
              </div>
            </Field>
          </div>
          <h4>Verlauf</h4>
          <div className="cloud-events">
            <div className="table-wrap">
<table className="t">
              <tbody>
                {x.events.map((e: any) => (
                  <tr key={e.id}>
                    <td className="nowrap muted">{dt(e.at)}</td>
                    <td>{getEventLabel(e.type, t)}</td>
                    <td className="muted small">{e.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
</div>
          </div>
          <details style={{ marginTop: 14 }}>
            <summary>{t('Konto löschen …')}</summary>
            <p className="muted small">{t('Löscht alle Daten und Logins sofort und endgültig (der Kunde wird per E-Mail informiert, das Stripe-Abo beendet).')}</p>
            <Field label={t("Zur Bestätigung „{name}“ eintippen", { name: x.name })}>\n
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <Input value={confirm} onChange={setConfirm} />
                <button
                  className="btn danger"
                  disabled={confirm !== x.name}
                  onClick={async () => {
                    if (await act(() => api.post(`/api/cloud/console/tenants/${id}/delete`, { confirm }), t('Gelöscht'))) {
                      onChange();
                      onClose();
                    }
                  }}
                >
                  Löschen
                </button>
              </div>
            </Field>
          </details>
        </>
      )}
    </Modal>
  );
}

function Customers() {
  const t = useT('agency');
  const PLANS: [string, string][] = [
    ['solo', t('Cloud Solo')],
    ['team', t('Cloud Team & Company')],
    ['agency', t('Cloud Agentur')],
  ];
  const PHASES: [string, string][] = [
    ['', t('Alle Status')],
    ['trial', t('Testphase')],
    ['active', t('Aktiv')],
    ['comped', t('Geschenkt')],
    ['past_due', t('Zahlung offen')],
    ['read_only', t('Schreibgeschützt')],
    ['canceled', t('Gekündigt')],
    ['deletion_scheduled', t('Löschung geplant')],
  ];
  const [q, setQ] = useState('');
  const [phase, setPhase] = useState('');
  const [plan, setPlan] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const list = useLoad(() => api.get(`/api/cloud/console/tenants?q=${encodeURIComponent(q)}&phase=${phase}&plan=${plan}&limit=200`), [q, phase, plan]);
  const x = list.data;
  return (
    <div className="card" data-tour="cloud-customers">
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="grow">
          <Field label={t("Suchen")}>
            <Input value={q} onChange={setQ} placeholder="Firma, E-Mail …" />
          </Field>
        </div>
        <div>
          <Field label={t("Status")}>
            <Select value={phase} onChange={setPhase} options={PHASES} />
          </Field>
        </div>
        <div>
          <Field label={t("Tarif")}>
            <Select value={plan} onChange={setPlan} options={[['', 'Alle Tarife'], ...PLANS]} />
          </Field>
        </div>
        <a className="btn secondary" style={{ marginBottom: 12 }} href="/api/cloud/console/tenants.csv" download>
          <Icon name="csv" /> CSV
        </a>
      </div>
      {!x ? (
        <Spinner />
      ) : x.items.length ? (
        <div className="table-wrap">
<table className="t">
          <thead>
            <tr>
              <th>Firma</th>
              <th>{t("Tarif")}</th>
              <th>Status</th>
              <th>{t("MRR")}</th>
              <th>{t('Testphase / Laufzeit')}</th>
              <th>Angelegt</th>
            </tr>
          </thead>
          <tbody>
            {x.items.map((r: any) => (
              <tr key={r.id} className="click" {...pressable(() => setOpen(r.id))}>
                <td>
                  {r.name}
                  <div className="muted small">{r.email}</div>
                </td>
                <td>
                  {r.plan_name}
                  <div className="muted small">{r.interval === 'year' ? 'jährlich' : 'monatlich'}</div>
                </td>
                <td>
                  <Badge tone={PHASE_TONE[r.phase] ?? 'gray'}>{r.phase_label}</Badge> {r.cancel_at_period_end && <Badge tone="yellow">gekündigt</Badge>} {r.support && <Badge tone="purple">{t('Support frei')}</Badge>}
                </td>
                <td className="nowrap">{r.mrr_cents ? money(r.mrr_cents) : '–'}</td>
                <td className="nowrap">{d(r.status === 'trialing' ? r.trial_end : r.current_period_end)}</td>
                <td className="nowrap">{d(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
</div>
      ) : (
        <Empty>{t('Keine Kunden gefunden.')}</Empty>
      )}
      {open && <TenantModal id={open} onClose={() => setOpen(null)} onChange={() => void list.reload()} />}
    </div>
  );
}

function Legal() {
  const t = useT('agency');
  const l = useLoad(() => api.get<{ docs: { doc: string; title: string; version: number; body: string; open_placeholders: string[]; accepted: number; created_at: string }[] }>('/api/cloud/console/legal'), []);
  const [edit, setEdit] = useState<Record<string, string>>({});
  if (!l.data) return <Spinner />;
  return (
    <div data-tour="cloud-legal">
      <div className="notice-warn">
        {t('Die Texte sind Vorlagen mit Platzhaltern und')} <strong>{t('keine Rechtsberatung')}</strong>{t('. Lass sie prüfen und trage deine Angaben unter Einstellungen → Anbieter ein. Jede Änderung ist eine neue Version; Kunden sehen sie als „bitte bestätigen“. Platzhalter:')} <code>{'{{operator.name}}'}</code>, <code>{'{{operator.address}}'}</code>, <code>{'{{customer.company}}'}</code>, <code>{'{{service}}'}</code>, <code>{'{{date}}'}</code>, <code>{'{{trial_days}}'}</code> …
      </div>
      {l.data.docs.map((x) => {
        const body = edit[x.doc] ?? x.body;
        return (
          <div className="card" key={x.doc}>
            <div className="saas-subtabs">
              <h3 style={{ marginTop: 0 }}>
                {x.title} <Badge>Version {x.version}</Badge> {x.open_placeholders.length > 0 && <Badge tone="yellow">{x.open_placeholders.length} {t('Platzhalter offen')}</Badge>}
              </h3>
              <a href={`/cloud/legal/${x.doc}`} target="_blank" rel="noopener noreferrer">
                {t('Seite ansehen')}
              </a>
            </div>
            {x.open_placeholders.length > 0 && <p className="muted small">{t('Offen:')} {x.open_placeholders.map((p) => `{{${p}}}`).join(', ')}</p>}
            <Textarea value={body} onChange={(v) => setEdit({ ...edit, [x.doc]: v })} rows={12} className="mono" />
            <div className="actions" style={{ marginTop: 10 }}>
              <button
                className="btn"
                disabled={edit[x.doc] === undefined || edit[x.doc] === x.body}
                onClick={async () => {
                  if (await act(() => api.put(`/api/cloud/console/legal/${x.doc}`, { body: edit[x.doc] }), t('Neue Version veröffentlicht'))) {
                    setEdit({ ...edit, [x.doc]: undefined as any });
                    void l.reload();
                  }
                }}
              >
                {t('Als neue Version veröffentlichen')}
              </button>
              <span className="muted small">{x.accepted} {t('Kunden haben diese Version bestätigt')}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Signups() {
  const t = useT('agency');
  const s = useLoad(() => api.get<any[]>('/api/cloud/console/signups'), []);
  if (!s.data) return <Spinner />;
  return (
    <div className="card">
      <p className="muted small" style={{ marginTop: 0 }}>{t('Offene Anmeldungen löscht das System nach 7 Tage, fehlgeschlagene nach 30 Tagen (Datenschutz).')}</p>
      {s.data.length ? (
        <div className="table-wrap">
<table className="t">
          <thead>
            <tr>
              <th>Wann</th>
              <th>Firma</th>
              <th>{t("Tarif")}</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {s.data.map((r) => (
              <tr key={r.id}>
                <td className="nowrap">{dt(r.created_at)}</td>
                <td>
                  {r.company}
                  <div className="muted small">{r.email}</div>
                </td>
                <td>{r.plan_key}</td>
                <td>
                  <Badge tone={r.status === 'done' ? 'green' : r.status === 'failed' ? 'red' : 'gray'}>{r.status}</Badge>
                  {r.error && <div className="muted small">{r.error}</div>}
                </td>
                <td>
                  {r.status === 'failed' && (
                    <button className="btn small secondary" onClick={async () => (await act(() => api.post(`/api/cloud/console/signups/${r.id}/retry`, {}), t('Erneut versucht'))) && s.reload()}>
                      {t('Erneut einrichten')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
</div>
      ) : (
        <Empty>{t('Keine Anmeldungen.')}</Empty>
      )}
    </div>
  );
}

export function CloudConsole() {
  const t = useT('agency');
  // ?tab=waitlist (the admins' push notification about a new waitlist entry links there)
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab') || 'overview');
  return (
    <div className="cloud" data-tour="cloud-console">
      <div className="saas-subtabs">
        <Tabs
          tabs={[
            ['overview', 'Übersicht'],
            ['customers', 'Kunden'],
            ['settings', 'Einstellungen'],
            ['legal', 'Rechtliches'],
            ['signups', 'Anmeldungen'],
            ['abuse', 'Missbrauch'],
            ['waitlist', 'Warteliste'],
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className="actions">
          <a className="btn small secondary" href="/cloud" target="_blank" rel="noopener noreferrer">{t("Preisseite")}</a>
          <a className="btn small secondary" href="/start" target="_blank" rel="noopener noreferrer">{t("Anmeldeseite")}</a>
        </div>
      </div>
      {tab === 'overview' && <Overview go={setTab} />}
      {tab === 'customers' && <Customers />}
      {tab === 'settings' && <CloudSettingsForm />}
      {tab === 'legal' && <Legal />}
      {tab === 'signups' && <Signups />}
      {tab === 'abuse' && <Slot name="cloud.abuse" />}
      {tab === 'waitlist' && <Slot name="cloud.waitlist" />}
    </div>
  );
}

