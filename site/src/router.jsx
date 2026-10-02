// The router lessons. This whole site is a <SwipeRouter>, so most of them are about the page
// you are on.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useNavigator, usePageFrame, useRoute, useSwipeBlock } from '../../react.js';
import { cardBg } from './deck.jsx';
import { TRANSITIONS, useSettings } from './settings.js';
import { Bar, Code, Page } from './ui.jsx';

/** The live page stack of this app. */
function StackView() {
  const nav = useNavigator();
  const snap = useSyncExternalStore(nav.subscribe, nav.getSnapshot);
  const { key } = useRoute();
  return (
    <div className="stack">
      {snap.entries.map((e, i) => (
        <div key={e.key} className={i === snap.index ? 'cur' : i > snap.index ? 'fwd' : ''}>
          {e.path}
          <em>{e.key === key ? '本页' : ''}{i === snap.index ? (e.key === key ? ' · 当前' : '当前') : i > snap.index ? '前进记录' : `#${i}`}</em>
        </div>
      ))}
    </div>
  );
}

export function RouterIntro() {
  const nav = useNavigator();
  return (
    <Page title="页面栈与 SwipeRouter" large="SwipeRouter">
      <p className="lead">你现在用的这个 app 就是一个 <code>{'<SwipeRouter>'}</code>：路由、手势、浏览器前进后退，三件事统一处理。</p>
      <h2>这个 app 的页面栈</h2>
      <p>下面是实时的页面栈，最上面是栈顶。推入几页，再滑回来，或者用浏览器的后退按钮：</p>
      <StackView />
      <div className="btns">
        <Link className="btn" to="/router/demo/1">推入演示页</Link>
        <button className="btn ghost" onClick={() => nav.forward()}>forward()</button>
      </div>
      <h2>用法</h2>
      <Code>{`
import { SwipeRouter, Link, useNavigator } from './swipe/react.js';

const routes = { '/': Home, '/item/:id': Item, '*': NotFound }; // 按顺序匹配

createRoot(root).render(<SwipeRouter routes={routes} />);

function Item({ params, query }) {
  const nav = useNavigator(); // push / replace / back / forward / href / swipe
  return <>
    <button onClick={() => nav.back()}>返回</button>
    <Link to={\`/item/\${+params.id + 1}\`}>下一项</Link>
  </>;
}`}</Code>
      <ul className="dots">
        <li><b>每一页都是一条真实的浏览器历史记录</b>，有自己的 URL，不插入哨兵记录。</li>
        <li><b>页面保活</b>：被盖住的页面不会卸载，滚动位置和输入内容都会保留。</li>
        <li><b>动画不触发 React 渲染</b>：每帧直接写样式，只有页面栈变化时 React 才重新渲染。</li>
        <li>页面结构是 <code>.swipe-page &gt; .swipe-scroll</code>（页面自己的滚动容器）加上 <code>.swipe-dim</code>（被盖住时的遮罩）。页面背景用 CSS 变量 <code>--swipe-page-bg</code>。</li>
      </ul>
      <h2>URL：路径还是 hash</h2>
      <p><code>hash</code> 模式使用 <code>#/path</code>，任何静态托管都能用。这个网站用的是真实路径（<code>/router</code>），所以服务器要把所有未知路径回退到 <code>index.html</code>。在 Cloudflare Workers 上只要一行：</p>
      <Code lang="js" cap="wrangler.jsonc">{`
{
  "name": "swipe",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}`}</Code>
    </Page>
  );
}

export function DemoPage({ params }) {
  const nav = useNavigator();
  const n = Math.max(1, Number(params.n) || 1);
  return (
    <>
      <Bar title={`演示页 ${n}`} />
      <main className="content">
        <div className="demo-hero" style={{ background: cardBg(n) }}>{n}</div>
        <p>右滑返回、左滑前进，或者用浏览器的按钮。URL 是 <code>/router/demo/{n}</code>，刷新之后页面栈还在。</p>
        <div className="btns">
          <Link className="btn" to={`/router/demo/${n + 1}`}>推入下一页</Link>
          <Link className="btn ghost" to={`/router/demo/${n + 1}`} replace>replace</Link>
          <button className="btn ghost" onClick={() => nav.back(2)}>back(2)</button>
        </div>
        <StackView />
      </main>
    </>
  );
}

export function HistoryLesson() {
  const nav = useNavigator();
  const [, force] = useState(0);
  useEffect(() => nav.on('change', () => force((x) => x + 1)), [nav]);
  return (
    <Page title="浏览器前进后退">
      <ul className="dots">
        <li><b>浏览器的后退 / 前进</b>（按钮、<code>Alt + ←/→</code>、鼠标侧键、安卓返回键）：地址栏立刻变化，页面不会瞬间切换，而是沿贝塞尔曲线播放进退动画。连按几次会合并成一次飞行。</li>
        <li><b>手势返回 / 前进</b>：页面落地后，再用 <code>history.go(±n)</code> 把地址栏带过去。</li>
        <li><b>前进记录的清理</b>：返回之后再 push，原来的前进记录会被丢弃，浏览器和页面栈保持一致。</li>
        <li><b>刷新后栈还在</b>：页面栈保存在 <code>sessionStorage</code> 里，刷新后仍然可以滑回之前的页面。</li>
      </ul>
      <section className="group">
        <ul className="list">
          <li><div className="row plain"><span className="label">location.pathname</span><span className="detail mono">{location.pathname}</span></div></li>
          <li><div className="row plain"><span className="label">history.length</span><span className="detail mono">{history.length}</span></div></li>
          <li><div className="row plain"><span className="label">页面栈</span><span className="detail mono">{nav.index + 1} / {nav.entries.length}</span></div></li>
        </ul>
      </section>
      <div className="btns">
        <Link className="btn" to="/router/demo/1">推入演示页</Link>
        <button className="btn ghost" onClick={() => history.back()}>history.back()</button>
        <button className="btn ghost" onClick={() => location.reload()}>刷新</button>
      </div>
      <p>刷新之后，试着向右滑：上一页还在。</p>
      <h2>在代码里导航</h2>
      <Code>{`
const nav = useNavigator();
nav.push('/item/3');        // 推入，带动画
nav.replace('/item/4');     // 替换当前页
nav.back();                 // 和浏览器后退按钮一样，带动画
nav.back(2);                // 一次退两页
nav.forward();
nav.href('/item/3');        // 给 <a href> 用的 URL`}</Code>
      <p>手指按下、飞行落地或 <code>history.go()</code> 还在路上时，<code>push</code> / <code>replace</code> / <code>back</code> 会排队，之后按顺序执行。</p>
    </Page>
  );
}

export function KeepAlive() {
  const [n, setN] = useState(0);
  return (
    <Page title="页面保活">
      <p>被盖住的页面不会卸载：组件状态、输入框里的内容、滚动位置都还在。下面改点东西，往下滚一点，然后推入一页再滑回来。</p>
      <div className="btns">
        <button className="btn ghost" onClick={() => setN(n + 1)}>计数：{n}</button>
        <Link className="btn" to="/router/demo/1">推入一页</Link>
      </div>
      <label className="field">
        随便写点什么
        <textarea rows={3} placeholder="滑走再滑回来，它还在" />
      </label>
      {Array.from({ length: 10 }, (_, k) => (
        <p key={k}>第 {k + 1} 段。每一页都有自己的滚动容器 <code>.swipe-scroll</code>，所以滚动位置天然各自独立，返回时不需要“恢复”。</p>
      ))}
      <div className="btns"><Link className="btn" to="/router/demo/1">推入一页</Link></div>
    </Page>
  );
}

export function Block() {
  const nav = useNavigator();
  const [name, setName] = useState('');
  const [ask, setAsk] = useState(false);
  const dirty = name.length > 0;
  useSwipeBlock(dirty, () => setAsk(true));
  return (
    <Page title="离开拦截">
      <p><code>useSwipeBlock(when, onBlocked)</code>：<code>when</code> 为真时，本页不能通过滑动、<code>back()</code> 或浏览器后退离开，改为调用 <code>onBlocked</code>。</p>
      <label className="field">
        昵称
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="输入后就不能直接离开" />
      </label>
      <p className="lead">{dirty ? '有未保存的修改：滑动只剩橡皮筋，用力甩、点返回、浏览器后退都会被拦下。' : '没有修改，可以随意返回。'}</p>
      {ask && (
        <div className="confirm">
          <p>放弃修改？</p>
          <div className="btns" style={{ margin: 0 }}>
            <button className="btn ghost" onClick={() => setAsk(false)}>继续编辑</button>
            <button className="btn warn" onClick={() => { setAsk(false); nav.back(1, { force: true }); }}>放弃</button>
          </div>
        </div>
      )}
      <Code>{`
function Settings() {
  const nav = useNavigator();
  const [name, setName] = useState('');
  const [ask, setAsk] = useState(false);
  useSwipeBlock(name.length > 0, () => setAsk(true));
  // …
  // 确认放弃：强制离开
  nav.back(1, { force: true });
}`}</Code>
    </Page>
  );
}

export function TransitionLesson() {
  const { transition, setTransition } = useSettings();
  return (
    <Page title="自定义转场">
      <p><code>{'<SwipeRouter transition>'}</code> 每帧对每一页调用一次 <code>transition(page, d, frame)</code>：<code>page</code> 是 <code>{'{ el, scroll, dim }'}</code>，<code>d</code> 是这一页的位置——0 在屏幕上，+1 已离开，−1 被盖住。默认是 iOS 风格的 <code>slide</code>。</p>
      <p>选一个，然后滑回首页看看。整个 app 都会换：</p>
      <div className="seg">
        {Object.entries(TRANSITIONS).map(([k, v]) => (
          <button key={k} className={k === transition ? 'on' : ''} onClick={() => setTransition(k)}>{v.label}</button>
        ))}
      </div>
      <div className="btns"><Link className="btn" to="/router/demo/1">推入演示页</Link></div>
      <Code cap="“卡片”转场">{`
function card({ el, dim }, d) {
  el.style.transform = d > 0 ? \`translateX(\${d * 100}%)\`   // 上面的页面滑走
                     : d < 0 ? \`scale(\${1 + d * 0.08})\` : ''; // 下面的页面缩小
  el.style.borderRadius = d !== 0 ? '28px' : '';
  el.style.visibility = Math.abs(d) >= 1 ? 'hidden' : '';
  dim.style.opacity = d < 0 ? -d * 0.25 : 0;
}

<SwipeRouter routes={routes} transition={card} />`}</Code>
      <p>转场函数只在 <code>d</code> 变化时调用；静止的页面不会被反复写样式。</p>
    </Page>
  );
}

export function FrameLesson() {
  const box = useRef(null);
  const bar = useRef(null);
  const label = useRef(null);
  usePageFrame((d, f) => {
    if (box.current) box.current.style.transform = `rotate(${(d * 180).toFixed(1)}deg) scale(${(1 - Math.abs(d) * 0.4).toFixed(3)})`;
    if (bar.current) bar.current.style.transform = `scaleX(${(1 - Math.abs(d)).toFixed(3)})`;
    if (label.current) label.current.textContent = `d = ${d.toFixed(3)} · ${f.state}`;
  });
  return (
    <Page title="逐帧联动">
      <p>页面里的模块也可以各自跟着手势动：<code>usePageFrame(fn)</code> 每帧调用 <code>fn(d, frame)</code>，<code>d</code> 是本页的位置。慢慢把这一页往右拖，看下面的方块：</p>
      <div className="card" style={{ textAlign: 'center' }}>
        <div ref={box} className="spin" />
        <div style={{ height: 6, borderRadius: 3, background: 'var(--line)', overflow: 'hidden', margin: '0 0 10px' }}>
          <div ref={bar} style={{ height: '100%', background: 'var(--accent)', transformOrigin: 'left' }} />
        </div>
        <div ref={label} className="mono" style={{ fontSize: 13, color: 'var(--ink-2)' }}>d = 0.000</div>
      </div>
      <Code>{`
function Spinner() {
  const ref = useRef(null);
  usePageFrame((d, frame) => {
    ref.current.style.transform = \`rotate(\${d * 180}deg)\`;
  });
  return <div ref={ref} className="spin" />;
}`}</Code>
      <p>页面之外的元素（比如底部的 p 指示器、tab 栏）用 <code>useSwipeFrame(fn)</code>，每帧拿到完整的 <code>frame</code>：</p>
      <Code>{`
function Hud() {
  const ref = useRef(null);
  useSwipeFrame((f) => {
    ref.current.textContent = \`p \${f.p.toFixed(1)} · \${f.state}\`;
  });
  return <div ref={ref} className="hud" />;
}

<SwipeRouter routes={routes}>
  <Hud />   {/* children 渲染在页面层之上 */}
</SwipeRouter>`}</Code>
      <p>这两个 hook 都直接写样式，不触发 React 渲染。</p>
    </Page>
  );
}
