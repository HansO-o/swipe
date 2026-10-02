// sw.js — offline-first app shell.
//
//   install   cache the whole shell under a versioned name; the new worker then waits
//   activate  drop the caches of older versions and take over open pages
//   fetch     navigations get the cached shell (hash routes never reach the server);
//             other same-origin GETs come from cache, else network (and get cached)
//
// A new version waits until the page says 'skipWaiting' (its "update" toast), so a page
// never runs half old, half new code. VERSION is rewritten by build.mjs on every build.

const VERSION = 'b8e6d99f89';
const CACHE = `swipe-pwa-${VERSION}`;
const SHELL = [
  './',
  './app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the HTTP cache, so the shell is really this version's.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('swipe-pwa-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
  else if (e.data === 'version') e.ports[0]?.postMessage(VERSION);
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') return e.respondWith(shell(req));
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') (await caches.open(CACHE)).put(req, res.clone());
    return res;
  })());
});

async function shell(req) {
  const hit = await caches.match('./');
  if (!hit) return fetch(req);
  // A redirected response may not answer a navigation; copy it into a fresh one.
  return hit.redirected ? new Response(hit.body, { status: hit.status, headers: hit.headers }) : hit;
}
