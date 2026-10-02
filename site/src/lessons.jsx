// The gesture lessons: each explains one rule and has a practice deck with a few tasks.
import { useLayoutEffect, useRef, useState } from 'react';
import { createSwipe } from '../../swipe.js';
import { Deck, cardBg } from './deck.jsx';
import { Code, Hint, Page, Tasks, useTasks } from './ui.jsx';

// ---------- 认识 p ----------

export function PLesson() {
  const ids = ['pos', 'neg', 'commit'];
  const t = useTasks('p', ids);
  return (
    <Page title="认识 p">
      <p>swipe.js 不移动任何元素，也不设置任何样式。它只做一件事：把手指和弹簧的运动写进一个数 <code>p</code>。</p>
      <ul className="dots">
        <li><code>p = 0</code>：静止。</li>
        <li><code>p = +100</code>：正好返回了一页（手指向右）。</li>
        <li><code>p = −100</code>：正好前进了一页（手指向左）。</li>
        <li>中间的值就是“翻到一半”，比如 <code>+37.5</code>。</li>
      </ul>
      <Deck count={3} start={1} scope fields={['p', 'v', 'state', 'target']}
        setup={(swipe) => {
          const a = swipe.subscribe((f) => { if (f.p > 50) t.mark('pos'); if (f.p < -50) t.mark('neg'); });
          const b = swipe.on('commit', (e) => { if (e.pages) t.mark('commit'); });
          return () => { a(); b(); };
        }} />
      <Tasks tasks={t} next={['/gesture/track', '跟手拖动']} items={[
        ['pos', '让 p 超过 +50', '手指向右拖过半页'],
        ['neg', '让 p 低于 −50', '手指向左拖过半页'],
        ['commit', '完成一次翻页', '看 p 停在 ±100，然后归零（绿色竖线）'],
      ]} />
      <h2>界面只读 p</h2>
      <p>手指和弹簧只负责写入 p，画面怎么变完全由你在 <code>subscribe</code> 里决定：</p>
      <Code>{`
swipe.subscribe(({ p }) => {
  const s = index - p / 100; // 连续位置
  pages.forEach((el, i) => {
    const d = Math.max(-1, Math.min(1, i - s));
    // d: 0 = 在屏幕上，+1 = 已移到右边，-1 = 被新页面盖住
    el.style.transform = \`translateX(\${d >= 0 ? d * 100 : d * 30}%)\`;
  });
});`}</Code>
      <p>示波器上的绿色竖线就是 <code>commit</code>：p 落在 ±100 的那一刻归零，同时 <code>onCommit(n)</code> 让你的 <code>index</code> 移动 n 页。两件事在同一刻发生，所以 <code>index − p/100</code> 不会跳。</p>
      <Code>{`
const swipe = createSwipe(stage, {
  limits: () => ({ back: index, forward: 0 }),
  onCommit: (n) => { index -= n; }, // 必须同步更新
});`}</Code>
    </Page>
  );
}

// ---------- 五分钟上手 ----------

// The README's minimal example, running inside a box (it is the same code as example.html).
function MiniStack() {
  const stage = useRef(null);
  const hud = useRef(null);
  useLayoutEffect(() => {
    const el = stage.current;
    const pages = [];
    let index = 0;
    const swipe = createSwipe(el, {
      ignore: 'input, textarea, select',
      limits: () => (pages.length > 1 ? { back: index, forward: pages.length - 1 - index } : null),
      onCommit: (n) => { index -= n; },
    });
    function addPage() {
      const n = pages.length;
      const pg = document.createElement('section');
      pg.className = 'deck-card';
      pg.style.background = cardBg(n);
      pg.innerHTML = `<div class="n">${n}</div><div class="s">${n ? '右滑返回 · 返回后左滑前进' : '根页面：先推入一页'}</div>
        <button class="btn" style="margin-top:8px;background:#10181f;color:#fff">推入下一页</button>`;
      pg.querySelector('button').addEventListener('click', push);
      el.append(pg);
      pages.push(pg);
    }
    function push() {
      if (swipe.busy) return; // limits 冻结中：等这次飞行落地
      for (const p of pages.splice(index + 1)) p.remove(); // 丢弃前进记录
      addPage();
      index++;
      swipe.enter();
    }
    const off = swipe.subscribe(({ p, state }) => {
      const s = index - p / 100;
      pages.forEach((pg, i) => {
        const d = Math.max(-1, Math.min(1, i - s));
        pg.style.transform = `translateX(${d >= 0 ? d * 100 : d * 30}%)`;
        pg.style.filter = d < 0 ? `brightness(${1 + d * 0.35})` : '';
        pg.style.visibility = Math.abs(i - s) < 1 ? '' : 'hidden';
        pg.style.boxShadow = d > 0 && d < 1 ? '-6px 0 24px rgba(0,0,0,0.18)' : '';
      });
      if (hud.current) hud.current.textContent = `p ${p.toFixed(1)} · ${state} · 第 ${index} 页 / 共 ${pages.length} 页`;
    });
    addPage();
    return () => { off(); swipe.destroy(); el.textContent = ''; };
  }, []);
  return (
    <section className="practice">
      <div className="practice-title"><span>运行结果</span><span ref={hud} className="mono" style={{ textTransform: 'none' }} /></div>
      <div ref={stage} className="deck" data-no-swipe="" style={{ height: 260 }} />
    </section>
  );
}

export function Start() {
  return (
    <Page title="五分钟上手">
      <p>下面这段代码就是一个完整的、能滑动的页面栈：推入新页面、任意位置右滑返回、返回后左滑前进。它就在这里运行：</p>
      <MiniStack />
      <h2>1. 准备一个容器</h2>
      <p>手势元素需要 <code>touch-action: pan-y</code>：横向交给 swipe.js，竖向留给浏览器滚动。</p>
      <Code lang="html">{`<div id="stage" style="touch-action: pan-y"></div>`}</Code>
      <h2>2. 创建手势</h2>
      <Code>{`
import { createSwipe } from './swipe.js';

let index = 0; // 当前是第几页

const swipe = createSwipe(document.getElementById('stage'), {
  // 当前页能往回滑几页、往前滑几页；返回 null 表示禁用手势
  limits: () => ({ back: index, forward: pages.length - 1 - index }),
  // p 停在 n × 100，并已归零：在这里移动你的 index
  onCommit: (n) => { index -= n; },
});`}</Code>
      <h2>3. 根据 p 画出页面</h2>
      <Code>{`
swipe.subscribe(({ p }) => {
  const s = index - p / 100; // 连续位置
  pages.forEach((el, i) => {
    const d = Math.max(-1, Math.min(1, i - s));
    el.style.transform = \`translateX(\${d >= 0 ? d * 100 : d * 30}%)\`;
  });
});`}</Code>
      <h2>4. 推入新页面</h2>
      <p>先把页面加进你的栈，再调用 <code>enter()</code>：它让新页面从 <code>p = 100</code> 滑到 0。</p>
      <Code>{`
function push() {
  if (swipe.busy) return;              // 手势进行中，limits 已冻结
  pages.splice(index + 1);             // 丢掉前进记录
  pages.push(makePage());
  index++;
  swipe.enter();
}`}</Code>
      <h2>规则一览</h2>
      <ul className="dots">
        <li><b>松手判定</b>：先算出甩出去会滑到哪里（投影），再选离投影最近的、允许的整页落点。</li>
        <li><b>一次最多翻一页</b>；飞行途中按住叫“接住”，再甩一次可以连翻。</li>
        <li><b>范围冻结</b>：从按下到静止，<code>limits()</code> 只读一次，期间 <code>swipe.busy</code> 为 true，你自己的跳转要排队到 <code>onCommit</code> 之后。</li>
        <li><b>点击不会误触发</b>；<b>鼠标等同于手指</b>。</li>
        <li><b>两种飞行</b>：松手后沿弹簧飞行并继承手指速度；<code>go()</code> / <code>enter()</code> 沿贝塞尔曲线。</li>
      </ul>
      <p>需要和浏览器历史同步、或者在 React 里用？看看 <b>页面栈与 SwipeRouter</b>。</p>
    </Page>
  );
}

// ---------- 跟手拖动 ----------

export function Track() {
  const t = useTasks('track', ['lock', 'intent', 'cancel']);
  return (
    <Page title="跟手拖动">
      <Hint kind="drag" title="按住，横向拖动">慢慢拖过半页再松手，页面会把剩下的路走完。</Hint>
      <p>手指刚按下时 <code>state</code> 是 <code>pending</code>：库还不知道你要横滑还是竖滚。手指移动超过 8px 后才判断方向，横向位移大于纵向的 1.15 倍才锁定为横滑，状态变为 <code>tracking</code>，并发出 <code>start</code> 事件。</p>
      <p>锁定以后页面严格跟手：<code>p = 起点 + 手指位移 ÷ 页面宽度 × 100</code>，手指下的那一点始终在手指下面。</p>
      <Deck count={4} start={2} scope fields={['p', 'state', 'intent', 'target']}
        setup={(swipe) => {
          const a = swipe.on('start', () => t.mark('lock'));
          const b = swipe.subscribe((f) => { if (f.state === 'tracking' && f.intent !== f.base) t.mark('intent'); });
          const c = swipe.on('release', (e) => { if (e.target === e.base && Math.abs(e.p - e.base) > 25) t.mark('cancel'); });
          return () => { a(); b(); c(); };
        }} />
      <Tasks tasks={t} next={['/gesture/flick', '甩动与投影']} items={[
        ['lock', '锁定一次横向拖动', '看 state 从 pending 变成 tracking'],
        ['intent', '拖过半页，看 intent 切换', 'intent 是页面“正要去”的方向'],
        ['cancel', '拖出一段，再拖回来松手', '页面回到原位，不翻页'],
      ]} />
      <h2>intent：正要去哪</h2>
      <p>拖动中速度每一下都在抖，所以 <code>intent</code> 只看位置，并且带迟滞：越过半页（<code>intentOn = 50</code>）才切换，退回到 30%（<code>intentOff = 30</code>）以内才切回，不会在阈值附近来回闪。松手后它等于 <code>target</code>。</p>
      <p>它适合那些“决定离开以后按自己节奏退场”的元素，比如标题淡出、工具栏收起：</p>
      <Code>{`
swipe.subscribe((f) => {
  title.classList.toggle('leaving', f.intent !== f.base);
});`}</Code>
    </Page>
  );
}

// ---------- 甩动与投影 ----------

export function Flick() {
  const t = useTasks('flick', ['short', 'slow', 'back']);
  const swipe = useRef(null);
  const [decel, setDecel] = useState(0.998);
  return (
    <Page title="甩动与投影">
      <Hint kind="flick" title="轻轻一甩">只动一小段，但速度够快，页面就会翻过去。</Hint>
      <p>松手时 swipe.js 不看“拖没拖过一半”。它先估算手指的速度（最后 100ms 的最小二乘拟合，再沿加速度外推 <code>accelTau</code> 毫秒），然后算出页面按这个速度自由滑行会停在哪——<b>投影</b>：</p>
      <Code>{`proj = p + v × r / (1 − r)   // r = decel = 0.998，v 单位是 p/ms`}</Code>
      <p>最后在起点 <code>base</code> 前后一页之内，选离投影最近的、允许的整页落点。示波器上的菱形就是每次松手的投影，红色虚线是落点。</p>
      <Deck count={4} start={2} scope fields={['p', 'v', 'state', 'target']}
        setup={(s) => {
          swipe.current = s;
          return s.on('release', (e) => {
            const moved = Math.abs(e.p - e.base);
            if (e.target !== e.base && moved < 33) t.mark('short');
            if (e.target !== e.base && Math.abs(e.v) < 0.03 && moved > 50) t.mark('slow');
            if (e.target === e.base && moved > 50) t.mark('back');
          });
        }} />
      <section className="group">
        <ul className="list">
          <li className="slider">
            <label htmlFor="decel">decel<small>越大越容易甩过去</small></label>
            <output>{decel.toFixed(4)}</output>
            <input id="decel" type="range" min="0.99" max="0.9995" step="0.0005" value={decel}
              onChange={(e) => { const v = +e.target.value; setDecel(v); if (swipe.current) swipe.current.opts.decel = v; }} />
          </li>
        </ul>
      </section>
      <Tasks tasks={t} next={['/gesture/catch', '接住与连翻']} items={[
        ['short', '只拖一小段，快速甩过去', '位移不到 1/3 页也能翻页'],
        ['slow', '拖过一半，停住再松手', '速度为 0，投影就是当前位置'],
        ['back', '拖过一半后，反向甩回', '投影落回原位，不翻页'],
      ]} />
      <h2>弹簧继承速度</h2>
      <p>松手后页面沿弹簧飞行，弹簧的初速度就是手指的速度（<code>response = 0.42</code> 秒，<code>damping = 0.92</code>），所以甩得越快，到位越快。弹簧是解析解：飞行中任何时刻读 <code>swipe.p</code> 都是精确值，不是上一帧的缓存。</p>
    </Page>
  );
}

// ---------- 接住与连翻 ----------

export function Catch() {
  const t = useTasks('catch', ['hold', 'chain']);
  const swipe = useRef(null);
  const [slow, setSlow] = useState(false);
  const setScale = (on) => { setSlow(on); if (swipe.current) swipe.current.opts.timeScale = on ? 0.3 : 1; };
  return (
    <Page title="接住与连翻">
      <Hint kind="catch" title="飞行中按住，再甩一次">一次手势最多翻一页；接住以后可以接着翻。</Hint>
      <p>一次手势只能落在它的起点 <code>base</code> 前后一页之内。想连翻？在页面还在飞的时候按住它，这叫<b>接住</b>：</p>
      <ul className="dots">
        <li>接住时 <code>state</code> 变成 <code>held</code>，页面冻结在手指下。</li>
        <li>本次手势的 <code>base</code> 变成刚才那次飞行的 <code>target</code>，所以再甩一次可以落在 ±200、±300……</li>
        <li>接住后不拖、直接松手，原来那次飞行会继续完成。</li>
        <li>接住的那次按下不会触发点击。</li>
      </ul>
      <div className="seg" role="tablist">
        <button className={slow ? '' : 'on'} onClick={() => setScale(false)}>正常速度</button>
        <button className={slow ? 'on' : ''} onClick={() => setScale(true)}>慢放 0.3×（更容易接住）</button>
      </div>
      <Deck count={6} start={5} scope scopeRange={330} fields={['p', 'state', 'base', 'target']}
        setup={(s, deck) => {
          swipe.current = s;
          // A press that caught a flight leaves the swipe 'held' right after its own handler.
          const down = () => { if (s.state === 'held') t.mark('hold'); };
          deck.el.addEventListener('pointerdown', down);
          const off = s.on('commit', (e) => { if (Math.abs(e.pages) >= 2) t.mark('chain'); });
          return () => { deck.el.removeEventListener('pointerdown', down); off(); };
        }} />
      <Tasks tasks={t} next={['/gesture/rubber', '橡皮筋与范围']} items={[
        ['hold', '接住一次正在飞的页面', 'state 变成 held'],
        ['chain', '连翻两页', '一次 commit 移动 2 页或更多'],
      ]} />
      <p><code>timeScale</code> 就是上面的慢放开关：它只影响飞行，不影响跟手，调试动画时很好用。</p>
      <Code>{`swipe.opts.timeScale = 0.3; // 慢放，随时可改`}</Code>
    </Page>
  );
}

// ---------- 橡皮筋与范围 ----------

export function Rubber() {
  const t = useTasks('rubber', ['left', 'right']);
  const swipe = useRef(null);
  const [rubber, setRubber] = useState(0.55);
  return (
    <Page title="橡皮筋与范围">
      <Hint kind="rubber" title="拉到尽头">没有可去的页面时，越拉越紧，松手弹回。</Hint>
      <p><code>limits()</code> 决定从当前页能返回几页、前进几页。超出范围不是“拖不动”，而是有越来越大的阻力，和 iOS 一样：</p>
      <Code>{`f(x) = (1 − 1 / (x · c / 100 + 1)) × 100   // c = rubber = 0.55`}</Code>
      <Deck count={3} start={0} scope fields={['p', 'state', 'target', 'intent']}
        setup={(s) => {
          swipe.current = s;
          return s.subscribe((f) => {
            if (f.state !== 'tracking') return;
            if (f.p > f.range[1] + 6) t.mark('left');
            if (f.p < f.range[0] - 6) t.mark('right');
          });
        }} />
      <section className="group">
        <ul className="list">
          <li className="slider">
            <label htmlFor="rubber">rubber<small>越大越松</small></label>
            <output>{rubber.toFixed(2)}</output>
            <input id="rubber" type="range" min="0.15" max="1" step="0.05" value={rubber}
              onChange={(e) => { const v = +e.target.value; setRubber(v); if (swipe.current) swipe.current.opts.rubber = v; }} />
          </li>
        </ul>
      </section>
      <Tasks tasks={t} next={['/gesture/axis', '横竖分流']} items={[
        ['left', '在第一张上向右拉过头', '前面没有页面了'],
        ['right', '在最后一张上向左拉过头', '后面也没有了'],
      ]} />
      <h2>三种范围</h2>
      <ul className="dots">
        <li><code>{'{ back: 2, forward: 1 }'}</code>：可以返回两页（一次一页）、前进一页。</li>
        <li><code>{'{ back: 0, forward: 0 }'}</code>：能拖但拖不动，只有橡皮筋。用在不允许返回的页面上，用户仍然能感觉到“这里有手势”。</li>
        <li><code>null</code>：完全禁用，按下不会开始任何手势，比如只有一页的根页面。</li>
      </ul>
      <p>从手指按下到页面完全静止，<code>limits()</code> 只在开始时读取一次。这段时间 <code>swipe.busy</code> 为 true，你自己的跳转要排队，等 <code>onCommit</code> 之后再执行。</p>
    </Page>
  );
}

// ---------- 横竖分流 ----------

export function Axis() {
  const t = useTasks('axis', ['scroll', 'swipe']);
  return (
    <Page title="横竖分流">
      <Hint kind="axis" title="竖着滑滚动，横着滑翻页">同一块区域，两种手势互不干扰。</Hint>
      <p>一次触摸到底是滚动还是翻页？按下后先等手指移动超过 8px：横向位移大于纵向的 1.15 倍才锁定为横滑，否则这次触摸整个交给浏览器滚动，swipe.js 不再参与。</p>
      <Deck count={3} start={1} height={280} readout fields={['p', 'state']}
        card={(i) => (
          <div onScroll={() => t.mark('scroll')}
            style={{ position: 'absolute', inset: 0, overflowY: 'auto', touchAction: 'pan-y', padding: '14px 16px 30px', overscrollBehavior: 'contain' }}>
            <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>列表 {i + 1}</div>
            {Array.from({ length: 24 }, (_, k) => (
              <div key={k} style={{ padding: '9px 0', borderTop: '1px solid rgba(0,0,0,0.12)', fontSize: 15 }}>第 {k + 1} 行 · 竖着滑我</div>
            ))}
          </div>
        )}
        setup={(s) => s.on('commit', (e) => { if (e.pages) t.mark('swipe'); })} />
      <Tasks tasks={t} next={['/gesture/tap', '点击保护']} items={[
        ['scroll', '在卡片里竖着滚动列表'],
        ['swipe', '在同一块区域横着翻页'],
      ]} />
      <h2>touch-action</h2>
      <p>手势元素必须有 <code>touch-action: pan-y</code>，否则浏览器会抢走横向滑动；如果它的值是 <code>auto</code>，库会自动加上。<b>元素里面的纵向滚动容器也要加</b>：</p>
      <Code lang="css">{`
#stage   { touch-action: pan-y; }   /* 横向交给 swipe.js */
.scroller { overflow-y: auto; touch-action: pan-y; }`}</Code>
      <p>页面里本来就需要横向拖动的东西（滑块、地图、轮播），给它加 <code>data-no-swipe</code>，手势就不会从它上面开始。输入框、文本域、下拉框、可编辑区域默认就被忽略。</p>
      <Code lang="html">{`<input type="range" data-no-swipe>`}</Code>
    </Page>
  );
}

// ---------- 点击保护 ----------

export function Tap() {
  const t = useTasks('tap', ['tap', 'drag', 'catch']);
  const [count, setCount] = useState(0);
  return (
    <Page title="点击保护">
      <Hint kind="tap" title="拖动不会误触">点一下是点击；从按钮上开始拖，就只是拖。</Hint>
      <ul className="dots">
        <li>拖动后松手不会触发 click，哪怕手指是在按钮上按下、又在按钮上抬起。</li>
        <li>接住飞行时的那次按下也不会触发 click。</li>
        <li>页面已经基本到位（离落点不到 6px 且很慢）时的按下，直接当作普通点击：不用等弹簧的尾巴走完。</li>
        <li>鼠标拖动期间不会选中文字，也不会触发链接、图片的原生拖拽。</li>
      </ul>
      <Deck count={4} start={1} fields={['p', 'state']}
        card={(i) => (
          <>
            <div className="n">{i + 1}</div>
            <button className="btn" style={{ background: '#10181f', color: '#fff', marginTop: 6 }}
              onClick={() => { setCount((c) => c + 1); t.mark('tap'); }}>点我 · 已点 {count} 次</button>
          </>
        )}
        setup={(s, deck) => {
          let onButton = false;
          const down = (e) => {
            onButton = !!e.target.closest('button');
            if (onButton && s.state === 'held') t.mark('catch');
          };
          deck.el.addEventListener('pointerdown', down);
          const off = s.on('commit', (e) => { if (e.pages && onButton) t.mark('drag'); });
          return () => { deck.el.removeEventListener('pointerdown', down); off(); };
        }} />
      <Tasks tasks={t} next={['/router', '页面栈与 SwipeRouter']} items={[
        ['tap', '点一下按钮', '计数 +1'],
        ['drag', '从按钮上开始拖动并翻页', '计数不变'],
        ['catch', '页面还在飞的时候点按钮', '只是接住，不算点击'],
      ]} />
    </Page>
  );
}
