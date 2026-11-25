import { useState } from 'react';
import { ago, api, d } from '../api';
import { Badge, Check, Empty, Field, Input, Link, Modal, Select, Spinner, TagInput, Textarea, act, confirmAsk, useLoad } from '../ui';
import { useT } from '../i18n';
import { ImagePicker, MarkdownEditor } from './ContentKit';
import { useCourses } from './Courses';
import { CopyField, NumberField, Sec, StatusBadge, Sub, euro, fromLocalInput, run } from './CommunityParts';

/**
 * Community → Beitritt: the public page (/c/<adresse>), tiers (free, monthly/yearly, lifetime, trial), questions, approval, requests,
 * memberships, invite links and discount codes. Server side: modules/community-pages.ts.
 */

// billing and access label helpers used inside components with t(...)

export function JoinTab({ group, onChange }: { group: any; onChange: () => void }) {
  const t = useT('community');
  const accessLabel = (a: string) => {
    switch (a) {
      case 'all': return t('alle im Mitgliederbereich');
      case 'courses': return t('Teilnehmer bestimmter Kurse');
      case 'tags': return t('Kontakte mit bestimmten Tags');
      case 'join': return t('Beitritt über die Community-Seite');
      default: return a;
    }
  };

  const j = useLoad(() => api.get<any>(`/api/community/groups/${group.id}/join`), [group.id]);
  const [sub, setSub] = useState('page');
  if (j.error) return <Empty>{j.error}</Empty>;
  if (!j.data) return <Spinner />;
  const data = j.data;
  const pending = (data.counts.pending ?? 0) + (data.counts.awaiting_payment ?? 0);
  const reload = () => {
    void j.reload();
    onChange();
  };
  return (
    <div className="cma" data-tour="community-join">
      {data.access_mode !== 'join' && (
        <div className="cma-note" role="note">
          <strong>{t('Aktuell kommen Mitglieder so herein: {mode}.', { mode: accessLabel(data.access_mode) })}</strong> {t('Die Beitritts-Seite, Stufen, Zahlung und Freigabe wirken erst, wenn du den Zugang auf „Beitritt über die Community-Seite“ stellst. Alle, die jetzt schon drin sind, bleiben als kostenlose Mitglieder.')}
          <div className="cma-actions">
            <button
              className="btn"
              onClick={async () => {
                if (!(await confirmAsk(t('Zugang auf „Beitritt über die Community-Seite“ umstellen? Wer schon in der Gruppe ist, bleibt als kostenloses Mitglied drin.')))) return;
                await run(() => api.put(`/api/community/groups/${group.id}/join/page`, { enabled: data.page?.enabled ?? false, set_access_join: true }), t('Zugang umgestellt'), reload);
              }}
            >
              {t('Jetzt umstellen')}
            </button>
          </div>
        </div>
      )}
      <Sub
        value={sub}
        onChange={setSub}
        tabs={[
          ['page', t('Öffentliche Seite')],
          ['tiers', t('Stufen ({n})', { n: data.tiers.length })],
          ['requests', pending ? t('Anfragen ({n})', { n: pending }) : t('Anfragen')],
          ['members', t('Mitgliedschaften')],
          ['invites', t('Einladungs-Links')],
          ['coupons', t('Rabattcodes')],
        ]}
      />
      {sub === 'page' && <PageForm group={group} data={data} onSaved={reload} />}
      {sub === 'tiers' && <Tiers group={group} data={data} onSaved={reload} />}
      {sub === 'requests' && <Requests group={group} onDone={reload} />}
      {sub === 'members' && <Memberships group={group} data={data} onDone={reload} />}
      {sub === 'invites' && <Invites group={group} data={data} />}
      {sub === 'coupons' && <Coupons group={group} data={data} />}
    </div>
  );
}

// --- page ---------------------------------------------------------------------------------------------------------------------
function PageForm({ group, data, onSaved }: { group: any; data: any; onSaved: () => void }) {
  const t = useT('community');
  const p = data.page;
  const [f, setF] = useState<any>(() => ({
    enabled: !!p?.enabled,
    slug: p?.slug ?? group.slug ?? '',
    tagline: p?.tagline ?? '',
    about: p?.about ?? '',
    video_url: p?.video_url ?? '',
    cover_image: p?.cover_image ?? '',
    approval: !!p?.approval,
    show_member_count: p ? !!p.show_member_count : true,
    show_admins: p ? !!p.show_admins : true,
    discoverable: !!p?.discoverable,
    indexable: p ? !!p.indexable : true,
    category: p?.category ?? '',
    seo_title: p?.seo_title ?? '',
    seo_description: p?.seo_description ?? '',
    terms_url: p?.terms_url ?? '',
    privacy_url: p?.privacy_url ?? '',
    consent_text: p?.consent_text ?? '',
    success_text: p?.success_text ?? '',
    stripe_promo: !!p?.stripe_promo,
    questions: p?.questions ?? [],
  }));
  const set = (patch: any) => setF((x: any) => ({ ...x, ...patch }));
  const q = (i: number, patch: any) => set({ questions: f.questions.map((x: any, n: number) => (n === i ? { ...x, ...patch } : x)) });
  const save = () => run(() => api.put(`/api/community/groups/${group.id}/join/page`, f), t('Gespeichert'), onSaved);
  const url = data.url ?? `${location.origin}/c/${f.slug || '…'}`;
  return (
    <div className="cma-grid">
      <Sec title={t('Seite')} lead={t('So sieht die Seite aus, die Interessenten sehen – ohne Anmeldung, mit Titelbild oder Video, Beschreibung, Preisen und Beitritts-Formular.')}>
        <Check checked={f.enabled} onChange={(v) => set({ enabled: v })} label={t('Die öffentliche Seite ist erreichbar')} />
        <Field label={t('Adresse')} hint={t('Nur Kleinbuchstaben, Ziffern und Bindestriche.')}>
          <Input value={f.slug} onChange={(v) => set({ slug: v })} placeholder="mein-club" />
        </Field>
        {p && f.enabled && <CopyField value={url} label={t('Link zur Seite')} />}
        <Field label={t('Kurzbeschreibung (eine Zeile)')}>
          <Input value={f.tagline} maxLength={140} onChange={(v) => set({ tagline: v })} placeholder={t('z. B. Gemeinsam schneller wachsen')} />
        </Field>
        <Field label={t('Titelbild')}>
          <ImagePicker value={f.cover_image} onChange={(v) => set({ cover_image: v })} />
        </Field>
        <Field label={t('Video (YouTube, Vimeo, Loom oder MP4-Link)')}>
          <Input value={f.video_url} onChange={(v) => set({ video_url: v })} placeholder="https://www.youtube.com/watch?v=…" />
        </Field>
        <Field label={t('Über uns (Markdown)')}>
          <MarkdownEditor value={f.about} onChange={(v) => set({ about: v })} rows={10} label={t('Über uns (Markdown)')} />
        </Field>
        <div className="cma-actions">
          <button className="btn" onClick={save}>
            {t('Speichern')}
          </button>
          {p && f.enabled && (
            <a className="btn secondary" href={url} target="_blank" rel="noreferrer">
              {t('Seite ansehen ↗')}
            </a>
          )}
        </div>
      </Sec>
      <Sec title={t('Beitritt')} lead={t('Wer darf rein, was fragst du ab, und wie sicherst du dich ab?')}>
        <Check checked={f.approval} onChange={(v) => set({ approval: v })} label={t('Anfragen erst freigeben (Warteschlange unter „Anfragen“)')} />
        <Check checked={f.show_member_count} onChange={(v) => set({ show_member_count: v })} label={t('Mitgliederzahl zeigen')} />
        <Check checked={f.show_admins} onChange={(v) => set({ show_admins: v })} label={t('Admins und Moderatoren zeigen')} />
        <Check checked={f.stripe_promo} onChange={(v) => set({ stripe_promo: v })} label={t('Rabattcodes auch direkt im Stripe-Checkout erlauben')} />
        <h4 style={{ margin: '14px 0 4px' }}>{t('Fragen beim Beitritt (höchstens 3)')}</h4>
        <p className="muted small" style={{ marginTop: 0 }}>
          {t('Die Antworten stehen am Kontakt (als eigenes Feld) und in der Anfrage.')}
        </p>
        {f.questions.map((x: any, i: number) => (
          <div key={x.id ?? i} className="row" style={{ alignItems: 'center', marginBottom: 8 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <Input value={x.label} maxLength={150} onChange={(v) => q(i, { label: v })} placeholder={t('z. B. Was ist dein Ziel?')} aria-label={t('Frage {n}', { n: i + 1 })} />
            </div>
            <Check checked={!!x.required} onChange={(v) => q(i, { required: v })} label={t('Pflicht')} />
            <button className="btn secondary small" onClick={() => set({ questions: f.questions.filter((_: any, n: number) => n !== i) })} aria-label={t('Frage {n} entfernen', { n: i + 1 })}>
              ✕
            </button>
          </div>
        ))}
        {f.questions.length < 3 && (
          <button className="btn secondary" onClick={() => set({ questions: [...f.questions, { id: '', label: '', required: false, field_key: '' }] })}>
            {t('+ Frage hinzufügen')}
          </button>
        )}
        <Field label={t('Einwilligungstext (Häkchen beim Beitritt)')}>
          <Input value={f.consent_text} onChange={(v) => set({ consent_text: v })} placeholder={t('z. B. Ich möchte Neuigkeiten per E-Mail erhalten.')} />
        </Field>
        <div className="cma-two">
          <Field label={t('Link zu den AGB')}>
            <Input value={f.terms_url} onChange={(v) => set({ terms_url: v })} placeholder="https://…" />
          </Field>
          <Field label={t('Link zur Datenschutzerklärung')}>
            <Input value={f.privacy_url} onChange={(v) => set({ privacy_url: v })} placeholder="https://…" />
          </Field>
        </div>
        <Field label={t('Text nach dem Beitritt')}>
          <Input value={f.success_text} onChange={(v) => set({ success_text: v })} placeholder={t('z. B. Willkommen! Schau in dein Postfach.')} />
        </Field>
        <div className="cma-actions">
          <button className="btn" onClick={save}>
            {t('Speichern')}
          </button>
        </div>
      </Sec>
      <Sec title={t('Suchmaschinen und Verzeichnis')} lead={t('Die Seite hat Titel, Beschreibung, Vorschaubild und strukturierte Daten für Google und soziale Netzwerke.')}>
        <Check checked={f.indexable} onChange={(v) => set({ indexable: v })} label={t('Suchmaschinen dürfen die Seite aufnehmen')} />
        <Field label={t('Titel in Suchergebnissen')} hint={`${f.seo_title.length}/70`}>
          <Input value={f.seo_title} maxLength={70} onChange={(v) => set({ seo_title: v })} placeholder={`${group.name} – ${t('Community')}`} />
        </Field>
        <Field label={t('Beschreibung in Suchergebnissen')} hint={`${f.seo_description.length}/160`}>
          <Textarea rows={3} value={f.seo_description} onChange={(v) => set({ seo_description: v.slice(0, 160) })} />
        </Field>
        <Check checked={f.discoverable} onChange={(v) => set({ discoverable: v })} label={<>{t('Im öffentlichen Verzeichnis zeigen')} (<a href={data.discovery_url} target="_blank" rel="noreferrer">/communities</a>)</>} />
        {f.discoverable && (
          <Field label={t('Kategorie im Verzeichnis')}>
            <Input value={f.category} maxLength={40} onChange={(v) => set({ category: v })} placeholder={t('z. B. Business, Fitness, Kunst')} />
          </Field>
        )}
        <div className="cma-actions">
          <button className="btn" onClick={save}>
            {t('Speichern')}
          </button>
        </div>
      </Sec>
    </div>
  );
}

// --- tiers --------------------------------------------------------------------------------------------------------------------
function Tiers({ group, data, onSaved }: { group: any; data: any; onSaved: () => void }) {
  const t = useT('community');
  const billLabel = (b: string) => {
    switch (b) {
      case 'free': return t('kostenlos');
      case 'month': return t('monatlich');
      case 'year': return t('jährlich');
      case 'once': return t('einmalig');
      default: return b;
    }
  };
  const [edit, setEdit] = useState<any>(null);
  return (
    <>
      {!data.stripe.connected && data.tiers.some((tierItem: any) => !tierItem.prices.free) && (
        <div className="cma-note">
          {t('Stripe ist noch nicht verbunden – bezahlte Stufen können erst gekauft werden, wenn du unter Einstellungen → Zahlung deinen Stripe-Schlüssel hinterlegst.')}
        </div>
      )}
      <div className="cma-grid">
        {data.tiers.map((tierItem: any) => (
          <Sec
            key={tierItem.id}
            title={tierItem.name}
            right={
              <>
                {tierItem.highlight ? <Badge tone="purple">{t('Empfohlen')}</Badge> : null} {!tierItem.active && <Badge>{t('Aus')}</Badge>}
              </>
            }
            lead={tierItem.description || undefined}
          >
            <div className="cma-chips" style={{ marginBottom: 8 }}>
              {tierItem.billings.map((b: string) => (
                <Badge key={b} tone="blue">
                  {b === 'free' ? t('Kostenlos') : `${billLabel(b)}: ${tierItem.prices[b]?.text ?? ''}`}
                </Badge>
              ))}
              {tierItem.trial_days > 0 && <Badge tone="green">{t('{n} Tage testen', { n: tierItem.trial_days })}</Badge>}
            </div>
            <div className="muted small">
              {t('{members} Mitglieder', { members: tierItem.members })}{tierItem.course_ids.length ? t(' · {courses} Kurs(e)', { courses: tierItem.course_ids.length }) : ''}
              {tierItem.grace_days ? t(' · {days} Tage Kulanz bei Zahlungsproblemen', { days: tierItem.grace_days }) : ''}
            </div>
            <div className="cma-actions">
              <button className="btn secondary" onClick={() => setEdit(tierItem)}>
                {t('Bearbeiten')}
              </button>
            </div>
          </Sec>
        ))}
        <Sec title={t('Neue Stufe')} lead={t('Eine Stufe ist ein Zugang mit eigenem Preis: kostenlos, monatlich oder jährlich (mit Testphase) oder einmalig (lebenslang). Preise kommen aus deinen Produkten.')}>
          <button className="btn" onClick={() => setEdit({ name: '', description: '', features: [], course_ids: [], tags: [], active: 1, highlight: 0, grace_days: 0, trial_days: 0, product_id: '', annual_product_id: '' })}>
            {t('+ Stufe anlegen')}
          </button>
        </Sec>
      </div>
      {edit && <TierEditor group={group} data={data} tier={edit} onClose={() => setEdit(null)} onDone={() => (setEdit(null), onSaved())} />}
    </>
  );
}

function TierEditor({ group, data, tier, onClose, onDone }: { group: any; data: any; tier: any; onClose: () => void; onDone: () => void }) {
  const t = useT('community');
  const courses = useCourses();
  const [f, setF] = useState<any>({ ...tier, product_id: tier.product_id ?? '', annual_product_id: tier.annual_product_id ?? '', features: tier.features ?? [], course_ids: tier.course_ids ?? [], tags: tier.tags ?? [] });
  const set = (patch: any) => setF((x: any) => ({ ...x, ...patch }));
  const rec = (kind: string) => data.products.filter((p: any) => p.price_cents > 0 && (kind === 'one' ? !p.recurring : p.recurring === kind));
  const save = async () => {
    const body = { name: f.name, description: f.description, features: f.features, course_ids: f.course_ids, tags: f.tags, active: f.active ? 1 : 0, highlight: f.highlight ? 1 : 0, grace_days: f.grace_days || 0, trial_days: f.trial_days || 0, product_id: f.product_id || null, annual_product_id: f.annual_product_id || null };
    if (await act(() => (tier.id ? api.patch(`/api/community/tiers/${tier.id}`, body) : api.post(`/api/community/groups/${group.id}/tiers`, body)), t('Gespeichert'))) onDone();
  };
  const del = async () => {
    if (await confirmAsk(t('Stufe „{name}“ löschen?', { name: tier.name }))) if (await act(() => api.del(`/api/community/tiers/${tier.id}`), t('Gelöscht'))) onDone();
  };
  const productLine = (p: any) => `${p.name} – ${euro(p.price_cents, p.currency)}${p.recurring === 'month' ? ` ${t('/ Monat')}` : p.recurring === 'year' ? ` ${t('/ Jahr')}` : ''}`;
  return (
    <Modal
      title={tier.id ? t('Stufe „{name}“', { name: tier.name }) : t('Neue Stufe')}
      onClose={onClose}
      wide
      footer={
        <>
          {tier.id && (
            <button className="btn danger" onClick={del}>
              {t('Löschen')}
            </button>
          )}
          <button className="btn" onClick={save} disabled={!f.name.trim()}>
            {t('Speichern')}
          </button>
        </>
      }
    >
      <div className="cma">
        <Field label={t('Name')}>
          <Input value={f.name} onChange={(v) => set({ name: v })} placeholder={t('z. B. Pro')} autoFocus />
        </Field>
        <Field label={t('Beschreibung (eine Zeile)')}>
          <Input value={f.description} onChange={(v) => set({ description: v })} />
        </Field>
        <Field label={t('Vorteile (eine pro Zeile, höchstens 8)')}>
          <Textarea rows={4} value={(f.features as string[]).join('\n')} onChange={(v) => set({ features: v.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 8) })} />
        </Field>
        <h4 style={{ margin: '6px 0 0' }}>{t('Preis')}</h4>
        <p className="muted small" style={{ margin: 0 }}>
          {t('Ohne Produkt ist die Stufe kostenlos. Das Produkt legst du unter Verkaufen → Produkte an (Zahlungsweise monatlich, jährlich oder einmalig).')}
        </p>
        <div className="cma-two">
          <Field label={t('Produkt (monatlich oder einmalig)')}>
            <Select value={f.product_id} onChange={(v) => set({ product_id: v })} placeholder={t('Kostenlos')} options={[...rec('month'), ...rec('one')].map((p: any) => [p.id, productLine(p)])} />
          </Field>
          <Field label={t('Jahres-Alternative (optional)')}>
            <Select value={f.annual_product_id} onChange={(v) => set({ annual_product_id: v })} placeholder={t('keine')} options={rec('year').map((p: any) => [p.id, productLine(p)])} />
          </Field>
        </div>
        <div className="cma-two">
          <NumberField label={t('Kostenlose Testphase (Tage)')} min={0} max={90} value={f.trial_days} onChange={(v) => set({ trial_days: v ?? 0 })} hint={t('Nur bei monatlicher oder jährlicher Zahlung.')} />
          <NumberField label={t('Kulanz bei Zahlungsproblemen (Tage)')} min={0} max={30} value={f.grace_days} onChange={(v) => set({ grace_days: v ?? 0 })} hint={t('So lange bleibt der Zugang nach einer fehlgeschlagenen Zahlung offen.')} />
        </div>
        <Field label={t('Gibt Zugang zu diesen Kursen')}>
          <div className="cma-chips">
            {(courses.data ?? []).map((c: any) => (
              <label key={c.id} className={`cma-chip${f.course_ids.includes(c.id) ? ' on' : ''}`}>
                <input type="checkbox" checked={f.course_ids.includes(c.id)} onChange={(e) => set({ course_ids: e.target.checked ? [...f.course_ids, c.id] : f.course_ids.filter((x: string) => x !== c.id) })} /> {c.title}
              </label>
            ))}
            {!courses.data?.length && <span className="muted small">{t('Noch keine Kurse.')}</span>}
          </div>
        </Field>
        <Field label={t('Tags für Mitglieder dieser Stufe')}>
          <TagInput value={f.tags} onChange={(v) => set({ tags: v })} />
        </Field>
        <Check checked={!!f.highlight} onChange={(v) => set({ highlight: v ? 1 : 0 })} label={t('Als „Empfohlen“ hervorheben')} />
        <Check checked={!!f.active} onChange={(v) => set({ active: v ? 1 : 0 })} label={t('Auf der Seite anbieten')} />
      </div>
    </Modal>
  );
}

// --- requests & memberships ---------------------------------------------------------------------------------------------------------
function Requests({ group, onDone }: { group: any; onDone: () => void }) {
  const t = useT('community');
  const list = useLoad(() => api.get<any[]>(`/api/community/groups/${group.id}/memberships?status=pending,awaiting_payment&limit=200`), [group.id]);
  const [reject, setReject] = useState<any>(null);
  const [note, setNote] = useState('');
  const act1 = async (m: any, body: any, ok: string) => (await run(() => api.patch(`/api/community/memberships/${m.id}`, body), ok, () => (void list.reload(), onDone())));
  if (!list.data) return <Spinner />;
  return (
    <>
      {list.data.length ? (
        <div className="cma-sec">
          <ul className="cma-list">
            {list.data.map((m) => (
              <li key={m.id}>
                <div className="grow">
                  <div>
                    <strong>{m.name || m.email}</strong> <span className="muted small">{m.email}</span> <StatusBadge status={m.status} />
                  </div>
                  <div className="muted small">
                    {t('Stufe {tier}', { tier: m.tier_name || '–' })} · {t('angefragt {ago}', { ago: ago(m.requested_at) })}
                    {m.coupon_code ? t(' · Code {code}', { code: m.coupon_code }) : ''}
                    {m.invite ? t(' · Einladung „{invite}“', { invite: m.invite }) : ''}
                  </div>
                  {m.answers?.map((a: any) => (
                    <div key={a.question} className="small">
                      <span className="muted">{a.question}</span> → {a.answer}
                    </div>
                  ))}
                </div>
                {m.status === 'pending' ? (
                  <>
                    <button className="btn" onClick={() => act1(m, { action: 'approve' }, t('Freigegeben'))}>
                      {t('Freigeben')}
                    </button>
                    <button className="btn secondary" onClick={() => (setNote(''), setReject(m))}>
                      {t('Ablehnen')}
                    </button>
                  </>
                ) : (
                  <span className="muted small">{t('wartet auf Zahlung')}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <Empty>{t('Keine offenen Anfragen. Neue Anfragen erscheinen hier, sobald jemand die Beitritts-Seite ausfüllt (und du „Anfragen erst freigeben“ aktiviert hast).')}</Empty>
      )}
      {reject && (
        <Modal
          title={t('Anfrage von {name} ablehnen', { name: reject.name || reject.email })}
          onClose={() => setReject(null)}
          footer={
            <button
              className="btn danger"
              onClick={async () => {
                if (await act1(reject, { action: 'reject', note }, t('Abgelehnt'))) setReject(null);
              }}
            >
              {t('Ablehnen')}
            </button>
          }
        >
          <Field label={t('Hinweis an die Person (wird mitgeschickt, freiwillig)')}>
            <Textarea rows={3} value={note} onChange={setNote} autoFocus />
          </Field>
        </Modal>
      )}
    </>
  );
}

function Memberships({ group, data, onDone }: { group: any; data: any; onDone: () => void }) {
  const t = useT('community');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const list = useLoad(() => api.get<any[]>(`/api/community/groups/${group.id}/memberships?limit=300${status ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`), [group.id, status, q]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', tier_id: '' });
  const patch = (m: any, body: any, ok: string) => run(() => api.patch(`/api/community/memberships/${m.id}`, body), ok, () => (void list.reload(), onDone()));
  return (
    <>
      <div className="row" style={{ alignItems: 'center', marginBottom: 12 }}>
        <div style={{ width: 240 }}>
          <Input value={q} onChange={setQ} placeholder={t('Name oder E-Mail …')} />
        </div>
        <div style={{ width: 220 }}>
          <Select value={status} onChange={setStatus} placeholder={t('Alle Status')} options={Object.entries(data.counts).map(([k, n]) => [k, `${k === 'active' ? t('Aktiv') : k === 'trialing' ? t('Testphase') : k === 'past_due' ? t('Zahlung offen') : k === 'canceled' ? t('Beendet') : k === 'rejected' ? t('Abgelehnt') : k === 'pending' ? t('Wartet auf Freigabe') : t('Wartet auf Zahlung')} (${n})`])} />
        </div>
        <button className="btn" onClick={() => setAdding(true)}>
          {t('+ Person hinzufügen')}
        </button>
      </div>
      {!list.data ? (
        <Spinner />
      ) : list.data.length ? (
        <div className="table-wrap">
          <table className="t cma-table">
            <thead>
              <tr>
                <th>{t('Person')}</th>
                <th>{t('Stufe')}</th>
                <th>{t('Status')}</th>
                <th>{t('Seit')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.data.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link to={`contacts/${m.contact_id}`}>{m.name || m.email}</Link>
                    <div className="muted small">{m.email}</div>
                  </td>
                  <td>
                    <Select value={m.tier_id ?? ''} onChange={(v) => v && patch(m, { action: 'tier', tier_id: v }, t('Stufe geändert'))} options={data.tiers.map((tierObj: any) => [tierObj.id, tierObj.name])} placeholder="–" />
                  </td>
                  <td>
                    <StatusBadge status={m.status} />
                    {m.trial_ends_at && m.status === 'trialing' && <div className="muted small">{t('bis {date}', { date: d(m.trial_ends_at) })}</div>}
                    {m.left_reason && m.status === 'canceled' && <div className="muted small">{m.left_reason}</div>}
                  </td>
                  <td className="muted">{d(m.joined_at ?? m.requested_at)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {['active', 'trialing', 'past_due'].includes(m.status) ? (
                      <button className="btn small ghost" onClick={async () => (await confirmAsk(t('{name} aus der Community nehmen?', { name: m.name || m.email }))) && patch(m, { action: 'end' }, t('Zugang beendet'))}>
                        {t('Beenden')}
                      </button>
                    ) : m.status === 'canceled' ? (
                      <button className="btn small secondary" onClick={() => patch(m, { action: 'reactivate' }, t('Wieder aktiv'))}>
                        {t('Wieder freischalten')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{t('Keine Mitgliedschaften.')}</Empty>
      )}
      {adding && (
        <Modal
          title={t('Person hinzufügen')}
          onClose={() => setAdding(false)}
          footer={
            <button
              className="btn"
              disabled={!form.email.includes('@')}
              onClick={async () => {
                if (await act(() => api.post(`/api/community/groups/${group.id}/memberships`, { email: form.email, name: form.name, tier_id: form.tier_id || undefined }), t('Hinzugefügt'))) {
                  setAdding(false);
                  void list.reload();
                  onDone();
                }
              }}
            >
              {t('Hinzufügen')}
            </button>
          }
        >
          <p className="muted" style={{ marginTop: 0 }}>
            {t('Die Person wird sofort Mitglied (kostenlos, ohne Freigabe) und bekommt eine Mail mit dem Link zur Community.')}
          </p>
          <Field label={t('E-Mail-Adresse')}>
            <Input type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} autoFocus />
          </Field>
          <Field label={t('Name (freiwillig)')}>
            <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          </Field>
          <Field label={t('Stufe')}>
            <Select value={form.tier_id} onChange={(v) => setForm({ ...form, tier_id: v })} placeholder={t('Erste aktive Stufe')} options={data.tiers.map((tierObj: any) => [tierObj.id, tierObj.name])} />
          </Field>
        </Modal>
      )}
    </>
  );
}

// --- invites ------------------------------------------------------------------------------------------------------------------------
function Invites({ group, data }: { group: any; data: any }) {
  const t = useT('community');
  const list = useLoad(() => api.get<any[]>(`/api/community/groups/${group.id}/invites`), [group.id]);
  const [f, setF] = useState<any>({ label: '', tier_id: '', skip_approval: false, trial_days: '', max_uses: '', expires_at: '' });
  const create = () =>
    run(
      () => api.post(`/api/community/groups/${group.id}/invites`, { label: f.label, tier_id: f.tier_id || null, skip_approval: f.skip_approval, trial_days: f.trial_days === '' ? null : Number(f.trial_days), max_uses: f.max_uses === '' ? null : Number(f.max_uses), expires_at: f.expires_at ? fromLocalInput(f.expires_at) : null }),
      t('Link erstellt'),
      () => (setF({ label: '', tier_id: '', skip_approval: false, trial_days: '', max_uses: '', expires_at: '' }), void list.reload()),
    );
  return (
    <div className="cma-grid">
      <Sec title={t('Neuer Einladungs-Link')} lead={t('Jeder Link zeigt dir, wer darüber kam und ob die Person bezahlt hat – ideal für Partner, Newsletter oder Social-Media-Beiträge.')}>
        <Field label={t('Bezeichnung (nur für dich)')}>
          <Input value={f.label} onChange={(v) => setF({ ...f, label: v })} placeholder={t('z. B. Instagram-Bio')} />
        </Field>
        <Field label={t('Stufe')}>
          <Select value={f.tier_id} onChange={(v) => setF({ ...f, tier_id: v })} placeholder={t('Wie auf der Seite gewählt')} options={data.tiers.map((tierObj: any) => [tierObj.id, tierObj.name])} />
        </Field>
        <div className="cma-two">
          <NumberField label={t('Eigene Testphase (Tage)')} min={0} max={365} value={f.trial_days === '' ? null : Number(f.trial_days)} onChange={(v) => setF({ ...f, trial_days: v ?? '' })} />
          <NumberField label={t('Höchstens so oft nutzbar')} min={1} value={f.max_uses === '' ? null : Number(f.max_uses)} onChange={(v) => setF({ ...f, max_uses: v ?? '' })} />
        </div>
        <Field label={t('Läuft ab (freiwillig)')}>
          <Input type="datetime-local" value={f.expires_at} onChange={(v) => setF({ ...f, expires_at: v })} />
        </Field>
        <Check checked={f.skip_approval} onChange={(v) => setF({ ...f, skip_approval: v })} label={t('Ohne Freigabe aufnehmen')} />
        <div className="cma-actions">
          <button className="btn" onClick={create}>
            {t('Link erstellen')}
          </button>
        </div>
      </Sec>
      <Sec title={t('Deine Links')}>
        {!list.data ? (
          <Spinner />
        ) : list.data.length ? (
          <ul className="cma-list">
            {list.data.map((i) => (
              <li key={i.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div className="row" style={{ alignItems: 'center' }}>
                  <div className="grow">
                    <strong>{i.label || i.code}</strong> {!i.active && <Badge>{t('Aus')}</Badge>}
                    <div className="muted small">
                      {t('{members} Mitglieder', { members: i.members })}{i.pending ? t(' · {pending} offen', { pending: i.pending }) : ''}
                      {i.max_uses ? t(' · {uses}/{max} genutzt', { uses: i.uses, max: i.max_uses }) : ''}
                      {i.expires_at ? t(' · bis {date}', { date: d(i.expires_at) }) : ''}
                    </div>
                  </div>
                  <button className="btn small secondary" onClick={() => run(() => api.patch(`/api/community/invites/${i.id}`, { active: !i.active }), i.active ? t('Ausgeschaltet') : t('Eingeschaltet'), () => void list.reload())}>
                    {i.active ? t('Ausschalten') : t('Einschalten')}
                  </button>
                  <button className="btn small ghost" aria-label={t('Link löschen')} onClick={async () => (await confirmAsk(t('Link löschen?'))) && run(() => api.del(`/api/community/invites/${i.id}`), t('Gelöscht'), () => void list.reload())}>
                    ✕
                  </button>
                </div>
                {i.url && <CopyField value={i.url} label={t('Link')} />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t('Noch keine Links.')}</p>
        )}
      </Sec>
    </div>
  );
}

// --- discount codes --------------------------------------------------------------------------------------------------------------------
function Coupons({ group, data }: { group: any; data: any }) {
  const t = useT('community');
  const list = useLoad(() => api.get<any[]>(`/api/community/groups/${group.id}/coupons`), [group.id]);
  const blank = { code: '', label: '', kind: 'percent', value: '20', duration: 'once', months: '3', max_uses: '', expires_at: '', tier_id: '' };
  const [f, setF] = useState<any>(blank);
  const create = () =>
    run(
      () =>
        api.post(`/api/community/groups/${group.id}/coupons`, {
          code: f.code,
          label: f.label,
          kind: f.kind,
          ...(f.kind === 'percent' ? { percent_off: Number(f.value) } : { amount_off_cents: Math.round(Number(String(f.value).replace(',', '.')) * 100) }),
          duration: f.duration,
          months: Number(f.months),
          max_uses: f.max_uses === '' ? null : Number(f.max_uses),
          expires_at: f.expires_at ? fromLocalInput(f.expires_at) : null,
          tier_id: f.tier_id || null,
        }),
      t('Code erstellt'),
      () => (setF(blank), void list.reload()),
    );
  return (
    <div className="cma-grid">
      <Sec title={t('Neuer Rabattcode')} lead={t('Gilt für bezahlte Stufen mit monatlicher oder jährlicher Zahlung. Der Rabatt wird im Stripe-Checkout abgezogen.')}>
        {!data.stripe.connected && <div className="cma-note">{t('Stripe ist noch nicht verbunden – Rabattcodes wirken erst mit Stripe.')}</div>}
        <div className="cma-two">
          <Field label={t('Code')}>
            <Input value={f.code} onChange={(v) => setF({ ...f, code: v.toUpperCase() })} placeholder={t('WILLKOMMEN20')} />
          </Field>
          <Field label={t('Bezeichnung (freiwillig)')}>
            <Input value={f.label} onChange={(v) => setF({ ...f, label: v })} />
          </Field>
        </div>
        <div className="cma-two">
          <Field label={t('Rabatt')}>
            <Select value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={[['percent', t('Prozent')], ['amount', t('Betrag in Euro')]]} />
          </Field>
          <Field label={f.kind === 'percent' ? t('Prozent') : t('Euro')}>
            <Input value={f.value} onChange={(v) => setF({ ...f, value: v })} inputMode="decimal" />
          </Field>
        </div>
        <div className="cma-two">
          <Field label={t('Wie lange')}>
            <Select value={f.duration} onChange={(v) => setF({ ...f, duration: v })} options={[['once', t('Nur die erste Zahlung')], ['repeating', t('Mehrere Monate')], ['forever', t('Für immer')]]} />
          </Field>
          {f.duration === 'repeating' && <NumberField label={t('Monate')} min={1} max={36} value={Number(f.months)} onChange={(v) => setF({ ...f, months: String(v ?? 3) })} />}
        </div>
        <div className="cma-two">
          <NumberField label={t('Höchstens so oft nutzbar')} min={1} value={f.max_uses === '' ? null : Number(f.max_uses)} onChange={(v) => setF({ ...f, max_uses: v ?? '' })} />
          <Field label={t('Läuft ab (freiwillig)')}>
            <Input type="datetime-local" value={f.expires_at} onChange={(v) => setF({ ...f, expires_at: v })} />
          </Field>
        </div>
        <Field label={t('Nur für diese Stufe')}>
          <Select value={f.tier_id} onChange={(v) => setF({ ...f, tier_id: v })} placeholder={t('Alle bezahlten Stufen')} options={data.tiers.filter((tierObj: any) => !tierObj.prices.free).map((tierObj: any) => [tierObj.id, tierObj.name])} />
        </Field>
        <div className="cma-actions">
          <button className="btn" onClick={create} disabled={!f.code.trim()}>
            {t('Code erstellen')}
          </button>
        </div>
      </Sec>
      <Sec title={t('Deine Codes')}>
        {!list.data ? (
          <Spinner />
        ) : list.data.length ? (
          <ul className="cma-list">
            {list.data.map((c) => (
              <li key={c.id}>
                <div className="grow">
                  <div>
                    <strong className="cma-mono">{c.code}</strong> {!c.active && <Badge>{t('Aus')}</Badge>}
                  </div>
                  <div className="muted small">
                    {c.text} · {c.uses}
                    {c.max_uses ? `/${c.max_uses}` : ''} genutzt{c.expires_at ? t(' · bis {date}', { date: d(c.expires_at) }) : ''}
                  </div>
                </div>
                <button className="btn small secondary" onClick={() => run(() => api.patch(`/api/community/coupons/${c.id}`, { active: !c.active }), c.active ? t('Ausgeschaltet') : t('Eingeschaltet'), () => void list.reload())}>
                  {c.active ? t('Ausschalten') : t('Einschalten')}
                </button>
                <button className="btn small ghost" aria-label={t('Code löschen')} onClick={async () => (await confirmAsk(t('Code {code} löschen?', { code: c.code }))) && run(() => api.del(`/api/community/coupons/${c.id}`), t('Gelöscht'), () => void list.reload())}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t('Noch keine Codes.')}</p>
        )}
      </Sec>
    </div>
  );
}
