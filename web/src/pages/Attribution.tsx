import { useEffect, useState } from 'react';
import { api, currentLocation, dt, euro, money } from '../api';
import { Icon } from '../icons';
import { Badge, Check, CodeBox, Empty, Field, Input, PageHead, Select, Spinner, Stat, Tabs, Textarea, act, navigate, useLoad } from '../ui';
import { AdsAccounts, AdsReport, RangePicker, ymd } from './Ads';
import { PageSuspense, lazyPages } from '../lazy';
import { useT } from '../i18n';
import { SortableGrid } from '../sortable/Sortable';

const { GoogleConversions } = lazyPages(() => import('./AdsConversions'), 'GoogleConversions');

/** Attribution: where leads, deals and revenue come from (report, ads, tracking settings), plus the contact card and list filter. */

export const srcLabel = (v: string | null | undefined) => (v === 'direct' ? '(direkt)' : v === '(none)' ? '(keins)' : v || '(unbekannt)');
const KIND: Record<string, string> = { visit: 'Besuch', form: 'Formular', booking: 'Termin', chat: 'Chat', purchase: 'Kauf', buy: 'Kauf' };
const GROUPS: [string, string][] = [
  ['source', 'Quelle'],
  ['source_medium', 'Quelle / Medium'],
  ['campaign', 'Kampagne'],
  ['funnel', 'Funnel'],
];
const MODELS: [string, string][] = [
  ['first', 'Erster Kontakt'],
  ['last', 'Letzter Kontakt'],
];

export function Attribution({ tab }: { tab?: string }) {
  const t = useT('attribution');
  const activeTab = ['report', 'ads', 'settings'].includes(tab ?? '') ? tab! : 'report';
  const [range, setRange] = useState({ from: ymd(new Date(Date.now() - 29 * 864e5)), to: ymd(new Date()) });
  return (
    <>
      <PageHead title={t('Attribution')} sub={t('Woher Leads, Kunden und Umsatz kommen – erster und letzter Kontaktpunkt, ganz ohne Fremd-Tracking.')} />
      <Tabs
        tabs={[
          ['report', t('Bericht')],
          ['ads', t('Werbung: CPL & ROAS')],
          ['settings', t('Tracking & Werbekonten')],
        ]}
        value={activeTab}
        onChange={(v) => navigate(`attribution/${v}`)}
      />
      {activeTab === 'report' && <Report range={range} setRange={(from, to) => setRange({ from, to })} />}
      {activeTab === 'ads' && <AdsReport range={range} setRange={(from, to) => setRange({ from, to })} />}
      {activeTab === 'settings' && (
        <>
          <TrackingSettings />
          <AdsAccounts />
          <PageSuspense>
            <GoogleConversions />
          </PageSuspense>
        </>
      )}
    </>
  );
}

function Report({ range, setRange }: { range: { from: string; to: string }; setRange: (from: string, to: string) => void }) {
  const t = useT('attribution');
  const [group, setGroup] = useState('source_medium');
  const [model, setModel] = useState('first');
  const qs = `from=${range.from}&to=${range.to}&group=${group}&model=${model}`;
  const { data, loading, error } = useLoad(() => api.get(`/api/attribution/report?${qs}`), [qs]);
  const rows: any[] = data?.rows ?? [];
  const tot = data?.totals;
  // One series: revenue when there is any, else leads.
  const metric: 'revenue_cents' | 'leads' = tot?.revenue_cents ? 'revenue_cents' : 'leads';
  const max = Math.max(1, ...rows.map((r) => r[metric]));
  const fmt = (r: any) => (metric === 'revenue_cents' ? money(r.revenue_cents) : `${r.leads} ${t('Leads')}`);
  return (
    <>
      <RangePicker from={range.from} to={range.to} onChange={setRange}>
        <div style={{ width: 168 }}>
          <Field label={t('Gruppieren nach')} tour="attribution-group">
            <Select value={group} onChange={setGroup} options={GROUPS.map(([k, l]) => [k, t(l)] as [string, string])} />
          </Field>
        </div>
        <div style={{ width: 150 }}>
          <Field label={t('Zuordnung')} tour="attribution-model">
            <Select value={model} onChange={setModel} options={MODELS.map(([k, l]) => [k, t(l)] as [string, string])} />
          </Field>
        </div>
        <a className="btn secondary attr-export" data-tour="attribution-csv" title={t('Tabelle als CSV herunterladen')} href={`/api/attribution/report.csv?${qs}&locationId=${encodeURIComponent(currentLocation())}`}>
          <Icon name="download" /> CSV
        </a>
      </RangePicker>
      {error && <p style={{ color: 'var(--red)' }}>{error}</p>}
      {loading && !data ? (
        <Spinner />
      ) : (
        <>
          <SortableGrid id="attribution.stats" className="stats">
            <Stat label={t('Neue Leads')} value={tot?.leads ?? 0} sub={t('Kontakte, die im Zeitraum dazukamen')} />
            <Stat label={t('Gewonnene Deals')} value={tot?.deals_won ?? 0} sub={`${t('Deal-Wert')} ${euro(tot?.deal_value ?? 0)}`} />
            <Stat label={t('Zahlende Kunden')} value={tot?.customers ?? 0} sub={t('mit bezahlter Rechnung')} />
            <Stat label={t('Umsatz')} value={money(tot?.revenue_cents ?? 0)} sub={t('bezahlte Rechnungen inkl. Stripe')} />
          </SortableGrid>
          {rows.length ? (
            <div className="table-wrap">
              <table className="t attr-table">
                <thead>
                  <tr>
                    <th>{t(GROUPS.find((g) => g[0] === group)?.[1] ?? group)}</th>
                    <th className="num">{t('Leads')}</th>
                    <th className="num">{t('Deals')}</th>
                    <th className="num">{t('Deal-Wert')}</th>
                    <th className="num">{t('Kunden')}</th>
                    <th className="num">{t('Umsatz')}</th>
                    <th style={{ width: '24%' }}>{metric === 'revenue_cents' ? t('Anteil am Umsatz') : t('Anteil an Leads')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const share = tot?.[metric] ? Math.round((r[metric] / tot[metric]) * 100) : 0;
                    return (
                      <tr key={r.key}>
                        <td>
                          <strong>{r.label}</strong>
                        </td>
                        <td className="num">{r.leads}</td>
                        <td className="num">{r.deals_won}</td>
                        <td className="num">{euro(r.deal_value)}</td>
                        <td className="num">{r.customers}</td>
                        <td className="num">{money(r.revenue_cents)}</td>
                        <td>
                          <div className="hbar" title={`${r.label}: ${fmt(r)} (${share} %)`}>
                            <i style={{ width: `${(r[metric] / max) * 100}%` }} />
                            <span>{share} %</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>{t('Im Zeitraum gibt es noch keine Leads oder Umsätze.')}</Empty>
          )}
          <p className="muted small">
            {t('„Erster Kontakt“ rechnet jeden Lead der Quelle zu, über die er zum ersten Mal kam; „Letzter Kontakt“ der letzten Quelle vor dem Abschluss (direkte Aufrufe zählen dabei nicht). Deals zählen nach dem Datum, an dem sie gewonnen wurden, Umsatz nach dem Zahlungsdatum.')}
          </p>
        </>
      )}
    </>
  );
}

function TrackingSettings() {
  const t = useT('attribution');
  const s = useLoad(() => api.get('/api/attribution/settings'), []);
  const [f, setF] = useState<any>(null);
  useEffect(() => {
    if (s.data) setF(s.data);
  }, [s.data]);
  if (!f) return <Spinner />;
  const save = async () => {
    const r = await act(() => api.put('/api/attribution/settings', { enabled: f.enabled, cookie: f.cookie, cookie_days: Number(f.cookie_days), banner: f.banner, banner_text: f.banner_text }), t('Gespeichert'));
    if (r) s.setData({ ...s.data, ...r });
  };
  return (
    <div className="card" data-tour="attribution-tracking">
      <h2>{t('Tracking')}</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        {t('Funnels, Websites und Kauflinks erfassen UTM-Parameter, gclid/fbclid, Verweis-Seite und Einstiegsseite selbst – auf deinem Server, ohne Google Analytics oder Meta-Pixel. Formulare, Termine, Chat und Käufe übernehmen die Herkunft in den Kontakt.')}
      </p>
      <Check checked={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} label={t('Herkunft erfassen')} />
      <div className="grid2">
        <Field label={t('Besucher-Cookie')} hint={t('Ohne Cookie zählt nur der Seitenaufruf, auf dem das Formular abgeschickt wird.')}>
          <Select
            value={f.cookie}
            onChange={(v) => setF({ ...f, cookie: v })}
            options={[
              ['consent', t('Nur mit Einwilligung (empfohlen)')],
              ['always', t('Immer – nur mit eigener Rechtsgrundlage')],
              ['never', t('Nie')],
            ]}
          />
        </Field>
        <Field label={t('Cookie-Laufzeit (Tage)')}>
          <Input type="number" min={1} max={730} value={f.cookie_days} onChange={(v) => setF({ ...f, cookie_days: v })} />
        </Field>
      </div>
      <Check checked={f.banner} onChange={(v) => setF({ ...f, banner: v })} label={t('Eigenen kleinen Hinweis mit „Einverstanden / Nein“ auf Funnel-Seiten zeigen (nur bei „Nur mit Einwilligung“)')} />
      {f.banner && (
        <Field label={t('Text des Hinweises')}>
          <Textarea value={f.banner_text} onChange={(v) => setF({ ...f, banner_text: v })} />
        </Field>
      )}
      <p>
        <button className="btn" onClick={save}>
          {t('Speichern')}
        </button>
      </p>
      <hr />
      <h3>{t('Andere Websites (WordPress & Co.)')}</h3>
      <p className="muted small">{t('Dieses Skript erfasst die Herkunft auch dort und gibt sie an eingebettete Formulare, Termin-Buchungen, Kauflinks und den Live-Chat weiter:')}</p>
      <CodeBox text={s.data.snippet} />
      <p className="muted small">
        {t('Einwilligung: Dein Cookie-Banner setzt window.pghlConsent = true (oder ruft pghl.consent(true) auf) bzw. das Cookie pghl_consent=1; false/0 heißt Nein. Global Privacy Control des Browsers gilt als Nein. Auf Funnel-Seiten setzt der Link /pghl-consent?v=1 (bzw. ?v=0) die Wahl.')}
      </p>
    </div>
  );
}

/** Card on the contact page: first/last touch and the visit history. */
export function ContactAttribution({ contactId }: { contactId: string }) {
  const t = useT('attribution');
  const { data } = useLoad(() => api.get(`/api/contacts/${contactId}/attribution`).catch(() => null), [contactId]);
  if (!data) return null;
  const s = data.summary;
  const touch = (p: 'first' | 'last') => (
    <div style={{ marginBottom: 10 }}>
      <div className="muted small">{p === 'first' ? t('Erster Kontakt') : t('Letzter Kontakt')}</div>
      <div>
        <strong>{t(srcLabel(s[`${p}_source`]))}</strong> / {t(srcLabel(s[`${p}_medium`]))} {s[`${p}_campaign`] ? <Badge tone="blue">{s[`${p}_campaign`]}</Badge> : null}
      </div>
      <div className="muted small">
        {dt(s[`${p}_at`])}
        {s[`${p}_funnel_name`] ? ` · ${s[`${p}_funnel_name`]}` : ''}
      </div>
    </div>
  );
  return (
    <div className="card">
      <h2>{t('Herkunft')}</h2>
      {s ? (
        <>
          {touch('first')}
          {s.last_touch_id !== s.first_touch_id && touch('last')}
          <details className="attr-history">
            <summary>{t('Verlauf ({n})', { n: data.touches.length })}</summary>
            <ul className="timeline">
              {data.touches.map((touchItem: any) => (
                <li key={touchItem.id}>
                  <span className="muted small" style={{ minWidth: 92 }}>
                    {dt(touchItem.created_at)}
                  </span>
                  <span>
                    <Badge>{t(KIND[touchItem.kind] ?? touchItem.kind)}</Badge> {t(srcLabel(touchItem.source))} / {t(srcLabel(touchItem.medium))}
                    {touchItem.campaign ? ` · ${touchItem.campaign}` : ''}
                    {touchItem.ref ? ` · ${t('Affiliate')} ${touchItem.ref}` : ''}
                    <div className="muted small attr-url">{[touchItem.landing_page, touchItem.referrer && `${t('von')} ${touchItem.referrer}`, touchItem.gclid && 'gclid', touchItem.fbclid && 'fbclid'].filter(Boolean).join(' · ')}</div>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : (
        <p className="muted">{t('Keine Angaben – z. B. importiert, manuell angelegt oder ohne Einwilligung.')}</p>
      )}
    </div>
  );
}

// --- contact list filter -------------------------------------------------------------------------
export type AttrFilter = { attr_source?: string; attr_campaign?: string; attr_touch?: string };
export const attrQs = (f: AttrFilter) =>
  Object.entries(f)
    .filter(([, v]) => v)
    .map(([k, v]) => `&${k}=${encodeURIComponent(String(v))}`)
    .join('');
export const pickAttr = (f: any): AttrFilter => ({ attr_source: f?.attr_source ?? '', attr_campaign: f?.attr_campaign ?? '', attr_touch: f?.attr_touch ?? '' });

export function AttributionFilter({ value, onChange }: { value: AttrFilter; onChange: (v: AttrFilter) => void }) {
  // Part of the contact list: translated with it (contacts catalog).
  const t = useT('contacts');
  const { data } = useLoad(() => api.get('/api/attribution/sources').catch(() => null), []);
  if (!data || (!data.sources.length && !value.attr_source)) return null;
  return (
    <>
      <div style={{ width: 170 }}>
        <Select value={value.attr_source} onChange={(v) => onChange({ ...value, attr_source: v })} placeholder={t('Alle Quellen')} options={[...data.sources.map((s: string) => [s, t(srcLabel(s))] as [string, string]), ['__none__', t('(ohne Herkunft)')]]} />
      </div>
      {data.campaigns.length > 0 && (
        <div style={{ width: 170 }}>
          <Select value={value.attr_campaign} onChange={(v) => onChange({ ...value, attr_campaign: v })} placeholder={t('Alle Kampagnen')} options={data.campaigns} />
        </div>
      )}
      {(value.attr_source || value.attr_campaign) && value.attr_source !== '__none__' && (
        <div style={{ width: 160 }}>
          <Select
            value={value.attr_touch}
            onChange={(v) => onChange({ ...value, attr_touch: v })}
            options={[
              ['', t('Erster oder letzter')],
              ['first', t('Erster Kontakt')],
              ['last', t('Letzter Kontakt')],
            ]}
          />
        </div>
      )}
    </>
  );
}
