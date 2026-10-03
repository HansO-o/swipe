import { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SwipeRouter, useSwipeFrame } from '../../react.js';
import { SettingsCtx, TRANSITIONS } from './settings.js';
import { preventZoom } from '../../nozoom.js';
import { Home, NotFound } from './home.jsx';
import { Axis, Catch, Flick, PLesson, Rubber, Start, Tap, Track } from './lessons.jsx';
import { Block, DemoPage, FrameLesson, HistoryLesson, KeepAlive, RouterIntro, TransitionLesson } from './router.jsx';
import { Api, Install, NoZoom, Tune } from './reference.jsx';

let saved = {};
try { saved = JSON.parse(localStorage.getItem('swipe-site-settings')) || {}; } catch {}

/** Lives above the pages and reads every frame through useSwipeFrame. */
function Hud() {
  const text = useRef(null);
  const knob = useRef(null);
  useSwipeFrame((f) => {
    if (text.current) text.current.textContent = `p ${((f.p > 0.05 ? '+' : f.p < -0.05 ? '−' : ' ') + Math.abs(f.p).toFixed(1)).padStart(6)} · ${f.state}`;
    if (knob.current) knob.current.style.transform = `translateX(${(Math.max(-100, Math.min(100, f.p)) / 100) * 20}px)`;
  });
  return <div className="hud" aria-hidden="true"><i><b ref={knob} /></i><span ref={text} /></div>;
}

// The studio behind every page: clay and glass orbs. The pages are clear, so the orbs show
// through; each one drifts with p at its own depth, which makes the swipe read as parallax.
const ORBS = [
  { kind: 'clay', c: '#c9b6ff', size: 230, left: '58%', top: '-7%', k: 0.25, delay: 0 },
  { kind: 'clay', c: '#a9bcff', size: 150, left: '-16%', top: '36%', k: 0.5, delay: -3 },
  { kind: 'clear', size: 104, left: '72%', top: '50%', k: 0.85, delay: -5 },
  { kind: 'clay', c: '#ffc1d8', size: 72, left: '10%', top: '80%', k: 1.15, delay: -2 },
  { kind: 'clear', size: 48, left: '30%', top: '15%', k: 1.5, delay: -6 },
];

function Studio() {
  const orbs = useRef([]);
  useSwipeFrame((f) => {
    orbs.current.forEach((el, i) => {
      if (el) el.style.transform = `translate3d(${(f.p * ORBS[i].k * 0.7).toFixed(1)}px,0,0)`;
    });
  });
  return (
    <div className="studio" aria-hidden="true">
      {ORBS.map((o, i) => (
        <div key={i} ref={(el) => { orbs.current[i] = el; }} className={`orb ${o.kind}`}
          style={{ left: o.left, top: o.top, width: o.size, height: o.size, '--c': o.c }}>
          <i style={{ animationDelay: `${o.delay}s` }} />
        </div>
      ))}
    </div>
  );
}

const routes = {
  '/': Home,
  '/p': PLesson,
  '/start': Start,
  '/install': Install,
  '/gesture/track': Track,
  '/gesture/flick': Flick,
  '/gesture/catch': Catch,
  '/gesture/rubber': Rubber,
  '/gesture/axis': Axis,
  '/gesture/tap': Tap,
  '/router': RouterIntro,
  '/router/demo/:n': DemoPage,
  '/router/history': HistoryLesson,
  '/router/keepalive': KeepAlive,
  '/router/block': Block,
  '/router/transition': TransitionLesson,
  '/router/frame': FrameLesson,
  '/api': Api,
  '/tune': Tune,
  '/nozoom': NoZoom,
  '*': NotFound,
};

function App() {
  const [transition, setTransition] = useState(TRANSITIONS[saved.transition] ? saved.transition : 'glass');
  const [hud, setHud] = useState(saved.hud !== false);
  const settings = useMemo(() => {
    const save = (patch) => {
      try { localStorage.setItem('swipe-site-settings', JSON.stringify({ transition, hud, ...patch })); } catch {}
    };
    return {
      transition, hud,
      setTransition: (t) => { setTransition(t); save({ transition: t }); },
      setHud: (h) => { setHud(h); save({ hud: h }); },
    };
  }, [transition, hud]);
  return (
    <SettingsCtx.Provider value={settings}>
      <SwipeRouter routes={routes} hash={__HASH__} urlOnly transition={TRANSITIONS[transition].fn}>
        <Studio />
        {hud && <Hud />}
      </SwipeRouter>
    </SettingsCtx.Provider>
  );
}

preventZoom(); // only does anything when installed to the home screen
createRoot(document.getElementById('root')).render(<App />);
