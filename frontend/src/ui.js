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
    if (on) { t.style.width = on.offsetWidth + 'px'; t.style.transform = `translateX(${on.offsetLeft}px)`; }
  });
}

/* ---------- Gráficas ---------- */
const valueLabels = {
  id: 'valueLabels',
  afterDatasetsDraw(c) {
    const { ctx } = c; ctx.save(); ctx.fillStyle = '#171717'; ctx.font = `600 13px ${FONT}`; ctx.textAlign = 'center';
    c.data.datasets.forEach((d, i) => c.getDatasetMeta(i).data.forEach((el, j) => ctx.fillText(fmt(d.data[j]), el.x, el.y - 7)));
    ctx.restore();
  },
};

function config(s, ex, logoImg) {
  const round = s.kind === 'pie' || s.kind === 'doughnut';
  const ink = ex ? '#171717' : css('--ink-2'), grid = ex ? '#e3e6e3' : css('--hair');
  const axisTitle = (text) => ({ display: !!text, text, color: ex ? '#171717' : css('--ink-2'), font: { family: FONT, weight: '700', size: ex ? 17 : 12 }, padding: ex ? 10 : 6 });
  const labels = ex && round ? s.labels.map((l, i) => `${l}: ${fmt(s.datasets[0].data[i])} ${s.unit}`) : s.labels;
  const size = ex ? 1.25 : 1;
  const plugins = [];
  if (ex) {
    plugins.push({ id: 'bg', beforeDraw: (c) => { c.ctx.save(); c.ctx.globalCompositeOperation = 'destination-over'; c.ctx.fillStyle = '#fff'; c.ctx.fillRect(0, 0, c.width, c.height); c.ctx.restore(); } });
    plugins.push({ id: 'brand', afterDraw: (c) => {
      const w = c.width / 2, h = c.height / 2; c.ctx.save();
      c.ctx.drawImage(logoImg, w - 210, 22, 170, 71);
      c.ctx.fillStyle = '#6b716c'; c.ctx.font = `400 13px ${FONT}`; c.ctx.textAlign = 'left';
      c.ctx.fillText(`Universidad EAN · Matriz energética · Datos de demostración · ${new Date().toLocaleDateString('es-CO')}`, 40, h - 16);
      c.ctx.restore();
    } });
    if (s.kind === 'bar' && s.labels.length * s.datasets.length <= 24) plugins.push(valueLabels);
  }
  return {
    type: s.kind, plugins,
    data: {
      labels,
      datasets: s.datasets.map((d) => ({
        label: d.label, data: d.data,
        backgroundColor: s.kind === 'line' ? d.color : d.colors || d.color,
        borderColor: s.kind === 'line' ? d.color : round ? (ex ? '#fff' : css('--bg')) : undefined,
        borderWidth: s.kind === 'line' ? 3 : round ? 3 : 0, tension: 0.35, pointRadius: s.kind === 'line' ? (ex ? 3 : 2) : 0, pointHoverRadius: 5,
        borderRadius: s.kind === 'bar' ? 8 : 0, borderSkipped: false, maxBarThickness: 64, hoverOffset: round ? 8 : 0,
      })),
    },
    options: {
      responsive: !ex, maintainAspectRatio: false, animation: ex ? false : { duration: 700, easing: 'easeOutQuart' },
      devicePixelRatio: ex ? 2 : undefined,
      layout: { padding: ex ? { top: 8, right: 36, bottom: 34, left: 24 } : 4 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        title: { display: ex, text: s.title, align: 'start', color: '#000', font: { family: "'Archivo', sans-serif", weight: '800', size: 28 }, padding: { bottom: 2 } },
        subtitle: { display: ex && !!s.subtitle, text: s.subtitle, align: 'start', color: '#4a4f4b', font: { family: FONT, size: 14 }, padding: { bottom: 18 } },
        legend: { display: round || s.datasets.length > 1, position: ex ? 'bottom' : round ? 'bottom' : 'top',
          labels: { color: ink, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: ex ? 18 : 14, font: { family: FONT, size: ex ? 15 : 12 } } },
        tooltip: { backgroundColor: 'rgba(20,22,20,.92)', titleFont: { family: FONT, weight: '700' }, bodyFont: { family: FONT }, padding: 12, cornerRadius: 12, boxPadding: 4,
          callbacks: { label: (c) => ` ${c.dataset.label ? c.dataset.label + ': ' : ''}${fmt(c.parsed.y ?? c.parsed)} ${s.unit}` } },
      },
      scales: round ? {} : {
        x: { title: axisTitle(s.xTitle), ticks: { color: ink, font: { size: ex ? 14 : 11 }, maxRotation: 45, autoSkip: true }, grid: { display: false }, border: { color: grid } },
        y: { title: axisTitle(s.yTitle), ticks: { color: ink, font: { size: ex ? 14 : 11 }, callback: fmt }, grid: { color: grid, borderDash: [3, 4] }, border: { display: false }, beginAtZero: true },
      },
    },
  };
}

let live = [];
export const destroyCharts = () => { live.forEach((c) => c.destroy()); live = []; };

/** PNG de alta resolución (3200×1800) con título, filtros, ejes rotulados, valores y logo. */
export async function exportPng(s, filename) {
  const img = new Image(); img.src = logoDataUrl('#000'); await img.decode();
  const cv = document.createElement('canvas'); cv.width = 1600; cv.height = 900;
  const ch = new Chart(cv, config(s, true, img));
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
