// swipe.js — a page swipe as one number.
//
// The whole gesture is a single value p: 100 = one page, positive = back (finger moving
// right), negative = forward. At rest p = 0. The finger and a spring write p; your UI only
// reads it: every frame through subscribe(), or at any instant through swipe.p.
//
//   const swipe = createSwipe(el, {
//     limits: () => ({ back: index, forward: pages.length - 1 - index }), // null: no gesture
//     onCommit: (n) => { index -= n; },  // p came to rest at n × 100 and is now 0 again
//   });
//   swipe.subscribe(({ p }) => { top.style.transform = `translateX(${p}%)`; });
//
// Rules:
//   - A release lands on the allowed page nearest to where the flick would coast to.
//   - One swipe moves at most one page. Catching a flight and swiping again chains pages.
//   - From the first touch until rest, limits are frozen and swipe.busy is true:
//     queue your own navigation until onCommit.
//   - A touch either scrolls or swipes, never both. Whichever starts first owns it:
//     the moment a touch swipe locks, every scrollable box under the finger is switched to
//     overflow: hidden (and touchmove is cancelled) until the finger lifts; if one of them
//     scrolls anyway, or scrolled before the lock, the swipe yields at once: p snaps back to
//     its starting point and the rest of the touch is left to scrolling.
//
// States: idle → pending (finger down) → tracking (horizontal) → settling (flight) → idle.
// A press during a flight catches it ('held') until the finger picks a direction.
// A release flies on a spring that inherits the finger's speed; go() and enter(), which no
// finger drives, fly along a cubic-bezier curve instead (opts.curve, opts.duration).
// A mouse drag counts as a swipe too.

const PAGE = 100;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export const defaults = {
  response: 0.42, // spring period (s)
  damping: 0.92, // spring damping ratio; < 1 overshoots
  decel: 0.998, // per-ms deceleration used to project where a flick coasts to
  accelTau: 20, // ms the release velocity is extrapolated along the measured acceleration
  rubber: 0.55, // resistance past the limits (iOS: 0.55)
  intentOn: 50, // % of a page before `intent` switches to the next page…
  intentOff: 30, // …and how far back the finger must come to switch it back
  edge: 0, // px: only start within this distance of the screen edge; 0 = anywhere
  ignore: '[data-no-swipe], input, textarea, select, [contenteditable]', // never start on these
  timeScale: 1, // slow motion (< 1) for inspecting flights
  curve: [0.32, 0.72, 0, 1], // cubic-bezier for go() / enter(); null = use the spring
  duration: 460, // ms for one page along `curve` (longer trips scale by √pages)
};

export function createSwipe(el, opts) {
  return new Swipe(el, opts);
}

// Closed-form damped spring: exact position and velocity at any time, so p can be read
// between frames and a caught flight hands over its true velocity.
class Spring {
  constructor(from, to, v0, response, damping, t0, scale) {
    this.to = to;
    this.u0 = from - to;
    this.v0 = v0;
    this.t0 = t0;
    this.scale = scale;
    this.w0 = (2 * Math.PI) / Math.max(0.05, response);
    this.z = Math.max(0.05, damping);
    this.v = v0;
    this.done = false;
  }

  at(now) {
    const t = Math.max(0, ((now - this.t0) / 1000) * this.scale);
    const { w0, z, u0, v0 } = this;
    let u, v;
    if (Math.abs(z - 1) < 1e-3) {
      const B = v0 + w0 * u0;
      const e = Math.exp(-w0 * t);
      u = (u0 + B * t) * e;
      v = (B - w0 * (u0 + B * t)) * e;
    } else if (z < 1) {
      const wd = w0 * Math.sqrt(1 - z * z);
      const e = Math.exp(-z * w0 * t);
      const B = (v0 + z * w0 * u0) / wd;
      const c = Math.cos(wd * t);
      const s = Math.sin(wd * t);
      u = e * (u0 * c + B * s);
      v = e * ((B * wd - z * w0 * u0) * c - (u0 * wd + z * w0 * B) * s);
    } else {
      const q = Math.sqrt(z * z - 1);
      const r1 = -w0 * (z - q);
      const r2 = -w0 * (z + q);
      const C2 = (v0 - r1 * u0) / (r2 - r1);
      const C1 = u0 - C2;
      u = C1 * Math.exp(r1 * t) + C2 * Math.exp(r2 * t);
      v = C1 * r1 * Math.exp(r1 * t) + C2 * r2 * Math.exp(r2 * t);
    }
    this.v = v;
    this.done = Math.abs(u) < 0.01 && Math.abs(v) < 0.5;
    return this.to + u;
  }
}

// Cubic-bezier timing curve through (0,0) and (1,1), as in CSS. A tween answers the same
// questions as a spring (position, velocity, done) so either can fly a page.
const bez = (a, b, s) => 3 * a * (1 - s) ** 2 * s + 3 * b * (1 - s) * s * s + s ** 3;
const dbez = (a, b, s) => 3 * a * (1 - s) ** 2 + 6 * (b - a) * (1 - s) * s + 3 * (1 - b) * s * s;

function solveBez(x1, x2, x) {
  let s = x;
  for (let i = 0; i < 8; i++) {
    const err = bez(x1, x2, s) - x;
    if (Math.abs(err) < 1e-6) return s;
    const d = dbez(x1, x2, s);
    if (Math.abs(d) < 1e-6) break;
    s = clamp(s - err / d, 0, 1);
  }
  let lo = 0;
  let hi = 1;
  s = x;
  for (let i = 0; i < 30; i++) {
    const v = bez(x1, x2, s);
    if (Math.abs(v - x) < 1e-6) break;
    if (v < x) lo = s; else hi = s;
    s = (lo + hi) / 2;
  }
  return s;
}

class Tween {
  constructor(from, to, curve, ms, t0, scale) {
    this.from = from;
    this.to = to;
    this.c = curve;
    this.T = Math.max(1, ms) / 1000;
    this.t0 = t0;
    this.scale = scale;
    this.v = 0;
    this.done = false;
  }

  at(now) {
    const t = Math.max(0, ((now - this.t0) / 1000) * this.scale);
    if (t >= this.T) {
      this.v = 0;
      this.done = true;
      return this.to;
    }
    const [x1, y1, x2, y2] = this.c;
    const s = solveBez(x1, x2, t / this.T);
    const dx = dbez(x1, x2, s);
    this.v = dx > 1e-6 ? ((this.to - this.from) * dbez(y1, y2, s)) / dx / this.T : 0;
    this.done = false;
    return this.from + (this.to - this.from) * bez(y1, y2, s);
  }
}

// Every scrollable box from `node` up to the page, with its scroll position: the boxes a touch
// starting on `node` could scroll.
function scrollers(node) {
  const out = new Map();
  for (let n = node; n && n.nodeType === 1; n = n.parentElement) {
    if (n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1) out.set(n, [n.scrollTop, n.scrollLeft]);
  }
  const root = document.scrollingElement;
  if (root && !out.has(root)) out.set(root, [root.scrollTop, root.scrollLeft]);
  return out;
}

class Swipe {
  #el;
  #state = 'idle';
  #busy = false;
  #p = 0;
  #base = 0;
  #target = null;
  #intent = 0;
  #range = [0, 0];
  #flight = null;
  #samples = [];
  #ptr = null;
  #suppress = false;
  #subs = new Set();
  #on = {};
  #raf = 0;
  #detach;
  #frameSnap = {};

  constructor(el, opts = {}) {
    this.#el = el;
    // Live: change any value at any time (e.g. swipe.opts.response = 0.5).
    this.opts = { ...defaults, limits: () => ({ back: 1, forward: 0 }), onCommit: null, width: null, ...opts };
    const listeners = [
      [el, 'pointerdown', (e) => this.#down(e)],
      [window, 'pointermove', (e) => this.#move(e), { passive: false }],
      [window, 'pointerup', (e) => this.#up(e, false)],
      [window, 'pointercancel', (e) => this.#up(e, true)],
      // A drag that ends on a button must not press it; neither may a tap that caught a flight.
      [window, 'click', (e) => this.#click(e), true],
      // Mouse drags: no native drag of links and images, no text selection while swiping.
      [el, 'dragstart', (e) => { if (this.#ptr) e.preventDefault(); }],
      [document, 'selectstart', (e) => { if (this.#ptr?.locked) e.preventDefault(); }],
      // Scroll vs swipe: see #touchmove and #scrolled.
      [el, 'touchmove', (e) => this.#touchmove(e), { passive: false }],
      [document, 'scroll', (e) => this.#scrolled(e), { capture: true, passive: true }],
    ];
    for (const [t, type, fn, o] of listeners) t.addEventListener(type, fn, o);
    this.#detach = () => { for (const [t, type, fn, o] of listeners) t.removeEventListener(type, fn, o); };
    // Horizontal pans must reach us instead of the browser.
    if (getComputedStyle(el).touchAction === 'auto') el.style.touchAction = 'pan-y';
  }

  // ---------- reading ----------

  /** Exact p at this instant; during a flight it is computed from the spring, not the last frame. */
  get p() {
    return this.#state === 'settling' ? this.#flight.at(performance.now()) : this.#p;
  }

  /** p units per millisecond. */
  get velocity() {
    return this.#read(performance.now(), {}).v;
  }

  get state() { return this.#state; }

  /** True from the first touch until p rests again. Limits are frozen meanwhile. */
  get busy() { return this.#busy; }

  /** A fresh copy of what subscribers receive. */
  snapshot() {
    return this.#read(performance.now(), {});
  }

  /**
   * fn(frame) runs once per animation frame while anything moves; every subscriber in a frame
   * gets the same frame object. Return true to ask for another frame (your own animation).
   */
  subscribe(fn) {
    this.#subs.add(fn);
    this.wake();
    return () => this.#subs.delete(fn);
  }

  /** 'start' (a drag locked horizontally), 'release' (finger lifted), 'commit' (came to rest). */
  on(type, fn) {
    (this.#on[type] ||= new Set()).add(fn);
    return () => this.#on[type].delete(fn);
  }

  /** Ask for a frame, e.g. when your own animation starts. */
  wake() {
    if (!this.#raf) this.#raf = requestAnimationFrame(this.#frame);
  }

  // ---------- driving ----------

  /**
   * Animate n pages (n > 0 back, n < 0 forward), ignoring limits: you know your stack.
   * During a flight it adds to the flight's target. Returns false while a finger is down.
   * curve: a cubic-bezier [x1, y1, x2, y2], or null for the spring. Default: opts.curve.
   */
  go(n, { curve = this.opts.curve } = {}) {
    if (!n) return false;
    if (this.#state === 'idle') {
      this.#begin(n * PAGE);
      this.#base = 0;
      this.#settle(n * PAGE, 0, curve);
      return true;
    }
    if (this.#state === 'settling') {
      this.#p = this.#flight.at(performance.now());
      const t = this.#target + n * PAGE;
      this.#range = [Math.min(this.#range[0], t), Math.max(this.#range[1], t)];
      this.#base = t;
      this.#settle(t, this.#flight.v, curve);
      return true;
    }
    return false;
  }

  /** You just added n pages on top of the current one: slide in from p = n × 100 to 0. */
  enter(n = 1, { curve = this.opts.curve } = {}) {
    if (this.#busy) return false;
    if (this.#state === 'pending') this.#abandon();
    this.#begin(n * PAGE);
    this.#base = 0;
    this.#p = n * PAGE;
    this.#settle(0, 0, curve);
    return true;
  }

  destroy() {
    this.#release(this.#ptr);
    this.#detach();
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
    this.#subs.clear();
  }

  // ---------- pointer input ----------

  #down(e) {
    if (this.#ptr || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const now = e.timeStamp;
    // The spring's tail is sub-pixel but long. A press there is a tap on a page that already
    // looks settled: land now and handle the press as a fresh one.
    if (this.#state === 'settling') {
      const x = this.#flight.at(now);
      const k = this.#width() / PAGE;
      if (Math.abs(x - this.#target) * k < 6 && Math.abs(this.#flight.v * this.#flight.scale) * k < 200) {
        this.#p = this.#target;
        this.#finish();
      }
    }
    if (this.#state === 'settling') {
      // Catch the flight: it freezes under the finger and its target becomes this gesture's base.
      this.#p = this.#flight.at(now);
      this.#flight = null;
      this.#state = 'held';
      this.#base = this.#target;
      this.#target = null;
      this.#suppress = true;
    } else if (this.#state === 'idle') {
      this.#suppress = false;
      const o = this.opts;
      if (o.ignore && e.target.closest?.(o.ignore)) return;
      const lim = o.limits();
      if (!lim) return;
      if (o.edge && !(e.clientX <= o.edge || (lim.forward > 0 && e.clientX >= this.#width() - o.edge))) return;
      this.#state = 'pending';
      this.#base = 0;
    } else {
      return;
    }
    this.#ptr = { id: e.pointerId, x0: e.clientX, y0: e.clientY, locked: false, xL: 0, rawL: 0, scrollers: scrollers(e.target) };
    this.wake();
  }

  // Once the swipe owns the touch, the browser may not start scrolling with it. This handler
  // makes the same horizontal call as #move, so it holds whichever of touchmove and pointermove
  // a browser sends first. Being non-passive is what makes iOS wait for it before scrolling.
  #touchmove(e) {
    const P = this.#ptr;
    if (!P || !e.cancelable) return;
    if (!P.locked) {
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - P.x0;
      const dy = t.clientY - P.y0;
      if (dx * dx + dy * dy < 64 || Math.abs(dx) <= Math.abs(dy) * 1.15) return;
    } else if (this.#state !== 'tracking') {
      return;
    }
    e.preventDefault();
  }

  // A container under the finger scrolled. Before the swipe locks, the browser got there first:
  // the touch is a scroll, so let it go. After the lock (the browser started a scroll it would
  // not cancel), keep that container where it was when the touch began.
  #scrolled(e) {
    const P = this.#ptr;
    if (!P) return;
    const node = e.target === document ? document.scrollingElement : e.target;
    const at = P.scrollers.get(node);
    if (!at) return;
    // (a few px are allowed: the press itself stops a momentum scroll, which can report one last step)
    if (Math.abs(node.scrollTop - at[0]) + Math.abs(node.scrollLeft - at[1]) <= 3) return;
    if (this.#state === 'tracking') this.#yieldToScroll();
    else this.#abandon();
  }

  // The content scrolled after all: the scroll wins. p snaps back to where this gesture started
  // (a caught flight's landing page, or 0) and the finger is ignored until it lifts.
  #yieldToScroll() {
    const P = this.#ptr;
    this.#release(P);
    this.#p = this.#base;
    this.#target = this.#base;
    this.#finish();
    this.#suppress = true;
    setTimeout(() => { this.#suppress = false; }, 400);
    this.wake();
  }

  // A touch swipe just locked: no box under the finger may scroll until it lifts. Applied in the
  // same event that locks, so the next frame already has them frozen. (Not for a mouse: hiding a
  // classic scrollbar would shift the layout, and a mouse drag never scrolls anyway.)
  #freezeScroll(P) {
    P.frozen = [];
    for (const [n] of P.scrollers) {
      const cs = getComputedStyle(n);
      if (!/auto|scroll/.test(cs.overflowX + cs.overflowY) && n !== document.scrollingElement) continue;
      if (n.scrollHeight <= n.clientHeight + 1 && n.scrollWidth <= n.clientWidth + 1) continue;
      P.frozen.push([n, n.style.overflow]);
      n.style.overflow = 'hidden';
    }
  }

  // The finger is done with this swipe: undo what pressing and locking changed.
  #release(P) {
    if (this.#ptr === P) this.#ptr = null;
    if (!P) return;
    if (P.frozen) for (const [n, o] of P.frozen) n.style.overflow = o;
    P.frozen = null;
    if (P.mouse) document.documentElement.style.userSelect = document.documentElement.style.webkitUserSelect = '';
  }

  #move(e) {
    const P = this.#ptr;
    if (!P || e.pointerId !== P.id) return;
    if (!P.locked) {
      const dx = e.clientX - P.x0;
      const dy = e.clientY - P.y0;
      if (dx * dx + dy * dy < 64) return;
      if (Math.abs(dx) <= Math.abs(dy) * 1.15) {
        this.#abandon(); // vertical: this touch belongs to scrolling
        return;
      }
      P.locked = true;
      P.mouse = e.pointerType === 'mouse';
      if (P.mouse) {
        getSelection()?.removeAllRanges();
        document.documentElement.style.userSelect = document.documentElement.style.webkitUserSelect = 'none';
      }
      if (this.#state === 'pending') this.#begin();
      this.#state = 'tracking';
      this.#suppress = true;
      if (!P.mouse) this.#freezeScroll(P);
      try { this.#el.setPointerCapture(e.pointerId); } catch {}
      P.xL = e.clientX;
      P.rawL = this.#unrubber(this.#p);
      this.#samples.length = 0;
      this.#sample(e.timeStamp, this.#p);
      this.#intent = this.#base;
      this.#emit('start', { base: this.#base });
    }
    if (this.#state !== 'tracking') return;
    if (e.cancelable) e.preventDefault();
    const W = this.#width();
    const list = e.getCoalescedEvents?.() || [];
    for (const ev of list.length ? list : [e]) {
      this.#p = this.#rubber(P.rawL + ((ev.clientX - P.xL) / W) * PAGE);
      this.#sample(ev.timeStamp, this.#p);
    }
    this.#updateIntent();
    this.wake();
  }

  #up(e, cancelled) {
    const P = this.#ptr;
    if (!P || e.pointerId !== P.id) return;
    this.#release(P);
    if (this.#state === 'tracking') {
      const est = cancelled ? { v: 0, a: 0 } : this.#estimate(e.timeStamp);
      const { target, proj } = this.#choose(this.#p, est.v, est.a);
      this.#emit('release', { target, proj, p: this.#p, v: est.v, base: this.#base });
      this.#settle(target, est.v * 1000);
    } else {
      this.#abandon();
    }
    if (this.#suppress) setTimeout(() => { this.#suppress = false; }, 400);
  }

  #abandon() {
    this.#release(this.#ptr);
    if (this.#state === 'held') this.#settle(this.#base, 0); // let the caught flight finish
    else if (this.#state === 'pending') this.#state = 'idle';
    // A press that caught a flight blocks one click; a press that turned into a scroll makes none.
    if (this.#suppress) setTimeout(() => { this.#suppress = false; }, 400);
  }

  #click(e) {
    if (!this.#suppress) return;
    e.stopPropagation();
    e.preventDefault();
    this.#suppress = false;
  }

  #width() {
    return this.opts.width?.() || this.#el.clientWidth || innerWidth;
  }

  // ---------- decisions ----------

  // Where this gesture may land: one page either side of its base, within the limits.
  #band() {
    return [Math.max(this.#base - PAGE, this.#range[0]), Math.min(this.#base + PAGE, this.#range[1])];
  }

  // iOS rubber band: f(x) = (1 - 1 / (x·c / d + 1)) · d
  #rubber(raw) {
    const [lo, hi] = this.#band();
    const c = this.opts.rubber;
    const f = (x) => (1 - 1 / ((x * c) / PAGE + 1)) * PAGE;
    return raw > hi ? hi + f(raw - hi) : raw < lo ? lo - f(lo - raw) : raw;
  }

  #unrubber(p) {
    const [lo, hi] = this.#band();
    const c = this.opts.rubber;
    const g = (y) => { y = Math.min(y, PAGE * 0.98); return y / (c * (1 - y / PAGE)); };
    return p > hi ? hi + g(p - hi) : p < lo ? lo - g(lo - p) : p;
  }

  #sample(t, p) {
    const s = this.#samples;
    s.push({ t, p });
    while (s.length > 2 && t - s[0].t > 160) s.shift();
  }

  // Velocity (p/ms) and acceleration (p/ms²) by least squares over the last 100 ms.
  #estimate(tEnd) {
    const s = this.#samples;
    if (s.length < 2) return { v: 0, a: 0 };
    const last = s[s.length - 1];
    if (tEnd - last.t > 60) return { v: 0, a: 0 }; // the finger stopped before lifting
    const pts = s.filter((q) => q.t >= tEnd - 100);
    const slope = (arr) => {
      if (arr.length < 2) return null;
      let mt = 0, mp = 0;
      for (const q of arr) { mt += q.t; mp += q.p; }
      mt /= arr.length; mp /= arr.length;
      let num = 0, den = 0;
      for (const q of arr) { num += (q.t - mt) * (q.p - mp); den += (q.t - mt) ** 2; }
      return den > 1e-6 ? num / den : null;
    };
    const prev = s[s.length - 2];
    const v = slope(pts.length >= 2 ? pts : s.slice(-2)) ?? (last.p - prev.p) / Math.max(1, last.t - prev.t);
    const v1 = slope(pts.filter((q) => q.t < tEnd - 50));
    const v2 = slope(pts.filter((q) => q.t >= tEnd - 50));
    const a = v1 != null && v2 != null ? clamp((v2 - v1) / 50, -0.05, 0.05) : 0;
    return { v: clamp(v, -8, 8), a };
  }

  // Project where the flick would coast to, then take the allowed landing point nearest to it.
  #choose(p, v, a) {
    let ve = v + a * this.opts.accelTau;
    if (Math.sign(ve) !== Math.sign(v)) ve = 0; // hard braking counts as stopped, never as reversed
    if (Math.abs(ve) > Math.abs(v) * 1.5) ve = v * 1.5;
    const r = this.opts.decel;
    const proj = p + (ve * r) / (1 - r);
    let target = this.#base;
    let best = Infinity;
    for (const c of [this.#base - PAGE, this.#base, this.#base + PAGE]) {
      if (c < this.#range[0] || c > this.#range[1]) continue;
      if (Math.abs(c - proj) < best) { best = Math.abs(c - proj); target = c; }
    }
    return { target, proj };
  }

  // Where the page is heading while the finger is down: by position only (velocity flips on
  // every wiggle), with hysteresis so it cannot flicker around one threshold.
  #updateIntent() {
    const { intentOn, intentOff } = this.opts;
    const rel = this.#p - this.#base;
    const ok = (t) => t >= this.#range[0] && t <= this.#range[1];
    if (this.#intent === this.#base) {
      if (rel > intentOn && ok(this.#base + PAGE)) this.#intent = this.#base + PAGE;
      else if (rel < -intentOn && ok(this.#base - PAGE)) this.#intent = this.#base - PAGE;
    } else if (this.#intent > this.#base ? rel < intentOff : rel > -intentOff) {
      this.#intent = this.#base;
    }
  }

  // ---------- lifecycle ----------

  #begin(include) {
    const lim = this.opts.limits() || { back: 0, forward: 0 };
    let lo = 0 - lim.forward * PAGE;
    let hi = lim.back * PAGE;
    if (include != null) { lo = Math.min(lo, include); hi = Math.max(hi, include); }
    this.#range = [lo, hi];
    this.#busy = true;
  }

  // A finger hands over its speed to a spring; a programmatic flight follows the curve.
  #settle(target, v0, curve = null) {
    const o = this.opts;
    const now = performance.now();
    this.#target = target;
    this.#state = 'settling';
    if (curve) {
      const ms = o.duration * clamp(Math.sqrt(Math.abs(target - this.#p) / PAGE), 0.5, 2);
      this.#flight = new Tween(this.#p, target, curve, ms, now, o.timeScale);
    } else {
      this.#flight = new Spring(this.#p, target, v0, o.response, o.damping, now, o.timeScale);
    }
    this.wake();
  }

  #finish() {
    const pages = Math.round(this.#target / PAGE);
    this.#state = 'idle';
    this.#busy = false;
    this.#target = null;
    this.#base = 0;
    this.#intent = 0;
    this.#p = 0;
    this.#flight = null;
    // Move your index by `pages` right here: p is already 0, so index - p/100 never jumps.
    this.opts.onCommit?.(pages);
    this.#emit('commit', { pages });
  }

  #emit(type, detail) {
    const set = this.#on[type];
    if (set) for (const fn of [...set]) fn(detail);
  }

  #read(now, s) {
    s.time = now;
    s.state = this.#state;
    s.busy = this.#busy;
    s.base = this.#base;
    s.target = this.#target;
    s.range = this.#range;
    if (this.#state === 'settling') {
      s.p = this.#flight.at(now);
      s.v = (this.#flight.v * this.#flight.scale) / 1000;
      s.intent = this.#target;
    } else if (this.#state === 'tracking') {
      s.p = this.#p;
      s.v = this.#estimate(now).v;
      s.intent = this.#intent;
    } else {
      s.p = this.#p;
      s.v = 0;
      s.intent = this.#base;
    }
    return s;
  }

  #frame = () => {
    this.#raf = 0;
    const now = performance.now();
    if (this.#state === 'settling') {
      this.#flight.at(now);
      if (this.#flight.done) {
        this.#p = this.#target;
        this.#finish();
      }
    }
    const s = this.#read(now, this.#frameSnap);
    let more = this.#state !== 'idle';
    for (const fn of this.#subs) if (fn(s) === true) more = true;
    if (more) this.wake();
  };
}
