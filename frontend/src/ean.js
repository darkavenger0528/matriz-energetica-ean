import { get, url } from './api.js';
import { buildingSvg } from './buildings.js';
import { card, chips, destroyCharts, fmt, initSeg, MONTHS, segment, toggle } from './ui.js';

const COLORS = { total: '#005e85', legacy: '#533278', nogal: '#3bac52', sol: '#3bac52' };
const TABS = [{ value: 'consumo', label: 'Carga de la universidad' }, { value: 'generacion', label: 'Generación solar' }, { value: 'cargas', label: 'Cargas atendidas' }];
const EDIF = [{ value: 'todos', label: 'Total', sub: 'Legacy + Nogal' }, { value: 'legacy', label: 'Legacy', sub: 'Edificio grande' }, { value: 'nogal', label: 'Nogal', sub: 'Edificio pequeño' }, { value: 'comparar', label: 'Comparar', sub: 'Lado a lado' }];
const S = { tab: 'consumo', edificio: 'todos', meses: [], tipo: 'barras' };
let rows = [], root;

const tiles = () => `<div class="tiles">${EDIF.map((e) => `<button type="button" class="tile ${S.edificio === e.value ? 'on' : ''}" data-chip="edificio" data-v="${e.value}">
  ${buildingSvg(e.value === 'todos' ? 'total' : e.value === 'comparar' ? 'compare' : e.value)}<span>${e.label}</span><small>${e.sub}</small></button>`).join('')}</div>`;

export async function mount(el) {
  root = el;
  rows = (await get('/ean/mensual')).items;
  root.onclick = (e) => {
    const c = e.target.closest('[data-chip]');
    if (!c) return;
    const k = c.dataset.chip, v = c.dataset.v;
    if (k === 'meses') S.meses = toggle(S.meses, +v, 0).sort((a, b) => a - b);
    else if (k === 'tab') { S.tab = v; if (v === 'cargas' && ['barras', 'lineas'].includes(S.tipo)) S.tipo = 'anillo'; if (v !== 'cargas' && ['pastel', 'anillo'].includes(S.tipo)) S.tipo = 'barras'; }
    else S[k] = v;
    draw();
  };
  draw();
}
export const redraw = () => root && draw();

const sel = (m, b) => rows.filter((r) => (b ? r.edificio === b : true) && r.mes === m);
const sum = (arr, f) => arr.reduce((s, r) => s + r[f], 0);

async function draw() {
  const compare = S.edificio === 'comparar';
  const edif = compare ? 'todos' : S.edificio;
  const edifLbl = { todos: 'Total (Legacy + Nogal)', legacy: 'Legacy', nogal: 'Nogal', comparar: 'Legacy vs. Nogal' }[S.edificio];
  const field = S.tab === 'generacion' ? 'generacion_kwh' : 'consumo_kwh';
  const months = S.meses.length ? S.meses : MONTHS.map((_, i) => i + 1);
  const scope = rows.filter((r) => months.includes(r.mes) && (edif === 'todos' || r.edificio === edif));
  const pct = (sum(scope, 'generacion_kwh') / sum(scope, 'consumo_kwh') * 100).toFixed(1);
  const csv = url('/ean/export.csv', { edificio: edif, meses: S.meses });
  const tipos = S.tab === 'cargas' ? [{ value: 'anillo', label: 'Anillo' }, { value: 'pastel', label: 'Pastel' }, { value: 'tabla', label: 'Tabla' }]
    : [{ value: 'barras', label: 'Barras' }, { value: 'lineas', label: 'Líneas' }, { value: 'tabla', label: 'Tabla' }];
  const mesesTxt = S.meses.length ? S.meses.map((m) => MONTHS[m - 1]).join(', ') : 'todo el año';

  root.innerHTML = `
    <div class="panel glass">
      <div class="row"><strong>Edificio</strong><span>Solar sobre consumo (${S.meses.length ? 'meses elegidos' : 'promedio anual'}): <b style="color:var(--accent-ink);font-weight:800">${pct}%</b></span></div>
      ${tiles()}
      <div class="row" style="margin-top:18px"><strong>Meses</strong><span>${S.meses.length ? '' : 'Todos'}</span></div>
      ${chips('meses', MONTHS.map((m, i) => ({ value: i + 1, label: m })), S.meses)}
    </div>
    <div class="toolbar">${segment('tab', TABS, S.tab)}${segment('tipo', tipos, S.tipo)}</div>
    <div class="chart-grid" id="grid"></div>`;
  const grid = document.getElementById('grid');
  destroyCharts();
  const kind = { barras: 'bar', lineas: 'line', tabla: 'tabla', pastel: 'pie', anillo: 'doughnut' }[S.tipo];
  const subtitle = `${edifLbl} · ${mesesTxt} · 2025`;

  if (S.tab === 'cargas') {
    const c = (await get('/ean/cargas', { edificio: edif })).items;
    const pal = ['#dfdf3f', '#533278', '#00c0b3', '#005e85', '#009579'];
    card(grid, { title: `Cargas atendidas por los paneles · ${edifLbl}`, kind, labels: c.map((x) => x.carga), unit: '%', wide: true, filename: `ean_cargas_${edif}`, subtitle,
      datasets: [{ label: '%', data: c.map((x) => x.pct), colors: pal }] });
    initSeg(root);
    return;
  }

  const dim = (hex) => MONTHS.map((_, i) => (S.meses.length && !S.meses.includes(i + 1) ? hex + '44' : hex));
  const serie = (label, b, f, color) => ({ label, color, colors: dim(color), data: MONTHS.map((_, i) => sum(sel(i + 1, b), f)) });
  let datasets;
  if (compare) datasets = ['legacy', 'nogal'].map((b) => serie(b === 'legacy' ? 'Legacy' : 'Nogal', b, field, COLORS[b]));
  else {
    const b = edif === 'todos' ? null : edif;
    datasets = S.tab === 'generacion'
      ? [serie('Consumo', b, 'consumo_kwh', COLORS.total), serie('Generación solar', b, 'generacion_kwh', COLORS.sol)]
      : [serie('Consumo', b, 'consumo_kwh', COLORS[b || 'total'])];
  }
  if (kind === 'bar' && datasets.length > 1) datasets.forEach((d) => (d.colors = undefined));
  const title = S.tab === 'generacion' ? 'Consumo vs. generación solar' : 'Consumo mensual';
  if (S.meses.length) grid.insertAdjacentHTML('beforebegin', `<div class="meta">${S.meses.map((m) => `<span>${MONTHS[m - 1]}: <b>${fmt(sum(sel(m, edif === 'todos' ? null : edif), field))} kWh</b></span>`).join('')}</div>`);
  card(grid, { title, kind, labels: MONTHS, datasets, unit: 'kWh', csv, wide: true, filename: `ean_${S.tab}_${S.edificio}`, subtitle, xTitle: 'Mes (2025)', yTitle: 'Energía (kWh)' });
  initSeg(root);
}
