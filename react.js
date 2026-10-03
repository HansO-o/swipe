// react.js — React bindings for history.js: <SwipeRouter>, <Link> and a few hooks.
//
//   <SwipeRouter routes={{ '/': Home, '/item/:id': Item, '*': NotFound }} hash />
//
// Every page in the stack stays mounted (state and scroll survive while it is covered).
// Pages move by direct style writes on each animation frame, never by re-rendering;
// React renders only when the stack itself changes.
//
// A page is <section class="swipe-page"> → <div class="swipe-scroll"> (its own scroller)
// + <div class="swipe-dim"> (shade while covered). Each frame a page gets its position
//   d: 0 = on screen, +1 = gone off to the right, -1 = covered by the page above.

import {
  createContext, createElement as h, memo, useContext, useLayoutEffect, useMemo, useRef, useState,
  useSyncExternalStore,
} from 'react';
import { createSwipeHistory } from './history.js';

const RouterCtx = createContext(null);
const PageCtx = createContext(null);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const noSub = () => () => {};
const noSnap = () => null;

const STAGE_STYLE = { position: 'relative', overflow: 'hidden', width: '100%', height: '100%', touchAction: 'pan-y' };
const PAGE_STYLE = {
  position: 'absolute', inset: 0, overflow: 'hidden', background: 'var(--swipe-page-bg, Canvas)', willChange: 'transform',
};
const SCROLL_STYLE = {
  position: 'absolute', inset: 0, overflowX: 'hidden', overflowY: 'auto', overscrollBehavior: 'contain', touchAction: 'pan-y',
};
const DIM_STYLE = { position: 'absolute', inset: 0, background: '#000', opacity: 0, pointerEvents: 'none' };

/** Default transition, iOS-like: the top page slides fully, the one below moves 30% and darkens. */
export function slide({ el, dim }, d) {
  el.style.transform = d === 0 ? '' : `translate3d(${(d > 0 ? d * 100 : d * 30).toFixed(3)}%,0,0)`;
  el.style.visibility = d <= -1 || d >= 1 ? 'hidden' : '';
  el.style.boxShadow = d > 0 && d < 1 ? '0 0 40px rgba(0,0,0,0.22)' : '';
  dim.style.opacity = d < 0 ? (-d * 0.2).toFixed(3) : '0';
}

/** routes: { '/': C, '/item/:id': C, '*': C }, matched in order. */
export function matchRoute(routes, path) {
  const [pathname, search = ''] = path.split('?');
  const query = Object.fromEntries(new URLSearchParams(search));
  const segs = pathname.split('/').filter(Boolean);
  for (const [pattern, component] of Object.entries(routes)) {
    if (pattern === '*') continue;
    const ps = pattern.split('/').filter(Boolean);
    if (ps.length !== segs.length) continue;
    const params = {};
    const ok = ps.every((p, i) => {
      if (p[0] === ':') { params[p.slice(1)] = decodeURIComponent(segs[i]); return true; }
      return p === segs[i];
    });
    if (ok) return { component, params, query, pattern };
  }
  return routes['*'] ? { component: routes['*'], params: {}, query, pattern: '*' } : null;
}

/**
 * props: routes, hash (use #/path URLs: works on any static host), base (path prefix when not
 * hash), urlOnly (one history entry: the URL follows the page, the back button leaves the app),
 * transition(page, d, frame), swipe (swipe.js options), className, style.
 * children render on top of the stage (tab bars, overlays) and can use the hooks.
 */
export function SwipeRouter({ routes, hash = false, base = '', urlOnly = false, transition = slide, swipe, className, style, children }) {
  const stage = useRef(null);
  const [ctx, setCtx] = useState(null);
  const trans = useRef(transition);
  trans.current = transition;

  useLayoutEffect(() => {
    const nav = createSwipeHistory(stage.current, { hash, base, urlOnly, swipe });
    const pages = new Map(); // key → { el, scroll, dim, d, inert }
    const pageFns = new Map(); // key → Set(fn(d, frame))
    const frameFns = new Set();

    const paint = (f) => {
      const { entries, index } = nav;
      const s = index - f.p / 100;
      const dest = Math.round(index - f.intent / 100); // only the page we are heading to takes input
      entries.forEach((e, i) => {
        const pg = pages.get(e.key);
        if (!pg) return;
        const d = clamp(i - s, -1, 1);
        if (d !== pg.d) { pg.d = d; trans.current(pg, d, f); }
        const inert = i !== dest;
        if (inert !== pg.inert) { pg.inert = inert; pg.el.inert = inert; }
        const fns = pageFns.get(e.key);
        if (fns) for (const fn of fns) fn(d, f);
      });
      for (const fn of frameFns) fn(f);
    };
    const repaint = () => paint(nav.swipe.snapshot());
    const off = nav.swipe.subscribe(paint);

    setCtx({
      nav,
      mount(key, parts) {
        pages.set(key, { ...parts, d: NaN, inert: null });
        repaint(); // place it before the browser paints: no flash
        return () => pages.delete(key);
      },
      onPageFrame(key, fn) {
        let set = pageFns.get(key);
        if (!set) pageFns.set(key, (set = new Set()));
        set.add(fn);
        repaint();
        return () => set.delete(fn);
      },
      onFrame(fn) {
        frameFns.add(fn);
        fn(nav.swipe.snapshot());
        return () => frameFns.delete(fn);
      },
    });
    return () => {
      off();
      nav.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const snap = useSyncExternalStore(ctx ? ctx.nav.subscribe : noSub, ctx ? ctx.nav.getSnapshot : noSnap);
  return h(
    RouterCtx.Provider,
    { value: ctx },
    h(
      'div',
      { ref: stage, className: className ? `swipe-stage ${className}` : 'swipe-stage', style: { ...STAGE_STYLE, ...style } },
      snap && snap.entries.map((e) => h(Page, { key: e.key, entry: e, routes, ctx })),
    ),
    ctx && children,
  );
}

const Page = memo(function Page({ entry, routes, ctx }) {
  const el = useRef(null);
  const scroll = useRef(null);
  const dim = useRef(null);
  const match = useMemo(() => matchRoute(routes, entry.path), [routes, entry.path]);
  useLayoutEffect(
    () => ctx.mount(entry.key, { el: el.current, scroll: scroll.current, dim: dim.current }),
    [ctx, entry.key],
  );
  const page = useMemo(() => ({ ...ctx, entry, match }), [ctx, entry, match]);
  const C = match?.component;
  return h(
    'section',
    { ref: el, className: 'swipe-page', style: PAGE_STYLE },
    h(
      'div',
      { ref: scroll, className: 'swipe-scroll', style: SCROLL_STYLE },
      h(PageCtx.Provider, { value: page }, C ? h(C, { params: match.params, query: match.query, path: entry.path }) : null),
    ),
    h('div', { ref: dim, className: 'swipe-dim', style: DIM_STYLE, 'aria-hidden': 'true' }),
  );
});

/** push(path), replace(path), back(n, { force }), forward(n), href(path), swipe, on(type, fn). */
export function useNavigator() {
  return useContext(RouterCtx)?.nav ?? null;
}

/** The page this component is rendered in: { path, params, query, key }. */
export function useRoute() {
  const p = useContext(PageCtx);
  return { path: p.entry.path, key: p.entry.key, params: p.match?.params ?? {}, query: p.match?.query ?? {} };
}

/** fn(d, frame) every frame for this component's page (d: -1 covered … 0 on screen … +1 gone). */
export function usePageFrame(fn) {
  const p = useContext(PageCtx);
  const ref = useRef(fn);
  ref.current = fn;
  useLayoutEffect(() => p.onPageFrame(p.entry.key, (d, f) => ref.current(d, f)), [p.onPageFrame, p.entry.key]);
}

/** fn(frame) every frame: for things outside pages, such as a tab bar. */
export function useSwipeFrame(fn) {
  const c = useContext(RouterCtx);
  const ref = useRef(fn);
  ref.current = fn;
  useLayoutEffect(() => c?.onFrame((f) => ref.current(f)), [c]);
}

/** While `when` is true this page cannot be left by swipe, back() or the browser's back button; onBlocked() is called instead. */
export function useSwipeBlock(when, onBlocked) {
  const p = useContext(PageCtx);
  const ref = useRef(onBlocked);
  ref.current = onBlocked;
  useLayoutEffect(() => (when ? p.nav.block(p.entry.key) : undefined), [when, p.nav, p.entry.key]);
  useLayoutEffect(() => p.nav.on('blocked', (e) => { if (e?.key === p.entry.key) ref.current?.(); }), [p.nav, p.entry.key]);
}

/** <a> that pushes (or replaces) with the swipe animation; modified clicks keep the browser's behaviour. */
export function Link({ to, replace = false, onClick, ...rest }) {
  const c = useContext(RouterCtx);
  return h('a', {
    ...rest,
    href: c ? c.nav.href(to) : to,
    onClick(e) {
      onClick?.(e);
      if (!c || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target) return;
      e.preventDefault();
      if (replace) c.nav.replace(to);
      else c.nav.push(to);
    },
  });
}
