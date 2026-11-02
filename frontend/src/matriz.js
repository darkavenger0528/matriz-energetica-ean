import { get, url } from './api.js';
import { card, destroyCharts, fmt, kpis, palette, select } from './ui.js';

const S = { region: '', departamento: '', municipio: '', recurso: 'todos', subtipo: 'todas', desde: '', hasta: '' };
const GRUPO = { recurso: 'recurso', region: 'región', departamento: 'departamento', municipio: 'municipio' };
let meta, root;

export async function mount(el) {
  root = el;
  meta = await get('/meta');
  S.desde = meta.periodo.desde; S.hasta = meta.periodo.hasta;
  root.innerHTML = `<div class="layout"><aside class="side glass" id="filters"></aside><section id="out"></section></div>`;
  root.onclick = (e) => {
    if (!e.target.closest('[data-clear]')) return;
    Object.assign(S, { region: '', departamento: '', municipio: '', recurso: 'todos', subtipo: 'todas', desde: meta.periodo.desde, hasta: meta.periodo.hasta });
    update();
  };
  root.onchange = (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    S[k] = e.target.value;
    if (k === 'region') { S.departamento = ''; S.municipio = ''; }
    if (k === 'departamento') S.municipio = '';
    if (k === 'recurso') S.subtipo = 'todas';
    update();
  };
  update();
}
export const redraw = () => root && refresh();
const update = () => { filters(); refresh(); };

function filters() {
  const rec = meta.recursos.find((r) => r.value === S.recurso);
  const deps = meta.departamentos.filter((d) => !S.region || d.region === S.region);
  const depOf = (d) => meta.departamentos.find((x) => x.value === d);
  const munis = meta.municipios.filter((m) => (S.departamento ? m.departamento === S.departamento : !S.region || depOf(m.departamento).region === S.region));
  const p = meta.periodo;
  const dirty = S.region || S.departamento || S.municipio || S.recurso !== 'todos' || S.subtipo !== 'todas' || (p.seleccionable && (S.desde !== p.desde || S.hasta !== p.hasta));
  document.getElementById('filters').innerHTML = `
    <h4>Territorio</h4>
    <div class="f"><label>Región</label>${select('region', [{ value: '', label: 'Todas' }, ...meta.regiones], S.region)}</div>
    <div class="f"><label>Departamento</label>${select('departamento', [{ value: '', label: 'Todos' }, ...deps], S.departamento)}</div>
    <div class="f"><label>Municipio</label>${select('municipio', [{ value: '', label: 'Todos' }, ...munis], S.municipio)}</div>
    <h4>Tipo de energía</h4>
    <div class="f"><label>Recurso</label>${select('recurso', [{ value: 'todos', label: 'Todos (matriz)' }, ...meta.recursos], S.recurso)}</div>
    ${rec ? `<div class="f"><label>Subtipo</label>${select('subtipo', [{ value: 'todas', label: 'Todas' }, ...rec.subtipos], S.subtipo)}</div>` : ''}
    <h4>Periodo</h4>
    ${p.seleccionable
      ? `<div class="f"><label>Desde</label><input type="month" data-k="desde" min="${p.desde}" max="${p.hasta}" value="${S.desde}"></div>
         <div class="f"><label>Hasta</label><input type="month" data-k="hasta" min="${p.desde}" max="${p.hasta}" value="${S.hasta}"></div>`
      : `<p class="note" style="margin:0">Serie completa disponible: ${p.desde} a ${p.hasta}.</p>`}
    <button type="button" class="btn clear" data-clear ${dirty ? '' : 'disabled'}>Borrar filtros</button>`;
}

async function refresh() {
  const out = document.getElementById('out');
  try {
    const f = { region: S.region, departamento: S.departamento, municipio: S.municipio, recurso: S.recurso,
      subtipo: S.recurso === 'todos' ? 'todas' : S.subtipo, ...(meta.periodo.seleccionable ? { desde: S.desde, hasta: S.hasta } : {}) };
    const [ser, res] = await Promise.all([get('/matriz/series', f), get('/matriz/resumen', f)]);
    const g = GRUPO[ser.grupo];
    const fixed = Object.fromEntries(meta.recursos.map((r) => [r.value, r.color]));
    const pal = palette(Math.max(ser.teorico.length, ser.util.length, 1));
    const colorOf = (key, i) => (ser.grupo === 'recurso' ? fixed[key] : pal[i]);
    const pl = ser.periods.map((x) => { const [y, m] = x.split('-'); return ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][+m - 1] + ' ' + y.slice(2); });
    const lbl = (o, v) => o.find((x) => x.value === v)?.label;
    const place = lbl(meta.municipios, S.municipio) || lbl(meta.departamentos, S.departamento) || lbl(meta.regiones, S.region) || 'Colombia';
    const recLbl = S.recurso === 'todos' ? 'todos los recursos' : lbl(meta.recursos, S.recurso);
    const subtitle = `${place} · ${recLbl} · ${ser.periods[0]} a ${ser.periods.at(-1)}`;
    const csv = url('/matriz/export.csv', f), name = `matriz_${ser.grupo}`;
    const lines = (list) => list.map((s, i) => ({ label: s.label, data: s.values, color: colorOf(s.key, i) }));

    destroyCharts();
    out.innerHTML = `${kpis([['Potencial teórico', fmt(res.total.teorico), 'GWh en el periodo', '#005e85'], ['Energía útil', fmt(res.total.util), 'GWh en el periodo', 'var(--accent)'], ['Energía útil sobre el teórico', res.total.pct.toLocaleString('es-CO') + ' %', 'proporción aprovechable', '#00c0b3']])}
      <div class="meta"><span>${place}</span><span>${ser.periods.length} meses · agrupado por ${g}</span></div><div class="chart-grid" id="grid"></div>`;
    const grid = document.getElementById('grid');
    const common = { unit: ser.unit, csv, subtitle, xTitle: 'Mes', totals: true };
    card(grid, { ...common, title: 'Potencial teórico del recurso', kind: 'line', labels: pl, datasets: lines(ser.teorico), yTitle: 'Potencial teórico (GWh por mes)', filename: `${name}_teorico` });
    card(grid, { ...common, title: 'Curva de producción de energía útil', kind: 'line', labels: pl, datasets: lines(ser.util), yTitle: 'Energía útil (GWh por mes)', filename: `${name}_energia_util` });
    card(grid, { title: `Teórico y útil acumulado por ${g}`, kind: 'bar', labels: res.items.map((i) => i.label), unit: res.unit, csv, subtitle, wide: true, totals: true, filename: `${name}_comparacion`,
      xTitle: g[0].toUpperCase() + g.slice(1), yTitle: 'Energía acumulada (GWh)',
      datasets: [{ label: 'Potencial teórico', data: res.items.map((i) => i.teorico), color: '#005e85' }, { label: 'Energía útil', data: res.items.map((i) => i.util), color: '#3bac52' }] });
  } catch (e) { out.innerHTML = `<div class="err">No se pudo cargar la información: ${e.message}</div>`; }
}
