import { shallowMount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import DualDateRangePicker from '@/components/DualDateRangePicker.vue'

// 只测回显解析逻辑（parseValue/detectMode/toMoment/mode），
// antd 的 picker 一律 stub 掉，避免 jsdom 里跑真实组件。
const STUBS = {
  'a-select': true,
  'a-select-option': true,
  'a-date-picker': true,
  'a-input': true,
  'a-icon': true
}

function factory(props = {}) {
  return shallowMount(DualDateRangePicker, { propsData: props, stubs: STUBS })
}

let warn
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  warn.mockRestore()
})

describe('DualDateRangePicker — 合法格式回显', () => {
  it.each([
    ['2024', 'year', '2024'],
    ['2024-06', 'month', '2024-06'],
    ['202406', 'month', '2024-06'],
    ['2024-06-15', 'date', '2024-06-15'],
    ['20240615', 'date', '2024-06-15']
  ])('%s 被识别为 %s 粒度并正常回显', (raw, mode, normalized) => {
    const w = factory({ startValue: raw })
    expect(w.vm.mode).toBe(mode)
    expect(w.vm.startMoment).not.toBeNull()
    expect(w.vm.startMoment.format(w.vm.mode === 'year' ? 'YYYY' : normalized.length === 7 ? 'YYYY-MM' : 'YYYY-MM-DD')).toBe(normalized)
  })

  it('数字型入参也能回显（后端偶尔给 number）', () => {
    const w = factory({ startValue: 20240615 })
    expect(w.vm.mode).toBe('date')
    expect(w.vm.startMoment.format('YYYY-MM-DD')).toBe('2024-06-15')
  })
})

describe('DualDateRangePicker — 非法格式被过滤', () => {
  it.each([
    ['2026年2月', '中文年月'],
    ['2026年02月', '中文年月补零'],
    ['2026年2月10日', '中文年月日'],
    ['2024/06/15', '斜杠分隔'],
    ['2024-6-5', '月日未补零'],
    ['2024-13', '不存在的月份'],
    ['20240631', '不存在的日期'],
    ['abc', '非日期串'],
    ['', '空串'],
    ['   ', '纯空白'],
    [null, 'null'],
    [undefined, 'undefined']
  ])('%s（%s）不回显', raw => {
    const w = factory({ startValue: raw })
    expect(w.vm.startMoment).toBeNull()
  })

  it('非法值不污染粒度：回落到 defaultMode', () => {
    const w = factory({ startValue: '2024/06/15', defaultMode: 'month' })
    expect(w.vm.mode).toBe('month')
  })

  it('一端非法时，粒度按另一端的合法值反推', () => {
    const w = factory({ startValue: 'abc', endValue: '2024' })
    expect(w.vm.mode).toBe('year')
    expect(w.vm.startMoment).toBeNull()
    expect(w.vm.endMoment.format('YYYY')).toBe('2024')
  })

  it('异步回填非法值时保持原粒度不变', async () => {
    const w = factory({ startValue: '2024-06' })
    expect(w.vm.mode).toBe('month')
    await w.setProps({ startValue: '2024/06/15' })
    expect(w.vm.mode).toBe('month')
    expect(w.vm.startMoment).toBeNull()
  })

  it('change 载荷里 start/end 与 moment 同进同退', () => {
    // 结束端是脏值：payload.end 与 endMoment 都应为 null
    const w = factory({ startValue: '2024-06-15', endValue: '2024/06/20' })
    w.vm.onStartChange(w.vm.startMoment)
    const payload = w.emitted().change[0][0]
    expect(payload.start).toBe('2024-06-15')
    expect(payload.end).toBeNull()
    expect(payload.endMoment).toBeNull()
  })

  it('change 载荷里紧凑写法被规范化成带横线', () => {
    const w = factory({ startValue: '20240615', endValue: '20240620' })
    w.vm.onStartChange(w.vm.startMoment)
    const payload = w.emitted().change[0][0]
    expect(payload.start).toBe('2024-06-15')
    expect(payload.end).toBe('2024-06-20')
  })

  it('脏值被反向清空，父级模型拿到 null（否则会原样提交给后端）', () => {
    const w = factory({ startValue: '2026年2月', endValue: '2026年3月' })
    expect(w.emitted()['update:startValue'][0]).toEqual([null])
    expect(w.emitted()['update:endValue'][0]).toEqual([null])
    // 清洗不是用户操作，不该触发父级的查询/提交
    expect(w.emitted().change).toBeUndefined()
  })

  it('清空时抛 invalid 事件，带上是哪一端和原值', () => {
    const w = factory({ startValue: '2026年2月' })
    expect(w.emitted().invalid[0]).toEqual([
      { prop: 'startValue', value: '2026年2月' }
    ])
  })

  it('异步回填的脏值同样被清掉', async () => {
    const w = factory({ startValue: '2024-06' })
    expect(w.emitted()['update:startValue']).toBeUndefined()
    await w.setProps({ startValue: '2026年2月' })
    expect(w.emitted()['update:startValue'][0]).toEqual([null])
  })

  it('合法值与空值都不会被清空（避免 null -> emit null 死循环）', async () => {
    const w = factory({ startValue: '2024-06-15', endValue: null })
    await w.setProps({ startValue: '2024-07-01' })
    expect(w.emitted()['update:startValue']).toBeUndefined()
    expect(w.emitted()['update:endValue']).toBeUndefined()
  })

  it('clearInvalid=false 时只过滤显示，不回写父级', () => {
    const w = factory({ startValue: '2026年2月', clearInvalid: false })
    expect(w.vm.startMoment).toBeNull()
    expect(w.emitted()['update:startValue']).toBeUndefined()
  })

  it('开发期对脏值告警，且同一个值只告警一次', () => {
    warn.mockClear()
    const w = factory({ startValue: '__dirty__', endValue: '__dirty__' })
    // detectMode/toMoment/computed 会多次调用 parseValue，但只应提示一次
    void w.vm.startMoment
    void w.vm.endMoment
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('不符合回显格式')
  })
})
