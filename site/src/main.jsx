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
    if (knob.current) knob.current.style.transform = `translateX(${(Math.max(-100, Math.min(100, f.p)) / 100) * 21}px)`;
  });
  return <div className="hud" aria-hidden="true"><i><b ref={knob} /></i><span ref={text} /></div>;
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
  const [transition, setTransition] = useState(TRANSITIONS[saved.transition] ? saved.transition : 'slide');
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
      <SwipeRouter routes={routes} transition={TRANSITIONS[transition].fn}>
        {hud && <Hud />}
      </SwipeRouter>
    </SettingsCtx.Provider>
  );
}

preventZoom(); // only does anything when installed to the home screen
createRoot(document.getElementById('root')).render(<App />);
