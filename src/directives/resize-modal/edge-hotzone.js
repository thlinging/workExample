/**
 * 左右边缘缩放热区
 *
 * 解决「弹窗内嵌 iframe 且铺满 body 时，左右边缘几乎抓不住」：
 * iframe 是独立的 browsing context，指针一进去事件就归 iframe 文档，父页面收不到
 * pointermove/pointerover，interactjs 的边缘判定（margin 判定区）根本没机会跑。
 * 注意这和「松手后仍持续变化」是同一个根、不同阶段：那个发生在交互中，已由
 * modal-shared 的屏蔽层解决；屏蔽层要等 start 之后才铺，管不到这里的 hover 阶段。
 *
 * 上下边不需要热区：.ant-modal-header / .ant-modal-footer 是父文档元素，
 * 它们两侧的判定区一直是通的，盲区只有 body（iframe）对应的那一段。
 *
 * 做法是两段式，兼顾「不挡 iframe」和「任意高度都能抓」：
 *   - 平时只留一条 idleSize(默认 3px) 的窄条，遮挡小到可忽略；
 *   - 指针从弹窗外侧靠近左/右边缘时（遮罩是父文档元素，这段路事件收得到），
 *     整条热区瞬时张开到 activeSize(默认 12px)，全高可抓。
 * 残留盲区只有「指针本来就在 iframe 里、直接横移到边缘」，靠那条常开窄条兜底；
 * 实测中指针往外移很容易越过边界进遮罩，一进就张开了。
 */

// 指针在弹窗外侧多远就把热区张开。24px：够从遮罩区斜着接近时提前张开，
// 又不至于在弹窗附近随便动一下就亮条。
const APPROACH = 24

// 会吞掉指针事件的嵌套文档（auto 模式据此判断要不要铺热区）
const FRAME_SELECTOR = 'iframe, embed, object, frame'

/**
 * @param {HTMLElement} content .ant-modal-content（interactjs 的 resizable 目标）
 * @param {Object} options
 *   mode        'auto'(默认) 检测到嵌套文档才铺 | true 一律铺 | false 关闭
 *   activeSize  张开后的宽度(px)
 *   idleSize    平时常开的窄条宽度(px)
 *   margin      interactjs 的 edges 判定区宽度，热区宽度会被 clamp 到它以内
 *   isBusy      返回 true 时跳过热区开合（缩放进行中，见下）
 * @returns {{ destroy: Function }|null}
 */
export function createEdgeHotzone(content, options) {
  const opts = options || {}
  const mode = opts.mode
  if (mode === false || !content) return null

  const margin = opts.margin
  // 热区宽度绝不能超过 interactjs 的 margin 判定区：超出的部分既不触发缩放，
  // 又白白吃掉 iframe 的点击，比不加还糟。
  const activeSize = Math.max(1, Math.min(opts.activeSize, margin))
  const idleSize = Math.max(0, Math.min(opts.idleSize, activeSize))
  const isBusy = typeof opts.isBusy === 'function' ? opts.isBusy : () => false

  let els = null // { left, right }，null 表示未挂载
  let observer = null

  function makeEl(side) {
    const el = document.createElement('div')
    el.className = 'v-resize-hotzone v-resize-hotzone--' + side
    // 宽度走 CSS 变量：张开态只需换一个变量值，样式规则留在 style.css 里
    el.style.setProperty('--v-hotzone-idle', idleSize + 'px')
    el.style.setProperty('--v-hotzone-active', activeSize + 'px')
    return el
  }

  function setActive(el, on) {
    // pointermove 频率很高，只在状态翻转时写 DOM
    if (el.__hotzoneActive === on) return
    el.__hotzoneActive = on
    el.classList.toggle('is-active', on)
  }

  function onPointerMove(e) {
    // 缩放进行中不开合：此时 rect 每帧在变，跟着算只会让热区宽度抖动；
    // 而且 start 之后 edges 已定，interactjs 不再依赖热区元素。
    if (!els || isBusy()) return
    const rect = content.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const x = e.clientX
    const y = e.clientY
    // 纵向同样放宽 APPROACH：从弹窗左上/左下斜着接近时也提前张开
    const nearY = y >= rect.top - APPROACH && y <= rect.bottom + APPROACH
    setActive(els.left, nearY && x >= rect.left - APPROACH && x <= rect.left + margin)
    setActive(els.right, nearY && x <= rect.right + APPROACH && x >= rect.right - margin)
  }

  // 指针从热区移进嵌套文档时收回窄条。
  // 必须单独处理：进了 iframe 之后父文档就收不到 pointermove 了，热区会一直冻在
  // 张开态、白白多挡十来 px。而「跨越边界进入 iframe」这一刻 pointerleave 仍在
  // 父文档派发（iframe 元素本身属于父文档），正好卡住这个时机。
  // 只认 relatedTarget 是嵌套文档的情况：移到 header / 遮罩等父文档元素上时不插手，
  // 交给紧随其后的 pointermove 按坐标判定，避免多出一帧闪动。
  function onPointerLeave(e) {
    if (isBusy()) return
    const to = e.relatedTarget
    if (to && typeof to.matches === 'function' && to.matches(FRAME_SELECTOR)) {
      setActive(e.currentTarget, false)
    }
  }

  function mount() {
    if (els) return
    els = { left: makeEl('left'), right: makeEl('right') }
    els.left.addEventListener('pointerleave', onPointerLeave)
    els.right.addEventListener('pointerleave', onPointerLeave)
    // 追加到 content 末尾：排在 .ant-modal-body 之后，配合 z-index 压在 iframe 之上
    content.appendChild(els.left)
    content.appendChild(els.right)
    // 挂 document 而不是 .ant-modal-wrap：指针在遮罩上、乃至滑出弹窗很远时都要收得到，
    // 「从外侧靠近就张开」全靠这段事件。passive：只读坐标，不阻断滚动。
    document.addEventListener('pointermove', onPointerMove, { passive: true })
  }

  function unmount() {
    if (!els) return
    document.removeEventListener('pointermove', onPointerMove)
    els.left.removeEventListener('pointerleave', onPointerLeave)
    els.right.removeEventListener('pointerleave', onPointerLeave)
    if (els.left.parentNode) els.left.parentNode.removeChild(els.left)
    if (els.right.parentNode) els.right.parentNode.removeChild(els.right)
    els = null
  }

  function sync() {
    if (mode === true || content.querySelector(FRAME_SELECTOR)) mount()
    else unmount()
  }

  sync()
  // auto 模式下 iframe 常是异步/条件渲染的（v-if、接口回来才挂），绑定那一刻查不到，
  // 故持续观察 content 子树：出现就铺、移除就撤。
  // 不会自激：mount/unmount 触发的 mutation 再回到 sync 时状态已一致，直接 return。
  if (mode !== true && typeof MutationObserver === 'function') {
    observer = new MutationObserver(sync)
    observer.observe(content, { childList: true, subtree: true })
  }

  return {
    destroy() {
      if (observer) {
        observer.disconnect()
        observer = null
      }
      unmount()
    }
  }
}

export default createEdgeHotzone
