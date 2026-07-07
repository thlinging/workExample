import interact from 'interactjs'
import {
  getShared,
  clearShared,
  lockInteraction,
  unlockInteraction,
  translateBy,
  commitTranslate
} from '../modal-shared'
import './style.css'

const CTX = '__resizeModalCtx__'

function resolveOptions(binding) {
  const v = binding.value || {}
  return {
    // interactjs 的 edges 只认 top/right/bottom/left 四个键，四角由相邻两边同时开启时自动生成。
    // 默认四边全开（含四角），实现类似 Windows 窗口的任意边/角调整。
    edges: v.edges || { top: true, right: true, bottom: true, left: true },
    minWidth: v.minWidth || 320,
    minHeight: v.minHeight || 200,
    maxWidth: v.maxWidth || 99999,
    maxHeight: v.maxHeight || 99999,
    initialWidth: v.initialWidth != null ? v.initialWidth : null,
    initialHeight: v.initialHeight != null ? v.initialHeight : null,
    // 边缘缩放热区宽度（px）：离边/角多近就能触发缩放。太小不好对准，故默认放宽到 16；
    // 业务可通过 margin 选项覆盖。注意值越大越靠内，会占用边缘附近内容的点击区域。
    margin: v.margin != null ? v.margin : 16,
    showHandle: v.showHandle !== false,
    // 缩放时把弹窗边缘约束在视口内：碰到屏幕边缘就停（默认开启，可传 false 关闭）
    restrictToViewport: v.restrictToViewport !== false,
    // 视口约束的内边距：离屏幕边缘留出的空隙，默认 0
    viewportGap: v.viewportGap != null ? v.viewportGap : 0,
    onResize: typeof v.onResize === 'function' ? v.onResize : null,
    onResizeStart: typeof v.onResizeStart === 'function' ? v.onResizeStart : null,
    onResizeEnd: typeof v.onResizeEnd === 'function' ? v.onResizeEnd : null
  }
}

// 把 initialWidth / initialHeight 归一成 px：interactjs 拖拽与 body 高度计算都基于 px，
// 所以 vh / vw / % 这类相对单位必须在套用前换算成像素。
// 支持：数字(=px) | '560' | '560px' | '70vh' | '50vw' | '80%'
function toPx(val, axis) {
  if (val == null) return null
  if (typeof val === 'number') return val
  const s = String(val).trim()
  const num = parseFloat(s)
  if (Number.isNaN(num)) return null
  if (s.endsWith('vh')) return (num / 100) * window.innerHeight
  if (s.endsWith('vw')) return (num / 100) * window.innerWidth
  if (s.endsWith('%')) return (num / 100) * (axis === 'w' ? window.innerWidth : window.innerHeight)
  return num // px 或纯数字
}

// 根据正在拖动的边/角返回对应的缩放光标，供 iframe 屏蔽层使用：
// 屏蔽层盖在把手之上后，指针会丢失把手原本的 resize 光标，这里补回来。
function resizeCursor(edges) {
  const { top, bottom, left, right } = edges || {}
  if ((top && left) || (bottom && right)) return 'nwse-resize'
  if ((top && right) || (bottom && left)) return 'nesw-resize'
  if (left || right) return 'ew-resize'
  if (top || bottom) return 'ns-resize'
  return ''
}

// 弹窗是否垂直居中（antd 的 centered 属性会在 .ant-modal-wrap 上加 ant-modal-centered）。
// 默认弹窗用 top:100px 顶部锚定，仅水平 margin:auto 居中；centered 时垂直也变成居中，
// resize 高度时需要和水平方向一样做对称补偿，否则弹窗会以中心上下铺开把顶部顶出视口。
function isVerticallyCentered(modal) {
  const wrap = modal.closest('.ant-modal-wrap')
  return !!(wrap && wrap.classList.contains('ant-modal-centered'))
}

// 是否为随视口变化的相对单位，需要在 window resize 时重算
function isViewportUnit(val) {
  if (typeof val !== 'string') return false
  const s = val.trim()
  return s.endsWith('vh') || s.endsWith('vw') || s.endsWith('%')
}

function applySize(modal, content, width, height) {
  // 宽高取整：小数宽度配合 antd 的 margin:auto 水平居中，会让左边缘落在半像素上，
  // 进而使内部 iframe / 文字发虚；取整让边缘吸附到整数像素。
  if (width != null) width = Math.round(width)
  if (height != null) height = Math.round(height)
  if (width != null) {
    modal.style.width = width + 'px'
    content.style.width = width + 'px'
  }
  if (height != null) {
    content.style.height = height + 'px'
    const header = content.querySelector('.ant-modal-header')
    const footer = content.querySelector('.ant-modal-footer')
    const body = content.querySelector('.ant-modal-body')
    if (body) {
      const headerH = header ? header.offsetHeight : 0
      const footerH = footer ? footer.offsetHeight : 0
      body.style.height = Math.max(0, height - headerH - footerH) + 'px'
      body.style.overflow = 'auto'
      body.style.boxSizing = 'border-box'
    }
  }
}

// 等弹窗入场动画/过渡结束后执行一次回调（带超时兜底），返回取消函数。
// 用于高度延迟测量：监听 .ant-modal 自身的 animationend / transitionend（antd 的
// antZoomIn 缩放入场结束时触发）；若动画名不确定、无入场动画或事件未触发，用 350ms
// 超时兜底，保证回调一定跑一次且只跑一次。
function measureAfterSettle(modal, cb) {
  let done = false
  let timer = null
  const cleanup = () => {
    modal.removeEventListener('animationend', onEnd)
    modal.removeEventListener('transitionend', onEnd)
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }
  const run = () => {
    if (done) return
    done = true
    cleanup()
    cb()
  }
  // 只认弹窗自身的动画/过渡，忽略子元素冒泡上来的事件（如内部按钮的过渡）
  const onEnd = e => {
    if (e.target === modal) run()
  }
  const cancel = () => {
    if (done) return
    done = true
    cleanup()
  }
  modal.addEventListener('animationend', onEnd)
  modal.addEventListener('transitionend', onEnd)
  timer = setTimeout(run, 350)
  return cancel
}

// 高度缺省时的延迟自动测量：等入场动画稳定后测 content 的真实布局高度并套用，
// 避开动画中间态。测得的高度记为初始尺寸，之后行为与显式设定 initialHeight 一致。
function scheduleAutoHeight(el) {
  const ctx = el[CTX]
  if (!ctx || !ctx.modal || !ctx.content) return
  ctx.cancelAutoHeight = measureAfterSettle(ctx.modal, () => {
    const c = el[CTX]
    if (!c || !c.content) return
    // 期间若业务已显式设了高度 / 用户已手动拖过 / 正在拖动，则不覆盖
    if (c.rawHeight != null || c.manualResize || c.resizing) return
    const h = c.content.offsetHeight
    if (!h) return // 量不到（如已隐藏）就不动，保持自然高度
    applySize(c.modal, c.content, null, h)
    c.lastHeight = h
  })
}

function tryBind(el, binding, retry = 0) {
  const content = el.closest('.ant-modal-content')
  const modal = el.closest('.ant-modal')
  if (!content || !modal) {
    if (retry < 30) {
      const timer = setTimeout(() => tryBind(el, binding, retry + 1), 30)
      el[CTX] = { timer }
    }
    return
  }
  doBind(el, binding, modal, content)
}

function doBind(el, binding, modal, content) {
  const opts = resolveOptions(binding)
  modal.classList.add('v-resize-modal-target')
  if (opts.showHandle) modal.classList.add('v-resize-modal--show-handle')

  // 注意：inserted 钩子在弹窗 antZoomIn 入场动画刚开始时就执行，此时 .ant-modal 上
  // 带有 transform: scale(...)。getBoundingClientRect() 会算上 transform，量到的宽高
  // 接近 0，会把弹窗锁死成 0 尺寸（看起来像“打不开”）。
  // offsetWidth/offsetHeight 返回布局尺寸、不受 transform 影响，故改用它们。
  // 保留业务传入的原始值（可能是 '70vh' 这类字符串），px 值用于实际套用与比较
  const rawW = opts.initialWidth
  const rawH = opts.initialHeight
  // 宽度：offsetWidth 不受入场动画的 scale 影响，缺省时立即量取即可靠。
  const initW = rawW != null ? toPx(rawW, 'w') : modal.offsetWidth
  // 高度：显式值立即换算套用；缺省则不在此刻锁死——弹窗高度由内容撑开，动画未结束 /
  // 字体未加载 / 异步内容都可能让此刻量到的是中间态高度。改为延迟到入场动画稳定后
  // 再自动测量套用（见下方 scheduleAutoHeight），套用前保持 antd 的自然高度。
  const initH = rawH != null ? toPx(rawH, 'h') : null
  applySize(modal, content, initW, initH)

  const modifiers = []
  // 先做视口约束：缩放的边缘不能越出视口，碰到屏幕边缘即停。
  // outer 用函数返回，window resize 后实时取最新视口尺寸。
  if (opts.restrictToViewport) {
    const gap = opts.viewportGap
    modifiers.push(
      interact.modifiers.restrictEdges({
        outer: () => ({
          left: gap,
          top: gap,
          right: window.innerWidth - gap,
          bottom: window.innerHeight - gap
        })
      })
    )
  }
  modifiers.push(
    interact.modifiers.restrictSize({
      // 用函数返回，interactjs 会在每次约束时实时求值：
      // 这样 min/max 也能用 vh/vw/%，且视口变化时自动按当前视口换算。
      min: () => ({ width: toPx(opts.minWidth, 'w'), height: toPx(opts.minHeight, 'h') }),
      max: () => ({ width: toPx(opts.maxWidth, 'w'), height: toPx(opts.maxHeight, 'h') })
    })
  )

  const interactable = interact(content).resizable({
    edges: opts.edges,
    margin: opts.margin,
    modifiers,
    listeners: {
      start: e => {
        const c = el[CTX]
        if (c) {
          c.resizing = true
          // 整段缩放手势内居中模式不变，开始时测一次即可（避免每帧 closest 查 DOM）
          c.centeredY = isVerticallyCentered(modal)
        }
        // 关选区 + 拦原生拖拽 + 锁 wrap 滚动 + 铺 iframe 屏蔽层；光标跟随当前缩放方向
        lockInteraction(resizeCursor(e.edges), modal)
        opts.onResizeStart && opts.onResizeStart({ width: e.rect.width, height: e.rect.height })
      },
      move: e => {
        const { width, height } = e.rect
        applySize(modal, content, width, height)
        // 抵消 antd 的 margin:auto / 居中：尺寸变化时弹窗会以锚定基线对称铺开，
        // 而 interactjs（含 restrictEdges 视口约束）是按“锚定被拖的对侧、拖动侧伸缩”计算的。
        // 不补偿的话，拖上边/左边时实际动的会是对侧边，方向与用户预期相反。
        // 用共享位移平移，使实际边与 interactjs 一致：
        // - 水平：antd 始终 margin:auto 水平居中，左右对称铺开，补 (left+right)/2，对左右边都成立。
        // - 垂直 centered：同理上下居中，补 (top+bottom)/2。
        // - 垂直默认（top:100px 顶部锚定）：下边天然自由伸缩（deltaRect.top=0 不补）；
        //   拖上边时 CSS 仍锚定顶部会让下边下移，需整体上移 deltaRect.top 把下边拉回原位。
        const compX = (e.deltaRect.left + e.deltaRect.right) / 2
        const c = el[CTX]
        const compY = c && c.centeredY
          ? (e.deltaRect.top + e.deltaRect.bottom) / 2
          : e.deltaRect.top
        if (compX || compY) translateBy(modal, compX, compY)
        opts.onResize && opts.onResize({ width, height })
      },
      end: e => {
        const c = el[CTX]
        if (c) {
          c.manualResize = true // 用户手动拖过后，不再让视口变化自动覆盖
          c.resizing = false
        }
        unlockInteraction()
        // 居中补偿产生的位移也落盘进 left/top，稳态不留 transform（防关闭动画顶掉位移）
        commitTranslate(modal)
        opts.onResizeEnd && opts.onResizeEnd({ width: e.rect.width, height: e.rect.height })
      }
    }
  })

  // 记录“最后一次显式应用的尺寸”，用于 componentUpdated 时判断业务是否改了宽高。
  // 注意：不在 move 拖拽里更新 lastWidth/lastHeight，否则拖拽过程中触发的重渲染
  // 会让 syncSize 误判“尺寸变了”而把正在拖的弹窗重置回 initialWidth。
  // rawWidth/rawHeight 保存原始单位值，供视口重算与变更比较使用。
  const onViewportResize = () => handleViewportResize(el)
  window.addEventListener('resize', onViewportResize)
  const ctx = {
    interactable, modal, content,
    rawWidth: rawW, rawHeight: rawH,
    // 高度缺省时 initH 为 null，先用当前 offsetHeight 占位（延迟测量后会被真实值覆盖），
    // 保证 handleViewportResize / syncSize 里的高度回退值始终是个数字。
    lastWidth: initW, lastHeight: initH != null ? initH : content.offsetHeight,
    manualResize: false,
    resizing: false,
    centeredY: false, // 缩放开始时据 antd centered 决定垂直是否需要居中补偿
    cancelAutoHeight: null, // 高度延迟测量的取消句柄（unbind 时调用，避免测量泄漏）
    onViewportResize
  }
  // 供 fullscreen 退出 clamp 时强制设定尺寸：套用并记为手动尺寸，
  // 之后视口变化不再自动覆盖（与用户手动拖拽一致）。
  ctx.setSize = (w, h) => {
    applySize(modal, content, w, h)
    ctx.lastWidth = w
    ctx.lastHeight = h
    ctx.manualResize = true
  }
  el[CTX] = ctx
  getShared(modal).resize = ctx

  // 高度缺省：延迟到入场动画稳定后再自动测量并套用真实内容高度。
  if (rawH == null) scheduleAutoHeight(el)
}

// 视口尺寸变化时，对用 vh/vw/% 表达的维度重新换算 px 并套用。
// 用户手动拖拽过则不再自动跟随，避免覆盖其调好的尺寸。
function handleViewportResize(el) {
  const ctx = el[CTX]
  if (!ctx || !ctx.content || ctx.manualResize) return

  let width = ctx.lastWidth
  let height = ctx.lastHeight
  let changed = false
  if (isViewportUnit(ctx.rawWidth)) { width = toPx(ctx.rawWidth, 'w'); changed = true }
  if (isViewportUnit(ctx.rawHeight)) { height = toPx(ctx.rawHeight, 'h'); changed = true }

  if (changed) {
    applySize(ctx.modal, ctx.content, width, height)
    ctx.lastWidth = width
    ctx.lastHeight = height
  }
}

// 业务逻辑改变了 initialWidth / initialHeight 时，重新套用尺寸（响应式跟随）。
function syncSize(el, binding) {
  const ctx = el[CTX]
  if (!ctx || !ctx.content) return // 还没绑定成功（仍在重试），交给 inserted 流程

  const opts = resolveOptions(binding)
  let width = ctx.lastWidth
  let height = ctx.lastHeight
  let changed = false

  // 用“原始值”比较（'70vh' !== 615px），避免每次重渲染都误判为变更
  if (opts.initialWidth != null && opts.initialWidth !== ctx.rawWidth) {
    ctx.rawWidth = opts.initialWidth
    width = toPx(opts.initialWidth, 'w')
    changed = true
  }
  if (opts.initialHeight != null && opts.initialHeight !== ctx.rawHeight) {
    ctx.rawHeight = opts.initialHeight
    height = toPx(opts.initialHeight, 'h')
    changed = true
  }

  if (changed) {
    applySize(ctx.modal, ctx.content, width, height)
    ctx.lastWidth = width
    ctx.lastHeight = height
    ctx.manualResize = false // 业务显式改了尺寸，恢复视口自动跟随
  }
}

function release(el) {
  const ctx = el[CTX]
  if (!ctx) return
  if (ctx.timer) clearTimeout(ctx.timer)
  if (ctx.cancelAutoHeight) ctx.cancelAutoHeight() // 取消未触发的高度延迟测量，避免泄漏
  if (ctx.onViewportResize) window.removeEventListener('resize', ctx.onViewportResize)
  // 缩放进行中被卸载：end 不会触发，补一次解锁，避免全局选区锁泄漏
  if (ctx.resizing) unlockInteraction()
  if (ctx.interactable) ctx.interactable.unset()
  if (ctx.modal) {
    clearShared(ctx.modal, 'resize')
    ctx.modal.classList.remove('v-resize-modal-target', 'v-resize-modal--show-handle')
    ctx.modal.style.width = ''
  }
  delete el[CTX]
}

// 默认导出指令本身（{ inserted, componentUpdated, unbind }）；
// 指令的注册（Vue.directive）由 directives/index.js 的安装函数统一完成。
const directive = {
  inserted(el, binding) {
    tryBind(el, binding)
  },
  // 宿主组件重渲染后触发：若业务改了 initialWidth / initialHeight，则跟随更新尺寸
  componentUpdated(el, binding) {
    syncSize(el, binding)
  },
  unbind(el) {
    release(el)
  }
}

export default directive
