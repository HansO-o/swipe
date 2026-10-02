// history.js — a page stack kept in step with the browser history, driven by swipe.js.
// No framework; react.js builds on it.
//
// Every page is a real history entry with its own URL (state: { __swipe: { key, idx } }).
// Whatever moves, the other side follows:
//
//   push(path)           pushState, then the new page slides in.
//   swipe back / forward the page flies; when it lands, history.go(±n) brings the URL along
//                        (that popstate is expected and ignored).
//   browser ←/→, back()  the URL changes first; the stack does not jump, it animates there
//                        along the bezier curve. Several presses chain into one flight.
//
// Forward entries left behind by going back are dropped by the next push, in the browser
// and here alike. The stack is saved in sessionStorage, so after a reload the pages behind
// the current one are still there to swipe back to.
//
// While a finger is down, a flight is landing or a history.go() is on its way, push /
// replace / back are queued and run in order afterwards.

import { createSwipe } from './swipe.js';

const MARK = '__swipe';
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const newKey = () => Math.random().toString(36).slice(2, 10);

export function createSwipeHistory(el, opts) {
  return new SwipeHistory(el, opts);
}

class SwipeHistory {
  #o;
  #entries = []; // [{ key, path }]
  #index = 0; // page on screen (or, while flying, the page the flight started from)
  #offset = 0; // history idx of entries[0]
  #hist = 0; // history idx the browser is at
  #expected = null; // idx of the popstate our own history.go() will cause
  #timer = 0;
  #force = false;
  #queue = [];
  #subs = new Set();
  #on = {};
  #blocked = new Set();
  #snap = null;

  constructor(el, opts = {}) {
    this.#o = { hash: false, base: '', storageKey: 'swipe-history', ...opts };
    this.swipe = createSwipe(el, {
      ...opts.swipe,
      limits: () => this.#limits(),
      onCommit: (n) => this.#commit(n),
    });
    // Pushing hard against a blocked page asks the page to explain itself.
    this.swipe.on('release', ({ proj, base, target }) => {
      if (target === base && proj - base > 45 && this.#isBlocked(this.#index)) this.#emit('blocked', this.current);
    });
    try { history.scrollRestoration = 'manual'; } catch {}
    this.#restore();
    addEventListener('popstate', this.#onPop);
  }

  // ---------- reading ----------

  get entries() { return this.#entries; }
  get index() { return this.#index; }
  get current() { return this.#entries[this.#index]; }

  /** Immutable { entries, index }; changes identity on every change (for useSyncExternalStore). */
  getSnapshot = () => this.#snap;

  subscribe = (fn) => {
    this.#subs.add(fn);
    return () => this.#subs.delete(fn);
  };

  /** 'change' (stack or index changed), 'blocked' (a blocked page refused to be left; detail: its entry). */
  on = (type, fn) => {
    (this.#on[type] ||= new Set()).add(fn);
    return () => this.#on[type].delete(fn);
  };

  /** The URL for a path, for <a href>. */
  href = (path) => (this.#o.hash ? `#${path}` : this.#o.base + path);

  // ---------- navigation ----------

  push = (path) => {
    if (this.#locked()) return void this.#queue.push(() => this.push(path));
    const e = { key: newKey(), path };
    this.#entries = [...this.#entries.slice(0, this.#index + 1), e];
    this.#index++;
    this.#hist = this.#offset + this.#index;
    history.pushState(this.#state(e), '', this.href(path));
    this.#changed();
    this.swipe.enter();
  };

  replace = (path) => {
    if (this.#locked()) return void this.#queue.push(() => this.replace(path));
    const e = { key: newKey(), path };
    const list = this.#entries.slice();
    list[this.#index] = e;
    this.#entries = list;
    history.replaceState(this.#state(e), '', this.href(path));
    this.#changed();
  };

  /** Back n pages (negative: forward) like the browser button, animated. force: ignore blocks. */
  back = (n = 1, { force = false } = {}) => {
    const s = this.swipe;
    if (this.#expected != null || (s.busy && s.state !== 'settling')) {
      this.#queue.push(() => this.back(n, { force }));
      return true;
    }
    const at = this.#hist - this.#offset;
    const k = clamp(n, at - (this.#entries.length - 1), at);
    if (!k) return false;
    if (k > 0 && !force && this.#blockedFrom(at, k)) {
      this.#emit('blocked', this.#entries[at]);
      return false;
    }
    this.#force = force;
    history.go(-k); // popstate → #follow animates
    return true;
  };

  forward = (n = 1) => this.back(-n);

  /** Keep the page with this key from being left by swipe, back() or the browser button. */
  block = (key, on = true) => {
    if (on) this.#blocked.add(key);
    else this.#blocked.delete(key);
    return () => this.#blocked.delete(key);
  };

  destroy() {
    removeEventListener('popstate', this.#onPop);
    clearTimeout(this.#timer);
    this.swipe.destroy();
  }

  // ---------- browser → stack ----------

  #onPop = (e) => {
    const st = e.state?.[MARK];
    const force = this.#force;
    this.#force = false;
    if (!st) return this.#o.hash ? this.#adopt() : undefined; // a URL typed in (hash mode)
    if (this.#expected != null) {
      const ours = st.idx === this.#expected;
      this.#settled();
      if (ours) return this.#flush();
    }
    const from = this.#hist;
    const delta = from - st.idx; // > 0: the browser went back
    if (!delta) return;
    if (this.#entries[st.idx - this.#offset]?.key !== st.key) return this.#reset(st);
    if (delta > 0 && !force && this.#blockedFrom(from - this.#offset, delta)) {
      this.#expect(from); // undo it: we stay, the browser goes forward again
      history.go(delta);
      this.#emit('blocked', this.#entries[from - this.#offset]);
      return;
    }
    this.#hist = st.idx;
    this.#follow();
  };

  // Fly the stack to where the browser is. If a finger is down, its landing wins and
  // #commit moves the browser instead.
  #follow() {
    const s = this.swipe;
    if (s.state !== 'idle' && s.state !== 'settling') return;
    const want = this.#hist - this.#offset;
    const landing = this.#index - (s.state === 'settling' ? s.snapshot().target / 100 : 0);
    if (landing !== want) s.go(landing - want);
  }

  // ---------- stack → browser ----------

  #commit(n) {
    if (n) {
      this.#index = clamp(this.#index - n, 0, this.#entries.length - 1);
      this.#changed();
    }
    const want = this.#offset + this.#index;
    if (want !== this.#hist) {
      const d = want - this.#hist;
      this.#hist = want;
      this.#expect(want);
      history.go(d);
    } else {
      this.#flush();
    }
  }

  #expect(idx) {
    this.#expected = idx;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => { this.#settled(); this.#flush(); }, 1000);
  }

  #settled() {
    this.#expected = null;
    clearTimeout(this.#timer);
  }

  #locked() {
    return this.swipe.busy || this.#expected != null;
  }

  #flush() {
    while (!this.#locked() && this.#queue.length) this.#queue.shift()();
  }

  // ---------- helpers ----------

  #limits() {
    const len = this.#entries.length;
    if (len < 2) return null;
    let back = 0;
    for (let i = this.#index; i > 0 && !this.#isBlocked(i); i--) back++;
    return { back, forward: len - 1 - this.#index };
  }

  #isBlocked(i) {
    return this.#blocked.has(this.#entries[i]?.key);
  }

  // Would going back k pages from index `at` leave a blocked page?
  #blockedFrom(at, k) {
    for (let i = at; i > at - k; i--) if (this.#isBlocked(i)) return true;
    return false;
  }

  #path() {
    if (this.#o.hash) return location.hash.slice(1) || '/';
    return (location.pathname.slice(this.#o.base.length) || '/') + location.search;
  }

  #state(e, idx = this.#hist) {
    return { ...(history.state || {}), [MARK]: { key: e.key, idx } };
  }

  // A history entry we did not create (a URL typed into the address bar): treat it as a push.
  #adopt() {
    const e = { key: newKey(), path: this.#path() };
    this.#hist++;
    history.replaceState(this.#state(e), '', location.href);
    if (this.#locked() || this.#index !== this.#hist - 1 - this.#offset) return this.#reset({ key: e.key, idx: this.#hist });
    this.#entries = [...this.#entries.slice(0, this.#index + 1), e];
    this.#index++;
    this.#changed();
    this.swipe.enter();
  }

  // An entry this stack does not know (storage cleared, very old history): start over from it.
  #reset(st) {
    this.#entries = [{ key: st.key, path: this.#path() }];
    this.#index = 0;
    this.#offset = this.#hist = st.idx;
    this.#queue.length = 0;
    this.#changed();
  }

  #restore() {
    const st = history.state?.[MARK];
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(this.#o.storageKey)); } catch {}
    if (st && saved?.entries?.[st.idx - saved.offset]?.key === st.key) {
      this.#entries = saved.entries;
      this.#offset = saved.offset;
      this.#index = st.idx - saved.offset;
      this.#hist = st.idx;
    } else {
      const e = { key: st?.key || newKey(), path: this.#path() };
      this.#entries = [e];
      this.#index = 0;
      this.#offset = this.#hist = st ? st.idx : 0;
      history.replaceState(this.#state(e), '', location.href);
    }
    this.#changed();
  }

  #changed() {
    this.#snap = { entries: this.#entries, index: this.#index };
    try {
      sessionStorage.setItem(this.#o.storageKey, JSON.stringify({ offset: this.#offset, entries: this.#entries }));
    } catch {}
    for (const fn of this.#subs) fn();
    this.#emit('change', this.#snap);
  }

  #emit(type, detail) {
    const set = this.#on[type];
    if (set) for (const fn of [...set]) fn(detail);
  }
}
