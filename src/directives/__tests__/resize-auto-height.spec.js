import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import resizeDirective from '@/directives/resize-modal'

// 验证 resize 指令的「高度延迟自动测量」：
// 省略 initialHeight 时不在 inserted 当场锁高度，而是等入场动画（antZoomIn）稳定后
// 再测 content 的真实高度并套用。宽度仍立即用 offsetWidth。
//
// jsdom 里 offsetWidth/offsetHeight 恒为 0，这里用 defineProperty 手动模拟布局尺寸，
// 并让 content 高度在「动画结束」前后取不同值，以此证明测量发生在 settle 时刻而非 bind 时刻。

function makeModalDom() {
  const wrap = document.createElement('div')
  wrap.className = 'ant-modal-wrap'
  const modal = document.createElement('div')
  modal.className = 'ant-modal'
  const content = document.createElement('div')
  content.className = 'ant-modal-content'
  const header = document.createElement('div')
  header.className = 'ant-modal-header'
  const body = document.createElement('div')
  body.className = 'ant-modal-body'
  const footer = document.createElement('div')
  footer.className = 'ant-modal-footer'
  const el = document.createElement('div')

  content.append(header, body, footer, el)
  modal.appendChild(content)
  wrap.appendChild(modal)
  document.body.appendChild(wrap)
  return { wrap, modal, content, body, el }
}

// 用 getter 模拟布局尺寸；值可为函数以便随时间变化
function setOffset(elm, dims) {
  for (const key of ['offsetWidth', 'offsetHeight']) {
    if (dims[key] != null) {
      const v = dims[key]
      Object.defineProperty(elm, key, {
        configurable: true,
        get: () => (typeof v === 'function' ? v() : v)
      })
    }
  }
}

let dom
beforeEach(() => { dom = makeModalDom() })
afterEach(() => {
  vi.useRealTimers()
  if (dom && dom.wrap.parentNode) dom.wrap.parentNode.removeChild(dom.wrap)
  document.body.innerHTML = ''
})

describe('resize 指令 —— 高度延迟自动测量', () => {
  it('省略 initialHeight：宽度立即套用，高度延迟到 animationend 后测量', () => {
    const { el, modal, content, body } = dom
    setOffset(modal, { offsetWidth: 520 })
    let h = 0 // bind 时若立即量到的是 0（动画中间态）
    setOffset(content, { offsetHeight: () => h })

    resizeDirective.inserted(el, { value: {} })

    // 宽度：缺省回退 offsetWidth，立即套用
    expect(modal.style.width).toBe('520px')
    // 高度：此刻未锁死，保持自然高度
    expect(content.style.height).toBe('')

    // 入场动画结束、布局稳定为 300
    h = 300
    modal.dispatchEvent(new Event('animationend'))

    // 延迟测量套用真实高度（证明测的是 settle 时刻的值，而非 bind 时的 0）
    expect(content.style.height).toBe('300px')
    expect(body.style.height).toBe('300px') // header/footer 高度 0 → body 全高
  })

  it('transitionend 同样能触发延迟测量', () => {
    const { el, modal, content } = dom
    setOffset(modal, { offsetWidth: 520 })
    let h = 0
    setOffset(content, { offsetHeight: () => h })

    resizeDirective.inserted(el, { value: {} })
    h = 260
    modal.dispatchEvent(new Event('transitionend'))
    expect(content.style.height).toBe('260px')
  })

  it('显式 initialHeight：立即套用，不安排延迟测量', () => {
    const { el, modal, content } = dom
    setOffset(modal, { offsetWidth: 520 })

    resizeDirective.inserted(el, { value: { initialWidth: 560, initialHeight: 400 } })
    expect(content.style.height).toBe('400px')

    // 没有延迟测量：再触发 animationend 也不会改动高度
    modal.dispatchEvent(new Event('animationend'))
    expect(content.style.height).toBe('400px')
  })

  it('无动画事件时：350ms 超时兜底仍会测量套用', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { el, modal, content } = dom
    setOffset(modal, { offsetWidth: 520 })
    let h = 0
    setOffset(content, { offsetHeight: () => h })

    resizeDirective.inserted(el, { value: {} })
    expect(content.style.height).toBe('')

    h = 280
    vi.advanceTimersByTime(350)
    expect(content.style.height).toBe('280px')
  })

  it('animationend 触发后，超时兜底不再重复套用（只跑一次）', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { el, modal, content } = dom
    setOffset(modal, { offsetWidth: 520 })
    let h = 300
    setOffset(content, { offsetHeight: () => h })

    resizeDirective.inserted(el, { value: {} })
    modal.dispatchEvent(new Event('animationend'))
    expect(content.style.height).toBe('300px')

    // 事件已跑过并清掉定时器：即便改了高度并推进时间，也不应再次覆盖
    h = 999
    vi.advanceTimersByTime(350)
    expect(content.style.height).toBe('300px')
  })

  it('unbind 取消未触发的延迟测量：之后的 animationend 不再套用、不报错', () => {
    const { el, modal, content } = dom
    setOffset(modal, { offsetWidth: 520 })
    let h = 0
    setOffset(content, { offsetHeight: () => h })

    resizeDirective.inserted(el, { value: {} })
    resizeDirective.unbind(el)

    h = 300
    expect(() => modal.dispatchEvent(new Event('animationend'))).not.toThrow()
    expect(content.style.height).toBe('') // 已取消，未套用
  })

  it('只认弹窗自身的动画：子元素冒泡的 animationend 被忽略', () => {
    const { el, modal, content, body } = dom
    setOffset(modal, { offsetWidth: 520 })
    let h = 300
    setOffset(content, { offsetHeight: () => h })

    resizeDirective.inserted(el, { value: {} })

    // 子元素（body）冒泡上来的事件 target 不是 modal → 忽略
    body.dispatchEvent(new Event('animationend', { bubbles: true }))
    expect(content.style.height).toBe('')

    // 弹窗自身触发才测量
    modal.dispatchEvent(new Event('animationend'))
    expect(content.style.height).toBe('300px')
  })

  it('测量时若量到 0（如已隐藏）则不套用，保持自然高度', () => {
    const { el, modal, content } = dom
    setOffset(modal, { offsetWidth: 520 })
    setOffset(content, { offsetHeight: 0 }) // 始终 0

    resizeDirective.inserted(el, { value: {} })
    modal.dispatchEvent(new Event('animationend'))
    expect(content.style.height).toBe('') // 不锁 0，保持自然
  })
})
