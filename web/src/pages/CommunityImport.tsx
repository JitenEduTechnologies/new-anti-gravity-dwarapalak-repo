import { useState } from 'react';
import { api, d } from '../api';
import { Badge, Check, Field, Modal, Select, Spinner, Textarea, act } from '../ui';
import { useT } from '../i18n';
import { Sub, fileHref } from './CommunityParts';
import { readCsvFile } from '../csv-file';

/**
 * Community → Mitglieder → Importieren / Exportieren: move members in from a CSV list (also Skool's export) with a dry run first,
 * move posts in as Markdown files, and take members and posts out again. Server side: modules/community-import.ts.
 */

const STATE_TONE: Record<string, 'green' | 'blue' | 'red' | 'gray'> = { new: 'green', contact_exists: 'blue', member_exists: 'gray', invalid: 'red', duplicate: 'gray' };

export function ImportModal({ group, onClose, onDone }: { group: any; onClose: () => void; onDone: () => void }) {
  const t = useT('community');
  const [tab, setTab] = useState('members');
  return (
    <Modal title={t('Importieren und Exportieren')} onClose={onClose} wide>
      <div className="cma" data-tour="community-import">
        <Sub
          value={tab}
          onChange={setTab}
          tabs={[
            ['members', t('Mitglieder importieren')],
            ['posts', t('Beiträge importieren')],
            ['export', t('Exportieren')],
            ['skool', t('Umzug von Skool')],
          ]}
        />
        {tab === 'members' && <Members group={group} onDone={onDone} />}
        {tab === 'posts' && <Posts group={group} onDone={onDone} />}
        {tab === 'export' && <Export group={group} />}
        {tab === 'skool' && <SkoolGuide onStart={() => setTab('members')} />}
      </div>
    </Modal>
  );
}

function Members({ group, onDone }: { group: any; onDone: () => void }) {
  const t = useT('community');
  const fieldLabel = (f: string) => {
    switch (f) {
      case 'email': return t('E-Mail');
      case 'name': return t('Name');
      case 'first_name': return t('Vorname');
      case 'last_name': return t('Nachname');
      case 'joined': return t('Mitglied seit');
      case 'tier': return t('Stufe');
      case 'points': return t('Punkte');
      case 'tags': return t('Tags');
      case 'phone': return t('Telefon');
      default: return f;
    }
  };
  const stateLabel = (s: string) => {
    switch (s) {
      case 'new': return t('Neu');
      case 'contact_exists': return t('Kontakt bekannt');
      case 'member_exists': return t('Schon dabei');
      case 'invalid': return t('Ungültig');
      case 'duplicate': return t('Doppelt');
      default: return s;
    }
  };
  const [csv, setCsv] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [tierMap, setTierMap] = useState<Record<string, string>>({});
  const [dateOrder, setDateOrder] = useState('auto');
  const [opt, setOpt] = useState({ send_mail: false, trigger_workflows: false, import_points: true, grant_tier_access: true, confirm_rights: false });
  const [plan, setPlan] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const body = () => ({ csv, mapping: Object.fromEntries(Object.entries(mapping).filter(([, v]) => v)), tier_map: Object.fromEntries(Object.entries(tierMap).filter(([, v]) => v)), date_order: dateOrder });
  const check = async () => {
    setBusy(true);
    const p = await act(() => api.post<any>(`/api/community/groups/${group.id}/import/members/preview`, body()));
    setBusy(false);
    if (p) setPlan(p);
  };
  const go = async () => {
    setBusy(true);
    const r = await act(() => api.post<any>(`/api/community/groups/${group.id}/import/members`, { ...body(), ...opt }));
    setBusy(false);
    if (r) {
      setResult(r);
      onDone();
    }
  };
  if (result)
    return (
      <div className="cma-note info" role="status">
        <strong>{t('Fertig.')}</strong>{' '}
        {t('{n} neu angelegt, {m} bekannte Kontakte aufgenommen, {skipped} übersprungen{points}{mails}. Die Personen können sich ab sofort mit ihrer E-Mail-Adresse anmelden.', {
          n: result.created,
          m: result.updated,
          skipped: result.skipped,
          points: result.points ? t(', {n} Startpunkte vergeben', { n: result.points }) : '',
          mails: result.mails ? t(', {n} E-Mails gesendet', { n: result.mails }) : '',
        })}
      </div>
    );
  const onFile = async (el: HTMLInputElement) => {
    const f = el.files?.[0];
    if (f) (setCsv(await readCsvFile(f)), setPlan(null));
  };
  const headers: string[] = plan?.header ?? [];
  return (
    <>
      <div className="cma-drop">
        <p style={{ marginTop: 0 }}>
          <strong>{t('CSV-Datei mit deinen Mitgliedern')}</strong>
          <br />
          <span className="muted small">{t('Spalten wie Name oder Vorname/Nachname, E-Mail, Mitglied seit, Stufe – die Namen erkennen wir selbst (auch englische, auch Skool-Export).')}</span>
        </p>
        <input type="file" accept=".csv,text/csv,text/plain" onChange={(e) => onFile(e.target)} aria-label={t('CSV-Datei wählen')} />
      </div>
      <Field label={t('… oder hier einfügen')}>
        <Textarea rows={4} value={csv} onChange={(v) => (setCsv(v), setPlan(null))} placeholder={t('Name,Email,Joined\nAnna Muster,anna@example.de,2023-03-14')} />
      </Field>
      <div className="cma-actions" style={{ marginTop: 0 }}>
        <button className="btn" disabled={!csv.trim() || busy} onClick={check}>
          {busy ? t('Prüfe …') : t('Prüfen (nichts wird gespeichert)')}
        </button>
        {plan && (
          <div style={{ width: 230 }}>
            <Select value={dateOrder} onChange={(v) => (setDateOrder(v), setPlan(null))} options={[['auto', t('Datum: automatisch erkennen')], ['dmy', t('Datum: Tag/Monat/Jahr')], ['mdy', t('Datum: Monat/Tag/Jahr')]]} />
          </div>
        )}
      </div>
      {plan && (
        <>
          {plan.warnings.map((w: string) => (
            <div key={w} className="cma-note">
              {w}
            </div>
          ))}
          <div className="cma-chips">
            <Badge tone="green">{t('{n} neu', { n: plan.counts.new })}</Badge>
            <Badge tone="blue">{t('{n} Kontakte bekannt', { n: plan.counts.contact_exists })}</Badge>
            <Badge>{t('{n} schon dabei', { n: plan.counts.member_exists })}</Badge>
            <Badge tone={plan.counts.invalid ? 'red' : 'gray'}>{t('{n} ungültig', { n: plan.counts.invalid })}</Badge>
            <Badge>{t('{n} doppelt', { n: plan.counts.duplicate })}</Badge>
          </div>
          <h4 style={{ margin: '4px 0 0' }}>{t('Zuordnung der Spalten')}</h4>
          <div className="cma-two">
            {['email', 'name', 'first_name', 'last_name', 'joined', 'tier', 'points'].map((f) => (
              <Field key={f} label={fieldLabel(f)}>
                <Select
                  value={mapping[f] ?? plan.columns[f] ?? ''}
                  onChange={(v) => {
                    setMapping({ ...mapping, [f]: v });
                    setPlan(null);
                  }}
                  placeholder={t('nicht vorhanden')}
                  options={headers.map((h) => [h, h])}
                />
              </Field>
            ))}
          </div>
          {plan.unmatched_tiers.length > 0 && plan.tiers.length > 0 && (
            <>
              <h4 style={{ margin: '4px 0 0' }}>{t('Stufen zuordnen')}</h4>
              <p className="muted small" style={{ margin: 0 }}>
                {t('Diese Namen aus der Datei gibt es bei dir nicht als Stufe. Wähle, in welche Stufe sie kommen – sonst landen sie in der ersten kostenlosen Stufe.')}
              </p>
              <div className="cma-two">
                {plan.unmatched_tiers.map((n: string) => (
                  <Field key={n} label={`„${n}“ →`}>
                    <Select value={tierMap[n] ?? ''} onChange={(v) => (setTierMap({ ...tierMap, [n]: v }), setPlan(null))} placeholder={t('Standard-Stufe')} options={plan.tiers.map((tierObj: any) => [tierObj.id, tierObj.name])} />
                  </Field>
                ))}
              </div>
            </>
          )}
          <div className="table-wrap" style={{ maxHeight: 280, overflow: 'auto' }}>
            <table className="t cma-table">
              <thead>
                <tr>
                  <th>{t('Zeile')}</th>
                  <th>{t('Name')}</th>
                  <th>{t('E-Mail')}</th>
                  <th>{t('Seit')}</th>
                  <th>{t('Stufe')}</th>
                  <th>{t('Status')}</th>
                </tr>
              </thead>
              <tbody>
                {plan.items.slice(0, 60).map((item: any) => (
                  <tr key={item.line}>
                    <td>{item.line}</td>
                    <td>{item.name || '–'}</td>
                    <td>{item.email}</td>
                    <td>{item.joined_at ? d(item.joined_at) : '–'}</td>
                    <td>{plan.tiers.find((tierObj: any) => tierObj.id === item.tier_id)?.name ?? '–'}</td>
                    <td>
                      <Badge tone={STATE_TONE[item.state] || 'gray'}>{stateLabel(item.state)}</Badge>
                      {item.reason && <div className="muted small">{item.reason}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {plan.truncated || plan.items.length > 60 ? <p className="muted small">{t('Gezeigt werden die ersten 60 von {total} Zeilen – Probleme stehen zuerst.', { total: plan.counts.total })}</p> : null}
          <h4 style={{ margin: '4px 0 0' }}>{t('Optionen')}</h4>
          <Check checked={opt.import_points} onChange={(v) => setOpt({ ...opt, import_points: v })} label={t('Punkte aus der Datei als Startguthaben übernehmen')} />
          <Check checked={opt.grant_tier_access} onChange={(v) => setOpt({ ...opt, grant_tier_access: v })} label={t('Kurse der Stufe freischalten')} />
          <Check checked={opt.send_mail} onChange={(v) => setOpt({ ...opt, send_mail: v })} label={t('Jedem eine E-Mail mit dem Link zur Community senden')} />
          <Check checked={opt.trigger_workflows} onChange={(v) => setOpt({ ...opt, trigger_workflows: v })} label={t('Workflows für neue Kontakte starten (sonst bleibt der Import still)')} />
          <Check checked={opt.confirm_rights} onChange={(v) => setOpt({ ...opt, confirm_rights: v })} label={t('Ich darf diese Personen kontaktieren und speichern (z. B. weil sie meiner Community selbst beigetreten sind).')} />
          <div className="cma-actions">
            <button className="btn" disabled={!opt.confirm_rights || busy || (plan.counts.new + plan.counts.contact_exists === 0)} onClick={go}>
              {busy ? t('Importiere …') : t('{n} Personen importieren', { n: plan.counts.new + plan.counts.contact_exists })}
            </button>
          </div>
        </>
      )}
      {busy && !plan && <Spinner />}
    </>
  );
}

function Posts({ group, onDone }: { group: any; onDone: () => void }) {
  const t = useT('community');
  const [files, setFiles] = useState<{ name: string; content: string }[]>([]);
  const [channel, setChannel] = useState('');
  const [keep, setKeep] = useState(true);
  const [plan, setPlan] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const body = () => ({ files, channel_id: channel || undefined, keep_dates: keep });
  const onFiles = async (el: HTMLInputElement) => {
    const list = Array.from(el.files ?? []).slice(0, 500);
    setFiles(await Promise.all(list.map(async (f) => ({ name: f.name, content: await f.text() }))));
    setPlan(null);
  };
  if (result) return <div className="cma-note info">{t('Fertig: {created} Beiträge übernommen, {skipped} übersprungen (doppelt oder mit Problem).', { created: result.created, skipped: result.skipped })}</div>;
  return (
    <>
      <p className="muted" style={{ margin: 0 }}>
        {t('Jede Markdown-Datei (.md) wird ein Beitrag. Titel und Datum stehen oben zwischen zwei ---Zeilen: title, date (2024-05-01), author (E-Mail eines Mitglieds), channel, pinned. Ohne Titel gilt die erste Überschrift. Beiträge erscheinen mit dem alten Datum, ohne Benachrichtigung und ohne Punkte.')}
      </p>
      <div className="cma-drop">
        <input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" multiple onChange={(e) => onFiles(e.target)} aria-label={t('Markdown-Dateien wählen')} />
        <p className="muted small" style={{ marginBottom: 0 }}>
          {files.length ? t('{n} Dateien gewählt', { n: files.length }) : t('Bis zu 500 Dateien, je höchstens 120 KB')}
        </p>
      </div>
      <div className="cma-two">
        <Field label={t('Standard-Kanal')}>
          <Select value={channel} onChange={(v) => (setChannel(v), setPlan(null))} placeholder={t('Erster freier Kanal')} options={(group.channels ?? []).map((c: any) => [c.id, c.name])} />
        </Field>
        <Check checked={keep} onChange={(v) => (setKeep(v), setPlan(null))} label={t('Datum aus der Datei übernehmen')} />
      </div>
      <div className="cma-actions" style={{ marginTop: 0 }}>
        <button className="btn" disabled={!files.length} onClick={async () => setPlan(await act(() => api.post<any>(`/api/community/groups/${group.id}/import/posts/preview`, body())))}>
          {t('Prüfen (nichts wird gespeichert)')}
        </button>
      </div>
      {plan && (
        <>
          <div className="table-wrap" style={{ maxHeight: 280, overflow: 'auto' }}>
            <table className="t cma-table">
              <thead>
                <tr>
                  <th>{t('Datei')}</th>
                  <th>{t('Titel')}</th>
                  <th>{t('Kanal')}</th>
                  <th>{t('Datum')}</th>
                  <th>{t('Hinweis')}</th>
                </tr>
              </thead>
              <tbody>
                {plan.items.map((i: any) => (
                  <tr key={i.file}>
                    <td>{i.file}</td>
                    <td>{i.title || '–'}</td>
                    <td>{i.channel_name}</td>
                    <td>{d(i.created_at)}</td>
                    <td>{i.problem ? <Badge tone="red">{i.problem}</Badge> : i.warnings.map((w: string) => <div key={w} className="muted small">{w}</div>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cma-actions">
            <button
              className="btn"
              disabled={!plan.ok}
              onClick={async () => {
                const r = await act(() => api.post<any>(`/api/community/groups/${group.id}/import/posts`, body()));
                if (r) (setResult(r), onDone());
              }}
            >
              {t('{n} Beiträge übernehmen', { n: plan.ok })}
            </button>
          </div>
        </>
      )}
    </>
  );
}

function Export({ group }: { group: any }) {
  const t = useT('community');
  return (
    <div className="cma-grid">
      <section className="cma-sec">
        <h3>{t('Mitglieder')}</h3>
        <p className="lead">{t('CSV mit Vorname, Nachname, E-Mail, Beitrittsdatum, Stufe, Level, Punkten und Status – zum Sichern oder für einen Umzug.')}</p>
        <a className="btn" href={fileHref(`/api/community/groups/${group.id}/export/members.csv`)}>
          {t('Mitglieder als CSV laden')}
        </a>
      </section>
      <section className="cma-sec">
        <h3>{t('Beiträge')}</h3>
        <p className="lead">{t('JSON mit allen Beiträgen samt Kommentaren, Autor, Kanal und Datum.')}</p>
        <a className="btn" href={fileHref(`/api/community/groups/${group.id}/export/posts.json`)}>
          {t('Beiträge als JSON laden')}
        </a>
      </section>
    </div>
  );
}

function SkoolGuide({ onStart }: { onStart: () => void }) {
  const t = useT('community');
  return (
    <div className="prose">
      <p style={{ marginTop: 0 }}>
        {t('Skool hat keine öffentliche Schnittstelle (API). Der einzige Weg ist die Export-Funktion von Skool für die Mitgliederliste – so geht der Umzug:')}
      </p>
      <ol>
        <li>
          {t('In Skool als Gruppen-Admin: Einstellungen → Mitglieder (Admin-Bereich) und dort die Mitgliederliste als CSV exportieren. Skool schickt dir die Datei per E-Mail oder lädt sie herunter.')}
        </li>
        <li>
          {t('Hier unter Mitglieder importieren die Datei wählen. Namen, E-Mail-Adressen und das Beitrittsdatum werden erkannt; mit Prüfen siehst du vorher genau, was passiert.')}
        </li>
        <li>{t('Ordne die Skool-Stufen deinen Stufen zu und entscheide, ob die Mitglieder eine E-Mail mit dem Link bekommen.')}</li>
        <li>
          {t('Beiträge, die du behalten willst, kopierst du als Markdown-Dateien (eine pro Beitrag, mit title und date oben) und importierst sie unter Beiträge importieren.')}
        </li>
        <li>{t('Zahlende Mitglieder legen ihr Abo bei dir neu an – dafür schickst du ihnen den Einladungs-Link der Beitrittsseite. Zahlungsdaten lassen sich nicht aus Skool mitnehmen.')}</li>
      </ol>
      <p className="muted small">{t('Die genaue Beschriftung in Skool ändert sich gelegentlich – die Schritte stehen mit Screenshots-Tipps auch in docs/community.md.')}</p>
      <button className="btn" onClick={onStart}>
        {t('Zum Import')}
      </button>
    </div>
  );
}
