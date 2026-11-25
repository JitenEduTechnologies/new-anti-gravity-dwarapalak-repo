import { useEffect, useRef, useState } from 'react';
import { Icon } from '../icons';
import { api } from '../api';
import { canRecord, micError, playDataUrl, startRecording, transcribe, type RecordingHandle } from '../agent/voice';
import { Badge, Check, Empty, Field, Input, Select, Spinner, Textarea, act, navigate, toast, useLoad } from '../ui';
import { MoreFields } from '../areas/fields';
import { SortableGrid } from '../sortable/Sortable';
import { useT } from '../i18n';

/**
 * Einstellungen → Stimme: the voice layer on top of KI-Anbieter (BYOK). Which provider speaks and listens, the voice
 * (listed by the provider, free text allowed), "Stimme testen" and a microphone test, the phone agent's engine
 * (Twilio's voices or the own provider, live stream or recorded turns) with the latency of recent calls, the defaults of
 * the HyperLevel Agent's push-to-talk, and voicemail transcription.
 */

const langs = (t: (k: string) => string): [string, string][] => [
  ['de', t('Deutsch')],
  ['en', t('Englisch')],
  ['fr', t('Französisch')],
  ['es', t('Spanisch')],
  ['it', t('Italienisch')],
  ['nl', t('Niederländisch')],
  ['pl', t('Polnisch')],
  ['pt', t('Portugiesisch')],
  ['tr', t('Türkisch')],
];
const langOptions = (v: string, t: (k: string) => string): [string, string][] => {
  const l = langs(t);
  return l.some(([k]) => k === v) ? l : [[v, v], ...l];
};

const transports = (t: (k: string) => string): [string, string][] => [
  ['auto', t('Automatisch (Live-Stream, wenn der Anbieter es kann)')],
  ['stream', t('Live-Stream (schnell, Anrufer können unterbrechen)')],
  ['turns', t('Aufnahme-Runden (langsamer, geht mit jedem Anbieter)')],
];
const transportName = (key: string, t: (k: string) => string) => {
  const map: Record<string, string> = {
    twilio: t('Twilio-Stimme'),
    stream: t('Live-Stream'),
    turns: t('Aufnahme-Runden'),
  };
  return map[key] ?? key;
};

type Conn = { id: string; provider: string; label: string; model: string; live: boolean; stream: string | null };

function ConnSelect({ value, onChange, list, routed }: { value: string; onChange: (v: string) => void; list: Conn[]; routed?: { label: string } | null }) {
  const t = useT('voice');
  return <Select value={value} onChange={onChange} options={[['', routed ? t('Automatisch ({label})', { label: routed.label }) : t('Automatisch – keine Verbindung')], ...list.map((c) => [c.id, `${c.label}${c.live ? ' · Live' : ''}`] as [string, string])]} />;
}

/** Voice: free text with the provider's own list as suggestions. */
function VoiceField({ value, onChange, connectionId, language, tour, hint }: { value: string; onChange: (v: string) => void; connectionId: string; language: string; tour?: string; hint?: string }) {
  const t = useT('voice');
  const [voices, setVoices] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    setBusy(true);
    setError('');
    try {
      const q = new URLSearchParams({ language });
      if (connectionId) q.set('connection_id', connectionId);
      const r = await api.get<any>(`/api/voice/voices?${q}`);
      setVoices(r.voices);
      if (!r.voices.length) toast(t('Dieser Anbieter hat keine Stimmenliste – die Stimme als Text eintragen.'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const id = useRef(`voices-${Math.random().toString(36).slice(2)}`).current;
  return (
    <Field label={t('Stimme')} tour={tour} hint={error || hint || t('Die Stimmen-ID des Anbieters. Leer = Standardstimme des Anbieters.')}>
      <div className="row voice-pick">
        <input list={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={t('Standardstimme')} aria-label={t('Stimme')} />
        <datalist id={id}>
          {(voices ?? []).map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
              {v.lang ? ` · ${v.lang}` : ''}
              {v.gender ? ` · ${v.gender}` : ''}
            </option>
          ))}
        </datalist>
        <button type="button" className="btn small secondary" onClick={load} disabled={busy}>
          {busy ? t('Lade …') : voices ? t('{n} Stimmen', { n: voices.length }) : t('Stimmen laden')}
        </button>
      </div>
    </Field>
  );
}

function TtsTest({ s, d }: { s: any; d: any }) {
  const t = useT('voice');
  const [text, setText] = useState(t('Guten Tag, hier spricht Ihr digitaler Assistent. Wie kann ich Ihnen helfen?'));
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<any>(null);
  const run = async () => {
    setBusy(true);
    try {
      const r = await api.post<any>('/api/voice/test', { text, voice: s.tts.voice, model: s.tts.model, connection_id: s.tts.connection_id, language: s.tts.language, speed: s.tts.speed, instructions: s.tts.instructions });
      setLast(r);
      await playDataUrl(r.audio);
    } catch (e) {
      setLast({ error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="voice-test" data-tour="voice-test">
      <Field label={t('Stimme testen')} hint={t('Spricht diesen Text mit den Einstellungen oben (ungespeicherte Änderungen zählen schon).')}>
        <Textarea value={text} onChange={setText} rows={2} maxLength={300} />
      </Field>
      <div className="row">
        <button type="button" className="btn small" onClick={run} disabled={busy || !text.trim() || (!d.routed.tts && !s.tts.connection_id)}>
          <Icon name="audio" size={14} /> {busy ? t('Spricht …') : t('Abspielen')}
        </button>
        {last && !last.error && (
          <span className="muted small">
            {last.provider} · {last.model || t('Standardmodell')} · {last.chars} {t('Zeichen ·')} {last.ms} ms
          </span>
        )}
        {last?.error && <span className="voice-warn small">{last.error}</span>}
      </div>
    </div>
  );
}

function MicTest({ s }: { s: any }) {
  const t = useT('voice');
  const [state, setState] = useState<'idle' | 'recording' | 'working'>('idle');
  const [result, setResult] = useState<{ text?: string; error?: string; ms?: number; provider?: string }>({});
  const rec = useRef<RecordingHandle | null>(null);
  const lang = useRef(s.stt.language);
  lang.current = s.stt.language;
  useEffect(() => () => rec.current?.cancel(), []);
  /** Ends the running recording (also called by the time limit, so it must not depend on render state). */
  const finish = async () => {
    const h = rec.current;
    if (!h) return;
    rec.current = null;
    setState('working');
    try {
      const blob = await h.stop();
      if (!blob) return setResult({ error: t('Es wurde nichts aufgenommen.') });
      const r = await transcribe(blob, { language: lang.current });
      setResult({ text: r.text || t('(nichts erkannt)'), ms: r.ms, provider: r.provider });
    } catch (e) {
      setResult({ error: (e as Error).message });
    } finally {
      setState('idle');
    }
  };
  const toggle = async () => {
    if (rec.current) return finish();
    setResult({});
    try {
      rec.current = await startRecording({ maxMs: 20_000, onLimit: () => void finish() });
      setState('recording');
    } catch (e) {
      setResult({ error: micError(e) });
    }
  };
  if (!canRecord()) return <p className="muted small">{t('Dieser Browser kann keine Aufnahmen machen (Mikrofon-Test nicht möglich).')}</p>;
  return (
    <div className="voice-test" data-tour="voice-mic-test">
      <div className="row">
        <button type="button" className={`btn small${state === 'recording' ? ' danger' : ' secondary'}`} onClick={toggle} disabled={state === 'working'}>
          <Icon name={state === 'recording' ? 'micOff' : 'mic'} size={14} /> {state === 'recording' ? t('Aufnahme beenden') : state === 'working' ? t('Erkenne …') : t('Mikrofon testen')}
        </button>
        {state === 'recording' && <span className="voice-rec small">{t('● Aufnahme läuft – sprich einen Satz')}</span>}
        {result.text && (
          <span className="small">
            „{result.text}“ <span className="muted">· {result.provider} · {result.ms} ms</span>
          </span>
        )}
        {result.error && <span className="voice-warn small">{result.error}</span>}
      </div>
    </div>
  );
}

function Latency({ l }: { l: any }) {
  const t = useT('voice');
  const data = useLoad(() => api.get<any>('/api/voice/latency?limit=12'), []);
  if (!l?.turns) return <p className="muted small">{t('Noch keine Telefonate mit eigener Stimme – hier erscheinen die Antwortzeiten.')}</p>;
  const ms = (v: number | null | undefined) => (v === null || v === undefined ? '–' : `${(v / 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 })} s`);
  return (
    <div data-tour="voice-latency">
      <SortableGrid id="voice.latency" className="voice-stats">
        <div>
          <strong>{ms(l.total_p50)}</strong>
          <span className="muted small">{t('typisch (Median)')}</span>
        </div>
        <div>
          <strong>{ms(l.total_p95)}</strong>
          <span className="muted small">{t('langsamste 5 %')}</span>
        </div>
        <div>
          <strong>{ms(l.stt_avg)}</strong>
          <span className="muted small">{t('Spracherkennung')}</span>
        </div>
        <div>
          <strong>{ms(l.llm_avg)}</strong>
          <span className="muted small">{t('KI-Antwort')}</span>
        </div>
        <div>
          <strong>{ms(l.tts_avg)}</strong>
          <span className="muted small">{t('Sprachausgabe')}</span>
        </div>
        <div>
          <strong>{l.interrupted}</strong>
          <span className="muted small">{t('von {turns} Runden unterbrochen', { turns: l.turns })}</span>
        </div>
      </SortableGrid>
      {data.data?.turns?.length > 0 && (
        <table className="voice-turns small">
          <thead>
            <tr>
              <th>{t('Wann')}</th>
              <th>{t('Weg')}</th>
              <th>{t('Erkennen')}</th>
              <th>{t('KI')}</th>
              <th>{t('Stimme')}</th>
              <th>{t('Gesamt')}</th>
            </tr>
          </thead>
          <tbody>
            {data.data.turns.map((tItem: any, i: number) => (
              <tr key={i}>
                <td>{new Date(tItem.at).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td>{tItem.transport === 'stream' ? t('Live') : t('Runden')}{tItem.interrupted ? t(' · unterbrochen') : ''}</td>
                <td>{ms(tItem.stt_ms)}</td>
                <td>{ms(tItem.llm_ms)}</td>
                <td>{ms(tItem.tts_ms)}</td>
                <td>{ms(tItem.total_ms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function VoiceSettingsPage() {
  const t = useT('voice');
  const info = useLoad(() => api.get<any>('/api/voice/settings'), []);
  const [s, setS] = useState<any>();
  useEffect(() => setS(info.data?.settings), [info.data]);
  if (!s || !info.data) return info.error ? <Empty>{info.error}</Empty> : <Spinner />;
  const d = info.data;
  const tts: Conn[] = d.connections.tts;
  const stt: Conn[] = d.connections.stt;
  const set = (key: string, patch: any) => setS({ ...s, [key]: { ...s[key], ...patch } });
  const plan = d.phone.plan;
  const own = s.phone.engine === 'own';
  const save = async () => {
    const r = await act(() => api.put('/api/voice/settings', s), t('Gespeichert'));
    if (r) info.setData(r);
  };
  const noProviders = !tts.length && !stt.length;
  const phoneVoiceConn = s.phone.tts_connection_id || s.tts.connection_id;
  return (
    <div className="voice-page" data-tour="voice-page">
      <p className="muted">
        {t('Sprich und höre mit deinem eigenen Anbieter (BYOK): Sprachausgabe für den KI-Agenten und das Telefon, Spracherkennung für die Mikrofon-Taste und Voicemails. Schlüssel liegen unter ')}
        <a href="/app/settings/ai-providers" onClick={(e) => (e.preventDefault(), navigate('settings/ai-providers'))}>
          {t('KI-Anbieter')}
        </a>
        {t('; die Kosten laufen über dein Konto beim Anbieter.')}
      </p>
      {noProviders && (
        <p className="voice-warn small">
          {t('Noch kein Anbieter für Sprache verbunden. Unter ')}<a href="/app/settings/ai-providers" onClick={(e) => (e.preventDefault(), navigate('settings/ai-providers'))}>{t('KI-Anbieter')}</a>{t(' z. B. OpenAI, ElevenLabs, Deepgram, Cartesia, Azure, Google oder einen lokalen Sprachserver (Kokoro, Whisper) hinzufügen – ohne Anbieter bleibt alles wie bisher.')}
        </p>
      )}

      <div className="card" data-tour="voice-tts">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>
            <Icon name="audio" size={18} /> {t('Sprachausgabe')}
          </h2>
          {d.routed.tts ? <Badge tone="green">{d.routed.tts.label}</Badge> : <Badge>{t('nicht verbunden')}</Badge>}
        </div>
        <div className="grid2">
          <Field label={t('Anbieter')} hint={t('Automatisch nimmt die Zuordnung „Sprachausgabe“ unter KI-Anbieter.')}>
            <ConnSelect value={s.tts.connection_id} onChange={(v) => set('tts', { connection_id: v })} list={tts} routed={d.routed.tts} />
          </Field>
          <Field label={t('Sprache')}>
            <Select value={s.tts.language} onChange={(v) => set('tts', { language: v })} options={langOptions(s.tts.language, t)} />
          </Field>
        </div>
        <VoiceField value={s.tts.voice} onChange={(v) => set('tts', { voice: v })} connectionId={s.tts.connection_id} language={s.tts.language} tour="voice-voice" />
        <MoreFields id="voice-tts" values={[s.tts.model, s.tts.instructions, Number(s.tts.speed) !== 1]}>
          <div className="grid2">
            <Field label={t('Modell (optional)')} hint={t('Leer = Standard der Verbindung.')}>
              <Input value={s.tts.model} onChange={(v) => set('tts', { model: v })} placeholder={t('z. B. gpt-4o-mini-tts')} />
            </Field>
            <Field label={t('Tempo: {speed}×', { speed: Number(s.tts.speed).toLocaleString('en-IN') })} hint={t('Nicht jeder Anbieter kann das Tempo ändern.')}>
              <input type="range" min={0.5} max={2} step={0.05} value={s.tts.speed} onChange={(e) => set('tts', { speed: Number(e.target.value) })} aria-label={t('Sprechtempo')} />
            </Field>
          </div>
          <Field label={t('Stil-Anweisung (optional)')} hint={t('Nur OpenAI gpt-4o-mini-tts: „Freundlich, ruhig, wie am Telefon in einer Praxis.“')}>
            <Input value={s.tts.instructions} onChange={(v) => set('tts', { instructions: v })} maxLength={500} />
          </Field>
        </MoreFields>
        <TtsTest s={s} d={d} />
      </div>

      <div className="card" data-tour="voice-stt">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>
            <Icon name="mic" size={18} /> {t('Spracherkennung')}
          </h2>
          {d.routed.stt ? <Badge tone="green">{d.routed.stt.label}</Badge> : <Badge>{t('nicht verbunden')}</Badge>}
        </div>
        <div className="grid2">
          <Field label={t('Anbieter')} hint={t('Automatisch nimmt die Zuordnung „Transkription“ unter KI-Anbieter.')}>
            <ConnSelect value={s.stt.connection_id} onChange={(v) => set('stt', { connection_id: v })} list={stt} routed={d.routed.stt} />
          </Field>
          <Field label={t('Sprache')}>
            <Select value={s.stt.language} onChange={(v) => set('stt', { language: v })} options={langOptions(s.stt.language, t)} />
          </Field>
        </div>
        <MoreFields id="voice-stt" values={[s.stt.model]}>
          <Field label={t('Modell (optional)')}>
            <Input value={s.stt.model} onChange={(v) => set('stt', { model: v })} placeholder={t('z. B. gpt-4o-transcribe, nova-3')} />
          </Field>
        </MoreFields>
        <MicTest s={s} />
      </div>

      <div className="card" data-tour="voice-phone">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>
            <Icon name="phone" size={18} /> {t('Telefon (KI-Telefonagent)')}
          </h2>
          <Badge tone={plan.engine === 'own' && plan.transport !== 'twilio' ? 'green' : 'gray'}>{transportName(plan.transport, t)}</Badge>
        </div>
        <Field label={t('Stimme und Zuhören am Telefon')} tour="voice-phone-engine">
          <Select value={s.phone.engine} onChange={(v) => set('phone', { engine: v })} options={[['twilio', t('Twilio (Standard) – deutsche Stimmen von Amazon Polly und Google')], ['own', t('Eigener Anbieter – deine Stimme und Spracherkennung')]]} />
        </Field>
        {own && (
          <>
            <Field label={t('Übertragung')} hint={t('Live-Stream: Twilio öffnet eine WebSocket-Verbindung zu deinem Server (öffentliche https-Adresse nötig). Aufnahme-Runden: nach jedem Satz wird aufgenommen, erkannt und die Antwort abgespielt – ohne Unterbrechen.')}>
              <Select value={s.phone.transport} onChange={(v) => set('phone', { transport: v })} options={transports(t)} />
            </Field>
            <details className="voice-more">
              <summary>{t('Am Telefon andere Anbieter oder Stimme als oben')}</summary>
              <div className="grid2">
                <Field label={t('Anbieter der Telefon-Stimme')}>
                  <ConnSelect value={s.phone.tts_connection_id} onChange={(v) => set('phone', { tts_connection_id: v })} list={tts} routed={s.tts.connection_id ? tts.find((c) => c.id === s.tts.connection_id) : d.routed.tts} />
                </Field>
                <Field label={t('Anbieter der Spracherkennung')}>
                  <ConnSelect value={s.phone.stt_connection_id} onChange={(v) => set('phone', { stt_connection_id: v })} list={stt} routed={s.stt.connection_id ? stt.find((c) => c.id === s.stt.connection_id) : d.routed.stt} />
                </Field>
                <Field label={t('Telefon-Stimme (optional)')}>
                  <Input value={s.phone.tts_voice} onChange={(v) => set('phone', { tts_voice: v })} placeholder={t('wie oben')} />
                </Field>
                <Field label={t('Modelle (optional)')}>
                  <div className="row">
                    <Input value={s.phone.tts_model} onChange={(v) => set('phone', { tts_model: v })} placeholder={t('Stimme')} />
                    <Input value={s.phone.stt_model} onChange={(v) => set('phone', { stt_model: v })} placeholder={t('Erkennung')} />
                  </div>
                </Field>
              </div>
              {tts.find((c) => c.id === phoneVoiceConn)?.provider === 'elevenlabs' && <Check checked={s.phone.tts_ws} onChange={(v) => set('phone', { tts_ws: v })} label={t('ElevenLabs über WebSocket sprechen (noch schnellerer Start)')} />}
            </details>
            <Field label={t('Pause, bis der Agent antwortet: {ms} ms', { ms: s.phone.endpoint_ms })} hint={t('So lange muss der Anrufer still sein, damit der Agent annimmt, dass er fertig ist.')}>
              <input type="range" min={300} max={2500} step={100} value={s.phone.endpoint_ms} onChange={(e) => set('phone', { endpoint_ms: Number(e.target.value) })} aria-label={t('Pause bis zur Antwort')} />
            </Field>
            <div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>
              <Check checked={s.phone.barge_in} onChange={(v) => set('phone', { barge_in: v })} label={t('Anrufer dürfen den Agenten unterbrechen')} />
              <Check checked={s.phone.filler} onChange={(v) => set('phone', { filler: v })} label={t('„Einen Moment bitte“, wenn die Antwort länger dauert')} />
            </div>
          </>
        )}
        <div className="voice-plan" data-tour="voice-phone-plan">
          <strong className="small">{t('Nächster Anruf ')}<span className="muted">{t('(mit den gespeicherten Einstellungen)')}</span></strong>
          <div className="small">
            {plan.engine === 'twilio' ? (
              t('Twilio-Stimme (Standard).')
            ) : (
              <>
                {transportName(plan.transport, t)}
                {plan.tts && <>{t(' · Stimme: {label}', { label: plan.tts.label })}</>}
                {plan.stt && <>{t(' · Erkennung: {label}', { label: plan.stt.label })}{plan.stt.live ? t(' (live)') : t(' (pro Satz)')}</>}
              </>
            )}
          </div>
          {plan.problems.map((p: string) => (
            <div key={p} className="voice-warn small">
              {p}
            </div>
          ))}
          {own && !d.phone.twilio_ready && <div className="voice-warn small">{t('Twilio-Zugang und Nummer fehlen noch (Einstellungen → Telefonie).')}</div>}
          {own && !d.phone.agent_ready && <div className="voice-warn small">{t('Der KI-Telefonagent braucht den eingeschalteten KI-Assistenten (Einstellungen → Telefonie).')}</div>}
          <div className="muted small">{t('Fällt der eigene Anbieter mitten im Gespräch aus, spricht Twilio weiter – der Anruf bleibt nie stumm.')}</div>
        </div>
        <h3 style={{ marginTop: 16 }}>{t('Antwortzeiten der letzten Anrufe')}</h3>
        <Latency l={d.latency} />
      </div>

      <div className="card" data-tour="voice-agent">
        <h2>
          <Icon name="bot" size={18} /> {t('HyperLevel Agent')}
        </h2>
        <p className="muted small">{t('Mikrofon-Taste im Agent-Fenster: aufnehmen, erkennen, Text prüfen und senden. Jede und jeder kann das für sich anders einstellen. Änderungen am CRM bestätigst du immer selbst – gesprochene Befehle bestätigen nichts.')}</p>
        <div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>
          <Check checked={s.agent.read_aloud} onChange={(v) => set('agent', { read_aloud: v })} label={t('Antworten des Agenten vorlesen (Standard für alle)')} />
          <Check checked={s.agent.auto_send} onChange={(v) => set('agent', { auto_send: v })} label={t('Erkannten Text sofort senden, ohne ihn vorher zu prüfen')} />
        </div>
      </div>

      <div className="card" data-tour="voice-voicemail">
        <h2>
          <Icon name="phone" size={18} /> {t('Voicemails')}
        </h2>
        <div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>
          <Check checked={s.voicemail_transcribe} onChange={(v) => setS({ ...s, voicemail_transcribe: v })} label={t('Voicemails mit der eigenen Spracherkennung transkribieren')} />
          <Check checked={s.call_summary} onChange={(v) => setS({ ...s, call_summary: v })} label={t('Kurze Zusammenfassung mit nächstem Schritt dazuschreiben (nutzt den KI-Assistenten)')} />
        </div>
        <p className="muted small">{t('Der Text erscheint am Anruf und im Posteingang. Die Transkription von Twilio (Einstellungen → Telefonie) dann bitte ausschalten.')}</p>
      </div>

      <div className="card">
        <h2>{t('Nutzung der letzten {days} Tage', { days: d.usage.days })}</h2>
        <p className="small">
          {t('{chars} Zeichen gesprochen ({calls} Aufrufe) · {stt} Aufnahmen erkannt · {phone} Telefonate mit eigener Stimme ({mins} Min.)', {
            chars: d.usage.tts_chars.toLocaleString('en-IN'),
            calls: d.usage.tts_calls,
            stt: d.usage.stt_calls,
            phone: d.usage.phone_calls,
            mins: Math.round(d.usage.phone_seconds / 60),
          })}
        </p>
        <p className="muted small">{t('Abgerechnet wird beim Anbieter; hier siehst du nur, wie viel HyperLevel angefragt hat.')}</p>
      </div>

      <div className="row voice-save">
        <button className="btn" onClick={save}>
          {t('Speichern')}
        </button>
      </div>
    </div>
  );
}
