import { useState, type ReactNode } from 'react';
import { api } from '../api';
import { Icon } from '../icons';
import { Badge, Modal, act, toast } from '../ui';
import { useT } from '../i18n';
import './cognee.css';

/** Pieces shared by the agency card and the sub-account tab of the Wissensgedächtnis (docs/cognee.md). */

export type Json = Record<string, any>;

export function Note({ level = 'info', children }: { level?: 'critical' | 'warning' | 'ok' | 'info'; children: ReactNode }) {
  return (
    <div className={`cg-note ${level}`} role={level === 'critical' ? 'alert' : undefined}>
      <Icon name={level === 'ok' ? 'shieldOk' : level === 'info' ? 'lock' : 'shield'} size={16} />
      <p>{children}</p>
    </div>
  );
}

/** Where the Cognee server's access control stands, as a badge. */
export function PostureBadge({ state }: { state?: string | null }) {
  const t = useT('cognee');
  if (state === 'closed') return <Badge tone="green">{t('Zugriffskontrolle an')}</Badge>;
  if (state === 'open') return <Badge tone="red">{t('Server ohne Anmeldung!')}</Badge>;
  return <Badge tone="yellow">{t('Zugriffskontrolle nicht geprüft')}</Badge>;
}

/**
 * "Daten in Cognee löschen": offered after a type or the whole sub-account was switched off (and on request). The deletion
 * is queued and sent to Cognee in the background; the dialog says what it removes.
 */
export function PurgeDialog({ types, labels, url, onClose }: { types: string[]; labels: Record<string, string>; url: string; onClose: (done?: boolean) => void }) {
  const t = useT('cognee');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={t('Daten in Cognee löschen?')}
      onClose={() => onClose()}
      footer={
        <>
          <button className="btn secondary" onClick={() => onClose()}>
            {t('Später')}
          </button>
          <button
            className="btn danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await act(() => api.post<Json>(url, { types, confirm: true }));
              setBusy(false);
              if (r) {
                toast(t('Löschung angestoßen ({count} {item})', { count: r.items, item: r.items === 1 ? t('Eintrag') : t('Einträge') }));
                onClose(true);
              }
            }}
          >
            {t('Jetzt in Cognee löschen')}
          </button>
        </>
      }
    >
      <p>
        {t('Die Freigabe ist beendet – es wird nichts mehr übertragen. Die bereits übertragenen Daten liegen aber noch auf dem Cognee-Server:')}
      </p>
      <ul>
        {types.map((t) => (
          <li key={t}>{labels[t] ?? t}</li>
        ))}
      </ul>
      <p className="muted small">{t('„Jetzt löschen“ entfernt diese Daten dort endgültig (das jeweilige Dataset mit Wissensgraph und Vektoren). In HyperLevel bleibt alles unverändert. Bei „Später“ bleiben sie in Cognee, bis du sie über „Status“ löschst.')}</p>
    </Modal>
  );
}
