import './modal-shared.css'

// 三个弹窗增强指令（drag / resize / fullscreen）会挂在同一个 .ant-modal 上。
// 通过这个挂在 DOM 元素上的共享注册表，让它们互相拿到对方的上下文：
// fullscreen 进入时据此启停 drag/resize，退出时回写位移/尺寸做 clamp（钳回视口）。
const KEY = '__modalEnhanceCtx__'

export function getShared(modal) {
  // tx/ty：.ant-modal 的 transform translate 偏移，drag 与 resize 共享同一份，
  // 否则两者各写 transform 会互相覆盖。
  if (!modal[KEY]) modal[KEY] = { drag: null, resize: null, tx: 0, ty: 0 }
  return modal[KEY]
}

// 在当前位移上叠加 dx/dy 并写回 transform。drag 拖动、resize 补偿居中、
// fullscreen 退出 clamp 都经此唯一入口，保证位移状态一致。
export function translateBy(modal, dx, dy) {
  const s = getShared(modal)
  // 累加值保持浮点（避免连续补偿累计取整误差导致左右边对不齐），仅渲染时取整：
  // transform 落在非整数像素上会触发亚像素重采样，让 iframe / 文字发虚。
  s.tx += dx
  s.ty += dy
  modal.style.transform = `translate(${Math.round(s.tx)}px, ${Math.round(s.ty)}px)`
}

export function getTranslate(modal) {
  const s = getShared(modal)
  return { x: s.tx, y: s.ty }
}

// ——— 位移落盘：手势结束时把累计 transform 位移转换成 relative 定位的 left/top ———
// antd 弹窗的开/关动画（antZoomIn/antZoomOut）是 transform 的 keyframes 动画，动画期间
// 会整体顶掉内联 transform：若拖拽位移留在 transform 上，关闭时弹窗会瞬间跳回无位移的
// 自然位置、在原位播完缩小动画（「闪现在原位置然后消失」）；重开时进场动画同理。
// 因此每次手势结束（drag/resize 的 end、fullscreen 退出 clamp 后）把 tx/ty 累加进内联
// left/top：.ant-modal 本身是 position:relative，relative 偏移与 translate 视觉等价、
// 同样不动 antd 的 top/margin:auto 居中基线，但不参与 transform 层叠，动画就在拖后位置
// 原地播放。稳态下弹窗不带 transform，也不再形成 fixed 包含块（弹窗内 position:fixed
// 的组件如编辑器全屏不会被困在弹窗里）。交互进行中仍用 transform（走合成器、跟手顺滑）。
export function commitTranslate(modal) {
  const s = modal && modal[KEY]
  if (!s || (!s.tx && !s.ty)) return // 无位移不写内联 left/top，保持样式表基线
  const cs = getComputedStyle(modal)
  // 基线优先取已有内联值（上次落盘的结果）；无内联时取 computed
  // （默认弹窗 top:100px、centered 弹窗 top:0），'auto' 按 0 处理
  const baseLeft = parseFloat(modal.style.left || cs.left) || 0
  const baseTop = parseFloat(modal.style.top || cs.top) || 0
  modal.style.left = Math.round(baseLeft + s.tx) + 'px'
  modal.style.top = Math.round(baseTop + s.ty) + 'px'
  modal.style.transform = ''
  s.tx = 0
  s.ty = 0
}

// 指令 unbind 时注销自身；两者都没了就清掉整个注册表，避免悬挂引用。
export function clearShared(modal, which) {
  const s = modal && modal[KEY]
  if (!s) return
  s[which] = null
  if (!s.drag && !s.resize) delete modal[KEY]
}

// ——— 交互锁：拖拽/缩放期间全局禁用选区 + 拦截原生 dragstart + 铺 iframe 屏蔽层 ———
// 用引用计数支持 drag/resize 同时持有（理论上不会并发，仍按计数稳妥处理）。
// 两类「松手后弹窗还在动」的根因都在这里一并解决：
//  1) 鼠标过快时浏览器抢去选区/原生拖拽会吞掉 pointerup（user-select + 拦 dragstart）。
//  2) 弹窗内嵌 iframe 时，指针移到 iframe 上方，事件被 iframe 文档接走，父页面收不到
//     pointermove/pointerup —— end 不触发。对策：盖一层覆盖全视口的透明屏蔽层（在所有
//     iframe 之上），把指针事件挡在父文档里，让 interactjs 持续收到事件。
let interactionLocks = 0
let shield = null
function preventDragStart(e) {
  e.preventDefault()
}

// ——— wrap 滚动锁：仅当 .ant-modal-wrap 真的是滚动容器时才临时关掉它的滚动 ———
// 背景：弹窗贴到视口边缘会把 wrap（antd 默认 overflow:auto）顶出滚动条，而钳制用的
// window.innerWidth/Height 含滚动条槽、wrap.clientWidth/Height 不含，逐帧翻转导致
// 「拖到右下角一直抖动」，故交互期间需要 overflow:hidden。
// 但不能用 CSS 无差别命中所有 wrap（旧实现 `.v-modal-interacting .ant-modal-wrap
// { overflow:hidden !important }` 已移除）：有的宿主项目全局改过 wrap 样式，实测出现过
// wrap 高度为 0、靠 overflow:visible 溢出显示弹窗的环境——强制 hidden 会把裁剪盒变成
// 零高矩形，弹窗在拖拽/缩放期间整个被裁没（松手恢复 visible 又出现）。
// 所以改在交互开始时用 JS 判断：computed overflow 是 auto/scroll/overlay（可能长滚动条、
// 存在抖动风险）才临时置 hidden；visible/hidden 的 wrap 本就不会有滚动条，原样不动。
let lockedWrap = null
let lockedWrapPrevOverflow = ''

function lockWrapScroll(modal) {
  const wrap = modal && modal.closest ? modal.closest('.ant-modal-wrap') : null
  if (!wrap) return
  const cs = getComputedStyle(wrap)
  if (!/(auto|scroll|overlay)/.test(cs.overflow + cs.overflowX + cs.overflowY)) return
  lockedWrap = wrap
  lockedWrapPrevOverflow = wrap.style.overflow
  wrap.style.setProperty('overflow', 'hidden', 'important')
}

function unlockWrapScroll() {
  if (!lockedWrap) return
  if (lockedWrapPrevOverflow) lockedWrap.style.overflow = lockedWrapPrevOverflow
  else lockedWrap.style.removeProperty('overflow')
  lockedWrap = null
  lockedWrapPrevOverflow = ''
}

// 创建并挂上屏蔽层：position:fixed 铺满视口、z-index 顶到最高（盖住弹窗内/页面上的所有
// iframe），背景透明、不可被选中。cursor 跟随当前操作（拖拽=move，缩放=对应方向），
// 否则指针移到遮罩上会变回默认箭头。
function mountShield(cursor) {
  shield = document.createElement('div')
  shield.className = 'v-modal-interaction-shield'
  if (cursor) shield.style.cursor = cursor
  document.body.appendChild(shield)
}

function unmountShield() {
  if (shield && shield.parentNode) shield.parentNode.removeChild(shield)
  shield = null
}

// modal 参数：当前交互的 .ant-modal，用于定位它所在的 wrap 做滚动锁（可缺省，兼容旧调用）
export function lockInteraction(cursor, modal) {
  interactionLocks += 1
  if (interactionLocks === 1) {
    document.documentElement.classList.add('v-modal-interacting')
    // capture 阶段拦截，确保早于浏览器默认的原生拖拽启动
    document.addEventListener('dragstart', preventDragStart, true)
    lockWrapScroll(modal)
    mountShield(cursor)
  }
}

export function unlockInteraction() {
  if (interactionLocks === 0) return
  interactionLocks -= 1
  if (interactionLocks === 0) {
    document.documentElement.classList.remove('v-modal-interacting')
    document.removeEventListener('dragstart', preventDragStart, true)
    unlockWrapScroll()
    unmountShield()
  }
}
