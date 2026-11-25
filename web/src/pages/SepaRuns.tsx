import { useEffect, useMemo, useState } from 'react';
import { api, dt, money } from '../api';
import { Badge, Check, Empty, Field, Input, Modal, Select, Spinner, Textarea, act, confirmAsk, useLoad } from '../ui';
import { Callout, Facts, Item, Panel, euroText, openAuthed, parseEuro } from './CreatorKit';
import { useT } from '../i18n';

/**
 * The run builder (open invoices → preview with groups and totals → draft run with pre-notification), the history with
 * submit / download / paid / return, and the transfer files (supplier invoices of the accounting, manual payout list).
 */

export const ymdDe = (s?: string | null) => (s ? s.slice(0, 10).split('-').reverse().join('.') : '–');
export const SeqBadge = ({ seq, label }: { seq?: string | null; label?: string }) => (seq ? <Badge tone={seq === 'FRST' ? 'blue' : seq === 'FNAL' ? 'purple' : 'gray'}>{label ? `${seq} · ${label}` : seq}</Badge> : null);
const RUN_TONE: Record<string, 'gray' | 'green' | 'red' | 'blue' | 'yellow'> = { draft: 'yellow', submitted: 'blue', closed: 'green', cancelled: 'gray' };
const ITEM_TONE: Record<string, 'gray' | 'green' | 'red' | 'blue' | 'yellow'> = { draft: 'yellow', submitted: 'blue', paid: 'green', returned: 'red', dropped: 'gray' };
const download = (run: any) => openAuthed(`/api/sepa/runs/${run.id}/xml`, `SEPA-${run.kind === 'debit' ? 'Lastschrift' : 'Ueberweisung'}-${run.exec_date}.xml`);

// --- run builder -------------------------------------------------------------------------------------------------------------

export function CollectTab({ onCreated }: { onCreated: (runId: string) => void }) {
  const t = useT('sepa');
  const { data } = useLoad(() => api.get('/api/sepa/candidates'), []);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [date, setDate] = useState('');
  const [notify, setNotify] = useState(true);
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!data) return;
    setDate((d) => d || data.earliest);
    setPicked(new Set(data.items.filter((c: any) => c.ok).map((c: any) => c.invoice_id)));
  }, [data]);
  const ids = useMemo(() => [...picked], [picked]);
  useEffect(() => {
    if (!date || !ids.length) return setPreview(null);
    const tm = setTimeout(() => api.post('/api/sepa/runs/preview', { invoice_ids: ids, collection_date: date }).then(setPreview).catch(() => setPreview(null)), 250);
    return () => clearTimeout(tm);
  }, [ids, date]);
  if (!data) return <Spinner />;
  const toggle = (id: string, on: boolean) => setPicked((s) => {
    const n = new Set(s);
    if (on) n.add(id);
    else n.delete(id);
    return n;
  });
  const ok = data.items.filter((c: any) => c.ok);
  const create = async () => {
    setBusy(true);
    const r = await act(() => api.post('/api/sepa/runs', { invoice_ids: ids, collection_date: date, notify }), notify ? t('Lauf angelegt, Vorabankündigungen gesendet') : t('Lauf angelegt'));
    setBusy(false);
    if (r) onCreated(r.id);
  };
  return (
    <div className="cr-panels">
      <Panel
        title={t('Offene Rechnungen mit Mandat')}
        sub={t('Festgeschriebene, offene Rechnungen in Euro von Kontakten mit aktivem Mandat. Vorabankündigung {days} {unit} vorher.', { days: data.prenotify_days, unit: data.prenotify_days === 1 ? t('Tag') : t('Tage') })}
        tour="sepa-collect"
        actions={
          ok.length > 0 && (
            <button className="btn secondary" onClick={() => setPicked(picked.size === ok.length ? new Set() : new Set(ok.map((c: any) => c.invoice_id)))}>
              {picked.size === ok.length ? t('Keine wählen') : t('Alle wählen')}
            </button>
          )
        }
      >
        {!data.items.length ? (
          <Empty>{t('Keine einziehbare Rechnung. Rechnungen erscheinen hier, sobald sie festgeschrieben und offen sind und der Kontakt ein aktives Mandat hat.')}</Empty>
        ) : (
          <div className="cr-list">
            {data.items.map((c: any) => (
              <Item key={c.invoice_id} tone={c.ok ? undefined : 'warn'} side={<><SeqBadge seq={c.seq} /> <strong>{money(c.open_cents)}</strong></>}>
                {c.ok ? (
                  <Check checked={picked.has(c.invoice_id)} onChange={(v) => toggle(c.invoice_id, v)} label={<><strong>{c.number}</strong> · {c.contact_name}</>} />
                ) : (
                  <span>
                    <strong>{c.number}</strong> · {c.contact_name}
                  </span>
                )}
                <div className="cr-sub">
                  {t('Mandat {ref} · {iban}', { ref: c.mandate_ref, iban: c.iban_masked })}
                  {c.due_at && ` · ${t('fällig {date}', { date: ymdDe(c.due_at) })}`}
                  {!c.ok && <span className="sepa-warn"> · {c.problems.join(', ')}</span>}
                </div>
              </Item>
            ))}
          </div>
        )}
      </Panel>
      <Panel title={t('Vorschau')} sub={t('Je Lastschriftart und Sequenztyp entsteht ein eigener Block in der Datei.')} tour="sepa-preview">
        <Field label={t('Fälligkeit (Einzugsdatum)')} hint={t('Frühestens {date} – ein Bankarbeitstag (TARGET2)', { date: ymdDe(data.earliest) })} tour="sepa-date">
          <Input type="date" value={date} min={data.earliest} onChange={setDate} />
        </Field>
        {preview && (
          <>
            <table className="sepa-table">
              <thead>
                <tr>
                  <th>{t('Block')}</th>
                  <th className="num">{t('Anzahl')}</th>
                  <th className="num">{t('Summe')}</th>
                </tr>
              </thead>
              <tbody>
                {preview.groups.map((g: any) => (
                  <tr key={`${g.scheme}${g.seq}`}>
                    <td>
                      {g.scheme} · <SeqBadge seq={g.seq} label={g.seq_label} />
                    </td>
                    <td className="num">{g.count}</td>
                    <td className="num">{money(g.total_cents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>{t('Gesamt')}</td>
                  <td className="num">{preview.count}</td>
                  <td className="num">{money(preview.total_cents)}</td>
                </tr>
              </tfoot>
            </table>
            {preview.errors.length > 0 && <Callout tone="bad">{preview.errors.join(' · ')}</Callout>}
            {preview.warnings.length > 0 && <Callout tone="warn">{preview.warnings.join(' · ')}</Callout>}
          </>
        )}
        <Check checked={notify} onChange={setNotify} label={t('Vorabankündigung jetzt per E-Mail senden (aus: ich kündige selbst an, z. B. auf der Rechnung)')} />
        <button className="btn sepa-wide" onClick={create} disabled={busy || !preview?.ok} data-tour="sepa-create">
          {t('Lauf anlegen')}{notify ? t(' & Vorabankündigung senden') : ''}
        </button>
        <p className="muted small">{t('Eingereicht wird erst im nächsten Schritt: Dann entsteht die Datei (pain.008), die du im Online-Banking hochlädst.')}</p>
      </Panel>
    </div>
  );
}

// --- history and run detail ------------------------------------------------------------------------------------------------------

function ReturnDialog({ item, onClose, onDone }: { item: any; onClose: () => void; onDone: () => void }) {
  const t = useT('sepa');
  const { data } = useLoad(() => api.get('/api/sepa/settings'), []);
  const [code, setCode] = useState('AM04');
  const [fee, setFee] = useState('');
  const [feeInvoice, setFeeInvoice] = useState(true);
  const [note, setNote] = useState('');
  useEffect(() => {
    if (data?.settings.return_fee_cents) setFee(euroText(data.settings.return_fee_cents));
  }, [data]);
  const codes: [string, string][] = Object.entries<any>(data?.return_codes ?? {}).map(([k, v]) => [k, `${k} – ${v.label}`]);
  const effect = data?.return_codes?.[code]?.mandate;
  const save = async () => {
    const cents = fee.trim() ? parseEuro(fee) : 0;
    if (cents === null) return act(() => Promise.reject(new Error(t('Gebühr: bitte einen Betrag wie 3,50 eingeben'))));
    if (await act(() => api.post(`/api/sepa/items/${item.id}/return`, { code, fee_cents: cents, fee_invoice: cents > 0 && feeInvoice, note }), t('Rücklastschrift erfasst – die Rechnung ist wieder offen'))) onDone();
  };
  return (
    <Modal
      title={t('Rücklastschrift {id}', { id: item.invoice_number || item.end_to_end })}
      onClose={onClose}
      footer={
        <button className="btn danger" onClick={save} data-tour="sepa-return-save">
          {t('Rücklastschrift erfassen')}
        </button>
      }
    >
      <p className="cr-hint">{t('Die Zahlung auf der Rechnung wird zurückgenommen ({money}), die Rechnung ist danach wieder offen und kann erneut eingezogen oder gemahnt werden.', { money: money(item.amount_cents) })}</p>
      <Field label={t('Rückgabegrund (laut Bank)')}>
        <Select value={code} onChange={setCode} options={codes} />
      </Field>
      {effect && <Callout tone="warn">{effect === 'revoke' ? t('Dieser Grund beendet das Mandat – für weitere Lastschriften braucht es ein neues.') : t('Dieser Grund sperrt das Mandat, bis du die Daten geprüft und es wieder freigegeben hast.')}</Callout>}
      <div className="row">
        <Field label={t('Gebühr der Bank (€)')} hint={t('optional')}>
          <Input value={fee} onChange={setFee} placeholder="0,00" inputMode="decimal" />
        </Field>
      </div>
      <Check checked={feeInvoice} onChange={setFeeInvoice} label={t('Gebühr als Rechnungsentwurf an den Kunden anlegen')} />
      <Field label={t('Notiz')}>
        <Textarea value={note} onChange={setNote} rows={2} />
      </Field>
    </Modal>
  );
}

function RunDialog({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const t = useT('sepa');
  const { data: r, reload } = useLoad(() => api.get(`/api/sepa/runs/${id}`), [id]);
  const [ret, setRet] = useState<any>(null);
  if (!r)
    return (
      <Modal title={t('SEPA-Lauf')} onClose={onClose}>
        <Spinner />
      </Modal>
    );
  const after = () => (reload(), onChanged());
  const run = async (fn: () => Promise<any>, ok: string) => {
    const res = await act(fn, ok);
    if (res) after();
    return res;
  };
  const debit = r.kind === 'debit';
  // One dialog at a time: Esc or ✕ on the return dialog leads back to the run, not out of both.
  if (ret) return <ReturnDialog item={ret} onClose={() => setRet(null)} onDone={() => (setRet(null), after())} />;
  const submit = async () => {
    const res = await run(() => api.post(`/api/sepa/runs/${id}/submit`), t('Eingereicht – die Datei steht bereit'));
    if (res) {
      if (res.dropped?.length) window.alert(t('Nicht in der Datei:\n{dropped}', { dropped: res.dropped.join('\n') }));
      void download(res);
    }
  };
  const cancel = () => {
    const reason = window.prompt(r.status === 'draft' ? t('Lauf verwerfen – Grund (optional):') : t('Lauf zurückziehen (z. B. „Bank hat die Datei abgelehnt“):'), '');
    if (reason !== null) void run(() => api.post(`/api/sepa/runs/${id}/cancel`, { reason }), r.status === 'draft' ? t('Lauf verworfen') : t('Lauf zurückgezogen'));
  };
  const failed = r.items.filter((x: any) => x.notify_status === 'failed' && x.status === 'draft').length;
  const open = r.counts?.submitted ?? 0;
  return (
    <Modal
      title={`${r.kind_label} ${ymdDe(r.exec_date)}`}
      wide
      onClose={onClose}
      footer={
        <>
          {r.status === 'draft' && (
            <button className="btn" onClick={submit} data-tour="sepa-submit">
              {t('Einreichen & Datei erzeugen')}
            </button>
          )}
          {r.has_xml && (
            <button className="btn secondary" onClick={() => download(r)} data-tour="sepa-download">
              {t('XML herunterladen')}
            </button>
          )}
          {r.status === 'submitted' && open > 0 && (
            <button className="btn secondary" onClick={() => confirmAsk(t('Alle {count} eingereichten Posten als bezahlt markieren?', { count: open })) && run(() => api.post(`/api/sepa/runs/${id}/paid`), t('Als bezahlt markiert'))}>
              {t('Alle als bezahlt')}
            </button>
          )}
          {r.status === 'draft' && failed > 0 && (
            <button className="btn secondary" onClick={() => run(() => api.post(`/api/sepa/runs/${id}/notify`), t('Vorabankündigung erneut gesendet'))}>
              {t('Vorabankündigung erneut senden')}
            </button>
          )}
          {(r.status === 'draft' || (r.status === 'submitted' && !r.counts?.paid && !r.counts?.returned)) && (
            <button className="btn danger" onClick={cancel}>
              {r.status === 'draft' ? t('Verwerfen') : t('Zurückziehen')}
            </button>
          )}
        </>
      }
    >
      <Facts
        rows={[
          [t('Status'), <Badge key="s" tone={RUN_TONE[r.status] ?? 'gray'}>{r.status_label}</Badge>],
          [debit ? t('Fälligkeit') : t('Ausführung'), ymdDe(r.exec_date)],
          [t('Posten'), t('{count} · {money}', { count: r.tx_count, money: money(r.total_cents) })],
          [t('Nachricht (MsgId)'), r.msg_id],
          [t('Eingereicht'), r.submitted_at ? dt(r.submitted_at) : t('noch nicht')],
          [t('Datei'), r.xml_sha256 ? `${debit ? 'pain.008.001.08' : 'pain.001.001.09'} · SHA-256 ${r.xml_sha256.slice(0, 16)}…` : ''],
          [t('Notiz'), r.note],
        ]}
      />
      {r.status === 'draft' && <Callout>{t('Die Vorabankündigung ist raus. Reiche den Lauf spätestens einen Bankarbeitstag vor der Fälligkeit ein: Dann entsteht die Datei, die du im Online-Banking hochlädst.')}</Callout>}
      <div className="sepa-scroll">
        <table className="sepa-table">
          <thead>
            <tr>
              <th>{debit ? t('Rechnung') : t('Empfänger')}</th>
              <th className="num">{t('Betrag')}</th>
              {debit && <th>{t('Sequenz')}</th>}
              <th>{t('Status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {r.items.map((x: any) => (
              <tr key={x.id}>
                <td>
                  <strong>{debit ? x.invoice_number || x.end_to_end : x.name}</strong>
                  <div className="muted small">
                    {debit ? `${x.name} · ${x.mandate_ref}` : `${x.iban_masked} · ${x.remittance}`}
                    {debit && x.notify_status === 'failed' && <span className="sepa-warn"> · {t('Vorabankündigung fehlgeschlagen: {error}', { error: x.notify_error })}</span>}
                    {debit && x.notify_status === 'manual' && ` · ${t('Vorabankündigung selbst zugestellt')}`}
                    {x.return_code && ` · ${x.return_code} ${x.return_label}`}
                    {x.status === 'dropped' && x.return_note && ` · ${x.return_note}`}
                  </div>
                </td>
                <td className="num">{money(x.amount_cents)}</td>
                {debit && <td>{x.seq}</td>}
                <td>
                  <Badge tone={ITEM_TONE[x.status] ?? 'gray'}>{x.status_label}</Badge>
                </td>
                <td>
                  <div className="sepa-actions">
                    {x.status === 'submitted' && (
                      <button className="btn secondary small" onClick={() => run(() => api.post(`/api/sepa/items/${x.id}/paid`), debit ? t('Als bezahlt markiert') : t('Als ausgeführt markiert'))}>
                        {debit ? t('Bezahlt') : t('Ausgeführt')}
                      </button>
                    )}
                    {debit && (x.status === 'submitted' || x.status === 'paid') && (
                      <button className="btn secondary small" onClick={() => setRet(x)}>
                        {t('Rücklastschrift')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

export function RunsTab({ open, setOpen, onChanged }: { open: string; setOpen: (id: string) => void; onChanged: () => void }) {
  const t = useT('sepa');
  const [kind, setKind] = useState('');
  const list = useLoad(() => api.get(`/api/sepa/runs${kind ? `?kind=${kind}` : ''}`), [kind]);
  return (
    <Panel wide title={t('Läufe')} sub={t('Jeder Lauf ist eine Datei für die Bank. Bezahlte und zurückgegebene Lastschriften trägst du hier ein – die Rechnung folgt automatisch.')} tour="sepa-runs" actions={<Select value={kind} onChange={setKind} options={[['', t('Alle')], ['debit', t('Lastschriften')], ['transfer', t('Überweisungen')]]} />}>
      {!list.data ? (
        <Spinner />
      ) : !list.data.length ? (
        <Empty>{t('Noch keine Läufe.')}</Empty>
      ) : (
        <div className="cr-list">
          {list.data.map((r: any) => (
            <Item key={r.id} onClick={() => setOpen(r.id)} side={<><strong>{money(r.total_cents)}</strong> <Badge tone={RUN_TONE[r.status] ?? 'gray'}>{r.status_label}</Badge></>}>
              <strong>
                {r.kind_label} {ymdDe(r.exec_date)}
              </strong>{' '}
              <span className="muted small">{t('{count} Posten', { count: r.tx_count })}</span>
              <div className="cr-sub">
                {t('angelegt {date}', { date: dt(r.created_at) })}
                {r.submitted_at && ` · ${t('eingereicht {date}', { date: dt(r.submitted_at) })}`}
                {r.note && ` · ${r.note}`}
              </div>
            </Item>
          ))}
        </div>
      )}
      {open && <RunDialog id={open} onClose={() => setOpen('')} onChanged={() => (list.reload(), onChanged())} />}
    </Panel>
  );
}

// --- transfers ---------------------------------------------------------------------------------------------------------------------

type Line = { name: string; iban: string; bic: string; amount: string; reference: string };
const emptyLine = (): Line => ({ name: '', iban: '', bic: '', amount: '', reference: '' });

export function TransfersTab() {
  const t = useT('sepa');
  const { data, reload } = useLoad(() => api.get('/api/sepa/payables'), []);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [lines, setLines] = useState<Line[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  if (!data) return <Spinner />;
  const items: any[] = data.items;
  const fromBills = items.filter((p) => picked.has(p.receipt_id)).reduce((n, p) => n + p.amount_cents, 0);
  const fromLines = lines.reduce((n, l) => n + (parseEuro(l.amount) ?? 0), 0);
  const setLine = (i: number, k: keyof Line) => (v: string) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const create = async () => {
    const bad = lines.findIndex((l) => parseEuro(l.amount) === null);
    if (bad >= 0) return act(() => Promise.reject(new Error(t('Zeile {n}: bitte einen Betrag wie 120,00 eingeben', { n: bad + 1 }))));
    const r = await act(() => api.post('/api/sepa/transfers', { execution_date: date, receipt_ids: [...picked], lines: lines.map((l) => ({ name: l.name, iban: l.iban, bic: l.bic, amount_cents: parseEuro(l.amount), reference: l.reference })) }), t('Überweisungsdatei erzeugt'));
    if (r) {
      void download(r);
      setPicked(new Set());
      setLines([]);
      reload();
    }
  };
  return (
    <div className="cr-panels">
      <Panel title={t('Offene Eingangsrechnungen')} sub={data.available ? t('Gebuchte, noch nicht bezahlte Belege aus der Buchhaltung. Bezahlt gilt ein Beleg erst, wenn der Bankabgleich die Zahlung findet.') : t('Die Buchhaltung ist hier nicht verfügbar – nutze die Auszahlungsliste.')} tour="sepa-transfers">
        {!items.length ? (
          <Empty>{t('Keine offenen Eingangsrechnungen.')}</Empty>
        ) : (
          <div className="cr-list">
            {items.map((p) => (
              <Item key={p.receipt_id} tone={p.ok ? undefined : 'warn'} side={<strong>{money(p.amount_cents)}</strong>}>
                {p.ok ? (
                  <Check checked={picked.has(p.receipt_id)} onChange={(v) => setPicked((s) => { const n = new Set(s); if (v) n.add(p.receipt_id); else n.delete(p.receipt_id); return n; })} label={<><strong>{p.supplier || t('Lieferant')}</strong> · {p.invoice_no}</>} />
                ) : (
                  <span>
                    <strong>{p.supplier || t('Lieferant')}</strong> · {p.invoice_no}
                  </span>
                )}
                <div className="cr-sub">
                  {p.iban_masked || t('ohne IBAN')}
                  {p.due_date && ` · ${t('fällig {date}', { date: ymdDe(p.due_date) })}`}
                  {!p.ok && <span className="sepa-warn"> · {p.problems.join(', ')}</span>}
                </div>
              </Item>
            ))}
          </div>
        )}
      </Panel>
      <Panel title={t('Auszahlungsliste')} sub={t('Weitere Empfänger von Hand, z. B. Erstattungen oder Honorare.')} actions={<button className="btn secondary" onClick={() => setLines((l) => [...l, emptyLine()])}>{t('Zeile hinzufügen')}</button>}>
        {!lines.length && <p className="muted">{t('Keine Zeilen.')}</p>}
        {lines.map((l, i) => (
          <div key={i} className="sepa-line">
            <div className="row">
              <Field label={t('Empfänger')}>
                <Input value={l.name} onChange={setLine(i, 'name')} maxLength={70} />
              </Field>
              <Field label={t('Betrag (€)')}>
                <Input value={l.amount} onChange={setLine(i, 'amount')} inputMode="decimal" placeholder="0,00" />
              </Field>
            </div>
            <div className="row">
              <Field label={t('IBAN')}>
                <Input value={l.iban} onChange={setLine(i, 'iban')} spellCheck={false} />
              </Field>
              <Field label={t('BIC (optional)')}>
                <Input value={l.bic} onChange={setLine(i, 'bic')} spellCheck={false} maxLength={11} />
              </Field>
            </div>
            <Field label={t('Verwendungszweck')}>
              <Input value={l.reference} onChange={setLine(i, 'reference')} maxLength={140} />
            </Field>
            <button className="btn secondary small" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
              {t('Zeile entfernen')}
            </button>
          </div>
        ))}
      </Panel>
      <Panel title={t('Datei erzeugen')} sub={t('pain.001.001.09 von deinem eigenen Konto (SEPA → Einstellungen).')}>
        <Field label={t('Ausführungsdatum')}>
          <Input type="date" value={date} onChange={setDate} />
        </Field>
        <Facts
          rows={[
            [t('Belege'), t('{count} · {money}', { count: picked.size, money: money(fromBills) })],
            [t('Auszahlungsliste'), t('{count} · {money}', { count: lines.length, money: money(fromLines) })],
            [t('Gesamt'), <strong key="t">{money(fromBills + fromLines)}</strong>],
          ]}
        />
        <button className="btn sepa-wide" disabled={!picked.size && !lines.length} onClick={create} data-tour="sepa-transfer-create">
          {t('Überweisungsdatei erzeugen')}
        </button>
      </Panel>
    </div>
  );
}
