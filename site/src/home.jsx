import { useRef, useState, useSyncExternalStore } from 'react';
import { Link, useNavigator, useSwipeFrame } from '../../react.js';
import { cardBg } from './deck.jsx';
import { Bar, Group, Row, Tile, useProgress } from './ui.jsx';

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
export const SIZES = __SIZES__;
export const VERSION = __VERSION__;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

// The app's own p, live, with a miniature of its page stack moving by the same number.
// Swipe back here from any page (or forward again) and both move with your finger.
function Hero() {
  const nav = useNavigator();
  const snap = useSyncExternalStore(nav.subscribe, nav.getSnapshot);
  const val = useRef(null);
  const knob = useRef(null);
  const state = useRef(null);
  const minis = useRef([]);
  const lo = Math.max(0, snap.index - 1);
  const shown = snap.entries.slice(lo, snap.index + 2);
  useSwipeFrame((f) => {
    if (val.current) val.current.textContent = (f.p > 0.05 ? '+' : f.p < -0.05 ? '−' : '') + Math.abs(f.p).toFixed(1);
    if (knob.current) knob.current.style.left = `${50 + clamp(f.p, -100, 100) / 2}%`;
    if (state.current) state.current.textContent = f.state;
    const s = nav.index - f.p / 100;
    minis.current.forEach((el, j) => {
      if (!el) return;
      const d = clamp(lo + j - s, -1.2, 1.2);
      el.style.transform = d >= 0 ? `translate3d(${(d * 118).toFixed(2)}%,0,0)` : `translate3d(${(d * 58).toFixed(2)}%,0,0) scale(${(1 + d * 0.1).toFixed(3)})`;
      el.style.opacity = d < -1 || d > 1.15 ? '0' : d < 0 ? (1 + d * 0.55).toFixed(3) : '1';
      el.style.zIndex = String(10 + j);
    });
  });
  return (
    <section className="hero glass">
      <div className="eyebrow"><span>p · 这个 app 自己的手势</span><b ref={state}>idle</b></div>
      <div className="pval" ref={val}>0.0</div>
      <div className="rail"><b /><i ref={knob} /></div>
      <div className="scale"><span>−100 前进</span><span>0</span><span>+100 返回</span></div>
      <div className="ministack" aria-hidden="true">
        {shown.map((e, j) => (
          <div key={e.key} ref={(el) => { minis.current[j] = el; }} style={{ background: cardBg(lo + j) }}>{e.path}</div>
        ))}
      </div>
      <p>手指和弹簧只写入这一个数，页面、卡片、背景里的光球都只读它。点进任意一课，再从任意位置往右滑回来。</p>
      <div className="stats"><span>单文件</span><span>零依赖</span><span>{kb(SIZES.swipe)} gzip</span><span>React 路由可选</span></div>
    </section>
  );
}

function Tip() {
  const [shown, setShown] = useState(() => { try { return !localStorage.getItem('swipe-site-tip'); } catch { return true; } });
  if (!shown) return null;
  const close = () => { setShown(false); try { localStorage.setItem('swipe-site-tip', '1'); } catch {} };
  return (
    <div className="tip glass">
      <span>在<b>任何页面的任意位置</b>往右滑就是返回，返回后往左滑又能前进。桌面上按住鼠标拖动也一样。</span>
      <button className="x" onClick={close} aria-label="知道了">×</button>
    </div>
  );
}

const GESTURES = [
  ['/gesture/track', 'track', '#ff8a3d', '跟手拖动', 'pending → tracking', 'track'],
  ['/gesture/flick', 'flick', '#ff4f7b', '甩动与投影', '看投影，不看过没过半', 'flick'],
  ['/gesture/catch', 'catch', '#8a5cff', '接住与连翻', '飞行中按住，再甩', 'catch'],
  ['/gesture/rubber', 'rubber', '#2f9bff', '橡皮筋', 'limits 之外只有阻力', 'rubber'],
  ['/gesture/axis', 'axis', '#10b9a0', '横竖分流', '竖滑滚动，横滑翻页', 'axis'],
  ['/gesture/tap', 'tap', '#ffb020', '点击保护', '拖动不会误触', 'tap'],
];
const ROUTER = [
  ['/router', 'router', '#6a5cff', 'SwipeRouter', '你正在用的就是它'],
  ['/router/history', 'history', '#2f9bff', '前进后退', '地址栏与栈同步'],
  ['/router/keepalive', 'keep', '#ff4f7b', '页面保活', '盖住的页面不卸载'],
  ['/router/block', 'block', '#ff8a3d', '离开拦截', 'useSwipeBlock'],
  ['/router/transition', 'transition', '#8a5cff', '自定义转场', '换一种翻页方式'],
  ['/router/frame', 'frame', '#10b9a0', '逐帧联动', 'usePageFrame'],
];

function Tiles({ items, done }) {
  return (
    <div className="grid">
      {items.map(([to, icon, color, title, sub, id]) => (
        <Link key={to} to={to} className="tilecard glass">
          <Tile icon={icon} color={color} />
          <span><b>{title}</b><small>{sub}</small></span>
          {id && done[id] && (
            <svg className="check" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-label="已完成"><path d="M4.5 10.5l3.5 3.5 7.5-8" /></svg>
          )}
        </Link>
      ))}
    </div>
  );
}

export function Home() {
  const done = useProgress();
  return (
    <>
      <Bar title="swipe.js" back={false} large />
      <main className="content">
        <div className="large">swipe.js</div>
        <Hero />
        <Tip />
        <Group title="开始">
          <Row to="/p" icon="p" color="#6a5cff" label="认识 p" sub="整个手势就是一个数字" done={done.p} />
          <Row to="/start" icon="start" color="#10b981" label="五分钟上手" sub="一个能滑动的页面栈，就在页面里运行" />
          <Row to="/install" icon="install" color="#2f9bff" label="安装与引入" sub="复制一个文件，或直接从本站导入" />
        </Group>
        <h2 className="group-title">手势 · 每课都有练习区</h2>
        <Tiles items={GESTURES} done={done} />
        <h2 className="group-title">路由 · React</h2>
        <Tiles items={ROUTER} done={done} />
        <Group title="参考">
          <Row to="/api" icon="api" color="#4b4a75" label="API 速查" />
          <Row to="/tune" icon="tune" color="#4b4a75" label="手感调参" sub="实时修改这个 app 的弹簧和投影" />
          <Row to="/nozoom" icon="zoom" color="#4b4a75" label="禁止缩放" sub="nozoom.js，给 PWA 用" />
        </Group>
        <Group title="关于">
          <Row label="版本" detail={`v${VERSION}`} />
          <Row label="swipe.js" detail={kb(SIZES.swipe)} />
          <Row label="history.js · react.js · nozoom.js" detail={kb(SIZES.history + SIZES.react + SIZES.nozoom)} />
          <Row href="https://github.com/HansO-o/swipe" icon="link" color="#24292f" label="GitHub" sub="HansO-o/swipe" />
        </Group>
      </main>
    </>
  );
}

export function NotFound({ path }) {
  return (
    <>
      <Bar title="找不到页面" />
      <main className="content">
        <div className="large">404</div>
        <p>没有 <code>{path}</code> 这个页面。</p>
        <div className="btns"><Link className="btn" to="/">回首页</Link></div>
      </main>
    </>
  );
}
