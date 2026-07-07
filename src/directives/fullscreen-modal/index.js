import { getShared, commitTranslate } from '../modal-shared'
import './style.css'

const CTX = '__fullscreenModalCtx__'

// 支持两种写法：v-fullscreen-modal="bool" 或 ="{ value: bool }"
function readValue(binding) {
  const v = binding.value
  return typeof v === 'object' && v !== null ? !!v.value : !!v
}

// 进入全屏：加 class 让 !important 规则盖住 drag 的 transform 与 resize 的 inline 宽高
//（inline 值不清除，因此位置/尺寸天然被记录）；同时停掉拖拽与缩放。
function enter(modal) {
  const shared = getShared(modal)
  modal.classList.add('v-modal-fullscreen')
  if (shared.drag) shared.drag.interactable.draggable({ enabled: false })
  if (shared.resize) shared.resize.interactable.resizable({ enabled: false })
}

// 退出全屏：移除 class，inline 尺寸/位移立即复位（transition 定义在 class 上，
// 随 class 一并移除，故退出是瞬时的，可同步测量到真实矩形用于 clamp），
// 再按各自原始状态恢复拖拽与缩放。
function exit(modal) {
  const shared = getShared(modal)
  modal.classList.remove('v-modal-fullscreen')
  clampIntoViewport(modal, shared)
  if (shared.drag && !shared.drag.disabled) shared.drag.interactable.draggable({ enabled: true })
  if (shared.resize) shared.resize.interactable.resizable({ enabled: true })
}

// 全屏期间若浏览器被缩小，复位后的旧尺寸/位置可能越界，钳回视口内。
// 先缩尺寸（需 resize 在场），再用 drag 的位移把弹窗推回（需 drag 在场）。
function clampIntoViewport(modal, shared) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  let rect = modal.getBoundingClientRect()

  if (shared.resize && (rect.width > vw || rect.height > vh)) {
    shared.resize.setSize(Math.min(rect.width, vw), Math.min(rect.height, vh))
    rect = modal.getBoundingClientRect() // 缩完尺寸后居中基线变了，重新量
  }

  if (shared.drag) {
    let dx = 0
    let dy = 0
    if (rect.left < 0) dx = -rect.left
    else if (rect.right > vw) dx = vw - rect.right
    if (rect.top < 0) dy = -rect.top
    else if (rect.bottom > vh) dy = vh - rect.bottom
    if (dx || dy) shared.drag.addPos(dx, dy)
  }
  // clamp 的推回位移同样落盘进 left/top（无位移时是 no-op），稳态不留 transform
  commitTranslate(modal)
}

// 与 drag/resize 一致：Portal 搬运 / 入场动画可能让 .ant-modal 还没就绪，轮询重试。
function tryBind(el, binding, retry = 0) {
  const modal = el.closest('.ant-modal')
  if (!modal) {
    if (retry < 30) {
      const timer = setTimeout(() => tryBind(el, binding, retry + 1), 30)
      el[CTX] = { timer }
    }
    return
  }
  const on = readValue(binding)
  el[CTX] = { modal, last: on }
  if (on) enter(modal)
}

// 默认导出指令本身（{ inserted, componentUpdated, unbind }）；
// 指令的注册（Vue.directive）由 directives/index.js 的安装函数统一完成。
const directive = {
  inserted(el, binding) {
    tryBind(el, binding)
  },
  // 业务翻转 fullscreen 布尔值时进入/退出全屏
  componentUpdated(el, binding) {
    const ctx = el[CTX]
    if (!ctx || !ctx.modal) return // 仍在重试，交给 inserted 流程
    const next = readValue(binding)
    if (next === ctx.last) return
    ctx.last = next
    next ? enter(ctx.modal) : exit(ctx.modal)
  },
  unbind(el) {
    const ctx = el[CTX]
    if (!ctx) return
    if (ctx.timer) clearTimeout(ctx.timer)
    if (ctx.modal) ctx.modal.classList.remove('v-modal-fullscreen')
    delete el[CTX]
  }
}

export default directive
