// A practice stage for the lessons: a few cards driven by their own createSwipe, with a live
// readout of the frame and an oscilloscope of p over time.
import { useLayoutEffect, useRef, useState } from 'react';
import { createSwipe } from '../../swipe.js';
import { fmt } from './ui.jsx';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const HUES = [186, 40, 330, 140, 262, 12, 210, 96];
export const cardBg = (i) => `linear-gradient(150deg, hsl(${HUES[i % HUES.length]} 72% 76%), hsl(${HUES[i % HUES.length] + 24} 64% 64%))`;

/**
 * count cards, starting on `start`. The deck carries data-no-swipe so the app's own page swipe
 * never starts on it; its own swipe uses an ignore list without that selector.
 * setup(swipe, deck) runs once after mount and may return a cleanup; deck.index is live.
 */
export function Deck({
  count = 5, start = 0, options, setup, card, height, readout = true, scope = false, scopeRange = 130,
  title = '试一试', fields = ['p', 'v', 'state', 'target'],
}) {
  const stage = useRef(null);
  const cards = useRef([]);
  const shades = useRef([]);
  const cells = useRef({});
  const canvas = useRef(null);
  const [index, setIndex] = useState(start);

  useLayoutEffect(() => {
    const deck = { index: start, el: stage.current };
    const swipe = createSwipe(stage.current, {
      ignore: 'input, textarea, select, [contenteditable], [data-no-deck]',
      ...options,
      limits: () => ({ back: deck.index, forward: count - 1 - deck.index }),
      onCommit: (n) => { deck.index -= n; setIndex(deck.index); },
    });
    deck.swipe = swipe;
    const paint = (f) => {
      const s = deck.index - f.p / 100;
      cards.current.forEach((el, i) => {
        if (!el) return;
        const d = clamp(i - s, -1, 1);
        el.style.transform = d === 0 ? '' : `translate3d(${(d > 0 ? d * 100 : d * 30).toFixed(3)}%,0,0)`;
        el.style.visibility = Math.abs(i - s) < 1 ? '' : 'hidden';
        el.style.boxShadow = d > 0 && d < 1 ? '-6px 0 24px rgba(0,0,0,0.18)' : '';
        const sh = shades.current[i];
        if (sh) sh.style.opacity = d < 0 ? (-d * 0.22).toFixed(3) : '0';
      });
      const c = cells.current;
      if (c.p) c.p.textContent = fmt(f.p);
      if (c.v) c.v.textContent = fmt(f.v, 2);
      if (c.state) c.state.textContent = f.state;
      if (c.target) c.target.textContent = f.target == null ? '—' : fmt(f.target, 0);
      if (c.intent) c.intent.textContent = fmt(f.intent, 0);
      if (c.base) c.base.textContent = fmt(f.base, 0);
    };
    const offPaint = swipe.subscribe(paint);
    const offScope = scope && canvas.current ? attachScope(canvas.current, swipe, scopeRange) : null;
    const offSetup = setup?.(swipe, deck);
    return () => {
      offSetup?.();
      offScope?.();
      offPaint();
      swipe.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="practice">
      <div className="practice-title"><span>{title}</span><span>{index + 1} / {count}</span></div>
      <div ref={stage} className="deck" data-no-swipe="" style={height ? { height } : undefined}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} ref={(el) => { cards.current[i] = el; }} className="deck-card" style={{ background: cardBg(i) }}>
            {card ? card(i) : <><div className="n">{i + 1}</div><div className="s">{i === 0 ? '第一张' : i === count - 1 ? '最后一张' : '左右滑动'}</div></>}
            <div ref={(el) => { shades.current[i] = el; }} className="deck-shade" />
          </div>
        ))}
        <div className="deck-dots">{Array.from({ length: count }, (_, i) => <i key={i} className={i === index ? 'on' : ''} />)}</div>
      </div>
      {readout && (
        <div className="readout">
          {fields.map((k) => (
            <div key={k}><b>{LABELS[k]}</b><span ref={(el) => { cells.current[k] = el; }}>—</span></div>
          ))}
        </div>
      )}
      {scope && <canvas ref={canvas} className="scope" />}
    </section>
  );
}

const LABELS = { p: 'p', v: 'v  p/ms', state: 'state', target: 'target 落点', intent: 'intent 意图', base: 'base 起点' };

/** Draws p over the last few seconds, with each release's projection and landing point. */
export function attachScope(canvas, swipe, R = 130) {
  const WINDOW = 2600;
  const ctx = canvas.getContext('2d');
  let samples = [];
  let marks = []; // { t, kind: 'release' | 'commit', proj, pages }
  let wasIdle = true;
  let tEnd = performance.now();
  let col = null;
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const readCol = () => {
    const cs = getComputedStyle(canvas);
    const v = (n) => cs.getPropertyValue(n).trim();
    col = { line: v('--line'), ink: v('--ink-3'), ink2: v('--ink-2'), accent: v('--accent'), warn: v('--warn'), ok: v('--ok') };
  };
  const onScheme = () => { readCol(); draw(); };
  mq.addEventListener('change', onScheme);

  function draw() {
    if (!col) readCol();
    const dpr = devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const pad = 14;
    const y = (p) => h / 2 - (clamp(p, -R * 1.1, R * 1.1) / R) * (h / 2 - pad);
    const x = (t) => w - 8 - ((tEnd - t) / WINDOW) * (w - 48);
    ctx.font = '10px ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'middle';
    for (let g = -Math.floor(R / 100) * 100; g <= R; g += 100) {
      ctx.strokeStyle = col.line;
      ctx.lineWidth = g === 0 ? 1.5 : 1;
      ctx.setLineDash(g === 0 ? [] : [3, 4]);
      ctx.beginPath(); ctx.moveTo(40, y(g)); ctx.lineTo(w, y(g)); ctx.stroke();
      ctx.fillStyle = col.ink;
      ctx.fillText(g === 0 ? '0' : (g > 0 ? '+' : '−') + Math.abs(g), 6, y(g));
    }
    ctx.setLineDash([]);
    // landing points of flights
    ctx.strokeStyle = col.warn;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    let open = false;
    ctx.beginPath();
    for (const s of samples) {
      if (s.target == null) { open = false; continue; }
      if (!open) { ctx.moveTo(x(s.t), y(s.target)); open = true; } else ctx.lineTo(x(s.t), y(s.target));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // p
    ctx.strokeStyle = col.accent;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    samples.forEach((s, i) => (i ? ctx.lineTo(x(s.t), y(s.p)) : ctx.moveTo(x(s.t), y(s.p))));
    ctx.stroke();
    // releases (projection) and commits
    for (const m of marks) {
      const mx = x(m.t);
      if (mx < 40) continue;
      if (m.kind === 'release') {
        const py = y(m.proj);
        ctx.strokeStyle = col.ink2;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(mx, y(m.p)); ctx.lineTo(mx, py); ctx.stroke();
        ctx.fillStyle = col.ink2;
        ctx.beginPath(); ctx.moveTo(mx, py - 5); ctx.lineTo(mx + 5, py); ctx.lineTo(mx, py + 5); ctx.lineTo(mx - 5, py); ctx.closePath(); ctx.fill();
        ctx.fillText(`投影 ${fmt(m.proj, 0)}`, Math.min(mx + 8, w - 70), py + (m.proj > 0 ? 10 : -10));
      } else {
        ctx.fillStyle = col.ok;
        ctx.fillText(`commit ${m.pages > 0 ? '+' : ''}${m.pages}`, Math.max(42, mx - 64), pad - 4);
        ctx.fillRect(mx - 0.5, pad + 2, 1, h - pad * 2 - 2);
      }
    }
  }

  const offRelease = swipe.on('release', (e) => marks.push({ t: performance.now(), kind: 'release', proj: e.proj, p: e.p }));
  const offCommit = swipe.on('commit', (e) => { if (e.pages) marks.push({ t: performance.now(), kind: 'commit', pages: e.pages }); });
  const offFrame = swipe.subscribe((f) => {
    if (wasIdle && f.state !== 'idle') samples.push({ t: f.time - 16, p: 0, target: null });
    wasIdle = f.state === 'idle';
    samples.push({ t: f.time, p: f.p, target: f.target });
    tEnd = f.time;
    const cut = tEnd - WINDOW - 100;
    while (samples.length > 2 && samples[1].t < cut) samples.shift();
    marks = marks.filter((m) => m.t > cut);
    draw();
  });
  const ro = new ResizeObserver(() => draw());
  ro.observe(canvas);
  return () => {
    offRelease(); offCommit(); offFrame();
    ro.disconnect();
    mq.removeEventListener('change', onScheme);
  };
}
