import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Minus, LocateFixed, ChevronRight, ArrowLeft, ArrowRight, ArrowUp, ArrowDown } from 'lucide-react';
import useStockFilters from '../navigation/useStockFilters.js';
import { selectKits, summarize } from '../domain/stock.js';
import { STOCK_LEVELS } from '../domain/director-views.js';
import { REGION_NAMES, REGION_ZONES, ZONE_COLORS, geometryPath, geometryPoints, fitMap, mapStock, rowPoints } from '../domain/stock-map.js';
import boundaries from '../data/cameroon-regions.json';
import ProductMixDialog from '../components/ProductMixDialog.jsx';

const features = boundaries.features.map(f => ({ ...f, name: REGION_NAMES[f.properties.shapeName] || f.properties.shapeName }));
const nationalView = fitMap(features.flatMap(f => geometryPoints(f.geometry)));
const activate = action => e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); action(); } };

export default function StockMap({ role }) {
  const [filters] = useStockFilters(), { search } = useLocation();
  const selected = useMemo(() => selectKits(role, filters), [role, filters]);
  return <MapContent key={role + search} selected={selected} />;
}
function MapContent({ selected }) {
  const [level, setLevel] = useState(0), [trail, setTrail] = useState([]), [manualView, setManualView] = useState(null), [mix, setMix] = useState(null);
  const [field, label] = STOCK_LEVELS[level];
  const data = useMemo(() => mapStock(selected, field, trail, features), [selected, field, trail]);
  const totals = summarize(data.scoped), focus = trail.at(-1);
  const currentRegions = new Set(data.scoped.map(k => k.region));
  const autoView = useMemo(() => {
    if (focus) {
      const points = rowPoints({ id: focus.value, kits: data.scoped }, focus.field, features);
      if (points.length) return fitMap(points);
    }
    if (currentRegions.size && currentRegions.size < 8) return fitMap(features.filter(f => currentRegions.has(f.name)).flatMap(f => geometryPoints(f.geometry)));
    return nationalView;
  }, [data.scoped, focus]);
  const view = manualView || autoView;
  function choose(row, chosenField = field, chosenLevel = level) {
    setTrail([...trail.filter(t => t.level < chosenLevel), { field: chosenField, value: row.id, label: row.name, level: chosenLevel }]);
    setLevel(chosenLevel); setManualView(null); setMix(null);
  }
  function chooseRegion(name) {
    setTrail([{ field: 'region', value: name, label: name, level: 1 }]); setLevel(1); setManualView(null); setMix(null);
  }
  function explore(row) {
    choose(row);
    setLevel(Math.min(level + 1, STOCK_LEVELS.length - 1));
  }
  function reset() { setTrail([]); setLevel(0); setManualView(null); setMix(null); }
  function zoom(factor) {
    const height = Math.min(nationalView[3] * 2, Math.max(12, view[3] * factor)), width = height * 4 / 3;
    setManualView([view[0] + (view[2] - width) / 2, view[1] + (view[3] - height) / 2, width, height]);
  }
  function pan(dx, dy) { setManualView([view[0] + dx * view[2], view[1] + dy * view[3], view[2], view[3]]); }
  return <div className="stock-map-page commercial-content">
    <div className="commercial-metrics"><article><span>Stock dans la sélection</span><strong>{totals.active.toLocaleString('fr-FR')}</strong><small>Kits actifs, tous états techniques</small></article><article><span>Disponible</span><strong>{totals.available.toLocaleString('fr-FR')}</strong><small>Bon état, non réservé, non manquant</small></article><article><span>Bloqué qualité</span><strong>{totals.defective + totals.repair + totals.quarantine}</strong><small>Défauts, réparation et quarantaine</small></article><article><span>Lieux au niveau choisi</span><strong>{data.rows.length}</strong><small>{label} · selon les filtres globaux</small></article></div>
    <section className="panel map-panel">
      <div className="commercial-heading"><div><h2>Le stock sur la carte du Cameroun</h2><p className="commercial-caption">Choisissez un lieu pour zoomer. Cliquez sur son compteur pour consulter le mix produit.</p></div><button className="secondary-button" onClick={reset}><LocateFixed size={16} /> Vue nationale</button></div>
      <nav className="stock-breadcrumbs" aria-label="Parcours cartographique"><button onClick={reset}>Cameroun</button>{trail.map((t, i) => <span key={t.field}><ChevronRight size={14} /><button onClick={() => { setTrail(trail.slice(0, i + 1)); setLevel(t.level); setManualView(null); }}>{t.label}</button></span>)}</nav>
      <div className="commercial-toolbar">
        <label className="commercial-control">Niveau<select aria-label="Niveau cartographique" value={level} onChange={e => { const next = Number(e.target.value); setLevel(next); setTrail(trail.filter(t => t.level < next)); setManualView(null); }}>{STOCK_LEVELS.map(([, name], i) => <option key={name} value={i}>{name}</option>)}</select></label>
        <label className="commercial-control">Zoomer sur<select aria-label="Choisir un lieu sur la carte" value={focus?.field === field ? focus.value || '__unassigned' : ''} onChange={e => { const row = data.rows.find(r => (r.id || '__unassigned') === e.target.value); if (row) choose(row); }}><option value="">Choisir un lieu…</option>{data.rows.map(r => <option key={r.id} value={r.id || '__unassigned'}>{r.name} · {r.active} kits</option>)}</select></label>
      </div>
      <div className="map-layout">
        <div>
          <div className="cameroon-map" aria-label="Carte interactive du stock">
            <svg viewBox={view.join(' ')} role="group" aria-label="Régions du Cameroun">
              <rect x={view[0]} y={view[1]} width={view[2]} height={view[3]} fill="#f0f5fa" />
              {features.map(f => <path key={f.name} d={geometryPath(f.geometry)} fill={ZONE_COLORS[REGION_ZONES[f.name]] || '#cad4df'} fillOpacity={currentRegions.has(f.name) ? .55 : .15} stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" tabIndex={0} role="button" aria-label={`Zoomer sur ${f.name}`} onClick={() => chooseRegion(f.name)} onKeyDown={activate(() => chooseRegion(f.name))}><title>{f.name + (currentRegions.has(f.name) ? '' : ' · aucun stock dans la sélection')}</title></path>)}
            </svg>
            {data.markers.map(marker => {
              const left = (marker.point[0] - view[0]) / view[2] * 100, top = (marker.point[1] - view[1]) / view[3] * 100;
              if (left < 2 || left > 98 || top < 3 || top > 97) return null;
              const name = marker.rows.map(r => r.name).join(' · ');
              return <button className="map-marker" key={marker.key} style={{ left: left + '%', top: top + '%' }} title={name} aria-label={`${name}, ${marker.active} kits, mix produit`} onClick={() => setMix({ name, kits: marker.kits })}><strong>{marker.active}</strong><span>{marker.rows.length > 1 ? marker.rows.length + ' lieux' : marker.rows[0].name}</span></button>;
            })}
            <div className="map-controls" aria-label="Commandes de la carte"><button className="icon-button" aria-label="Zoom avant" onClick={() => zoom(.65)}><Plus size={17} /></button><button className="icon-button" aria-label="Zoom arrière" onClick={() => zoom(1.5)}><Minus size={17} /></button><button className="icon-button" aria-label="Recentrer la sélection" onClick={() => setManualView(null)}><LocateFixed size={17} /></button><button className="icon-button" aria-label="Déplacer vers l’ouest" onClick={() => pan(-.2, 0)}><ArrowLeft size={17} /></button><button className="icon-button" aria-label="Déplacer vers l’est" onClick={() => pan(.2, 0)}><ArrowRight size={17} /></button><button className="icon-button" aria-label="Déplacer vers le nord" onClick={() => pan(0, -.2)}><ArrowUp size={17} /></button><button className="icon-button" aria-label="Déplacer vers le sud" onClick={() => pan(0, .2)}><ArrowDown size={17} /></button></div>
          </div>
          <div className="map-legend">{Object.entries(ZONE_COLORS).map(([zone, color]) => <span key={zone}><i style={{ background: color }} />{zone}</span>)}<span><i style={{ background: '#cad4df' }} />Hors réseau de démonstration</span></div>
          <p className="commercial-caption">Repères de villes approximatifs. Boutiques et agents positionnés au centre de leur ville, sans GPS individuel. Les points superposés sont regroupés ; sélectionnez un lieu pour l’isoler. L’entrepôt central est compté séparément du terrain. Les couleurs représentent les zones commerciales fictives.</p>
          <p className="map-attribution">Fond : <a href="https://www.geoboundaries.org/api/current/gbOpen/CMR/ADM1/" target="_blank" rel="noreferrer">geoBoundaries / Wikimedia</a> · limites régionales 2016 · CC BY 3.0. Fond embarqué, sans tuiles externes.</p>
        </div>
        <aside className="map-places" aria-label="Lieux et quantités">
          <h3>{focus?.label || 'Lieux dans le périmètre'}</h3>
          {focus && <button className="map-total" onClick={() => setMix({ name: focus.label, kits: data.scoped })}>{totals.active} kits · voir le mix produit</button>}
          {!data.rows.length && <p className="table-empty">Aucun stock actif dans cette sélection.</p>}
          {data.rows.map(row => <article key={row.id} className="map-place"><button className="map-place-name" onClick={() => choose(row)}>{row.name}<small>Zoomer sur ce lieu</small></button><button className="map-count" aria-label={`Mix produit de ${row.name}, ${row.active} kits`} onClick={() => setMix({ name: row.name, kits: row.kits })}>{row.active} kits</button>{row.id && !row.central && level < STOCK_LEVELS.length - 1 && <button className="link-button map-explore" onClick={() => explore(row)}>Explorer · {STOCK_LEVELS[level + 1][1]}<ChevronRight size={14} /></button>}</article>)}
          {!!data.unlocated.length && <p className="notice">{data.unlocated.reduce((n, r) => n + r.active, 0)} kits sans repère cartographique. Ils restent inclus dans les quantités et dans les listes ci-dessus.</p>}
        </aside>
      </div>
    </section>
    {mix && <ProductMixDialog name={mix.name} kits={mix.kits} onClose={() => setMix(null)} />}
  </div>;
}