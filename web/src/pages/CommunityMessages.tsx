import { useState } from 'react';
import { ago, api } from '../api';
import { Badge, Check, Empty, Field, Input, Modal, Select, Spinner, Textarea, act, confirmAsk, useLoad } from '../ui';
import { useT } from '../i18n';
import { CopyField, MemberPick, NumberField, Sec, Sub, run } from './CommunityParts';

/**
 * Community → Nachrichten: the team's inbox (members write to the team, the team writes to members), reported messages, admins and
 * moderators among the members, and the member features of the group (messages, directory, map, online, video, live server).
 * Server side: modules/community-dm.ts, community-ext.ts.
 */

export function MessagesTab({ group, onChange }: { group: any; onChange: () => void }) {
  const t = useT('community');
  const [sub, setSub] = useState('inbox');
  const reports = useLoad(() => api.get<any[]>('/api/community/dm-reports'), []);
  return (
    <div className="cma" data-tour="community-messages">
      <Sub
        value={sub}
        onChange={setSub}
        tabs={[
          ['inbox', t('Postfach')],
          ['reports', reports.data?.length ? t('Gemeldete Nachrichten ({n})', { n: reports.data.length }) : t('Gemeldete Nachrichten')],
          ['team', t('Admins & Moderatoren')],
          ['features', t('Mitglieder-Funktionen')],
        ]}
      />
      {sub === 'inbox' && <Inbox group={group} />}
      {sub === 'reports' && <Reports list={reports} />}
      {sub === 'team' && <Staff group={group} onChange={onChange} />}
      {sub === 'features' && <Features group={group} />}
    </div>
  );
}

// --- inbox ---------------------------------------------------------------------------------------------------------------------
function Inbox({ group }: { group: any }) {
  const t = useT('community');
  const threads = useLoad(() => api.get<any[]>('/api/community/messages'), []);
  const [open, setOpen] = useState<any>(null);
  const [pick, setPick] = useState(false);
  if (!threads.data) return <Spinner />;
  return (
    <>
      <div className="cma-grid">
        <Sec title={t('Unterhaltungen mit dem Team')} lead={t('Mitglieder schreiben dem Team über „Team schreiben“ im Mitgliederbereich. Du siehst hier alles, was sie schreiben, und antwortest als „Team“ (oder mit dem Namen, den du wählst). Private Nachrichten zwischen Mitgliedern liest du nicht.')} right={<button className="btn" onClick={() => setPick(true)}>{t('+ Neue Nachricht')}</button>}>
          {threads.data.length ? (
            <ul className="cma-list">
              {threads.data.map((thread) => (
                <li key={thread.thread_id}>
                  <div className="grow">
                    <div>
                      <strong>{thread.name}</strong> {thread.unread > 0 && <Badge tone="red">{t('{n} neu', { n: thread.unread })}</Badge>}
                    </div>
                    <div className="muted small">
                      {thread.email} · {ago(thread.last_message_at)}
                    </div>
                    <div className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {thread.last_preview}
                    </div>
                  </div>
                  <button className="btn small" onClick={() => setOpen(thread)}>
                    {t('Öffnen')}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{t('Noch keine Nachrichten.')}</p>
          )}
        </Sec>
      </div>
      {open && <Thread contact={open} onClose={() => (setOpen(null), void threads.reload())} />}
      {pick && (
        <Modal title={t('Neue Nachricht an ein Mitglied')} onClose={() => setPick(false)}>
          <MemberPick group={group} onPick={(m) => (setPick(false), setOpen({ contact_id: m.contact_id, name: m.display_name || m.email, email: m.email }))} />
        </Modal>
      )}
    </>
  );
}

function Thread({ contact, onClose }: { contact: any; onClose: () => void }) {
  const t = useT('community');
  const threadLoad = useLoad(() => api.get<any>(`/api/community/messages/${contact.contact_id}`), [contact.contact_id]);
  const [body, setBody] = useState('');
  const [from, setFrom] = useState('');
  const send = async () => {
    if (await act(() => api.post(`/api/community/messages/${contact.contact_id}`, { body, from_name: from || undefined }), t('Gesendet'))) {
      setBody('');
      void threadLoad.reload();
    }
  };
  return (
    <Modal
      title={t('Nachrichten mit {name}', { name: contact.name })}
      onClose={onClose}
      wide
      footer={
        <button className="btn" disabled={!body.trim()} onClick={send}>
          {t('Senden')}
        </button>
      }
    >
      {!threadLoad.data ? (
        <Spinner />
      ) : (
        <div className="cma">
          <div className="cma-thread" role="log" aria-live="polite">
            {threadLoad.data.messages.length ? (
              threadLoad.data.messages.map((m: any) => (
                <div key={m.id} className={`cma-msg${m.from_team ? ' team' : ''}`}>
                  {m.body}
                  <small>
                    {m.from_team ? m.sender_name : threadLoad.data.name} · {ago(m.created_at)}
                  </small>
                </div>
              ))
            ) : (
              <p className="muted">{t('Noch nichts geschrieben.')}</p>
            )}
          </div>
          <Field label={t('Deine Nachricht')}>
            <Textarea rows={3} value={body} onChange={setBody} autoFocus />
          </Field>
          <Field label={t('Absendername')} hint={t('Leer = „Team“')}>
            <Input value={from} maxLength={60} onChange={setFrom} placeholder={t('Team')} />
          </Field>
        </div>
      )}
    </Modal>
  );
}

// --- reported messages -----------------------------------------------------------------------------------------------------------------
function Reports({ list }: { list: ReturnType<typeof useLoad<any[]>> }) {
  const t = useT('community');
  if (!list.data) return <Spinner />;
  const settle = (r: any, action: string, ok: string) => run(() => api.patch(`/api/community/dm-reports/${r.id}`, { action }), ok, () => void list.reload());
  return list.data.length ? (
    <div className="cma-grid">
      {list.data.map((r) => (
        <Sec key={r.id} title={t('Gemeldet von {name}', { name: r.reporter.name })} lead={`${ago(r.created_at)}${r.reason ? ` · „${r.reason}“` : ''}`}>
          <div className="cma-thread" style={{ maxHeight: 200 }}>
            {r.context.map((c: any, i: number) => (
              <div key={i} className={`cma-msg${c.body === r.message.text ? ' team' : ''}`}>
                {c.body}
                <small>{c.sender_name}</small>
              </div>
            ))}
          </div>
          <p className="small" style={{ marginBottom: 0 }}>
            {t('Gemeldet wurde die Nachricht von {name} ({email}).', { name: r.sender.name, email: r.sender.email || t('Team') })}
          </p>
          <div className="cma-actions">
            <button className="btn secondary" onClick={() => settle(r, 'dismiss', t('In Ordnung'))}>
              {t('In Ordnung')}
            </button>
            <button className="btn secondary" onClick={() => settle(r, 'remove', t('Nachricht entfernt'))}>
              {t('Nachricht entfernt')}
            </button>
            <button className="btn danger" onClick={async () => (await confirmAsk(t('{name} sperren und die Nachricht entfernen?', { name: r.sender.name }))) && settle(r, 'ban', t('Gesperrt'))}>
              {t('Absender sperren')}
            </button>
          </div>
        </Sec>
      ))}
    </div>
  ) : (
    <Empty>{t('Keine gemeldeten Nachrichten. Mitglieder melden eine Nachricht über das Menü (⋯) in der Unterhaltung.')}</Empty>
  );
}

// --- admins & moderators ------------------------------------------------------------------------------------------------------------------
function Staff({ group, onChange }: { group: any; onChange: () => void }) {
  const t = useT('community');
  const list = useLoad(() => api.get<any[]>(`/api/community/groups/${group.id}/staff`), [group.id]);
  const [adding, setAdding] = useState<string | null>(null);
  const [role, setRole] = useState('moderator');
  return (
    <>
      <div className="cma-grid">
        <Sec title={t('Admins und Moderatoren')} lead={t('Mitglieder mit Rolle haben im Mitgliederbereich eine eigene Seite „Moderation“: Beiträge und Kommentare ausblenden, löschen oder anheften, Meldungen abarbeiten. Admins entscheiden zusätzlich über Beitrittsanfragen. Sie tragen ein Abzeichen und stehen auf der öffentlichen Seite.')}>
          {!list.data ? (
            <Spinner />
          ) : list.data.length ? (
            <ul className="cma-list">
              {list.data.map((s) => (
                <li key={s.contact_id}>
                  <div className="grow">
                    <strong>{s.name}</strong> <Badge tone={s.role === 'admin' ? 'purple' : 'blue'}>{s.role === 'admin' ? t('Admin') : t('Moderator')}</Badge>
                    <div className="muted small">{s.email}</div>
                  </div>
                  <button className="btn small ghost" onClick={async () => (await confirmAsk(t('{name} die Rolle nehmen?', { name: s.name }))) && run(() => api.del(`/api/community/groups/${group.id}/staff/${s.contact_id}`), t('Rolle entfernt'), () => (void list.reload(), onChange()))}>
                    {t('Rolle entfernen')}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{t('Noch niemand. Du kannst jedes Mitglied zur Moderation ernennen.')}</p>
          )}
          <div className="cma-actions">
            <button className="btn" onClick={() => setAdding('')}>
              {t('+ Rolle vergeben')}
            </button>
          </div>
        </Sec>
      </div>
      {adding !== null && (
        <Modal title={t('Rolle vergeben')} onClose={() => setAdding(null)}>
          <Field label={t('Rolle')}>
            <Select value={role} onChange={setRole} options={[['moderator', t('Moderator – Inhalte moderieren')], ['admin', t('Admin – zusätzlich Beitrittsanfragen')]]} />
          </Field>
          <MemberPick
            group={group}
            onPick={async (m) => {
              if (await act(() => api.post(`/api/community/groups/${group.id}/staff`, { contact_id: m.contact_id, role }), t('Rolle vergeben'))) {
                setAdding(null);
                void list.reload();
                onChange();
              }
            }}
          />
        </Modal>
      )}
    </>
  );
}

// --- member features -------------------------------------------------------------------------------------------------------------------------
function Features({ group }: { group: any }) {
  const t = useT('community');
  const ext = useLoad(() => api.get<any>(`/api/community/groups/${group.id}/ext`), [group.id]);
  const [f, setF] = useState<any>(null);
  if (ext.data && !f) setF(structuredClone(ext.data));
  if (!f) return <Spinner />;
  const set = (k: string, patch: any) => setF({ ...f, [k]: { ...f[k], ...patch } });
  const save = () => run(() => api.put(`/api/community/groups/${group.id}/ext`, { dms: f.dms, directory: f.directory, map: f.map, online: f.online, video: f.video, live: f.live }), t('Gespeichert'));
  return (
    <div className="cma-grid">
      <Sec title={t('Private Nachrichten')} lead={t('Mitglieder einer Gruppe können sich privat schreiben, blockieren und Nachrichten melden. Es gibt Grenzen gegen Spam.')}>
        <Check checked={f.dms.enabled} onChange={(v) => set('dms', { enabled: v })} label={t('Private Nachrichten erlauben')} />
        <div className="cma-two">
          <NumberField label={t('Höchstens pro Stunde')} min={1} max={600} value={f.dms.per_hour} onChange={(v) => set('dms', { per_hour: v ?? 30 })} />
          <NumberField label={t('Neue Unterhaltungen pro Tag')} min={1} max={500} value={f.dms.new_per_day} onChange={(v) => set('dms', { new_per_day: v ?? 15 })} />
        </div>
        <div className="cma-actions">
          <button className="btn" onClick={save}>
            {t('Speichern')}
          </button>
        </div>
      </Sec>
      <Sec title={t('Mitglieder sichtbar machen')} lead={t('Wer ist da, woher kommen wir? Jedes Mitglied entscheidet selbst, was es von sich zeigt (Online-Punkt, Ort auf der Karte, Aktivität).')}>
        <Check checked={f.directory.enabled} onChange={(v) => set('directory', { enabled: v })} label={t('Mitgliederverzeichnis mit Suche und Level-Filter')} />
        <Check checked={f.online.enabled} onChange={(v) => set('online', { enabled: v })} label={t('„Online jetzt“ zeigen')} />
        <Check checked={f.map.enabled} onChange={(v) => set('map', { enabled: v })} label={t('Mitglieder-Karte (nur Stadt, nur wer es erlaubt; ohne externe Kartendienste)')} />
        <div className="cma-actions">
          <button className="btn" onClick={save}>
            {t('Speichern')}
          </button>
        </div>
      </Sec>
      <Sec title={t('Videos und Live-Calls')} lead={t('Mitglieder dürfen Videos in Beiträgen hochladen (bis zu einer Größe, die auf deinem Server eingestellt ist) oder verlinken. Live-Calls laufen über Jitsi.')}>
        <Check checked={f.video.upload} onChange={(v) => set('video', { upload: v })} label={t('Video-Upload in Beiträgen erlauben (sonst nur Links zu YouTube, Vimeo, Loom)')} />
        <Field label={t('Eigener Jitsi-Server (freiwillig)')} hint={t('Leer = meet.jit.si bzw. die Einstellung PGHL_JITSI_URL deines Servers. Nur https://adresse – ohne Pfad.')}>
          <Input value={f.live.jitsi_url} onChange={(v) => set('live', { jitsi_url: v })} placeholder="https://meet.example.com" />
        </Field>
        <div className="cma-actions">
          <button className="btn" onClick={save}>
            {t('Speichern')}
          </button>
        </div>
      </Sec>
      <Sec title={t('Mitglieder-App')} lead={t('Der Mitgliederbereich ist eine installierbare App (PWA) mit dem Namen, der Farbe und dem Logo deines Kunden. Mitglieder tippen im Browser auf „Installieren“ bzw. „Zum Home-Bildschirm“ und bekommen Push-Mitteilungen für Nachrichten, Erwähnungen und Antworten.')}>
        <CopyField value={group.url} label={t('Link zur Gruppe (zum Teilen oder als QR-Code)')} />
        <p className="muted small" style={{ marginBottom: 0 }}>
          {t('Name und Logo kommen aus dem Branding des Sub-Accounts (Agentur → Branding). Auf Android öffnet der Link direkt in der App, wenn sie als Verknüpfung installiert ist – Einzelheiten in docs/community.md.')}
        </p>
      </Sec>
    </div>
  );
}
