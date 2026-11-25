import { useEffect, useRef, useState } from 'react';
import { api, dt } from '../api';
import { Badge, Check, CodeBox, Empty, Field, Input, Select, Spinner, Textarea, act, confirmAsk, toast, useLoad } from '../ui';
import { LegalNotice } from './ConsentKit';
import { useT } from '../i18n';

/** Settings → Einwilligung & Recht → Cookie-Banner: the editor with a live preview, the script-blocking howto and the consent log. */

const CATS: [string, string][] = [['statistics', 'Statistik'], ['marketing', 'Marketing'], ['external_media', 'Externe Medien']];
const CHOICE: Record<string, string> = { accept_all: 'Alle akzeptiert', reject_all: 'Nur notwendige', custom: 'Eigene Auswahl' };

const SNIPPET = `<!-- Analytics: loads only after consent -->
<script type="text/plain" data-category="statistics" src="https://stats.example.com/script.js"></script>

<!-- Marketing: inline script works too -->
<script type="text/plain" data-category="marketing">
  /* e.g. ad pixel */
</script>

<!-- External media: embeds are replaced by placeholder -->
<iframe data-category="external_media" data-src="https://www.youtube-nocookie.com/embed/VIDEO_ID"></iframe>

<!-- Link to reopen consent settings, e.g. in footer -->
<a href="#cookie-settings">Cookie settings</a>`;

function Preview({ settings }: { settings: any }) {
  const t = useT('consent');
  const [doc, setDoc] = useState('');
  const seq = useRef(0);
  useEffect(() => {
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      api
        .text('POST', '/api/cmp/preview', { settings })
        .then((h) => mine === seq.current && setDoc(h))
        .catch(() => undefined);
    }, 350);
    return () => clearTimeout(timer);
  }, [JSON.stringify(settings)]);
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }} data-tour="cmp-preview">
      <div className="muted small" style={{ padding: '8px 12px' }}>{t('Vorschau (so sieht ein Besucher das Banner)')}</div>
      <iframe title={t('Vorschau Cookie-Banner')} srcDoc={doc} sandbox="allow-scripts" style={{ width: '100%', height: 460, border: 0, background: '#f3f4f6' }} />
    </div>
  );
}

export function CmpEditor() {
  const t = useT('consent');
  const { data, reload } = useLoad(() => api.get('/api/cmp/settings'), []);
  const log = useLoad(() => api.get('/api/cmp/log?limit=50'), []);
  const [s, setS] = useState<any>();
  useEffect(() => {
    if (data) setS(data.settings);
  }, [data]);
  if (!s) return <Spinner />;
  const set = (patch: any) => setS({ ...s, ...patch });
  const cat = (k: string, patch: any) => set({ categories: { ...s.categories, [k]: { ...s.categories[k], ...patch } } });
  const color = (k: string, v: string) => set({ colors: { ...s.colors, [k]: v } });
  const save = async () => {
    const r = await act(() => api.put('/api/cmp/settings', s));
    if (r) {
      setS(r.settings);
      void reload();
      void log.reload();
      toast(r.settings.version !== data.settings.version ? t('Gespeichert – der Wortlaut hat sich geändert, alle Besucher werden neu gefragt') : t('Gespeichert'));
    }
  };
  const reask = async () => {
    if (!confirmAsk(t('Alle Besucher beim nächsten Besuch erneut nach ihrer Auswahl fragen?'))) return;
    const r = await act(() => api.post('/api/cmp/reask'), t('Alle werden neu gefragt'));
    if (r) (setS(r.settings), void reload());
  };
  const stats = log.data?.last_30_days ?? {};
  return (
    <>
      <LegalNotice />
      <div className="card" data-tour="cmp-intro">
        <h2>{t('Cookie-Banner (Einwilligungsverwaltung)')}</h2>
        <p className="muted">
          {t('Eigene Einwilligungsverwaltung für Funnels, Websites, Buchungsseiten, Kunden- und Community-Portale – ohne Drittanbieter. Skripte mit type="text/plain" und data-category laufen erst nach Zustimmung; eingebettete Videos und Karten werden bis dahin durch einen Platzhalter ersetzt. Der Banner ersetzt den bisherigen Hinweis der Besucher-Statistik – es gibt immer nur einen.')}
        </p>
        <Check checked={s.enabled} onChange={(v) => set({ enabled: v })} label={<strong>{t('Cookie-Banner auf allen öffentlichen Seiten anzeigen')}</strong>} tour="cmp-enabled" />
        <p className="muted small">{t('Version {ver} · Ändert sich der Wortlaut oder die Kategorien, entsteht eine neue Version und alle Besucher werden erneut gefragt.', { ver: s.version })}</p>
      </div>

      <div className="grid2" style={{ alignItems: 'start' }}>
        <div>
          <div className="card" data-tour="cmp-texts">
            <h3>{t('Texte')}</h3>
            <Field label={t('Überschrift')}><Input value={s.title} onChange={(v) => set({ title: v })} /></Field>
            <Field label={t('Text')}><Textarea rows={5} value={s.text} onChange={(v) => set({ text: v })} /></Field>
            <div className="grid2">
              <Field label={t('Button „Alle akzeptieren“')}><Input value={s.accept_all} onChange={(v) => set({ accept_all: v })} /></Field>
              <Field label={t('Button „Nur notwendige“')} hint={t('Gleichwertig zum Akzeptieren-Button – ablehnen muss genauso einfach sein.')}><Input value={s.reject_all} onChange={(v) => set({ reject_all: v })} /></Field>
              <Field label={t('Button „Einstellungen“')}><Input value={s.customize} onChange={(v) => set({ customize: v })} /></Field>
              <Field label={t('Button „Auswahl speichern“')}><Input value={s.save} onChange={(v) => set({ save: v })} /></Field>
            </div>
            <div className="grid2">
              <Field label={t('Datenschutzerklärung (Adresse)')} hint={t('Leer lassen, um den Link wegzulassen.')}><Input value={s.policy_url} onChange={(v) => set({ policy_url: v })} placeholder={t('https://… oder /datenschutz')} /></Field>
              <Field label={t('Linktext')}><Input value={s.policy_label} onChange={(v) => set({ policy_label: v })} /></Field>
              <Field label={t('Impressum (Adresse)')}><Input value={s.imprint_url} onChange={(v) => set({ imprint_url: v })} placeholder={t('https://… oder /impressum')} /></Field>
            </div>
          </div>

          <div className="card" data-tour="cmp-categories">
            <h3>{t('Kategorien')}</h3>
            <p className="muted small">{t('„Notwendig“ ist immer aktiv. Die anderen sind vorab aus und werden erst durch einen Klick des Besuchers eingeschaltet.')}</p>
            <Field label={t('Notwendig – Beschreibung')}><Textarea rows={2} value={s.categories.necessary.description} onChange={(v) => cat('necessary', { description: v })} /></Field>
            {CATS.map(([k, l]) => (
              <div key={k} className="grid2">
                <Field label={t('{name} – Name', { name: t(l) })}><Input value={s.categories[k].label} onChange={(v) => cat(k, { label: v })} /></Field>
                <Field label={t('{name} – Beschreibung', { name: t(l) })}><Textarea rows={2} value={s.categories[k].description} onChange={(v) => cat(k, { description: v })} /></Field>
              </div>
            ))}
          </div>

          <div className="card" data-tour="cmp-look">
            <h3>{t('Aussehen')}</h3>
            <div className="grid2">
              <Field label={t('Form')}><Select value={s.layout} onChange={(v) => set({ layout: v })} options={[['box', t('Karte')], ['bar', t('Leiste unten')], ['center', t('Mitte (Dialog)')]]} /></Field>
              <Field label={t('Position (bei Karte)')}><Select value={s.position} onChange={(v) => set({ position: v })} options={[['left', t('Unten links')], ['right', t('Unten rechts')], ['middle', t('Unten mittig')]]} /></Field>
            </div>
            <div className="grid2">
              {([['bg', 'Hintergrund'], ['text', 'Text'], ['accent', 'Akzent (Buttons)'], ['accent_text', 'Text auf Akzent']] as [string, string][]).map(([k, l]) => (
                <Field key={k} label={t(l)}>
                  <span className="row" style={{ gap: 8 }}>
                    <input type="color" value={s.colors[k]} onChange={(e) => color(k, e.target.value)} aria-label={t(l)} />
                    <Input value={s.colors[k]} onChange={(v) => color(k, v)} />
                  </span>
                </Field>
              ))}
            </div>
            <Check checked={s.reopen.enabled} onChange={(v) => set({ reopen: { ...s.reopen, enabled: v } })} label={t('Kleinen Knopf zum erneuten Öffnen einblenden (Widerruf muss jederzeit möglich sein)')} />
            {s.reopen.enabled && <Field label={t('Beschriftung des Knopfs')}><Input value={s.reopen.label} onChange={(v) => set({ reopen: { ...s.reopen, label: v } })} /></Field>}
          </div>

          <div className="card" data-tour="cmp-tech">
            <h3>{t('Technik')}</h3>
            <Check checked={s.consent_mode} onChange={(v) => set({ consent_mode: v })} label={t('Google Consent Mode v2 – alles startet auf „denied“ und wird nach der Auswahl aktualisiert')} />
            <Field label={t('Skripte ohne Kategorie')} hint={t('Unbekannte Skripte von Dritten, die nicht mit data-category markiert sind.')}>
              <Select value={s.unknown_scripts} onChange={(v) => set({ unknown_scripts: v })} options={[['block', t('Blockieren, bis „Marketing“ erlaubt ist (empfohlen)')], ['allow', t('Nicht eingreifen (nur markierte Skripte werden gesteuert)')]]} />
            </Field>
            <Field label={t('Auswahl gilt für … Tage')}><Input type="number" value={s.expiry_days} onChange={(v) => set({ expiry_days: Number(v) })} /></Field>
          </div>

          <p className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={save} data-tour="cmp-save">{t('Speichern')}</button>
            <button className="btn secondary" onClick={reask} data-tour="cmp-reask">{t('Alle neu fragen')}</button>
          </p>
        </div>

        <div style={{ position: 'sticky', top: 12 }}>
          <Preview settings={s} />
          <div className="card" data-tour="cmp-howto">
            <h3>{t('Eigene Skripte steuern')}</h3>
            <p className="muted small">{t('Trage Skripte so in den Head-Code der Seite oder in HTML-Blöcke ein. Statistik- und Reichweiten-Cookies von HyperLevel selbst folgen automatisch der Auswahl.')}</p>
            <CodeBox text={SNIPPET} />
          </div>
        </div>
      </div>

      <div className="card" data-tour="cmp-log">
        <h3>{t('Nachweis der Auswahlen')}</h3>
        <p className="muted small">{t('Jede Entscheidung wird pseudonym mit Version, Auswahl, Seite und gekürzter IP protokolliert und 3 Jahre aufbewahrt.')}</p>
        <p className="row small" style={{ gap: 14 }}>
          {Object.keys(stats).length ? Object.entries(stats).map(([k, n]) => <span key={k}><Badge>{String(n)}</Badge> {t(CHOICE[k] ?? k)}</span>) : <span className="muted">{t('Letzte 30 Tage: noch keine Auswahlen')}</span>}
        </p>
        {!log.data?.rows?.length ? (
          <Empty>{t('Noch keine Auswahlen protokolliert.')}</Empty>
        ) : (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>{t('Wann')}</th><th>{t('Auswahl')}</th><th>{t('Statistik')}</th><th>{t('Marketing')}</th><th>{t('Medien')}</th><th>{t('Seite')}</th><th>{t('V')}</th></tr></thead>
              <tbody>
                {log.data.rows.map((r: any) => (
                  <tr key={r.id}>
                    <td className="small" style={{ whiteSpace: 'nowrap' }}>{dt(r.created_at)}</td>
                    <td>{t(CHOICE[r.choice] ?? r.choice)}</td>
                    <td>{r.statistics ? t('ja') : t('nein')}</td>
                    <td>{r.marketing ? t('ja') : t('nein')}</td>
                    <td>{r.external_media ? t('ja') : t('nein')}</td>
                    <td className="small muted">{r.page}</td>
                    <td className="small">{r.version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
