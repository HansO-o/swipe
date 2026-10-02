import { useRef, useState } from 'react';
import { Link, useSwipeFrame } from '../../react.js';
import { Bar, Group, Row, useProgress } from './ui.jsx';

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
export const SIZES = __SIZES__;
export const VERSION = __VERSION__;

// The app's own p, live: swipe between this page and another one and watch it move.
function Hero() {
  const val = useRef(null);
  const knob = useRef(null);
  const state = useRef(null);
  useSwipeFrame((f) => {
    if (val.current) val.current.textContent = (f.p > 0.05 ? '+' : f.p < -0.05 ? '−' : '') + Math.abs(f.p).toFixed(1);
    if (knob.current) knob.current.style.left = `${50 + Math.max(-100, Math.min(100, f.p)) / 2}%`;
    if (state.current) state.current.textContent = f.state;
  });
  return (
    <div className="hero">
      <div className="big">p · <span ref={state}>idle</span></div>
      <div className="pval" ref={val}>0.0</div>
      <div className="meter"><b /><i ref={knob} /></div>
      <div className="scale"><span>−100 前进一页</span><span>0</span><span>+100 返回一页</span></div>
      <p>把“左右滑动翻页”变成一个数字。手指和弹簧只负责写入 p，你的界面只负责读取 p。进入任意一页再滑回来，看这个数字怎么动。</p>
      <div className="stats"><span>单文件</span><span>零依赖</span><span>{kb(SIZES.swipe)} gzip</span></div>
    </div>
  );
}

function Tip() {
  const [shown, setShown] = useState(() => { try { return !localStorage.getItem('swipe-site-tip'); } catch { return true; } });
  if (!shown) return null;
  const close = () => { setShown(false); try { localStorage.setItem('swipe-site-tip', '1'); } catch {} };
  return (
    <div className="tip">
      <span>👆 点任意一行进入；在<b>任何页面的任意位置</b>向右滑就能返回，返回后向左滑又能前进。桌面上用鼠标按住拖动也一样。</span>
      <button className="x" onClick={close} aria-label="知道了">×</button>
    </div>
  );
}

export function Home() {
  const done = useProgress();
  const L = (id) => !!done[id];
  return (
    <>
      <Bar title="swipe.js" back={false} large />
      <main className="content">
        <div className="large">swipe.js</div>
        <Hero />
        <Tip />
        <Group title="开始">
          <Row to="/p" icon="p" color="#0c7f8a" label="认识 p" sub="整个手势就是一个数字" done={L('p')} />
          <Row to="/start" icon="start" color="#2f9e5b" label="五分钟上手" sub="一个能滑动的页面栈" />
          <Row to="/install" icon="install" color="#5b6bd6" label="安装与引入" sub="复制一个文件，或直接从本站导入" />
        </Group>
        <Group title="手势" foot="每一课都有一块练习区和几个小任务，完成后这里会打勾。">
          <Row to="/gesture/track" icon="track" color="#e0861a" label="跟手拖动" sub="pending → tracking，以及 intent" done={L('track')} />
          <Row to="/gesture/flick" icon="flick" color="#d6475b" label="甩动与投影" sub="松手看投影，不看过没过半" done={L('flick')} />
          <Row to="/gesture/catch" icon="catch" color="#8a4fd6" label="接住与连翻" sub="飞行中按住，再甩一次" done={L('catch')} />
          <Row to="/gesture/rubber" icon="rubber" color="#1a8fd6" label="橡皮筋与范围" sub="limits 之外只有阻力" done={L('rubber')} />
          <Row to="/gesture/axis" icon="axis" color="#4a9a3c" label="横竖分流" sub="竖着滚动，横着翻页" done={L('axis')} />
          <Row to="/gesture/tap" icon="tap" color="#c4503a" label="点击保护" sub="拖动和接住都不会误触" done={L('tap')} />
        </Group>
        <Group title="路由 · React">
          <Row to="/router" icon="router" color="#0c7f8a" label="页面栈与 SwipeRouter" sub="你正在用的就是它" />
          <Row to="/router/history" icon="history" color="#5b6bd6" label="浏览器前进后退" sub="地址栏和页面栈始终同步" />
          <Row to="/router/keepalive" icon="keep" color="#d6475b" label="页面保活" sub="被盖住的页面不会卸载" />
          <Row to="/router/block" icon="block" color="#e0861a" label="离开拦截" sub="useSwipeBlock" />
          <Row to="/router/transition" icon="transition" color="#8a4fd6" label="自定义转场" sub="transition(page, d, frame)" />
          <Row to="/router/frame" icon="frame" color="#1a8fd6" label="逐帧联动" sub="usePageFrame · useSwipeFrame" />
        </Group>
        <Group title="参考">
          <Row to="/api" icon="api" color="#4b5763" label="API 速查" />
          <Row to="/tune" icon="tune" color="#4b5763" label="手感调参" sub="实时修改这个 app 的弹簧和投影" />
          <Row to="/nozoom" icon="zoom" color="#4b5763" label="禁止缩放" sub="nozoom.js，给 PWA 用" />
        </Group>
        <Group title="关于">
          <Row label="版本" detail={`v${VERSION}`} />
          <Row label="swipe.js" detail={kb(SIZES.swipe)} />
          <Row label="history.js · react.js · nozoom.js" detail={kb(SIZES.history + SIZES.react + SIZES.nozoom)} />
          <Row href="https://github.com/HansO-o/swipe" icon="link" color="#24292f" label="GitHub" sub="HansO-o/swipe" />
        </Group>
        <p className="lead" style={{ textAlign: 'center', fontSize: 13 }}>这个网站本身就是用 swipe.js 的 React 路由写成的。</p>
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
