import { Chart, registerables } from 'chart.js';
import { logoDataUrl } from './logo.js';
Chart.register(...registerables);

const FONT = "'Open Sans', system-ui, sans-serif";
Chart.defaults.font.family = FONT;

export const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const ANCHORS = ['#3bac52', '#005e85', '#533278', '#00c0b3', '#dfdf3f', '#009579'];
export const palette = (n) => Array.from({ length: n }, (_, i) => {
  const base = ANCHORS[i % 6], r = Math.floor(i / 6);
  return r === 0 ? base : mix(base, r % 2 ? '#ffffff' : '#000000', 0.22 * Math.ceil(r / 2));
});
function mix(hex, to, t) {
  const c = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map((i) => Math.round(c(hex, i) * (1 - t) + c(to, i) * t).toString(16).padStart(2, '0')).join('');
}
export const fmt = (v) => Number(v).toLocaleString('es-CO', { maximumFractionDigits: 0 });
export const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

export const select = (k, opts, val) =>
  `<select data-k="${k}">${opts.map((o) => `<option value="${o.value}" ${o.value === val ? 'selected' : ''}>${o.label}</option>`).join('')}</select>`;
export const chips = (k, opts, vals) =>
  `<div class="chips">${opts.map((o) => `<button type="button" class="chip ${vals.includes(o.value) ? 'on' : ''}" data-chip="${k}" data-v="${o.value}">${o.label}</button>`).join('')}</div>`;
/** Control segmentado estilo iOS (una sola opción activa). */
export const segment = (k, opts, val) =>
  `<div class="seg" role="group">${opts.map((o) => `<button type="button" class="${o.value === val ? 'on' : ''}" data-chip="${k}" data-v="${o.value}">${o.label}</button>`).join('')}</div>`;

export function toggle(arr, v, min = 1) {
  if (arr.includes(v)) return arr.length > min ? arr.filter((x) => x !== v) : arr;
  return [...arr, v];
}

/** Coloca la "píldora" deslizante bajo la opción activa de cada control segmentado. */
export function initSeg(scope = document) {
  scope.querySelectorAll('.seg').forEach((seg) => {
    let t = seg.querySelector('.thumb');
    if (!t) { t = document.createElement('span'); t.className = 'thumb'; seg.prepend(t); }
    const on = seg.querySelector('button.on');
    t.style.opacity = on ? 1 : 0;
    if (on) {
      t.style.width = on.offsetWidth + 'px'; t.style.transform = `translateX(${on.offsetLeft}px)`;
      if (seg.scrollWidth > seg.clientWidth) seg.scrollLeft = on.offsetLeft - (seg.clientWidth - on.offsetWidth) / 2;
    }
  });
}

/* ---------- Gráficas ---------- */
const nf = (d) => (v) => Number(v).toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
const sumOf = (a) => a.reduce((x, y) => x + y, 0);
/** 205.000 → «205 mil», 1.250.000 → «1,3 M». Devuelve null si el número es pequeño. */
export const compactEs = (v) => { const a = Math.abs(v); return a >= 1e6 ? `${(v / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M` : a >= 1e4 ? `${Math.round(v / 1e3)} mil` : null; };

/** Valores sobre barras, puntos y porciones: se adaptan al ancho disponible y no se superponen entre sí. */
const dataLabels = (s, ex) => ({
  id: 'dataLabels',
  afterDatasetsDraw(c) {
    const { ctx } = c, d0 = s.dec ?? 0, full = nf(d0), narrow = !ex && c.width < 460;
    const px = ex ? 21 : narrow ? 10 : 11, ink = ex ? '#171717' : css('--ink'), halo = ex ? '#ffffff' : css('--bg');
    ctx.save(); ctx.font = `700 ${px}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.lineJoin = 'round';
    const w = (t) => ctx.measureText(t).width, rects = [];
    const put = (t, x, y) => { // prueba posiciones hasta encontrar una libre
      const tw = w(t) + 8, th = px + 4;
      x = Math.min(Math.max(x, tw / 2 + 2), c.width - tw / 2 - 2);
      for (const k of [0, -1, 1, -2, 2]) {
        const yy = y + k * (th - 2), cy = yy - th / 2;
        if (!rects.some((r) => Math.abs(r.x - x) < (r.w + tw) / 2 && Math.abs(r.y - cy) < (r.h + th) / 2)) {
          rects.push({ x, y: cy, w: tw, h: th });
          ctx.lineWidth = 4; ctx.strokeStyle = halo; ctx.strokeText(t, x, yy); ctx.fillStyle = ink; ctx.fillText(t, x, yy); return;
        }
      }
    };
    if (s.kind === 'bar') {
      const els = c.data.datasets.flatMap((d, i) => c.getDatasetMeta(i).data.map((el, j) => ({ el, v: d.data[j] })));
      const limit = Math.min(...els.map((e) => e.el.width)) * 1.2;
      const maxW = (fn) => Math.max(...els.map((e) => w(fn(e.v))));
      let fn = full, rot = false;
      if (maxW(full) > limit) { const comp = (v) => compactEs(v) ?? full(v); fn = comp; if (maxW(comp) > limit) rot = true; }
      els.forEach(({ el, v }) => {
        if (!rot) { ctx.fillStyle = ink; ctx.lineWidth = 4; ctx.strokeStyle = halo; ctx.strokeText(fn(v), el.x, el.y - 5); ctx.fillText(fn(v), el.x, el.y - 5); return; }
        ctx.save(); ctx.translate(el.x + px / 3, el.y - 6); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = ink; ctx.fillText(fn(v), 0, 0); ctx.restore();
      });
    } else if (s.kind === 'line') {
      c.data.datasets.forEach((d, i) => {
        const pts = c.getDatasetMeta(i).data, n = d.data.length, long = n > 14;
        const idx = long ? [...new Set([d.data.indexOf(Math.max(...d.data)), n - 1])] : d.data.map((_, k) => k);
        idx.forEach((k) => {
          if (long) { ctx.beginPath(); ctx.arc(pts[k].x, pts[k].y, ex ? 6 : 4, 0, 7); ctx.fillStyle = d.borderColor; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = halo; ctx.stroke(); }
          put(compactEs(d.data[k]) && narrow ? compactEs(d.data[k]) : full(d.data[k]), pts[k].x, pts[k].y - (ex ? 14 : 9));
        });
      });
    } else {
      const data = c.data.datasets[0].data, tot = sumOf(data);
      ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
      c.getDatasetMeta(0).data.forEach((el, j) => { const pc = (data[j] / tot) * 100; if (pc >= 6) { const { x, y } = el.tooltipPosition(); ctx.fillText(`${pc.toFixed(0)}%`, x, y); } });
    }
    ctx.restore();
  },
});

export function config(s, ex, logoImg) {
  const round = s.kind === 'pie' || s.kind === 'doughnut';
  const ink = ex ? '#171717' : css('--ink-2'), grid = ex ? '#e3e6e3' : css('--hair');
  const F = nf(s.dec ?? 0);
  const fs = ex ? { tick: 20, axis: 22, legend: 21, title: 38, sub: 21 } : { tick: 11, axis: 12, legend: 12, title: 0, sub: 0 };
  const axisTitle = (text) => ({ display: !!text, text, color: ex ? '#171717' : css('--ink-2'), font: { family: FONT, weight: '700', size: fs.axis }, padding: ex ? 12 : 6 });
  const tot = round ? sumOf(s.datasets[0].data) : 0;
  const labels = round ? s.labels.map((l, i) => `${l}: ${F(s.datasets[0].data[i])} ${s.unit}${s.unit === '%' ? '' : ` (${((s.datasets[0].data[i] / tot) * 100).toFixed(0)}%)`}`) : s.labels;
  const plugins = [dataLabels(s, ex)];
  if (ex) {
    plugins.push({ id: 'bg', beforeDraw: (c) => { c.ctx.save(); c.ctx.globalCompositeOperation = 'destination-over'; c.ctx.fillStyle = '#fff'; c.ctx.fillRect(0, 0, c.width, c.height); c.ctx.restore(); } });
    // Logo arriba a la derecha y fuente abajo a la izquierda (coordenadas en px CSS del lienzo, no del bitmap)
    plugins.push({ id: 'brand', afterDraw: (c) => {
      c.ctx.save();
      c.ctx.drawImage(logoImg, c.width - 40 - 184, 20, 184, 77);
      c.ctx.fillStyle = '#6b716c'; c.ctx.font = `400 17px ${FONT}`; c.ctx.textAlign = 'left'; c.ctx.textBaseline = 'alphabetic';
      c.ctx.fillText(`Universidad EAN · Matriz energética · Datos de demostración · ${new Date().toLocaleDateString('es-CO')}`, 40, c.height - 22);
      c.ctx.restore();
    } });
  }
  const dot = ex ? 14 : 9;
  return {
    type: s.kind, plugins,
    data: {
      labels,
      datasets: s.datasets.map((d) => ({
        label: d.label, data: d.data,
        backgroundColor: s.kind === 'line' ? d.color : d.colors || d.color,
        borderColor: s.kind === 'line' ? d.color : round ? (ex ? '#fff' : css('--bg')) : undefined,
        borderWidth: s.kind === 'line' ? (ex ? 4 : 3) : round ? 3 : 0, tension: 0.35, pointRadius: s.kind === 'line' && d.data.length <= 14 ? (ex ? 5 : 3) : 0, pointHoverRadius: 5,
        borderRadius: s.kind === 'bar' ? 8 : 0, borderSkipped: false, maxBarThickness: ex ? 90 : 64, hoverOffset: round ? 8 : 0,
      })),
    },
    options: {
      responsive: !ex, maintainAspectRatio: false, animation: ex ? false : { duration: 700, easing: 'easeOutQuart' },
      devicePixelRatio: ex ? 2 : undefined,
      layout: { padding: ex ? { top: 8, right: 40, bottom: 56, left: 28 } : { top: 14, right: 6, bottom: 2, left: 2 } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        title: { display: ex, text: s.titleLines || s.title, align: 'start', color: '#000', font: { family: "'Archivo', sans-serif", weight: '800', size: fs.title, lineHeight: 1.15 }, padding: { top: 6, bottom: 4 } },
        subtitle: { display: ex && !!s.subtitle, text: s.subtitleLines || s.subtitle, align: 'start', color: '#4a4f4b', font: { family: FONT, size: fs.sub, lineHeight: 1.3 }, padding: { bottom: 22 } },
        legend: { display: round || s.datasets.length > 1, position: ex && round ? 'right' : 'bottom',
          labels: { color: ink, usePointStyle: true, pointStyle: 'circle', boxWidth: dot, boxHeight: dot, pointStyleWidth: dot, padding: ex ? 22 : 12, font: { family: FONT, size: fs.legend } ,
            // Cada color de la leyenda lleva su dato relevante (total de la serie). En pastel/anillo se usan las etiquetas por categoría.
            ...(round ? {} : { generateLabels: (chart) => {
              const base = Chart.defaults.plugins.legend.labels.generateLabels(chart);
              if (s.totals) base.forEach((l) => { l.text = `${l.text} · ${F(sumOf(s.datasets[l.datasetIndex].data))} ${s.unit}`; });
              return base;
            } }) } },
        tooltip: { backgroundColor: 'rgba(20,22,20,.92)', titleFont: { family: FONT, weight: '700' }, bodyFont: { family: FONT }, padding: 12, cornerRadius: 12, boxPadding: 4,
          callbacks: { label: (c) => ` ${c.dataset.label ? c.dataset.label + ': ' : ''}${F(c.parsed.y ?? c.parsed)} ${s.unit}` } },
      },
      scales: round ? {} : {
        x: { title: axisTitle(s.xTitle), ticks: { color: ink, font: { size: fs.tick }, maxRotation: 0, minRotation: 0, autoSkip: true, autoSkipPadding: ex ? 22 : 10 }, grid: { display: false }, border: { color: grid } },
        y: { title: axisTitle(s.yTitle), ticks: { color: ink, font: { size: fs.tick }, callback(v) { return this.chart.width < 460 ? (compactEs(v) ?? (s.dec ? F(v) : fmt(v))) : (s.dec ? F(v) : fmt(v)); } },
          grid: { color: grid, borderDash: [3, 4] }, border: { display: false }, beginAtZero: true, grace: s.kind === 'bar' ? '16%' : '10%' },
      },
    },
  };
}

let live = [];
export const destroyCharts = () => { live.forEach((c) => c.destroy()); live = []; };

const wrap = (ctx, text, maxW) => {
  const out = []; let line = '';
  for (const word of String(text).split(' ')) { const t = line ? `${line} ${word}` : word; if (line && ctx.measureText(t).width > maxW) { out.push(line); line = word; } else line = t; }
  return line ? [...out, line] : out;
};

/** PNG de alta resolución (3200×1800): título y filtros sin cortarse, ejes rotulados, valores, logo y fuente. */
export async function exportPng(s, filename) {
  try { await Promise.all(["800 38px Archivo", "400 21px 'Open Sans'", "700 21px 'Open Sans'"].map((f) => document.fonts.load(f))); await document.fonts.ready; } catch { /* usa la fuente de respaldo */ }
  const img = new Image(); img.src = logoDataUrl('#000'); await img.decode();
  const cv = document.createElement('canvas'); cv.width = 1600; cv.height = 900;
  const m = cv.getContext('2d'), maxW = 1600 - 40 - 184 - 70;
  m.font = "800 38px Archivo, sans-serif"; const titleLines = wrap(m, s.title, maxW);
  m.font = "400 21px 'Open Sans', sans-serif"; const subtitleLines = s.subtitle ? wrap(m, s.subtitle, maxW) : null;
  const ch = new Chart(cv, config({ ...s, titleLines, subtitleLines }, true, img));
  const a = Object.assign(document.createElement('a'), { href: cv.toDataURL('image/png'), download: `${filename}.png` });
  a.click(); ch.destroy();
}

/**
 * s: { title, kind: bar|line|pie|doughnut|tabla, labels, datasets:[{label,data,color?,colors?}],
 *      unit, xTitle, yTitle, subtitle, csv, filename, wide }
 */
export function card(parent, s) {
  const { title, kind, labels, datasets, unit = '', csv = null, filename = 'grafica', wide = false } = s;
  s.unit = unit;
  const el = document.createElement('section');
  el.className = 'card glass' + (wide ? ' wide' : '');
  el.innerHTML = `<header><h3>${title}</h3><div class="actions">
    ${csv ? `<a class="btn" href="${csv}" download="${filename}.csv">CSV</a>` : ''}
    ${kind !== 'tabla' ? '<button class="btn png" type="button">PNG</button>' : ''}</div></header><div class="body"></div>`;
  parent.append(el);
  const body = el.querySelector('.body');

  if (kind === 'tabla') {
    body.classList.add('tbl');
    body.innerHTML = `<table><thead><tr><th>${datasets.length > 1 ? 'Periodo' : 'Categoría'}</th>${datasets.map((d) => `<th class="n">${d.label}${unit ? ` (${unit})` : ''}</th>`).join('')}</tr></thead>
      <tbody>${labels.map((l, i) => `<tr><td>${l}</td>${datasets.map((d) => `<td class="n">${fmt(d.data[i])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    return el;
  }
  const canvas = document.createElement('canvas');
  body.append(canvas);
  live.push(new Chart(canvas, config(s, false)));
  const btn = el.querySelector('.png');
  btn.onclick = async () => { btn.disabled = true; btn.textContent = '…'; try { await exportPng(s, filename); } finally { btn.disabled = false; btn.textContent = 'PNG'; } };
  return el;
}

/** Tabla de datos con columnas propias. cols: encabezados; rows: celdas ya formateadas (1.ª columna = texto, el resto numéricas). */
export function dataTable(parent, { title, cols, rows, note = '', csv = null, filename = 'tabla', hi = null }) {
  const el = document.createElement('section');
  el.className = 'card glass wide';
  el.innerHTML = `<header><h3>${title}</h3><div class="actions">${csv ? `<a class="btn" href="${csv}" download="${filename}.csv">CSV</a>` : ''}</div></header>
    <div class="body tbl"><table><thead><tr>${cols.map((c, i) => `<th class="${i ? 'n' : ''}">${c}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr class="${hi && r[0] === hi ? 'hi' : ''}">${r.map((c, i) => `<${i ? 'td class="n"' : 'th scope="row"'}>${c}</${i ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</tbody></table></div>
    ${note ? `<p class="note">${note}</p>` : ''}`;
  parent.append(el);
  return el;
}

export const kpis = (items) => `<div class="kpis">${items.map(([l, v, u, c]) => `<div class="kpi glass" style="--c:${c || 'var(--accent)'}"><small>${l}</small><b>${v}</b><small>${u}</small></div>`).join('')}</div>`;
