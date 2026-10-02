# swipe.js

把“左右滑动翻页”这个手势变成一个数字 `p`。单文件，零依赖，不管渲染，也不管路由。

这个目录里有三层，可以按需选用：

| 文件 | 作用 |
|---|---|
| `swipe.js` | 只有手势：产出 `p` |
| `history.js` | 页面栈，和浏览器历史保持同步，不依赖任何框架 |
| `react.js` | React 路由：`<SwipeRouter>`、`<Link>`、hooks，见下文 [React 路由](#react-路由) |

- `p` 是连续值：`100` = 一页，正数表示返回，负数表示前进，静止时为 `0`。
- 手指和弹簧只负责写入 `p`，你的界面只负责读取 `p`。

## 最小用法

```html
<div id="stage" style="touch-action: pan-y"></div>
<script type="module">
  import { createSwipe } from './swipe.js';

  let index = 0; // 当前是第几页

  const swipe = createSwipe(document.getElementById('stage'), {
    limits: () => ({ back: index, forward: 0 }), // 当前页能往回滑几页、往前滑几页；返回 null 表示禁用手势
    onCommit: (n) => { index -= n; },            // p 停在 n × 100，并已归零：在这里移动你的 index
  });

  swipe.subscribe(({ p }) => {
    const s = index - p / 100; // 连续位置
    // 对第 i 页：d = i - s。0 = 在屏幕上，+1 = 已移到右边，-1 = 被新页面盖住
  });

  // 推入新页面：先把页面加进你的栈，再调用：
  index++;
  swipe.enter();
</script>
```

完整可运行的例子见 [`example.html`](example.html)，一共约 60 行。

## 规则

- **松手判定**：先算出手指甩出去会滑到哪里（投影），再选离投影最近的、允许的整页落点。
- **一次最多翻一页**：一次手势只能落在它的起点 `base` 前后一页之内。
- **连续翻页**：在飞行途中按住页面叫“接住”。接住后，本次手势的起点就是那次飞行的目标，所以再甩一次可以翻到 200、300……
- **范围冻结**：从手指按下到页面完全静止，`limits()` 只在开始时读取一次，期间 `swipe.busy` 为 `true`。这段时间里你自己的跳转需要排队，等 `onCommit` 之后再执行。
- **超出范围**：在 `limits` 之外只有橡皮筋阻力。`{ back: 0, forward: 0 }` 表示“能拖但拖不动”，可以用在不允许返回的页面上。
- **点击不会误触发**：拖动后松手、或者接住飞行时的那次按下，都不会触发点击。页面基本到位后的点击照常生效。
- **鼠标等同于手指**：桌面上鼠标按住横向拖动和触摸滑动完全一样。拖动期间不会选中文字，也不会触发链接、图片的原生拖拽。
- **两种飞行方式**：手指松手后，页面沿弹簧飞行，并继承手指的速度；`go()`、`enter()` 这类没有手指参与的跳转，沿贝塞尔曲线平滑过渡（`curve`、`duration`）。

## API

```ts
createSwipe(el, options?) → swipe
```

| 成员 | 说明 |
|---|---|
| `swipe.p` | 当前这一刻的精确值。飞行中由弹簧公式算出，不是上一帧的缓存 |
| `swipe.velocity` | 速度，单位是 p/ms |
| `swipe.state` | `idle` 静止、`pending` 按下、`tracking` 跟手、`settling` 飞行、`held` 接住 |
| `swipe.busy` | 从按下到静止期间为 `true` |
| `swipe.subscribe(fn)` | 只要有东西在动，每帧调用一次 `fn(frame)`；同一帧里所有订阅者拿到同一个 `frame`。`fn` 返回 `true` 可以再要一帧（用于你自己的动画）。返回值是取消订阅的函数 |
| `swipe.on(type, fn)` | `start`：拖动锁定为横向；`release`：松手，参数是 `{ target, proj, p, v, base }`；`commit`：静止，参数是 `{ pages }` |
| `swipe.go(n, { curve })` | 用动画移动 n 页（正数返回、负数前进），不受 `limits` 限制。飞行中调用会叠加到目标上。`curve` 设为 `null` 时改用弹簧 |
| `swipe.enter(n = 1, { curve })` | 你刚在上面加了 n 页，让它们从 `p = n × 100` 滑到 0 |
| `swipe.wake()` | 请求一帧，比如你自己的动画刚开始 |
| `swipe.snapshot()` | 立即取一份 `frame` 的副本 |
| `swipe.opts` | 所有参数，可以随时修改，例如 `swipe.opts.response = 0.5` |
| `swipe.destroy()` | 解除全部监听 |

`frame` 包含这些字段：`{ time, p, v, state, busy, base, target, intent, range }`。

- `target`：本次飞行的落点，未飞行时为 `null`。
- `intent`：页面正要去的方向。拖动中只看位置并带迟滞，所以不会抖；松手后等于 `target`。适合“决定离开后按自己节奏退场”的元素。

### 参数

| 参数 | 默认值 | 作用 |
|---|---|---|
| `limits` | `() => ({ back: 1, forward: 0 })` | 当前页能返回几页、前进几页；`null` 表示禁用 |
| `onCommit` | — | 静止时调用，参数为移动的页数 |
| `width` | 元素宽度 | 一页的像素宽度 |
| `response` / `damping` | `0.42` / `0.92` | 弹簧周期（秒）/ 阻尼比 |
| `decel` | `0.998` | 投影用的每毫秒衰减率，越大越容易甩过去 |
| `accelTau` | `20` | 松手速度按加速度外推的毫秒数，0 表示只看速度 |
| `rubber` | `0.55` | 橡皮筋阻力 |
| `intentOn` / `intentOff` | `50` / `30` | `intent` 的切换点和回退点（占一页的百分比） |
| `edge` | `0` | 只允许从距离屏幕边缘多少像素内开始；0 表示任意位置 |
| `ignore` | 输入框等 | 从这些元素上开始的触摸不触发手势（CSS 选择器），默认包括 `[data-no-swipe]` |
| `timeScale` | `1` | 飞行慢放倍率 |
| `curve` | `[0.32, 0.72, 0, 1]` | `go()` / `enter()` 使用的 cubic-bezier 曲线；`null` 表示也用弹簧 |
| `duration` | `460` | 沿曲线移动一页的毫秒数，距离更长时按 √页数 放大 |

## 注意

- 手势元素需要 `touch-action: pan-y`，否则浏览器会抢走横向滑动。如果元素的值是 `auto`，库会自动加上。**元素里面的纵向滚动容器也要加 `touch-action: pan-y`**。
- `onCommit` 里必须**同步**更新你的页码。此时 `p` 已经归零，页码同步变化后，画面位置 `index - p/100` 不会跳。
- 库不设置任何样式，也不移动任何元素，画面怎么变完全由你在 `subscribe` 里决定。

## React 路由

`react.js` 基于 `history.js` 实现，用于 SPA：路由（历史管理）、手势、浏览器前进后退，三件事统一处理。

```jsx
import { SwipeRouter, Link, useNavigator, useRoute, usePageFrame, useSwipeBlock } from './swipe/react.js';

const routes = { '/': Home, '/item/:id': Item, '*': NotFound }; // 按顺序匹配

createRoot(root).render(<SwipeRouter routes={routes} hash />);

function Item({ params, query }) {
  const nav = useNavigator();            // push / replace / back / forward / href / swipe
  return <>
    <button onClick={() => nav.back()}>返回</button>
    <Link to={`/item/${+params.id + 1}`}>下一项</Link>
  </>;
}
```

**行为**

- **每一页都是一条真实的浏览器历史记录**，有自己的 URL。不再使用插入哨兵记录的伪历史。
- **浏览器的后退 / 前进**（按钮、Alt + ←/→、鼠标侧键）：地址栏立刻变化，但页面不会瞬间切换，而是沿贝塞尔曲线播放进退动画。连按几次会合并成一次飞行。
- **手势返回 / 前进**：页面落地后，再用 `history.go(±n)` 把地址栏带过去。
- **前进记录的清理**：返回之后再 `push` 新页面，原来的前进记录会被丢弃，浏览器和页面栈保持一致。
- **刷新后栈还在**：页面栈保存在 `sessionStorage` 里，刷新后仍然可以滑回之前的页面。
- **页面保活**：被盖住的页面不会卸载，滚动位置和输入内容都会保留。
- **动画不触发 React 渲染**：每帧直接写样式；只有页面栈变化时 React 才重新渲染。

**组件与 hooks**

| 名称 | 作用 |
|---|---|
| `<SwipeRouter routes hash base transition swipe>` | `hash`：使用 `#/path` 形式的 URL，任何静态托管都能用；`base`：不用 hash 时的路径前缀；`transition(page, d, frame)`：自定义页面动画，默认是 iOS 风格的 `slide`；`swipe`：swipe.js 的参数。子元素会渲染在页面层之上，适合放 tab 栏 |
| `<Link to replace>` | 带动画的推入或替换。按住 Ctrl / ⌘ 等修饰键点击时，保留浏览器的默认行为 |
| `useNavigator()` | `push(path)`、`replace(path)`、`back(n, { force })`、`forward(n)`、`href(path)`、`swipe` |
| `useRoute()` | 当前组件所在页面的 `{ path, params, query, key }` |
| `usePageFrame(fn)` | 每帧调用 `fn(d, frame)`，`d` 是本页的位置：`0` 在屏幕上，`+1` 已离开，`-1` 被盖住。用来给页面里的模块做各自的动画 |
| `useSwipeFrame(fn)` | 每帧调用 `fn(frame)`，给页面之外的元素用，比如 tab 栏 |
| `useSwipeBlock(when, onBlocked)` | `when` 为真时，本页不能通过滑动、`back()` 或浏览器后退离开，改为调用 `onBlocked`。`back(1, { force: true })` 可以强制离开 |

页面结构是 `.swipe-page > .swipe-scroll`（页面自己的滚动容器）加上 `.swipe-dim`（被盖住时的遮罩）。页面背景用 CSS 变量 `--swipe-page-bg` 设置，做毛玻璃这类透明页面时设为 `transparent`。

不用 hash 模式时，服务器需要把所有路径都回退到 `index.html`（SPA fallback）。在 Cloudflare 上可以在 `assets` 里设置 `not_found_handling: "single-page-application"`。

完整示例见 [`react-example/`](react-example/)：

```bash
cd react-example && npm install && npm run build   # 生成 app.js（已包含 React）
```
