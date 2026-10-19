import './style.css';
import * as matriz from './matriz.js';
import * as ean from './ean.js';

const views = { colombia: matriz, ean };
const view = document.getElementById('view');
let current = 'colombia';

async function go(name) {
  current = name;
  document.querySelectorAll('#nav .tab').forEach((b) => b.classList.toggle('on', b.dataset.view === name));
  view.onclick = view.onchange = null;
  view.innerHTML = '';
  await views[name].mount(view);
}

function setTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem('theme', t);
  document.querySelectorAll('#theme button').forEach((b) => b.classList.toggle('on', b.dataset.theme === t));
  views[current].redraw?.(); // los gráficos leen colores del tema
}

document.getElementById('nav').onclick = (e) => e.target.dataset.view && go(e.target.dataset.view);
document.getElementById('theme').onclick = (e) => e.target.dataset.theme && setTheme(e.target.dataset.theme);

setTheme(localStorage.getItem('theme') === 'night' ? 'night' : 'day'); // por defecto: día, sin auto-detección del SO
go('colombia');
