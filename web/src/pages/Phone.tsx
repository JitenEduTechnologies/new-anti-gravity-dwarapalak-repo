import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Call, Device } from '@twilio/voice-sdk';
import { Icon } from '../icons';
import { api } from '../api';
import { Badge, Check, CodeBox, Empty, Field, Input, Modal, Select, Spinner, act, toast, toastError, useLoad } from '../ui';
import { CallTools, TransferModal } from './PhoneTools';
import { Slot } from '../slots';
import { MoreFields } from '../areas/fields';
import { useT, tr } from '../i18n';

/**
 * Browser phone (Twilio Voice JS SDK, loaded only when switched on): a floating dialer that stays
 * while you move around the app, an incoming-call popup, mute, hold, keypad (DTMF), call timer and
 * audio device selection. Its state lives in a small store outside React so navigation never drops a call.
 */

interface ActiveCall {
  direction: 'in' | 'out';
  number: string;
  name: string;
  callId: string;
  contactId?: string;
  /** Set when a colleague handed this call over (the id of the hand-over). */
  transfer?: string;
  state: 'connecting' | 'ringing' | 'open';
  startedAt?: number;
  muted: boolean;
  holding?: boolean;
}
interface Held {
  callId: string;
  number: string;
  name: string;
  since: number;
}
interface Incoming {
  number: string;
  name: string;
  callId: string;
  transfer?: string;
}
interface PhoneState {
  status: 'off' | 'loading' | 'ready' | 'error';
  error: string;
  available: boolean;
  incomingAllowed: boolean;
  registered: boolean;
  number: string;
  call: ActiveCall | null;
  incoming: Incoming | null;
  held: Held[];
  open: boolean;
}

const INITIAL: PhoneState = { status: 'off', error: '', available: true, incomingAllowed: false, registered: false, number: '', call: null, incoming: null, held: [], open: false };
let state: PhoneState = INITIAL;
const listeners = new Set<() => void>();
function setState(p: Partial<PhoneState>) {
  state = { ...state, ...p };
  for (const l of listeners) l();
}
const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));
export const usePhone = () => useSyncExternalStore(subscribe, () => state);

// --- controller (one Device per open app and sub-account) ------------------------------------

let device: Device | null = null;
let current: Call | null = null;
let ringing: Call | null = null;
let generation = 0;
let presenceTimer: ReturnType<typeof setInterval> | undefined;
let heldTimer: ReturnType<typeof setInterval> | undefined;

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(`pghl.phone.${k}`) ?? '';
    } catch {
      return '';
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(`pghl.phone.${k}`, v);
    } catch {
      /* private mode */
    }
  },
};
const message = (e: unknown) => (e instanceof Error ? e.message : String((e as any)?.message ?? e));
/** The SDK repeats connection errors while it retries: show each message once a minute at most. */
const shown = new Map<string, number>();
function phoneError(text: string) {
  if (Date.now() - (shown.get(text) ?? 0) < 60_000) return;
  shown.set(text, Date.now());
  toastError(text);
}

async function ping(available = state.available) {
  await api.post('/api/phone/presence', { available }).catch(() => undefined);
}

async function applySavedDevices(d: Device) {
  const input = store.get('input');
  const output = store.get('output');
  const ring = store.get('ringtone');
  try {
    if (input) await d.audio?.setInputDevice(input);
    if (output && d.audio?.isOutputSelectionSupported) await d.audio.speakerDevices.set(output);
    if (ring && d.audio?.isOutputSelectionSupported) await d.audio.ringtoneDevices.set(ring);
  } catch {
    /* the device is gone – the default is used */
  }
}

async function register() {
  if (!device) return;
  const t = tr('phone');
  try {
    await device.register();
    setState({ registered: true });
  } catch (e) {
    setState({ registered: false });
    phoneError(t('Telefon: {error}', { error: message(e) }));
  }
}

export async function startPhone() {
  const gen = ++generation;
  let st: any;
  try {
    st = await api.get('/api/phone/status');
  } catch {
    return;
  }
  if (gen !== generation) return;
  if (!st.ready) return setState({ ...INITIAL });
  setState({ status: 'loading', error: '' });
  const t = tr('phone');
  try {
    const [{ Device: DeviceClass }, tok] = await Promise.all([import('@twilio/voice-sdk'), api.get('/api/phone/token')]);
    if (gen !== generation) return;
    const d = new DeviceClass(tok.token, {
      edge: tok.edge,
      closeProtection: t('Ein Anruf läuft – die Seite wirklich verlassen?'),
      codecPreferences: ['opus', 'pcmu'],
      logLevel: 'error',
      appName: 'gohigh',
      allowIncomingWhileBusy: false,
      // No call-quality reports to Twilio Insights (keeps the CSP narrow).
      publishEvents: false,
    } as ConstructorParameters<typeof DeviceClass>[1]);
    device = d;
    d.on('tokenWillExpire', async () => {
      const tokNew = await api.get('/api/phone/token').catch(() => null);
      if (tokNew && device === d) d.updateToken(tokNew.token);
    });
    d.on('registered', () => setState({ registered: true }));
    d.on('unregistered', () => setState({ registered: false }));
    d.on('error', (e: any) => phoneError(t('Telefon: {error}', { error: e?.message ?? t('Fehler') })));
    d.on('incoming', onIncoming);
    void applySavedDevices(d);
    setState({ status: 'ready', available: st.available, incomingAllowed: !!tok.incoming, number: tok.number });
    if (tok.incoming && st.available) await register();
    clearInterval(presenceTimer);
    if (tok.incoming) {
      void ping();
      presenceTimer = setInterval(() => void ping(), 45_000);
    }
  } catch (e) {
    if (gen === generation) setState({ status: 'error', error: message(e) });
  }
}

export function stopPhone() {
  generation++;
  clearInterval(presenceTimer);
  clearInterval(heldTimer);
  try {
    current?.disconnect();
    device?.destroy();
  } catch {
    /* already gone */
  }
  if (state.incomingAllowed && state.status === 'ready') void api.del('/api/phone/presence').catch(() => undefined);
  device = null;
  current = null;
  ringing = null;
  setState({ ...INITIAL });
}

export async function restartPhone() {
  stopPhone();
  await startPhone();
}

function track(call: Call, info: Omit<ActiveCall, 'muted'>) {
  const t = tr('phone');
  current = call;
  setState({ call: { ...info, muted: false }, open: true });
  const patch = (p: Partial<ActiveCall>) => current === call && state.call && setState({ call: { ...state.call, ...p } });
  call.on('ringing', () => patch({ state: 'ringing' }));
  call.on('accept', async () => {
    patch({ state: 'open', startedAt: Date.now() });
    const sid = call.parameters?.CallSid;
    if (info.direction === 'in' && info.callId && info.transfer) {
      // A colleague handed this call over: from now on it is ours (hold, notes, hang-up).
      const r = await api.post('/api/phone/transfers/accepted', { call_id: info.callId, agent_sid: sid ?? '' }).catch(() => null);
      if (r?.contact_id) patch({ contactId: r.contact_id });
    } else if (info.direction === 'in' && info.callId) {
      const r = await api.post('/api/phone/accepted', { call_id: info.callId, agent_sid: sid ?? '' }).catch(() => null);
      if (r?.contact_name && !info.name) patch({ name: r.contact_name, contactId: r.contact_id ?? undefined });
    } else if (info.direction === 'in' && sid) {
      // Handed over with an announcement: the server knows this leg once the colleague pressed 1 – ask until it does.
      for (let i = 0; i < 25 && current === call; i++) {
        const r = await api.get(`/api/phone/calls/${encodeURIComponent(sid)}`).catch(() => null);
        if (r) return patch({ callId: r.call_id, name: info.name || r.contact_name, contactId: r.contact_id ?? undefined });
        await new Promise((res) => setTimeout(res, 2000));
      }
    } else if (info.direction === 'out' && !info.callId && sid) {
      // The server knows this call by the browser leg's SID: fetch its id (needed for hold) and the contact.
      const r = await api.get(`/api/phone/calls/${encodeURIComponent(sid)}`).catch(() => null);
      if (r) patch({ callId: r.call_id, name: info.name || r.contact_name, contactId: r.contact_id ?? undefined });
    }
  });
  call.on('mute', (muted: boolean) => patch({ muted }));
  const end = () => {
    if (current !== call) return;
    current = null;
    setState({ call: null });
  };
  call.on('disconnect', end);
  call.on('cancel', end);
  call.on('reject', end);
  call.on('error', (e: any) => {
    toastError(t('Anruf: {error}', { error: e?.message ?? t('Fehler') }));
    end();
  });
}

function onIncoming(call: Call) {
  if (current || ringing) return call.reject();
  const t = tr('phone');
  ringing = call;
  const p = call.customParameters;
  setState({ incoming: { number: p.get('from') || call.parameters?.From || t('Unbekannt'), name: p.get('name') || '', callId: p.get('callId') || '', transfer: p.get('transfer') || undefined } });
  const clear = () => {
    if (ringing !== call) return;
    ringing = null;
    setState({ incoming: null });
  };
  call.on('cancel', clear);
  call.on('disconnect', clear);
  call.on('reject', clear);
  call.on('error', clear);
}

export function acceptIncoming() {
  const call = ringing;
  const inc = state.incoming;
  if (!call || !inc) return;
  ringing = null;
  setState({ incoming: null });
  track(call, { direction: 'in', number: inc.number, name: inc.name, callId: inc.callId, transfer: inc.transfer, state: 'connecting' });
  call.accept();
}
export function rejectIncoming() {
  ringing?.reject();
}
/** Stops ringing here only (others keep ringing, the caller doesn't notice). */
export function ignoreIncoming() {
  const call = ringing;
  ringing = null;
  setState({ incoming: null });
  call?.ignore();
}

/** Calls a number from the browser. Returns false when the browser phone isn't ready (caller falls back). */
export async function phoneDial(number: string, opts: { contactId?: string; name?: string; dialerItem?: string } = {}): Promise<boolean> {
  if (!device || state.status !== 'ready') return false;
  const t = tr('phone');
  if (current) {
    toast(t('Es läuft schon ein Anruf.'));
    setState({ open: true });
    return true;
  }
  const to = number.trim();
  if (!to) return true;
  setState({ open: true });
  try {
    const call = await device.connect({ params: { To: to, ...(opts.contactId ? { contactId: opts.contactId } : {}), ...(opts.dialerItem ? { dialerItem: opts.dialerItem } : {}) } });
    track(call, { direction: 'out', number: to, name: opts.name ?? '', callId: '', contactId: opts.contactId, state: 'connecting' });
  } catch (e) {
    toastError(t('Anruf: {error}', { error: message(e) }));
  }
  return true;
}

export const hangUp = () => current?.disconnect();
export const toggleMute = () => current && current.mute(!current.isMuted());
export const sendDigit = (d: string) => current?.sendDigits(d);

export async function holdCall() {
  const c = state.call;
  if (!c || !current) return;
  const t = tr('phone');
  const key = c.callId || current.parameters?.CallSid;
  if (!key || c.state !== 'open') return toast(t('Halten geht erst, wenn verbunden ist.'));
  setState({ call: { ...c, holding: true } });
  const r = await act(() => api.post(`/api/phone/calls/${encodeURIComponent(key)}/hold`));
  if (!r) return state.call && setState({ call: { ...state.call, holding: false } });
  setState({ held: [...state.held.filter((h) => h.callId !== r.call_id), { callId: r.call_id, number: c.number, name: c.name || r.contact_name, since: Date.now() }] });
  // Twilio ends the browser leg; just in case it lingers:
  setTimeout(() => current && state.call?.holding && current.disconnect(), 4000);
  watchHeld();
}

export async function resumeCall(callId: string) {
  if (!device) return;
  const t = tr('phone');
  if (current) return toast(t('Erst den laufenden Anruf beenden oder halten.'));
  const h = state.held.find((x) => x.callId === callId);
  if (!h) return;
  setState({ held: state.held.filter((x) => x.callId !== callId) });
  try {
    const call = await device.connect({ params: { resume: callId } });
    track(call, { direction: 'out', number: h.number, name: h.name, callId, state: 'connecting' });
  } catch (e) {
    toastError(t('Fortsetzen: {error}', { error: message(e) }));
    setState({ held: [...state.held, h] });
  }
}

export async function hangUpHeld(callId: string) {
  const r = await act(() => api.post(`/api/phone/calls/${encodeURIComponent(callId)}/hangup`));
  if (r) setState({ held: state.held.filter((x) => x.callId !== callId) });
}

/** Held calls can end on the other side: poll until none is left. */
function watchHeld() {
  if (heldTimer) return;
  const t = tr('phone');
  heldTimer = setInterval(async () => {
    if (!state.held.length) {
      clearInterval(heldTimer);
      heldTimer = undefined;
      return;
    }
    for (const h of state.held) {
      const r = await api.get(`/api/phone/calls/${encodeURIComponent(h.callId)}`).catch(() => null);
      if (r?.ended) {
        setState({ held: state.held.filter((x) => x.callId !== h.callId) });
        toast(t('Gehaltener Anruf beendet: {who}', { who: h.name || h.number }));
      }
    }
  }, 5000);
}

export async function setAvailable(available: boolean) {
  setState({ available });
  await ping(available);
  if (!device || !state.incomingAllowed) return;
  if (available) await register();
  else await device.unregister().catch(() => undefined);
}

// --- UI ------------------------------------------------------------------------------------------

const KEYS: [string, string][] = [
  ['1', ''],
  ['2', 'ABC'],
  ['3', 'DEF'],
  ['4', 'GHI'],
  ['5', 'JKL'],
  ['6', 'MNO'],
  ['7', 'PQRS'],
  ['8', 'TUV'],
  ['9', 'WXYZ'],
  ['*', ''],
  ['0', '+'],
  ['#', ''],
];

function Keypad({ onKey }: { onKey: (k: string) => void }) {
  const t = useT('phone');
  return (
    <div className="phone-keys">
      {KEYS.map(([k, sub]) => (
        <button key={k} type="button" onClick={() => onKey(k)} aria-label={t('Taste {k}', { k })}>
          <span>{k}</span>
          <small>{sub}</small>
        </button>
      ))}
    </div>
  );
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function useTick(on: boolean) {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!on) return;
    const interval = setInterval(() => setT((x) => x + 1), 1000);
    return () => clearInterval(interval);
  }, [on]);
}

/** Mounted once in the app shell: floating button, dialer panel, incoming popup. */
export function BrowserPhone() {
  const t = useT('phone');
  const p = usePhone();
  useEffect(() => {
    void startPhone();
    return () => stopPhone();
  }, []);
  useEffect(() => {
    const on = p.status === 'ready' || p.status === 'error';
    document.body.classList.toggle('has-phone', on);
    document.body.classList.toggle('phone-open', on && (p.open || !!p.incoming));
    return () => document.body.classList.remove('has-phone', 'phone-open');
  }, [p.status, p.open, p.incoming]);
  if (p.status === 'off' || p.status === 'loading') return null;
  return (
    <>
      {p.incoming && <IncomingPopup inc={p.incoming} />}
      {p.open && <PhonePanel />}
      <button data-tour="phone-fab" className={`phone-fab${p.call ? ' live' : ''}${p.held.length ? ' held' : ''}`} onClick={() => setState({ open: !state.open })} aria-label={t('Telefon')} title={p.status === 'error' ? t('Telefon: {error}', { error: p.error }) : t('Telefon')}>
        <Icon name="phone" size={22} />
        {p.call?.startedAt ? <CallClock since={p.call.startedAt} /> : null}
        <span className={`dot ${p.status === 'error' ? 'err' : p.registered ? 'on' : 'off'}`} />
      </button>
    </>
  );
}

function CallClock({ since }: { since: number }) {
  useTick(true);
  return <span className="phone-fab-clock">{clock(Date.now() - since)}</span>;
}

function IncomingPopup({ inc }: { inc: Incoming }) {
  const t = useT('phone');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && ignoreIncoming();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="phone-incoming" role="alertdialog" aria-label={t('Eingehender Anruf')}>
      <button className="icon-btn phone-x" onClick={ignoreIncoming} aria-label={t('Klingeln hier ausblenden')} title={t('Hier nicht mehr klingeln (Esc)')}>
        ✕
      </button>
      <div className="muted small">
        <Icon name="callIn" size={14} /> {t('Eingehender Anruf')}
      </div>
      <div className="phone-who">{inc.name || inc.number}</div>
      {inc.name && <div className="muted">{inc.number}</div>}
      <div className="phone-incoming-actions">
        <button className="btn phone-accept" onClick={acceptIncoming}>
          <Icon name="phone" size={16} /> {t('Annehmen')}
        </button>
        <button className="btn danger" onClick={rejectIncoming}>
          <Icon name="hangup" size={16} /> {t('Ablehnen')}
        </button>
      </div>
    </div>
  );
}

function PhonePanel() {
  const t = useT('phone');
  const p = usePhone();
  const [num, setNum] = useState('');
  const [keypad, setKeypad] = useState(false);
  const [devices, setDevices] = useState(false);
  const [transfer, setTransfer] = useState<{ callId: string; held: boolean; name: string } | null>(null);
  const c = p.call;
  useTick(!!c?.startedAt);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !devices && !transfer && setState({ open: false });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [devices, transfer]);
  const status = p.status === 'error' ? p.error : !p.incomingAllowed ? t('Nur ausgehend') : p.registered ? t('Erreichbar') : p.available ? t('Verbindet…') : t('Nicht erreichbar');
  return (
    <div className="phone-panel" role="dialog" aria-label={t('Telefon')}>
      <div className="phone-head">
        <strong>{t('Telefon')}</strong>
        <span className={`phone-state ${p.registered ? 'on' : ''}`}>{status}</span>
        <button className="icon-btn" onClick={() => setDevices(true)} aria-label={t('Audiogeräte')} title={t('Mikrofon & Lautsprecher')}>
          <Icon name="headset" size={16} />
        </button>
        <button className="icon-btn" onClick={() => setState({ open: false })} aria-label={t('Schließen')} title={t('Schließen (Esc)')}>
          ✕
        </button>
      </div>
      {c ? (
        <div className="phone-call">
          <div className="phone-who">{c.name || c.number}</div>
          {c.name && <div className="muted">{c.number}</div>}
          <div className="phone-timer">{c.holding ? t('Wird gehalten…') : c.state === 'open' && c.startedAt ? clock(Date.now() - c.startedAt) : c.state === 'ringing' ? t('Klingelt…') : t('Verbinde…')}</div>
          {keypad && <Keypad onKey={sendDigit} />}
          <div className="phone-controls">
            <button className={`phone-ctl${c.muted ? ' on' : ''}`} onClick={toggleMute} aria-pressed={c.muted} title={c.muted ? t('Stummschaltung aufheben') : t('Stumm schalten')}>
              <Icon name={c.muted ? 'micOff' : 'mic'} size={18} />
              <span>{c.muted ? t('Stumm') : t('Mikro')}</span>
            </button>
            <button className="phone-ctl" onClick={holdCall} disabled={c.state !== 'open' || c.holding} title={t('Halten – der Anrufer hört Wartemusik')}>
              <Icon name="pause" size={18} />
              <span>{t('Halten')}</span>
            </button>
            <button className={`phone-ctl${keypad ? ' on' : ''}`} onClick={() => setKeypad(!keypad)} aria-pressed={keypad} title={t('Tastenfeld (Tonwahl)')}>
              <Icon name="keypad" size={18} />
              <span>{t('Tasten')}</span>
            </button>
            <button className="phone-ctl end" onClick={hangUp} title={t('Auflegen')}>
              <Icon name="hangup" size={18} />
              <span>{t('Auflegen')}</span>
            </button>
          </div>
          <CallTools callId={c.callId} open={c.state === 'open'} onTransfer={() => setTransfer({ callId: c.callId, held: false, name: c.name || c.number })} />
          <Slot name="call.panel" contactId={c.contactId} />
        </div>
      ) : (
        <form
          className="phone-dial"
          onSubmit={(e) => {
            e.preventDefault();
            void phoneDial(num);
          }}
        >
          <div className="phone-number">
            <input value={num} onChange={(e) => setNum(e.target.value)} placeholder={t('Nummer eingeben')} inputMode="tel" autoComplete="tel" aria-label={t('Telefonnummer')} />
            {num && (
              <button type="button" className="icon-btn" onClick={() => setNum(num.slice(0, -1))} aria-label={t('Löschen')}>
                <Icon name="backspace" size={16} />
              </button>
            )}
          </div>
          <Keypad onKey={(k) => setNum(num + k)} />
          <button className="btn phone-accept phone-go" disabled={!num.trim() || p.status !== 'ready'}>
            <Icon name="phone" size={16} /> {t('Anrufen')}
          </button>
          {p.incomingAllowed && <Check checked={p.available} onChange={(v) => void setAvailable(v)} label={t('Für eingehende Anrufe erreichbar')} />}
          {p.number && <div className="muted small">{t('Angezeigte Nummer: {number}', { number: p.number })}</div>}
        </form>
      )}
      {p.held.length > 0 && (
        <div className="phone-held">
          {p.held.map((h) => (
            <div key={h.callId} className="phone-held-row">
              <Icon name="pause" size={14} />
              <span className="grow">{h.name || h.number}</span>
              <button className="btn small" onClick={() => void resumeCall(h.callId)} disabled={!!c}>
                {t('Fortsetzen')}
              </button>
              <button className="btn small secondary" onClick={() => setTransfer({ callId: h.callId, held: true, name: h.name || h.number })} title={t('An eine Kollegin, einen Kollegen oder eine Nummer übergeben')}>
                {t('Übergeben')}
              </button>
              <button className="btn small danger" onClick={() => void hangUpHeld(h.callId)} aria-label={t('Gehaltenen Anruf beenden')}>
                <Icon name="hangup" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      {devices && <DevicesModal onClose={() => setDevices(false)} />}
      {transfer && (
        <TransferModal
          callId={transfer.callId}
          held={transfer.held}
          name={transfer.name}
          ensureHold={async () => {
            await holdCall();
            return state.held.some((h) => h.callId === transfer.callId);
          }}
          onAccepted={() => setState({ held: state.held.filter((h) => h.callId !== transfer.callId) })}
          onClose={() => setTransfer(null)}
        />
      )}
    </div>
  );
}

function DevicesModal({ onClose }: { onClose: () => void }) {
  const t = useT('phone');
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [sel, setSel] = useState({ input: store.get('input'), output: store.get('output'), ringtone: store.get('ringtone') });
  const [err, setErr] = useState('');
  const canPickOutput = !!device?.audio?.isOutputSelectionSupported;
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        // Labels only show once the microphone may be used.
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((trk) => trk.stop());
      } catch {
        if (live) setErr(t('Kein Zugriff aufs Mikrofon – bitte im Browser erlauben.'));
      }
      const list = await navigator.mediaDevices.enumerateDevices().catch(() => [] as MediaDeviceInfo[]);
      if (!live) return;
      setInputs(list.filter((d) => d.kind === 'audioinput'));
      setOutputs(list.filter((d) => d.kind === 'audiooutput'));
    })();
    return () => {
      live = false;
    };
  }, []);
  const pick = async (k: 'input' | 'output' | 'ringtone', id: string) => {
    setSel({ ...sel, [k]: id });
    store.set(k, id);
    try {
      if (!device) return;
      if (k === 'input') await (id ? device.audio?.setInputDevice(id) : device.audio?.unsetInputDevice());
      else if (canPickOutput) await (k === 'output' ? device.audio!.speakerDevices : device.audio!.ringtoneDevices).set(id || 'default');
    } catch (e) {
      toastError(message(e));
    }
  };
  const opts = (list: MediaDeviceInfo[]) => list.map((d, i): [string, string] => [d.deviceId, d.label || t('Gerät {n}', { n: i + 1 })]);
  return (
    <Modal title={t('Mikrofon & Lautsprecher')} onClose={onClose}>
      {err && <p className="voice-warn small">{err}</p>}
      <Field label={t('Mikrofon')}>
        <Select value={sel.input} onChange={(v) => void pick('input', v)} placeholder={t('Standard')} options={opts(inputs)} />
      </Field>
      {canPickOutput ? (
        <>
          <Field label={t('Lautsprecher / Headset')}>
            <Select value={sel.output} onChange={(v) => void pick('output', v)} placeholder={t('Standard')} options={opts(outputs)} />
          </Field>
          <Field label={t('Klingelton auf')}>
            <Select value={sel.ringtone} onChange={(v) => void pick('ringtone', v)} placeholder={t('Standard')} options={opts(outputs)} />
          </Field>
        </>
      ) : (
        <p className="muted small">{t('Dieser Browser lässt die Ausgabe nicht wählen – es wird der Standard-Lautsprecher genutzt.')}</p>
      )}
    </Modal>
  );
}

/** "Wählen" in the call log: opens the dialer when the browser phone is on. */
export function PhoneDialButton() {
  const t = useT('phone');
  const p = usePhone();
  if (p.status !== 'ready') return null;
  return (
    <button className="btn" data-tour="phone-dial" onClick={() => setState({ open: true })}>
      <Icon name="keypad" size={16} /> {t('Wählen')}
    </button>
  );
}

// --- settings (Einstellungen → Telefonie) -------------------------------------------------------

const edgeLabel = (e: string, t: (k: string) => string) => {
  const map: Record<string, string> = {
    roaming: t('Automatisch (nächster Standort)'),
    frankfurt: t('Frankfurt'),
    dublin: t('Dublin'),
    ashburn: t('Ashburn (USA)'),
    umatilla: t('Umatilla (USA)'),
    sydney: t('Sydney'),
    tokyo: t('Tokio'),
    singapore: t('Singapur'),
    'sao-paulo': t('São Paulo'),
  };
  return map[e] ?? e;
};

export function BrowserPhoneSettings() {
  const t = useT('phone');
  const data = useLoad(() => api.get<any>('/api/phone/settings'), []);
  const [s, setS] = useState<any>();
  const [busy, setBusy] = useState(false);
  useEffect(() => setS(data.data ? { ...data.data } : undefined), [data.data]);
  if (!s || !data.data) return data.error ? <Empty>{data.error}</Empty> : <Spinner />;
  const d = data.data;
  const set = (p: any) => setS({ ...s, ...p });
  const save = async () => {
    const { enabled, api_key_sid, api_secret, twiml_app_sid, incoming, edge } = s;
    const r = await act(() => api.put('/api/phone/settings', { enabled, api_key_sid, api_secret, twiml_app_sid, incoming, edge }), t('Gespeichert'));
    if (r) {
      data.setData(r);
      void restartPhone();
    }
  };
  return (
    <div className="card" style={{ marginTop: 14 }} data-tour="tel-browser">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>
          <Icon name="headset" size={18} /> {t('Browser-Telefon')}
        </h2>
        {!d.enabled ? <Badge>{t('aus')}</Badge> : d.ready ? <Badge tone="green">{t('Bereit')}</Badge> : <Badge tone="yellow">{t('Es fehlt: {items}', { items: d.missing.join(', ') })}</Badge>}
      </div>
      <p className="muted small">
        {t('Telefonieren direkt im Browser über Twilio (Headset empfohlen); eingehende Anrufe klingeln bei allen, die erreichbar sind. Braucht HTTPS und Mikrofon-Freigabe.')}
      </p>
      <Check checked={s.enabled} onChange={(v) => set({ enabled: v })} label={t('Browser-Telefon einschalten')} />
      <MoreFields id="tel-browser-manual" label={t('Von Hand einrichten')} values={[s.api_key_sid, s.twiml_app_sid]}>
      <div className="grid2">
        <Field label={t('API Key SID')} hint={t('Twilio-Konsole → Account → API keys & tokens → Create API key (Standard).')}>
          <Input value={s.api_key_sid} onChange={(v) => set({ api_key_sid: v })} placeholder={t('SK…')} autoComplete="off" />
        </Field>
        <Field label={t('API Key Secret')} hint={t('Wird verschlüsselt gespeichert und nie wieder angezeigt.')}>
          <Input type="password" value={s.api_secret} onChange={(v) => set({ api_secret: v })} autoComplete="new-password" />
        </Field>
        <Field label={t('TwiML App SID')} hint={t('Twilio → Voice → TwiML Apps; Voice-URL siehe unten.')}>
          <Input value={s.twiml_app_sid} onChange={(v) => set({ twiml_app_sid: v })} placeholder={t('AP…')} autoComplete="off" />
        </Field>
        <Field label={t('Twilio-Standort')}>
          <Select value={s.edge} onChange={(v) => set({ edge: v })} options={d.edges.map((e: string) => [e, edgeLabel(e, t)])} />
        </Field>
      </div>
      <Field label={t('TwiML App → Voice Request URL (POST)')}>
        <CodeBox text={d.webhooks.voice} />
      </Field>
      <Field label={t('TwiML App → Status Callback URL (POST, optional)')}>
        <CodeBox text={d.webhooks.status} />
      </Field>
      </MoreFields>
      <div className="actions" style={{ margin: '2px 0 12px' }}>
        <button
          className="btn small secondary"
          disabled={busy}
          title={t('Legt API-Key und TwiML-App mit Account SID und Auth Token an (bzw. trägt die Adressen bei der vorhandenen App ein)')}
          onClick={async () => {
            setBusy(true);
            const r = await act(() => api.post('/api/phone/setup'), t('Bei Twilio eingerichtet'));
            setBusy(false);
            if (r) {
              data.setData(r);
              void restartPhone();
            }
          }}
        >
          <Icon name="refresh" size={14} /> {t('Bei Twilio automatisch einrichten')}
        </button>
      </div>
      <Field label={t('Eingehende Anrufe')}>
        <Select
          value={s.incoming}
          onChange={(v) => set({ incoming: v })}
          options={[
            ['parallel', t('Browser und Handy klingeln gleichzeitig')],
            ['browser_only', t('Nur im Browser (Handy nur, wenn niemand im Browser erreichbar ist)')],
            ['off', t('Nur Handy – der Browser telefoniert nur ausgehend')],
          ]}
        />
      </Field>
      <p>
        <button className="btn" onClick={save}>
          {t('Speichern')}
        </button>
      </p>
    </div>
  );
}
