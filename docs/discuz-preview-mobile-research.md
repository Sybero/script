# `discuz_preview` 移动端优化调研

## 调研结论

当前脚本把预览内容嵌入列表行后的 iframe，并将 iframe 高度固定为 `600px`、宽度固定为首个帖子表格的 `clientWidth`。桌面端可接受，但在手机上会产生三个直接问题：

1. **宽度可能溢出**：帖子表格宽度不等于可视视口宽度，固定像素宽度会触发横向滚动或缩放。
2. **高度与内容不匹配**：固定 600px 可能造成大量空白，也可能截断正文；跨域页面无法安全地自动测量高度。
3. **一次性加载成本高**：列表中的每个预览按钮都可创建 iframe，连续打开多个预览会增加网络、内存和滚动负担。

目标是让手机用户在帖子列表中完成“打开、阅读、关闭、返回列表”四个动作，不改变桌面端的默认体验，也不牺牲浏览器缩放和辅助技术可用性。

## 一手资料与可验证事实

| 来源 | 事实 | 对产品的含义 |
| --- | --- | --- |
| [MDN: `<meta name="viewport">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag) | `width=device-width` 让布局视口匹配设备宽度；移动浏览器可能先用较宽的虚拟视口再缩小页面；`user-scalable=no` 会损害低视力用户，通常应允许缩放。 | 预览文档应优先使用站点已有 viewport；若能注入同源文档，补齐 `width=device-width, initial-scale=1`，但不要禁用缩放。 |
| [MDN: `<iframe>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe) | iframe 是嵌套浏览上下文；`loading="lazy"` 会延迟到接近可视视口才加载，减少网络和初始加载成本；`height`/`width` 是 CSS 像素尺寸。 | 预览 iframe 默认懒加载，并使用 `width:100%`/`max-width:100%`；只在用户明确打开时加载内容。 |
| [MDN: Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) | 可异步观察目标与视口/滚动容器的交集，浏览器可优化交集计算，避免滚动处理器频繁调用布局测量。 | 预览行或占位层可用 IntersectionObserver 做预加载/回收，避免监听 `scroll` + `getBoundingClientRect()`。 |
| [MDN: VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport) | 移动端缩放和软键盘通常缩小 visual viewport；iframe 内的 VisualViewport 通常与其布局视口一致，顶层窗口才有独立的可视视口。 | 浮动关闭栏、底部操作区应根据顶层 `visualViewport` 的 `resize`/`scroll` 调整；不要假设 `window.innerHeight` 永远等于用户当前可见高度。 |
| [MDN: `history.pushState()`](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState) | 可为同源 URL 添加历史记录而不触发页面加载；返回时通过 `popstate` 恢复状态；状态对象应保持可序列化且不要过大。 | 移动端可把“当前预览的帖子 ID”写入 URL/History，使系统返回键关闭预览而不是直接离开论坛。 |
| [MDN: `touch-action`](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action) | 默认由浏览器处理平移和缩放；`manipulation` 保留平移和 pinch-zoom，同时取消非标准双击缩放；`none` 可能阻碍缩放和可访问性。 | 预览按钮可用 `touch-action: manipulation`；预览内容不要全局设 `touch-action:none`，保留页面滚动和用户缩放。 |

## 建议方案

### 方案 A：移动端“抽屉式预览”（推荐）

在窄视口（建议 CSS 媒体查询以 `max-width: 767px` 起步，实际阈值用真机数据校准）点击“预览”后，创建一个覆盖层/底部抽屉，而不是把 600px iframe 直接撑进表格：

- 抽屉宽度 `100%`，高度使用 `min(90dvh, 760px)`；正文区域独立滚动。
- 顶部固定一行：帖子标题、关闭按钮；关闭按钮至少 44 CSS px 点击区域，并有可读的 `aria-label`。
- iframe 使用 `width:100%; border:0; loading:"lazy"`，父层用 `overflow:auto`；桌面端保留当前列表内嵌行为。
- 同一时间只保留一个活动 iframe。关闭时移除节点，降低内存和后台网络活动。
- 打开时 `history.pushState({ previewId }, "", "#preview-<id>")`；监听 `popstate`，系统返回键先关闭抽屉，再回到列表。只使用同源 hash 或当前 URL 可安全承载的状态，不把正文放进 state。
- 对同源 iframe，加载完成后注入移动 viewport、隐藏站点头部和作者栏，并以 `scrollHeight` + `ResizeObserver` 更新高度；跨域时不访问 `contentDocument`，使用抽屉内部滚动和固定高度兜底。

### 方案 B：移动端新页面预览

点击后在当前标签导航到帖子 URL，增加一个“返回列表”入口。实现最简单、兼容性最好，但用户会失去列表上下文，且与脚本“列表内快速扫读”的定位冲突。仅建议作为跨域 iframe 被 CSP/X-Frame-Options 阻止时的降级路径。

### 不建议的做法

- 继续用 `iframe.style.width = <表格固定像素>`：无法适配窄屏和横竖屏切换。
- 用 `user-scalable=no` 或 `touch-action:none`“锁定”页面：会损害缩放和可访问性。
- 给所有列表项预先创建 iframe：会放大首屏加载、内存和第三方脚本执行成本。

## 交互与状态设计

状态机：`closed -> opening -> open -> closing -> closed`，并额外处理 `blocked`（iframe 被拒绝嵌入）和 `error`（加载超时/网络失败）。

- **Opening**：显示骨架和“正在加载”，按钮进入忙碌状态；避免重复点击创建多个 iframe。
- **Open**：焦点移到抽屉标题或关闭按钮；正文可垂直滚动；背景列表不可被误触。
- **Closing**：先停止/移除 iframe，再恢复原按钮状态；若关闭来自 `popstate`，不要再次 push history。
- **Blocked/Error**：显示“在新页面打开”操作，并保留原帖子链接；错误不应让列表布局永久增高。
- **方向与键盘**：横竖屏切换、软键盘弹出时重新计算抽屉最大高度；桌面键盘 `Escape` 关闭。

## 分阶段交付

### P0：移动端可用性修复

1. 以媒体查询切换抽屉布局；iframe 宽度改为百分比并限制 `max-width:100%`。
2. 增加关闭按钮、加载态、错误/被阻止降级链接、`aria` 标签和 44px 点击目标。
3. 单实例 iframe + 打开锁，避免重复创建。
4. 不禁用缩放；按钮设置 `touch-action: manipulation`。

### P1：性能与返回行为

1. 采用 `loading="lazy"` 与 IntersectionObserver 预加载/回收。
2. 使用 History API 支持系统返回键关闭预览。
3. 对同源 iframe 使用 ResizeObserver 自适应正文高度；对跨域 iframe 使用稳定的 `dvh` 高度兜底。

### P2：体验增强

1. 记住上次打开的帖子和列表滚动位置（仅保存 ID/位置，不保存正文）。
2. 根据 `prefers-reduced-motion` 关闭抽屉动画。
3. 采集匿名性能指标：打开耗时、加载失败率、关闭后返回率、横向溢出缺陷率。

## 验收标准

- 375×667、390×844、393×873、412×915 CSS px 视口下，列表和预览均无横向滚动；旋转到横屏后仍成立。
- 首次点击后 1 秒内出现加载态；网络正常时 3 秒内出现可读正文（以测试论坛和中位网络为准）。
- 连续打开/关闭 20 次，页面不出现重复 iframe、按钮重复或明显内存增长。
- 系统返回键/浏览器后退在预览打开时先关闭预览，再次后退才离开论坛；直接刷新带 hash 的 URL 时状态可恢复或安全回退到列表。
- VoiceOver/TalkBack 可读出帖子标题、关闭按钮和错误降级链接；键盘 `Tab` 可到达关闭按钮，`Escape` 可关闭。
- 跨域或 `X-Frame-Options` 阻止嵌入时，用户能在新页面打开原帖；列表布局不被错误 iframe 撑开。
- 桌面宽屏回归：保留当前列表内嵌预览行为，已有“已预览”标记继续工作。

## 风险与待验证项

- 不同 Discuz 主题的帖子 DOM、移动模板和 `viewport` 配置差异较大，需要用至少两个真实论坛主题做兼容性矩阵。
- iframe 是否同源决定能否注入 viewport、隐藏 `.pls` 和测量高度；必须先用 `location.origin` 判断，不能依赖异常捕获作为常规流程。
- 部分论坛会设置 `X-Frame-Options` 或 CSP `frame-ancestors`，应在 P0 先统计阻止比例，再决定是否把新页面降级提升为默认方案。
- 移动浏览器的软键盘会改变 visual viewport；需要在 iOS Safari、Android Chrome 各验证一次输入框和滚动锁定行为。

