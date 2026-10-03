# 更新记录

线上版本看首页顶部（和 react-example 底部指示条）的标记：`v<版本> · swipe.js #<swipe.js 的哈希> · 构建于 <时间>`。
哈希只由 `swipe.js` 的内容决定，所以同一份库代码永远是同一个哈希。

## v0.4.0：路由只改地址，不新增历史记录（urlOnly）

**状态：Chromium 实测；iOS Safari、Android 待真机确认。**

线上标记：`v0.4.0 · swipe.js #b32c98b`（这次只改了 `history.js` / `react.js`，`swipe.js` 没变，所以哈希和 v0.3.0 一样，看版本号区分）。

### 问题

iOS Safari 里返回会出错。推测原因：路由默认每一页都是一条真实历史记录，Safari 自己的边缘返回手势（以及后退按钮）会和页内滑动抢同一次返回，导致动画放两遍、一次退两页或页面闪动。

### 改动

- `history.js` 新增 `urlOnly` 选项，`react.js` 的 `<SwipeRouter>` 新增同名属性：
  - 整个页面栈只占一条历史记录：推入、滑动返回 / 前进、`back()` / `forward()` 时，地址栏用 `replaceState` 跟着当前页变，不再 `pushState` / `history.go()`。
  - 页面之间只能靠滑动和页面里的按钮切换；浏览器后退按钮、iOS Safari 边缘返回会直接离开整个应用。
  - 刷新后页面栈仍从 `sessionStorage` 恢复（现在也保存当前页序号）。
  - 在 hash 模式下手动输入地址：地址在栈里就飞到那一页，不在就当作推入。
- react-example（swipe.earth.icu）和 `site/` 都开启 `urlOnly`，文案同步修改。默认值仍是 `false`，不开启时行为和以前完全一样。
- 版本号 0.4.0。

### 代价

- 浏览器后退不再是“上一页”，而是离开应用。
- Android 返回键会直接关闭已安装的 PWA。
- `useSwipeBlock` 拦得住滑动和 `back()`，拦不住离开应用。

### 撤回

只要关掉这个模式（保留库里的 `urlOnly` 选项）：把 `react-example/main.jsx` 和 `site/src/main.jsx` 里 `<SwipeRouter ...>` 的 `urlOnly` 删掉，然后：

```bash
cd react-example && npm install && npm run build && cd ..   # 重新打包线上用的 app.js
git commit -am "react-example: back to one history entry per page"
git push origin HEAD:main
```

整个改动一起撤回：`git revert <本次提交>`，再按上面重新打包 `app.js` 并提交。分支 `before-url-only` 保存了这次改动之前的 `main`。

## v0.3.0：滚动和翻页互斥（测试中）

**状态：iOS Safari 实测有效；Android 浏览器（Chrome 等）未在真机上测试。** 如果 Android 上出问题，按下面的“撤回”操作。

线上标记：`swipe.js #b32c98b`

### 问题

在 iPhone 上快速斜向滑动时，内容区上下滚动和页面左右翻页会同时发生。原因是 iOS 在页面 JS 之外决定滚动，只有页面有非 passive 的 `touchmove` 监听时才会等 JS；JS 已经把手势锁定为横向时，浏览器可能仍在纵向滚动。

### 改动（两步，都在 `swipe.js` 里）

1. `2cf2d4f`：一次触摸只能滚动或翻页
   - 加非 passive 的 `touchmove` 监听：手势锁定为横向后取消浏览器滚动（和 `pointermove` 用同样的方向判断，所以两个事件谁先到都一样）。
   - 手势锁定前手指下的容器已经滚动超过 3px，就放弃这次手势。
   - 附带修复：接住飞行后变成滚动的那次按下，不再吞掉下一次点击。
   - 只做这一步时，iPhone 上仍会偶尔同时发生（有改善）。

2. `61189aa`：**锁定即冻结，滚动即让位**（本次测试的核心）
   - 触摸手势一旦锁定为横向，在同一个事件里把手指下所有可滚动容器设为 `overflow: hidden`，抬起手指后恢复原来的内联样式。鼠标拖动不冻结（经典滚动条消失会让布局跳动，而且鼠标拖动本来就不会滚动）。
   - 反过来，只要这些容器在锁定前或锁定后滚动了超过 3px，手势立刻让位：p 直接回到本次手势的起点（通常是 0；接住飞行时是那次飞行的落点），这次触摸剩下的部分只滚动。
   - 取代了第 1 步里“锁定后把滚动位置按回去”的做法。

3. `79d3a41`：react-example 重新打包，显示版本
   - swipe.earth.icu 部署的是 `react-example/`，它的 `app.js` 是提交在仓库里的打包结果，部署时不会重新构建。之前一直是第一次提交时的旧包，所以上面两步改动之前都没有上线。
   - 版本号改为 0.3.0；首页显示版本、`swipe.js` 哈希和构建时间。

### 需要在 Android 上确认的点

- 斜向快速滑动：只翻页或只滚动，不会同时发生。
- 翻页过程中页面里的长列表不会跳动或闪烁（冻结用的是 `overflow: hidden`）。
- 普通的纵向滚动没有变迟钝（非 passive 的 `touchmove` 会让浏览器在滚动开始前等 JS）。
- 先滚动、再往右滑：不应该翻页。

### 撤回

只撤回第 2 步（保留第 1 步）。已验证这次撤回没有冲突：

```bash
git revert 61189aa
cd react-example && npm install && npm run build && cd ..   # 重新打包线上用的 app.js
git add react-example/app.js && git commit -m "react-example: rebuild after reverting the scroll lock"
git push origin HEAD:main
```

撤回后线上标记会变成 `swipe.js #2322620`（和第 1 步之后的 `swipe.js` 相同），用它确认撤回已经上线。

全部撤回到这次改动之前：分支 `before-scroll-lock-test`（`afd7407`）保存了第 2 步之前的代码。注意那时的 `react-example/app.js` 还是最早的旧包，线上会回到最初的行为。
