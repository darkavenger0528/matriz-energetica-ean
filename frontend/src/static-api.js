// Implementación en el navegador de los mismos endpoints de la API, para la demo en GitHub Pages
// (sin backend). Lee /data/data.json generado por backend/scripts/export_static.py.
const base = import.meta.env?.BASE_URL ?? '/';
let D = null;
const COL = { recurso: 4, potencial: 6 };
const TER = { region: 1, departamento: 2, municipio: 3 };

export async function load() {
  if (!D) D = await (await fetch(`${base}data/data.json`)).json();
  return D;
}
const ym = (s) => +String(s).replace('-', '');
const fmtP = (p) => `${Math.floor(p / 100)}-${String(p % 100).padStart(2, '0')}`;
const arr = (v, d) => (v == null || v === '' ? d : [].concat(v));
const r1 = (v) => Math.round(v * 10) / 10;
const rank = (order, k) => (order.includes(k) ? order.indexOf(k) : 999);

function query(p) {
  const level = p.level || 'region', agrupar = p.agrupar || 'recurso';
  const pot = arr(p.potencial, ['tecnico']);
  let d = ym(p.desde || D.meta.periodo.desde), h = ym(p.hasta || D.meta.periodo.hasta);
  if (d > h) [d, h] = [h, d];
  const recurso = p.recurso || 'todos', sub = p.subtipo || 'todas';
  const col = agrupar === 'territorio' ? TER[level] : COL[agrupar];
  const labels = agrupar === 'territorio' ? D.labels[level] : D.labels[agrupar];
  const rows = D.rows.filter((r) => r[0] >= d && r[0] <= h && pot.includes(r[6]) &&
    (!p.territorio || r[TER[level]] === p.territorio) &&
    (recurso === 'todos' || (r[4] === recurso && (sub === 'todas' || r[5] === sub))));
  return { rows, col, labels, d, h, agrupar };
}

function agregado(p) {
  const q = query(p), m = new Map();
  for (const r of q.rows) m.set(r[q.col], (m.get(r[q.col]) || 0) + r[7]);
  const order = Object.keys(q.labels);
  const items = [...m].map(([k, v]) => ({ key: k, label: q.labels[k] ?? k, value: r1(v) }));
  items.sort((a, b) => rank(order, a.key) - rank(order, b.key));
  return { unit: 'GWh', items };
}

function tendencia(p) {
  const q = query(p), periods = [];
  for (let y = Math.floor(q.d / 100), m = q.d % 100; y * 100 + m <= q.h;) {
    periods.push(y * 100 + m);
    if (m === 12) { y++; m = 1; } else m++;
  }
  const data = {};
  for (const r of q.rows) { const k = r[q.col]; (data[k] ??= {})[r[0]] = (data[k][r[0]] || 0) + r[7]; }
  const series = Object.keys(q.labels).filter((k) => data[k])
    .map((k) => ({ key: k, label: q.labels[k], values: periods.map((x) => r1(data[k][x] || 0)) }));
  return { unit: 'GWh', periods: periods.map(fmtP), series };
}

function matrizCsv(p) {
  const q = query(p), acc = new Map();
  for (const r of q.rows) { const k = `${r[0]}|${r[q.col]}`; acc.set(k, (acc.get(k) || 0) + r[7]); }
  const lines = [...acc].map(([k, v]) => [...k.split('|'), v]).sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
    .map(([per, key, v]) => `${fmtP(+per)},"${q.labels[key] ?? key}",${v.toFixed(2)}`);
  return [`periodo,${q.agrupar},valor_gwh`, ...lines].join('\n');
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
  return ['anio,mes,edificio,consumo_kwh,generacion_kwh,pct_solar',
    ...rows.map((r) => [r[0], r[1], D.ean.edificios[r[2]], r[3], r[4], r1((r[4] / r[3]) * 100)].join(','))].join('\n');
}

export async function get(path, p = {}) {
  await load();
  switch (path) {
    case '/meta': return D.meta;
    case '/matriz/agregado': return agregado(p);
    case '/matriz/tendencia': return tendencia(p);
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
