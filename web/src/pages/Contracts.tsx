import { useEffect, useState } from 'react';
import { api, d, name } from '../api';
import { useT } from '../i18n';
import { Slot } from '../slots';
import { act, Badge, CodeBox, confirmAsk, Empty, Field, Input, Link, Modal, navigate, PageHead, pressable, Select, Spinner, Tabs, Textarea, toast, useLoad } from '../ui';

const STATUS: Record<string, [string, any]> = {
  draft: ['Entwurf', 'gray'],
  sent: ['gesendet', 'yellow'],
  viewed: ['geöffnet', 'blue'],
  signed: ['unterschrieben', 'green'],
  declined: ['abgelehnt', 'red'],
  void: ['storniert', 'red'],
};

// i18n-ignore – default sample contract markdown
const STARTER = `# Dienstleistungsvertrag

zwischen **{{location.name}}** (Auftragnehmer) und **{{contact.full_name}}**{{contact.company| }} (Auftraggeber).

## 1. Leistungen
- Erstellung einer Website mit bis zu 5 Seiten
- Einrichtung von Kontaktformular und Terminbuchung

## 2. Vergütung
Die Vergütung beträgt 1.490 € zzgl. USt. 50 % sind bei Auftragserteilung fällig, der Rest bei Abnahme.

## 3. Laufzeit
Der Vertrag beginnt mit Unterschrift und endet mit Abnahme der Leistungen.

Ort, Datum: ________________`;

export function Contracts() {
  const t = useT('contracts');
  const [kind, setKind] = useState('contract');
  const list = useLoad(() => api.get<any[]>(`/api/contracts?kind=${kind}`), [kind]);
  const templates = useLoad(() => api.get<any[]>('/api/contracts?kind=template'), []);
  const [modal, setModal] = useState(false);
  return (
    <>
      <PageHead title={t('Verträge')} sub={t('Online unterschreiben lassen – mit Prüfsumme und Protokoll')}>
        <button
          className="btn"
          data-tour="contracts-new"
          onClick={async () => {
            if (kind === 'template') {
              const r = await act(() => api.post('/api/contracts', { kind: 'template', title: t('Neue Vorlage'), content: STARTER }));
              if (r) navigate(`contracts/${r.id}`);
            } else setModal(true);
          }}
        >
          + {kind === 'template' ? t('Vorlage') : t('Vertrag')}
        </button>
      </PageHead>
      <Tabs tabs={[['contract', t('Verträge')], ['template', t('Vorlagen')]]} value={kind} onChange={setKind} />
      {!list.data ? (
        <Spinner />
      ) : list.data.length ? (
        <div className="table-wrap" data-tour="contracts-list">
          <table className="t">
            <thead>
              <tr>
                <th>{t('Titel')}</th>
                {kind === 'contract' && <th>{t('Kunde')}</th>}
                {kind === 'contract' && <th>{t('Status')}</th>}
                <th>{t('Geändert')}</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((c) => (
                <tr key={c.id} className="click" {...pressable(() => navigate(`contracts/${c.id}`))}>
                  <td>
                    <strong>{c.title}</strong>
                  </td>
                  {kind === 'contract' && <td>{c.contact_id ? name(c) : <span className="muted">–</span>}</td>}
                  {kind === 'contract' && (
                    <td>
                      <Badge tone={STATUS[c.status]?.[1]}>{t(STATUS[c.status]?.[0] ?? c.status)}</Badge>
                    </td>
                  )}
                  <td className="muted">{d(c.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{kind === 'template' ? t('Noch keine Vorlagen – z. B. Website-Vertrag, Wartungsvertrag, AV-Vertrag.') : t('Noch keine Verträge.')}</Empty>
      )}
      {modal && <NewContract templates={templates.data ?? []} onClose={() => setModal(false)} />}
    </>
  );
}

function NewContract({ templates, onClose }: { templates: any[]; onClose: () => void }) {
  const t = useT('contracts');
  const [tpl, setTpl] = useState('');
  return (
    <Modal
      title={t('Neuer Vertrag')}
      onClose={onClose}
      footer={
        <button
          className="btn"
          onClick={async () => {
            const r = await act(() => api.post('/api/contracts', tpl ? { template_id: tpl } : { title: t('Vertrag'), content: STARTER }));
            if (r) navigate(`contracts/${r.id}`);
          }}
        >
          {t('Anlegen')}
        </button>
      }
    >
      <Field label={t('Vorlage')}>
        <Select value={tpl} onChange={setTpl} placeholder={t('Beispiel-Vertrag')} options={templates.map((tItem) => [tItem.id, tItem.title])} />
      </Field>
    </Modal>
  );
}

function ContactPick({ value, onChange, disabled }: { value: string | null; onChange: (id: string | null) => void; disabled?: boolean }) {
  const t = useT('contracts');
  const [contact, setContact] = useState<any>();
  const [q, setQ] = useState('');
  const [found, setFound] = useState<any[]>([]);
  useEffect(() => {
    if (value) api.get(`/api/contacts/${value}`).then(setContact).catch(() => {});
    else setContact(undefined);
  }, [value]);
  useEffect(() => {
    if (!q) return setFound([]);
    const timer = setTimeout(() => api.get(`/api/contacts?q=${encodeURIComponent(q)}&limit=6`).then((r) => setFound(r.contacts)), 200);
    return () => clearTimeout(timer);
  }, [q]);
  if (value && contact)
    return (
      <div>
        <Link to={`contacts/${contact.id}`}>{contact.name || name(contact)}</Link> <span className="muted">{contact.email}</span>{' '}
        {!disabled && (
          <a href="#" onClick={(e) => (e.preventDefault(), onChange(null))}>
            {t('ändern')}
          </a>
        )}
      </div>
    );
  return (
    <>
      <Input value={q} onChange={setQ} placeholder={t('Kontakt suchen…')} />
      {found.map((c) => (
        <a key={c.id} href="#" style={{ display: 'block' }} onClick={(e) => (e.preventDefault(), onChange(c.id), setQ(''))}>
          {name(c)} <span className="muted">{c.email}</span>
        </a>
      ))}
    </>
  );
}

export function ContractEditor({ id }: { id: string }) {
  const t = useT('contracts');
  const c = useLoad(() => api.get<any>(`/api/contracts/${id}`), [id]);
  const [send, setSend] = useState(false);
  if (!c.data) return <Spinner />;
  const v = c.data;
  const template = v.kind === 'template';
  const locked = v.status !== 'draft';
  const set = (p: any) => c.setData({ ...v, ...p });
  const save = () => act(() => api.patch(`/api/contracts/${v.id}`, { title: v.title, content: v.content, contact_id: v.contact_id }), t('Gespeichert'));
  return (
    <>
      <PageHead title={v.title} sub={<Link to="contracts">← {template ? t('Vorlagen') : t('Verträge')}</Link>}>
        {!template && <Badge tone={STATUS[v.status]?.[1]}>{t(STATUS[v.status]?.[0])}</Badge>}
        {!locked && (
          <button className="btn secondary" onClick={save}>
            {t('Speichern')}
          </button>
        )}
        {!template && ['draft', 'sent', 'viewed'].includes(v.status) && (
          <button className="btn" onClick={async () => (locked || (await save())) && setSend(true)}>
            {v.status === 'draft' ? t('Senden') : t('Erneut senden')}
          </button>
        )}
        {!template && v.status !== 'draft' && (
          <a className="btn secondary" href={v.url} target="_blank" rel="noreferrer">
            {t('Ansehen')}
          </a>
        )}
        {!template && ['sent', 'viewed'].includes(v.status) && (
          <button className="btn ghost" onClick={async () => confirmAsk(t('Vertrag stornieren? Der Link funktioniert dann nicht mehr.')) && (await act(() => api.patch(`/api/contracts/${v.id}`, { status: 'void' }))) && c.reload()}>
            {t('Stornieren')}
          </button>
        )}
        {(template || ['draft', 'void'].includes(v.status)) && (
          <button className="btn ghost" onClick={async () => confirmAsk(t('Löschen?')) && (await act(() => api.del(`/api/contracts/${v.id}`))) && navigate('contracts')}>
            {t('Löschen')}
          </button>
        )}
      </PageHead>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="card" style={{ flex: '2 1 480px' }}>
          <Field label={t('Titel')}>
            <Input value={v.title} onChange={(x) => set({ title: x })} disabled={locked} />
          </Field>
          {!template && (
            <Field label={t('Unterzeichner (Kontakt)')}>
              <ContactPick value={v.contact_id} onChange={(x) => set({ contact_id: x })} disabled={locked} />
            </Field>
          )}
          <Field label={t('Vertragstext')} hint={t('# Überschrift · - Liste · **fett** · Platzhalter wie {{contact.full_name}}, {{contact.company}}, {{location.name}} werden beim Senden eingesetzt.')}>
            <Textarea className="mono" value={v.content} onChange={(x) => set({ content: x })} rows={22} disabled={locked} />
          </Field>
        </div>
        {!template && (
          <div className="card" style={{ flex: '1 1 260px' }}>
            <h2>{t('Status')}</h2>
            {v.status === 'signed' ? (
              <>
                <img src={v.signature} alt={t('Unterschrift')} style={{ maxWidth: '100%', background: '#fff', borderRadius: 8 }} />
                <div dangerouslySetInnerHTML={{ __html: v.audit }} />
              </>
            ) : v.status === 'declined' ? (
              <>
                <p>{t('Abgelehnt am {date}.', { date: d(v.signed_at) })}</p>
                {v.decline_reason && <p className="muted">„{v.decline_reason}“</p>}
              </>
            ) : v.status === 'draft' ? (
              <p className="muted">{t('Noch nicht gesendet. Nach dem Senden ist der Text fest – Änderungen nur per neuem Vertrag.')}</p>
            ) : (
              <>
                <p>{t('Gesendet am {date}{opened}.', { date: d(v.sent_at), opened: v.viewed_at ? t(', geöffnet am {date}', { date: d(v.viewed_at) }) : t(', noch nicht geöffnet') })}</p>
                <Field label={t('Link zum Unterschreiben')}>
                  <CodeBox text={v.url} />
                </Field>
              </>
            )}
          </div>
        )}
        {!template && <Slot name="contract.signers" contract={v} onChanged={c.reload} />}
      </div>
      {send && (
        <SendContract
          contract={v}
          onClose={() => setSend(false)}
          onSent={() => {
            setSend(false);
            c.reload();
          }}
        />
      )}
    </>
  );
}

function SendContract({ contract, onClose, onSent }: { contract: any; onClose: () => void; onSent: () => void }) {
  const t = useT('contracts');
  const [channel, setChannel] = useState('email');
  const [subject, setSubject] = useState(t('Bitte unterschreiben: {{contract.title}}'));
  const [body, setBody] = useState(
    t('Hallo {{contact.first_name|}},\n\nhier ist der Vertrag „{{contract.title}}“ zum Lesen und Unterschreiben:\n{{contract.url}}\n\nViele Grüße\n{{location.name}}'),
  );
  return (
    <Modal
      title={t('Vertrag senden')}
      onClose={onClose}
      footer={
        <button
          className="btn"
          onClick={async () => {
            const r = await act(() => api.post(`/api/contracts/${contract.id}/send`, { channel, subject, body }));
            if (r) {
              toast(r.message?.status === 'failed' ? t('Nicht gesendet: {error}', { error: r.message.error }) : t('Gesendet'));
              onSent();
            }
          }}
        >
          {t('Senden')}
        </button>
      }
    >
      <Tabs tabs={[['email', t('E-Mail')], ['sms', t('SMS')]]} value={channel} onChange={setChannel} />
      {channel === 'email' && (
        <Field label={t('Betreff')}>
          <Input value={subject} onChange={setSubject} />
        </Field>
      )}
      <Field label={t('Nachricht ({{contract.url}} = Link)')}>
        <Textarea value={body} onChange={setBody} rows={7} />
      </Field>
    </Modal>
  );
}
