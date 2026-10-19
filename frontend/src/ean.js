import { get, url } from './api.js';
import { card, chips, destroyCharts, fmt, MONTHS, toggle } from './ui.js';

const COLORS = { total: '#005e85', legacy: '#533278', nogal: '#00c0b3', gen: '#dfdf3f', sol: '#3bac52' };
const TABS = [{ value: 'consumo', label: 'Carga de la universidad' }, { value: 'generacion', label: 'Generación solar' }, { value: 'cargas', label: 'Cargas atendidas por los paneles' }];
const EDIF = [{ value: 'todos', label: 'Total' }, { value: 'legacy', label: 'Legacy' }, { value: 'nogal', label: 'Nogal' }, { value: 'comparar', label: 'Comparar edificios' }];
const S = { tab: 'consumo', edificio: 'todos', meses: [], tipo: 'barras' };
let rows = [], root;

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
  const field = S.tab === 'generacion' ? 'generacion_kwh' : 'consumo_kwh';
  const months = S.meses.length ? S.meses : MONTHS.map((_, i) => i + 1);
  const pct = (sum(rows.filter((r) => months.includes(r.mes) && (edif === 'todos' || r.edificio === edif)), 'generacion_kwh') /
    sum(rows.filter((r) => months.includes(r.mes) && (edif === 'todos' || r.edificio === edif)), 'consumo_kwh') * 100).toFixed(1);
  const csv = url('/ean/export.csv', { edificio: edif, meses: S.meses });
  const tipos = S.tab === 'cargas' ? [{ value: 'anillo', label: 'Anillo' }, { value: 'pastel', label: 'Pastel' }, { value: 'tabla', label: 'Tabla' }]
    : [{ value: 'barras', label: 'Barras' }, { value: 'lineas', label: 'Líneas' }, { value: 'tabla', label: 'Tabla' }];

  root.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="meta" style="margin-bottom:8px"><b>Edificio</b><span>Solar sobre consumo ${S.meses.length ? '(meses elegidos)' : '(promedio anual)'}: <b style="color:var(--accent)">${pct}%</b></span></div>
      ${chips('edificio', EDIF, [S.edificio])}
      <div class="meta" style="margin:14px 0 8px"><b>Meses</b><span>${S.meses.length ? '' : 'todos'}</span></div>
      ${chips('meses', MONTHS.map((m, i) => ({ value: i + 1, label: m })), S.meses)}
    </div>
    <div class="chips" style="margin-bottom:12px">${chips('tab', TABS, [S.tab])}<span style="flex:1"></span>${chips('tipo', tipos, [S.tipo])}</div>
    <div class="chart-grid" id="grid"></div>`;
  const grid = document.getElementById('grid');
  destroyCharts();
  const kind = { barras: 'bar', lineas: 'line', tabla: 'tabla', pastel: 'pie', anillo: 'doughnut' }[S.tipo];

  if (S.tab === 'cargas') {
    const c = (await get('/ean/cargas', { edificio: edif })).items;
    const pal = ['#dfdf3f', '#533278', '#00c0b3', '#005e85', '#009579'];
    card(grid, { title: `Cargas atendidas · ${EDIF.find((e) => e.value === edif).label}`, kind, labels: c.map((x) => x.carga), unit: '%', wide: true, filename: `ean_cargas_${edif}`,
      datasets: [{ label: '%', data: c.map((x) => x.pct), colors: pal }] });
    return;
  }

  const dim = (hex) => MONTHS.map((_, i) => (S.meses.length && !S.meses.includes(i + 1) ? hex + '44' : hex));
  const serie = (label, b, field, color) => ({ label, color, colors: dim(color), data: MONTHS.map((_, i) => sum(sel(i + 1, b), field)) });
  let datasets;
  if (compare) datasets = ['legacy', 'nogal'].map((b) => serie(b === 'legacy' ? 'Legacy' : 'Nogal', b, field, COLORS[b]));
  else {
    const b = edif === 'todos' ? null : edif;
    datasets = S.tab === 'generacion'
      ? [serie('Consumo', b, 'consumo_kwh', COLORS.total), serie('Generación solar', b, 'generacion_kwh', COLORS.sol)]
      : [serie('Consumo', b, 'consumo_kwh', COLORS.total)];
  }
  if (kind === 'bar' && datasets.length > 1) datasets.forEach((d) => (d.colors = undefined));
  const title = S.tab === 'generacion' ? 'Consumo vs. generación solar' : 'Consumo mensual';
  const sub = S.meses.length ? S.meses.map((m) => `${MONTHS[m - 1]}: ${fmt(sum(sel(m, edif === 'todos' ? null : edif), field))} kWh`).join(' · ') : '';
  card(grid, { title, kind, labels: MONTHS, datasets, unit: 'kWh', csv, wide: true, filename: `ean_${S.tab}_${S.edificio}` });
  if (sub) grid.insertAdjacentHTML('beforebegin', `<div class="meta">${sub}</div>`);
}
