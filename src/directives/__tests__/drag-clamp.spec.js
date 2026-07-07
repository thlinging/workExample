import { describe, it, expect } from 'vitest'
import { computeClampDelta } from '@/directives/drag-modal'

// 验证 drag 视口钳制的纯逻辑 computeClampDelta(rect, vw, vh, translate)。
// 取代原 restrictRect：
// - 「弹窗小于视口」→ 关在视口内；
// - 「弹窗大于视口」→ 撤销该轴拖拽位移回到自然位置（返回 -translate），把上下/左右查看
//   交给 .ant-modal-wrap 原生滚动（拖拽把手在顶部，靠拖动会把把手拖出屏幕而抓不住，
//   底部永远够不到，故改由滚动接管）。

const vw = 1000
const vh = 800
// 由 left/top/width/height 造一个含 right/bottom 的矩形
const R = (left, top, width, height) => ({
  left, top, width, height, right: left + width, bottom: top + height
})

describe('computeClampDelta —— 弹窗不超过视口（关在视口内）', () => {
  it('完全在视口内：不位移', () => {
    expect(computeClampDelta(R(100, 100, 400, 300), vw, vh)).toEqual({ dx: 0, dy: 0 })
  })
  it('左越界：向右推回', () => {
    expect(computeClampDelta(R(-30, 100, 400, 300), vw, vh)).toEqual({ dx: 30, dy: 0 })
  })
  it('右越界：向左拉回', () => {
    // right = 700+400 = 1100 > 1000 → dx = 1000-1100 = -100
    expect(computeClampDelta(R(700, 100, 400, 300), vw, vh)).toEqual({ dx: -100, dy: 0 })
  })
  it('上越界：向下推回', () => {
    expect(computeClampDelta(R(100, -40, 400, 300), vw, vh)).toEqual({ dx: 0, dy: 40 })
  })
  it('下越界：向上拉回', () => {
    // bottom = 600+300 = 900 > 800 → dy = 800-900 = -100
    expect(computeClampDelta(R(100, 600, 400, 300), vw, vh)).toEqual({ dx: 0, dy: -100 })
  })
})

describe('computeClampDelta —— 弹窗超过视口（撤销位移回自然位，交给 wrap 原生滚动）', () => {
  it('超高：撤销纵向位移回到自然位（dy = -translate.y）', () => {
    // height 900 > 800：不看 rect.top/bottom，直接把当前纵向位移撤销
    expect(computeClampDelta(R(100, -200, 400, 900), vw, vh, { x: 0, y: 120 })).toEqual({
      dx: 0,
      dy: -120
    })
  })
  it('超高且未拖动过（translate.y=0）：不位移', () => {
    expect(computeClampDelta(R(100, 50, 400, 900), vw, vh, { x: 0, y: 0 })).toEqual({
      dx: 0,
      dy: 0
    })
  })
  it('超宽：撤销横向位移回到自然位（dx = -translate.x）', () => {
    expect(computeClampDelta(R(-300, 100, 1200, 300), vw, vh, { x: -80, y: 0 })).toEqual({
      dx: 80,
      dy: 0
    })
  })
  it('缺省 translate 参数时按 0 处理（向后兼容）：超尺寸轴不位移', () => {
    expect(computeClampDelta(R(100, 50, 400, 900), vw, vh)).toEqual({ dx: 0, dy: 0 })
  })
})

describe('computeClampDelta —— 两个维度同时越界', () => {
  it('左上都越界：向右下推回', () => {
    expect(computeClampDelta(R(-20, -30, 400, 300), vw, vh)).toEqual({ dx: 20, dy: 30 })
  })
  it('超高 + 水平越界：各维度独立处理', () => {
    // width 400≤1000、left -20 → dx=20（正常钳制）；
    // height 900>800 → dy=-translate.y=-60（撤销纵向位移，交给 wrap 滚动）
    expect(computeClampDelta(R(-20, -200, 400, 900), vw, vh, { x: 0, y: 60 })).toEqual({
      dx: 20,
      dy: -60
    })
  })
})
