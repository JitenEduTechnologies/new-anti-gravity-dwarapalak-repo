import { useEffect, useState } from 'react';
import { api, d, dt, money } from '../api';
import { Icon } from '../icons';
import { act, Badge, Check, confirmAsk, Empty, Field, Input, Modal, navigate, PageHead, pressable, Select, Spinner, Stat, Tabs, toast, useLoad } from '../ui';
import { useT } from '../i18n';
import { ContactPick, EuroInput, dlHref, euroText, germanDate, parseEuro, qty, ymdLocal } from './boCommon';
import { SortableGrid } from '../sortable/Sortable';

/** Lager & Einkauf: articles (variants, SKU, EAN), places, movements, minimum stock, stock-taking, purchase orders, valuation. */

export function Inventory({ tab }: { tab?: string }) {
  const t = useT('finops');
  const TABS: [string, string][] = [
    ['stock', t('Bestand')],
    ['movements', t('Bewegungen')],
    ['orders', t('Bestellungen')],
    ['counts', t('Inventur')],
    ['valuation', t('Bewertung')],
    ['places', t('Lagerorte')],
    ['settings', t('Einstellungen')],
  ];
  const currentTab = TABS.some(([k]) => k === tab) ? tab! : 'stock';
  const status = useLoad(() => api.get('/api/inventory/status'), []);
  const places = useLoad(() => api.get('/api/inventory/places'), []);
  const articles = useLoad(() => api.get('/api/inventory/articles?all=1&limit=2000'), []);
  const st = status.data;
  const refresh = () => (void status.reload(), void articles.reload(), void places.reload());
  const label = (k: string, l: string) => (k === 'stock' && st?.low ? `${l} (${st.low} knapp)` : k === 'orders' && st?.open_orders ? `${l} (${st.open_orders})` : l);
  return (
    <>
      <PageHead title={t('Lager & Einkauf')} sub={t('Artikel, Bestände, Bestellungen und Inventur – verknüpft mit Produkten und Rechnungen.')} />
      <SortableGrid id="inv-stats" className="stats" data-tour="inv-stats">
        <Stat label={t('Artikel')} value={st?.articles ?? '–'} sub={t('{count} Lagerorte', { count: st?.places ?? 0 })} />
        <Stat label={t('Unter Mindestbestand')} value={<span className={st?.low ? 'bo-neg' : undefined}>{st?.low ?? '–'}</span>} sub={t('löst Benachrichtigung und Workflow aus')} />
        <Stat label={t('Lagerwert')} value={money(st?.value_cents ?? 0)} sub={t('gleitender Durchschnittspreis')} />
        <Stat label={t('Offene Bestellungen')} value={st?.open_orders ?? '–'} sub={st?.open_counts ? t('{count} Inventur läuft', { count: st.open_counts }) : undefined} />
      </SortableGrid>
      <Tabs tabs={TABS.map(([k, l]) => [k, label(k, l)])} value={currentTab} onChange={(v) => navigate(`inventory/${v}`)} />
      {currentTab === 'stock' && <Stock articles={articles.data ?? []} places={places.data ?? []} loading={articles.loading && !articles.data} onChange={refresh} />}
      {currentTab === 'movements' && <Movements articles={articles.data ?? []} places={places.data ?? []} onChange={refresh} />}
      {currentTab === 'orders' && <Orders articles={articles.data ?? []} places={places.data ?? []} onChange={refresh} />}
      {currentTab === 'counts' && <Counts places={places.data ?? []} onChange={refresh} />}
      {currentTab === 'valuation' && <Valuation />}
      {currentTab === 'places' && <Places places={places.data ?? []} onChange={refresh} />}
      {currentTab === 'settings' && <InvSettings />}
    </>
  );
}

const artLabel = (a: any) => `${a.sku} – ${a.name}${a.variant ? ` (${a.variant})` : ''}`;

// --- stock ------------------------------------------------------------------------------------------------------------------

function Stock({ articles, places, loading, onChange }: { articles: any[]; places: any[]; loading: boolean; onChange: () => void }) {
  const t = useT('finops');
  const [q, setQ] = useState('');
  const [low, setLow] = useState(false);
  const [inactive, setInactive] = useState(false);
  const [edit, setEdit] = useState<any>();
  const [move, setMove] = useState<any>();
  const rows = articles.filter((a) => (inactive || a.active) && (!low || a.low) && (!q || `${a.sku} ${a.name} ${a.ean} ${a.variant} ${a.supplier_name}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div style={{ width: 240 }}>
          <Field label={t('Suche')}>
            <Input value={q} onChange={setQ} placeholder={t('Nummer, Name, EAN, Lieferant')} />
          </Field>
        </div>
        <div style={{ marginBottom: 14 }}>
          <Check checked={low} onChange={setLow} label={t('Nur unter Mindestbestand')} />
          <Check checked={inactive} onChange={setInactive} label={t('Inaktive zeigen')} />
        </div>
        <div style={{ marginLeft: 'auto', marginBottom: 12, display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={() => setMove({})}>
            {t('Bewegung buchen')}
          </button>
          <button className="btn" data-tour="inv-new-article" onClick={() => setEdit({})}>
            {t('Artikel anlegen')}
          </button>
        </div>
      </div>
      {loading ? (
        <Spinner />
      ) : rows.length ? (
        <div className="table-wrap" data-tour="inv-stock-list">
          <table className="t">
            <thead>
              <tr>
                <th>{t('Artikel')}</th>
                <th className="num">{t('Bestand')}</th>
                <th className="num">{t('Minimum')}</th>
                <th>{t('Lagerorte')}</th>
                <th className="num">{t('Wert')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="click" style={a.active ? undefined : { opacity: 0.55 }} {...pressable(() => setEdit(a))}>
                  <td>
                    <strong>{a.name}</strong> {a.variant && <span className="muted">({a.variant})</span>}
                    <div className="muted small">
                      <span className="mono">{a.sku}</span>
                      {a.ean ? ` ${t('· EAN {ean}', { ean: a.ean })}` : ''}
                      {a.supplier_name ? ` · ${a.supplier_name}` : ''}
                    </div>
                  </td>
                  <td className="num">
                    {qty(a.qty)} {a.unit} {a.low && <Badge tone="red">knapp</Badge>}
                  </td>
                  <td className="num">{a.min_stock ? qty(a.min_stock) : '–'}</td>
                  <td className="small">
                    {(a.places ?? []).map((p: any) => (
                      <div key={p.place_id}>
                        {p.place}: {qty(p.qty)}
                      </div>
                    ))}
                  </td>
                  <td className="num">{money(a.value_cents)}</td>
                  <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right' }}>
                    <button className="btn small secondary" onClick={() => setMove({ article_id: a.id })}>
                      {t('Buchen')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty action={<button className="btn" onClick={() => setEdit({})}>{t('Ersten Artikel anlegen')}</button>}>{articles.length ? t('Keine Artikel für diese Auswahl.') : t('Noch keine Artikel.')}</Empty>
      )}
      {edit && <ArticleModal article={edit.id ? edit : undefined} articles={articles} places={places} onClose={() => setEdit(undefined)} onDone={() => (setEdit(undefined), onChange())} />}
      {move && <MovementModal articles={articles} places={places} initial={move} onClose={() => setMove(undefined)} onDone={() => (setMove(undefined), onChange())} />}
    </>
  );
}

function ArticleModal({ article, articles, places, onClose, onDone }: { article?: any; articles: any[]; places: any[]; onClose: () => void; onDone: () => void }) {
  const t = useT('finops');
  const MOVE_LABEL = getMoveLabel(t);
  const full = useLoad(() => (article ? api.get(`/api/inventory/articles/${article.id}`) : Promise.resolve(undefined)), [article?.id]);
  const products = useLoad(() => api.get('/api/products'), []);
  const [f, setF] = useState<any>();
  useEffect(() => {
    if (f) return;
    const a = article ? full.data : {};
    if (!a) return;
    setF({
      sku: a.sku ?? '',
      name: a.name ?? '',
      variant: a.variant ?? '',
      parent_id: a.parent_id ?? '',
      unit: a.unit ?? t('Stk'),
      ean: a.ean ?? '',
      min_stock: a.min_stock ? String(a.min_stock) : '',
      reorder_qty: a.reorder_qty ? String(a.reorder_qty) : '',
      supplier: a.supplier_contact_id ? { id: a.supplier_contact_id, name: a.supplier_name || t('Kontakt') } : null,
      supplier_name: a.supplier_name ?? '',
      supplier_sku: a.supplier_sku ?? '',
      product_id: a.product_id ?? '',
      track: a.track === undefined ? true : !!a.track,
      auto_issue: a.auto_issue === undefined ? true : !!a.auto_issue,
      active: a.active === undefined ? true : !!a.active,
      initial_qty: '',
      initial_cost: '',
    });
  }, [full.data]);
  const x = full.data;
  if (!f) return <Modal title={article ? t('Artikel') : t('Neuer Artikel')} onClose={onClose}><Spinner /></Modal>;
  const set = (k: string) => (v: any) => setF((s: any) => ({ ...s, [k]: v }));
  const body = () => ({
    sku: f.sku,
    name: f.name,
    variant: f.variant,
    parent_id: f.parent_id || null,
    unit: f.unit,
    ean: f.ean,
    min_stock: f.min_stock === '' ? 0 : Number(String(f.min_stock).replace(',', '.')),
    reorder_qty: f.reorder_qty === '' ? 0 : Number(String(f.reorder_qty).replace(',', '.')),
    supplier_contact_id: f.supplier?.id ?? null,
    supplier_name: f.supplier ? f.supplier.name : f.supplier_name,
    supplier_sku: f.supplier_sku,
    product_id: f.product_id || null,
    track: f.track,
    auto_issue: f.auto_issue,
    active: f.active,
  });
  return (
    <Modal
      wide
      title={article ? artLabel(article) : t('Neuer Artikel')}
      onClose={onClose}
      footer={
        <>
          {article && !x?.movements?.length && (
            <button className="btn ghost danger-text" onClick={async () => confirmAsk(t('Artikel löschen?')) && (await act(() => api.del(`/api/inventory/articles/${article.id}`), t('Gelöscht'))) && onDone()}>
              {t('Löschen')}
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button className="btn secondary" onClick={onClose}>{t('Abbrechen')}</button>
          <button
            className="btn"
            onClick={async () => {
              const b: any = body();
              if (!article) Object.assign(b, { initial_qty: f.initial_qty ? Number(String(f.initial_qty).replace(',', '.')) : 0, initial_cost_cents: parseEuro(f.initial_cost) ?? undefined });
              if (await act(() => (article ? api.patch(`/api/inventory/articles/${article.id}`, b) : api.post('/api/inventory/articles', b)), t('Gespeichert'))) onDone();
            }}
          >
            {t('Speichern')}
          </button>
        </>
      }
    >
      <div className="grid3">
        <Field label={t('Artikelnummer (SKU)')} hint={article ? undefined : t('Leer lassen für eine automatische Nummer')}>
          <Input value={f.sku} onChange={set('sku')} />
        </Field>
        <Field label={t('Bezeichnung')}>
          <Input value={f.name} onChange={set('name')} />
        </Field>
        <Field label={t('Einheit')}>
          <Input value={f.unit} onChange={set('unit')} placeholder={t('Stk, kg, m …')} />
        </Field>
      </div>
      <div className="grid3">
        <Field label={t('Variante')} hint={t('z. B. Größe L, rot')}>
          <Input value={f.variant} onChange={set('variant')} />
        </Field>
        <Field label={t('Gehört zu Hauptartikel')}>
          <Select value={f.parent_id} onChange={set('parent_id')} placeholder={t('– eigenständig –')} options={articles.filter((a) => !a.parent_id && a.id !== article?.id).map((a) => [a.id, artLabel(a)] as [string, string])} />
        </Field>
        <Field label={t('EAN / GTIN')} hint={t('Prüfziffer wird kontrolliert')}>
          <Input value={f.ean} onChange={set('ean')} inputMode="numeric" />
        </Field>
      </div>
      <div className="grid3">
        <Field label={t('Mindestbestand')} hint={t('Darunter: Benachrichtigung und Workflow „Mindestbestand unterschritten“')}>
          <Input value={f.min_stock} onChange={set('min_stock')} inputMode="decimal" />
        </Field>
        <Field label={t('Nachbestellmenge')}>
          <Input value={f.reorder_qty} onChange={set('reorder_qty')} inputMode="decimal" />
        </Field>
        <Field label={t('Produkt (für automatischen Warenausgang)')}>
          <Select value={f.product_id} onChange={set('product_id')} placeholder={t('– keins –')} options={(products.data ?? []).map((p: any) => [p.id, p.name] as [string, string])} />
        </Field>
      </div>
      <div className="grid3">
        <Field label={t('Lieferant (Kontakt)')}>
          <ContactPick value={f.supplier} onChange={set('supplier')} placeholder={t('Kontakt suchen …')} />
        </Field>
        <Field label={t('oder Lieferant (Name)')}>
          <Input value={f.supplier_name} onChange={set('supplier_name')} disabled={!!f.supplier} />
        </Field>
        <Field label={t('Artikelnummer beim Lieferanten')}>
          <Input value={f.supplier_sku} onChange={set('supplier_sku')} />
        </Field>
      </div>
      {!article && (
        <div className="grid2">
          <Field label={t('Anfangsbestand')}>
            <Input value={f.initial_qty} onChange={set('initial_qty')} inputMode="decimal" />
          </Field>
          <Field label={t('Einkaufspreis je Einheit (€)')}>
            <EuroInput value={f.initial_cost} onChange={set('initial_cost')} />
          </Field>
        </div>
      )}
      <div className="row">
        <Check checked={f.track} onChange={set('track')} label={t('Bestand führen und überwachen')} />
        <Check checked={f.auto_issue} onChange={set('auto_issue')} label={t('Bei Rechnungen automatisch ausbuchen')} />
        {article && <Check checked={f.active} onChange={set('active')} label={t('Aktiv')} />}
      </div>
      {x && (
        <>
          <hr />
          <p>
            {t('Bestand')} <strong>{qty(x.qty)} {x.unit}</strong> {t('· Ø Einkaufspreis')} {money(x.avg_cost_cents)} {t('· Wert')} {money(x.value_cents)}
            {x.variants?.length ? t('· Varianten: {count}', { count: x.variants.map((v: any) => v.variant || v.sku).join(', ') }) : ''}
          </p>
          {!!x.movements?.length && (
            <table className="t">
              <thead>
                <tr>
                  <th>{t('Datum')}</th>
                  <th>{t('Art')}</th>
                  <th className="num">{t('Menge')}</th>
                  <th>{t('Lagerort')}</th>
                  <th>{t('Hinweis')}</th>
                </tr>
              </thead>
              <tbody>
                {x.movements.slice(0, 12).map((m: any) => (
                  <tr key={m.id}>
                    <td className="muted small">{dt(m.created_at)}</td>
                    <td>{MOVE_LABEL[m.type] ?? m.type}</td>
                    <td className="num">{m.qty > 0 ? '+' : ''}{qty(m.qty)}</td>
                    <td>{m.place}</td>
                    <td className="muted small">{m.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </Modal>
  );
}

// --- movements -----------------------------------------------------------------------------------------------------------------

const getMoveLabel = (t: any): Record<string, string> => ({ receipt: t('Wareneingang'), issue: t('Warenausgang'), transfer_out: t('Umlagerung (ab)'), transfer_in: t('Umlagerung (an)'), correction: t('Korrektur'), count: t('Inventur-Differenz') });

function Movements({ articles, places, onChange }: { articles: any[]; places: any[]; onChange: () => void }) {
  const t = useT('finops');
  const MOVE_LABEL = getMoveLabel(t);
  const [article, setArticle] = useState('');
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [modal, setModal] = useState(false);
  const qs = new URLSearchParams({ ...(article ? { article_id: article } : {}), ...(type ? { type } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
  const list = useLoad(() => api.get(`/api/inventory/movements?${qs}`), [qs]);
  const rows: any[] = list.data ?? [];
  return (
    <>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div style={{ width: 240 }}>
          <Field label={t('Artikel')}>
            <Select value={article} onChange={setArticle} placeholder={t('Alle')} options={articles.map((a) => [a.id, artLabel(a)] as [string, string])} />
          </Field>
        </div>
        <div style={{ width: 170 }}>
          <Field label={t('Art')}>
            <Select value={type} onChange={setType} placeholder={t('Alle')} options={Object.entries(MOVE_LABEL)} />
          </Field>
        </div>
        <div style={{ width: 140 }}>
          <Field label={t('Von')}>
            <Input type="date" value={from} onChange={setFrom} />
          </Field>
        </div>
        <div style={{ width: 140 }}>
          <Field label={t('Bis')}>
            <Input type="date" value={to} onChange={setTo} />
          </Field>
        </div>
        <div style={{ marginLeft: 'auto', marginBottom: 12 }}>
          <button className="btn" data-tour="inv-book" onClick={() => setModal(true)}>
            {t('Bewegung buchen')}
          </button>
        </div>
      </div>
      {list.loading && !list.data ? (
        <Spinner />
      ) : rows.length ? (
        <div className="table-wrap" data-tour="inv-movements">
          <table className="t">
            <thead>
              <tr>
                <th>{t('Datum')}</th>
                <th>{t('Art')}</th>
                <th>{t('Artikel')}</th>
                <th>{t('Lagerort')}</th>
                <th className="num">{t('Menge')}</th>
                <th className="num">{t('Preis')}</th>
                <th className="num">{t('Bestand danach')}</th>
                <th>{t('Hinweis')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="muted small" style={{ whiteSpace: 'nowrap' }}>{dt(m.created_at)}</td>
                  <td>{m.type_label}</td>
                  <td>
                    <span className="mono">{m.sku}</span> {m.name}
                  </td>
                  <td>{m.place}</td>
                  <td className="num">
                    <span className={m.qty < 0 ? 'bo-neg' : undefined}>{m.qty > 0 ? '+' : ''}{qty(m.qty)} {m.unit}</span>
                  </td>
                  <td className="num">{m.unit_cost_cents ? money(m.unit_cost_cents) : '–'}</td>
                  <td className="num">{qty(m.balance)}</td>
                  <td className="muted small">{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{t('Keine Bewegungen.')}</Empty>
      )}
      {modal && <MovementModal articles={articles} places={places} initial={{}} onClose={() => setModal(false)} onDone={() => (setModal(false), void list.reload(), onChange())} />}
    </>
  );
}

function MovementModal({ articles, places, initial, onClose, onDone }: { articles: any[]; places: any[]; initial: { article_id?: string }; onClose: () => void; onDone: () => void }) {
  const t = useT('finops');
  const [f, setF] = useState({ article_id: initial.article_id ?? '', type: 'receipt', place_id: '', to_place_id: '', qty: '', cost: '', note: '' });
  const set = (k: string) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const art = articles.find((a) => a.id === f.article_id);
  const active = places.filter((p) => p.active);
  return (
    <Modal
      title={t('Lagerbewegung buchen')}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>{t('Abbrechen')}</button>
          <button
            className="btn"
            onClick={async () => {
              const n = Number(f.qty.replace(',', '.'));
              const ok =
                f.type === 'transfer'
                  ? await act(() => api.post('/api/inventory/transfers', { article_id: f.article_id, from_place_id: f.place_id, to_place_id: f.to_place_id, qty: n, note: f.note }), t('Umgelagert'))
                  : await act(() => api.post('/api/inventory/movements', { article_id: f.article_id, type: f.type, place_id: f.place_id || undefined, qty: f.type === 'issue' ? Math.abs(n) : n, unit_cost_cents: f.type === 'receipt' && f.cost ? parseEuro(f.cost) : undefined, note: f.note }), t('Gebucht'));
              if (ok) onDone();
            }}
          >
            {t('Buchen')}
          </button>
        </>
      }
    >
      <Field label={t('Artikel')}>
        <Select value={f.article_id} onChange={set('article_id')} placeholder={t('Artikel wählen')} options={articles.filter((a) => a.active).map((a) => [a.id, `${artLabel(a)} · ${qty(a.qty)} ${a.unit}`] as [string, string])} />
      </Field>
      <div className="grid2">
        <Field label={t('Art')}>
          <Select value={f.type} onChange={set('type')} options={[['receipt', t('Wareneingang')], ['issue', t('Warenausgang')], ['correction', t('Korrektur (+/−)')], ['transfer', t('Umlagerung')]]} />
        </Field>
        <Field label={`${t('Menge')}${art ? ` (${art.unit})` : ''}`}>
          <Input value={f.qty} onChange={set('qty')} inputMode="decimal" />
        </Field>
      </div>
      <div className="grid2">
        <Field label={f.type === 'transfer' ? t('Von Lagerort') : t('Lagerort')}>
          <Select value={f.place_id} onChange={set('place_id')} placeholder={f.type === 'transfer' ? t('wählen') : t('Standard-Lagerort')} options={active.map((p) => [p.id, p.name] as [string, string])} />
        </Field>
        {f.type === 'transfer' ? (
          <Field label={t('Nach Lagerort')}>
            <Select value={f.to_place_id} onChange={set('to_place_id')} placeholder={t('wählen')} options={active.filter((p) => p.id !== f.place_id).map((p) => [p.id, p.name] as [string, string])} />
          </Field>
        ) : f.type === 'receipt' ? (
          <Field label={t('Einkaufspreis je Einheit (€)')} hint={t('Leer: letzter Preis. Der Durchschnittspreis wird neu berechnet.')}>
            <EuroInput value={f.cost} onChange={set('cost')} />
          </Field>
        ) : (
          <div />
        )}
      </div>
      <Field label={t('Hinweis')}>
        <Input value={f.note} onChange={set('note')} />
      </Field>
    </Modal>
  );
}

// --- purchase orders -----------------------------------------------------------------------------------------------------------

const getOStatus = (t: any): Record<string, [string, 'gray' | 'green' | 'red' | 'blue' | 'yellow']> => ({ draft: [t('Entwurf'), 'gray'], ordered: [t('Bestellt'), 'blue'], partial: [t('Teilweise geliefert'), 'yellow'], received: [t('Geliefert'), 'green'], cancelled: [t('Storniert'), 'red'] });

function Orders({ articles, places, onChange }: { articles: any[]; places: any[]; onChange: () => void }) {
  const t = useT('finops');
  const O_STATUS = getOStatus(t);
  const [filter, setFilter] = useState('open');
  const [edit, setEdit] = useState<any>();
  const [view, setView] = useState<string>();
  const list = useLoad(() => api.get(`/api/inventory/orders?status=${filter === 'all' ? '' : filter}`), [filter]);
  const rows: any[] = list.data ?? [];
  const done = () => (setEdit(undefined), setView(undefined), void list.reload(), onChange());
  return (
    <>
      <div className="row" style={{ alignItems: 'center', marginBottom: 12 }}>
        <button className="btn" data-tour="inv-new-order" onClick={() => setEdit({})}>
          {t('Neue Bestellung')}
        </button>
        <div className="tabs" style={{ margin: 0, border: 0 }}>
          {[['open', t('Offen')], ['received', t('Geliefert')], ['cancelled', t('Storniert')], ['all', t('Alle')]].map(([k, l]) => (
            <button key={k} className={k === filter ? 'on' : ''} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {list.loading && !list.data ? (
        <Spinner />
      ) : rows.length ? (
        <div className="table-wrap" data-tour="inv-orders">
          <table className="t">
            <thead>
              <tr>
                <th>{t('Nummer')}</th>
                <th>{t('Lieferant')}</th>
                <th>Status</th>
                <th className="num">{t('Positionen')}</th>
                <th className="num">{t('Summe')}</th>
                <th>{t('Erwartet')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="click" {...pressable(() => setView(o.id))}>
                  <td className="mono">{o.number}</td>
                  <td>{o.supplier_name || '–'}</td>
                  <td>
                    <Badge tone={O_STATUS[o.status]?.[1]}>{O_STATUS[o.status]?.[0] ?? o.status}</Badge>
                  </td>
                  <td className="num">{o.lines}</td>
                  <td className="num">{money(o.total_cents)}</td>
                  <td>{germanDate(o.expected_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{t('Keine Bestellungen.')}</Empty>
      )}
      {edit && <OrderEditor order={edit.id ? edit : undefined} articles={articles} onClose={() => setEdit(undefined)} onDone={done} />}
      {view && <OrderView id={view} places={places} onClose={() => setView(undefined)} onEdit={(o) => (setView(undefined), setEdit(o))} onDone={done} />}
    </>
  );
}

function OrderEditor({ order, articles, onClose, onDone }: { order?: any; articles: any[]; onClose: () => void; onDone: () => void }) {
  const t = useT('finops');
  const low = useLoad(() => api.get('/api/inventory/low-stock'), []);
  const [f, setF] = useState({ supplier: order?.contact_id ? { id: order.contact_id, name: order.contact_name || order.supplier_name } : null, supplier_name: order?.supplier_name ?? '', expected_at: order?.expected_at ?? '', notes: order?.notes ?? '' });
  const [lines, setLines] = useState<{ article_id: string; qty: string; cost: string }[]>(order ? order.lines.map((l: any) => ({ article_id: l.article_id, qty: String(l.qty), cost: euroText(l.unit_cost_cents) })) : [{ article_id: '', qty: '', cost: '' }]);
  const upd = (i: number, k: string, v: string) => setLines((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const suggest = () => {
    const items = (low.data ?? []).map((a: any) => ({ article_id: a.id, qty: String(a.reorder_qty || a.missing || 1), cost: euroText(articles.find((x) => x.id === a.id)?.last_cost_cents || articles.find((x) => x.id === a.id)?.avg_cost_cents || 0) }));
    if (items.length) setLines(items);
    else toast(t('Nichts unter Mindestbestand'));
  };
  return (
    <Modal
      wide
      title={order ? t('Bestellung {number}', { number: order.number }) : t('Neue Bestellung')}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>{t('Abbrechen')}</button>
          <button
            className="btn"
            onClick={async () => {
              const body = { contact_id: f.supplier?.id ?? null, supplier_name: f.supplier ? f.supplier.name : f.supplier_name, expected_at: f.expected_at || null, notes: f.notes, lines: lines.filter((l) => l.article_id).map((l) => ({ article_id: l.article_id, qty: Number(l.qty.replace(',', '.')), unit_cost_cents: l.cost ? parseEuro(l.cost) : undefined })) };
              if (await act(() => (order ? api.patch(`/api/inventory/orders/${order.id}`, body) : api.post('/api/inventory/orders', body)), t('Gespeichert'))) onDone();
            }}
          >
            {t('Speichern')}
          </button>
        </>
      }
    >
      <div className="grid2">
        <Field label={t('Lieferant (Kontakt)')} hint={t('Mit E-Mail-Adresse kann die Bestellung direkt gesendet werden')}>
          <ContactPick value={f.supplier} onChange={(v) => setF({ ...f, supplier: v })} />
        </Field>
        <Field label={t('oder Lieferant (Name)')}>
          <Input value={f.supplier_name} onChange={(v) => setF({ ...f, supplier_name: v })} disabled={!!f.supplier} />
        </Field>
        <Field label={t('Gewünschter Liefertermin')}>
          <Input type="date" value={f.expected_at} onChange={(v) => setF({ ...f, expected_at: v })} />
        </Field>
        <Field label={t('Hinweise für den Lieferanten')}>
          <Input value={f.notes} onChange={(v) => setF({ ...f, notes: v })} />
        </Field>
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>{t('Artikel')}</th>
              <th style={{ width: 110 }}>{t('Menge')}</th>
              <th style={{ width: 130 }}>{t('Preis je Einheit (€)')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td>
                  <Select value={l.article_id} onChange={(v) => upd(i, 'article_id', v)} placeholder={t('Artikel wählen')} options={articles.filter((a) => a.active).map((a) => [a.id, artLabel(a)] as [string, string])} />
                </td>
                <td>
                  <Input value={l.qty} onChange={(v) => upd(i, 'qty', v)} inputMode="decimal" />
                </td>
                <td>
                  <EuroInput value={l.cost} onChange={(v) => upd(i, 'cost', v)} />
                </td>
                <td>
                  {lines.length > 1 && (
                    <button className="icon-btn" aria-label={t('Zeile entfernen')} onClick={() => setLines((r) => r.filter((_, j) => j !== i))}>
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn small secondary" onClick={() => setLines((r) => [...r, { article_id: '', qty: '', cost: '' }])}>{t('+ Position')}</button>
        <button className="btn small secondary" onClick={suggest} title={t('Alle Artikel unter Mindestbestand mit ihrer Nachbestellmenge')}>
          {t('Vorschlag aus Mindestbestand')}
        </button>
      </div>
    </Modal>
  );
}

function OrderView({ id, places, onClose, onEdit, onDone }: { id: string; places: any[]; onClose: () => void; onEdit: (o: any) => void; onDone: () => void }) {
  const t = useT('finops');
  const O_STATUS = getOStatus(t);
  const r = useLoad(() => api.get(`/api/inventory/orders/${id}`), [id]);
  const o = r.data;
  const [recv, setRecv] = useState<Record<string, string>>({});
  const [place, setPlace] = useState('');
  if (!o) return <Modal title={t('Bestellung')} onClose={onClose}><Spinner /></Modal>;
  const can = ['draft', 'ordered', 'partial'].includes(o.status);
  const act2 = async (fn: () => Promise<unknown>, ok: string) => (await act(fn, ok)) && (void r.reload(), onDone());
  return (
    <Modal
      wide
      title={t('Bestellung {number}', { number: o.number })}
      onClose={onClose}
      footer={
        <>
          {o.status === 'draft' && <button className="btn secondary" onClick={() => onEdit(o)}>{t('Bearbeiten')}</button>}
          {['draft', 'ordered'].includes(o.status) && !o.lines.some((l: any) => l.received > 0) && (
            <button className="btn ghost danger-text" onClick={async () => confirmAsk(t('Bestellung stornieren?')) && (await act2(() => api.post(`/api/inventory/orders/${id}/cancel`, {}), 'Storniert'))}>
              {t('Stornieren')}
            </button>
          )}
          <span style={{ flex: 1 }} />
          {o.status === 'draft' && (
            <>
              <button className="btn secondary" onClick={() => act2(() => api.post(`/api/inventory/orders/${id}/place`, {}), t('Als bestellt markiert'))}>
                {t('Als bestellt markieren')}
              </button>
              <button className="btn" disabled={!o.contact_email} title={o.contact_email ? undefined : t('Der Lieferant braucht einen Kontakt mit E-Mail-Adresse')} onClick={() => act2(() => api.post(`/api/inventory/orders/${id}/send`, {}), t('Gesendet'))}>
                <Icon name="send" /> {t('Per E-Mail senden')}
              </button>
            </>
          )}
          {['ordered', 'partial'].includes(o.status) && (
            <button
              className="btn"
              data-tour="inv-receive"
              onClick={() =>
                act2(
                  () =>
                    api.post(`/api/inventory/orders/${id}/receive`, {
                      lines: o.lines.map((l: any) => ({ line_id: l.id, qty: Number((recv[l.id] ?? String(Math.max(0, l.qty - l.received))).replace(',', '.')), place_id: place || undefined })).filter((l: any) => l.qty > 0),
                    }),
                  t('Wareneingang gebucht'),
                )
              }
            >
              {t('Wareneingang buchen')}
            </button>
          )}
        </>
      }
    >
      <p>
        <Badge tone={O_STATUS[o.status]?.[1]}>{O_STATUS[o.status]?.[0]}</Badge> {o.contact_name || o.supplier_name} {o.contact_email && <span className="muted">· {o.contact_email}</span>}
        {o.expected_at && <span className="muted"> {t('· erwartet')} {germanDate(o.expected_at)}</span>}
      </p>
      {o.notes && <p className="muted">{o.notes}</p>}
      <table className="t">
        <thead>
          <tr>
            <th>{t('Artikel')}</th>
            <th className="num">{t('Bestellt')}</th>
            <th className="num">{t('Geliefert')}</th>
            <th className="num">{t('Preis')}</th>
            {['ordered', 'partial'].includes(o.status) && <th style={{ width: 120 }}>{t('Jetzt geliefert')}</th>}
          </tr>
        </thead>
        <tbody>
          {o.lines.map((l: any) => (
            <tr key={l.id}>
              <td>
                <span className="mono">{l.sku}</span> {l.name}
              </td>
              <td className="num">{qty(l.qty)} {l.unit}</td>
              <td className="num">{qty(l.received)}</td>
              <td className="num">{money(l.unit_cost_cents)}</td>
              {['ordered', 'partial'].includes(o.status) && (
                <td>
                  <Input value={recv[l.id] ?? String(Math.max(0, l.qty - l.received)).replace('.', ',')} onChange={(v) => setRecv((s) => ({ ...s, [l.id]: v }))} inputMode="decimal" />
                </td>
              )}
            </tr>
          ))}
          <tr className="total">
            <td colSpan={3}>
              <strong>{t('Summe')}</strong>
            </td>
            <td className="num">
              <strong>{money(o.total_cents)}</strong>
            </td>
            {['ordered', 'partial'].includes(o.status) && <td />}
          </tr>
        </tbody>
      </table>
      {['ordered', 'partial'].includes(o.status) && (
        <Field label={t('Einlagern in')}>
          <Select value={place} onChange={setPlace} placeholder={t('Standard-Lagerort')} options={places.filter((p) => p.active).map((p) => [p.id, p.name] as [string, string])} />
        </Field>
      )}
      {can && o.status !== 'draft' && <p className="muted small">{t('Der Wareneingang bucht die Menge ins Lager und aktualisiert den Durchschnittspreis.')}</p>}
    </Modal>
  );
}

// --- stock-taking --------------------------------------------------------------------------------------------------------------

function Counts({ places, onChange }: { places: any[]; onChange: () => void }) {
  const t = useT('finops');
  const [open, setOpen] = useState<string>();
  const [create, setCreate] = useState(false);
  const list = useLoad(() => api.get('/api/inventory/counts'), []);
  const rows: any[] = list.data ?? [];
  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <button className="btn" data-tour="inv-new-count" onClick={() => setCreate(true)}>
          {t('Neue Inventur')}
        </button>
      </div>
      <p className="muted small">{t('Beim Start wird der Soll-Bestand eingefroren. Du trägst die gezählten Mengen ein; beim Abschließen werden nur die Differenzen als Korrekturbuchungen verbucht.')}</p>
      {list.loading && !list.data ? (
        <Spinner />
      ) : rows.length ? (
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>{t('Inventur')}</th>
                <th>{t('Lagerort')}</th>
                <th>Status</th>
                <th className="num">{t('Gezählt')}</th>
                <th>{t('Gestartet')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="click" {...pressable(() => setOpen(c.id))}>
                  <td>
                    <strong>{c.name}</strong>
                  </td>
                  <td>{c.place || 'alle'}</td>
                  <td>
                    <Badge tone={c.status === 'open' ? 'blue' : c.status === 'closed' ? 'green' : 'gray'}>{{ open: t('läuft'), closed: t('abgeschlossen'), cancelled: t('verworfen') }[c.status as string] ?? c.status}</Badge>
                  </td>
                  <td className="num">
                    {c.counted} / {c.lines}
                  </td>
                  <td>{d(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{t('Noch keine Inventur.')}</Empty>
      )}
      {create && <CountCreate places={places} onClose={() => setCreate(false)} onDone={(id) => (setCreate(false), void list.reload(), setOpen(id))} />}
      {open && <CountView id={open} onClose={() => (setOpen(undefined), void list.reload(), onChange())} />}
    </>
  );
}

function CountCreate({ places, onClose, onDone }: { places: any[]; onClose: () => void; onDone: (id: string) => void }) {
  const t = useT('finops');
  const [name, setName] = useState(`Inventur ${ymdLocal()}`);
  const [place, setPlace] = useState('');
  return (
    <Modal
      title={t('Neue Inventur')}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>{t('Abbrechen')}</button>
          <button className="btn" onClick={async () => { const c = await act(() => api.post('/api/inventory/counts', { name, place_id: place || undefined })); if (c) onDone(c.id); }}>
            {t('Starten')}
          </button>
        </>
      }
    >
      <Field label={t('Name')}>
        <Input value={name} onChange={setName} />
      </Field>
      <Field label={t('Lagerort')} hint={t('Leer = alle Lagerorte')}>
        <Select value={place} onChange={setPlace} placeholder={t('Alle')} options={places.filter((p) => p.active).map((p) => [p.id, p.name] as [string, string])} />
      </Field>
    </Modal>
  );
}

function CountView({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT('finops');
  const r = useLoad(() => api.get(`/api/inventory/counts/${id}`), [id]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const c = r.data;
  if (!c) return <Modal title={t('Inventur')} onClose={onClose}><Spinner /></Modal>;
  const isOpen = c.status === 'open';
  const payload = () => c.lines.filter((l: any) => vals[l.id] !== undefined).map((l: any) => ({ id: l.id, counted: vals[l.id] === '' ? null : Number(vals[l.id].replace(',', '.')) }));
  const save = async () => {
    const lines = payload();
    if (!lines.length) return true;
    const res = await act(() => api.put(`/api/inventory/counts/${id}/lines`, { lines }));
    if (res) (setVals({}), r.setData(res));
    return !!res;
  };
  return (
    <Modal
      wide
      title={c.name}
      onClose={onClose}
      footer={
        isOpen ? (
          <>
            <button className="btn ghost danger-text" onClick={async () => confirmAsk(t('Inventur verwerfen?')) && (await act(() => api.post(`/api/inventory/counts/${id}/cancel`, {}), t('Verworfen'))) && onClose()}>
              {t('Verwerfen')}
            </button>
            <span style={{ flex: 1 }} />
            <button className="btn secondary" onClick={async () => (await save()) && toast(t('Gespeichert'))}>{t('Zählstand speichern')}</button>
            <button
              className="btn"
              onClick={async () => {
                if (!(await save())) return;
                if (!confirmAsk(t('Inventur abschließen? Die Differenzen werden als Korrekturbuchungen verbucht.'))) return;
                const res = await act(() => api.post(`/api/inventory/counts/${id}/close`, {}));
                if (res) (toast(t('{count} Differenzen gebucht', { count: res.booked })), onClose());
              }}
            >
              {t('Abschließen und Differenzen buchen')}
            </button>
          </>
        ) : (
          <button className="btn secondary" onClick={onClose}>{t('Schließen')}</button>
        )
      }
    >
      <p className="muted">
        {c.place_id ? t('Ein Lagerort') : t('Alle Lagerorte')} · {c.summary.counted} {t('von')} {c.summary.lines} {t('gezählt ·')} {c.summary.differences} {t('Differenzen')}
        {c.summary.differences ? t('(Überschuss {surplus}, Fehlbestand {shortage})', { surplus: money(c.summary.surplus_value_cents), shortage: money(c.summary.shortage_value_cents) }) : ''}
      </p>
      <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
        <table className="t">
          <thead>
            <tr>
              <th>{t('Artikel')}</th>
              <th>{t('Lagerort')}</th>
              <th className="num">{t('Soll')}</th>
              <th style={{ width: 120 }}>{t('Gezählt')}</th>
              <th className="num">{t('Differenz')}</th>
            </tr>
          </thead>
          <tbody>
            {c.lines.map((l: any) => {
              const shown = vals[l.id] ?? (l.counted === null ? '' : String(l.counted).replace('.', ','));
              const diff = shown === '' ? null : Math.round((Number(shown.replace(',', '.')) - l.expected) * 1000) / 1000;
              return (
                <tr key={l.id}>
                  <td>
                    <span className="mono">{l.sku}</span> {l.name}
                  </td>
                  <td>{l.place}</td>
                  <td className="num">{qty(l.expected)} {l.unit}</td>
                  <td>{isOpen ? <Input value={shown} onChange={(v) => setVals((s) => ({ ...s, [l.id]: v }))} inputMode="decimal" /> : shown || '–'}</td>
                  <td className="num">{diff === null ? '' : <span className={diff < 0 ? 'bo-neg' : diff > 0 ? 'bo-ok' : undefined}>{diff > 0 ? '+' : ''}{qty(diff)}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

// --- valuation, places, settings -------------------------------------------------------------------------------------------

function Valuation() {
  const t = useT('finops');
  const [asof, setAsof] = useState('');
  const r = useLoad(() => api.get(`/api/inventory/valuation${asof ? `?asof=${asof}` : ''}`), [asof]);
  const v = r.data;
  return (
    <>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div style={{ width: 170 }}>
          <Field label={t('Stichtag')} hint={t('Leer = heute')}>
            <Input type="date" value={asof} onChange={setAsof} />
          </Field>
        </div>
        <div style={{ marginBottom: 14 }}>
          <a className="btn secondary" data-tour="inv-valuation-csv" href={dlHref('/api/inventory/valuation', { asof, format: 'csv' })}>
            <Icon name="download" /> CSV
          </a>
        </div>
      </div>
      {!v ? (
        <Spinner />
      ) : v.rows.length ? (
        <div className="table-wrap" data-tour="inv-valuation">
          <table className="t">
            <thead>
              <tr>
                <th>{t('Artikel')}</th>
                <th className="num">{t('Bestand')}</th>
                <th className="num">{t('Ø Einkaufspreis')}</th>
                <th className="num">{t('Wert')}</th>
              </tr>
            </thead>
            <tbody>
              {v.rows.map((x: any) => (
                <tr key={x.article_id}>
                  <td>
                    <span className="mono">{x.sku}</span> {x.name}
                  </td>
                  <td className="num">{qty(x.qty)} {x.unit}</td>
                  <td className="num">{money(x.avg_cost_cents)}</td>
                  <td className="num">{money(x.value_cents)}</td>
                </tr>
              ))}
              <tr className="total">
                <td colSpan={3}>
                  <strong>{t('Lagerwert gesamt')}</strong>
                </td>
                <td className="num">
                  <strong>{money(v.total_cents)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{t('Kein Bestand zum Stichtag.')}</Empty>
      )}
      <p className="muted small">{t('Bewertung:')} {v?.method ?? t('gleitender Durchschnittspreis')}{t('. Zum Stichtag wird aus dem Bewegungsprotokoll zurückgerechnet. Das ist eine Hilfe für die Inventur – die Bilanzbewertung legt dein Steuerberater fest.')}</p>
    </>
  );
}

function Places({ places, onChange }: { places: any[]; onChange: () => void }) {
  const t = useT('finops');
  const [edit, setEdit] = useState<any>();
  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <button className="btn" onClick={() => setEdit({})}>
          {t('Lagerort anlegen')}
        </button>
      </div>
      <div className="table-wrap" data-tour="inv-places">
        <table className="t">
          <thead>
            <tr>
              <th>{t('Lagerort')}</th>
              <th>{t('Kürzel')}</th>
              <th className="num">{t('Artikel')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {places.map((p) => (
              <tr key={p.id} style={p.active ? undefined : { opacity: 0.55 }}>
                <td>
                  <strong>{p.name}</strong> {p.is_default ? <Badge tone="blue">{t('Standard')}</Badge> : null}
                </td>
                <td className="mono">{p.code}</td>
                <td className="num">{p.articles}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn small secondary" onClick={() => setEdit(p)}>{t('Umbenennen')}</button>{' '}
                  {!p.is_default && (
                    <button className="btn small secondary" onClick={async () => (await act(() => api.patch(`/api/inventory/places/${p.id}`, { is_default: true }))) && onChange()}>
                      {t('Als Standard')}
                    </button>
                  )}{' '}
                  {!p.is_default && (
                    <button className="btn small ghost" onClick={async () => (await act(() => api.patch(`/api/inventory/places/${p.id}`, { active: !p.active }))) && onChange()}>
                      {p.active ? t('Deaktivieren') : t('Aktivieren')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <PlaceModal place={edit.id ? edit : undefined} onClose={() => setEdit(undefined)} onDone={() => (setEdit(undefined), onChange())} />}
    </>
  );
}

function PlaceModal({ place, onClose, onDone }: { place?: any; onClose: () => void; onDone: () => void }) {
  const t = useT('finops');
  const [name, setName] = useState(place?.name ?? '');
  const [code, setCode] = useState(place?.code ?? '');
  return (
    <Modal
      title={place ? t('Lagerort umbenennen') : t('Lagerort anlegen')}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>{t('Abbrechen')}</button>
          <button className="btn" onClick={async () => (await act(() => (place ? api.patch(`/api/inventory/places/${place.id}`, { name, code }) : api.post('/api/inventory/places', { name, code })), t('Gespeichert'))) && onDone()}>
            {t('Speichern')}
          </button>
        </>
      }
    >
      <div className="grid2">
        <Field label={t('Name')}>
          <Input value={name} onChange={setName} placeholder={t('z. B. Regal A, Transporter')} />
        </Field>
        <Field label={t('Kürzel')}>
          <Input value={code} onChange={setCode} />
        </Field>
      </div>
    </Modal>
  );
}

function InvSettings() {
  const t = useT('finops');
  const s = useLoad(() => api.get('/api/inventory/settings'), []);
  const [f, setF] = useState<any>();
  useEffect(() => {
    if (s.data && !f) setF(s.data);
  }, [s.data]);
  if (!f) return <Spinner />;
  return (
    <div className="card" style={{ maxWidth: 680 }} data-tour="inv-settings">
      <h2>{t('Automatischer Warenausgang')}</h2>
      <p className="muted small">
        {t('Wenn eine Rechnung bezahlt (oder versendet) wird, bucht HyperLevel die Positionen aus dem Lager aus. Eine Position wird einem Artikel zugeordnet über die Artikelnummer im Text (z. B. „[KAFFEE-500]“), das verknüpfte Produkt oder den Artikelnamen. Bei Zweifeln wird nichts geraten – die Position bleibt unberührt. Jede Rechnung wird nur einmal ausgebucht.')}
      </p>
      <Field label={t('Ausbuchen, wenn die Rechnung …')}>
        <Select value={f.auto_issue_on} onChange={(v) => setF({ ...f, auto_issue_on: v })} options={[['paid', t('bezahlt ist')], ['sent', t('versendet wird')], ['off', t('nie (nur von Hand)')]]} />
      </Field>
      <Check checked={f.allow_negative} onChange={(v) => setF({ ...f, allow_negative: v })} label={t('Negativen Bestand erlauben (sonst wird ein zu großer Warenausgang abgelehnt)')} />
      <div style={{ marginTop: 12 }}>
        <button className="btn" onClick={async () => (await act(() => api.put('/api/inventory/settings', f), t('Gespeichert'))) && void s.reload()}>
          {t('Speichern')}
        </button>
      </div>
    </div>
  );
}
