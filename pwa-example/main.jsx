import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Link, SwipeRouter, useNavigator, usePageFrame, useSwipeBlock, useSwipeFrame } from '../react.js';
import { preventZoom } from '../nozoom.js';
import { applyUpdate, cacheInfo, checkForUpdate, install, registerServiceWorker, resetApp, usePwa } from './pwa.js';
import { deleteNote, saveNote, useNote, useNotes } from './notes.js';

const VERSION = __VERSION__; // set by build.mjs
const when = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// A page header. The title fades out faster than its page slides.
function Bar({ title, back = true, children }) {
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
      <div className="tools">{children}</div>
    </header>
  );
}

// ---------- 首页 ----------

function Home() {
  const notes = useNotes();
  const { online } = usePwa();
  return (
    <>
      <Bar title="笔记" back={false}>
        <Link className="tool" to="/app" aria-label="应用状态">
          <span className={online ? 'dot on' : 'dot'} />
          {online ? '在线' : '离线'}
        </Link>
        <Link className="tool add" to="/new" aria-label="新建笔记">＋</Link>
      </Bar>
      <main className="body">
        <InstallCard />
        {notes.length ? (
          <ul className="list">
            {notes.map((n) => (
              <li key={n.id}>
                <Link to={`/note/${n.id}`}>
                  <span className="grow">
                    <strong>{n.title}</strong>
                    <span className="excerpt">{n.body.split('\n').find(Boolean) || '（空）'}</span>
                  </span>
                  <time>{when.format(n.updated)}</time>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint center">还没有笔记。点右上角 ＋ 写一条。</p>
        )}
        <p className="hint">任意位置右滑返回，返回后左滑前进；浏览器的后退 / 前进键和 Alt + ← / → 也一样。</p>
      </main>
    </>
  );
}

function InstallCard() {
  const { standalone, canInstall, ios, installed } = usePwa();
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem('swipe-pwa-install-hidden') === '1'; } catch { return false; }
  });
  const hide = () => {
    setHidden(true);
    try { localStorage.setItem('swipe-pwa-install-hidden', '1'); } catch {}
  };
  if (installed && !standalone) {
    return <div className="card"><p>已安装。从桌面或主屏幕打开它，就是独立的应用窗口。</p></div>;
  }
  if (standalone || hidden || !(canInstall || ios)) return null;
  return (
    <div className="card">
      <p><strong>安装到{ios ? '主屏幕' : '桌面'}</strong></p>
      <p className="hint">
        {ios
          ? '在 Safari 里点底部的分享按钮，再选“添加到主屏幕”。之后从主屏幕打开，就是全屏的应用，断网也能用。'
          : '装好后在独立窗口里运行，有自己的图标，断网也能打开。'}
      </p>
      <div className="row">
        {canInstall && <button className="button" onClick={install}>安装</button>}
        <button className="button ghost" onClick={hide}>不再提示</button>
      </div>
    </div>
  );
}

// ---------- 笔记 ----------

function NotePage({ params }) {
  const note = useNote(params.id);
  // Deleted from this page: keep showing it (disabled) while it slides away, and if it is
  // swiped back to later from the forward history.
  const seen = useRef(note);
  if (note) seen.current = note;
  if (!seen.current) {
    return (
      <>
        <Bar title="笔记" />
        <main className="body">
          <p className="hint">没有这条笔记。</p>
          <Link className="button" to="/">回首页</Link>
        </main>
      </>
    );
  }
  return <Editor note={seen.current} deleted={!note} />;
}

function NewPage() {
  return <Editor note={null} />;
}

function Editor({ note, deleted = false }) {
  const nav = useNavigator();
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [ask, setAsk] = useState(null); // null | 'leave' | 'delete'
  const dirty = !deleted && (title !== (note?.title ?? '') || body !== (note?.body ?? ''));
  useSwipeBlock(dirty, () => setAsk('leave'));

  const save = () => {
    const t = title.trim() || '无标题';
    setTitle(t);
    const id = saveNote({ id: note?.id, title: t, body });
    if (!note) nav.replace(`/note/${id}`); // the new page becomes the note's own page
  };
  const remove = () => {
    setAsk(null);
    deleteNote(note.id);
    nav.back(1, { force: true });
  };

  return (
    <>
      <Bar title={note ? note.title : '新建笔记'}>
        {!deleted && (
          <button className="tool strong" onClick={save} disabled={!dirty}>保存</button>
        )}
      </Bar>
      <main className="body">
        {deleted && <p className="hint">这条笔记已删除。</p>}
        <input className="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题"
          disabled={deleted} aria-label="标题" />
        <Grow value={body} onChange={(e) => setBody(e.target.value)} placeholder="写点什么…"
          disabled={deleted} aria-label="正文" />
        <p className="hint">
          {dirty ? '有未保存的修改：滑动、返回按钮和浏览器后退都会被拦下。' : note ? `保存于 ${when.format(note.updated)}，只存在这台设备上。` : '保存后才会出现在列表里。'}
        </p>
        {note && !deleted && !ask && (
          <div className="row"><button className="button ghost danger" onClick={() => setAsk('delete')}>删除这条笔记</button></div>
        )}
        {ask && (
          <div className="confirm">
            <p>{ask === 'delete' ? '删除这条笔记？' : '放弃修改？'}</p>
            <div className="row">
              <button className="button ghost" onClick={() => setAsk(null)}>{ask === 'delete' ? '取消' : '继续编辑'}</button>
              {ask === 'leave' && <button className="button" onClick={() => { setAsk(null); save(); nav.back(1, { force: true }); }}>保存并返回</button>}
              <button className="button warn" onClick={ask === 'delete' ? remove : () => { setAsk(null); nav.back(1, { force: true }); }}>
                {ask === 'delete' ? '删除' : '放弃'}
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

// A textarea as tall as its text. Swipes never start on a text field, so a fixed, page-sized
// one would leave nothing to swipe on; this way the space below it stays swipeable.
function Grow(props) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={4} {...props} />;
}

// ---------- 应用状态 ----------

const SW_TEXT = {
  registering: '注册中…', installing: '安装中…', active: '已启用，离线可用', error: '注册失败',
  insecure: '需要 https 或 localhost', unsupported: '浏览器不支持',
};

function AppPage() {
  const pwa = usePwa();
  const [cacheList, setCacheList] = useState(null);
  const [usage, setUsage] = useState(null);
  const [checking, setChecking] = useState(null); // null | 'busy' | 'none' | 'found' | 'error'
  const pRef = useRef(null);

  useEffect(() => {
    cacheInfo().then(setCacheList);
    navigator.storage?.estimate?.().then(setUsage, () => {});
  }, [pwa.sw, pwa.update]);

  // This page's own view of the gesture: the same p every page is painted from.
  useSwipeFrame((f) => {
    if (pRef.current) pRef.current.textContent = `p ${f.p.toFixed(1)} · ${f.state}`;
  });

  const check = async () => {
    setChecking('busy');
    try { setChecking((await checkForUpdate()) ? 'found' : 'none'); } catch { setChecking('error'); }
  };
  const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;

  return (
    <>
      <Bar title="应用状态" />
      <main className="body">
        <dl className="facts">
          <dt>运行方式</dt><dd>{pwa.standalone ? '已安装，独立窗口' : '浏览器标签页'}</dd>
          <dt>网络</dt><dd>{pwa.online ? '在线' : '离线（一切照常，笔记存在本机）'}</dd>
          <dt>Service Worker</dt><dd>{SW_TEXT[pwa.sw]}</dd>
          <dt>版本</dt><dd><code>{VERSION}</code>{pwa.update && ' · 新版本已就绪'}</dd>
          <dt>缓存</dt>
          <dd>
            {cacheList == null ? '…' : cacheList.length ? cacheList.map((c) => <div key={c.name}><code>{c.name}</code> · {c.count} 个文件</div>) : '无'}
          </dd>
          {usage && <><dt>存储</dt><dd>已用 {mb(usage.usage)} / 可用 {mb(usage.quota)}</dd></>}
          <dt>手势</dt><dd><code ref={pRef} /></dd>
        </dl>
        <div className="row">
          <button className="button" onClick={check} disabled={checking === 'busy' || pwa.sw !== 'active'}>检查更新</button>
          <button className="button ghost" onClick={resetApp}>清除缓存并重新加载</button>
        </div>
        {checking && checking !== 'busy' && (
          <p className="hint">{{ none: '已经是最新版本。', found: '发现新版本，正在下载，好了会在底部提示。', error: '检查失败，可能是离线了。' }[checking]}</p>
        )}
        <p className="hint">
          界面、脚本和图标在第一次打开时全部缓存下来，之后断网也能启动。发布新版本后，应用在后台下载，下载完成在底部提示“刷新”：
          点了才切换，所以不会出现一半旧代码、一半新代码。刷新后页面栈还在，可以继续滑回去。
        </p>
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

// ---------- 页面之外：更新提示、离线提示 ----------

function Toasts() {
  const { update, online } = usePwa();
  return (
    <div className="toasts" aria-live="polite">
      {update && (
        <div className="toast">
          新版本已就绪
          <button onClick={applyUpdate}>刷新</button>
        </div>
      )}
      {!online && <div className="toast muted">离线中 · 修改保存在本机</div>}
    </div>
  );
}

const routes = { '/': Home, '/new': NewPage, '/note/:id': NotePage, '/app': AppPage, '*': NotFound };

preventZoom(); // only once installed: a browser tab keeps its zoom
createRoot(document.getElementById('root')).render(
  <SwipeRouter routes={routes} hash className="app">
    <Toasts />
  </SwipeRouter>,
);
addEventListener('load', () => registerServiceWorker('./sw.js'));
