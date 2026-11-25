import { useState } from 'react';
import { api } from '../api';
import { ColumnChart } from '../charts/BarChart';
import { LineChart } from '../charts/LineChart';
import { color, type Shaped } from '../charts/core';
import { Empty, Select, Spinner, useLoad } from '../ui';
import { useT } from '../i18n';
import { Kpi, Sec, euro } from './CommunityParts';
import { SortableGrid } from '../sortable/Sortable';

/**
 * Community → Zahlen: members over time, MRR and churn, trial conversion, active members per day, posts and comments per day,
 * top contributors and engagement. The numbers come from /api/community/groups/:id/analytics (services/community-growth.ts).
 */

const dayLabel = (ymd: string) => `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}.${ymd.slice(0, 4)}`;
const cats = (rows: { day: string }[]) => rows.map((r) => ({ k: r.day, l: dayLabel(r.day) }));
const shaped = (rows: { day: string }[], series: { key: string; label: string; values: number[] }[]): Shaped => ({
  categories: cats(rows),
  series: series.map((s, i) => ({ ...s, color: color(i) })),
  format: 'number',
  measures: [0],
  integer: true,
});
const pct = (v: number | null | undefined) => (v === null || v === undefined ? '–' : `${String(v).replace('.', ',')} %`);

export function StatsTab({ group }: { group: any }) {
  const t = useT('community');
  const [days, setDays] = useState('30');
  const r = useLoad(() => api.get<any>(`/api/community/groups/${group.id}/analytics?days=${days}`), [group.id, days]);
  const a = r.data;
  return (
    <div className="cma">
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <p className="muted" style={{ margin: 0 }}>
          {t('Zeitraum: {range}', { range: a ? `${dayLabel(a.range.from)} – ${dayLabel(a.range.to)}` : '…' })}
        </p>
        <div style={{ width: 200 }}>
          <Select value={days} onChange={setDays} options={[['7', t('Letzte 7 Tage')], ['30', t('Letzte 30 Tage')], ['90', t('Letzte 90 Tage')], ['365', t('Letztes Jahr')]]} />
        </div>
      </div>
      {r.error ? (
        <Empty>{r.error}</Empty>
      ) : !a ? (
        <Spinner />
      ) : (
        <>
          <SortableGrid id="community-stats" className="cma-kpis" data-tour="community-stats">
            <Kpi label={t('Mitglieder')} value={a.totals.members} note={t('{n} neu · {m} gegangen', { n: a.totals.new_in_range, m: a.totals.left_in_range })} />
            <Kpi label={t('Aktiv heute')} value={a.totals.dau_today} note={t('Ø {n} pro Tag', { n: String(a.totals.dau_avg).replace('.', ',') })} />
            <Kpi label={t('Engagement')} value={pct(a.totals.engagement_rate)} note={t('{mau} von {members} in 30 Tagen aktiv', { mau: a.totals.mau, members: a.totals.members })} />
            <Kpi label={t('MRR (netto)')} value={euro(a.revenue.mrr_cents, a.revenue.currency)} note={t('{arr} im Jahr', { arr: euro(a.revenue.arr_cents, a.revenue.currency) })} />
            <Kpi label={t('Zahlende')} value={a.revenue.paying} note={`${t('{trialing} in der Testphase', { trialing: a.revenue.trialing })}${a.revenue.past_due ? t(' · {past_due} Zahlung offen', { past_due: a.revenue.past_due }) : ''}`} />
            <Kpi label={t('Abwanderung')} value={pct(a.churn.paying_rate)} note={t('Zahlende · alle Mitglieder {rate}', { rate: pct(a.churn.members_rate) })} tone={a.churn.paying_rate > 10 ? 'red' : undefined} />
            <Kpi label={t('Testphase → Abo')} value={pct(a.trials.conversion_rate)} note={t('{started} gestartet · {converted} umgewandelt · {lost} verloren', { started: a.trials.started, converted: a.trials.converted, lost: a.trials.lost })} />
            <Kpi label={t('Beiträge pro Tag')} value={String(a.totals.posts_per_day).replace('.', ',')} note={t('{comments} Kommentare pro Tag', { comments: a.totals.comments_per_day.toString().replace('.', ',') })} />
          </SortableGrid>
          {a.requests.pending > 0 && (
            <div className="cma-note">
              <strong>{t('{pending} Beitrittsanfragen warten auf dich.', { pending: a.requests.pending })}</strong> {t('Du findest sie unter „Beitritt → Anfragen“.')}
            </div>
          )}
          <SortableGrid id="community.stats" className="cma-grid">
            <Sec title={t('Mitglieder')} lead={t('Alle, die zum Ende des Tages dabei waren.')}>
              <LineChart area height={240} data={shaped(a.members, [{ key: 'total', label: t('Mitglieder'), values: a.members.map((x: any) => x.total) }])} />
            </Sec>
            <Sec title={t('Neu und gegangen')} lead={t('Wer pro Tag dazukam und wer ging (Kündigung, Zahlung fehlgeschlagen, Entfernung).')}>
              <ColumnChart stacked height={240} data={shaped(a.members, [{ key: 'joined', label: t('Neu'), values: a.members.map((x: any) => x.joined) }, { key: 'left', label: t('Gegangen'), values: a.members.map((x: any) => x.left) }])} />
            </Sec>
            <Sec title={t('Aktive Mitglieder pro Tag')} lead={t('Wer an dem Tag die Community geöffnet hat.')}>
              <LineChart height={240} data={shaped(a.dau, [{ key: 'dau', label: t('Aktiv'), values: a.dau.map((x: any) => x.n) }])} />
            </Sec>
            <Sec title={t('Beiträge und Kommentare pro Tag')}>
              <ColumnChart stacked height={240} data={shaped(a.activity, [{ key: 'posts', label: t('Beiträge'), values: a.activity.map((x: any) => x.posts) }, { key: 'comments', label: t('Kommentare'), values: a.activity.map((x: any) => x.comments) }])} />
            </Sec>
            <Sec title={t('Umsatz nach Stufe')} lead={t('Monatlich wiederkehrend, netto (Jahresbeiträge geteilt durch 12, ohne Testphasen und Einmalzahlungen).')}>
              {a.revenue.by_tier.length ? (
                <div className="table-wrap" style={{ border: 0 }}>
                  <table className="t cma-table">
                    <thead>
                      <tr>
                        <th>{t('Stufe')}</th>
                        <th>{t('Mitglieder')}</th>
                        <th>{t('MRR')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.revenue.by_tier.map((tRow: any) => (
                        <tr key={tRow.tier_id}>
                          <td>{tRow.name}</td>
                          <td>{tRow.members}</td>
                          <td>{euro(tRow.mrr_cents, a.revenue.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">{t('Noch keine Mitgliedschaften mit Stufe.')}</p>
              )}
              {a.revenue.trial_mrr_cents > 0 && <p className="muted small">{t('Dazu kommen {trial_mrr} im Monat, sobald die laufenden Testphasen bezahlt werden. Einmalzahlungen im Zeitraum: {one_time}.', { trial_mrr: euro(a.revenue.trial_mrr_cents, a.revenue.currency), one_time: euro(a.revenue.one_time_cents, a.revenue.currency) })}</p>}
            </Sec>
            <Sec title={t('Aktivste Mitglieder')} lead={t('Nach Punkten im Zeitraum.')}>
              {a.top_contributors.length ? (
                <ul className="cma-list">
                  {a.top_contributors.map((c: any, i: number) => (
                    <li key={c.contact_id}>
                      <b style={{ width: 24, textAlign: 'right' }}>{i + 1}</b>
                      <div className="grow">
                        <div>
                          <strong>{c.name}</strong>
                        </div>
                        <div className="muted small">
                          {t('{posts} Beiträge · {comments} Kommentare', { posts: c.posts, comments: c.comments })}
                        </div>
                      </div>
                      <b>{c.points}</b>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">{t('Im Zeitraum hat noch niemand Punkte gesammelt.')}</p>
              )}
            </Sec>
          </SortableGrid>
        </>
      )}
    </div>
  );
}
