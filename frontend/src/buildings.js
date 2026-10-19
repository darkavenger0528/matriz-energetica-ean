// Vectores representativos (no literales) de los edificios: Legacy = grande y descolorido, Nogal = pequeño y verde.
// Los colores salen de variables CSS (--lg-*, --ng-*) para que respondan al tema.
const legacy = () => {
  let f = '';
  for (let r = 0; r < 10; r++) for (let c = 0; c < 4; c++) {
    const x = c * 8.5, y = 7 + r * 5.6, up = (r + c) % 2;
    f += `<polygon points="${x},${y + 5.6} ${x + 8.5},${y + 5.6} ${up ? x + 8.5 : x},${y}" fill="var(--lg-facet${up ? '' : '2'})" opacity="${up ? .8 : .55}"/>`;
  }
  return `<g class="b-legacy"><rect x="11" y="1" width="12" height="6" rx="1.5" fill="var(--lg-body)"/>
    <rect x="0" y="5" width="34" height="61" rx="2" fill="var(--lg-body)"/>${`<g transform="translate(0,0)">${f}</g>`}
    <rect x="-4" y="63" width="42" height="5" rx="1.5" fill="var(--lg-base)"/></g>`;
};
const nogal = () => {
  let l = '';
  for (let b = 0; b < 4; b++) for (let i = 0; i < 12; i++)
    l += `<rect x="${2 + i * 3.1}" y="${35 + b * 7}" width="1.5" height="6" rx=".5" fill="var(--ng-louver)" opacity="${i % 2 ? .55 : .9}"/>`;
  return `<g class="b-nogal"><rect x="0" y="33" width="40" height="31" rx="2" fill="var(--ng-body)"/>${l}
    <rect x="34" y="39" width="8" height="8" rx="1.5" fill="var(--ng-box)"/><rect x="34" y="50" width="8" height="8" rx="1.5" fill="var(--ng-box)"/>
    <rect x="-2" y="62" width="46" height="4" rx="1.5" fill="var(--ng-base)"/></g>`;
};
const wrap = (vb, inner, label) => `<svg class="bld" viewBox="${vb}" role="img" aria-label="${label}">${inner}</svg>`;

export function buildingSvg(kind) {
  if (kind === 'legacy') return wrap('-6 0 48 72', legacy(), 'Edificio Legacy');
  if (kind === 'nogal') return wrap('-4 0 50 72', nogal(), 'Edificio Nogal');
  const both = `<g transform="translate(6,0)">${legacy()}</g><g transform="translate(50,0)">${nogal()}</g>`;
  const sep = kind === 'compare' ? '<line x1="46" y1="14" x2="46" y2="64" stroke="var(--ink-3)" stroke-width="1" stroke-dasharray="2 3"/>' : '';
  return wrap('0 0 96 72', both + sep, kind === 'compare' ? 'Comparar edificios' : 'Ambos edificios');
}
