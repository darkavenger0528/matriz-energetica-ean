// Implementación en el navegador de los mismos endpoints de la API, para la demo en GitHub Pages
// (sin backend). Lee /data/data.json generado por backend/scripts/export_static.py.
const base = import.meta.env?.BASE_URL ?? '/';
let D = null;
const TER = { region: 1, departamento: 2, municipio: 3 };
const TEO = 'teorico', UTIL = 'tecnico';

export async function load() {
  if (!D) D = await (await fetch(`${base}data/data.json`)).json();
  return D;
}
const ym = (s) => +String(s).replace('-', '');
const fmtP = (p) => `${Math.floor(p / 100)}-${String(p % 100).padStart(2, '0')}`;
const arr = (v, d) => (v == null || v === '' ? d : [].concat(v));
const r1 = (v) => Math.round(v * 10) / 10;

function query(p) {
  const per = D.meta.periodo;
  let d = ym(per.desde), h = ym(per.hasta);
  if (per.seleccionable && p.desde && p.hasta) { d = ym(p.desde); h = ym(p.hasta); if (d > h) [d, h] = [h, d]; }
  const todos = !p.recurso || p.recurso === 'todos';
  const rows = D.rows.filter((r) => r[0] >= d && r[0] <= h && (r[6] === TEO || r[6] === UTIL) &&
    (!p.region || r[1] === p.region) && (!p.departamento || r[2] === p.departamento) && (!p.municipio || r[3] === p.municipio) &&
    (todos || (r[4] === p.recurso && (!p.subtipo || p.subtipo === 'todas' || r[5] === p.subtipo))));
  const level = p.municipio || p.departamento ? 'municipio' : p.region ? 'departamento' : 'region';
  return { rows, d, h, col: todos ? 4 : TER[level], labels: todos ? D.labels.recurso : D.labels[level], grupo: todos ? 'recurso' : level };
}

function series(p) {
  const q = query(p), periods = [];
  for (let y = Math.floor(q.d / 100), m = q.d % 100; y * 100 + m <= q.h;) {
    periods.push(y * 100 + m);
    if (m === 12) { y++; m = 1; } else m++;
  }
  const data = {};
  for (const r of q.rows) { const o = ((data[r[6]] ??= {})[r[q.col]] ??= {}); o[r[0]] = (o[r[0]] || 0) + r[7]; }
  const build = (pot) => Object.keys(q.labels).filter((k) => data[pot]?.[k])
    .map((k) => ({ key: k, label: q.labels[k], values: periods.map((x) => r1(data[pot][k][x] || 0)) }));
  return { unit: 'GWh', grupo: q.grupo, periods: periods.map(fmtP), teorico: build(TEO), util: build(UTIL) };
}

function resumen(p) {
  const q = query(p), acc = {};
  for (const r of q.rows) { const o = (acc[r[q.col]] ??= {}); o[r[6]] = (o[r[6]] || 0) + r[7]; }
  const items = Object.keys(q.labels).filter((k) => acc[k]).map((k) => {
    const t = acc[k][TEO] || 0, u = acc[k][UTIL] || 0;
    return { key: k, label: q.labels[k], teorico: r1(t), util: r1(u), pct: t ? r1((u / t) * 100) : 0 };
  });
  const tt = items.reduce((s, i) => s + i.teorico, 0), tu = items.reduce((s, i) => s + i.util, 0);
  return { unit: 'GWh', grupo: q.grupo, items, total: { teorico: r1(tt), util: r1(tu), pct: tt ? r1((tu / tt) * 100) : 0 } };
}

function matrizCsv(p) {
  const q = query(p), acc = new Map();
  for (const r of q.rows) { const k = `${r[0]}|${r[q.col]}`; const o = acc.get(k) || {}; o[r[6]] = (o[r[6]] || 0) + r[7]; acc.set(k, o); }
  const lines = [...acc].map(([k, o]) => [...k.split('|'), o]).sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
    .map(([per, key, o]) => `${fmtP(+per)},"${q.labels[key] ?? key}",${(o[TEO] || 0).toFixed(2)},${(o[UTIL] || 0).toFixed(2)}`);
  return [`periodo,${q.grupo},potencial_teorico_gwh,energia_util_gwh`, ...lines].join('\n');
}

const lect = (p) => D.ean.lecturas.filter((r) => r[0] === +(p.anio || 2025) && (!p.edificio || p.edificio === 'todos' || r[2] === p.edificio));

function eanCargas(p) {
  const w = {};
  if (!p.edificio || p.edificio === 'todos') D.ean.lecturas.forEach((r) => { if (r[0] === +(p.anio || 2025)) w[r[2]] = (w[r[2]] || 0) + r[3]; });
  else w[p.edificio] = 1;
  const tot = Object.values(w).reduce((s, v) => s + v, 0) || 1, acc = {};
  D.ean.cargas.forEach(([b, c, pct]) => { acc[c] = (acc[c] || 0) + (pct * (w[b] || 0)) / tot; });
  return { unit: '%', items: Object.entries(acc).map(([carga, v]) => ({ carga, pct: r1(v) })) };
}

function eanCsv(p) {
  const meses = arr(p.meses, []).map(Number);
  const rows = lect(p).filter((r) => !meses.length || meses.includes(r[1]));
  const tarifa = +(p.tarifa || D.meta.economia.tarifa_cop_kwh), factor = +(p.factor || D.meta.economia.factor_emision_kg_kwh);
  return ['anio,mes,edificio,consumo_kwh,generacion_kwh,pct_solar,tarifa_cop_kwh,ahorro_cop,factor_kgco2e_kwh,emisiones_evitadas_kgco2e',
    ...rows.map((r) => [r[0], r[1], D.ean.edificios[r[2]], r[3], r[4], r1((r[4] / r[3]) * 100), tarifa, Math.round(r[4] * tarifa), factor, r1(r[4] * factor)].join(','))].join('\n');
}

export async function get(path, p = {}) {
  await load();
  switch (path) {
    case '/meta': return D.meta;
    case '/matriz/series': return series(p);
    case '/matriz/resumen': return resumen(p);
    case '/ean/mensual': return { unit: 'kWh', anio: +(p.anio || 2025), items: lect(p).map((r) => ({ mes: r[1], edificio: r[2], consumo_kwh: r[3], generacion_kwh: r[4] })) };
    case '/ean/cargas': return eanCargas(p);
    default: throw new Error(`Endpoint estático no soportado: ${path}`);
  }
}

/** URL descargable (blob) para los CSV. Requiere que los datos ya estén cargados. */
export function url(path, p = {}) {
  if (!D) return '#';
  const text = path === '/matriz/export.csv' ? matrizCsv(p) : path === '/ean/export.csv' ? eanCsv(p) : null;
  return text == null ? '#' : URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }));
}
