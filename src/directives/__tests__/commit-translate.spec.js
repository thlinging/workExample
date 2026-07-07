import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getShared, translateBy, getTranslate, commitTranslate } from '@/directives/modal-shared'

// 验证「位移落盘」commitTranslate：手势结束时把共享 tx/ty 从内联 transform 转换成
// relative 定位的 left/top。稳态下 .ant-modal 不留 transform，antd 的 antZoomOut 关闭
// 动画（transform keyframes 会顶掉内联 transform）就不会把拖过的弹窗闪回原位播放。

describe('commitTranslate（位移落盘）', () => {
  let modal
  beforeEach(() => {
    modal = document.createElement('div')
    document.body.appendChild(modal)
  })
  afterEach(() => {
    modal.remove()
  })

  it('把累计位移写入 left/top，清空 transform 与共享 tx/ty', () => {
    translateBy(modal, 30, -20)
    commitTranslate(modal)
    expect(modal.style.left).toBe('30px')
    expect(modal.style.top).toBe('-20px')
    expect(modal.style.transform).toBe('')
    expect(getTranslate(modal)).toEqual({ x: 0, y: 0 })
  })

  it('多次落盘在上一次的 left/top 基线上累加', () => {
    translateBy(modal, 10, 5)
    commitTranslate(modal)
    translateBy(modal, -4, 7)
    commitTranslate(modal)
    expect(modal.style.left).toBe('6px')
    expect(modal.style.top).toBe('12px')
  })

  it('落盘后继续拖拽：transform 只含新手势的增量，不与 left/top 重复叠加', () => {
    translateBy(modal, 50, 50)
    commitTranslate(modal)
    translateBy(modal, 3, 4)
    expect(modal.style.transform).toBe('translate(3px, 4px)')
    expect(getTranslate(modal)).toEqual({ x: 3, y: 4 })
  })

  it('无位移时不写内联 left/top（保持样式表基线，如 antd 的 top:100px）', () => {
    getShared(modal) // 初始化共享状态但位移为 0
    commitTranslate(modal)
    expect(modal.style.left).toBe('')
    expect(modal.style.top).toBe('')
  })

  it('未初始化共享状态（从未拖拽/缩放）时安全 no-op', () => {
    expect(() => commitTranslate(modal)).not.toThrow()
    expect(modal.style.left).toBe('')
  })
})
