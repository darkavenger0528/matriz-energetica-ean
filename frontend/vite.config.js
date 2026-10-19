export default {
  base: process.env.VITE_BASE || '/', // en GitHub Pages: /<nombre-del-repo>/
  server: { port: 5173, proxy: { '/api': 'http://localhost:8000' } },
};
