import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import dragDirective from '@/directives/drag-modal'
import resizeDirective from '@/directives/resize-modal'
import fullscreenDirective from '@/directives/fullscreen-modal'
import { getShared } from '@/directives/modal-shared'

// 目的：验证 drag / resize / fullscreen 三个指令「单独使用」互不牵连。
// 它们通过 modal-shared 共享位移与上下文（fullscreen 进/退全屏时会去读 shared.drag /
// shared.resize），所以只挂其中一个、或挂两个时，另一个缺席的分支必须走 null 守卫而不报错。
//
// 直接调用指令对象的 inserted / componentUpdated / unbind 钩子，
// 在一个仿造的 .ant-modal 结构上跑，无需 mount 整个组件。

// 构造一份 antd 弹窗的最小 DOM：.ant-modal-wrap > .ant-modal > .ant-modal-content > el
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
  const el = document.createElement('div') // 指令宿主元素

  content.append(header, body, footer, el)
  modal.appendChild(content)
  wrap.appendChild(modal)
  document.body.appendChild(wrap)
  return { wrap, modal, content, el }
}

let dom
beforeEach(() => { dom = makeModalDom() })
afterEach(() => {
  if (dom && dom.wrap.parentNode) dom.wrap.parentNode.removeChild(dom.wrap)
  document.body.innerHTML = ''
})

describe('drag 指令 —— 单独使用', () => {
  it('单独绑定不报错，只写入 shared.drag，resize 保持空', () => {
    const { el, modal } = dom
    expect(() => dragDirective.inserted(el, { value: {} })).not.toThrow()

    const shared = getShared(modal)
    expect(shared.drag).toBeTruthy()
    expect(shared.resize).toBeNull()
    expect(modal.classList.contains('v-drag-modal-target')).toBe(true)
  })

  it('unbind 清理干净：移除 class、注销 shared.drag、清空 transform', () => {
    const { el, modal } = dom
    dragDirective.inserted(el, { value: {} })
    modal.style.transform = 'translate(5px, 5px)'

    expect(() => dragDirective.unbind(el)).not.toThrow()
    expect(modal.classList.contains('v-drag-modal-target')).toBe(false)
    expect(modal.style.transform).toBe('')
    // drag 注销后整表清空（没有 resize 时 modal-shared 会删掉注册表）
    expect(modal.__modalEnhanceCtx__).toBeUndefined()
  })
})

describe('resize 指令 —— 单独使用', () => {
  it('单独绑定不报错，套用初始宽度，只写入 shared.resize', () => {
    const { el, modal, content } = dom
    expect(() =>
      resizeDirective.inserted(el, { value: { initialWidth: 560 } })
    ).not.toThrow()

    const shared = getShared(modal)
    expect(shared.resize).toBeTruthy()
    expect(shared.drag).toBeNull()
    expect(modal.classList.contains('v-resize-modal-target')).toBe(true)
    expect(modal.style.width).toBe('560px')
    expect(content.style.width).toBe('560px')
  })

  it('unbind 清理干净：移除 class、注销 shared.resize、清空宽度', () => {
    const { el, modal } = dom
    resizeDirective.inserted(el, { value: { initialWidth: 560 } })

    expect(() => resizeDirective.unbind(el)).not.toThrow()
    expect(modal.classList.contains('v-resize-modal-target')).toBe(false)
    expect(modal.style.width).toBe('')
    expect(modal.__modalEnhanceCtx__).toBeUndefined()
  })
})

describe('fullscreen 指令 —— 单独使用（无 drag / 无 resize）', () => {
  it('进入全屏：加 class，且不因缺少 drag/resize 报错', () => {
    const { el, modal } = dom
    fullscreenDirective.inserted(el, { value: false })
    expect(modal.classList.contains('v-modal-fullscreen')).toBe(false)

    // 翻转为 true → enter()。此时 shared.drag / shared.resize 均为 null，须走守卫不报错
    expect(() =>
      fullscreenDirective.componentUpdated(el, { value: true })
    ).not.toThrow()
    expect(modal.classList.contains('v-modal-fullscreen')).toBe(true)
  })

  it('退出全屏：移除 class，clamp 在无 drag/resize 时安全空转', () => {
    const { el, modal } = dom
    fullscreenDirective.inserted(el, { value: true })
    expect(modal.classList.contains('v-modal-fullscreen')).toBe(true)

    expect(() =>
      fullscreenDirective.componentUpdated(el, { value: false })
    ).not.toThrow()
    expect(modal.classList.contains('v-modal-fullscreen')).toBe(false)
  })

  it('inserted 时初值为 true 直接进入全屏', () => {
    const { el, modal } = dom
    fullscreenDirective.inserted(el, { value: true })
    expect(modal.classList.contains('v-modal-fullscreen')).toBe(true)
  })

  it('支持对象写法 { value: bool }', () => {
    const { el, modal } = dom
    fullscreenDirective.inserted(el, { value: { value: false } })
    fullscreenDirective.componentUpdated(el, { value: { value: true } })
    expect(modal.classList.contains('v-modal-fullscreen')).toBe(true)
  })

  it('unbind 移除全屏 class', () => {
    const { el, modal } = dom
    fullscreenDirective.inserted(el, { value: true })
    fullscreenDirective.unbind(el)
    expect(modal.classList.contains('v-modal-fullscreen')).toBe(false)
  })
})

describe('部分组合 —— 只测被缺席指令覆盖的守卫分支', () => {
  it('fullscreen + drag（无 resize）：进/退全屏不报错', () => {
    const { el, modal } = dom
    dragDirective.inserted(el, { value: {} })
    fullscreenDirective.inserted(el, { value: false })

    const shared = getShared(modal)
    expect(shared.drag).toBeTruthy()
    expect(shared.resize).toBeNull()

    expect(() => fullscreenDirective.componentUpdated(el, { value: true })).not.toThrow()
    expect(modal.classList.contains('v-modal-fullscreen')).toBe(true)
    // 退出：clampIntoViewport 会用 shared.drag.addPos，但 shared.resize 缺席须跳过
    expect(() => fullscreenDirective.componentUpdated(el, { value: false })).not.toThrow()
    expect(modal.classList.contains('v-modal-fullscreen')).toBe(false)
  })

  it('fullscreen + resize（无 drag）：进/退全屏不报错', () => {
    const { el, modal } = dom
    resizeDirective.inserted(el, { value: { initialWidth: 560 } })
    fullscreenDirective.inserted(el, { value: false })

    const shared = getShared(modal)
    expect(shared.resize).toBeTruthy()
    expect(shared.drag).toBeNull()

    expect(() => fullscreenDirective.componentUpdated(el, { value: true })).not.toThrow()
    // 退出：clamp 会用 shared.resize.setSize，但 shared.drag 缺席须跳过
    expect(() => fullscreenDirective.componentUpdated(el, { value: false })).not.toThrow()
    expect(modal.classList.contains('v-modal-fullscreen')).toBe(false)
  })

  it('drag + resize 共存：各自注册，unbind drag 后 resize 仍在', () => {
    const { el, modal } = dom
    // 同一 el 上同时挂两个指令（各自独立的 CTX 键，互不覆盖）
    resizeDirective.inserted(el, { value: { initialWidth: 560 } })
    dragDirective.inserted(el, { value: {} })

    const shared = getShared(modal)
    expect(shared.drag).toBeTruthy()
    expect(shared.resize).toBeTruthy()

    dragDirective.unbind(el)
    // drag 注销，但 resize 还在，注册表不应被删除
    expect(modal.__modalEnhanceCtx__).toBeTruthy()
    expect(getShared(modal).drag).toBeNull()
    expect(getShared(modal).resize).toBeTruthy()
  })
})
