import { useEffect, useState } from 'react';
import { Icon } from '../icons';
import { api, d, dt, money } from '../api';
import { useT } from '../i18n';
import { Badge, Check, Copy, Empty, Field, Input, Link, Modal, PageHead, Select, Spinner, Stat, Tabs, Textarea, act, confirmAsk, useLoad } from '../ui';
import { Callout, Facts, Fold, Item, Panel, StatusBadge, euroText, parseEuro } from './CreatorKit';
import { SortableGrid } from '../sortable/Sortable';

/**
 * Mahnwesen: failed subscription and instalment payments (cases, reminders with a link to the billing page, access pause),
 * overdue invoices (Zahlungserinnerung, 1. und 2. Mahnung with fees and default interest, approval or automatic) and the
 * billing page customers use to update their card. Docs: docs/dunning.md.
 */

const numList = (s: string) => [...new Set(s.split(/[\s,;]+/).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x >= 0))].sort((a, b) => a - b);
const listText = (a: number[] | undefined) => (a ?? []).join(', ');

// --- cases of failed subscription payments -------------------------------------------------------------------------------------

function CaseDialog({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const t = useT('dunning');
  const { data, reload } = useLoad(() => api.get(`/api/dunning/cases/${id}`), [id]);
  if (!data)
    return (
      <Modal title={t('Zahlungsausfall')} onClose={onClose}>
        <Spinner />
      </Modal>
    );
  const c = data;
  const run = async (path: string, ok: string, body: any = {}) => {
    if (await act(() => api.post(`/api/dunning/cases/${id}/${path}`, body), ok)) {
      reload();
      onChanged();
    }
  };
  const live = c.status === 'open' || c.status === 'failed';
  return (
    <Modal
      title={t('Zahlungsausfall')}
      wide
      onClose={onClose}
      footer={
        live ? (
          <>
            <button className="btn secondary" onClick={() => run('remind', t('Erinnerung gesendet'))} data-tour="case-remind">
              {t('Erinnerung senden')}
            </button>
            {c.stripe_invoice && (
              <button className="btn secondary" onClick={() => run('retry', t('Zahlung erneut versucht'))}>
                {t('Jetzt erneut einziehen')}
              </button>
            )}
            {c.contact?.id && c.product_id && (
              <button className="btn secondary" onClick={() => run('access', c.access_paused ? t('Zugang fortgesetzt') : t('Zugang pausiert'), { on: !!c.access_paused })}>
                {c.access_paused ? t('Zugang fortsetzen') : t('Zugang pausieren')}
              </button>
            )}
            <button
              className="btn secondary"
              onClick={() => {
                const reason = window.prompt(t('Warum schließt du den Fall? (z. B. „hat per Überweisung bezahlt“)'), '');
                if (reason !== null) void run('close', t('Fall geschlossen'), { reason });
              }}
            >
              {t('Fall schließen')}
            </button>
          </>
        ) : undefined
      }
    >
      <Facts
        rows={[
          [t('Kontakt'), c.contact?.id ? <Link to={`contacts/${c.contact.id}`}>{c.contact.name || t('Kontakt öffnen')}</Link> : t('nicht zugeordnet')],
          [t('Produkt'), c.product_name],
          [t('Betrag'), money(c.amount_cents, c.currency)],
          [t('Status'), <StatusBadge key="s" status={c.status} />],
          [t('Versuche'), c.attempts],
          [t('Erster Fehlschlag'), dt(c.first_failed_at)],
          [t('Nächster Versuch'), c.next_attempt_at ? dt(c.next_attempt_at) : ''],
          [t('Zugang'), c.access_paused ? t('pausiert') : t('aktiv')],
          [t('Grund'), c.reason],
          [t('Wieder bezahlt'), c.recovered_at ? dt(c.recovered_at) : ''],
          [t('Geschlossen'), c.closed_reason],
        ]}
      />
      <h4 style={{ margin: '16px 0 8px' }}>{t('Verlauf')}</h4>
      <div className="cr-list">
        {c.events.map((e: any, i: number) => (
          <Item key={i}>
            <strong>{t(EVENT_LABEL[e.kind] ?? e.kind)}</strong> <span className="muted small">{dt(e.at)}</span>
            {e.detail && <div className="cr-sub">{e.detail}</div>}
          </Item>
        ))}
        {!c.events.length && <p className="muted">{t('Noch keine Einträge.')}</p>}
      </div>
    </Modal>
  );
}
const EVENT_LABEL: Record<string, string> = { opened: 'Fall eröffnet', failed: 'Zahlung fehlgeschlagen', reminder: 'Erinnerung gesendet', retry: 'Erneut versucht', final: 'Endgültig fehlgeschlagen', recovered: 'Wieder bezahlt', closed: 'Geschlossen', access_off: 'Zugang pausiert', access_on: 'Zugang fortgesetzt', card_updated: 'Karte aktualisiert' };

function BillingLinkDialog({ onClose }: { onClose: () => void }) {
  const t = useT('dunning');
  const [q, setQ] = useState('');
  const [found, setFound] = useState<any[]>([]);
  const [pick, setPick] = useState<any>(null);
  const [link, setLink] = useState<{ url: string; expires_at: string; sent?: string } | null>(null);
  useEffect(() => {
    if (q.trim().length < 2) return setFound([]);
    const timer = setTimeout(() => api.get(`/api/contacts?q=${encodeURIComponent(q.trim())}&limit=6`).then((r) => setFound(r.contacts ?? r ?? [])).catch(() => {}), 250);
    return () => clearTimeout(timer);
  }, [q]);
  const make = async (send?: 'email' | 'sms') => {
    const r = await act(() => api.post('/api/dunning/billing-link', { contact_id: pick.id, ...(send ? { send } : {}) }), send ? t('Gesendet') : undefined);
    if (r) setLink(r);
  };
  return (
    <Modal title={t('Link zur Abo-Verwaltung')} onClose={onClose}>
      <p className="cr-hint">{t('Der Link führt zu einer Seite, auf der die Person Zahlungsmethode, Rechnungen und Abo selbst verwaltet – ohne Login. Er gilt nur für diese Person und läuft ab.')}</p>
      {!pick ? (
        <>
          <Field label={t('Kontakt suchen')}>
            <Input value={q} onChange={setQ} placeholder={t('Name oder E-Mail')} autoFocus />
          </Field>
          <div className="cr-list">
            {found.map((c: any) => (
              <Item key={c.id} onClick={() => setPick(c)}>
                <strong>{[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email}</strong>
                <div className="cr-sub">{c.email}</div>
              </Item>
            ))}
          </div>
        </>
      ) : (
        <>
          <Item side={<button className="btn small secondary" onClick={() => (setPick(null), setLink(null))}>{t('Ändern')}</button>}>
            <strong>{[pick.first_name, pick.last_name].filter(Boolean).join(' ') || pick.email}</strong>
            <div className="cr-sub">{pick.email}</div>
          </Item>
          <div className="actions" style={{ margin: '12px 0' }}>
            <button className="btn" onClick={() => make()}>
              {t('Link erzeugen')}
            </button>
            <button className="btn secondary" onClick={() => make('email')} disabled={!pick.email}>
              {t('Per E-Mail senden')}
            </button>
            <button className="btn secondary" onClick={() => make('sms')} disabled={!pick.phone}>
              {t('Per SMS senden')}
            </button>
          </div>
          {link && (
            <Callout tone="info">
              <p>
                <span className="cr-code">{link.url}</span> <Copy text={link.url} />
              </p>
              <p className="small muted">{t('Gültig bis {date}.', { date: d(link.expires_at) })}{link.sent ? t(' Gesendet per {channel}.', { channel: link.sent === 'email' ? t('E-Mail') : t('SMS') }) : ''}</p>
            </Callout>
          )}
        </>
      )}
    </Modal>
  );
}

function CasesTab({ overview, reloadOverview }: { overview: any; reloadOverview: () => void }) {
  const t = useT('dunning');
  const [status, setStatus] = useState('live');
  const cases = useLoad(() => api.get<any[]>('/api/dunning/cases?limit=200'), []);
  const [open, setOpen] = useState('');
  const [linking, setLinking] = useState(false);
  const list = (cases.data ?? []).filter((c) => (status === 'live' ? c.status === 'open' || c.status === 'failed' : status === 'all' ? true : c.status === status));
  const o = overview?.cases;
  return (
    <>
      <SortableGrid id="dunning-stats" className="stats" data-tour="dunning-stats">
        <Stat label={t('Offene Fälle')} value={o?.open ?? '–'} sub={t('Stripe versucht es noch')} />
        <Stat label={t('Endgültig gescheitert')} value={o?.failed ?? '–'} sub={o?.failed ? t('Zugang laut Einstellung pausiert') : undefined} />
        <Stat label={t('Gefährdeter Umsatz')} value={o ? money(o.at_risk_cents) : '–'} />
        <Stat label={t('In 30 Tagen zurückgeholt')} value={o ? `${o.recovered_30d} · ${money(o.recovered_cents)}` : '–'} />
      </SortableGrid>
      {overview && !overview.stripe.connected && (
        <Callout tone="warn">
          <strong>{t('Stripe ist nicht verbunden.')}</strong> {t('Ohne Stripe-Webhook sieht das Mahnwesen keine Zahlungsausfälle. Verbinde Stripe unter ')}<Link to="settings/stripe">{t('Einstellungen → Stripe')}</Link>{t('; die nötigen Ereignisse stehen in der Anleitung.')}
        </Callout>
      )}
      {overview && overview.stripe.connected && !overview.settings.sub_enabled && <Callout tone="warn">{t('Das Mahnwesen für Abo-Zahlungen ist ausgeschaltet (Reiter Einstellungen).')}</Callout>}
      <Panel
        title={t('Zahlungsausfälle bei Abos und Raten')}
        sub={t('Wer zahlt nicht? Jeder Fall bekommt Erinnerungen mit einem Link, über den die Person ihre Karte selbst aktualisiert.')}
        wide
        tour="dunning-cases"
        actions={
          <>
            <Select value={status} onChange={setStatus} options={[['live', t('Offen und gescheitert')], ['recovered', t('Wieder bezahlt')], ['closed', t('Geschlossen')], ['all', t('Alle')]]} />
            <button className="btn secondary" data-tour="dunning-link" onClick={() => setLinking(true)}>
              <Icon name="link" /> {t('Abo-Link erzeugen')}
            </button>
          </>
        }
      >
        {cases.loading && !cases.data ? (
          <Spinner />
        ) : list.length ? (
          <div className="cr-list">
            {list.map((c) => (
              <Item
                key={c.id}
                tone={c.status === 'failed' ? 'bad' : c.status === 'open' ? 'warn' : c.status === 'recovered' ? 'ok' : undefined}
                onClick={() => setOpen(c.id)}
                side={
                  <>
                    <StatusBadge status={c.status} />
                    {c.access_paused && <Badge tone="yellow">{t('Zugang pausiert')}</Badge>}
                  </>
                }
              >
                <strong>{c.contact?.name || t('Kontakt unbekannt')}</strong> · {c.product_name || t('Abo')} · {money(c.amount_cents, c.currency)}
                <div className="cr-sub">
                  {t('Seit {date} · {attempts} Versuch{plural}', { date: d(c.first_failed_at), attempts: c.attempts, plural: c.attempts === 1 ? '' : 'e' })}
                  {c.next_attempt_at ? t(' · nächster {date}', { date: dt(c.next_attempt_at) }) : ''}
                  {c.reason ? t(' · {reason}', { reason: c.reason }) : ''}
                </div>
              </Item>
            ))}
          </div>
        ) : (
          <Empty>{status === 'live' ? t('Keine offenen Zahlungsausfälle – gut so.') : t('Keine Fälle in dieser Ansicht.')}</Empty>
        )}
      </Panel>
      {open && <CaseDialog id={open} onClose={() => setOpen('')} onChanged={() => (cases.reload(), reloadOverview())} />}
      {linking && <BillingLinkDialog onClose={() => setLinking(false)} />}
    </>
  );
}

// --- overdue invoices ----------------------------------------------------------------------------------------------------------

function NoticeDialog({ notice, onClose, onChanged }: { notice: any; onClose: () => void; onChanged: () => void }) {
  const t = useT('dunning');
  const [subject, setSubject] = useState(notice.subject);
  const [body, setBody] = useState(notice.body);
  const live = notice.status === 'pending' || notice.status === 'failed';
  const dirty = subject !== notice.subject || body !== notice.body;
  const done = (ok: string) => () => {
    onChanged();
    onClose();
    return ok;
  };
  const send = async () => {
    if (dirty && !(await act(() => api.patch(`/api/dunning/notices/${notice.id}`, { subject, body })))) return;
    if (await act(() => api.post(`/api/dunning/notices/${notice.id}/send`), t('Mahnung gesendet'))) done('')();
  };
  return (
    <Modal
      title={`${notice.label} · ${t('Rechnung')} ${notice.invoice_number}`}
      wide
      onClose={onClose}
      footer={
        <>
          <a className="btn secondary" href={notice.pdf_url} target="_blank" rel="noreferrer">
            {t('PDF ansehen')}
          </a>
          {live && (
            <>
              <button className="btn secondary" onClick={async () => (await act(() => api.post(`/api/dunning/notices/${notice.id}/dismiss`), t('Verworfen'))) && done('')()}>
                {t('Verwerfen')}
              </button>
              <button className="btn" data-tour="notice-send" onClick={send}>
                {dirty ? t('Speichern und senden') : t('Jetzt senden')}
              </button>
            </>
          )}
          {notice.status === 'sent' && (
            <button className="btn secondary" onClick={async () => confirmAsk(t('Dieselbe Mahnung noch einmal senden?')) && (await act(() => api.post(`/api/dunning/notices/${notice.id}/resend`), t('Erneut gesendet'))) && done('')()}>
              {t('Erneut senden')}
            </button>
          )}
        </>
      }
    >
      <Facts
        rows={[
          [t('Kontakt'), notice.contact?.name],
          [t('Status'), <StatusBadge key="s" status={notice.status} />],
          [t('Rechnung'), money(notice.principal_cents, notice.currency)],
          [t('Mahngebühren früherer Schreiben'), notice.prior_fee_cents ? money(notice.prior_fee_cents, notice.currency) : ''],
          [t('Mahngebühr'), notice.fee_cents ? money(notice.fee_cents, notice.currency) : ''],
          [t('Verzugszinsen'), notice.interest_cents ? `${money(notice.interest_cents, notice.currency)} (${String(notice.interest_rate).replace('.', ',')} % p. a.)` : ''],
          [t('Pauschale (§ 288 Abs. 5 BGB)'), notice.flat_fee_cents ? money(notice.flat_fee_cents, notice.currency) : ''],
          [t('Gesamt'), <strong key="t">{money(notice.total_cents, notice.currency)}</strong>],
          [t('Zahlungsfrist'), notice.deadline_at ? d(notice.deadline_at) : ''],
          [t('Tage überfällig'), notice.days_overdue],
          [t('Gesendet'), notice.sent_at ? dt(notice.sent_at) : ''],
          [t('Fehler'), notice.error],
        ]}
      />
      <Field label={t('Betreff')}>
        <Input value={subject} onChange={setSubject} disabled={!live} maxLength={300} />
      </Field>
      <Field label={t('Text')} hint={t('Beträge und Frist stehen im PDF; der Text darf angepasst werden.')}>
        <Textarea value={body} onChange={setBody} disabled={!live} rows={12} />
      </Field>
    </Modal>
  );
}

function InvoicesTab({ overview, reloadOverview, goSettings }: { overview: any; reloadOverview: () => void; goSettings: () => void }) {
  const t = useT('dunning');
  const pending = useLoad(() => api.get<any[]>('/api/dunning/notices?status=pending&limit=100'), []);
  const sent = useLoad(() => api.get<any[]>('/api/dunning/notices?status=sent&limit=30'), []);
  const invoices = useLoad(() => api.get<any[]>('/api/dunning/invoices'), []);
  const [open, setOpen] = useState<any>(null);
  const [preview, setPreview] = useState<{ due: any[] } | null>(null);
  const mode = overview?.settings.invoice_mode ?? 'off';
  const refresh = () => {
    pending.reload();
    sent.reload();
    invoices.reload();
    reloadOverview();
  };
  const check = async () => {
    const r = await act(() => api.post('/api/dunning/run', { dry_run: true }));
    if (r) setPreview(r);
  };
  const prepare = async (inv: any, now: boolean) => {
    if (now && !confirmAsk(t('Die nächste Mahnung zu Rechnung {number} jetzt an {name} senden?', { number: inv.number, name: inv.contact.name }))) return;
    if (await act(() => api.post(`/api/dunning/invoices/${inv.id}/notice`, { send: now }), now ? t('Mahnung gesendet') : t('Entwurf liegt zur Freigabe bereit'))) refresh();
  };
  const hold = async (inv: any, on: boolean) => {
    const reason = on ? window.prompt(t('Grund für den Mahnstopp (z. B. „Zahlungsvereinbarung“)'), '') : '';
    if (reason === null) return;
    if (await act(() => api.post(`/api/dunning/invoices/${inv.id}/hold`, { on, reason }), on ? t('Mahnstopp gesetzt') : t('Mahnstopp aufgehoben'))) refresh();
  };
  return (
    <>
      <Callout tone={mode === 'off' ? 'warn' : 'info'} tour="dunning-mode">
        {mode === 'off' && (
          <>
            <strong>{t('Das Rechnungs-Mahnwesen ist aus.')}</strong>{t(' Es verschickt nichts, bis du es einschaltest – zuerst mit Freigabe, später gern automatisch. ')}
          </>
        )}
        {mode === 'approval' && (
          <>
            <strong>{t('Mit Freigabe:')}</strong>{t(' Fällige Mahnungen warten hier, bis du sie prüfst und sendest. ')}
          </>
        )}
        {mode === 'auto' && (
          <>
            <strong>{t('Automatisch:')}</strong>{t(' Fällige Mahnungen gehen sofort raus. Mahnstopp pro Rechnung ist möglich. ')}
          </>
        )}
        <button className="btn small secondary" onClick={goSettings}>
          {t('Einstellungen')}
        </button>{' '}
        <button className="btn small secondary" onClick={check} data-tour="dunning-check">
          {t('Jetzt prüfen (Trockenlauf)')}
        </button>
      </Callout>
      <div className="cr-panels two">
        <Panel title={t('Wartet auf Freigabe')} sub={t('Prüfen, Text anpassen, senden oder verwerfen.')} tour="dunning-approval">
          {pending.data?.length ? (
            <div className="cr-list">
              {pending.data.map((n) => (
                <Item key={n.id} tone="warn" onClick={() => setOpen(n)} side={<strong>{money(n.total_cents, n.currency)}</strong>}>
                  <strong>{n.label}</strong> · {t('Rechnung')} {n.invoice_number}
                  <div className="cr-sub">
                    {n.contact?.name} · {t('{days} Tage überfällig · ', { days: n.days_overdue })}
                  </div>
                </Item>
              ))}
            </div>
          ) : (
            <Empty>{t('Nichts zur Freigabe.')}</Empty>
          )}
        </Panel>
        <Panel title={t('Überfällige Rechnungen')} sub={t('Offene Rechnungen mit abgelaufener Frist.')} tour="dunning-invoices">
          {invoices.data?.length ? (
            <div className="cr-list">
              {invoices.data.map((inv) => (
                <Item
                  key={inv.id}
                  tone={inv.held ? undefined : inv.level >= 2 ? 'bad' : 'warn'}
                  side={
                    <>
                      {inv.held ? (
                        <button className="btn small secondary" onClick={() => hold(inv, false)}>
                          {t('Mahnstopp aufheben')}
                        </button>
                      ) : (
                        <>
                          {inv.next_label && inv.last_status !== 'pending' && (
                            <button className="btn small secondary" onClick={() => prepare(inv, false)}>
                              {t('Entwurf: {label}', { label: inv.next_label })}
                            </button>
                          )}
                          {inv.next_label && inv.last_status !== 'pending' && (
                            <button className="btn small" onClick={() => prepare(inv, true)}>
                              {t('Jetzt senden')}
                            </button>
                          )}
                          <button className="btn small secondary" onClick={() => hold(inv, true)}>
                            {t('Mahnstopp')}
                          </button>
                        </>
                      )}
                    </>
                  }
                >
                  <strong>{inv.number}</strong> · {inv.contact.name} · {money(inv.total_cents, inv.currency)}
                  <div className="cr-sub">
                    {t('{days} Tage überfällig · ', { days: inv.days_overdue })}
                    {inv.last_status === 'pending'
                      ? t('{level} wartet auf Freigabe', { level: inv.level_label })
                      : `${t('Stand: {level}', { level: inv.level_label })}${inv.next_label ? t(' · als Nächstes {next} ({total})', { next: inv.next_label, total: money(inv.next_total_cents, inv.currency) }) : t(' · alle Stufen durch')}`}
                    {inv.held ? t(' · Mahnstopp') : ''}
                  </div>
                </Item>
              ))}
            </div>
          ) : (
            <Empty>{t('Keine überfälligen Rechnungen.')}</Empty>
          )}
        </Panel>
        <Panel title={t('Zuletzt gesendet')} wide>
          {sent.data?.length ? (
            <div className="cr-list">
              {sent.data.map((n) => (
                <Item key={n.id} onClick={() => setOpen(n)} side={<StatusBadge status={n.status} />}>
                  <strong>{n.label}</strong> · {t('Rechnung')} {n.invoice_number} · {n.contact?.name}
                  <div className="cr-sub">
                    {dt(n.sent_at)} · {money(n.total_cents, n.currency)}
                  </div>
                </Item>
              ))}
            </div>
          ) : (
            <Empty>{t('Noch keine Mahnung gesendet.')}</Empty>
          )}
        </Panel>
      </div>
      {open && <NoticeDialog notice={open} onClose={() => setOpen(null)} onChanged={refresh} />}
      {preview && (
        <Modal title={t('Trockenlauf')} onClose={() => setPreview(null)}>
          <p className="cr-hint">{t('So würde das Mahnwesen jetzt arbeiten – es wurde nichts verschickt oder angelegt.')}</p>
          {preview.due.length ? (
            <div className="cr-list">
              {preview.due.map((n: any) => (
                <Item key={n.invoice_id} tone={n.held ? undefined : 'warn'}>
                  <strong>{n.label}</strong> · {t('Rechnung')} {n.number}
                  <div className="cr-sub">
                    {t('{days} Tage überfällig · ', { days: n.days_overdue })}{money(n.total_cents ?? 0)}
                    {n.held ? t(' · Mahnstopp – wird übersprungen') : ''}
                  </div>
                </Item>
              ))}
            </div>
          ) : (
            <Empty>{t('Es ist aktuell keine Mahnung fällig.')}</Empty>
          )}
        </Modal>
      )}
    </>
  );
}

// --- the billing page: what customers may do ----------------------------------------------------------------------------------

function BillingTab() {
  const t = useT('dunning');
  const products = useLoad(() => api.get<any[]>('/api/dunning/products'), []);
  const [linking, setLinking] = useState(false);
  const save = async (p: any, patch: any) => {
    if (await act(() => api.put(`/api/dunning/products/${p.id}`, patch), t('Gespeichert'))) products.reload();
  };
  return (
    <>
      <Callout tone="info" tour="billing-intro">
        {t('Kunden verwalten ihr Abo auf einer eigenen Seite: Zahlungsmethode ändern, Rechnungen ansehen, pausieren, kündigen oder den Tarif wechseln – ohne Login, über einen persönlichen Link. Der Link kommt in den Mahn-E-Mails, im Mitgliederbereich (Abschnitt „Mein Abo“) und von dir per Knopfdruck. Hier legst du pro Abo fest, was erlaubt ist. ')}
        <button className="btn small secondary" onClick={() => setLinking(true)}>
          {t('Link erzeugen')}
        </button>
      </Callout>
      <Panel title={t('Abos und was Kunden tun dürfen')} wide tour="billing-products">
        {products.loading && !products.data ? (
          <Spinner />
        ) : products.data?.length ? (
          <div className="cr-list">
            {products.data.map((p) => (
              <Item key={p.id}>
                <strong>{p.name}</strong> <span className="muted">· {money(p.price_cents, p.currency)} / {p.recurring === 'year' ? t('Jahr') : t('Monat')}</span>
                <div className="cr-form-row" style={{ marginTop: 10 }}>
                  <Check checked={p.allow_cancel} onChange={(v) => save(p, { allow_cancel: v })} label={t('Kündigen erlaubt')} />
                  <Check checked={p.allow_pause} onChange={(v) => save(p, { allow_pause: v })} label={t('Pausieren erlaubt')} />
                  <Field label={t('Kündigung wirkt')}>
                    <Select value={p.cancel_mode} onChange={(v) => save(p, { cancel_mode: v })} options={[['period_end', t('zum Ende der bezahlten Zeit')], ['now', t('sofort')]]} />
                  </Field>
                </div>
                {products.data!.length > 1 && (
                  <Field label={t('Tarifwechsel erlauben zu')} hint={t('Nur andere aktive Abos in derselben Währung.')}>
                    <div className="cr-chips">
                      {products.data!
                        .filter((x) => x.id !== p.id && x.currency === p.currency)
                        .map((x) => {
                          const on = p.switch_to.includes(x.id);
                          return (
                            <button key={x.id} type="button" className="cr-chip" aria-pressed={on} style={on ? { background: 'var(--brand-soft)', borderColor: 'var(--brand)' } : undefined} onClick={() => save(p, { switch_to: on ? p.switch_to.filter((y: string) => y !== x.id) : [...p.switch_to, x.id] })}>
                              {on ? '✓ ' : ''}
                              {x.name}
                            </button>
                          );
                        })}
                    </div>
                  </Field>
                )}
              </Item>
            ))}
          </div>
        ) : (
          <Empty action={<Link to="products" className="btn">{t('Zu den Produkten')}</Link>}>{t('Noch kein Abo-Produkt. Lege ein Produkt mit monatlicher oder jährlicher Zahlung an.')}</Empty>
        )}
      </Panel>
      {linking && <BillingLinkDialog onClose={() => setLinking(false)} />}
    </>
  );
}

// --- settings -----------------------------------------------------------------------------------------------------------------------

function SettingsTab() {
  const t = useT('dunning');
  const { data, reload } = useLoad(() => api.get('/api/dunning/settings'), []);
  const [s, setS] = useState<any>(null);
  useEffect(() => {
    if (data) setS(JSON.parse(JSON.stringify(data.settings)));
  }, [data]);
  if (!s) return <Spinner />;
  const sub = s.sub;
  const inv = s.inv;
  const setSub = (p: any) => setS({ ...s, sub: { ...sub, ...p } });
  const setInv = (p: any) => setS({ ...s, inv: { ...inv, ...p } });
  const setLevel = (i: number, p: any) => setInv({ levels: inv.levels.map((l: any, j: number) => (j === i ? { ...l, ...p } : l)) });
  const save = async () => {
    const r = await act(() => api.put('/api/dunning/settings', s), t('Einstellungen gespeichert'));
    if (r) {
      setS(r.settings);
      reload();
    }
  };
  const reset = (part: 'sub' | 'inv') => confirmAsk(t('Auf die Standardwerte zurücksetzen?')) && setS({ ...s, [part]: JSON.parse(JSON.stringify(data.defaults[part])) });
  return (
    <>
      <div className="cr-panels two">
        <Panel title={t('Abo- und Raten-Zahlungen')} sub={t('Was passiert, wenn eine Zahlung nicht durchgeht.')} tour="dunning-settings-sub" actions={<button className="btn small secondary" onClick={() => reset('sub')}>{t('Standard')}</button>}>
          <Check checked={sub.enabled} onChange={(v) => setSub({ enabled: v })} label={t('Mahnwesen für Abo-Zahlungen aktiv')} />
          <Field label={t('Wiederholte Einzugsversuche')} hint={sub.retry_mode === 'stripe' ? t('Stripe wiederholt selbst (Smart Retries). Stelle Anzahl und Zeitraum im Stripe-Dashboard unter Einstellungen → Abos und E-Mails → Fehlgeschlagene Zahlungen ein.') : t('HyperLevel zieht die offene Rechnung an den angegebenen Tagen selbst erneut ein. Schalte dann die Stripe-Wiederholungen aus.')}>
            <Select value={sub.retry_mode} onChange={(v) => setSub({ retry_mode: v })} options={[['stripe', t('Stripe (Smart Retries)')], ['own', t('HyperLevel (eigene Tage)')]]} />
          </Field>
          {sub.retry_mode === 'own' && (
            <Field label={t('Versuche an Tag … nach dem Fehlschlag')} hint={t('Zahlen mit Komma, z. B. 1, 3, 5, 7')}>
              <Input value={listText(sub.retry_days)} onChange={(v) => setSub({ retry_days: numList(v) })} />
            </Field>
          )}
          <Field label={t('Erinnerungen an Tag … (0 = sofort)')} hint={t('E-Mail mit dem Link zur Abo-Verwaltung. Zahlen mit Komma, z. B. 0, 3, 7')}>
            <Input value={listText(sub.reminder_days)} onChange={(v) => setSub({ reminder_days: numList(v) })} />
          </Field>
          <Check checked={sub.send_sms} onChange={(v) => setSub({ send_sms: v })} label={t('Zusätzlich per SMS erinnern')} />
          <div className="cr-form-row">
            <Field label={t('Zugang pausieren nach … Tagen')} hint={t('0 = erst wenn Stripe aufgibt')}>
              <Input type="number" min={0} max={90} value={sub.final_after_days} onChange={(v) => setSub({ final_after_days: Math.max(0, Number(v) || 0) })} />
            </Field>
            <Field label={t('Wenn endgültig gescheitert')}>
              <Select value={sub.access_on_final} onChange={(v) => setSub({ access_on_final: v })} options={[['pause', t('Zugang pausieren')], ['keep', t('Zugang behalten')]]} />
            </Field>
          </div>
          <Check checked={sub.cancel_on_final} onChange={(v) => setSub({ cancel_on_final: v })} label={t('Abo dann auch bei Stripe kündigen')} />
          <div className="cr-form-row">
            <Field label={t('Karte aktualisieren über')}>
              <Select value={sub.billing_method} onChange={(v) => setSub({ billing_method: v })} options={[['setup', t('HyperLevel-Seite + Stripe Checkout')], ['portal', t('Stripe-Kundenportal')]]} />
            </Field>
            <Field label={t('Link gültig (Tage)')}>
              <Input type="number" min={1} max={90} value={sub.link_days} onChange={(v) => setSub({ link_days: Math.max(1, Number(v) || 30) })} />
            </Field>
          </div>
          <Fold title={t('Texte der E-Mails und SMS')}>
            {/* i18n-ignore */}
            <p className="cr-hint">Platzhalter: {'{{dunning.url}}'}, {'{{dunning.amount}}'}, {'{{dunning.product}}'}, {'{{dunning.days_left}}'}, {'{{contact.first_name|}}'}, {'{{location.name}}'}</p>
            {(
              [
                ['email', t('Erste Nachricht')],
                ['reminder', t('Erinnerung')],
                ['final', t('Zugang pausiert')],
              ] as const
            ).map(([k, label]) => (
              <div key={k}>
                <Field label={`${label}: ${t('Betreff')}`}>
                  <Input value={sub[`${k}_subject`]} onChange={(v) => setSub({ [`${k}_subject`]: v })} maxLength={300} />
                </Field>
                <Field label={`${label}: ${t('Text')}`}>
                  <Textarea value={sub[`${k}_body`]} onChange={(v) => setSub({ [`${k}_body`]: v })} rows={7} />
                </Field>
              </div>
            ))}
            <Field label={t('SMS-Text')}>
              <Textarea value={sub.sms_body} onChange={(v) => setSub({ sms_body: v })} rows={3} />
            </Field>
          </Fold>
        </Panel>
        <Panel title={t('Rechnungen: Erinnerung und Mahnungen')} sub={t('Stufen, Gebühren und Verzugszinsen für überfällige Rechnungen.')} tour="dunning-settings-inv" actions={<button className="btn small secondary" onClick={() => reset('inv')}>{t('Standard')}</button>}>
          <Field label={t('Betrieb')} hint={t('Start mit Freigabe: nichts geht raus, ohne dass du es gesehen hast.')}>
            <Select value={inv.mode} onChange={(v) => setInv({ mode: v })} options={[['off', t('Aus')], ['approval', t('Mit Freigabe')], ['auto', t('Automatisch senden')]]} />
          </Field>
          <div className="cr-form-row">
            <Field label={t('Mindestabstand zwischen zwei Schreiben (Tage)')}>
              <Input type="number" min={1} max={60} value={inv.min_gap_days} onChange={(v) => setInv({ min_gap_days: Math.max(1, Number(v) || 7) })} />
            </Field>
            <Field label={t('Nur Rechnungen ab (€)')} hint={t('Kleinbeträge nicht mahnen – zählt der noch offene Betrag')}>
              <Input inputMode="decimal" value={euroText(inv.min_amount_cents)} onChange={(v) => setInv({ min_amount_cents: parseEuro(v) ?? 0 })} />
            </Field>
          </div>
          <Check checked={inv.sms} onChange={(v) => setInv({ sms: v })} label={t('Zusätzlich per SMS hinweisen')} />
          <h4 style={{ margin: '14px 0 8px' }}>{t('Stufen')}</h4>
          {inv.levels.map((l: any, i: number) => (
            <Fold key={l.key} title={`${i + 1}. ${l.label} – ${l.days} ${t('Tage nach Fälligkeit')}${l.fee_cents ? `, ${money(l.fee_cents)} ${t('Mahngebühr')}` : ''}`}>
              <Field label={t('Bezeichnung')}>
                <Input value={l.label} onChange={(v) => setLevel(i, { label: v })} maxLength={80} />
              </Field>
              <div className="cr-form-row">
                <Field label={t('Tage nach Fälligkeit')}>
                  <Input type="number" min={1} max={365} value={l.days} onChange={(v) => setLevel(i, { days: Math.max(1, Number(v) || 1) })} />
                </Field>
                <Field label={t('Mahngebühr (€)')}>
                  <Input inputMode="decimal" value={euroText(l.fee_cents)} onChange={(v) => setLevel(i, { fee_cents: parseEuro(v) ?? 0 })} />
                </Field>
                <Field label={t('Zahlungsfrist (Tage)')}>
                  <Input type="number" min={1} max={60} value={l.deadline_days} onChange={(v) => setLevel(i, { deadline_days: Math.max(1, Number(v) || 7) })} />
                </Field>
              </div>
              <Field label={t('Betreff')}>
                <Input value={l.subject} onChange={(v) => setLevel(i, { subject: v })} maxLength={300} />
              </Field>
              {/* i18n-ignore */}
              <Field label={t('Text')} hint="Platzhalter: {{invoice.number}}, {{invoice.total}}, {{invoice.due}}, {{invoice.url}}, {{notice.total}}, {{notice.fee}}, {{notice.prior_fees}}, {{notice.fees}}, {{notice.deadline}}, {{notice.pdf_url}}">
                <Textarea value={l.body} onChange={(v) => setLevel(i, { body: v })} rows={9} />
              </Field>
            </Fold>
          ))}
          <Check checked={inv.carry_fees !== false} onChange={(v) => setInv({ carry_fees: v })} label={t('Mahngebühren früherer Schreiben in späteren Mahnungen mitfordern')} />
          <p className="muted small" style={{ margin: '2px 0 0 24px' }}>{t('Die 2. Mahnung nennt dann die noch offene Gebühr der 1. Mahnung und fordert sie mit. Ausschalten, wenn die Gebühr jeder Stufe schon die Summe bis dahin ist.')}</p>
          <h4 style={{ margin: '14px 0 8px' }}>{t('Verzugszinsen (§ 288 BGB)')}</h4>
          <Check checked={inv.interest.enabled} onChange={(v) => setInv({ interest: { ...inv.interest, enabled: v } })} label={t('Verzugszinsen berechnen')} />
          {inv.interest.enabled && (
            <>
              <div className="cr-form-row">
                <Field label={t('Basiszinssatz (% p. a.)')} hint={t('Bundesbank – ändert sich am 1. Januar und 1. Juli. Bitte aktuell halten.')}>
                  <Input inputMode="decimal" value={String(inv.interest.base_rate).replace('.', ',')} onChange={(v) => setInv({ interest: { ...inv.interest, base_rate: Number(v.replace(',', '.')) || 0 } })} />
                </Field>
                <Field label={t('Aufschlag Verbraucher (%)')} hint={t('gesetzlich 5')}>
                  <Input inputMode="decimal" value={String(inv.interest.b2c_margin).replace('.', ',')} onChange={(v) => setInv({ interest: { ...inv.interest, b2c_margin: Number(v.replace(',', '.')) || 0 } })} />
                </Field>
                <Field label={t('Aufschlag Unternehmen (%)')} hint={t('gesetzlich 9')}>
                  <Input inputMode="decimal" value={String(inv.interest.b2b_margin).replace('.', ',')} onChange={(v) => setInv({ interest: { ...inv.interest, b2b_margin: Number(v.replace(',', '.')) || 0 } })} />
                </Field>
              </div>
              <div className="cr-form-row">
                <Field label={t('Kunde gilt als')}>
                  <Select value={inv.interest.customer_type} onChange={(v) => setInv({ interest: { ...inv.interest, customer_type: v } })} options={[['auto', t('automatisch (Firma am Kontakt = Unternehmen)')], ['b2c', t('immer Verbraucher')], ['b2b', t('immer Unternehmen')]]} />
                </Field>
                <Field label={t('Zinsen ab Stufe')}>
                  <Select value={String(inv.interest.from_level)} onChange={(v) => setInv({ interest: { ...inv.interest, from_level: Number(v) } })} options={inv.levels.map((l: any, i: number) => [String(i + 1), `${i + 1}. ${l.label}`] as [string, string])} />
                </Field>
              </div>
              <div className="cr-form-row">
                <Field label={t('Pauschale bei Unternehmen (€)')} hint={t('§ 288 Abs. 5 BGB: 40 €, nur gegenüber Unternehmen')}>
                  <Input inputMode="decimal" value={euroText(inv.b2b_flat_fee_cents)} onChange={(v) => setInv({ b2b_flat_fee_cents: parseEuro(v) ?? 0 })} />
                </Field>
                <Field label={t('Pauschale ab Stufe')}>
                  <Select value={String(inv.flat_fee_from_level)} onChange={(v) => setInv({ flat_fee_from_level: Number(v) })} options={inv.levels.map((l: any, i: number) => [String(i + 1), `${i + 1}. ${l.label}`] as [string, string])} />
                </Field>
              </div>
            </>
          )}
          <Callout tone="warn">{t('Das ist keine Rechtsberatung. Gebühren und Zinsen müssen zum Vertrag passen; bei Verbrauchern sind Mahngebühren nur in der Höhe der tatsächlichen Kosten zulässig.')}</Callout>
        </Panel>
      </div>
      <div className="actions" style={{ marginTop: 14 }}>
        <button className="btn" data-tour="dunning-save" onClick={save}>
          {t('Einstellungen speichern')}
        </button>
      </div>
    </>
  );
}

export function Dunning({ tab: tabParam }: { tab?: string }) {
  const t = useT('dunning');
  const [tab, setTab] = useState(['cases', 'invoices', 'billing', 'settings'].includes(tabParam ?? '') ? tabParam! : 'cases');
  const overview = useLoad(() => api.get('/api/dunning/overview'), []);
  const pending = overview.data?.notices.pending ?? 0;
  return (
    <div className="cr cr-dunning">
      <PageHead title={t('Mahnwesen')} sub={t('Zahlungsausfälle bei Abos und Raten auffangen, überfällige Rechnungen freundlich und rechtssicher nachfassen – und Kunden ihr Abo selbst verwalten lassen.')}>
        <Link to="payment-plans" className="btn secondary">
          {t('Ratenzahlung')}
        </Link>
      </PageHead>
      <Tabs
        tabs={[
          ['cases', t('Zahlungsausfälle')],
          ['invoices', t('Rechnungen{pending}', { pending: pending ? ` (${pending})` : '' })],
          ['billing', t('Abo-Verwaltung')],
          ['settings', t('Einstellungen')],
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'cases' && <CasesTab overview={overview.data} reloadOverview={overview.reload} />}
      {tab === 'invoices' && <InvoicesTab overview={overview.data} reloadOverview={overview.reload} goSettings={() => setTab('settings')} />}
      {tab === 'billing' && <BillingTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  );
}
