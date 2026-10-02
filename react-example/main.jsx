import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Link, SwipeRouter, useNavigator, usePageFrame, useSwipeBlock, useSwipeFrame } from '../react.js';

const NAMES = ['河边', '老菜场', '末班车', '旧书店', '天台', '夜市', '码头', '小巷'];
const ITEMS = Array.from({ length: 16 }, (_, i) => ({ id: i + 1, name: `${NAMES[i % NAMES.length]} ${i + 1}`, hue: (i * 37 + 190) % 360 }));
const item = (id) => ITEMS[(((id - 1) % ITEMS.length) + ITEMS.length) % ITEMS.length];

// A page header. Its title uses the per-page frame hook: it fades out faster than its page slides.
function Bar({ title, back = true }) {
  const nav = useNavigator();
  const titleRef = useRef(null);
  usePageFrame((d) => {
    if (titleRef.current) titleRef.current.style.opacity = String(Math.max(0, 1 - Math.abs(d) * 1.8));
  });
  return (
    <header className="bar">
      {back ? (
        <button className="back" onClick={() => nav.back()} aria-label="返回">‹</button>
      ) : (
        <span className="back" aria-hidden="true" />
      )}
      <h1 ref={titleRef}>{title}</h1>
    </header>
  );
}

function Home() {
  return (
    <>
      <Bar title="Swipe Router" back={false} />
      <main className="body">
        <p className="lead">
          每一页都是一条真实的浏览器历史记录。试试：触摸或鼠标按住页面横向拖动，浏览器的后退 / 前进按钮，或者 Alt + ← / →。
        </p>
        <ul className="list">
          {ITEMS.map((it) => (
            <li key={it.id}>
              <Link to={`/item/${it.id}`}>
                <span className="dot" style={{ background: `hsl(${it.hue} 70% 60%)` }} />
                {it.name}
                <span className="chev">›</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link className="button" to="/settings">设置（演示离开拦截）</Link>
      </main>
    </>
  );
}

function Item({ params }) {
  const nav = useNavigator();
  const id = Number(params.id) || 1;
  const it = item(id);
  return (
    <>
      <Bar title={it.name} />
      <main className="body">
        <div className="hero" style={{ background: `linear-gradient(135deg, hsl(${it.hue} 70% 64%), hsl(${it.hue + 40} 65% 50%))` }}>
          #{id}
        </div>
        <div className="row">
          <Link className="button" to={`/item/${id + 1}`}>下一项 →</Link>
          <button className="button ghost" onClick={() => nav.back(2)}>后退 2 页</button>
        </div>
        {Array.from({ length: 8 }, (_, k) => (
          <p key={k}>
            第 {k + 1} 段。这一页被盖住时不会卸载，滚动位置和输入内容都会保留；回到这里时还是原样。往下滚一点再进入下一项，然后滑回来看看。
          </p>
        ))}
      </main>
    </>
  );
}

function Settings() {
  const nav = useNavigator();
  const [name, setName] = useState('');
  const [ask, setAsk] = useState(false);
  const dirty = name.length > 0;
  useSwipeBlock(dirty, () => setAsk(true));
  return (
    <>
      <Bar title="设置" />
      <main className="body">
        <label className="field">
          昵称
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="输入后就不能直接离开" />
        </label>
        <p className="hint">
          {dirty ? '有未保存的修改：滑动、返回按钮和浏览器后退都会被拦下。' : '没有修改，可以随意返回。'}
        </p>
        {ask && (
          <div className="confirm">
            <p>放弃修改？</p>
            <div className="row">
              <button className="button ghost" onClick={() => setAsk(false)}>继续编辑</button>
              <button className="button warn" onClick={() => { setAsk(false); nav.back(1, { force: true }); }}>放弃</button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function NotFound({ path }) {
  return (
    <>
      <Bar title="找不到页面" />
      <main className="body"><p>没有 {path} 这个页面。</p><Link className="button" to="/">回首页</Link></main>
    </>
  );
}

// Lives outside the pages: reads every frame through useSwipeFrame.
function Hud() {
  const ref = useRef(null);
  const nav = useNavigator();
  window.swipeRouter = nav; // for poking around in the console
  useSwipeFrame((f) => {
    if (ref.current) ref.current.textContent = `p ${f.p.toFixed(1).padStart(6)} · ${f.state} · ${decodeURIComponent(location.hash || '#/')}`;
  });
  return <div className="hud" ref={ref} />;
}

const routes = { '/': Home, '/item/:id': Item, '/settings': Settings, '*': NotFound };

createRoot(document.getElementById('root')).render(
  <SwipeRouter routes={routes} hash className="app">
    <Hud />
  </SwipeRouter>,
);
