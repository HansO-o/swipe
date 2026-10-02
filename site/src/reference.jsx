import { useState } from 'react';
import { useNavigator } from '../../react.js';
import { defaults } from '../../swipe.js';
import { isStandalone } from '../../nozoom.js';
import { SIZES } from './home.jsx';
import { useSettings } from './settings.js';
import { Code, Group, Page, Row } from './ui.jsx';

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

function Ref({ rows }) {
  return (
    <div className="scrollx">
      <table className="ref"><tbody>
        {rows.map(([k, v, def]) => <tr key={k}><td>{k}</td>{def !== undefined && <td className="def">{def}</td>}<td>{v}</td></tr>)}
      </tbody></table>
    </div>
  );
}

export function Install() {
  const origin = location.origin;
  return (
    <Page title="安装与引入">
      <h2>复制一个文件</h2>
      <p><code>swipe.js</code> 是单文件、零依赖的 ES 模块。只要手势，复制它就够了；需要页面栈或 React 路由，再加上对应的文件。</p>
      <Group foot="大小为压缩后再 gzip。每个文件都附带 .d.ts 类型声明。">
        <Row href="/lib/swipe.js" label="swipe.js" sub="手势：产出 p" detail={kb(SIZES.swipe)} />
        <Row href="/lib/history.js" label="history.js" sub="与浏览器历史同步的页面栈，不依赖框架" detail={kb(SIZES.history)} />
        <Row href="/lib/react.js" label="react.js" sub="React 路由：SwipeRouter、Link、hooks" detail={kb(SIZES.react)} />
        <Row href="/lib/nozoom.js" label="nozoom.js" sub="PWA 禁止整页缩放" detail={kb(SIZES.nozoom)} />
      </Group>
      <h2>直接从本站导入</h2>
      <p>本站的 <code>/lib/</code> 下就是仓库里的源文件，允许跨域，可以直接在浏览器里 import：</p>
      <Code lang="html">{`
<script type="module">
  import { createSwipe } from '${origin}/lib/swipe.js';
</script>`}</Code>
      <h2>React</h2>
      <p><code>react.js</code> 里 <code>import 'react'</code> 是裸模块名，交给打包器（esbuild、Vite……）解析即可。不用打包器时，配一个 import map：</p>
      <Code lang="html">{`
<script type="importmap">
{ "imports": { "react": "https://esm.sh/react@19" } }
</script>
<script type="module">
  import { SwipeRouter } from '${origin}/lib/react.js';
</script>`}</Code>
      <p>仓库的 <code>package.json</code> 里写好了 <code>exports</code>，作为本地包或 git 依赖安装时可以这样导入：</p>
      <Code>{`
import { createSwipe } from 'swipe-p';
import { createSwipeHistory } from 'swipe-p/history';
import { SwipeRouter } from 'swipe-p/react';
import { preventZoom } from 'swipe-p/nozoom';`}</Code>
    </Page>
  );
}

export function Api() {
  return (
    <Page title="API 速查">
      <Code>{`createSwipe(el, options?) → swipe`}</Code>
      <h3>swipe</h3>
      <Ref rows={[
        ['swipe.p', '当前这一刻的精确值。飞行中由弹簧公式算出，不是上一帧的缓存'],
        ['swipe.velocity', '速度，单位 p/ms'],
        ['swipe.state', 'idle 静止 · pending 按下 · tracking 跟手 · settling 飞行 · held 接住'],
        ['swipe.busy', '从按下到静止期间为 true；limits 冻结'],
        ['subscribe(fn)', '有东西在动时每帧调用 fn(frame)；fn 返回 true 可以再要一帧。返回取消订阅函数'],
        ['on(type, fn)', 'start：锁定为横向；release：松手 { target, proj, p, v, base }；commit：静止 { pages }'],
        ['go(n, { curve })', '用动画移动 n 页（正数返回），不受 limits 限制；飞行中调用会叠加'],
        ['enter(n = 1)', '你刚在上面加了 n 页，让它们从 n × 100 滑到 0'],
        ['wake()', '请求一帧，比如你自己的动画刚开始'],
        ['snapshot()', '立即取一份 frame 的副本'],
        ['opts', '所有参数，随时可改'],
        ['destroy()', '解除全部监听'],
      ]} />
      <h3>frame</h3>
      <Ref rows={[
        ['time', 'performance.now()'],
        ['p · v', '位置（p）和速度（p/ms）'],
        ['state · busy', '同上'],
        ['base', '本次手势的起点：0，或被接住的那次飞行的落点'],
        ['target', '本次飞行的落点，未飞行时为 null'],
        ['intent', '页面正要去的方向：拖动中看位置并带迟滞，松手后等于 target'],
        ['range', '本次允许的 p 范围 [lo, hi]'],
      ]} />
      <h3>options</h3>
      <Ref rows={[
        ['limits', '当前页能返回几页、前进几页；返回 null 禁用', '{ back: 1, forward: 0 }'],
        ['onCommit', '静止时调用，参数为移动的页数，同步更新你的 index', '—'],
        ['width', '一页的像素宽度', '元素宽度'],
        ['response', '弹簧周期（秒）', String(defaults.response)],
        ['damping', '阻尼比，< 1 会过冲', String(defaults.damping)],
        ['decel', '投影用的每毫秒衰减率，越大越容易甩过去', String(defaults.decel)],
        ['accelTau', '松手速度按加速度外推的毫秒数', String(defaults.accelTau)],
        ['rubber', '橡皮筋阻力', String(defaults.rubber)],
        ['intentOn / Off', 'intent 的切换点 / 回退点（一页的百分比）', `${defaults.intentOn} / ${defaults.intentOff}`],
        ['edge', '只允许从距离屏幕边缘多少像素内开始；0 为任意位置', String(defaults.edge)],
        ['ignore', '从这些元素上开始的触摸不触发手势', '[data-no-swipe], input…'],
        ['timeScale', '飞行慢放倍率', String(defaults.timeScale)],
        ['curve', 'go() / enter() 的 cubic-bezier；null 用弹簧', JSON.stringify(defaults.curve)],
        ['duration', '沿曲线移动一页的毫秒数，更远按 √页数 放大', String(defaults.duration)],
      ]} />
      <h3>history.js</h3>
      <Code>{`createSwipeHistory(el, { hash, base, storageKey, swipe }) → nav`}</Code>
      <Ref rows={[
        ['entries · index · current', '页面栈 [{ key, path }]、当前位置、当前项'],
        ['push(path) · replace(path)', '推入 / 替换，带动画'],
        ['back(n, { force }) · forward(n)', '像浏览器按钮一样，带动画；force 忽略拦截'],
        ['block(key)', '阻止离开某一页，返回解除函数'],
        ['on("change" | "blocked")', '栈变化 / 有页面拒绝离开'],
        ['subscribe · getSnapshot', '给 useSyncExternalStore 用'],
        ['href(path)', '给 <a href> 用的 URL'],
      ]} />
      <h3>react.js</h3>
      <Ref rows={[
        ['<SwipeRouter>', 'routes · hash · base · transition · swipe；children 渲染在页面层之上'],
        ['<Link to replace>', '带动画的推入或替换；修饰键点击保留浏览器默认行为'],
        ['useNavigator()', 'push · replace · back · forward · href · swipe'],
        ['useRoute()', '当前组件所在页面的 { path, params, query, key }'],
        ['usePageFrame(fn)', '每帧 fn(d, frame)，d 为本页位置'],
        ['useSwipeFrame(fn)', '每帧 fn(frame)，给页面之外的元素用'],
        ['useSwipeBlock(when, onBlocked)', 'when 为真时本页不能离开'],
        ['slide · matchRoute', '默认转场；路由匹配函数'],
      ]} />
    </Page>
  );
}

const SLIDERS = [
  ['response', '弹簧周期', 's', 0.2, 0.9, 0.01],
  ['damping', '阻尼比', '', 0.4, 1.3, 0.01],
  ['decel', '投影衰减', '', 0.99, 0.9995, 0.0005],
  ['rubber', '橡皮筋', '', 0.15, 1, 0.05],
  ['duration', '曲线时长', 'ms', 150, 1000, 10],
  ['timeScale', '慢放', '×', 0.1, 1, 0.05],
];
const CURVES = [
  ['默认', defaults.curve],
  ['ease-in-out', [0.65, 0, 0.35, 1]],
  ['线性', [0, 0, 1, 1]],
  ['弹簧', null],
];

export function Tune() {
  const nav = useNavigator();
  const { hud, setHud } = useSettings();
  const o = nav.swipe.opts;
  const [, force] = useState(0);
  const set = (k, v) => { o[k] = v; force((x) => x + 1); };
  const reset = () => { for (const [k] of SLIDERS) o[k] = defaults[k]; o.curve = defaults.curve; force((x) => x + 1); };
  const changed = SLIDERS.filter(([k]) => o[k] !== defaults[k]).map(([k]) => `swipe.opts.${k} = ${o[k]};`);
  if (o.curve !== defaults.curve) changed.push(`swipe.opts.curve = ${JSON.stringify(o.curve)};`);
  return (
    <Page title="手感调参">
      <p><code>swipe.opts</code> 可以随时修改。下面的滑块直接改的是<b>这个 app 自己的路由手势</b>：改完滑回首页试试。</p>
      <section className="group">
        <ul className="list">
          {SLIDERS.map(([k, label, unit, min, max, step]) => (
            <li key={k} className="slider">
              <label htmlFor={`t-${k}`}>{k}<small>{label}</small></label>
              <output>{o[k]}{unit}</output>
              <input id={`t-${k}`} type="range" min={min} max={max} step={step} value={o[k]} onChange={(e) => set(k, +e.target.value)} />
            </li>
          ))}
        </ul>
      </section>
      <h3>curve：浏览器后退 / back() / push 的曲线</h3>
      <div className="seg">
        {CURVES.map(([label, c]) => (
          <button key={label} className={JSON.stringify(o.curve) === JSON.stringify(c) ? 'on' : ''} onClick={() => set('curve', c)}>{label}</button>
        ))}
      </div>
      <Group>
        <Row label="显示 p 指示器" sub="屏幕底部，用 useSwipeFrame 实现">
          <input type="checkbox" className="switch" checked={hud} onChange={(e) => setHud(e.target.checked)} aria-label="显示 p 指示器" />
        </Row>
      </Group>
      <div className="btns"><button className="btn ghost" onClick={reset}>恢复默认</button></div>
      <Code cap="当前改动">{changed.length ? changed.join('\n') : '// 全部是默认值'}</Code>
      <p className="lead">这些改动只在本次打开期间有效，刷新后恢复默认。</p>
    </Page>
  );
}

export function NoZoom() {
  const standalone = isStandalone();
  return (
    <Page title="禁止缩放">
      <p><code>nozoom.js</code> 让安装到主屏幕的 PWA 始终保持 100%，不能被放大或缩小——整页缩放会让 app 的手势和布局全部错位。</p>
      <Code>{`
import { preventZoom } from './nozoom.js';

preventZoom();                           // 只在 PWA（独立窗口 / 全屏）模式下生效
preventZoom({ standaloneOnly: false });  // 普通网页里也生效`}</Code>
      <Group>
        <Row label="当前运行模式" detail={standalone ? 'PWA（已禁止缩放）' : '浏览器标签页'} />
      </Group>
      <p>它会拦掉这些缩放方式：</p>
      <ul className="dots">
        <li>双指捏合（包括 iOS）；</li>
        <li>双击放大；</li>
        <li>Ctrl/⌘ + 滚轮，以及触控板双指捏合；</li>
        <li>Ctrl/⌘ + <code>+</code> <code>-</code> <code>0</code> 快捷键。</li>
      </ul>
      <p>返回值是一个函数，调用它可以撤销上面所有设置。</p>
      <h2>注意</h2>
      <ul className="dots">
        <li>输入框的字号要不小于 16px，否则 iOS 在聚焦输入框时仍会自动放大。</li>
        <li>禁止缩放会影响视力不好的用户，所以默认只在 PWA 模式下开启。</li>
      </ul>
      <p>这个网站本身就调用了 <code>preventZoom()</code>：在手机浏览器里“添加到主屏幕”，从主屏幕打开，它就是一个不能缩放、全屏滑动的 app。</p>
    </Page>
  );
}
