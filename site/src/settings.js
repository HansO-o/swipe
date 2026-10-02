import { createContext, useContext } from 'react';
import { slide } from '../../react.js';

// ---------- transitions (every one sets the same properties, so they can be swapped live) ----------

function paint({ el, dim }, d, { transform = '', opacity = '', shadow = '', radius = '', shade = 0 }) {
  el.style.transform = transform;
  el.style.opacity = opacity;
  el.style.boxShadow = shadow;
  el.style.borderRadius = radius;
  el.style.visibility = d <= -1 || d >= 1 ? 'hidden' : '';
  dim.style.opacity = shade ? shade.toFixed(3) : '0';
}

export const TRANSITIONS = {
  slide: {
    label: 'iOS 推入',
    fn: (pg, d, f) => { pg.el.style.opacity = ''; pg.el.style.borderRadius = ''; slide(pg, d, f); },
  },
  cover: {
    label: '覆盖',
    fn: (pg, d) => paint(pg, d, {
      transform: d > 0 ? `translate3d(${(d * 100).toFixed(3)}%,0,0)` : '',
      shadow: d > 0 && d < 1 ? '0 0 40px rgba(0,0,0,0.25)' : '',
      shade: d < 0 ? -d * 0.35 : 0,
    }),
  },
  card: {
    label: '卡片',
    fn: (pg, d) => paint(pg, d, {
      transform: d > 0 ? `translate3d(${(d * 100).toFixed(3)}%,0,0)` : d < 0 ? `scale(${(1 + d * 0.08).toFixed(4)})` : '',
      radius: d < 0 ? `${Math.round(-d * 28)}px` : d > 0 ? '28px' : '',
      shadow: d > 0 && d < 1 ? '0 0 40px rgba(0,0,0,0.25)' : '',
      shade: d < 0 ? -d * 0.25 : 0,
    }),
  },
  fade: {
    label: '淡入缩放',
    fn: (pg, d) => paint(pg, d, {
      transform: d === 0 ? '' : `scale(${(1 + d * 0.06).toFixed(4)})`,
      opacity: d === 0 ? '' : (1 - Math.abs(d)).toFixed(3),
    }),
  },
};

// ---------- app-wide settings ----------

export const SettingsCtx = createContext(null);
export const useSettings = () => useContext(SettingsCtx);

