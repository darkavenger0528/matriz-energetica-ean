import './style.css';
import * as matriz from './matriz.js';
import * as ean from './ean.js';
import { logoSvg } from './logo.js';
import { initSeg } from './ui.js';

const views = { colombia: matriz, ean };
const HERO = {
  colombia: ['Matriz energética de Colombia', 'Potencial solar, eólico y geotérmico por territorio, tipo de potencial y periodo.'],
  ean: ['Energía en la universidad', 'Consumo, generación solar y cargas de los edificios Legacy y Nogal.'],
};
const $ = (id) => document.getElementById(id);
let current = 'colombia';

async function go(name) {
  current = name;
  $('nav').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.view === name));
  [$('h1').textContent, $('lead').textContent] = HERO[name];
  $('view').onclick = $('view').onchange = null;
  $('view').innerHTML = '';
  initSeg();
  await views[name].mount($('view'));
  initSeg($('view'));
}

function setTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem('theme', t);
  $('theme').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.theme === t));
  initSeg();
  views[current].redraw?.(); // los gráficos leen colores del tema
}

// Logo (vector) y pie de página
$('logo').innerHTML = logoSvg();
$('foot').innerHTML = `<a class="logo" href="https://www.universidadean.edu.co" target="_blank" rel="noopener">${logoSvg()}</a>
  <div><p>© ${new Date().getFullYear()} Universidad EAN. Todos los derechos reservados.</p>
  <p>Los datos mostrados son de demostración. El nombre, el logo y los símbolos de la Universidad EAN son de su propiedad.</p>
  <p><a href="https://www.universidadean.edu.co" target="_blank" rel="noopener">universidadean.edu.co</a></p></div>
  <span class="sello">Vigilada Mineducación</span>`;

$('nav').onclick = (e) => e.target.dataset.view && go(e.target.dataset.view);
$('theme').onclick = (e) => { const b = e.target.closest('button'); b && setTheme(b.dataset.theme); };

// Interacción según dónde estés: reflejo en tarjetas, puntos de la malla que se encienden y barra que se compacta al desplazarte
let raf = 0;
addEventListener('pointermove', (e) => {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    document.body.style.setProperty('--cx', e.clientX + 'px');
    document.body.style.setProperty('--cy', e.clientY + 'px');
    const g = e.target.closest?.('.glass');
    if (g) { const r = g.getBoundingClientRect(); g.style.setProperty('--mx', e.clientX - r.left + 'px'); g.style.setProperty('--my', e.clientY - r.top + 'px'); }
  });
}, { passive: true });
addEventListener('scroll', () => $('bar').classList.toggle('scrolled', scrollY > 24), { passive: true });
addEventListener('resize', () => initSeg());
document.fonts?.ready.then(() => initSeg());

setTheme(localStorage.getItem('theme') === 'night' ? 'night' : 'day'); // por defecto: día, sin auto-detección del SO
go('colombia');
