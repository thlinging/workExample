import interact from 'interactjs'
import {
  getShared,
  clearShared,
  lockInteraction,
  unlockInteraction,
  translateBy,
  getTranslate,
  commitTranslate
} from '../modal-shared'
import './style.css'

const CTX = '__dragModalCtx__'

function resolveOptions(binding) {
  const v = binding.value || {}
  return {
    // 拖拽把手选择器，默认弹窗头部
    handle: v.handle || '.ant-modal-header',
    // 是否禁用拖拽（业务可动态切换）
    disabled: v.disabled === true,
    onDragStart: typeof v.onDragStart === 'function' ? v.onDragStart : null,
    onDrag: typeof v.onDrag === 'function' ? v.onDrag : null,
    onDragEnd: typeof v.onDragEnd === 'function' ? v.onDragEnd : null
  }
}

// 用 transform: translate 移动 .ant-modal，不动 antd 自带的 top / margin:auto 居中，
// 位移只是叠加在居中基线之上。位移累积保存在共享状态（modal-shared 的 tx/ty）里，
// 这样 resize 改宽时能用同一份位移做居中补偿，drag 与 resize 不会互相覆盖 transform。

// 计算把弹窗矩形钳回视口所需的位移增量（纯函数，方便单测）。分维度处理：
// - 不超过视口的维度：关在视口内（左/上 ≥ 0、右/下 ≤ 视口）；
// - 比视口更大的维度（超宽/超高）：撤销该轴的拖拽位移（回到自然位置，translate 归 0），
//   把该方向的查看交给 .ant-modal-wrap 的原生滚动。原因：拖拽把手在弹窗顶部，弹窗比视口
//   高时想靠拖动露出底部，必须把弹窗（连同把手）拖出屏幕顶端——一旦把手离开视口就抓不住、
//   拖不动了（实测 700px 上拖只挪了 ~176px 就因指针触顶失效，底部够不到）。故超尺寸时不再
//   用位移「铺满/平移」，而是让弹窗停在自然位置、由 wrap 滚动条查看上下（antd 原生行为）。
//   translate 传入当前位移 { x, y }，超尺寸轴返回 -translate 即撤销到自然位。
//   （手势结束会把位移落盘进 left/top —— commitTranslate，故交互中的 translate 只含
//   本次手势的增量，撤销即回到本次手势起点＝上次落盘的位置。）
export function computeClampDelta(rect, vw, vh, translate = { x: 0, y: 0 }) {
  let dx = 0
  let dy = 0
  if (rect.width <= vw) {
    if (rect.left < 0) dx = -rect.left
    else if (rect.right > vw) dx = vw - rect.right
  } else {
    dx = translate.x === 0 ? 0 : -translate.x
  }
  if (rect.height <= vh) {
    if (rect.top < 0) dy = -rect.top
    else if (rect.bottom > vh) dy = vh - rect.bottom
  } else {
    dy = translate.y === 0 ? 0 : -translate.y
  }
  return { dx, dy }
}

// 读取当前弹窗矩形，按 computeClampDelta 钳回视口（window.innerWidth/innerHeight）。
// 拖拽期间可滚动的 .ant-modal-wrap 会被临时置为 overflow:hidden（lockInteraction 里的
// lockWrapScroll，见 modal-shared.js），故此时 wrap 不会长出滚动条，用 window 尺寸即稳定钳制。
// 注意：**不能改用 wrap.clientWidth/Height 逐帧钳制**——那样弹窗贴边→wrap 长滚动条→
// client 缩 15px→拉回→无溢出→滚动条消失→client 复原→再贴边……每帧翻转导致「右下角一直抖动」。
function clampToViewport(modal) {
  const { dx, dy } = computeClampDelta(
    modal.getBoundingClientRect(),
    window.innerWidth,
    window.innerHeight,
    getTranslate(modal)
  )
  if (dx || dy) translateBy(modal, dx, dy)
}

function tryBind(el, binding, retry = 0) {
  const content = el.closest('.ant-modal-content')
  const modal = el.closest('.ant-modal')
  // 和 resize 指令一致：入场动画 / Portal 搬运可能让 DOM 还没就绪，重试轮询。
  // 注意：把手 .ant-modal-header 不在这里强求——interactjs 的 allowFrom 在每次
  // pointerdown 时才求值，header 只要在用户真正去拖时存在即可。
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
  modal.classList.add('v-drag-modal-target')

  const ctx = {
    interactable: null,
    modal,
    content,
    handle: opts.handle,
    // 记录当前 disabled，供 fullscreen 退出时判断要不要恢复拖拽
    disabled: opts.disabled,
    onDrag: opts.onDrag,
    onDragStart: opts.onDragStart,
    onDragEnd: opts.onDragEnd,
    // 供 fullscreen 退出 clamp 时把弹窗推回视口：在共享位移上叠加 dx/dy
    addPos(dx, dy) {
      translateBy(this.modal, dx, dy)
    }
  }

  const interactable = interact(modal).draggable({
    // 只允许从头部按下开始拖；resize 的把手在右/下边缘与右下角，互不重叠
    allowFrom: opts.handle,
    enabled: !opts.disabled,
    // 视口约束改为在 move 里手动钳制（clampToViewport），不再用 restrictRect：
    // restrictRect 在「弹窗比视口大」时，top≥0 与 bottom≤视口 两条约束互相矛盾，会退化成
    // 「上边能拖过头、下边够不到底」。手动钳制对超高/超宽也有确定行为（铺满视口）。
    listeners: {
      start: () => {
        modal.classList.add('v-drag-modal--dragging')
        // 关选区 + 拦原生拖拽（防鼠标过快吞 pointerup）+ 锁 wrap 滚动 + 铺 iframe 屏蔽层
        lockInteraction('move', modal)
        ctx.onDragStart && ctx.onDragStart(getTranslate(modal))
      },
      move: e => {
        // 先按指针增量平移，再钳回视口（同一帧内完成，绘制前，无可见过冲）
        translateBy(modal, e.dx, e.dy)
        clampToViewport(modal)
        ctx.onDrag && ctx.onDrag(getTranslate(modal))
      },
      end: () => {
        modal.classList.remove('v-drag-modal--dragging')
        unlockInteraction()
        // 回调先拿本次手势的位移，再落盘（落盘会把共享 tx/ty 归零）
        const t = getTranslate(modal)
        commitTranslate(modal)
        ctx.onDragEnd && ctx.onDragEnd(t)
      }
    }
  })

  ctx.interactable = interactable
  el[CTX] = ctx
  getShared(modal).drag = ctx
}

// 业务动态改了 disabled / handle 时同步到 interactable
function syncOptions(el, binding) {
  const ctx = el[CTX]
  if (!ctx || !ctx.interactable) return // 还没绑定成功（仍在重试），交给 inserted 流程
  const opts = resolveOptions(binding)
  if (opts.handle !== ctx.handle) {
    ctx.handle = opts.handle
    ctx.interactable.draggable({ allowFrom: opts.handle })
  }
  ctx.disabled = opts.disabled
  ctx.interactable.draggable({ enabled: !opts.disabled })
}

function release(el) {
  const ctx = el[CTX]
  if (!ctx) return
  if (ctx.timer) clearTimeout(ctx.timer)
  if (ctx.interactable) ctx.interactable.unset()
  if (ctx.modal) {
    // 拖拽进行中被卸载：end 不会触发，这里补一次解锁，避免全局选区锁泄漏
    if (ctx.modal.classList.contains('v-drag-modal--dragging')) unlockInteraction()
    clearShared(ctx.modal, 'drag')
    ctx.modal.classList.remove('v-drag-modal-target', 'v-drag-modal--dragging')
    // 交互中的 transform 与已落盘的 left/top（见 commitTranslate）一并清除
    ctx.modal.style.transform = ''
    ctx.modal.style.left = ''
    ctx.modal.style.top = ''
  }
  delete el[CTX]
}

// 默认导出指令本身（{ inserted, componentUpdated, unbind }）；
// 指令的注册（Vue.directive）由 directives/index.js 的安装函数统一完成。
const directive = {
  inserted(el, binding) {
    tryBind(el, binding)
  },
  componentUpdated(el, binding) {
    syncOptions(el, binding)
  },
  unbind(el) {
    release(el)
  }
}

export default directive
