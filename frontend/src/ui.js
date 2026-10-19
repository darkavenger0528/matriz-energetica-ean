import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

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

/** Alterna un valor en un arreglo (mínimo 1 seleccionado si `min`). */
export function toggle(arr, v, min = 1) {
  if (arr.includes(v)) return arr.length > min ? arr.filter((x) => x !== v) : arr;
  return [...arr, v];
}

let live = [];
export const destroyCharts = () => { live.forEach((c) => c.destroy()); live = []; };

/**
 * kind: bar | line | pie | doughnut | tabla
 * datasets: [{label, data, color?, colors?}]  (colors = un color por punto)
 */
export function card(parent, { title, kind, labels, datasets, unit = '', csv = null, filename = 'grafica', wide = false }) {
  const el = document.createElement('section');
  el.className = 'card' + (wide ? ' wide' : '');
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
  const round = kind === 'pie' || kind === 'doughnut';
  const canvas = document.createElement('canvas');
  body.append(canvas);
  const muted = css('--inkMuted'), line = css('--line');
  const chart = new Chart(canvas, {
    type: kind,
    data: {
      labels,
      datasets: datasets.map((d) => ({
        label: d.label, data: d.data,
        backgroundColor: kind === 'line' ? d.color : d.colors || d.color, borderColor: kind === 'line' ? d.color : round ? css('--panel') : undefined,
        borderWidth: kind === 'line' ? 2.5 : round ? 2 : 0, tension: 0.3, pointRadius: kind === 'line' ? 2 : 0, borderRadius: kind === 'bar' ? 4 : 0,
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: round || datasets.length > 1, labels: { color: muted, boxWidth: 12 } },
        tooltip: { callbacks: { label: (c) => ` ${c.dataset.label ? c.dataset.label + ': ' : ''}${fmt(c.parsed.y ?? c.parsed)} ${unit}` } },
      },
      scales: round ? {} : { x: { ticks: { color: muted }, grid: { display: false } }, y: { ticks: { color: muted, callback: fmt }, grid: { color: line } } },
    },
  });
  live.push(chart);
  el.querySelector('.png').onclick = () => {
    const c = chart.canvas, t = document.createElement('canvas');
    t.width = c.width; t.height = c.height;
    const x = t.getContext('2d');
    x.fillStyle = css('--panel'); x.fillRect(0, 0, t.width, t.height); x.drawImage(c, 0, 0);
    Object.assign(document.createElement('a'), { href: t.toDataURL('image/png'), download: `${filename}.png` }).click();
  };
  return el;
}
