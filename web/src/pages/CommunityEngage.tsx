import { useState } from 'react';
import { api, d, dt } from '../api';
import { Badge, Check, Empty, Field, Input, Modal, Select, Spinner, Textarea, act, confirmAsk, useLoad } from '../ui';
import { useT } from '../i18n';
import { MarkdownEditor } from './ContentKit';
import { MemberPick, NumberField, Sec, Sub, run } from './CommunityParts';

/**
 * Community → Aktivierung: badges (by hand or by rule), perks and channels that open with a level or a tier, challenges with daily
 * check-ins, live calls with a Jitsi room, and points (what earns them, monthly reset, archive). Server side:
 * modules/community-gamify.ts, community-challenges.ts and community-live.ts.
 */

export function EngageTab({ group, onChange }: { group: any; onChange: () => void }) {
  const t = useT('community');
  const [sub, setSub] = useState('badges');
  return (
    <div className="cma" data-tour="community-engage">
      <Sub
        value={sub}
        onChange={setSub}
        tabs={[
          ['badges', t('Abzeichen')],
          ['perks', t('Vorteile & Freischaltungen')],
          ['challenges', t('Challenges')],
          ['live', t('Live-Calls')],
          ['points', t('Punkte & Rangliste')],
        ]}
      />
      {sub === 'badges' && <Badges group={group} />}
      {sub === 'perks' && <Perks group={group} />}
      {sub === 'challenges' && <Challenges group={group} />}
      {sub === 'live' && <Live group={group} onChange={onChange} />}
      {sub === 'points' && <Points group={group} />}
    </div>
  );
}

// --- badges -------------------------------------------------------------------------------------------------------------------
function Badges({ group }: { group: any }) {
  const t = useT('community');
  const r = useLoad(() => api.get<any>(`/api/community/groups/${group.id}/badges`), [group.id]);
  const [edit, setEdit] = useState<any>(null);
  const [award, setAward] = useState<any>(null);
  if (!r.data) return <Spinner />;
  return (
    <>
      <div className="cma-grid">
        {r.data.badges.map((b: any) => (
          <Sec key={b.id} title={`${b.emoji || '🏅'} ${b.name}`} lead={b.description || undefined}>
            <div className="cma-chips">
              <Badge tone={b.rule.type === 'manual' ? 'gray' : 'blue'}>{b.rule.type === 'manual' ? t('Von Hand') : `${r.data.rules[b.rule.type]}: ${b.rule.value}`}</Badge>
              {b.points > 0 && <Badge tone="green">{t('+{n} Punkte', { n: b.points })}</Badge>}
              <Badge>{t('{n} vergeben', { n: b.awarded })}</Badge>
            </div>
            <div className="cma-actions">
              <button className="btn secondary" onClick={() => setEdit(b)}>
                {t('Bearbeiten')}
              </button>
              <button className="btn" onClick={() => setAward(b)}>
                {t('Vergeben')}
              </button>
            </div>
          </Sec>
        ))}
        <Sec title={t('Neues Abzeichen')} lead={t('Abzeichen erscheinen auf dem Profil. Du vergibst sie von Hand oder lässt sie sich nach einer Regel selbst verdienen (z. B. 10 Beiträge, 30 Tage in Folge aktiv).')}>
          <button className="btn" onClick={() => setEdit({ name: '', emoji: '🏅', color: '', description: '', points: 0, rule: { type: 'manual', value: 0 } })}>
            {t('+ Abzeichen anlegen')}
          </button>
          {r.data.badges.some((b: any) => b.rule.type !== 'manual') && (
            <div className="cma-actions">
              <button className="btn secondary" onClick={() => run(() => api.post(`/api/community/groups/${group.id}/badges/evaluate`), t('Geprüft'), () => void r.reload())}>
                {t('Regeln jetzt für alle prüfen')}
              </button>
            </div>
          )}
        </Sec>
      </div>
      {edit && <BadgeEditor group={group} badge={edit} rules={r.data.rules} onClose={() => setEdit(null)} onDone={() => (setEdit(null), void r.reload())} />}
      {award && <AwardModal group={group} badge={award} onClose={() => setAward(null)} onDone={() => void r.reload()} />}
    </>
  );
}

function BadgeEditor({ group, badge, rules, onClose, onDone }: { group: any; badge: any; rules: Record<string, string>; onClose: () => void; onDone: () => void }) {
  const t = useT('community');
  const [f, setF] = useState<any>({ ...badge, rule: { ...badge.rule } });
  const [preview, setPreview] = useState<number | null>(null);
  const set = (patch: any) => setF((x: any) => ({ ...x, ...patch }));
  const body = { name: f.name, description: f.description, emoji: f.emoji, color: f.color, points: f.points || 0, rule: f.rule };
  const showPreview = async () => {
    const r = await act(() => api.get<any>(`/api/community/groups/${group.id}/badges/preview?type=${f.rule.type}&value=${f.rule.value}`));
    if (r) setPreview(r.qualifying);
  };
  return (
    <Modal
      title={badge.id ? t('Abzeichen „{name}“', { name: badge.name }) : t('Neues Abzeichen')}
      onClose={onClose}
      footer={
        <>
          {badge.id && (
            <button className="btn danger" onClick={async () => (await confirmAsk(t('Abzeichen „{name}“ löschen? Es verschwindet bei allen Mitgliedern.', { name: badge.name }))) && (await act(() => api.del(`/api/community/badges/${badge.id}`), t('Gelöscht'))) && onDone()}>
              {t('Löschen')}
            </button>
          )}
          <button className="btn" disabled={!f.name.trim()} onClick={async () => (await act(() => (badge.id ? api.patch(`/api/community/badges/${badge.id}`, body) : api.post(`/api/community/groups/${group.id}/badges`, body)), t('Gespeichert'))) && onDone()}>
            {t('Speichern')}
          </button>
        </>
      }
    >
      <div className="cma">
        <div className="cma-two">
          <Field label={t('Name')}>
            <Input value={f.name} maxLength={60} onChange={(v) => set({ name: v })} autoFocus />
          </Field>
          <Field label={t('Symbol (Emoji)')}>
            <Input value={f.emoji} maxLength={4} onChange={(v) => set({ emoji: v })} />
          </Field>
        </div>
        <Field label={t('Beschreibung')}>
          <Input value={f.description} maxLength={300} onChange={(v) => set({ description: v })} placeholder={t('z. B. Von Anfang an dabei')} />
        </Field>
        <div className="cma-two">
          <Field label={t('Farbe (freiwillig)')}>
            <Input type="color" value={f.color || '#2563eb'} onChange={(v) => set({ color: v })} />
          </Field>
          <NumberField label={t('Bonuspunkte')} min={0} max={1000} value={f.points} onChange={(v) => set({ points: v ?? 0 })} />
        </div>
        <Field label={t('Wie bekommt man es?')}>
          <Select value={f.rule.type} onChange={(v) => (set({ rule: { type: v, value: v === 'manual' ? 0 : f.rule.value || 1 } }), setPreview(null))} options={Object.entries(rules)} />
        </Field>
        {f.rule.type !== 'manual' && (
          <>
            <NumberField label={t('Ab wie viel')} min={1} value={f.rule.value} onChange={(v) => (set({ rule: { ...f.rule, value: v ?? 1 } }), setPreview(null))} />
            <div className="cma-actions" style={{ marginTop: 0 }}>
              <button className="btn secondary" onClick={showPreview}>
                {t('Wer erfüllt das schon?')}
              </button>
              {preview !== null && <span>{t('{n} Mitglieder', { n: preview })}</span>}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function AwardModal({ group, badge, onClose, onDone }: { group: any; badge: any; onClose: () => void; onDone: () => void }) {
  const t = useT('community');
  const [reason, setReason] = useState('');
  const awards = useLoad(() => api.get<any[]>(`/api/community/badges/${badge.id}/awards`), [badge.id]);
  const give = async (m: any) => {
    const r = await act(() => api.post<any>(`/api/community/badges/${badge.id}/award`, { contact_id: m.contact_id, reason }));
    if (r) {
      void awards.reload();
      onDone();
    }
  };
  return (
    <Modal title={t('„{name}“ vergeben', { name: badge.name })} onClose={onClose} wide>
      <div className="cma">
        <Field label={t('Grund (freiwillig, nur für dich)')}>
          <Input value={reason} onChange={setReason} />
        </Field>
        <MemberPick group={group} onPick={give} />
        <h4 style={{ margin: '8px 0 0' }}>{t('Haben es schon ({n})', { n: awards.data?.length ?? 0 })}</h4>
        <ul className="cma-list">
          {(awards.data ?? []).map((a) => (
            <li key={a.contact_id}>
              <div className="grow">
                <strong>{a.name}</strong>
                <div className="muted small">
                  {d(a.awarded_at)}
                  {a.awarded_by ? ` · ${a.awarded_by}` : t(' · automatisch')}
                  {a.reason ? ` · ${a.reason}` : ''}
                </div>
              </div>
              <button className="btn small ghost" onClick={async () => (await act(() => api.del(`/api/community/badges/${badge.id}/award/${a.contact_id}`), t('Zurückgenommen'))) && (void awards.reload(), onDone())}>
                {t('Zurücknehmen')}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

// --- perks and unlocks ------------------------------------------------------------------------------------------------------------------
function Perks({ group }: { group: any }) {
  const t = useT('community');
  const unlocks = useLoad(() => api.get<any[]>(`/api/community/groups/${group.id}/unlocks`), [group.id]);
  const rules = useLoad(() => api.get<any[]>(`/api/community/groups/${group.id}/channel-rules`), [group.id]);
  const join = useLoad(() => api.get<any>(`/api/community/groups/${group.id}/join`), [group.id]);
  const [edit, setEdit] = useState<any>(null);
  if (!unlocks.data || !rules.data) return <Spinner />;
  const tiers: any[] = join.data?.tiers ?? [];
  const saveRule = (c: any, patch: any) => run(() => api.put(`/api/community/channels/${c.channel_id}/rules`, { min_level: c.min_level, tier_ids: c.tier_ids, ...patch }), t('Gespeichert'), () => void rules.reload());
  return (
    <>
      <div className="cma-grid">
        <Sec title={t('Was sich bei welchem Level öffnet')} lead={t('Kurse stellst du unter Einstellungen → Level ein. Hier kommen Gutscheincodes, Downloads, Links und Texte dazu – und gesperrte Kanäle (rechts).')}>
          <ul className="cma-list">
            {unlocks.data.map((l) => (
              <li key={l.level} style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <strong>
                    {t('Level {level}: {name}', { level: l.level, name: l.name })}
                  </strong>{' '}
                  <span className="muted small">{t('ab {points} Punkten', { points: l.points })}</span>
                  {l.courses.map((c: string) => (
                    <div key={c} className="small">
                      {t('🎓 Kurs: {name}', { name: c })}
                    </div>
                  ))}
                  {l.channels.map((c: string) => (
                    <div key={c} className="small">
                      {t('💬 Kanal: {name}', { name: c })}
                    </div>
                  ))}
                  {l.perks.map((p: any) => (
                    <div key={p.id} className="small">
                      <button className="btn small ghost" style={{ minHeight: 36 }} onClick={() => setEdit(p)}>
                        {p.kind === 'coupon' ? '🎟️' : p.kind === 'file' ? '📥' : p.kind === 'link' ? '🔗' : '📝'} {p.title}
                      </button>
                    </div>
                  ))}
                </div>
                <button className="btn small secondary" onClick={() => setEdit({ kind: 'coupon', level: l.level, title: '', body: '', note: '' })}>
                  {t('+ Vorteil')}
                </button>
              </li>
            ))}
          </ul>
        </Sec>
        <Sec title={t('Kanäle freischalten')} lead={t('Ein Kanal kann ab einem Level oder nur für bestimmte Stufen offen sein. Wer ihn noch nicht öffnen darf, sieht den Grund. Team und Moderatoren sehen alles.')}>
          {rules.data.length ? (
            <ul className="cma-list">
              {rules.data.map((c) => (
                <li key={c.channel_id} style={{ alignItems: 'flex-start' }}>
                  <div className="grow">
                    <strong>
                      {c.emoji} {c.name}
                    </strong>
                    {c.admin_only && <span className="muted small">{t(' · nur Team')}</span>}
                    {tiers.length > 1 && (
                      <div className="cma-chips" style={{ marginTop: 6 }}>
                        {tiers.map((tierObj) => (
                          <label key={tierObj.id} className={`cma-chip${c.tier_ids.includes(tierObj.id) ? ' on' : ''}`}>
                            <input type="checkbox" checked={c.tier_ids.includes(tierObj.id)} onChange={(e) => saveRule(c, { tier_ids: e.target.checked ? [...c.tier_ids, tierObj.id] : c.tier_ids.filter((x: string) => x !== tierObj.id) })} /> {tierObj.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ width: 150 }}>
                    <Select value={String(c.min_level)} onChange={(v) => saveRule(c, { min_level: Number(v) })} options={unlocks.data!.map((l) => [String(l.level), l.level === 1 ? t('Von Anfang an') : t('Ab Level {n}', { n: l.level })])} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{t('Die Gruppe hat noch keine Kanäle.')}</p>
          )}
        </Sec>
      </div>
      {edit && <PerkEditor group={group} perk={edit} levels={unlocks.data} onClose={() => setEdit(null)} onDone={() => (setEdit(null), void unlocks.reload())} />}
    </>
  );
}

function PerkEditor({ group, perk, levels, onClose, onDone }: { group: any; perk: any; levels: any[]; onClose: () => void; onDone: () => void }) {
  const t = useT('community');
  const [f, setF] = useState<any>({ ...perk });
  const [file, setFile] = useState<{ name: string; data: string } | null>(null);
  const set = (patch: any) => setF((x: any) => ({ ...x, ...patch }));
  const perkKinds: [string, string][] = [['coupon', t('Gutscheincode')], ['file', t('Download')], ['link', t('Link')], ['text', t('Text')]];
  const pick = (el: HTMLInputElement) => {
    const fl = el.files?.[0];
    if (!fl) return;
    if (fl.size > 8 * 1024 * 1024) return void alert(t('Die Datei ist größer als 8 MB.'));
    const rd = new FileReader();
    rd.onload = () => setFile({ name: fl.name, data: String(rd.result) });
    rd.readAsDataURL(fl);
  };
  const save = async () => {
    const body: any = { kind: f.kind, level: f.level, title: f.title, body: f.body, note: f.note };
    if (f.kind === 'file' && file) body.file = file;
    const r = await act(async () => {
      if (!perk.id) return api.post(`/api/community/groups/${group.id}/perks`, body);
      const x = await api.patch(`/api/community/perks/${perk.id}`, body);
      if (f.kind === 'file' && file) await api.put(`/api/community/perks/${perk.id}/file`, file);
      return x;
    }, t('Gespeichert'));
    if (r) onDone();
  };
  return (
    <Modal
      title={perk.id ? t('Vorteil „{title}“', { title: perk.title }) : t('Neuer Vorteil')}
      onClose={onClose}
      footer={
        <>
          {perk.id && (
            <button className="btn danger" onClick={async () => (await confirmAsk(t('Vorteil löschen?'))) && (await act(() => api.del(`/api/community/perks/${perk.id}`), t('Gelöscht'))) && onDone()}>
              {t('Löschen')}
            </button>
          )}
          <button className="btn" disabled={!f.title.trim() || (f.kind !== 'file' && !f.body?.trim() && !perk.id)} onClick={save}>
            {t('Speichern')}
          </button>
        </>
      }
    >
      <div className="cma">
        <div className="cma-two">
          <Field label={t('Art')}>
            <Select value={f.kind} onChange={(v) => set({ kind: v })} options={perkKinds} />
          </Field>
          <Field label={t('Freigeschaltet ab')}>
            <Select value={String(f.level)} onChange={(v) => set({ level: Number(v) })} options={levels.map((l) => [String(l.level), `Level ${l.level}: ${l.name}`])} />
          </Field>
        </div>
        <Field label={t('Titel')}>
          <Input value={f.title} maxLength={120} onChange={(v) => set({ title: v })} autoFocus placeholder={t('z. B. 20 % auf alle Kurse')} />
        </Field>
        {f.kind === 'coupon' && (
          <Field label={t('Gutscheincode')} hint={t('Ohne Leerzeichen. Den passenden Rabattcode legst du bei den Produkten oder unter Beitritt → Rabattcodes an.')}>
            <Input value={f.body} maxLength={80} onChange={(v) => set({ body: v })} />
          </Field>
        )}
        {f.kind === 'link' && (
          <Field label={t('Link (https://)')}>
            <Input value={f.body} onChange={(v) => set({ body: v })} placeholder="https://…" />
          </Field>
        )}
        {f.kind === 'text' && (
          <Field label={t('Text')}>
            <Textarea rows={5} value={f.body} onChange={(v) => set({ body: v })} />
          </Field>
        )}
        {f.kind === 'file' && (
          <div className="cma-drop">
            <p style={{ marginTop: 0 }}>{file ? <strong>{file.name}</strong> : perk.filename ? <>{t('Aktuell: {name}', { name: perk.filename })}</> : t('PDF, ZIP, Bilder, Office-Dateien – bis 8 MB')}</p>
            <input type="file" onChange={(e) => pick(e.target)} aria-label={t('Datei wählen')} />
          </div>
        )}
        <Field label={t('Hinweis für Mitglieder (freiwillig)')}>
          <Input value={f.note ?? ''} maxLength={400} onChange={(v) => set({ note: v })} placeholder={t('z. B. Gültig bis Jahresende')} />
        </Field>
      </div>
    </Modal>
  );
}

// --- challenges -------------------------------------------------------------------------------------------------------------------------
const ymd = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

function Challenges({ group }: { group: any }) {
  const t = useT('community');
  const list = useLoad(() => api.get<any[]>(`/api/community/groups/${group.id}/challenges`), [group.id]);
  const badges = useLoad(() => api.get<any>(`/api/community/groups/${group.id}/badges`), [group.id]);
  const [edit, setEdit] = useState<any>(null);
  const [view, setView] = useState<any>(null);
  if (!list.data) return <Spinner />;
  const open = async (c: any) => setEdit(await act(() => api.get<any>(`/api/community/challenges/${c.id}`)));
  return (
    <>
      <div className="cma-grid">
        {list.data.map((c) => (
          <Sec key={c.id} title={`${c.emoji || '🔥'} ${c.title}`} lead={t('{starts} – {ends} · {days} Tage · Ziel: {goal} Check-ins', { starts: d(c.starts_on), ends: d(c.ends_on), days: c.days, goal: c.goal_days })}>
            <div className="cma-chips">
              <Badge tone={c.status === 'active' ? 'green' : c.status === 'draft' ? 'gray' : 'blue'}>{c.status === 'active' ? t('Offen') : c.status === 'draft' ? t('Entwurf') : t('Archiviert')}</Badge>
              <Badge tone={c.phase === 'running' ? 'yellow' : 'gray'}>{c.phase === 'running' ? t('Läuft') : c.phase === 'upcoming' ? t('Startet bald') : t('Vorbei')}</Badge>
              <Badge>{t('{members} Teilnehmer', { members: c.members })}</Badge>
              <Badge tone="green">{t('{done} geschafft', { done: c.done })}</Badge>
            </div>
            <div className="cma-actions">
              <button className="btn secondary" onClick={() => open(c)}>
                {t('Bearbeiten')}
              </button>
              <button className="btn secondary" onClick={() => setView(c)}>
                {t('Teilnehmer')}
              </button>
            </div>
          </Sec>
        ))}
        <Sec title={t('Neue Challenge')} lead={t('Eine Aufgabe auf Zeit – z. B. „30 Tage Schreiben“. Mitglieder checken täglich ein, sammeln Punkte und stehen auf einer eigenen Rangliste.')}>
          <button className="btn" onClick={() => setEdit({ title: '', emoji: '🔥', description: '', starts_on: ymd(1), ends_on: ymd(30), goal_days: null, status: 'draft', points_checkin: null, points_complete: null, badge_id: '', require_note: false, reminder_hour: 18, tasks: [] })}>
            {t('+ Challenge anlegen')}
          </button>
        </Sec>
      </div>
      {edit && <ChallengeEditor group={group} challenge={edit} badges={badges.data?.badges ?? []} onClose={() => setEdit(null)} onDone={() => (setEdit(null), void list.reload())} />}
      {view && <Participants challenge={view} onClose={() => setView(null)} />}
    </>
  );
}

function ChallengeEditor({ group, challenge, badges, onClose, onDone }: { group: any; challenge: any; badges: any[]; onClose: () => void; onDone: () => void }) {
  const t = useT('community');
  const [f, setF] = useState<any>({ ...challenge, badge_id: challenge.badge_id ?? '', tasks: challenge.tasks ?? [] });
  const set = (patch: any) => setF((x: any) => ({ ...x, ...patch }));
  const days = Math.max(1, Math.round((Date.parse(f.ends_on) - Date.parse(f.starts_on)) / 864e5) + 1) || 1;
  const task = (day: number) => f.tasks.find((taskItem: any) => taskItem.day === day);
  const setTask = (day: number, patch: any) => {
    const cur = task(day);
    const next = { ...(cur ?? { day, title: '', body: '' }), ...patch };
    set({ tasks: [...f.tasks.filter((taskItem: any) => taskItem.day !== day), ...(next.title || next.body ? [next] : [])].sort((a: any, b: any) => a.day - b.day) });
  };
  const body = () => ({
    title: f.title,
    emoji: f.emoji,
    description: f.description,
    starts_on: f.starts_on,
    ends_on: f.ends_on,
    goal_days: f.goal_days ?? undefined,
    status: f.status,
    points_checkin: f.points_checkin,
    points_complete: f.points_complete,
    badge_id: f.badge_id || null,
    require_note: !!f.require_note,
    reminder_hour: f.reminder_hour,
    tasks: f.tasks.filter((taskItem: any) => taskItem.title.trim() && taskItem.day <= days),
  });
  const save = async () => (await act(() => (challenge.id ? api.patch(`/api/community/challenges/${challenge.id}`, body()) : api.post(`/api/community/groups/${group.id}/challenges`, body())), t('Gespeichert'))) && onDone();
  return (
    <Modal
      title={challenge.id ? t('Challenge „{title}“', { title: challenge.title }) : t('Neue Challenge')}
      onClose={onClose}
      wide
      footer={
        <>
          {challenge.id && (
            <button className="btn danger" onClick={async () => (await confirmAsk(t('Challenge „{title}“ mit allen Check-ins löschen?', { title: challenge.title }))) && (await act(() => api.del(`/api/community/challenges/${challenge.id}`), t('Gelöscht'))) && onDone()}>
              {t('Löschen')}
            </button>
          )}
          <button className="btn" disabled={!f.title.trim()} onClick={save}>
            {t('Speichern')}
          </button>
        </>
      }
    >
      <div className="cma">
        <div className="cma-two">
          <Field label={t('Titel')}>
            <Input value={f.title} maxLength={120} onChange={(v) => set({ title: v })} autoFocus />
          </Field>
          <Field label={t('Symbol')}>
            <Input value={f.emoji} maxLength={4} onChange={(v) => set({ emoji: v })} />
          </Field>
        </div>
        <Field label={t('Beschreibung (Markdown)')}>
          <MarkdownEditor value={f.description} onChange={(v) => set({ description: v })} rows={6} />
        </Field>
        <div className="cma-two">
          <Field label={t('Erster Tag')}>
            <Input type="date" value={f.starts_on} onChange={(v) => set({ starts_on: v })} />
          </Field>
          <Field label={t('Letzter Tag')} hint={t('{days} Tage', { days })}>
            <Input type="date" value={f.ends_on} onChange={(v) => set({ ends_on: v })} />
          </Field>
          <NumberField label={t('Ziel: so viele Check-ins')} min={1} max={days} value={f.goal_days} onChange={(v) => set({ goal_days: v })} hint={t('Leer = alle Tage')} />
          <Field label={t('Status')}>
            <Select value={f.status} onChange={(v) => set({ status: v })} options={[['draft', t('Entwurf (Mitglieder sehen nichts)')], ['active', t('Offen')], ['archived', t('Archiviert')]]} />
          </Field>
        </div>
        <div className="cma-two">
          <NumberField label={t('Punkte je Check-in')} min={0} max={1000} value={f.points_checkin} onChange={(v) => set({ points_checkin: v })} hint={t('Leer = Standard der Gruppe')} />
          <NumberField label={t('Bonus bei Abschluss')} min={0} max={1000} value={f.points_complete} onChange={(v) => set({ points_complete: v })} hint={t('Leer = Standard der Gruppe')} />
          <Field label={t('Abzeichen bei Abschluss')}>
            <Select value={f.badge_id} onChange={(v) => set({ badge_id: v })} placeholder={t('keins')} options={badges.map((b) => [b.id, `${b.emoji} ${b.name}`])} />
          </Field>
          <NumberField label={t('Erinnerung um … Uhr')} min={0} max={23} value={f.reminder_hour} onChange={(v) => set({ reminder_hour: v })} hint={t('Leer = keine Erinnerung')} />
        </div>
        <Check checked={!!f.require_note} onChange={(v) => set({ require_note: v })} label={t('Beim Check-in einen kurzen Text verlangen')} />
        <h4 style={{ margin: '8px 0 0' }}>{t('Aufgaben je Tag (freiwillig)')}</h4>
        <p className="muted small" style={{ margin: 0 }}>
          {t('Mitglieder sehen die Aufgabe des heutigen Tages. Tage ohne Aufgabe bleiben einfach Check-in-Tage.')}
        </p>
        <div className="cma-days">
          {Array.from({ length: Math.min(days, 366) }, (_x, i) => i + 1).map((day) => (
            <details key={day} open={!!task(day)?.title && days <= 14}>
              <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                {t('Tag {day}', { day })} {task(day)?.title ? '✓' : ''}
              </summary>
              <Input value={task(day)?.title ?? ''} onChange={(v) => setTask(day, { title: v })} placeholder={t('Aufgabe')} aria-label={t('Aufgabe Tag …')} />
              <Textarea rows={2} value={task(day)?.body ?? ''} onChange={(v) => setTask(day, { body: v })} placeholder={t('Hinweis (freiwillig)')} aria-label={t('Hinweis Tag …')} />
            </details>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function Participants({ challenge, onClose }: { challenge: any; onClose: () => void }) {
  const t = useT('community');
  const r = useLoad(() => api.get<any[]>(`/api/community/challenges/${challenge.id}/participants`), [challenge.id]);
  return (
    <Modal title={t('Teilnehmer: {title}', { title: challenge.title })} onClose={onClose} wide>
      {!r.data ? (
        <Spinner />
      ) : r.data.length ? (
        <div className="table-wrap">
          <table className="t cma-table">
            <thead>
              <tr>
                <th>{t('Mitglied')}</th>
                <th>{t('Check-ins')}</th>
                <th>{t('Serie')}</th>
                <th>{t('Beste Serie')}</th>
                <th>{t('Dabei seit')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {r.data.map((p) => (
                <tr key={p.contact_id}>
                  <td>
                    {p.name}
                    <div className="muted small">{p.email}</div>
                  </td>
                  <td>
                    {p.checkins} / {challenge.goal_days}
                  </td>
                  <td>{p.streak}</td>
                  <td>{p.best_streak}</td>
                  <td className="muted">{d(p.joined_at)}</td>
                  <td>{p.completed_at && <Badge tone="green">{t('geschafft')}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{t('Noch niemand dabei.')}</Empty>
      )}
    </Modal>
  );
}

// --- live ---------------------------------------------------------------------------------------------------------------------------------
function Live({ group, onChange }: { group: any; onChange: () => void }) {
  const t = useT('community');
  const list = useLoad(() => api.get<any[]>(`/api/community/groups/${group.id}/live`), [group.id]);
  const [rec, setRec] = useState<any>(null);
  const [att, setAtt] = useState<any>(null);
  const [nw, setNw] = useState<any>(null);
  if (!list.data) return <Spinner />;
  const toggle = (e: any, on: boolean) => run(() => api.put(`/api/community/events/${e.event_id}/live`, { enabled: on }), on ? t('Live-Call eingeschaltet') : t('Ausgeschaltet'), () => void list.reload());
  const server = list.data[0]?.jitsi_server;
  const upcoming = list.data.filter((e) => e.ends_at >= new Date().toISOString());
  const past = list.data.filter((e) => e.ends_at < new Date().toISOString());
  const row = (e: any) => (
    <li key={e.event_id}>
      <div className="grow">
        <div>
          <strong>{e.title}</strong> {e.live && <Badge tone="red">{t('Live-Call')}</Badge>}
        </div>
        <div className="muted small">
          {dt(e.starts_at)} – {dt(e.ends_at)}
          {e.live ? t(' · {n} dabei', { n: e.attendees }) : ''}
          {e.recording_post_id ? t(' · Aufzeichnung online') : ''}
        </div>
      </div>
      {e.live ? (
        <>
          <button className="btn small secondary" onClick={() => setAtt(e)}>
            {t('Teilnehmer')}
          </button>
          <button className="btn small secondary" onClick={() => setRec(e)}>
            {t('Aufzeichnung')}
          </button>
          <button className="btn small ghost" onClick={() => toggle(e, false)}>
            {t('Ausschalten')}
          </button>
        </>
      ) : (
        <button className="btn small" onClick={() => toggle(e, true)}>
          {t('Mit Live-Raum')}
        </button>
      )}
    </li>
  );
  return (
    <>
      <div className="cma-grid">
        <Sec title={t('Live-Calls')} lead={t('Aus einem Termin wird ein Live-Call mit eigenem Video-Raum (Jitsi) direkt in der Community. Wer beitritt, zählt als anwesend und bekommt Punkte. Danach hängst du die Aufzeichnung als Beitrag an.')}>
          <p className="muted small" style={{ marginTop: 0 }}>
            {t('Videoserver: {server}. Eigenen Jitsi-Server eintragen: Einstellungen der Gruppe → Live. Der Raum öffnet 15 Minuten vor dem Start; kurz vorher bekommen alle Mitglieder eine Erinnerung.', { server: server ?? 'https://meet.jit.si' })}
          </p>
          <button className="btn" onClick={() => setNw({ title: '', starts_at: '', ends_at: '', description: '' })}>
            {t('+ Neuer Live-Call')}
          </button>
        </Sec>
        <Sec title={t('Kommende Termine')}>
          {upcoming.length ? <ul className="cma-list">{upcoming.map(row)}</ul> : <p className="muted">{t('Keine kommenden Termine.')}</p>}
        </Sec>
        <Sec title={t('Vergangene Termine')}>{past.length ? <ul className="cma-list">{past.slice(0, 12).map(row)}</ul> : <p className="muted">{t('Noch keine.')}</p>}</Sec>
      </div>
      {nw && <NewLive group={group} f={nw} onClose={() => setNw(null)} onDone={() => (setNw(null), void list.reload(), onChange())} />}
      {rec && <Recording group={group} event={rec} onClose={() => setRec(null)} onDone={() => (setRec(null), void list.reload(), onChange())} />}
      {att && <Attendance event={att} onClose={() => setAtt(null)} />}
    </>
  );
}

function NewLive({ group, f: init, onClose, onDone }: { group: any; f: any; onClose: () => void; onDone: () => void }) {
  const t = useT('community');
  const [f, setF] = useState(init);
  return (
    <Modal
      title={t('Neuer Live-Call')}
      onClose={onClose}
      footer={
        <button
          className="btn"
          disabled={!f.title.trim() || !f.starts_at}
          onClick={async () => {
            const ev = await act(() => api.post<any>(`/api/community/groups/${group.id}/events`, { title: f.title, description: f.description, starts_at: new Date(f.starts_at).toISOString(), ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : undefined, notify: true }));
            if (ev && (await act(() => api.put(`/api/community/events/${ev.id}/live`, { enabled: true }), t('Live-Call angelegt')))) onDone();
          }}
        >
          {t('Anlegen')}
        </button>
      }
    >
      <div className="cma">
        <Field label={t('Titel')}>
          <Input value={f.title} onChange={(v) => setF({ ...f, title: v })} autoFocus placeholder={t('z. B. Fragerunde')} />
        </Field>
        <div className="cma-two">
          <Field label={t('Beginn')}>
            <Input type="datetime-local" value={f.starts_at} onChange={(v) => setF({ ...f, starts_at: v })} />
          </Field>
          <Field label={t('Ende (freiwillig, sonst 1 Stunde)')}>
            <Input type="datetime-local" value={f.ends_at} onChange={(v) => setF({ ...f, ends_at: v })} />
          </Field>
        </div>
        <Field label={t('Beschreibung (freiwillig)')}>
          <Textarea rows={3} value={f.description} onChange={(v) => setF({ ...f, description: v })} />
        </Field>
        <p className="muted small" style={{ margin: 0 }}>
          {t('Alle Mitglieder werden über den neuen Termin benachrichtigt.')}
        </p>
      </div>
    </Modal>
  );
}

function Recording({ group, event, onClose, onDone }: { group: any; event: any; onClose: () => void; onDone: () => void }) {
  const t = useT('community');
  const [f, setF] = useState({ video_url: '', title: `${t('Aufzeichnung: {title}', { title: event.title })}`, notify: true, channel_id: '' });
  return (
    <Modal
      title={t('Aufzeichnung: {title}', { title: event.title })}
      onClose={onClose}
      footer={
        <button className="btn" disabled={!f.video_url.trim()} onClick={async () => (await act(() => api.post(`/api/community/events/${event.event_id}/recording`, f), t('Beitrag veröffentlicht'))) && onDone()}>
          {t('Als Beitrag veröffentlichen')}
        </button>
      }
    >
      <div className="cma">
        <p className="muted" style={{ marginTop: 0 }}>
          {t('Lade die Aufzeichnung zu YouTube (nicht gelistet), Vimeo oder Loom hoch und füge den Link ein. Sie erscheint als Beitrag in der Community und auf der Live-Seite des Termins.')}
        </p>
        <Field label={t('Video-Link')}>
          <Input value={f.video_url} onChange={(v) => setF({ ...f, video_url: v })} autoFocus placeholder="https://…" />
        </Field>
        <Field label={t('Titel des Beitrags')}>
          <Input value={f.title} onChange={(v) => setF({ ...f, title: v })} />
        </Field>
        <Field label={t('Kanal')}>
          <Select value={f.channel_id} onChange={(v) => setF({ ...f, channel_id: v })} placeholder={t('Erster freier Kanal')} options={(group.channels ?? []).map((c: any) => [c.id, c.name])} />
        </Field>
        <Check checked={f.notify} onChange={(v) => setF({ ...f, notify: v })} label={t('Alle Mitglieder benachrichtigen')} />
      </div>
    </Modal>
  );
}

function Attendance({ event, onClose }: { event: any; onClose: () => void }) {
  const t = useT('community');
  const r = useLoad(() => api.get<any[]>(`/api/community/events/${event.event_id}/attendance`), [event.event_id]);
  return (
    <Modal title={t('Dabei: {title}', { title: event.title })} onClose={onClose}>
      {!r.data ? <Spinner /> : r.data.length ? <ul className="cma-list">{r.data.map((a) => <li key={a.contact_id}><div className="grow"><strong>{a.name}</strong><div className="muted small">{a.email} · {dt(a.joined_at)}</div></div></li>)}</ul> : <Empty>{t('Noch niemand.')}</Empty>}
    </Modal>
  );
}

// --- points ----------------------------------------------------------------------------------------------------------------------------------------
function Points({ group }: { group: any }) {
  const t = useT('community');
  const ext = useLoad(() => api.get<any>(`/api/community/groups/${group.id}/ext`), [group.id]);
  const arch = useLoad(() => api.get<any[]>(`/api/community/groups/${group.id}/leaderboard/archive`), [group.id]);
  const [f, setF] = useState<any>(null);
  const [give, setGive] = useState<any>(null);
  if (ext.data && !f) setF({ points: { ...ext.data.points }, leaderboard: { ...ext.data.leaderboard } });
  if (!f) return <Spinner />;
  const set = (k: string, v: number | null) => setF({ ...f, points: { ...f.points, [k]: v ?? 0 } });
  return (
    <>
      <div className="cma-grid">
        <Sec title={t('Wofür es Punkte gibt')} lead={t('Beiträge, Kommentare und Likes stellst du unter Einstellungen ein. Hier die Punkte für Kurse, Live-Calls und Challenges (0 = keine).')}>
          <div className="cma-two">
            <NumberField label={t('Kurs abgeschlossen')} min={0} max={1000} value={f.points.course} onChange={(v) => set('course', v)} />
            <NumberField label={t('Live-Call besucht')} min={0} max={1000} value={f.points.event} onChange={(v) => set('event', v)} />
            <NumberField label={t('Challenge-Check-in')} min={0} max={1000} value={f.points.challenge_checkin} onChange={(v) => set('challenge_checkin', v)} />
            <NumberField label={t('Challenge geschafft')} min={0} max={1000} value={f.points.challenge_complete} onChange={(v) => set('challenge_complete', v)} />
          </div>
          <div className="cma-actions">
            <button className="btn" onClick={() => run(() => api.put(`/api/community/groups/${group.id}/ext`, f), t('Gespeichert'))}>
              {t('Speichern')}
            </button>
            <button className="btn secondary" onClick={() => setGive({})}>
              {t('Punkte von Hand vergeben')}
            </button>
          </div>
        </Sec>
        <Sec title={t('Rangliste jeden Monat neu')} lead={t('Mit dem Monats-Reset zählt „Dieser Monat“ ab dem 1. – so haben auch Neue eine Chance. Die Gesamtpunkte und Level bleiben. Die Top 3 des Vormonats werden benachrichtigt und stehen hier im Archiv.')}>
          <Check checked={f.leaderboard.reset === 'monthly'} onChange={(v) => setF({ ...f, leaderboard: { reset: v ? 'monthly' : 'none' } })} label={t('Monatliche Rangliste (Kalendermonat)')} />
          <div className="cma-actions">
            <button className="btn" onClick={() => run(() => api.put(`/api/community/groups/${group.id}/ext`, f), t('Gespeichert'), () => void arch.reload())}>
              {t('Speichern')}
            </button>
          </div>
          {arch.data?.length ? (
            <>
              <h4 style={{ margin: '14px 0 4px' }}>{t('Archiv')}</h4>
              {arch.data.map((m) => (
                <details key={m.month}>
                  <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>{m.month}</summary>
                  <ol>
                    {m.rows.map((rRow: any) => (
                      <li key={rRow.contact_id}>
                        {t('{name} – {points} Punkte', { name: rRow.name || t('Mitglied'), points: rRow.points })}
                      </li>
                    ))}
                  </ol>
                </details>
              ))}
            </>
          ) : null}
        </Sec>
      </div>
      {give && <GivePoints group={group} onClose={() => setGive(null)} />}
    </>
  );
}

function GivePoints({ group, onClose }: { group: any; onClose: () => void }) {
  const t = useT('community');
  const [m, setM] = useState<any>(null);
  const [pts, setPts] = useState<number | null>(10);
  const [reason, setReason] = useState('');
  return (
    <Modal
      title={t('Punkte von Hand vergeben')}
      onClose={onClose}
      footer={
        m && (
          <button className="btn" disabled={!pts} onClick={async () => (await act(() => api.post(`/api/community/groups/${group.id}/points`, { contact_id: m.contact_id, points: pts, reason }), t('+{n} Punkte', { n: pts! }))) && onClose()}>
            {t('Vergeben')}
          </button>
        )
      }
    >
      {!m ? (
        <MemberPick group={group} onPick={setM} />
      ) : (
        <div className="cma">
          <p style={{ marginTop: 0 }}>
            {t('An {name} (aktuell {points} Punkte)', { name: m.display_name || m.email, points: m.points })}
          </p>
          <NumberField label={t('Punkte (negativ zieht ab)')} min={-10000} max={10000} value={pts} onChange={setPts} />
          <Field label={t('Grund (freiwillig)')}>
            <Input value={reason} onChange={setReason} />
          </Field>
        </div>
      )}
    </Modal>
  );
}
