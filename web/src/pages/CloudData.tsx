import { useState } from 'react';
import { api, d } from '../api';
import { Icon } from '../icons';
import { Badge, Field, Input, Modal, Select, act, useLoad } from '../ui';
import { tr, useT } from '../i18n';
import type { CloudMe } from './CloudKit';

/** Cloud-Konto → Daten & Konto: export, support access, contracts (AVV) and deleting the account. */

const SUPPORT: [string, string][] = [
  ['0', 'Aus – niemand vom Support kann mein Konto öffnen'],
  ['1', '1 Stunde'],
  ['24', '24 Stunden'],
  ['168', '7 Tage'],
  ['720', '30 Tage'],
];

function DeleteModal({ me, onClose, onDone }: { me: CloudMe; onClose: () => void; onDone: () => void }) {
  const t = useT('cloud');
  const [confirm, setConfirm] = useState('');
  const [password, setPassword] = useState('');
  const tenant = me.tenant;
  return (
    <Modal
      title={t('Konto löschen')}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            {t('Abbrechen')}
          </button>
          <button
            className="btn danger"
            disabled={confirm !== tenant.name}
            onClick={async () => {
              if (await act(() => api.post('/api/cloud/delete', { confirm, password }), tr('cloud')('Löschung angefordert'))) {
                onDone();
                onClose();
              }
            }}
          >
            {t('Konto löschen lassen')}
          </button>
        </>
      }
    >
      <p>
        {t('Dein Abo wird sofort beendet und das Konto schreibgeschützt. Nach einer Frist werden')} <strong>{t('alle Daten endgültig gelöscht')}</strong>{t(' – Kontakte, Nachrichten, Dateien, Nutzer')}{tenant.entitlements.client_accounts ? t(' und alle Kunden-Accounts') : ''}. {t('Bis dahin kannst du die Löschung zurücknehmen und alles exportieren.')}
      </p>
      <Field label={t('Zur Bestätigung „{name}“ eintippen', { name: tenant.name })}>
        <Input value={confirm} onChange={setConfirm} autoFocus />
      </Field>
      <Field label={t('Passwort')} hint={t('Bei Anmeldung nur mit Google bleibt das Feld leer.')}>
        <Input type="password" value={password} onChange={setPassword} autoComplete="current-password" />
      </Field>
    </Modal>
  );
}

export function CloudData({ me, reload }: { me: CloudMe; reload: () => void }) {
  const t = useT('cloud');
  const tenant = me.tenant;
  const legal = useLoad(() => api.get<{ current: { doc: string; version: number }[]; accepted: { doc: string; version: number; at: string }[] }>('/api/cloud/legal'), []);
  const [del, setDel] = useState(false);
  const [support, setSupport] = useState('24');
  const last = (doc: string) => legal.data?.accepted.find((a) => a.doc === doc);
  return (
    <>
      <div className="card" data-tour="cloud-export">
        <h3 style={{ marginTop: 0 }}>{t('Daten exportieren')}</h3>
        <p className="muted">
          {t('Alle deine Daten als ZIP: je Tabelle eine JSON- und eine CSV-Datei (Kontakte, Aufgaben, Nachrichten, Rechnungen …) plus deine hochgeladenen Dateien – ohne Passwörter und Schlüssel. Das geht jederzeit, auch wenn das Konto schreibgeschützt ist.')}
        </p>
        <a className="btn" href="/api/cloud/export" download>
          <Icon name="download" /> {t('Export herunterladen')}
        </a>
      </div>

      <div className="card" data-tour="cloud-support">
        <h3 style={{ marginTop: 0 }}>
          {t('Support-Zugriff')} {tenant.support.active ? <Badge tone="yellow">{t('freigegeben bis {date}', { date: d(tenant.support.until) })}</Badge> : <Badge>{t('aus')}</Badge>}
        </h3>
        <p className="muted">
          {t('Standardmäßig kann niemand vom Anbieter dein Konto öffnen. Wenn du Hilfe möchtest, gib den Zugriff für eine Zeit frei. Jeder Zugriff steht in deinem Protokoll (Einstellungen → Protokoll).')}
        </p>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="grow">
            <Field label={t('Freigabe')}>
              <Select value={support} onChange={setSupport} options={SUPPORT.map(([k, l]) => [k, t(l)] as [string, string])} />
            </Field>
          </div>
          <button className="btn" style={{ marginBottom: 12 }} onClick={async () => (await act(() => api.put('/api/cloud/support', { hours: Number(support) }), Number(support) ? tr('cloud')('Freigegeben') : tr('cloud')('Widerrufen'))) && reload()}>
            {t('Speichern')}
          </button>
          {tenant.support.active && (
            <button className="btn secondary" style={{ marginBottom: 12 }} onClick={async () => (await act(() => api.put('/api/cloud/support', { hours: 0 }), tr('cloud')('Widerrufen'))) && reload()}>
              {t('Jetzt widerrufen')}
            </button>
          )}
        </div>
      </div>

      <div className="card" data-tour="cloud-contracts">
        <h3 style={{ marginTop: 0 }}>{t('Verträge')}</h3>
        <p className="muted">{t('Der Auftragsverarbeitungsvertrag (AVV) mit deiner Firma, in der Version, der du zugestimmt hast.')}</p>
        <div className="actions">
          <a className="btn secondary" href="/api/cloud/avv" download>
            <Icon name="doc" /> {t('AVV als PDF')}
          </a>
          <a className="btn secondary" href="/api/cloud/avv?format=html" download>
            {t('AVV als HTML')}
          </a>
          <a className="btn ghost" href="/cloud/legal/agb" target="_blank" rel="noopener noreferrer">
            {t('AGB lesen')}
          </a>
          <a className="btn ghost" href="/cloud/legal/datenschutz" target="_blank" rel="noopener noreferrer">
            {t('Datenschutz lesen')}
          </a>
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          {t('Zugestimmt:')} {(['agb', 'avv', 'datenschutz'] as const).map((k) => (last(k) ? `${k.toUpperCase()} v${last(k)!.version} (${d(last(k)!.at)})` : null)).filter(Boolean).join(' · ') || '–'}
        </p>
      </div>

      <div className="card cloud-danger" data-tour="cloud-delete">
        <h3 style={{ marginTop: 0 }}>{t('Konto löschen')}</h3>
        {tenant.deletion?.reason === 'self' ? (
          <>
            <p>{t('Die Löschung ist für den {date} geplant. Bis dahin kannst du sie zurücknehmen.', { date: d(tenant.deletion.at) })}</p>
            <button className="btn secondary" onClick={async () => (await act(() => api.post('/api/cloud/delete/undo', {}), tr('cloud')('Löschung zurückgenommen'))) && reload()}>
              {t('Löschung zurücknehmen')}
            </button>
          </>
        ) : (
          <>
            <p className="muted">{t('Beendet dein Abo und löscht nach einer Frist alle Daten endgültig. Exportiere vorher, was du behalten möchtest.')}</p>
            <button className="btn danger" onClick={() => setDel(true)}>
              {t('Konto löschen …')}
            </button>
          </>
        )}
      </div>
      {del && <DeleteModal me={me} onClose={() => setDel(false)} onDone={reload} />}
    </>
  );
}
