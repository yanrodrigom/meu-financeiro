import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';

// Gera o service worker com a lista de arquivos do build (precache do app shell).
function serviceWorkerPlugin(): Plugin {
  return {
    name: 'mf-service-worker',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const extra = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/favicon.svg'];
      const list = Array.from(new Set([...extra, ...files.map((f) => f)]));
      const version = Date.now().toString(36);
      const src = `/* Meu Financeiro — service worker gerado no build */
const CACHE = 'mf-shell-${version}';
const ASSETS = ${JSON.stringify(list)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('mf-shell-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('index.html', copy)); return res; }).catch(() => caches.match('index.html').then((r) => r || caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate && c.navigate('./#/contas'); return c.focus(); } }
    return self.clients.openWindow('./#/contas');
  }));
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: src });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [preact(), serviceWorkerPlugin()],
  build: { target: 'es2020', sourcemap: false },
  test: { environment: 'node', include: ['tests/unit/**/*.test.ts'] },
} as any);
