import { get, url } from './api.js';
import { card, chips, destroyCharts, fmt, palette, select, toggle, MONTHS } from './ui.js';

const KIND = { barras: 'bar', pastel: 'pie', anillo: 'doughnut', tabla: 'tabla', lineas: 'line' };
const TIPOS = Object.keys(KIND).map((k) => ({ value: k, label: k[0].toUpperCase() + k.slice(1) }));
const S = { level: 'region', territorio: '', recurso: 'todos', subtipo: 'todas', potencial: ['tecnico'], tipos: ['barras'], desde: '2023-01', hasta: '2025-12' };
let meta, root;
const LEVELS = { region: ['Región', 'regiones'], departamento: ['Departamento', 'departamentos'], municipio: ['Municipio', 'municipios'] };

export async function mount(el) {
  root = el;
  meta = await get('/meta');
  S.desde = meta.periodo.desde; S.hasta = meta.periodo.hasta;
  root.innerHTML = `<div class="layout"><aside class="side" id="filters"></aside><section id="out"></section></div>`;
  root.onchange = (e) => onKey(e.target);
  root.onclick = (e) => {
    const b = e.target.closest('[data-chip]');
    if (b) { S[b.dataset.chip] = toggle(S[b.dataset.chip], b.dataset.v); update(); }
    if (e.target.dataset.all) { S.tipos = Object.keys(KIND); update(); }
  };
  update();
}

function onKey(t) {
  const k = t.dataset.k;
  if (!k) return;
  S[k] = t.value;
  if (k === 'level') S.territorio = '';
  if (k === 'recurso') S.subtipo = 'todas';
  update();
}

const update = () => { filters(); refresh(); };
export const redraw = () => root && refresh();

function filters() {
  const rec = meta.recursos.find((r) => r.value === S.recurso);
  document.getElementById('filters').innerHTML = `
    <h4>Territorio</h4>
    <label>Nivel</label>${select('level', Object.entries(LEVELS).map(([v, [l]]) => ({ value: v, label: l })), S.level)}
    <label>${LEVELS[S.level][0]}</label>${select('territorio', [{ value: '', label: 'Colombia (todas)' }, ...meta[LEVELS[S.level][1]]], S.territorio)}
    <h4>Tipo de energía</h4>
    <label>Recurso</label>${select('recurso', [{ value: 'todos', label: 'Todos (matriz)' }, ...meta.recursos], S.recurso)}
    ${rec ? `<label>Subtipo</label>${select('subtipo', [{ value: 'todas', label: 'Todas' }, ...rec.subtipos], S.subtipo)}` : ''}
    <label>Tipo de potencial (uno o varios)</label>${chips('potencial', meta.potenciales, S.potencial)}
    <h4>Periodo</h4>
    <label>Desde</label><input type="month" data-k="desde" min="${meta.periodo.desde}" max="${meta.periodo.hasta}" value="${S.desde}">
    <label>Hasta</label><input type="month" data-k="hasta" min="${meta.periodo.desde}" max="${meta.periodo.hasta}" value="${S.hasta}">
    <h4>Visualización</h4>
    ${chips('tipos', TIPOS, S.tipos)}<div style="margin-top:6px"><button class="chip" data-all="1">Todos</button></div>`;
}

async function refresh() {
  const out = document.getElementById('out');
  try {
    if (S.desde > S.hasta) [S.desde, S.hasta] = [S.hasta, S.desde];
    const agrupar = S.potencial.length > 1 ? 'potencial' : S.recurso === 'todos' ? 'recurso' : 'territorio';
    const base = { level: S.level, territorio: S.territorio, desde: S.desde, hasta: S.hasta };
    const f = { ...base, recurso: S.recurso, subtipo: S.recurso === 'todos' ? 'todas' : S.subtipo, potencial: S.potencial, agrupar };
    const [tot, trend, kpi] = await Promise.all([
      get('/matriz/agregado', f), get('/matriz/tendencia', f),
      get('/matriz/agregado', { ...base, recurso: 'todos', potencial: 'tecnico', agrupar: 'recurso' }),
    ]);

    const fixed = Object.fromEntries([...meta.recursos, ...meta.potenciales].map((o) => [o.value, o.color]));
    const pal = palette(tot.items.length);
    const colorOf = (key, i) => (agrupar === 'territorio' ? pal[i] : fixed[key]);
    const labels = tot.items.map((i) => i.label);
    const csv = url('/matriz/export.csv', f);
    const name = `matriz_${agrupar}_${S.desde}_${S.hasta}`;

    let tipos = S.tipos.filter((t) => ['tabla', 'barras', 'pastel', 'anillo', 'lineas'].includes(t));
    if (tot.items.length <= 1) tipos = tipos.includes('lineas') ? ['lineas', 'tabla'] : ['tabla']; // un solo dato: pastel/barras no aportan
    const order = ['tabla', 'barras', 'pastel', 'anillo', 'lineas'].filter((t) => tipos.includes(t));

    destroyCharts();
    const place = S.territorio ? meta[LEVELS[S.level][1]].find((o) => o.value === S.territorio)?.label : 'Colombia · todo el territorio';
    out.innerHTML = `<div class="kpis">${kpi.items.map((k) => `<div class="kpi" style="--c:${fixed[k.key]}"><small>${k.label} · técnico</small><b>${fmt(k.value)}</b><small>GWh</small></div>`).join('')}</div>
      <div class="meta"><span>${place}</span><span>${trend.periods.length} meses · ${tot.unit}</span></div><div class="chart-grid" id="grid"></div>`;
    const grid = document.getElementById('grid');

    order.forEach((t, idx) => {
      const wide = t === 'lineas' || (t === 'tabla' && order.length === 1);
      if (t === 'lineas') {
        const p = trend.series.map((s, i) => ({ label: s.label, data: s.values, color: colorOf(s.key, i) }));
        const pl = trend.periods.map((x) => { const [y, m] = x.split('-'); return `${MONTHS[+m - 1]} ${y.slice(2)}`; });
        card(grid, { title: 'Evolución mensual', kind: 'line', labels: pl, datasets: p, unit: tot.unit, csv, filename: `${name}_lineas`, wide });
      } else {
        const ds = [{ label: tot.unit, data: tot.items.map((i) => i.value), colors: tot.items.map((i, j) => colorOf(i.key, j)) }];
        card(grid, { title: t[0].toUpperCase() + t.slice(1), kind: KIND[t], labels, datasets: ds, unit: tot.unit, csv, filename: `${name}_${t}`, wide });
      }
    });
  } catch (e) { out.innerHTML = `<div class="err">No se pudo cargar la información: ${e.message}</div>`; }
}
