import { useEffect, useState } from 'react';
import { api, d, dt, money } from '../api';
import { Icon } from '../icons';
import { act, Badge, Check, confirmAsk, Empty, Field, Input, Modal, navigate, PageHead, pressable, Select, Spinner, Stat, Tabs, Textarea, toast, useLoad } from '../ui';
import { Disclaimer, EuroInput, FileButton, dlHref, euroText, germanDate, parseEuro, signedMoney, ymdLocal } from './boCommon';
import { AccountsTab, BankTab, ExportTab, ReportsTab, SettingsTab } from './AccountingMore';
import { useT } from '../i18n';
import { SortableGrid } from '../sortable/Sortable';

/**
 * Buchhaltung light – Vorbereitung für den Steuerberater (docs/backoffice.md). Not certified software, no GoBD certification,
 * no ELSTER. Tabs: overview, receipts, journal, bank, reports, export & period lock, chart of accounts, settings.
 */

// TABS definition moved or ignored
// i18n-ignore

export function Accounting({ tab }: { tab?: string }) {
  const t = useT('finops');
  const TABS: [string, string][] = [
    ['overview', t('Übersicht')],
    ['receipts', t('Belege')],
    ['entries', t('Buchungen')],
    ['bank', t('Bank')],
    ['reports', t('Auswertungen')],
    ['export', t('Export & Festschreibung')],
    ['accounts', t('Konten')],
    ['settings', t('Einstellungen')],
  ];
  const currentTab = TABS.some(([k]) => k === tab) ? tab! : 'overview';
  const status = useLoad(() => api.get('/api/accounting/status'), []);
  const accounts = useLoad(() => (status.data?.enabled ? api.get('/api/accounting/accounts?active=1') : Promise.resolve([])), [status.data?.enabled]);
  const st = status.data;
  if (!st) return status.error ? <p style={{ color: 'var(--red)' }}>{status.error}</p> : <Spinner />;
  const reload = () => void status.reload();
  if (!st.enabled) return <Setup st={st} onDone={reload} />;
  const c = st.counts ?? {};
  const label = (k: string, l: string) => (k === 'receipts' && c.receipts_inbox ? `${t(l)} (${c.receipts_inbox})` : k === 'bank' && c.bank_open ? `${t(l)} (${c.bank_open})` : t(l));
  const subText = `${t('Buchhaltung light, Vorbereitung für den Steuerberater')} · ${st.standard.toUpperCase()}${st.vat_mode === 'small' ? ` · ${t('Kleinunternehmer')}` : ''}`;
  return (
    <>
      <PageHead title={t('Buchhaltung')} sub={subText} />
      <Disclaimer compact={currentTab !== 'overview'} text={st.disclaimer} />
      <Tabs tabs={TABS.map(([k, l]) => [k, label(k, l)])} value={currentTab} onChange={(v) => navigate(`accounting/${v}`)} />
      <datalist id="acc-accounts">
        {(accounts.data ?? []).map((a: any) => (
          <option key={a.number} value={a.number}>
            {a.name}
          </option>
        ))}
      </datalist>
      {currentTab === 'overview' && <Overview st={st} />}
      {currentTab === 'receipts' && <Receipts accounts={accounts.data ?? []} onChange={reload} />}
      {currentTab === 'entries' && <Entries accounts={accounts.data ?? []} lockedThrough={st.locked_through} />}
      {currentTab === 'bank' && <BankTab accounts={accounts.data ?? []} onChange={reload} />}
      {currentTab === 'reports' && <ReportsTab />}
      {currentTab === 'export' && <ExportTab st={st} onChange={reload} />}
      {currentTab === 'accounts' && <AccountsTab onChange={() => void accounts.reload()} />}
      {currentTab === 'settings' && <SettingsTab onChange={reload} />}
    </>
  );
}

function Setup({ st, onDone }: { st: any; onDone: () => void }) {
  const t = useT('finops');
  const [standard, setStandard] = useState('skr03');
  const [vat, setVat] = useState(st.invoice_small_business ? 'small' : 'regular');
  return (
    <>
      <PageHead title={t('Buchhaltung')} sub={t('Belege sammeln, Buchungen vorbereiten, Auswertungen und DATEV-Export für den Steuerberater.')} />
      <Disclaimer text={st.disclaimer} />
      <div className="card" style={{ maxWidth: 620 }} data-tour="acc-setup">
        <h2>{t('Buchhaltung einrichten')}</h2>
        <p className="muted">
          {t('Beim Einrichten wird der Kontenrahmen angelegt. Er lässt sich bis zur ersten Buchung noch wechseln. Rechnungen und Zahlungen aus HyperLevel werden danach automatisch gebucht (in den Einstellungen abschaltbar).')}
        </p>
        <div className="grid2">
          <Field label={t('Kontenrahmen')} hint={t('Frag deinen Steuerberater, womit er arbeitet. SKR03 ist in kleinen Betrieben am häufigsten.')}>
            <Select value={standard} onChange={setStandard} options={[['skr03', 'SKR03 (Prozessgliederung)'], ['skr04', 'SKR04 (Abschlussgliederung)']]} />
          </Field>
          <Field label={t('Umsatzsteuer')} hint={st.invoice_small_business ? t('In den Rechnungs-Einstellungen ist Kleinunternehmer eingetragen.') : undefined}>
            <Select value={vat} onChange={setVat} options={[['regular', 'Regelbesteuerung (19 % / 7 %)'], ['small', 'Kleinunternehmer (§ 19 UStG)']]} />
          </Field>
        </div>
        <button className="btn" onClick={async () => (await act(() => api.post('/api/accounting/setup', { standard, vat_mode: vat }), t('Buchhaltung eingerichtet'))) && onDone()}>
          {t('Einrichten')}
        </button>
      </div>
    </>
  );
}

// --- overview ---------------------------------------------------------------------------------------------------------------

function Overview({ st }: { st: any }) {
  const t = useT('finops');
  const year = new Date().getFullYear();
  const sum = useLoad(() => api.get(`/api/accounting/summary?from=${year}-01-01&to=${year}-12-31`), []);
  const audit = useLoad(() => api.get('/api/accounting/audit?limit=12'), []);
  const [verify, setVerify] = useState<any>();
  const s = sum.data;
  const c = st.counts;
  return (
    <>
      <SortableGrid id="acc-stats" className="stats" data-tour="acc-stats">
        <Stat label={t('Erträge {year}', { year })} value={money(s?.income_cents ?? 0)} sub={t('netto, nach Buchungsdatum')} />
        <Stat label={t('Aufwand {year}', { year })} value={money(s?.expenses_cents ?? 0)} />
        <Stat label={t('Ergebnis')} value={signedMoney(s?.result_cents ?? 0)} sub={t('{count} Buchungen', { count: s?.entries ?? 0 })} />
        <Stat label={t('Offene Forderungen')} value={money(s?.open_receivables_cents ?? 0)} />
        <Stat label={t('Offene Verbindlichkeiten')} value={money(s?.open_payables_cents ?? 0)} />
      </SortableGrid>
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="card grow" data-tour="acc-todo">
          <h2>{t('Zu erledigen')}</h2>
          <ul className="bo-list">
            <li>
              <a href="#" onClick={(e) => (e.preventDefault(), navigate('accounting/receipts'))}>
                <Icon name="inbox" /> {c.receipts_inbox} {c.receipts_inbox === 1 ? t('Beleg wartet') : t('Belege warten')} {t('auf Prüfung')}
              </a>
            </li>
            <li>
              <a href="#" onClick={(e) => (e.preventDefault(), navigate('accounting/bank'))}>
                <Icon name="bank" /> {c.bank_open} {t('Bankumsätze ohne Buchung')}
              </a>
            </li>
            <li>
              <Icon name="lock" /> {t('Festgeschrieben bis:')} <strong>{st.locked_through ? `${st.locked_through.slice(5, 7)}/${st.locked_through.slice(0, 4)}` : t('noch nichts')}</strong>
            </li>
            <li>
              <Icon name="download" /> {t('DATEV:')} {st.datev_ready ? t('Berater- und Mandantennummer sind eingetragen') : t('Berater-/Mandantennummer fehlen noch (Einstellungen)')}
            </li>
          </ul>
        </div>
        <div className="card grow" data-tour="acc-verify">
          <h2>{t('Integrität')}</h2>
          <p className="muted small">{t('Buchungen sind unveränderbar und verkettet (SHA-256). Die Prüfung rechnet die Kette nach und meldet den ersten Bruch.')}</p>
          <div className="row" style={{ alignItems: 'center' }}>
            <button className="btn secondary" onClick={async () => setVerify(await act(() => api.get('/api/accounting/verify')))}>
              <Icon name="ok" /> {t('Kette prüfen')}
            </button>
            <button className="btn secondary" title={t('Rechnungen, Zahlungen und Stripe-Auszahlungen nachbuchen, falls etwas fehlt')} onClick={async () => (await act(() => api.post('/api/accounting/autopost/run'), t('Nachgebucht'))) && (void sum.reload(), void audit.reload())}>
              <Icon name="refresh" /> {t('Automatik nachholen')}
            </button>
          </div>
          {verify && (
            <p className={verify.ok ? 'bo-ok' : 'bo-bad'}>
              {verify.ok ? t('In Ordnung: {entries} Buchungen und {receipts} archivierte Belege geprüft.', { entries: verify.checked, receipts: verify.documents }) : t('Bruch in der Kette bei {entry}: {error}', { entry: verify.broken_at, error: verify.reason })}
            </p>
          )}
        </div>
      </div>
      {!!s?.top_expenses?.length && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h2>{t('Größte Kostenarten')} {year}</h2>
          <div className="bo-scroll"><table className="t">
            <tbody>
              {s.top_expenses.map((e: any) => (
                <tr key={e.account}>
                  <td className="mono">{e.account}</td>
                  <td>{e.name}</td>
                  <td className="num">{money(e.cents)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
      <div className="card" data-tour="acc-audit">
        <h2>{t('Änderungsprotokoll')}</h2>
        <p className="muted small">{t('Wer hat wann was getan – unveränderbar, wird nie gelöscht.')}</p>
        {(audit.data ?? []).length ? (
          <div className="bo-scroll"><table className="t">
            <tbody>
              {(audit.data as any[]).map((a) => (
                <tr key={a.id}>
                  <td className="muted small" style={{ whiteSpace: 'nowrap' }}>{dt(a.at)}</td>
                  <td>{a.actor}</td>
                  <td>
                    <Badge>{a.action}</Badge>
                  </td>
                  <td className="muted">{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : (
          <Empty>{t('Noch keine Einträge.')}</Empty>
        )}
      </div>
    </>
  );
}

// --- receipts -------------------------------------------------------------------------------------------------------------

const getRStatus = (t: any): Record<string, [string, 'gray' | 'green' | 'red' | 'blue' | 'yellow']> => ({ inbox: [t('Neu'), 'blue'], review: [t('Zu prüfen'), 'yellow'], booked: [t('Gebucht'), 'green'], discarded: [t('Verworfen'), 'gray'] });
const getMethod = (t: any): Record<string, string> => ({ xrechnung: 'E-Rechnung (exakt gelesen)', zugferd: 'ZUGFeRD (exakt gelesen)', ai: t('KI gelesen – bitte prüfen'), manual: t('von Hand') });

function Receipts({ accounts, onChange }: { accounts: any[]; onChange: () => void }) {
  const t = useT('finops');
  const R_STATUS = getRStatus(t);
  const [filter, setFilter] = useState('open');
  const [open, setOpen] = useState<string>();
  const list = useLoad(() => api.get(`/api/accounting/receipts?status=${filter === 'all' ? '' : filter}`), [filter]);
  const rows: any[] = list.data ?? [];
  // The AI reads in the background: look again shortly after an upload.
  const later = () => setTimeout(() => void list.reload(), 3500);
  return (
    <>
      <div className="row" style={{ marginBottom: 12, alignItems: 'center' }}>
        <FileButton label={t('Beleg hochladen')} accept="application/pdf,image/*,.xml,text/xml" multiple secondary={false} tour="acc-upload" onFile={async (f) => (await api.post('/api/accounting/receipts', { name: f.name, data: f.data }), void list.reload(), later(), onChange())} />
        <div className="tabs" style={{ margin: 0, border: 0 }} data-tour="acc-receipt-filter">
          {[['open', t('Offen')], ['booked', t('Gebucht')], ['discarded', t('Verworfen')], ['all', t('Alle')]].map(([k, l]) => (
            <button key={k} className={k === filter ? 'on' : ''} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <p className="muted small">
        {t('PDF, Foto (auch vom Handy), XRechnung oder ZUGFeRD. Jede Datei wird sofort mit Prüfsumme archiviert und nie verändert. E-Rechnungen werden exakt ausgelesen, Fotos und PDFs von der KI (wenn eine Verbindung mit Bilderkennung eingerichtet ist) – sonst trägst du die Werte von Hand ein.')}
      </p>
      {list.loading && !list.data ? (
        <Spinner />
      ) : rows.length ? (
        <div className="table-wrap" data-tour="acc-receipt-list">
          <table className="t">
            <thead>
              <tr>
                <th>Status</th>
                <th>{t('Lieferant')}</th>
                <th>{t('Rechnung')}</th>
                <th>{t('Datum')}</th>
                <th className="num">{t('Brutto')}</th>
                <th>{t('Konto')}</th>
                <th>{t('Eingang')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="click" {...pressable(() => setOpen(r.id))}>
                  <td>
                    <Badge tone={R_STATUS[r.status]?.[1]}>{R_STATUS[r.status]?.[0] ?? r.status}</Badge>
                  </td>
                  <td>
                    <strong>{r.supplier || <span className="muted">{r.doc_name}</span>}</strong>
                  </td>
                  <td>{r.invoice_no || '–'}</td>
                  <td>{germanDate(r.invoice_date)}</td>
                  <td className="num">{r.gross_cents === null ? '–' : money(r.gross_cents)}</td>
                  <td className="mono">{r.account || '–'}</td>
                  <td className="muted small">
                    {{ upload: t('Upload'), mobile: t('Handy'), email: t('E-Mail') }[r.source as string] ?? r.source}, {d(r.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{filter === 'open' ? t('Keine offenen Belege – lade einen hoch oder leite Rechnungen per E-Mail weiter (Einstellungen).') : t('Nichts gefunden.')}</Empty>
      )}
      {open && <ReceiptEditor id={open} accounts={accounts} onClose={() => (setOpen(undefined), void list.reload(), onChange())} />}
    </>
  );
}

function ReceiptEditor({ id, accounts, onClose }: { id: string; accounts: any[]; onClose: () => void }) {
  const t = useT('finops');
  const R_STATUS = getRStatus(t);
  const METHOD = getMethod(t);
  const r = useLoad(() => api.get(`/api/accounting/receipts/${id}`), [id]);
  const [f, setF] = useState<any>();
  useEffect(() => {
    const x = r.data;
    if (x && !f)
      setF({
        supplier: x.supplier ?? '',
        invoice_no: x.invoice_no ?? '',
        invoice_date: x.invoice_date ?? '',
        due_date: x.due_date ?? '',
        net: euroText(x.net_cents),
        vat: euroText(x.vat_cents),
        gross: euroText(x.gross_cents),
        vat_rate: x.vat_rate === null || x.vat_rate === undefined ? '19' : String(x.vat_rate),
        reverse_charge: !!x.reverse_charge,
        credit_note: !!x.credit_note,
        account: x.account ?? '',
        payment: x.payment || 'open',
        note: x.note ?? '',
      });
  }, [r.data]);
  const x = r.data;
  if (!x || !f) return <Modal title={t('Beleg')} onClose={onClose}>{r.error ? <p style={{ color: 'var(--red)' }}>{r.error}</p> : <Spinner />}</Modal>;
  const locked = x.status === 'booked' || x.status === 'discarded';
  const set = (k: string) => (v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const body = () => ({
    supplier: f.supplier,
    invoice_no: f.invoice_no,
    invoice_date: f.invoice_date || null,
    due_date: f.due_date || null,
    net_cents: parseEuro(f.net),
    vat_cents: parseEuro(f.vat),
    gross_cents: parseEuro(f.gross),
    vat_rate: Number(f.vat_rate),
    reverse_charge: f.reverse_charge,
    credit_note: f.credit_note,
    account: f.account,
    payment: f.payment,
    note: f.note,
  });
  const save = () => act(() => api.patch(`/api/accounting/receipts/${id}`, body()));
  const ex = x.extraction ?? {};
  const accountName = accounts.find((a) => a.number === f.account)?.name;
  return (
    <Modal
      wide
      title={x.document?.name ?? t('Beleg')}
      onClose={onClose}
      footer={
        <>
          {!locked && (
            <button className="btn ghost danger-text" onClick={async () => confirmAsk(t('Beleg verwerfen? Die Datei bleibt archiviert.')) && (await act(() => api.post(`/api/accounting/receipts/${id}/discard`, {}), t('Verworfen'))) && onClose()}>
              {t('Verwerfen')}
            </button>
          )}
          <span style={{ flex: 1 }} />
          {!locked && (
            <>
              <button className="btn secondary" onClick={async () => (await save()) && toast(t('Gespeichert'))}>
                {t('Speichern')}
              </button>
              <button
                className="btn"
                data-tour="acc-book"
                onClick={async () => {
                  if (!(await save())) return;
                  if (await act(() => api.post(`/api/accounting/receipts/${id}/book`, { account: f.account, payment: f.payment }), t('Gebucht'))) onClose();
                }}
              >
                {t('Buchen')}
              </button>
            </>
          )}
          {locked && <button className="btn secondary" onClick={onClose}>{t('Schließen')}</button>}
        </>
      }
    >
      <div className="row" style={{ marginBottom: 10, alignItems: 'center' }}>
        <Badge tone={R_STATUS[x.status]?.[1]}>{R_STATUS[x.status]?.[0]}</Badge>
        {ex.method && <Badge tone={ex.method === 'ai' ? 'yellow' : 'green'}>{METHOD[ex.method] ?? ex.method}</Badge>}
        {x.document && (
          <a className="btn small secondary" href={dlHref(x.document.url)} target="_blank" rel="noreferrer">
            <Icon name="external" /> {t('Original ansehen')}
          </a>
        )}
        {x.document?.sha256 && <span className="mono muted" title={t('SHA-256 der archivierten Datei')}>{t('SHA-256')} {x.document.sha256.slice(0, 16)}…</span>}
        {!locked && (
          <button className="btn small secondary" onClick={async () => (await act(() => api.post(`/api/accounting/receipts/${id}/extract`, { overwrite: true }))) && (setF(undefined), void r.reload())}>
            <Icon name="ai" /> {t('Neu auslesen')}
          </button>
        )}
      </div>
      {(ex.warnings ?? []).map((w: string) => (
        <p key={w} className="bo-warn">{w}</p>
      ))}
      {ex.note && <p className="muted small">{ex.note}</p>}
      {x.entry && (
        <p className="bo-ok">
          {t('Gebucht als')} {x.entry.number} {t('vom')} {germanDate(x.entry.date)}{t('. Zum Ändern die Buchung unter „Buchungen“ stornieren.')}
        </p>
      )}
      <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="grid2">
          <Field label={t('Lieferant')}>
            <Input value={f.supplier} onChange={set('supplier')} />
          </Field>
          <Field label={t('Rechnungsnummer')}>
            <Input value={f.invoice_no} onChange={set('invoice_no')} />
          </Field>
          <Field label={t('Rechnungsdatum')}>
            <Input type="date" value={f.invoice_date} onChange={set('invoice_date')} />
          </Field>
          <Field label={t('Fällig am')}>
            <Input type="date" value={f.due_date} onChange={set('due_date')} />
          </Field>
        </div>
        <div className="grid3">
          <Field label={t('Netto (€)')}>
            <EuroInput value={f.net} onChange={set('net')} />
          </Field>
          <Field label={t('Steuer (€)')}>
            <EuroInput value={f.vat} onChange={set('vat')} />
          </Field>
          <Field label={t('Brutto (€)')}>
            <EuroInput value={f.gross} onChange={set('gross')} />
          </Field>
        </div>
        <div className="grid3">
          <Field label={t('Steuersatz')}>
            <Select value={f.vat_rate} onChange={set('vat_rate')} options={[['19', '19 %'], ['7', '7 %'], ['0', t('0 % / ohne')]]} />
          </Field>
          <Field label={t('Konto (Aufwand / Anlage)')} hint={accountName}>
            <Input list="acc-accounts" value={f.account} onChange={set('account')} placeholder={t('z. B. 4980')} />
          </Field>
          <Field label={t('Bezahlt')}>
            <Select value={f.payment} onChange={set('payment')} options={[['open', t('Noch offen (Verbindlichkeit)')], ['bank', t('Per Bank')], ['cash', t('Bar (Kasse)')], ['private', t('Privat ausgelegt')]]} />
          </Field>
        </div>
        <div className="row">
          <Check checked={f.reverse_charge} onChange={set('reverse_charge')} label={t('Reverse Charge (§ 13b UStG) – Betrag ist netto, Steuer schuldet der Empfänger')} />
          <Check checked={f.credit_note} onChange={set('credit_note')} label={t('Gutschrift des Lieferanten')} />
        </div>
        <Field label={t('Notiz')}>
          <Textarea value={f.note} onChange={set('note')} rows={2} />
        </Field>
      </fieldset>
    </Modal>
  );
}

// --- journal --------------------------------------------------------------------------------------------------------------

const getSources = (t: any): Record<string, string> => ({ manual: t('Von Hand'), invoice: t('Rechnung'), payment: t('Zahlung'), receipt: t('Beleg'), bank: t('Bank'), stripe: 'Stripe', opening: t('Eröffnung'), storno: t('Storno') });

function Entries({ accounts, lockedThrough }: { accounts: any[]; lockedThrough: string | null }) {
  const t = useT('finops');
  const SOURCES = getSources(t);
  const year = new Date().getFullYear();
  const [q, setQ] = useState('');
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(`${year}-12-31`);
  const [source, setSource] = useState('');
  const [modal, setModal] = useState<{ kind: 'new' } | { kind: 'view' | 'storno'; entry: any }>();
  const qs = new URLSearchParams({ from, to, ...(q ? { q } : {}), ...(source ? { source } : {}), limit: '200' }).toString();
  const list = useLoad(() => api.get(`/api/accounting/entries?${qs}`), [qs]);
  const rows: any[] = list.data?.entries ?? [];
  const acc = (n: string) => accounts.find((a) => a.number === n)?.name ?? '';
  const done = () => (setModal(undefined), void list.reload());
  return (
    <>
      <div className="row" style={{ alignItems: 'flex-end', marginBottom: 8 }}>
        <div style={{ width: 200 }}>
          <Field label={t('Suche')}>
            <Input value={q} onChange={setQ} placeholder={t('Text, Beleg, Nummer')} />
          </Field>
        </div>
        <div style={{ width: 150 }}>
          <Field label={t('Von')}>
            <Input type="date" value={from} onChange={setFrom} />
          </Field>
        </div>
        <div style={{ width: 150 }}>
          <Field label={t('Bis')}>
            <Input type="date" value={to} onChange={setTo} />
          </Field>
        </div>
        <div style={{ width: 150 }}>
          <Field label={t('Quelle')}>
            <Select value={source} onChange={setSource} placeholder={t('Alle')} options={Object.entries(SOURCES).filter(([k]) => k !== 'storno')} />
          </Field>
        </div>
        <div style={{ marginLeft: 'auto', marginBottom: 12, display: 'flex', gap: 8 }}>
          <a className="btn secondary" data-tour="acc-journal-csv" href={dlHref('/api/accounting/reports/journal.csv', { from, to })}>
            <Icon name="download" /> {t('Journal (CSV)')}
          </a>
          <button className="btn" data-tour="acc-new-entry" onClick={() => setModal({ kind: 'new' })}>
            {t('Neue Buchung')}
          </button>
        </div>
      </div>
      {list.loading && !list.data ? (
        <Spinner />
      ) : rows.length ? (
        <div className="table-wrap" data-tour="acc-entries">
          <table className="t">
            <thead>
              <tr>
                <th>{t('Nr.')}</th>
                <th>{t('Datum')}</th>
                <th>{t('Text')}</th>
                <th>{t('Beleg')}</th>
                <th>{t('Soll / Haben')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="click" {...pressable(() => setModal({ kind: 'view', entry: e }))}>
                  <td className="mono">{e.number}</td>
                  <td>{germanDate(e.date)}</td>
                  <td>
                    <strong>{e.text}</strong>
                    <div className="muted small">
                      {SOURCES[e.source] ?? e.source}
                      {e.party_name ? ` · ${e.party_name}` : ''} {e.reverses_id && <Badge tone="purple">{t('Storno')}</Badge>} {e.reversed_by && <Badge tone="red">storniert</Badge>}
                    </div>
                  </td>
                  <td>{e.doc_ref || '–'}</td>
                  <td className="small">
                    {e.lines.filter((l: any) => !l.is_tax).map((l: any, i: number) => (
                      <div key={i} className="mono" title={acc(l.account)}>
                        {l.side === 'S' ? 'S' : 'H'} {l.account} {money(l.cents)}
                      </div>
                    ))}
                  </td>
                  <td onClick={(ev) => ev.stopPropagation()}>
                    {!e.reversed_by && !e.reverses_id && (
                      <button className="btn small secondary" onClick={() => setModal({ kind: 'storno', entry: e })}>
                        {t('Storno')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{t('Keine Buchungen im Zeitraum.')}</Empty>
      )}
      {list.data && list.data.total > rows.length && <p className="muted small">{rows.length} {t('von')} {list.data.total} {t('Buchungen – Zeitraum oder Suche eingrenzen.')}</p>}
      {modal?.kind === 'new' && <NewEntry accounts={accounts} lockedThrough={lockedThrough} onClose={() => setModal(undefined)} onDone={done} />}
      {modal?.kind === 'view' && <EntryView entry={modal.entry} accounts={accounts} onClose={() => setModal(undefined)} />}
      {modal?.kind === 'storno' && <StornoModal entry={modal.entry} onClose={() => setModal(undefined)} onDone={done} />}
    </>
  );
}

function NewEntry({ accounts, lockedThrough, onClose, onDone }: { accounts: any[]; lockedThrough: string | null; onClose: () => void; onDone: () => void }) {
  const t = useT('finops');
  const codes = useLoad(() => api.get('/api/accounting/tax-codes'), []);
  const [f, setF] = useState({ date: ymdLocal(), text: '', doc_ref: '' });
  const [rows, setRows] = useState([{ debit: '', credit: '', amount: '', tax_code: 'none', text: '' }]);
  const upd = (i: number, k: string, v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const name = (n: string) => accounts.find((a) => a.number === n)?.name ?? '';
  return (
    <Modal
      wide
      title={t('Neue Buchung')}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>{t('Abbrechen')}</button>
          <button
            className="btn"
            onClick={async () => {
              const postings = rows.map((r) => ({ debit: r.debit, credit: r.credit, amount_cents: parseEuro(r.amount), tax_code: r.tax_code, text: r.text }));
              if (await act(() => api.post('/api/accounting/entries', { ...f, postings }), t('Gebucht'))) onDone();
            }}
          >
            {t('Buchen')}
          </button>
        </>
      }
    >
      <p className="muted small">
        {t('Eine Buchung ist danach unveränderbar – Fehler korrigierst du mit einer Storno-Buchung.')}{lockedThrough ? ` ${t('Bis {date} ist festgeschrieben.', { date: `${lockedThrough.slice(5, 7)}/${lockedThrough.slice(0, 4)}` })}` : ''}
      </p>
      <div className="grid3">
        <Field label={t('Buchungsdatum')}>
          <Input type="date" value={f.date} onChange={(v) => setF({ ...f, date: v })} />
        </Field>
        <Field label={t('Buchungstext')}>
          <Input value={f.text} onChange={(v) => setF({ ...f, text: v })} placeholder={t('z. B. Büromaterial')} />
        </Field>
        <Field label={t('Belegnummer')}>
          <Input value={f.doc_ref} onChange={(v) => setF({ ...f, doc_ref: v })} />
        </Field>
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>{t('Soll')}</th>
              <th>{t('Haben')}</th>
              <th>{t('Betrag (€, brutto)')}</th>
              <th>{t('Steuer')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>
                  <Input list="acc-accounts" value={r.debit} onChange={(v) => upd(i, 'debit', v)} placeholder={t('Konto')} />
                  <div className="muted small">{name(r.debit)}</div>
                </td>
                <td>
                  <Input list="acc-accounts" value={r.credit} onChange={(v) => upd(i, 'credit', v)} placeholder={t('Konto')} />
                  <div className="muted small">{name(r.credit)}</div>
                </td>
                <td>
                  <EuroInput value={r.amount} onChange={(v) => upd(i, 'amount', v)} />
                </td>
                <td>
                  <Select value={r.tax_code} onChange={(v) => upd(i, 'tax_code', v)} options={(codes.data ?? [{ code: 'none', label: t('ohne Steuer') }]).map((c: any) => [c.code, c.label] as [string, string])} />
                </td>
                <td>
                  {rows.length > 1 && (
                    <button className="icon-btn" aria-label={t('Zeile entfernen')} onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn small secondary" style={{ marginTop: 8 }} onClick={() => setRows((r) => [...r, { debit: '', credit: '', amount: '', tax_code: 'none', text: '' }])}>
        {t('+ Zeile')}
      </button>
      <p className="muted small">
        {t('Steuerschlüssel: bei Umsatz- und Vorsteuer-Schlüsseln ist der Betrag der Bruttobetrag, die Steuer wird herausgerechnet und auf die Steuerkonten gebucht (Reverse Charge: Betrag netto). Die Buchung muss ausgeglichen sein – das prüft das System.')}
      </p>
    </Modal>
  );
}

function EntryView({ entry, accounts, onClose }: { entry: any; accounts: any[]; onClose: () => void }) {
  const t = useT('finops');
  const SOURCES = getSources(t);
  const name = (n: string) => accounts.find((a) => a.number === n)?.name ?? '';
  return (
    <Modal wide title={t('Buchung {number}', { number: entry.number })} onClose={onClose}>
      <div className="grid2">
        <p>
          <strong>{entry.text}</strong>
          <br />
          <span className="muted">{germanDate(entry.date)} {t('· Beleg')} {entry.doc_ref || '–'} · {SOURCES[entry.source] ?? entry.source}</span>
        </p>
        <p className="small muted">
          {entry.reverses_id && <>{t('Storno zu einer früheren Buchung.')}<br /></>}
          {entry.reversed_by && <>{t('Diese Buchung wurde storniert.')}<br /></>}
          {t('Erfasst')} {dt(entry.created_at)}
        </p>
      </div>
      <table className="t">
        <thead>
          <tr>
            <th>{t('Konto')}</th>
            <th className="num">{t('Soll')}</th>
            <th className="num">{t('Haben')}</th>
            <th>{t('Steuer')}</th>
          </tr>
        </thead>
        <tbody>
          {entry.lines.map((l: any, i: number) => (
            <tr key={i}>
              <td>
                <span className="mono">{l.account}</span> {name(l.account)} {l.is_tax ? <Badge>{t('Steuer')}</Badge> : null}
              </td>
              <td className="num">{l.side === 'S' ? money(l.cents) : ''}</td>
              <td className="num">{l.side === 'H' ? money(l.cents) : ''}</td>
              <td className="muted small">{l.tax_code !== 'none' ? l.tax_code : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {entry.document_id && (
        <p>
          <a href={dlHref(`/api/accounting/documents/${entry.document_id}`)} target="_blank" rel="noreferrer">
            <Icon name="external" /> {t('Archivierter Beleg')}
          </a>
        </p>
      )}
      <p className="mono muted small" title={t('Jede Buchung trägt den Hash der vorherigen – so fällt jede Änderung auf.')}>
        {t('Hash')} {t('{hash} · vorher {previous}', { hash: entry.hash?.slice(0, 24) + '…', previous: entry.prev_hash ? `${entry.prev_hash.slice(0, 12)}…` : '–' })}
      </p>
    </Modal>
  );
}

function StornoModal({ entry, onClose, onDone }: { entry: any; onClose: () => void; onDone: () => void }) {
  const t = useT('finops');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(ymdLocal());
  return (
    <Modal
      title={t('Buchung {number} stornieren', { number: entry.number })}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>{t('Abbrechen')}</button>
          <button className="btn danger" onClick={async () => (await act(() => api.post(`/api/accounting/entries/${entry.id}/storno`, { reason, date }), t('Storniert'))) && onDone()}>
            {t('Stornieren')}
          </button>
        </>
      }
    >
      <p>
        <strong>{entry.text}</strong> {t('wird nicht gelöscht: Es entsteht eine Gegenbuchung (Soll und Haben vertauscht), beide bleiben im Journal sichtbar.')}
      </p>
      <Field label={t('Datum der Storno-Buchung')} hint={t('In einem festgeschriebenen Monat ist das nicht möglich – dann bitte im laufenden Monat.')}>
        <Input type="date" value={date} onChange={setDate} />
      </Field>
      <Field label={t('Grund')}>
        <Input value={reason} onChange={setReason} placeholder={t('z. B. falsches Konto')} />
      </Field>
    </Modal>
  );
}
