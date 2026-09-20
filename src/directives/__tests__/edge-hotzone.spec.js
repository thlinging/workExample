import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createEdgeHotzone } from '@/directives/resize-modal/edge-hotzone'

// 验证「左右边缘缩放热区」：内嵌 iframe 会吞掉指针事件，让 interactjs 的边缘判定
// 在左右两侧失效。热区平时只留一条窄条，指针从弹窗外侧靠近时整条张开。
//
// jsdom 里 getBoundingClientRect 恒为 0，这里手动 mock content 的矩形；
// PointerEvent 支持不全，用 MouseEvent 以 'pointermove' 类型派发（监听按类型名匹配）。

const RECT = { left: 200, right: 600, top: 100, bottom: 500, width: 400, height: 400 }

function makeContent({ withFrame = false } = {}) {
  const content = document.createElement('div')
  content.className = 'ant-modal-content'
  const body = document.createElement('div')
  body.className = 'ant-modal-body'
  content.appendChild(body)
  if (withFrame) body.appendChild(document.createElement('iframe'))
  document.body.appendChild(content)
  content.getBoundingClientRect = () => ({ ...RECT })
  return content
}

function move(x, y) {
  document.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y }))
}

function zones(content) {
  return {
    left: content.querySelector('.v-resize-hotzone--left'),
    right: content.querySelector('.v-resize-hotzone--right')
  }
}

const isActive = el => el.classList.contains('is-active')

// MutationObserver 回调走微任务队列
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

const BASE = { activeSize: 12, idleSize: 3, margin: 16 }

let handles
beforeEach(() => { handles = [] })
afterEach(() => {
  handles.forEach(h => h && h.destroy())
  document.body.innerHTML = ''
})

function create(content, options) {
  const h = createEdgeHotzone(content, { ...BASE, ...options })
  handles.push(h)
  return h
}

describe('边缘热区 —— 铺设时机', () => {
  it('mode 为 false 时完全不启用', () => {
    const content = makeContent({ withFrame: true })
    expect(create(content, { mode: false })).toBe(null)
    expect(content.querySelectorAll('.v-resize-hotzone')).toHaveLength(0)
  })

  it('auto：没有嵌套文档就不铺，避免压住普通弹窗的原生滚动条', () => {
    const content = makeContent()
    create(content, { mode: 'auto' })
    expect(content.querySelectorAll('.v-resize-hotzone')).toHaveLength(0)
  })

  it('auto：检测到 iframe 时铺左右两条', () => {
    const content = makeContent({ withFrame: true })
    create(content, { mode: 'auto' })
    const { left, right } = zones(content)
    expect(left).toBeTruthy()
    expect(right).toBeTruthy()
    // 只做左右，上下边的判定区落在 header/footer 上，本来就是通的
    expect(content.querySelectorAll('.v-resize-hotzone')).toHaveLength(2)
  })

  it('mode 为 true 时不检测、一律铺', () => {
    const content = makeContent()
    create(content, { mode: true })
    expect(content.querySelectorAll('.v-resize-hotzone')).toHaveLength(2)
  })

  it('auto：iframe 异步渲染出来后自动补铺，移除后自动撤掉', async () => {
    const content = makeContent()
    create(content, { mode: 'auto' })
    expect(content.querySelectorAll('.v-resize-hotzone')).toHaveLength(0)

    const frame = document.createElement('iframe')
    content.querySelector('.ant-modal-body').appendChild(frame)
    await flush()
    expect(content.querySelectorAll('.v-resize-hotzone')).toHaveLength(2)

    frame.parentNode.removeChild(frame)
    await flush()
    expect(content.querySelectorAll('.v-resize-hotzone')).toHaveLength(0)
  })
})

describe('边缘热区 —— 宽度', () => {
  it('张开宽度被 clamp 到 margin 以内（超出部分不触发缩放，只会白吃 iframe 的点击）', () => {
    const content = makeContent({ withFrame: true })
    create(content, { mode: true, activeSize: 40, margin: 16 })
    expect(zones(content).left.style.getPropertyValue('--v-hotzone-active')).toBe('16px')
  })

  it('常开窄条不会宽过张开态', () => {
    const content = makeContent({ withFrame: true })
    create(content, { mode: true, activeSize: 8, idleSize: 20 })
    expect(zones(content).left.style.getPropertyValue('--v-hotzone-idle')).toBe('8px')
  })

  it('idleSize 传 0 即取消兜底窄条，完全不遮挡 iframe', () => {
    const content = makeContent({ withFrame: true })
    create(content, { mode: true, idleSize: 0 })
    expect(zones(content).left.style.getPropertyValue('--v-hotzone-idle')).toBe('0px')
  })
})

describe('边缘热区 —— 靠近时张开', () => {
  it('从左外侧靠近：左侧张开，右侧不动', () => {
    const content = makeContent({ withFrame: true })
    create(content, { mode: true })
    const { left, right } = zones(content)

    move(RECT.left - 10, 300) // 弹窗左边缘外 10px，在 24px 预备区内
    expect(isActive(left)).toBe(true)
    expect(isActive(right)).toBe(false)
  })

  it('从右外侧靠近：右侧张开', () => {
    const content = makeContent({ withFrame: true })
    create(content, { mode: true })
    move(RECT.right + 10, 300)
    expect(isActive(zones(content).right)).toBe(true)
  })

  it('任意高度都能张开——上沿附近与下沿附近都算数', () => {
    const content = makeContent({ withFrame: true })
    create(content, { mode: true })
    const { left } = zones(content)

    move(RECT.left - 10, RECT.top + 5)
    expect(isActive(left)).toBe(true)
    move(RECT.left - 10, RECT.bottom - 5)
    expect(isActive(left)).toBe(true)
  })

  it('指针落在边缘内侧的判定区内也保持张开', () => {
    const content = makeContent({ withFrame: true })
    create(content, { mode: true })
    const { left } = zones(content)
    move(RECT.left + 8, 300) // margin=16，仍在判定区内
    expect(isActive(left)).toBe(true)
  })

  it('远离后收回窄条', () => {
    const content = makeContent({ withFrame: true })
    create(content, { mode: true })
    const { left } = zones(content)

    move(RECT.left - 10, 300)
    expect(isActive(left)).toBe(true)
    move(RECT.left + 200, 300) // 移到弹窗正中
    expect(isActive(left)).toBe(false)
  })

  it('纵向离得太远不张开（擦着弹窗上方飞过不该亮条）', () => {
    const content = makeContent({ withFrame: true })
    create(content, { mode: true })
    move(RECT.left - 10, RECT.top - 100)
    expect(isActive(zones(content).left)).toBe(false)
  })

  it('指针移进 iframe 时收回：进去之后父文档就收不到 pointermove，不收会一直冻在张开态', () => {
    const content = makeContent({ withFrame: true })
    create(content, { mode: true })
    const { left } = zones(content)
    move(RECT.left - 10, 300)
    expect(isActive(left)).toBe(true)

    left.dispatchEvent(new MouseEvent('pointerleave', {
      relatedTarget: content.querySelector('iframe')
    }))
    expect(isActive(left)).toBe(false)
  })

  it('移到 header/遮罩等父文档元素上时不插手，交给 pointermove 判定（免一帧闪动）', () => {
    const content = makeContent({ withFrame: true })
    create(content, { mode: true })
    const { left } = zones(content)
    move(RECT.left - 10, 300)

    left.dispatchEvent(new MouseEvent('pointerleave', { relatedTarget: document.body }))
    expect(isActive(left)).toBe(true)
  })

  it('缩放进行中不开合：rect 每帧在变，跟着算只会让热区宽度抖动', () => {
    const content = makeContent({ withFrame: true })
    let busy = false
    create(content, { mode: true, isBusy: () => busy })
    const { left } = zones(content)

    busy = true
    move(RECT.left - 10, 300)
    expect(isActive(left)).toBe(false)

    busy = false
    move(RECT.left - 10, 300)
    expect(isActive(left)).toBe(true)
  })
})

describe('边缘热区 —— 销毁', () => {
  it('destroy 后摘掉 DOM，且不再响应 pointermove', async () => {
    const content = makeContent({ withFrame: true })
    const handle = create(content, { mode: true })
    expect(content.querySelectorAll('.v-resize-hotzone')).toHaveLength(2)

    handle.destroy()
    expect(content.querySelectorAll('.v-resize-hotzone')).toHaveLength(0)
    expect(() => move(RECT.left - 10, 300)).not.toThrow()
  })

  it('destroy 后 MutationObserver 也停掉，iframe 再出现不会复活热区', async () => {
    const content = makeContent()
    const handle = create(content, { mode: 'auto' })
    handle.destroy()

    content.querySelector('.ant-modal-body').appendChild(document.createElement('iframe'))
    await flush()
    expect(content.querySelectorAll('.v-resize-hotzone')).toHaveLength(0)
  })
})
