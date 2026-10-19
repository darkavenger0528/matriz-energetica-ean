import * as st from './static-api.js';

const BASE = import.meta.env.VITE_API_BASE ?? '/api/v1';
// VITE_STATIC=true → demo sin backend (GitHub Pages): los datos vienen de /data/data.json
const STATIC = import.meta.env.VITE_STATIC === 'true';

export function qs(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === '') continue;
    (Array.isArray(v) ? v : [v]).forEach((x) => p.append(k, x));
  }
  return p.toString();
}
export const url = (path, params = {}) => (STATIC ? st.url(path, params) : `${BASE}${path}?${qs(params)}`);
export async function get(path, params = {}) {
  if (STATIC) return st.get(path, params);
  const r = await fetch(`${BASE}${path}?${qs(params)}`);
  if (!r.ok) throw new Error(`API ${r.status} en ${path}`);
  return r.json();
}
