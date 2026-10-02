// Shared pieces of the app: page header, grouped lists, code blocks, gesture hints, progress.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useNavigator, usePageFrame } from '../../react.js';

// ---------- icons ----------

const PATHS = {
  p: null,
  track: 'M5 12h14M13 6l6 6-6 6',
  flick: 'M5 6l6 6-6 6M13 6l6 6-6 6',
  catch: 'M9 5v14M15 5v14',
  rubber: 'M3 12c2.2-6 3.8 6 6 0s3.8 6 6 0 3.8 6 6 0',
  axis: 'M12 3v18M3 12h18M9 6l3-3 3 3M18 9l3 3-3 3',
  tap: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2',
  start: 'M8 5l11 7-11 7z',
  install: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  router: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5',
  history: 'M3 12a9 9 0 1 0 2.6-6.4M3 4v5h5M12 8v4l3 2',
  keep: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  block: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  transition: 'M3 5h11v14H3zM17 7h4M17 12h4M17 17h4',
  api: 'M8 4c-2 0-3 1-3 3v2l-2 3 2 3v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2l2 3-2 3v2c0 2-1 3-3 3',
  tune: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  zoom: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4M8 11h6',
  frame: 'M4 4h16v16H4zM4 9h16M9 4v5M15 4v5',
  link: 'M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1',
};

export function Icon({ name }) {
  if (name === 'p') return <b style={{ font: '700 19px/1 ui-monospace, Menlo, monospace', marginTop: -3 }}>p</b>;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} fill={name === 'start' ? 'currentColor' : 'none'} />
    </svg>
  );
}

const Chevron = () => (
  <svg className="chev" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M1 1l6 6-6 6" />
  </svg>
);
const Tick = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 10.5l3.5 3.5 7.5-8" />
  </svg>
);

// ---------- page header ----------

/** Sticky header with a back button. Its title fades with the page (usePageFrame) and, on
 *  pages with a large title, only shows once that title has scrolled away. */
export function Bar({ title, back = true, large = false }) {
  const nav = useNavigator();
  const bar = useRef(null);
  const fade = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  usePageFrame((d) => {
    if (fade.current) fade.current.style.opacity = String(Math.max(0, 1 - Math.abs(d) * 1.8));
  });
  useEffect(() => {
    const sc = bar.current?.closest('.swipe-scroll');
    if (!sc) return;
    const on = () => setScrolled(sc.scrollTop > (large ? 40 : 2));
    on();
    sc.addEventListener('scroll', on, { passive: true });
    return () => sc.removeEventListener('scroll', on);
  }, [large]);
  return (
    <header ref={bar} className={scrolled ? 'bar edge' : 'bar'}>
      {back && (
        <button className="back" onClick={() => nav.back()} aria-label="返回">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          返回
        </button>
      )}
      <h1 className={large && !scrolled ? 'off' : ''}><span ref={fade}>{title}</span></h1>
    </header>
  );
}

/** A standard page: header, large title, content. */
export function Page({ title, large, back = true, children }) {
  return (
    <>
      <Bar title={title} back={back} large />
      <main className="content">
        <div className="large">{large ?? title}</div>
        {children}
      </main>
    </>
  );
}

// ---------- grouped lists ----------

export function Group({ title, foot, children }) {
  return (
    <section className="group">
      {title && <h2 className="group-title">{title}</h2>}
      <ul className="list">{children}</ul>
      {foot && <p className="group-foot">{foot}</p>}
    </section>
  );
}

export function Row({ to, href, icon, color, label, sub, detail, done, onClick, children }) {
  const inner = (
    <>
      {icon && <span className="tile" style={{ background: color }}><Icon name={icon} /></span>}
      <span className="label">{label}{sub && <small>{sub}</small>}</span>
      {detail != null && <span className="detail">{detail}</span>}
      {done && <Tick className="check" />}
      {children}
      {(to || href) && <Chevron />}
    </>
  );
  const cls = icon ? 'row' : 'row plain';
  if (to) return <li><Link className={cls} to={to}>{inner}</Link></li>;
  if (href) return <li><a className={cls} href={href} target="_blank" rel="noopener">{inner}</a></li>;
  if (onClick) return <li><button className={cls} onClick={onClick}>{inner}</button></li>;
  return <li><div className={cls}>{inner}</div></li>;
}

// ---------- code ----------

const TOKENS = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*(?=\n|$))|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)|\b(import|from|export|const|let|var|function|return|new|if|else|for|of|in|await|async|true|false|null|undefined|class|extends|this|type|interface)\b|(\b\d+(?:\.\d+)?\b)|(<\/?[A-Za-z][\w.]*|<\/?>|\/>)/g;
const CLS = [null, 't-com', 't-str', 't-kw', 't-num', 't-tag'];

function highlight(src, lang) {
  const out = [];
  let last = 0;
  let m;
  TOKENS.lastIndex = 0;
  while ((m = TOKENS.exec(src))) {
    let k = m.slice(1).findIndex((x) => x != null) + 1;
    // '#' only starts a comment in shell snippets.
    if (k === 1 && m[0][0] === '#' && lang !== 'sh') continue;
    if (m.index > last) out.push(src.slice(last, m.index));
    out.push(<span key={m.index} className={CLS[k]}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  out.push(src.slice(last));
  return out;
}

export function Code({ children, lang = 'js', cap }) {
  const src = String(children).replace(/^\n/, '').replace(/\s+$/, '');
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(src);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };
  return (
    <div className="code">
      <div className="cap"><span>{cap ?? lang}</span><button className="copy" onClick={copy}>{copied ? '已复制' : '复制'}</button></div>
      <pre><code>{highlight(src, lang)}</code></pre>
    </div>
  );
}

// ---------- gesture hint ----------

/** A looping miniature of a gesture: a finger dot and the pages it moves. */
export function Hint({ kind, title, children }) {
  return (
    <div className="hint" data-kind={kind}>
      <div className="screen" aria-hidden="true">
        {kind === 'catch' && <div className="pg under" />}
        {kind !== 'rubber' && <div className={kind === 'catch' ? 'pg mid' : 'pg under'} />}
        <div className={kind === 'axis' ? 'pg top scroll' : 'pg top'}>
          {kind === 'axis' && (
            <div className="lines">{[16, 30, 44, 58, 72, 86, 100, 114, 128, 142, 156].map((y) => <i key={y} style={{ top: y }} />)}</div>
          )}
        </div>
        {kind === 'tap' && <div className="btnx" />}
        <div className="dot" />
      </div>
      <div className="text"><b>{title}</b>{children}</div>
    </div>
  );
}

// ---------- tasks & progress ----------

const KEY = 'swipe-site-progress';
let progress = {};
try { progress = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
const listeners = new Set();
export const lessonDone = (id) => !!progress[id];
function markLesson(id) {
  if (progress[id]) return;
  progress = { ...progress, [id]: true };
  try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch {}
  for (const fn of listeners) fn();
}
export function useProgress() {
  return useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => progress);
}

/** Checklist state for one lesson; marks the lesson complete once every item is done. */
export function useTasks(lesson, ids) {
  const [done, setDone] = useState(() => (lessonDone(lesson) ? Object.fromEntries(ids.map((i) => [i, true])) : {}));
  const ref = useRef(done);
  const mark = (id) => {
    if (ref.current[id]) return;
    ref.current = { ...ref.current, [id]: true };
    setDone(ref.current);
    if (ids.every((i) => ref.current[i])) markLesson(lesson);
  };
  const reset = () => { ref.current = {}; setDone({}); };
  return { done, mark, reset, all: ids.every((i) => done[i]) };
}

export function Tasks({ items, tasks, next }) {
  return (
    <>
      <section className="group tasks">
        <h2 className="group-title">练习</h2>
        <ul className="list">
          {items.map(([id, label, sub]) => (
            <li key={id} className={tasks.done[id] ? 'done' : ''}>
              <div className="row">
                <span className="ring"><Tick /></span>
                <span className="label">{label}{sub && <small>{sub}</small>}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
      {tasks.all && (
        <div className="complete">
          <Tick className="check" /> 本课完成
          {next && <Link to={next[0]}>{next[1]} →</Link>}
        </div>
      )}
    </>
  );
}

export const fmt = (x, d = 1) => (x == null ? '—' : (x > 0 ? '+' : x < 0 ? '−' : ' ') + Math.abs(x).toFixed(d));
