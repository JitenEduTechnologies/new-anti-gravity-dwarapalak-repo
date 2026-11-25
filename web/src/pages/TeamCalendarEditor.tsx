import { useEffect, useState, type MutableRefObject } from 'react';
import { useT } from '../i18n';
import './teamtools.css';
import { Icon } from '../icons';
import { api, dt } from '../api';
import { Badge, Check, Empty, Field, Input, Link, Modal, Select, Spinner, Textarea, act, confirmAsk, toast, useLoad } from '../ui';
import { ShareLink } from '../QrCode';
import { MoreFields } from '../areas/fields';

/**
 * The Team-Kalender part of the calendar editor – type and team, questions of the booking page, payment (Stripe), video link and
 * rules – and the routing forms ("Wobei können wir helfen?" → calendar). One draft per calendar, one save.
 */

// i18n-ignore
const KINDS: [string, string, string][] = [
  // i18n-ignore
  ['single', 'Einzeln', 'Ein Termintyp wie bisher – eine Person oder das Team als Ganzes.'],
  // i18n-ignore
  ['round_robin', 'Round Robin', 'Die Buchung geht reihum an eine freie Person des Teams.'],
  // i18n-ignore
  ['collective', 'Kollektiv', 'Alle Personen müssen frei sein – ein Termin mit allen.'],
  // i18n-ignore
  ['group', 'Gruppe / Klasse', 'Mehrere Teilnehmende pro Termin, mit Plätzen und Warteliste.'],
];
// i18n-ignore
const QTYPES: [string, string][] = [
  // i18n-ignore
  ['text', 'Kurze Antwort'],
  // i18n-ignore
  ['textarea', 'Langer Text'],
  // i18n-ignore
  ['choice', 'Auswahl (eine)'],
  // i18n-ignore
  ['multi', 'Auswahl (mehrere)'],
  // i18n-ignore
  ['checkbox', 'Kontrollkästchen'],
];
// i18n-ignore
const DAYS: [string, string][] = [
  // i18n-ignore
  ['mon', 'Montag'],
  // i18n-ignore
  ['tue', 'Dienstag'],
  // i18n-ignore
  ['wed', 'Mittwoch'],
  // i18n-ignore
  ['thu', 'Donnerstag'],
  // i18n-ignore
  ['fri', 'Freitag'],
  // i18n-ignore
  ['sat', 'Samstag'],
  // i18n-ignore
  ['sun', 'Sonntag'],
];

// i18n-ignore
export const TEAM_TABS: [string, string][] = [
  // i18n-ignore
  ['team', 'Typ & Team'],
  // i18n-ignore
  ['questions', 'Fragen'],
  // i18n-ignore
  ['payment', 'Zahlung'],
  // i18n-ignore
  ['video', 'Video & Regeln'],
];

const centsText = (c: number) => (c ? (c / 100).toFixed(2).replace('.', ',') : '');
const toCents = (t: string) => {
  const n = Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

function Money({ cents, onChange, label, hint }: { cents: number; onChange: (c: number) => void; label: string; hint?: string }) {
  const [text, setText] = useState(centsText(cents));
  return (
    <Field label={label} hint={hint}>
      <input inputMode="decimal" value={text} placeholder="0,00" onChange={(e) => (setText(e.target.value), onChange(toCents(e.target.value)))} onBlur={() => setText(centsText(toCents(text)))} />
    </Field>
  );
}

function Stepper({ value, onChange, min = 1, max = 10, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="tc-step" role="group" aria-label={label}>
      <button type="button" className="tx-btn" aria-label="weniger" disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <strong aria-live="polite">{value}</strong>
      <button type="button" className="tx-btn" aria-label="mehr" disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

function HoursGrid({ value, onChange }: { value: Record<string, string[][]>; onChange: (v: Record<string, string[][]>) => void }) {
  const t = useT('collabws');
  return (
    <div className="tx-hours">
      {DAYS.map(([k, l]) => {
        const w = value[k]?.[0];
        return (
          <div key={k} className="tx-hours-row">
            <Check checked={!!w} onChange={(v) => onChange({ ...value, [k]: v ? [['09:00', '17:00']] : [] })} label={t(l)} />
            <input type="time" aria-label={t('… von').replace('…', t(l))} disabled={!w} value={w?.[0] ?? '09:00'} onChange={(e) => onChange({ ...value, [k]: [[e.target.value, w?.[1] ?? '17:00']] })} />
            <span>–</span>
            <input type="time" aria-label={t('… bis').replace('…', t(l))} disabled={!w} value={w?.[1] ?? '17:00'} onChange={(e) => onChange({ ...value, [k]: [[w?.[0] ?? '09:00', e.target.value]] })} />
          </div>
        );
      })}
    </div>
  );
}

// --- the editor ---------------------------------------------------------------------------------------------------------

export function TeamEditor({ cal, tab, saveRef }: { cal: { id: string; name: string }; tab: string; saveRef: MutableRefObject<(() => Promise<boolean>) | null> }) {
  const t = useT('collabws');
  const detail = useLoad(() => api.get<any>(`/api/team-calendars/${cal.id}`), [cal.id]);
  const meta = useLoad(() => api.get<any>('/api/team-calendars/meta'), []);
  const [draft, setDraft] = useState<{ config: any; members: any[] } | null>(null);
  useEffect(() => {
    if (detail.data) setDraft({ config: structuredClone(detail.data.config), members: detail.data.members.map((m: any) => ({ user_id: m.user_id, name: m.name, weight: m.weight, hours: m.hours, connected: m.connected })) });
  }, [detail.data]);

  const needsMembers = draft ? draft.config.kind !== 'single' : false;
  saveRef.current = async () => {
    if (!draft) return false;
    const r = await act(() =>
      api.put<any>(`/api/team-calendars/${cal.id}`, {
        config: draft.config,
        ...(needsMembers || draft.members.length ? { members: draft.members.map((m) => ({ user_id: m.user_id, weight: m.weight, hours: m.hours ?? null })) } : {}),
      }),
    );
    if (!r) return false;
    toast(t('Team-Einstellungen gespeichert'));
    for (const w of r.warnings ?? []) toast(w);
    void detail.reload();
    return true;
  };

  if (detail.error) return <Empty>{detail.error}</Empty>;
  if (!draft || !meta.data) return <Spinner />;
  const c = draft.config;
  const set = (patch: Record<string, unknown>) => setDraft({ ...draft, config: { ...c, ...patch } });
  const setPay = (patch: Record<string, unknown>) => set({ payment: { ...c.payment, ...patch } });
  const setMembers = (members: any[]) => setDraft({ ...draft, members });

  return (
    <div className="tx-set tc-editor" data-tour="team-calendar-editor">
      {tab === 'team' && (
        <>
          <div className="tc-kinds" role="radiogroup" aria-label={t('Typ des Kalenders')} data-tour="team-kind">
            {KINDS.map(([k, label, text]) => (
              <button key={k} type="button" role="radio" aria-checked={c.kind === k} className={`tc-kind${c.kind === k ? ' on' : ''}`} onClick={() => set({ kind: k })}>
                <strong>{t(label)}</strong>
                <span>{t(text)}</span>
              </button>
            ))}
          </div>
          {needsMembers && (
            <Members
              members={draft.members}
              onChange={setMembers}
              people={meta.data.people}
              weighted={c.kind === 'round_robin' && c.distribution === 'weighted'}
              label={c.kind === 'group' ? t('Leitung') : c.kind === 'collective' ? t('Alle dabei') : 'Team'}
              calId={cal.id}
              onLinked={detail.reload}
            />
          )}
          {c.kind === 'round_robin' && (
            <div className="tc-opts">
              <Field label={t('Wann ist eine Zeit buchbar?')} hint={t('Verfügbarkeit: jede Zeit, zu der mindestens eine Person frei ist. Gleichmäßig: nur solange die freie Person nicht deutlich vor den anderen liegt.')}>
                <Select value={c.strategy} onChange={(v) => set({ strategy: v })} options={[['availability', t('Maximale Verfügbarkeit')], ['equal', t('Gleichmäßig verteilen')]]} />
              </Field>
              <Field label={t('Verteilung')} hint={t('Gewichtet: wer mehr Gewicht hat, bekommt entsprechend mehr Termine.')}>
                <Select value={c.distribution} onChange={(v) => set({ distribution: v })} options={[['even', t('Gleich')], ['weighted', t('Nach Gewicht')]]} />
              </Field>
            </div>
          )}
          {c.kind === 'group' && (
            <>
              <div className="tc-opts">
                <Field label={t('Plätze pro Termin')}>
                  <Input type="number" min={1} max={500} value={c.capacity} onChange={(v) => set({ capacity: Number(v) })} />
                </Field>
                <div className="tc-opts-check">
                  <Check checked={c.waitlist} onChange={(v) => set({ waitlist: v })} label={t('Warteliste, wenn ausgebucht')} />
                </div>
              </div>
              <Waitlist calId={cal.id} />
            </>
          )}
          <h3 className="tx-h">{t('Puffer')}</h3>
          <p className="muted small">{t('Leer = wie im Kalender unter „Allgemein“.')}</p>
          <div className="grid2">
            <Field label={t('Puffer davor (Min.)')}>
              <Input type="number" min={0} value={c.buffer_before ?? ''} placeholder={t('wie Kalender')} onChange={(v) => set({ buffer_before: v === '' ? null : Number(v) })} />
            </Field>
            <Field label={t('Puffer danach (Min.)')}>
              <Input type="number" min={0} value={c.buffer_after ?? ''} placeholder={t('wie Kalender')} onChange={(v) => set({ buffer_after: v === '' ? null : Number(v) })} />
            </Field>
          </div>
        </>
      )}
      {tab === 'questions' && <Questions list={c.questions} onChange={(q) => set({ questions: q })} />}
      {tab === 'payment' && (
        <>
          {!meta.data.stripe && (
            <div className="tc-warn">
              <Icon name="card" size={16} /> {t('Stripe ist noch nicht verbunden.')} <Link to="settings/stripe">{t('Einstellungen → Stripe')}</Link> {t('– erst dann lässt sich Zahlung bei Buchung einschalten.')}
            </div>
          )}
          <Field label={t('Zahlung bei Buchung')} tour="team-payment">
            <Select value={c.payment.mode} onChange={(v) => setPay({ mode: v })} options={[['none', t('Keine – Termin ist kostenlos')], ['full', t('Voller Preis vorab')], ['deposit', t('Anzahlung vorab')]]} />
          </Field>
          {c.payment.mode !== 'none' && (
            <>
              <div className="grid3">
                <Money label={t('Preis (brutto)')} cents={c.payment.amount_cents} onChange={(v) => setPay({ amount_cents: v })} hint={t('Was der Kunde für den ganzen Termin zahlt')} />
                {c.payment.mode === 'deposit' && <Money label={t('Anzahlung (brutto)')} cents={c.payment.deposit_cents} onChange={(v) => setPay({ deposit_cents: v })} hint={t('Wird bei der Buchung bezahlt')} />}
                <Field label={t('Währung')}>
                  <Select value={c.payment.currency} onChange={(v) => setPay({ currency: v })} options={['EUR', 'CHF', 'USD', 'GBP']} />
                </Field>
                <Field label={t('Steuersatz (%)')} hint={t('Leer = Standard aus den Rechnungs-Einstellungen')}>
                  <Input type="number" min={0} max={100} value={c.payment.tax_rate ?? ''} placeholder={t('Standard')} onChange={(v) => setPay({ tax_rate: v === '' ? null : Number(v) })} />
                </Field>
              </div>
              <Field label={t('Bezeichnung auf der Rechnung')} hint={t('Leer = Name des Kalenders')}>
                <Input value={c.payment.title} onChange={(v) => setPay({ title: v })} />
              </Field>
              <div className="grid2">
                <Field label={t('Zeit reservieren (Minuten)')} hint={t('So lange bleibt der Termin für die Zahlung reserviert. Danach ist er wieder frei.')}>
                  <Input type="number" min={30} max={1440} value={c.payment.hold_minutes} onChange={(v) => setPay({ hold_minutes: Number(v) })} />
                </Field>
                <Field label={t('Absage – Erstattung')} hint={t('Gilt, wenn der Kunde innerhalb der Absagefrist (Tab „Video & Regeln“) absagt.')}>
                  <Select value={c.payment.refund} onChange={(v) => setPay({ refund: v })} options={[['auto', t('Automatisch über Stripe erstatten')], ['manual', t('Manuell – das Team bekommt Bescheid')], ['none', t('Keine Erstattung')]]} />
                </Field>
              </div>
              <p className="muted small">{t('Der Termin gilt erst nach der Zahlung. Danach entsteht eine bezahlte Rechnung im Rechnungs-Bereich. Den Text zur Absage und Erstattung schreibst du im Tab „Video & Regeln“.')}</p>
            </>
          )}
        </>
      )}
      {tab === 'video' && (
        <>
          <Field label={t('Video-Link')} tour="team-video">
            <Select value={c.video} onChange={(v) => set({ video: v })} options={[['none', t('Kein Video-Link')], ['meet', 'Google Meet'], ['zoom', 'Zoom'], ['teams', t('Microsoft Teams')], ['static', t('Fester Ort oder Link (aus „Allgemein“)')]]} />
          </Field>
          <VideoHint video={c.video} meta={meta.data} members={draft.members} />
          <h3 className="tx-h">{t('Absagen und Verschieben')}</h3>
          <div className="tx-checks">
            <Check checked={c.allow_cancel} onChange={(v) => set({ allow_cancel: v })} label={t('Kunden dürfen online absagen')} />
            <Check checked={c.allow_reschedule} onChange={(v) => set({ allow_reschedule: v })} label={t('Kunden dürfen online verschieben')} />
          </div>
          <div className="grid2">
            <Field label={t('Absagen bis … Stunden vorher')} hint={t('0 = bis zum Beginn')}>
              <Input type="number" min={0} value={c.cancel_cutoff_hours} onChange={(v) => set({ cancel_cutoff_hours: Number(v) })} />
            </Field>
            <Field label={t('Verschieben bis … Stunden vorher')} hint={t('0 = bis zum Beginn')}>
              <Input type="number" min={0} value={c.reschedule_cutoff_hours} onChange={(v) => set({ reschedule_cutoff_hours: Number(v) })} />
            </Field>
          </div>
          <Field label={t('Text zu Absage und Erstattung')} hint={t('Steht auf der Buchungsseite und der Seite zum Termin, z. B. „Kostenlos stornierbar bis 24 Stunden vorher.“')}>
            <Textarea value={c.policy_text} onChange={(v) => set({ policy_text: v })} rows={3} />
          </Field>
          <Field label={t('Einwilligungstext')}>
            <Textarea value={c.consent_text} onChange={(v) => set({ consent_text: v })} rows={2} />
          </Field>
          <Check checked={c.show_hosts} onChange={(v) => set({ show_hosts: v })} label={t('Gastgeber auf der Bestätigung nennen')} />
          {c.kind !== 'group' && (
            <MoreFields id="tc-durations" values={[(c.durations ?? []).length ? 'x' : '']} label={t('Mehrere Termindauern')}>
              <Field label={t('Weitere Dauern zur Auswahl (Minuten)')} hint={t('Zum Beispiel 60, 90 – Besucher wählen auf der Buchungsseite. Die Dauer unter „Allgemein“ ist die erste Wahl. Nicht bei Kalendern mit Zahlung.')}>
                <DurationsInput value={c.durations ?? []} onChange={(durations) => set({ durations })} />
              </Field>
            </MoreFields>
          )}
          {c.kind !== 'group' && (
            <MoreFields id="tc-multi" values={[(c.multi_max ?? 0) > 1 ? 'x' : '']} label={t('Mehrere Termine auf einmal')}>
              <Field label={t('Termine je Buchung (höchstens)')} hint={t('1 = wie bisher. Besucher wählen mehrere Zeiten und buchen sie mit einem Formular – alle oder keine. Nicht bei Kalendern mit Zahlung.')}>
                <Input type="number" min={1} max={5} value={Math.max(1, c.multi_max ?? 0)} onChange={(v) => set({ multi_max: Number(v) })} />
              </Field>
            </MoreFields>
          )}
          {c.kind !== 'group' && (
            <MoreFields id="tc-guests" values={[c.guests_max || '']} label={t('Gäste')}>
              <Field label={t('Gäste je Buchung (höchstens)')} hint={t('0 = aus. Die Gäste bekommen eine Einladung mit dem Termin; sie werden nicht als Kontakte gespeichert.')}>
                <Input type="number" min={0} max={10} value={c.guests_max ?? 0} onChange={(v) => set({ guests_max: Number(v) })} />
              </Field>
            </MoreFields>
          )}
        </>
      )}
    </div>
  );
}

function VideoHint({ video, meta, members }: { video: string; meta: any; members: any[] }) {
  const t = useT('collabws');
  const info = (p: any) => meta.people.find((x: any) => x.id === p.user_id);
  if (video === 'meet' || video === 'teams') {
    const key = video === 'meet' ? 'google' : 'microsoft';
    const ok = members.filter((m) => info(m)?.[key] || m.connected?.[key]);
    return (
      <p className={ok.length ? 'muted small' : 'tc-warn'}>
        {video === 'meet' ? 'Google Meet' : t('Microsoft Teams')}{t(': Der Link entsteht im verbundenen')} {video === 'meet' ? 'Google' : 'Outlook'}{t('-Kalender des Gastgebers.')}{' '}
        {ok.length ? `${t('Verbunden: ….').replace('…', ok.map((m) => m.name).join(', '))}.` : t('Noch niemand im Team hat einen Kalender verbunden (Einstellungen → Mein Konto) – bis dahin gibt es keinen Link.')}
      </p>
    );
  }
  if (video === 'zoom')
    return meta.zoom ? (
      <p className="muted small">{t('Zoom ist verbunden – für jeden Termin entsteht ein Meeting.')}</p>
    ) : (
      <p className="tc-warn">
        {t('Zoom ist noch nicht eingerichtet.')} <Link to="apps">{t('Apps → Direkt-Verbindungen')}</Link>
      </p>
    );
  if (video === 'static') return <p className="muted small">{t('Der Kontakt bekommt den festen Ort oder Link aus dem Tab „Allgemein“ (Ort / Meeting-Link).')}</p>;
  return null;
}

// --- members ---------------------------------------------------------------------------------------------------------------

function Members({ members, onChange, people, weighted, label, calId, onLinked }: { members: any[]; onChange: (m: any[]) => void; people: any[]; weighted: boolean; label: string; calId: string; onLinked: () => void }) {
  const t = useT('collabws');
  const [add, setAdd] = useState('');
  const [hoursFor, setHoursFor] = useState('');
  const free = people.filter((p) => !members.some((m) => m.user_id === p.id));
  const upd = (i: number, patch: Record<string, unknown>) => onChange(members.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  return (
    <div className="tc-members" data-tour="team-members">
      <h3 className="tx-h">{label}</h3>
      {members.length === 0 && <Empty>{t('Noch niemand – wähle unten Personen aus.')}</Empty>}
      {members.map((m, i) => {
        const p = people.find((x) => x.id === m.user_id);
        const conn = p ?? m.connected ?? {};
        const linked = m.connected?.linked;
        return (
          <div key={m.user_id} className="tc-member">
            <div className="tc-member-main">
              <div className="grow">
                <strong>{m.name}</strong>
                {p?.me && <span className="muted"> {t('(ich)')}</span>}
                <div className="tc-conn">
                  {conn.google && <Badge tone="green">{t('Google verbunden')}</Badge>}
                  {conn.microsoft && <Badge tone="green">{t('Outlook verbunden')}</Badge>}
                  {!conn.google && !conn.microsoft && <Badge tone="yellow">{t('Kein Kalender verbunden – nur Termine hier zählen')}</Badge>}
                  {(conn.google || conn.microsoft) && !linked && <Badge tone="gray">{t('noch nicht mit diesem Kalender verknüpft')}</Badge>}
                </div>
              </div>
              {weighted && <Stepper value={m.weight} label={t('Gewicht von …').replace('…', m.name)} onChange={(v) => upd(i, { weight: v })} />}
              <button type="button" className={`tx-btn${m.hours ? ' on' : ''}`} aria-expanded={hoursFor === m.user_id} onClick={() => setHoursFor(hoursFor === m.user_id ? '' : m.user_id)}>
                <Icon name="schedule" size={16} /> {m.hours ? t('Eigene Zeiten') : t('Zeiten')}
              </button>
              <button type="button" className="tx-btn" aria-label={t('… nach oben').replace('…', m.name)} disabled={i === 0} onClick={() => onChange(members.flatMap((x, j) => (j === i - 1 ? [members[i], x] : j === i ? [] : [x])))}>
                <Icon name="up" size={16} />
              </button>
              <button type="button" className="tx-btn danger" aria-label={t('… entfernen').replace('…', m.name)} onClick={() => onChange(members.filter((_, j) => j !== i))}>
                <Icon name="trash" size={16} />
              </button>
            </div>
            {p?.me && (conn.google || conn.microsoft) && !linked && (
              <button
                type="button"
                className="tx-btn"
                onClick={async () => {
                  if (await act(() => api.post(`/api/team-calendars/${calId}/link-me`, {}), t('Dein Kalender ist verknüpft'))) onLinked();
                }}
              >
                <Icon name="link" size={16} /> {t('Meinen Kalender verknüpfen')}
              </button>
            )}
            {hoursFor === m.user_id && (
              <div className="tc-member-hours">
                <Check checked={!!m.hours} onChange={(v) => upd(i, { hours: v ? { mon: [['09:00', '17:00']], tue: [['09:00', '17:00']], wed: [['09:00', '17:00']], thu: [['09:00', '17:00']], fri: [['09:00', '17:00']] } : null })} label={t('Nur zu eigenen Zeiten buchbar (sonst gelten die Zeiten des Kalenders)')} />
                {m.hours && <HoursGrid value={m.hours} onChange={(h) => upd(i, { hours: h })} />}
              </div>
            )}
          </div>
        );
      })}
      <div className="tx-inline">
        <select aria-label={t('Person hinzufügen')} value={add} onChange={(e) => setAdd(e.target.value)}>
          <option value="">{t('Person hinzufügen…')}</option>
          {free.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="tx-btn primary"
          disabled={!add}
          onClick={() => {
            const p = people.find((x) => x.id === add);
            if (p) onChange([...members, { user_id: p.id, name: p.name, weight: 1, hours: null, connected: { google: p.google, microsoft: p.microsoft, linked: false } }]);
            setAdd('');
          }}
        >
          {t('Hinzufügen')}
        </button>
      </div>
      {people.length === 0 && <p className="muted small">{t('Personen erscheinen hier, wenn sie Zugriff auf den Bereich Kalender haben (Einstellungen → Team).')}</p>}
    </div>
  );
}

function Waitlist({ calId }: { calId: string }) {
  const t = useT('collabws');
  const list = useLoad(() => api.get<any[]>(`/api/team-calendars/${calId}/waitlist`), [calId]);
  if (!list.data?.length) return <p className="muted small">{t('Die Warteliste ist leer. Wird ein Platz frei, bekommt die erste Person eine E-Mail mit einem Link zum Buchen.')}</p>;
  return (
    <div className="tc-wait">
      <h3 className="tx-h">{t('Warteliste')}</h3>
      {list.data.map((w) => (
        <div key={w.id} className="tx-away">
          <span className="grow">
            <strong>{[w.contact.first_name, w.contact.last_name].filter(Boolean).join(' ') || w.contact.email}</strong>
            <span className="muted"> · {dt(w.start_at)}</span>
            {w.status === 'offered' && <Badge tone="blue">{t('Platz angeboten')}</Badge>}
          </span>
          <button
            type="button"
            className="tx-btn"
            onClick={async () => {
              if (await act(() => api.del(`/api/team-calendars/waitlist/${w.id}`))) void list.reload();
            }}
          >
            {t('Entfernen')}
          </button>
        </div>
      ))}
    </div>
  );
}

// --- questions --------------------------------------------------------------------------------------------------------------

function Questions({ list, onChange }: { list: any[]; onChange: (q: any[]) => void }) {
  const t = useT('collabws');
  const upd = (i: number, patch: Record<string, unknown>) => onChange(list.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  return (
    <div data-tour="team-questions">
      <p className="muted small">{t('Fragen erscheinen auf der Buchungsseite unter den Kontaktdaten. Die Antworten stehen im Termin, in der Notiz und in Workflows (')}{'{{appointment.answers_text}}'}).</p>
      {list.length === 0 && <Empty>{t('Noch keine Fragen – zum Beispiel „Worum geht es?“.')}</Empty>}
      {list.map((q, i) => (
        <div key={q.id || i} className="tc-question">
          <div className="tc-question-head">
            <Input value={q.label} aria-label={t('Frage')} placeholder={t('Frage')} onChange={(v) => upd(i, { label: v })} />
            <Select value={q.type} onChange={(v) => upd(i, { type: v })} options={QTYPES.map(([k, l]) => [k, t(l)])} />
          </div>
          {(q.type === 'choice' || q.type === 'multi') && (
            <Field label={t('Antwortmöglichkeiten (eine pro Zeile)')}>
              <Textarea value={Array.isArray(q.options) ? q.options.join('\n') : q.options} rows={3} onChange={(v) => upd(i, { options: v.split('\n') })} />
            </Field>
          )}
          <Field label={t('Hilfetext (optional)')}>
            <Input value={q.help} onChange={(v) => upd(i, { help: v })} />
          </Field>
          {i > 0 && <QuestionCondition q={q} earlier={list.slice(0, i)} onChange={(show_if) => upd(i, { show_if })} />}
          <div className="tc-question-foot">
            <Check checked={q.required} onChange={(v) => upd(i, { required: v })} label={t('Pflichtfeld')} />
            <span className="grow" />
            <button type="button" className="tx-btn" aria-label={t('Frage nach oben')} disabled={i === 0} onClick={() => onChange(list.flatMap((x, j) => (j === i - 1 ? [list[i], x] : j === i ? [] : [x])))}>
              <Icon name="up" size={16} />
            </button>
            <button type="button" className="tx-btn" aria-label={t('Frage nach unten')} disabled={i === list.length - 1} onClick={() => onChange(list.flatMap((x, j) => (j === i ? [list[i + 1]] : j === i + 1 ? [list[i]] : [x])))}>
              <Icon name="down" size={16} />
            </button>
            <button type="button" className="tx-btn danger" aria-label={t('Frage löschen')} onClick={() => onChange(list.filter((_, j) => j !== i))}>
              <Icon name="trash" size={16} />
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="tx-btn" disabled={list.length >= 20} onClick={() => onChange([...list, { id: '', label: '', type: 'text', required: false, options: [], help: '' }])}>
        {t('+ Frage hinzufügen')}
      </button>
    </div>
  );
}

/** Minutes as typed ("60, 90"); the list is taken over when the field is left. */
function DurationsInput({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const [text, setText] = useState(value.join(', '));
  return <Input value={text} onChange={setText} onBlur={() => onChange(text.split(/[\s,;]+/).filter(Boolean).map(Number).filter((n) => Number.isFinite(n) && n > 0))} placeholder="60, 90" inputMode="numeric" />;
}

/** Conditional logic: ask this question only when an earlier choice or yes/no question got one of the chosen answers. */
function QuestionCondition({ q, earlier, onChange }: { q: any; earlier: any[]; onChange: (v: { id: string; values: string[] } | undefined) => void }) {
  const t = useT('collabws');
  const refs = earlier.filter((x) => x.id && ['choice', 'multi', 'checkbox'].includes(x.type));
  const ref = refs.find((x) => x.id === q.show_if?.id);
  const answers: string[] = ref ? (ref.type === 'checkbox' ? [t('Ja'), t('Nein')] : (Array.isArray(ref.options) ? ref.options : []).filter(Boolean)) : [];
  const values: string[] = q.show_if?.values ?? [];
  return (
    <MoreFields id={`tc-q-cond-${q.id || 'neu'}`} values={[q.show_if?.id]} label={t('Bedingung')}>
      {refs.length ? (
        <>
          <Field label={t('Nur fragen, wenn diese Frage …')} hint={t('Neue Auswahlfragen erst speichern, dann hier wählen.')}>
            <Select value={ref?.id ?? ''} onChange={(v) => onChange(v ? { id: v, values: [] } : undefined)} options={[['', t('Immer fragen')], ...refs.map((x) => [x.id, x.label || t('Frage')] as [string, string])]} />
          </Field>
          {ref && (
            <Field label={t('… so beantwortet wurde')}>
              {answers.map((a) => (
                <Check key={a} checked={values.includes(a)} onChange={(on) => onChange({ id: ref.id, values: on ? [...values, a] : values.filter((x) => x !== a) })} label={a} />
              ))}
            </Field>
          )}
        </>
      ) : (
        <p className="muted small">{t('Bedingungen gehen mit einer früheren, gespeicherten Auswahl- oder Ja/Nein-Frage.')}</p>
      )}
    </MoreFields>
  );
}

// --- routing forms -----------------------------------------------------------------------------------------------------------

export function RoutingForms({ calendars }: { calendars: any[] }) {
  const t = useT('collabws');
  const list = useLoad(() => api.get<any[]>('/api/team-routing'), []);
  const [edit, setEdit] = useState<any>(null);
  return (
    <div data-tour="team-routing">
      <p className="muted">
        {t('Ein Routing-Formular stellt eine Frage – „Wobei können wir helfen?“ – und führt jeden zum passenden Kalender. Die Antwort steht danach im Termin.')}
      </p>
      <div className="actions">
        <button className="tx-btn primary" disabled={!calendars.length} onClick={() => setEdit({ name: '', question: t('Wobei können wir helfen?'), intro: '', color: '#2563eb', options: [{ label: '', calendar_id: calendars[0]?.id ?? '' }, { label: '', calendar_id: calendars[0]?.id ?? '' }] })}>
          {t('+ Routing-Formular')}
        </button>
      </div>
      {!list.data ? (
        <Spinner />
      ) : list.data.length === 0 ? (
        <Empty>{t('Noch kein Routing-Formular.')}</Empty>
      ) : (
        list.data.map((r) => (
          <div key={r.id} className="card tc-route">
            <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ margin: 0 }}>
                  {r.name} {!r.active && <Badge>inaktiv</Badge>}
                </h2>
                <span className="muted">
                  „{r.question}“ · {r.options.length} {t('Antworten')}
                </span>
              </div>
              <div className="actions">
                <a className="tx-btn" href={r.url} target="_blank" rel="noreferrer">
                  {t('Öffnen ↗')}
                </a>
                <button className="tx-btn" onClick={() => setEdit(r)}>
                  {t('Bearbeiten')}
                </button>
                <button className="tx-btn" onClick={() => act(() => api.patch(`/api/team-routing/${r.id}`, { active: !r.active })).then(list.reload)}>
                  {r.active ? t('Deaktivieren') : t('Aktivieren')}
                </button>
                <button className="tx-btn danger" onClick={() => confirmAsk(t('„…“ löschen?').replace('…', r.name)) && act(() => api.del(`/api/team-routing/${r.id}`)).then(list.reload)}>
                  {t('Löschen')}
                </button>
              </div>
            </div>
            <ul className="tc-route-opts">
              {r.options.map((o: any) => (
                <li key={o.id}>
                  {o.label} <span className="muted">→ {calendars.find((c) => c.id === o.calendar_id)?.name ?? t('(Kalender gelöscht)')}</span>
                </li>
              ))}
            </ul>
            <ShareLink url={r.url} title={t('Routing-Formular …').replace('…', r.name)} />
          </div>
        ))
      )}
      {edit && <RouteEditor route={edit} calendars={calendars} onClose={() => setEdit(null)} onSaved={() => (setEdit(null), list.reload())} />}
    </div>
  );
}

function RouteEditor({ route, calendars, onClose, onSaved }: { route: any; calendars: any[]; onClose: () => void; onSaved: () => void }) {
  const t = useT('collabws');
  const [r, setR] = useState<any>(structuredClone(route));
  const setOpt = (i: number, patch: Record<string, unknown>) => setR({ ...r, options: r.options.map((o: any, j: number) => (j === i ? { ...o, ...patch } : o)) });
  const save = async () => {
    const body = { name: r.name, question: r.question, intro: r.intro, color: r.color, options: r.options };
    const res = await act(() => (route.id ? api.patch(`/api/team-routing/${route.id}`, body) : api.post('/api/team-routing', body)), t('Gespeichert'));
    if (res) onSaved();
  };
  return (
    <Modal
      title={route.id ? t('Routing-Formular: …').replace('…', route.name) : t('Neues Routing-Formular')}
      wide
      onClose={onClose}
      footer={
        <button className="tx-btn primary" onClick={save}>
          {t('Speichern')}
        </button>
      }
    >
      <div className="tx-set">
        <div className="grid2">
          <Field label={t('Name (nur für dich)')}>
            <Input value={r.name} onChange={(v) => setR({ ...r, name: v })} placeholder={t('Anliegen')} />
          </Field>
          <Field label={t('Farbe')}>
            <input type="color" value={r.color} onChange={(e) => setR({ ...r, color: e.target.value })} />
          </Field>
        </div>
        <Field label={t('Frage')}>
          <Input value={r.question} onChange={(v) => setR({ ...r, question: v })} />
        </Field>
        <Field label={t('Einleitung (optional)')}>
          <Textarea value={r.intro} onChange={(v) => setR({ ...r, intro: v })} rows={2} />
        </Field>
        <h3 className="tx-h">{t('Antworten')}</h3>
        {r.options.map((o: any, i: number) => (
          <div key={o.id ?? i} className="tc-route-opt">
            <Input value={o.label} aria-label={t('Antwort …').replace('…', String(i + 1))} placeholder={t('z. B. Ich möchte ein Angebot')} onChange={(v) => setOpt(i, { label: v })} />
            <Select value={o.calendar_id} onChange={(v) => setOpt(i, { calendar_id: v })} options={calendars.map((c) => [c.id, c.name])} />
            <button type="button" className="tx-btn danger" aria-label={t('Antwort entfernen')} disabled={r.options.length <= 1} onClick={() => setR({ ...r, options: r.options.filter((_: any, j: number) => j !== i) })}>
              <Icon name="trash" size={16} />
            </button>
          </div>
        ))}
        <button type="button" className="tx-btn" disabled={r.options.length >= 12} onClick={() => setR({ ...r, options: [...r.options, { label: '', calendar_id: calendars[0]?.id ?? '' }] })}>
          {t('+ Antwort')}
        </button>
      </div>
    </Modal>
  );
}
