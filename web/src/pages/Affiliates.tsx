import { useState } from 'react';
import { api, currentLocation, d as day, money } from '../api';
import { Icon } from '../icons';
import { act, Badge, Check, CodeBox, confirmAsk, Copy, Empty, Field, Input, Modal, navigate, PageHead, pressable, Select, Spinner, Stat, Tabs, Textarea, toast, useLoad } from '../ui';
import { SortableGrid } from '../sortable/Sortable';
import { useT } from '../i18n';

/** Affiliate manager: programs, affiliates, commissions (pending → approved → paid) and payouts. */

const STATUS: Record<string, [string, 'green' | 'yellow' | 'red' | 'gray' | 'blue']> = {
  active: ['aktiv', 'green'],
  pending: ['wartet auf Freigabe', 'yellow'],
  blocked: ['gesperrt', 'red'],
};
const C_STATUS: Record<string, [string, 'green' | 'yellow' | 'red' | 'gray' | 'blue']> = {
  pending: ['offen', 'yellow'],
  approved: ['freigegeben', 'blue'],
  paid: ['ausgezahlt', 'green'],
  reversed: ['storniert', 'gray'],
  open: ['offen', 'yellow'],
};
const KIND: Record<string, string> = { sale: 'Verkauf', recurring: 'Abo-Verlängerung', clawback: 'Rückbuchung', manual: 'Gutschrift' };
const euroIn = (cents: number) => String((cents || 0) / 100).replace('.', ',');
const toCents = (v: string) => Math.round(Number(String(v).replace(/\./g, '').replace(',', '.')) * 100) || 0;
const terms = (p: any, t?: (s: string) => string) =>
  `${p.commission_type === 'fixed' ? money(p.commission_value) : `${String(p.commission_value).replace('.', ',')} %`} · ${p.attribution === 'first' ? (t ? t('erster') : 'erster') : (t ? t('letzter') : 'letzter')} ${t ? t('Klick') : 'Klick'} · ${p.cookie_days} ${t ? t('Tage') : 'Tage'}${p.recurring ? ` · ${t ? t('auch Abo-Verlängerungen') : 'auch Abo-Verlängerungen'}` : ''} · ${t ? t('Auszahlung ab') : 'Auszahlung ab'} ${money(p.payout_threshold_cents)}`;

export function Affiliates({ tab }: { tab?: string }) {
  const t = useT('affiliates');
  const activeTab = ['affiliates', 'programs', 'commissions', 'payouts'].includes(tab ?? '') ? tab! : 'affiliates';
  const programs = useLoad(() => api.get<any[]>('/api/affiliates/programs'), []);
  if (!programs.data) return <Spinner />;
  return (
    <>
      <PageHead title={t('Affiliates')} sub={t('Partner empfehlen dich mit eigenem Link (?ref=…), du zahlst Provision auf Verkäufe.')} />
      <Tabs
        tabs={[
          ['affiliates', t('Affiliates')],
          ['programs', `${t('Programme')} (${programs.data.length})`],
          ['commissions', t('Provisionen')],
          ['payouts', t('Auszahlungen')],
        ]}
        value={activeTab}
        onChange={(v) => navigate(`affiliates/${v}`)}
      />
      {activeTab === 'affiliates' && <AffiliateList programs={programs.data} />}
      {activeTab === 'programs' && <Programs list={programs.data} reload={programs.reload} />}
      {activeTab === 'commissions' && <Commissions />}
      {activeTab === 'payouts' && <Payouts />}
    </>
  );
}

function AffiliateList({ programs }: { programs: any[] }) {
  const t = useT('affiliates');
  const ov = useLoad(() => api.get('/api/affiliates/overview'), []);
  const list = useLoad(() => api.get<any[]>('/api/affiliates'), []);
  const [edit, setEdit] = useState<any>(null);
  const [adding, setAdding] = useState(false);
  const o = ov.data;
  const reload = () => (list.reload(), ov.reload());
  if (!programs.length)
    return (
      <Empty action={<button className="btn" onClick={() => navigate('affiliates/programs')}>{t('Erstes Programm anlegen')}</button>}>
        {t('Lege zuerst ein Partnerprogramm an: Provision, Cookie-Laufzeit und Auszahlungsgrenze.')}
      </Empty>
    );
  return (
    <>
      {o && (
        <SortableGrid id="affiliates.stats" className="stats">
          <Stat label={t('Aktive Affiliates')} value={o.affiliates} sub={o.pending_affiliates ? `${o.pending_affiliates} ${t('warten auf Freigabe')}` : t('alle freigeschaltet')} />
          <Stat label={t('Klicks')} value={o.clicks.toLocaleString('de-DE')} sub={`${o.leads} ${t('Leads')}`} />
          <Stat label={t('Verkäufe')} value={o.sales} sub={`${t('Umsatz')} ${money(o.revenue_cents)} ${t('netto')}`} />
          <Stat label={t('Provision offen')} value={money(o.pending_cents)} sub={`${t('freigegeben')} ${money(o.approved_cents)}`} />
          <Stat label={t('Ausgezahlt')} value={money(o.paid_cents)} />
        </SortableGrid>
      )}
      <div className="actions" style={{ marginBottom: 12 }}>
        <button className="btn" data-tour="affiliates-new" onClick={() => setAdding(true)}>
          {t('+ Affiliate')}
        </button>
      </div>
      {!list.data ? (
        <Spinner />
      ) : list.data.length ? (
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>{t('Affiliate')}</th>
                <th>{t('Programm / Code')}</th>
                <th>{t('Status')}</th>
                <th className="num">{t('Klicks')}</th>
                <th className="num">{t('Leads')}</th>
                <th className="num">{t('Verkäufe')}</th>
                <th className="num">{t('Umsatz')}</th>
                <th className="num">{t('Offen')}</th>
                <th className="num">{t('Freigegeben')}</th>
                <th className="num">{t('Ausgezahlt')}</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((a) => (
                <tr key={a.id} className="click" {...pressable(() => setEdit(a))}>
                  <td>
                    <strong>{a.name || a.email}</strong>
                    <div className="muted small">{a.email}</div>
                  </td>
                  <td>
                    {a.program_name}
                    <div className="muted small">
                      <code>{a.code}</code>
                    </div>
                  </td>
                  <td>
                    <Badge tone={STATUS[a.status]?.[1]}>{t(STATUS[a.status]?.[0] ?? a.status)}</Badge>
                  </td>
                  <td className="num">{a.clicks}</td>
                  <td className="num">{a.leads}</td>
                  <td className="num">{a.sales}</td>
                  <td className="num">{money(a.revenue_cents)}</td>
                  <td className="num">{money(a.pending_cents)}</td>
                  <td className="num">{money(a.approved_cents)}</td>
                  <td className="num">{money(a.paid_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{t('Noch keine Affiliates. Teile den Anmelde-Link deines Programms oder lege Partner von Hand an.')}</Empty>
      )}
      {adding && <AffiliateModal programs={programs} onClose={() => setAdding(false)} onSaved={() => (setAdding(false), reload())} />}
      {edit && <AffiliateModal programs={programs} affiliate={edit} onClose={() => setEdit(null)} onSaved={() => (setEdit(null), reload())} />}
    </>
  );
}

function AffiliateModal({ programs, affiliate, onClose, onSaved }: { programs: any[]; affiliate?: any; onClose: () => void; onSaved: () => void }) {
  const t = useT('affiliates');
  const [f, setF] = useState<any>(affiliate ? { ...affiliate } : { program_id: programs[0]?.id ?? '', name: '', email: '', code: '', status: 'active', payout_method: 'sepa', iban: '', bic: '', paypal_email: '', notes: '' });
  const set = (k: string, v: unknown) => setF({ ...f, [k]: v });
  const save = async () => {
    const body = { name: f.name, code: f.code, status: f.status, payout_method: f.payout_method, iban: f.iban, bic: f.bic, paypal_email: f.paypal_email, notes: f.notes };
    const r = affiliate ? await act(() => api.patch(`/api/affiliates/${affiliate.id}`, body), t('Gespeichert')) : await act(() => api.post('/api/affiliates', { ...body, program_id: f.program_id, email: f.email }), t('Angelegt'));
    if (r) onSaved();
  };
  return (
    <Modal
      title={affiliate ? affiliate.name || affiliate.email : t('Affiliate anlegen')}
      onClose={onClose}
      footer={
        <>
          {affiliate && (
            <button
              className="btn ghost"
              onClick={async () => {
                if (confirmAsk(t('Affiliate löschen? Klicks und Provisionen werden mit gelöscht.')) && (await act(() => api.del(`/api/affiliates/${affiliate.id}`), t('Gelöscht')))) onSaved();
              }}
            >
              {t('Löschen')}
            </button>
          )}
          <button className="btn secondary" onClick={onClose}>
            {t('Abbrechen')}
          </button>
          <button className="btn" onClick={save}>
            {t('Speichern')}
          </button>
        </>
      }
    >
      {affiliate ? (
        <>
          <Field label={t('Partner-Link')}>
            <CodeBox text={affiliate.link} />
          </Field>
          <div className="actions" style={{ marginBottom: 12 }}>
            {affiliate.status === 'pending' && (
              <button className="btn small" onClick={async () => (await act(() => api.patch(`/api/affiliates/${affiliate.id}`, { status: 'active' }), t('Freigeschaltet'))) && onSaved()}>
                {t('Freischalten')}
              </button>
            )}
            <button
              className="btn small secondary"
              onClick={async () => {
                const r = await act(() => api.post(`/api/affiliates/${affiliate.id}/login-link`, {}));
                if (r?.link) window.prompt(t('E-Mail-Versand ist nicht eingerichtet. Login-Link zum Testen:'), r.link);
                else if (r) toast(r.status === 'sent' ? t('Login-Link per E-Mail gesendet') : t('E-Mail-Versand ist nicht eingerichtet – Link wurde nur protokolliert'));
              }}
            >
              <Icon name="email" /> {t('Login-Link senden')}
            </button>
            <a className="btn small secondary" href={affiliate.portal_url} target="_blank" rel="noreferrer">
              <Icon name="external" /> {t('Partnerbereich')}
            </a>
          </div>
        </>
      ) : (
        <>
          <Field label={t('Programm')}>
            <Select value={f.program_id} onChange={(v) => set('program_id', v)} options={programs.map((p) => [p.id, p.name] as [string, string])} />
          </Field>
          <Field label={t('E-Mail')}>
            <Input type="email" value={f.email} onChange={(v) => set('email', v)} />
          </Field>
        </>
      )}
      <div className="grid2">
        <Field label={t('Name')}>
          <Input value={f.name} onChange={(v) => set('name', v)} />
        </Field>
        <Field label={t('Code')} hint={affiliate ? undefined : t('leer = aus dem Namen')}>
          <Input value={f.code} onChange={(v) => set('code', v.toLowerCase())} />
        </Field>
        <Field label={t('Status')}>
          <Select value={f.status} onChange={(v) => set('status', v)} options={Object.entries(STATUS).map(([k, [l]]) => [k, t(l)] as [string, string])} />
        </Field>
        <Field label={t('Auszahlung per')}>
          <Select
            value={f.payout_method}
            onChange={(v) => set('payout_method', v)}
            options={[
              ['sepa', t('Überweisung (SEPA)')],
              ['paypal', t('PayPal')],
            ]}
          />
        </Field>
        {f.payout_method === 'paypal' ? (
          <Field label={t('PayPal-E-Mail')}>
            <Input value={f.paypal_email} onChange={(v) => set('paypal_email', v)} />
          </Field>
        ) : (
          <>
            <Field label={t('IBAN')}>
              <Input value={f.iban} onChange={(v) => set('iban', v)} />
            </Field>
            <Field label={t('BIC (optional)')}>
              <Input value={f.bic} onChange={(v) => set('bic', v)} />
            </Field>
          </>
        )}
      </div>
      <Field label={t('Notiz')}>
        <Textarea value={f.notes} onChange={(v) => set('notes', v)} />
      </Field>
    </Modal>
  );
}

function Programs({ list, reload }: { list: any[]; reload: () => void }) {
  const t = useT('affiliates');
  const [edit, setEdit] = useState<any>(null);
  return (
    <>
      <div className="actions" style={{ marginBottom: 12 }}>
        <button className="btn" data-tour="affiliates-new-program" onClick={() => setEdit({})}>
          {t('+ Programm')}
        </button>
      </div>
      {list.length ? (
        list.map((p) => (
          <div className="card" key={p.id}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ marginBottom: 2 }}>
                  {p.name} {!p.active && <Badge>{t('pausiert')}</Badge>}
                </h2>
                <div className="muted small">
                  {terms(p, t)} · {p.affiliates} {t('Affiliates')}
                </div>
              </div>
              <button className="btn small secondary" onClick={() => setEdit(p)}>
                {t('Bearbeiten')}
              </button>
            </div>
            <div className="grid2" style={{ marginTop: 12 }}>
              <Field label={t('Partnerbereich (Login per E-Mail-Link)')}>
                <CodeBox text={p.portal_url} />
              </Field>
              {p.public_signup ? (
                <Field label={t('Öffentliche Anmeldung')}>
                  <CodeBox text={p.signup_url} />
                </Field>
              ) : (
                <p className="muted small">{t('Anmeldung nur über dich (öffentliche Anmeldung aus).')}</p>
              )}
            </div>
          </div>
        ))
      ) : (
        <Empty action={<button className="btn" onClick={() => setEdit({})}>{t('Programm anlegen')}</button>}>{t('Noch kein Partnerprogramm.')}</Empty>
      )}
      {edit && <ProgramModal p={edit} onClose={() => setEdit(null)} onSaved={() => (setEdit(null), reload())} />}
    </>
  );
}

function ProgramModal({ p, onClose, onSaved }: { p: any; onClose: () => void; onSaved: () => void }) {
  const t = useT('affiliates');
  const [f, setF] = useState<any>({
    name: p.name ?? '',
    commission_type: p.commission_type ?? 'percent',
    value: p.id ? (p.commission_type === 'fixed' ? euroIn(p.commission_value) : String(p.commission_value)) : '20',
    attribution: p.attribution ?? 'last',
    cookie_days: p.cookie_days ?? 30,
    recurring: !!p.recurring,
    threshold: euroIn(p.payout_threshold_cents ?? 5000),
    hold_days: p.hold_days ?? 0,
    landing_url: p.landing_url ?? '',
    public_signup: p.id ? !!p.public_signup : true,
    auto_approve: !!p.auto_approve,
    active: p.id ? !!p.active : true,
    terms: p.terms ?? '',
  });
  const set = (k: string, v: unknown) => setF({ ...f, [k]: v });
  const save = async () => {
    const body = {
      name: f.name,
      commission_type: f.commission_type,
      commission_value: f.commission_type === 'fixed' ? toCents(f.value) : Number(String(f.value).replace(',', '.')),
      attribution: f.attribution,
      cookie_days: Number(f.cookie_days),
      recurring: f.recurring,
      payout_threshold_cents: toCents(f.threshold),
      hold_days: Number(f.hold_days),
      landing_url: f.landing_url,
      public_signup: f.public_signup,
      auto_approve: f.auto_approve,
      active: f.active,
      terms: f.terms,
    };
    const r = p.id ? await act(() => api.patch(`/api/affiliates/programs/${p.id}`, body), t('Gespeichert')) : await act(() => api.post('/api/affiliates/programs', body), t('Angelegt'));
    if (r) onSaved();
  };
  return (
    <Modal
      wide
      title={p.id ? t('Programm bearbeiten') : t('Neues Partnerprogramm')}
      onClose={onClose}
      footer={
        <>
          {p.id && (
            <button className="btn ghost" onClick={async () => confirmAsk(t('Programm mit allen Affiliates und Provisionen löschen?')) && (await act(() => api.del(`/api/affiliates/programs/${p.id}`), t('Gelöscht'))) && onSaved()}>
              {t('Löschen')}
            </button>
          )}
          <button className="btn secondary" onClick={onClose}>
            {t('Abbrechen')}
          </button>
          <button className="btn" onClick={save}>
            {t('Speichern')}
          </button>
        </>
      }
    >
      <Field label={t('Name')}>
        <Input value={f.name} onChange={(v) => set('name', v)} placeholder={t('z. B. Partnerprogramm 2026')} />
      </Field>
      <div className="grid3">
        <Field label={t('Provision')}>
          <Select
            value={f.commission_type}
            onChange={(v) => set('commission_type', v)}
            options={[
              ['percent', t('Prozent vom Nettoumsatz')],
              ['fixed', t('Festbetrag je Verkauf')],
            ]}
          />
        </Field>
        <Field label={f.commission_type === 'fixed' ? t('Betrag (€)') : t('Prozent')}>
          <Input value={f.value} onChange={(v) => set('value', v)} inputMode="decimal" />
        </Field>
        <Field label={t('Es zählt der')}>
          <Select
            value={f.attribution}
            onChange={(v) => set('attribution', v)}
            options={[
              ['last', t('letzte Klick')],
              ['first', t('erste Klick')],
            ]}
          />
        </Field>
        <Field label={t('Cookie-Laufzeit (Tage)')} hint={t('So alt darf der Klick beim Lead sein')}>
          <Input type="number" min={1} max={365} value={f.cookie_days} onChange={(v) => set('cookie_days', v)} />
        </Field>
        <Field label={t('Auszahlung ab (€)')}>
          <Input value={f.threshold} onChange={(v) => set('threshold', v)} inputMode="decimal" />
        </Field>
        <Field label={t('Haltefrist (Tage)')} hint={t('0 = Provisionen von Hand freigeben')}>
          <Input type="number" min={0} max={365} value={f.hold_days} onChange={(v) => set('hold_days', v)} />
        </Field>
      </div>
      <Field label={t('Ziel-Link der Partner-Links')} hint={t('leer = dein erster Funnel; ?ref=<code> wird angehängt')}>
        <Input value={f.landing_url} onChange={(v) => set('landing_url', v)} placeholder="https://…" />
      </Field>
      <Check checked={f.recurring} onChange={(v) => set('recurring', v)} label={t('Provision auch auf Abo-Verlängerungen (wiederkehrend)')} />
      <Check checked={f.public_signup} onChange={(v) => set('public_signup', v)} label={t('Öffentliche Anmeldung erlauben')} />
      <Check checked={f.auto_approve} onChange={(v) => set('auto_approve', v)} label={t('Neue Anmeldungen sofort freischalten')} />
      <Check checked={f.active} onChange={(v) => set('active', v)} label={t('Programm aktiv')} />
      <Field label={t('Bedingungen (auf der Anmeldeseite)')}>
        <Textarea value={f.terms} onChange={(v) => set('terms', v)} />
      </Field>
    </Modal>
  );
}

function Commissions() {
  const t = useT('affiliates');
  const [status, setStatus] = useState('pending');
  const [sel, setSel] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const list = useLoad(() => api.get<any[]>(`/api/affiliates/commissions${status ? `?status=${status}` : ''}`), [status]);
  const affiliates = useLoad(() => api.get<any[]>('/api/affiliates'), []);
  const rows = list.data ?? [];
  const reload = () => (setSel([]), list.reload());
  return (
    <>
      <div className="row" style={{ marginBottom: 12, alignItems: 'center' }} data-tour="affiliates-commissions">
        <div style={{ width: 200 }}>
          <Select
            value={status}
            onChange={(v) => (setStatus(v), setSel([]))}
            options={[
              ['pending', t('Offen')],
              ['approved', t('Freigegeben')],
              ['paid', t('Ausgezahlt')],
              ['reversed', t('Storniert')],
              ['', t('Alle')],
            ]}
          />
        </div>
        {sel.length > 0 && (
          <button className="btn" onClick={async () => (await act(() => api.post('/api/affiliates/commissions/approve', { ids: sel }), t('{n} freigegeben', { n: sel.length }))) && reload()}>
            {sel.length} {t('freigeben')}
          </button>
        )}
        <button className="btn secondary" onClick={() => setAdding(true)}>
          {t('+ Gutschrift / Korrektur')}
        </button>
      </div>
      {!list.data ? (
        <Spinner />
      ) : rows.length ? (
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th style={{ width: 30 }}>
                  {status === 'pending' && <input type="checkbox" aria-label={t('Alle wählen')} checked={sel.length === rows.length} onChange={(e) => setSel(e.target.checked ? rows.map((r) => r.id) : [])} />}
                </th>
                <th>{t('Datum')}</th>
                <th>{t('Affiliate')}</th>
                <th>{t('Kunde / Beleg')}</th>
                <th>{t('Art')}</th>
                <th className="num">{t('Umsatz netto')}</th>
                <th className="num">{t('Provision')}</th>
                <th>{t('Status')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>{c.status === 'pending' && <input type="checkbox" aria-label={t('Wählen')} checked={sel.includes(c.id)} onChange={(e) => setSel(e.target.checked ? [...sel, c.id] : sel.filter((x) => x !== c.id))} />}</td>
                  <td className="muted">{day(c.created_at)}</td>
                  <td>
                    {c.affiliate_name} <span className="muted small">({c.code})</span>
                  </td>
                  <td>
                    {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.customer_email || '–'}
                    <div className="muted small">{c.note}</div>
                  </td>
                  <td>{t(KIND[c.kind] ?? c.kind)}</td>
                  <td className="num">{c.base_cents ? money(c.base_cents, c.currency) : '–'}</td>
                  <td className="num">
                    <strong>{money(c.amount_cents, c.currency)}</strong>
                  </td>
                  <td>
                    <Badge tone={C_STATUS[c.status]?.[1]}>{t(C_STATUS[c.status]?.[0] ?? c.status)}</Badge>
                    {c.payout_id && c.status === 'approved' ? <span className="muted small"> {t('in Auszahlung')}</span> : null}
                  </td>
                  <td>
                    {['pending', 'approved'].includes(c.status) && !c.payout_id && (
                      <button className="btn small ghost" onClick={async () => confirmAsk(t('Provision stornieren?')) && (await act(() => api.post(`/api/affiliates/commissions/${c.id}/reverse`, {}), t('Storniert'))) && reload()}>
                        {t('Stornieren')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{t('Keine Provisionen in dieser Ansicht.')}</Empty>
      )}
      <p className="muted small">{t('Provisionen entstehen automatisch, wenn ein geworbener Kunde eine Rechnung bezahlt (auch über Stripe). Erstattungen und stornierte Rechnungen buchen sie zurück.')}</p>
      {adding && <ManualCommission affiliates={affiliates.data ?? []} onClose={() => setAdding(false)} onSaved={() => (setAdding(false), reload())} />}
    </>
  );
}

function ManualCommission({ affiliates, onClose, onSaved }: { affiliates: any[]; onClose: () => void; onSaved: () => void }) {
  const t = useT('affiliates');
  const [f, setF] = useState({ affiliate_id: affiliates[0]?.id ?? '', amount: '', note: '' });
  return (
    <Modal
      title={t('Gutschrift oder Korrektur')}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            {t('Abbrechen')}
          </button>
          <button className="btn" onClick={async () => (await act(() => api.post('/api/affiliates/commissions', { affiliate_id: f.affiliate_id, amount_cents: toCents(f.amount), note: f.note }), t('Gebucht'))) && onSaved()}>
            {t('Buchen')}
          </button>
        </>
      }
    >
      <Field label={t('Affiliate')}>
        <Select value={f.affiliate_id} onChange={(v) => setF({ ...f, affiliate_id: v })} options={affiliates.map((a) => [a.id, `${a.name || a.email} (${a.code})`] as [string, string])} />
      </Field>
      <Field label={t('Betrag (€)')} hint={t('negativ für eine Belastung, z. B. -25')}>
        <Input value={f.amount} onChange={(v) => setF({ ...f, amount: v })} inputMode="decimal" />
      </Field>
      <Field label={t('Grund')}>
        <Input value={f.note} onChange={(v) => setF({ ...f, note: v })} />
      </Field>
    </Modal>
  );
}

function Payouts() {
  const t = useT('affiliates');
  const list = useLoad(() => api.get<any[]>('/api/affiliates/payouts'), []);
  const [busy, setBusy] = useState(false);
  const rows = list.data ?? [];
  const open = rows.filter((o) => o.status === 'open');
  const loc = encodeURIComponent(currentLocation());
  return (
    <>
      <div className="actions" style={{ marginBottom: 12 }} data-tour="affiliates-payouts">
        <button
          className="btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await act(() => api.post('/api/affiliates/payouts', {}));
            setBusy(false);
            if (!r) return;
            toast(r.created.length ? t('{n} Auszahlung(en) erstellt', { n: r.created.length }) : r.skipped.length ? t('Noch niemand über der Auszahlungsgrenze ({n} darunter)', { n: r.skipped.length }) : t('Keine freigegebenen Provisionen'));
            list.reload();
          }}
        >
          <Icon name="price" /> {t('Auszahlungen erstellen')}
        </button>
        {open.length > 0 && (
          <>
            <a className="btn secondary" href={`/api/affiliates/payouts/export.csv?locationId=${loc}`}>
              <Icon name="download" /> {t('CSV (offen)')}
            </a>
            <a className="btn secondary" href={`/api/affiliates/payouts/sepa.xml?locationId=${loc}`}>
              <Icon name="download" /> {t('SEPA-Datei (offen)')}
            </a>
          </>
        )}
      </div>
      {!list.data ? (
        <Spinner />
      ) : rows.length ? (
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>{t('Erstellt')}</th>
                <th>{t('Affiliate')}</th>
                <th>{t('Verwendungszweck')}</th>
                <th>{t('Methode')}</th>
                <th className="num">{t('Betrag')}</th>
                <th>{t('Status')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td className="muted">{day(o.created_at)}</td>
                  <td>
                    {o.affiliate_name || o.email}
                    <div className="muted small">{o.commissions} {t('Provisionen')}</div>
                  </td>
                  <td className="small">
                    {o.reference} <Copy text={o.reference} label={t('Kopieren')} />
                  </td>
                  <td>
                    {o.method === 'paypal' ? 'PayPal' : 'SEPA'} {(o.method === 'paypal' ? !o.has_paypal : !o.has_iban) && <Badge tone="red">{t('Daten fehlen')}</Badge>}
                  </td>
                  <td className="num">
                    <strong>{money(o.amount_cents, o.currency)}</strong>
                  </td>
                  <td>
                    <Badge tone={C_STATUS[o.status]?.[1]}>{o.status === 'paid' ? `${t('ausgezahlt')} ${day(o.paid_at)}` : t('offen')}</Badge>
                  </td>
                  <td>
                    {o.status === 'open' && (
                      <div className="actions">
                        <button className="btn small" onClick={async () => (await act(() => api.post(`/api/affiliates/payouts/${o.id}/paid`, {}), t('Als ausgezahlt markiert'))) && list.reload()}>
                          {t('Ausgezahlt')}
                        </button>
                        <button className="btn small ghost" onClick={async () => confirmAsk(t('Auszahlung löschen? Die Provisionen bleiben freigegeben.')) && (await act(() => api.del(`/api/affiliates/payouts/${o.id}`), t('Gelöscht'))) && list.reload()}>
                          {t('Löschen')}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{t('Noch keine Auszahlungen. „Auszahlungen erstellen“ bündelt freigegebene Provisionen je Affiliate ab der Auszahlungsgrenze.')}</Empty>
      )}
      <p className="muted small">{t('Die SEPA-Datei (pain.001) lädst du im Online-Banking hoch; sie nutzt deine IBAN aus Einstellungen → Rechnungen. Danach die Auszahlungen als „Ausgezahlt“ markieren.')}</p>
    </>
  );
}
