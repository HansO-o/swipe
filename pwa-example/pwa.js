// pwa.js — everything the page knows about being a PWA, as one small store:
// install prompt, display mode, online state, the service worker and its pending update.
//
//   const pwa = usePwa();  // { online, standalone, canInstall, ios, sw, update, version }
//   install(); applyUpdate(); checkForUpdate();
//
// Import it early: 'beforeinstallprompt' fires once, soon after load.

import { useSyncExternalStore } from 'react';
import { isStandalone } from '../nozoom.js';

const subs = new Set();
let promptEvent = null; // the deferred beforeinstallprompt
let waiting = null; // a new service worker, installed and waiting
let reloading = false;

const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let state = {
  online: navigator.onLine,
  standalone: isStandalone(),
  canInstall: false, // the browser offered an install prompt
  ios, // no prompt on iOS: Share → Add to Home Screen
  sw: 'serviceWorker' in navigator ? 'registering' : 'unsupported',
  update: false, // a new version is waiting
  installed: false, // installed during this visit
};

function set(patch) {
  state = { ...state, ...patch };
  for (const fn of subs) fn();
}

export function usePwa() {
  return useSyncExternalStore((fn) => (subs.add(fn), () => subs.delete(fn)), () => state);
}

// ---------- install ----------

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // keep it for our own button instead of the mini-infobar
  promptEvent = e;
  set({ canInstall: true });
});

addEventListener('appinstalled', () => {
  promptEvent = null;
  set({ canInstall: false, installed: true });
});

export async function install() {
  if (!promptEvent) return false;
  const e = promptEvent;
  promptEvent = null;
  set({ canInstall: false });
  e.prompt();
  const { outcome } = await e.userChoice;
  return outcome === 'accepted';
}

// ---------- display mode, network ----------

matchMedia('(display-mode: standalone)').addEventListener('change', () => set({ standalone: isStandalone() }));
addEventListener('online', () => set({ online: true }));
addEventListener('offline', () => set({ online: false }));

// ---------- service worker ----------

let reg = null;

export async function registerServiceWorker(url = './sw.js') {
  if (!('serviceWorker' in navigator)) return;
  if (!isSecureContext) return set({ sw: 'insecure' }); // https or localhost only
  try {
    reg = await navigator.serviceWorker.register(url, { updateViaCache: 'none' });
  } catch (err) {
    console.warn('service worker:', err);
    return set({ sw: 'error' });
  }
  const track = (w) => {
    if (!w) return;
    const check = () => {
      // Installed while a page is already controlled: that is an update, not a first install.
      if (w.state === 'installed' && navigator.serviceWorker.controller) {
        waiting = w;
        set({ update: true });
      }
      if (w.state === 'activated') set({ sw: 'active' });
    };
    w.addEventListener('statechange', check);
    check();
  };
  set({ sw: reg.active ? 'active' : 'installing' });
  track(reg.waiting);
  track(reg.installing);
  reg.addEventListener('updatefound', () => track(reg.installing));

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) location.reload(); // the stack is in sessionStorage: it survives this
  });
  // Look for a new version whenever the app comes back to the foreground, and hourly.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
}

export async function checkForUpdate() {
  if (!reg) return false;
  await reg.update();
  return !!(reg.installing || reg.waiting);
}

export function applyUpdate() {
  if (!waiting) return;
  reloading = true;
  waiting.postMessage('skipWaiting');
}

/** Cached shell: [{ name, count }] for every cache this origin holds. */
export async function cacheInfo() {
  if (!('caches' in self)) return [];
  const out = [];
  for (const name of await caches.keys()) out.push({ name, count: (await (await caches.open(name)).keys()).length });
  return out;
}

/** Forget the service worker and its caches, then load fresh from the network. */
export async function resetApp() {
  for (const r of (await navigator.serviceWorker?.getRegistrations()) ?? []) await r.unregister();
  if ('caches' in self) for (const k of await caches.keys()) await caches.delete(k);
  location.reload();
}
