// nozoom.js — keep an installed PWA at 100%: no pinch zoom, no double-tap zoom,
// no Ctrl/⌘ + wheel, trackpad pinch or Ctrl/⌘ + = - 0.
//
//   import { preventZoom } from './nozoom.js';
//   preventZoom();                            // only when running as an installed app
//   preventZoom({ standaloneOnly: false });   // everywhere
//
// Returns a function that undoes everything.
//
// How each path is closed:
//   viewport meta     maximum-scale=1, user-scalable=no   (Android, desktop; iOS ignores it)
//   touch-action      pan-x pan-y on <html>: panning stays, pinch and double-tap zoom go
//   gesture* events   WebKit's own pinch events, cancelled (iOS / macOS Safari)
//   multi-touch move  a two-finger touchmove is cancelled (older iOS fallback)
//   wheel + ctrlKey   Ctrl/⌘ + wheel, and trackpad pinch, which browsers report that way
//   keydown           Ctrl/⌘ with + = - _ 0
//
// Inputs need font-size ≥ 16px, or iOS zooms in on focus regardless.

const STANDALONE = '(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui), (display-mode: window-controls-overlay)';
const ZOOM_KEYS = new Set(['+', '=', '-', '_', '0']);

export function isStandalone() {
  return matchMedia(STANDALONE).matches || navigator.standalone === true;
}

export function preventZoom({ standaloneOnly = true } = {}) {
  if (standaloneOnly && !isStandalone()) return () => {};

  const root = document.documentElement;
  let meta = document.querySelector('meta[name="viewport"]');
  const created = !meta;
  if (created) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    document.head.append(meta);
  }
  const oldContent = meta.content;
  const fit = /viewport-fit\s*=\s*cover/.test(oldContent) ? ', viewport-fit=cover' : '';
  meta.content = `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no${fit}`;
  const oldTouch = root.style.touchAction;
  root.style.touchAction = 'pan-x pan-y';

  const cancel = (e) => { if (e.cancelable) e.preventDefault(); };
  const listeners = [
    [document, 'gesturestart', cancel],
    [document, 'gesturechange', cancel],
    [document, 'gestureend', cancel],
    [document, 'touchmove', (e) => { if (e.touches.length > 1) cancel(e); }, { passive: false }],
    [window, 'wheel', (e) => { if (e.ctrlKey) cancel(e); }, { passive: false }],
    [window, 'keydown', (e) => { if ((e.ctrlKey || e.metaKey) && ZOOM_KEYS.has(e.key)) cancel(e); }],
  ];
  for (const [t, type, fn, o] of listeners) t.addEventListener(type, fn, o);

  return () => {
    for (const [t, type, fn, o] of listeners) t.removeEventListener(type, fn, o);
    root.style.touchAction = oldTouch;
    if (created) meta.remove();
    else meta.content = oldContent;
  };
}
