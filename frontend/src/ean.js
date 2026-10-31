import { get, url } from './api.js';
import { buildingSvg } from './buildings.js';
import { card, chips, dataTable, destroyCharts, fmt, initSeg, kpis, MONTHS, segment, toggle } from './ui.js';

const COLORS = { total: '#005e85', legacy: '#533278', nogal: '#3bac52', sol: '#3bac52', warn: '#dfdf3f' };
const TABS = [{ value: 'consumo', label: 'Consumo' }, { value: 'generacion', label: 'Generación solar' }, { value: 'cargas', label: 'Cargas atendidas' },
  { value: 'costos', label: 'Costos y ahorro' }, { value: 'huella', label: 'Huella de carbono' }];
const EDIF = [{ value: 'todos', label: 'Total' }, { value: 'legacy', label: 'Legacy' }, { value: 'nogal', label: 'Nogal' }, { value: 'comparar', label: 'Comparar' }];
const NAMES = { legacy: 'Legacy', nogal: 'Nogal' };
const S = { tab: 'consumo', edificio: 'todos', meses: [], tarifa: null, factor: null };
let rows = [], root, meta;

const tiles = () => `<div class="tiles">${EDIF.map((e) => `<button type="button" class="tile ${S.edificio === e.value ? 'on' : ''}" data-chip="edificio" data-v="${e.value}">
  ${buildingSvg(e.value === 'todos' ? 'total' : e.value === 'comparar' ? 'compare' : e.value)}<span>${e.label}</span></button>`).join('')}</div>`;

export async function mount(el) {
  root = el;
  [meta, rows] = await Promise.all([get('/meta'), get('/ean/mensual').then((r) => r.items)]);
  S.tarifa ??= meta.economia.tarifa_cop_kwh; S.factor ??= meta.economia.factor_emision_kg_kwh;
  root.onclick = (e) => {
    const c = e.target.closest('[data-chip]');
    if (e.target.closest('[data-clear]')) { S.edificio = 'todos'; S.meses = []; draw(); return; }
    if (!c) return;
    const k = c.dataset.chip, v = c.dataset.v;
    if (k === 'meses') S.meses = toggle(S.meses, +v, 0).sort((a, b) => a - b);
    else S[k] = v;
    draw();
  };
  root.onchange = (e) => { const p = e.target.dataset.p; if (p) { const v = parseFloat(e.target.value); S[p] = v > 0 ? v : meta.economia[p === 'tarifa' ? 'tarifa_cop_kwh' : 'factor_emision_kg_kwh']; draw(); } };
  draw();
}
export const redraw = () => root && draw();

const sum = (arr, f) => arr.reduce((s, r) => s + r[f], 0);
const f1 = (v) => v.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const cop = (v) => '$ ' + Math.round(v).toLocaleString('es-CO');
const mCop = (v) => f1(v / 1e6);

async function draw() {
  const compare = S.edificio === 'comparar', edif = compare ? 'todos' : S.edificio;
  const edifLbl = { todos: 'Total (Legacy + Nogal)', legacy: 'Legacy', nogal: 'Nogal', comparar: 'Legacy vs. Nogal' }[S.edificio];
  const months = S.meses.length ? S.meses : MONTHS.map((_, i) => i + 1);
  const sel = (m, b) => rows.filter((r) => (b ? r.edificio === b : true) && r.mes === m);
  const agg = (b) => { const rs = rows.filter((r) => months.includes(r.mes) && (!b || r.edificio === b)); return { c: sum(rs, 'consumo_kwh'), g: sum(rs, 'generacion_kwh') }; };
  const cur = agg(edif === 'todos' ? null : edif);
  const T = S.tarifa, FE = S.factor;
  const mesesTxt = S.meses.length ? S.meses.map((m) => MONTHS[m - 1]).join(', ') : 'todo el año';
  const subtitle = `${edifLbl} · ${mesesTxt} · 2025`;
  const csv = url('/ean/export.csv', { edificio: edif, meses: S.meses, tarifa: T, factor: FE });
  const dim = (hex) => MONTHS.map((_, i) => (S.meses.length && !S.meses.includes(i + 1) ? hex + '44' : hex));
  // Serie mensual: fn(consumo, generación) → valor
  const mk = (label, b, fn, color) => ({ label, color, colors: dim(color), data: MONTHS.map((_, i) => { const r = sel(i + 1, b); return fn(sum(r, 'consumo_kwh'), sum(r, 'generacion_kwh')); }) });
  const bSel = edif === 'todos' ? null : edif;
  const perBuilding = (fn) => ['legacy', 'nogal'].map((b) => mk(NAMES[b], b, fn, COLORS[b]));
  const triple = (fn) => [['Legacy', 'legacy'], ['Nogal', 'nogal'], ['Total', null]].map(([l, b]) => { const a = agg(b); return [l, ...fn(a)]; });

  root.innerHTML = `
    <div class="panel glass">
      <div class="row"><strong>Edificio</strong><span>Solar sobre consumo (${S.meses.length ? 'meses elegidos' : 'promedio anual'}): <b style="color:var(--accent-ink);font-weight:800">${f1(cur.g / cur.c * 100)} %</b></span></div>
      ${tiles()}
      <div class="row" style="margin-top:18px"><strong>Meses</strong><span>${S.meses.length ? '' : 'Todos'}<button type="button" class="btn" data-clear style="margin-left:12px" ${S.edificio !== 'todos' || S.meses.length ? '' : 'disabled'}>Borrar filtros</button></span></div>
      ${chips('meses', MONTHS.map((m, i) => ({ value: i + 1, label: m })), S.meses)}
    </div>
    <div class="toolbar">${segment('tab', TABS, S.tab)}</div>
    <div id="top"></div><div class="chart-grid" id="grid"></div>`;
  const grid = document.getElementById('grid'), top = document.getElementById('top');
  destroyCharts();
  const param = (id, label, val, step, hint) => `<div class="panel glass param"><label for="${id}">${label}</label><input id="${id}" type="number" min="0" step="${step}" value="${val}" data-p="${id}"><small class="note">${hint}</small></div>`;

  if (S.tab === 'cargas') {
    const c = (await get('/ean/cargas', { edificio: edif })).items;
    card(grid, { title: `Cargas atendidas por los paneles · ${edifLbl}`, kind: 'doughnut', labels: c.map((x) => x.carga), unit: '%', dec: 1, wide: true, filename: `ean_cargas_${edif}`, subtitle,
      datasets: [{ label: '%', data: c.map((x) => x.pct), colors: ['#dfdf3f', '#533278', '#00c0b3', '#005e85', '#009579'] }] });
  } else if (S.tab === 'consumo' || S.tab === 'generacion') {
    const gen = S.tab === 'generacion';
    const ds = compare ? perBuilding((c, g) => (gen ? g : c))
      : gen ? [mk('Consumo', bSel, (c) => c, COLORS.total), mk('Generación solar', bSel, (c, g) => g, COLORS.sol)] : [mk('Consumo', bSel, (c) => c, COLORS[bSel || 'total'])];
    if (!(gen && !compare)) ds.forEach((d) => { if (ds.length > 1) d.colors = undefined; });
    else ds.forEach((d) => (d.colors = undefined));
    top.innerHTML = kpis(gen ? [['Generación solar', fmt(cur.g), 'kWh', COLORS.sol], ['Consumo', fmt(cur.c), 'kWh', COLORS.total], ['Cobertura solar', f1(cur.g / cur.c * 100) + ' %', 'del consumo', '#00c0b3']]
      : [['Consumo', fmt(cur.c), 'kWh', COLORS.total], ['Promedio mensual', fmt(cur.c / months.length), 'kWh', '#00c0b3']]);
    card(grid, { title: gen ? (compare ? 'Generación solar por edificio' : 'Consumo y generación solar') : (compare ? 'Consumo por edificio' : 'Consumo mensual de energía'),
      kind: gen && !compare ? 'line' : 'bar', labels: MONTHS, datasets: ds, unit: 'kWh', csv, wide: true, totals: true, filename: `ean_${S.tab}_${S.edificio}`, subtitle, xTitle: 'Mes (2025)', yTitle: 'Energía (kWh)' });
  } else if (S.tab === 'costos') {
    top.innerHTML = param('tarifa', 'Tarifa de energía (COP por kWh)', T, 10, 'Valor de ejemplo: reemplázalo por la tarifa de las facturas de la universidad.') +
      kpis([['Costo sin energía solar', '$ ' + mCop(cur.c * T) + ' M', 'COP en el periodo', COLORS.total], ['Costo con energía solar', '$ ' + mCop((cur.c - cur.g) * T) + ' M', 'COP en el periodo', '#00c0b3'],
        ['Ahorro', '$ ' + mCop(cur.g * T) + ' M', 'COP en el periodo', 'var(--accent)'], ['Ahorro sobre el costo', f1(cur.g / cur.c * 100) + ' %', 'del gasto en energía', '#dfdf3f']]);
    const ds = compare ? perBuilding((c, g) => (g * T) / 1e6) : [mk('Costo sin energía solar', bSel, (c) => (c * T) / 1e6, COLORS.total), mk('Costo con energía solar', bSel, (c, g) => ((c - g) * T) / 1e6, '#00c0b3')];
    ds.forEach((d) => (d.colors = undefined));
    card(grid, { title: compare ? 'Ahorro mensual por edificio' : 'Costo mensual de energía con y sin sistema solar', kind: 'bar', labels: MONTHS, datasets: ds, unit: 'M COP', dec: 1, csv, wide: true, totals: true, filename: `ean_costos_${S.edificio}`, subtitle, xTitle: 'Mes (2025)', yTitle: 'Millones de pesos (COP)' });
    dataTable(grid, { title: `Resumen económico por edificio · ${mesesTxt}`, filename: 'ean_resumen_costos', csv,
      cols: ['Edificio', 'Consumo (kWh)', 'Generación solar (kWh)', 'Costo sin solar (COP)', 'Costo con solar (COP)', 'Ahorro (COP)', 'Ahorro (%)'],
      rows: triple((a) => [fmt(a.c), fmt(a.g), cop(a.c * T), cop((a.c - a.g) * T), cop(a.g * T), f1(a.g / a.c * 100)]),
      note: 'Ahorro = generación solar (kWh) × tarifa (COP/kWh). Costo con solar = (consumo − generación) × tarifa. No incluye inversión, mantenimiento ni excedentes vendidos a la red.' });
  } else {
    const ev = (g) => (g * FE) / 1000; // tCO2e
    top.innerHTML = param('factor', 'Factor de emisión de la red (kgCO₂e por kWh)', FE, 0.001, `Referencia: ${meta.economia.factor_emision_kg_kwh.toLocaleString('es-CO')} kgCO₂e/kWh. Fuente: ${meta.economia.fuente_factor}; la UPME lo actualiza cada año.`) +
      kpis([['Emisiones evitadas', f1(ev(cur.g)), 'tCO₂e en el periodo', 'var(--accent)'], ['Emisiones sin energía solar', f1((cur.c * FE) / 1000), 'tCO₂e por el consumo', COLORS.total],
        ['Emisiones con energía solar', f1(((cur.c - cur.g) * FE) / 1000), 'tCO₂e restantes', '#00c0b3'], ['Reducción', f1(cur.g / cur.c * 100) + ' %', 'de la huella eléctrica', '#dfdf3f']]);
    const ds = compare ? perBuilding((c, g) => ev(g)) : [mk('Emisiones evitadas', bSel, (c, g) => ev(g), COLORS[bSel || 'sol'])];
    if (ds.length > 1) ds.forEach((d) => (d.colors = undefined));
    card(grid, { title: compare ? 'Emisiones evitadas por edificio' : 'Emisiones de CO₂ evitadas por mes', kind: 'bar', labels: MONTHS, datasets: ds, unit: 'tCO₂e', dec: 1, csv, wide: true, totals: true, filename: `ean_huella_${S.edificio}`, subtitle, xTitle: 'Mes (2025)', yTitle: 'Toneladas de CO₂ equivalente evitadas' });
    dataTable(grid, { title: `Huella de carbono por edificio · ${mesesTxt}`, filename: 'ean_huella_carbono', csv,
      cols: ['Edificio', 'Consumo (kWh)', 'Generación solar (kWh)', 'Emisiones sin solar (tCO₂e)', 'Emisiones con solar (tCO₂e)', 'Emisiones evitadas (tCO₂e)', 'Reducción (%)'],
      rows: triple((a) => [fmt(a.c), fmt(a.g), f1((a.c * FE) / 1000), f1(((a.c - a.g) * FE) / 1000), f1(ev(a.g)), f1(a.g / a.c * 100)]),
      note: 'Emisiones evitadas = generación solar (kWh) × factor de emisión de la red (kgCO₂e/kWh) ÷ 1000. Es una estimación de alcance 2 (electricidad comprada a la red).' });
  }
  initSeg(root);
}
