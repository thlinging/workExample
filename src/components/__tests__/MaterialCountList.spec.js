import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import MaterialCountList from '@/components/MaterialCountList.vue'

// Lightweight stubs so ant-design-vue isn't required in jsdom.
// a-tag renders its default slot so we can assert the displayed count.
const ATag = {
  name: 'a-tag',
  props: ['color'],
  template: '<span class="a-tag" :data-color="color"><slot /></span>'
}
// a-input-number just exposes value; we drive logic via vm methods directly.
const AInputNumber = {
  name: 'a-input-number',
  props: ['value', 'min'],
  template: '<span class="a-input-number" :data-value="value" />'
}

const LIST = [
  { field: 'doc', label: '文档' },
  { field: 'image', label: '图片' }
]

function factory(props = {}, options = {}) {
  return mount(MaterialCountList, {
    propsData: { list: LIST, ...props },
    stubs: { 'a-tag': ATag, 'a-input-number': AInputNumber },
    ...options
  })
}

describe('MaterialCountList — 渲染与 props 默认值', () => {
  it('每个 list 项渲染一行，label 正确', () => {
    const w = factory()
    const items = w.findAll('.mcl-item')
    expect(items.length).toBe(2)
    expect(w.findAll('.mcl-label').at(0).text()).toBe('文档')
    expect(w.findAll('.mcl-label').at(1).text()).toBe('图片')
  })

  it('默认单位为「份」，item.unit 可覆盖全局 unit', () => {
    const w = factory({
      list: [{ field: 'a', label: 'A' }, { field: 'b', label: 'B', unit: '页' }]
    })
    const units = w.findAll('.mcl-unit')
    expect(units.at(0).text()).toBe('份')
    expect(units.at(1).text()).toBe('页')
  })

  it('全局 unit prop 生效', () => {
    const w = factory({ unit: '个' })
    expect(w.findAll('.mcl-unit').at(0).text()).toBe('个')
  })

  it('录入态渲染输入框、不渲染 tag', () => {
    const w = factory({ detail: false })
    expect(w.findAll('.a-input-number').length).toBe(2)
    expect(w.findAll('.mcl-tag').length).toBe(0)
  })

  it('详情态渲染 tag、不渲染输入框', () => {
    const w = factory({ detail: true, value: { doc: '2', image: '5' } })
    expect(w.findAll('.a-input-number').length).toBe(0)
    const tags = w.findAll('.mcl-tag')
    expect(tags.length).toBe(2)
    expect(tags.at(0).text()).toBe('2')
    expect(tags.at(1).text()).toBe('5')
  })
})

describe('MaterialCountList — getCount（详情展示值）', () => {
  it('有值返回该值', () => {
    const w = factory({ value: { doc: '3' } })
    expect(w.vm.getCount('doc')).toBe('3')
  })

  it('undefined / null / 空串 回退 defaultValue（默认 0）', () => {
    const w = factory({ value: { doc: '', image: null } })
    expect(w.vm.getCount('doc')).toBe('0')      // 空串
    expect(w.vm.getCount('image')).toBe('0')    // null
    expect(w.vm.getCount('missing')).toBe('0')  // undefined
  })

  it('自定义 defaultValue 生效', () => {
    const w = factory({ value: {}, defaultValue: '—' })
    expect(w.vm.getCount('doc')).toBe('—')
  })

  it('value 为 undefined 时不报错并回退默认值', () => {
    const w = factory({ value: undefined })
    expect(w.vm.getCount('doc')).toBe('0')
  })
})

describe('MaterialCountList — getNumber（录入框数字值）', () => {
  it('数字字符串转 Number', () => {
    const w = factory({ value: { doc: '7' } })
    expect(w.vm.getNumber('doc')).toBe(7)
  })

  it('缺省回退 Number(defaultValue)，默认 0', () => {
    const w = factory({ value: {} })
    expect(w.vm.getNumber('doc')).toBe(0)
  })

  it('非数字值返回 undefined（不强行归零）', () => {
    const w = factory({ value: { doc: 'abc' } })
    expect(w.vm.getNumber('doc')).toBeUndefined()
  })

  it('defaultValue 非数字且字段缺省时返回 undefined', () => {
    const w = factory({ value: {}, defaultValue: '—' })
    expect(w.vm.getNumber('doc')).toBeUndefined()
  })

  it('空串按缺省处理，回退默认值', () => {
    const w = factory({ value: { doc: '' } })
    expect(w.vm.getNumber('doc')).toBe(0)
  })
})

describe('MaterialCountList — sumOf / computedSum', () => {
  it('对 list 字段求和，非数字按 0', () => {
    const w = factory({ value: { doc: '2', image: 'x' } })
    expect(w.vm.computedSum).toBe(2)
  })

  it('全部有值时正确求和', () => {
    const w = factory({ value: { doc: '2', image: '3' } })
    expect(w.vm.computedSum).toBe(5)
  })

  it('空表单求和为 0', () => {
    const w = factory({ value: {} })
    expect(w.vm.computedSum).toBe(0)
  })

  it('sumOf 只统计 list 中的字段，忽略额外字段', () => {
    const w = factory({ value: { doc: '2', image: '3', extra: '100' } })
    expect(w.vm.computedSum).toBe(5)
  })
})

describe('MaterialCountList — getTotal / getTotalNumber', () => {
  const totalProps = { showTotal: true, totalField: 'total' }

  it('getTotal：已有总数则原样返回（保留手填值）', () => {
    const w = factory({ ...totalProps, value: { doc: '2', image: '3', total: '99' } })
    expect(w.vm.getTotal()).toBe('99')
  })

  it('getTotal：缺省 + 联动 → 求和字符串', () => {
    const w = factory({ ...totalProps, totalSync: true, value: { doc: '2', image: '3' } })
    expect(w.vm.getTotal()).toBe('5')
  })

  it('getTotal：缺省 + 非联动 → defaultValue', () => {
    const w = factory({ ...totalProps, totalSync: false, value: { doc: '2', image: '3' } })
    expect(w.vm.getTotal()).toBe('0')
  })

  it('getTotalNumber：已有值转 Number', () => {
    const w = factory({ ...totalProps, value: { total: '42' } })
    expect(w.vm.getTotalNumber()).toBe(42)
  })

  it('getTotalNumber：缺省 + 联动 → 求和数字', () => {
    const w = factory({ ...totalProps, totalSync: true, value: { doc: '4', image: '6' } })
    expect(w.vm.getTotalNumber()).toBe(10)
  })

  it('getTotalNumber：缺省 + 非联动 → Number(defaultValue)', () => {
    const w = factory({ ...totalProps, totalSync: false, defaultValue: '1', value: {} })
    expect(w.vm.getTotalNumber()).toBe(1)
  })

  it('getTotalNumber：非数字总数返回 undefined', () => {
    const w = factory({ ...totalProps, value: { total: 'xx' } })
    expect(w.vm.getTotalNumber()).toBeUndefined()
  })
})

describe('MaterialCountList — onInput 事件与不可变更新', () => {
  it('emit input（新对象）+ change(field,val)', () => {
    const w = factory({ value: { doc: '1' } })
    w.vm.onInput('doc', 5)
    expect(w.emitted('input')[0][0]).toEqual({ doc: 5 })
    expect(w.emitted('change')[0]).toEqual(['doc', 5])
  })

  it('不修改原 value 对象（不可变）', () => {
    const original = { doc: '1' }
    const w = factory({ value: original })
    w.vm.onInput('doc', 9)
    expect(original).toEqual({ doc: '1' })            // 原对象未变
    expect(w.emitted('input')[0][0]).not.toBe(original) // 新引用
  })

  it('联动模式：改各项时把最新求和写回 totalField', () => {
    const w = factory({
      showTotal: true, totalField: 'total', totalSync: true,
      value: { doc: '2', image: '3', total: '99' }
    })
    w.vm.onInput('doc', 10) // 新求和 = 10 + 3 = 13
    expect(w.emitted('input')[0][0]).toEqual({ doc: 10, image: '3', total: 13 })
  })

  it('非联动模式：改各项不动 totalField', () => {
    const w = factory({
      showTotal: true, totalField: 'total', totalSync: false,
      value: { doc: '2', image: '3', total: '99' }
    })
    w.vm.onInput('doc', 10)
    expect(w.emitted('input')[0][0]).toEqual({ doc: 10, image: '3', total: '99' })
  })

  it('清空（val=null）也能正常 emit', () => {
    const w = factory({ value: { doc: '5' } })
    w.vm.onInput('doc', null)
    expect(w.emitted('input')[0][0]).toEqual({ doc: null })
  })
})

describe('MaterialCountList — onTotalInput 事件', () => {
  it('回写 totalField 并保留手填值，emit change', () => {
    const w = factory({
      showTotal: true, totalField: 'total', totalSync: true,
      value: { doc: '2', image: '3' }
    })
    w.vm.onTotalInput(88)
    expect(w.emitted('input')[0][0]).toEqual({ doc: '2', image: '3', total: 88 })
    expect(w.emitted('change')[0]).toEqual(['total', 88])
  })
})

describe('MaterialCountList — 总计展示可见性', () => {
  it('showTotal=false → 不渲染总计', () => {
    const w = factory({ showTotal: false, totalField: 'total' })
    expect(w.find('.mcl-total').exists()).toBe(false)
  })

  it('showTotal=true 但无 totalField → 不渲染总计', () => {
    const w = factory({ showTotal: true, totalField: '' })
    expect(w.find('.mcl-total').exists()).toBe(false)
  })

  it('showTotal=true 且有 totalField → 渲染总计，totalLabel 生效', () => {
    const w = factory({ showTotal: true, totalField: 'total', totalLabel: '合计' })
    const total = w.find('.mcl-total')
    expect(total.exists()).toBe(true)
    expect(total.find('.mcl-label').text()).toBe('合计')
  })
})

describe('MaterialCountList — tag 颜色', () => {
  it('详情态 item.color 覆盖全局 tagColor', () => {
    const w = factory({
      detail: true,
      tagColor: 'blue',
      list: [{ field: 'a', label: 'A', color: 'red' }, { field: 'b', label: 'B' }],
      value: { a: '1', b: '2' }
    })
    const tags = w.findAll('.mcl-tag')
    expect(tags.at(0).attributes('data-color')).toBe('red')  // item.color
    expect(tags.at(1).attributes('data-color')).toBe('blue') // 回退 tagColor
  })

  it('总计 totalColor 覆盖 tagColor', () => {
    const w = factory({
      detail: true, showTotal: true, totalField: 'total',
      tagColor: 'blue', totalColor: 'green',
      value: { total: '9' }
    })
    expect(w.find('.mcl-total .mcl-tag').attributes('data-color')).toBe('green')
  })
})

describe('MaterialCountList — suffix 插槽', () => {
  it('item.suffix=true 渲染插槽，透出 item 与 count', () => {
    const w = factory(
      {
        detail: true,
        list: [{ field: 'a', label: 'A', suffix: true }],
        value: { a: '7' }
      },
      {
        scopedSlots: {
          suffix: '<span class="suffix-content">{{ props.item.label }}:{{ props.count }}</span>'
        }
      }
    )
    const s = w.find('.suffix-content')
    expect(s.exists()).toBe(true)
    expect(s.text()).toBe('A:7')
  })

  it('item.suffix 缺省时不渲染插槽', () => {
    const w = factory(
      { list: [{ field: 'a', label: 'A' }] },
      { scopedSlots: { suffix: '<span class="suffix-content" />' } }
    )
    expect(w.find('.suffix-content').exists()).toBe(false)
  })
})

describe('MaterialCountList — total-suffix 插槽', () => {
  const base = { showTotal: true, totalField: 'total' }

  it('totalSuffix=true 渲染总计专属插槽，透出 count', () => {
    const w = factory(
      { ...base, totalSuffix: true, totalSync: true, value: { doc: '2', image: '3' } },
      {
        scopedSlots: {
          'total-suffix': '<span class="total-suffix-content">共{{ props.count }}</span>'
        }
      }
    )
    const s = w.find('.total-suffix-content')
    expect(s.exists()).toBe(true)
    expect(s.text()).toBe('共5') // 联动求和
  })

  it('totalSuffix 缺省时不渲染总计插槽', () => {
    const w = factory(
      base,
      { scopedSlots: { 'total-suffix': '<span class="total-suffix-content" />' } }
    )
    expect(w.find('.total-suffix-content').exists()).toBe(false)
  })

  it('与各项 #suffix 互不影响（各自独立开关）', () => {
    const w = factory(
      {
        ...base,
        totalSuffix: true,
        list: [{ field: 'a', label: 'A', suffix: true }],
        value: { a: '4', total: '4' }
      },
      {
        scopedSlots: {
          suffix: '<span class="suffix-content">item</span>',
          'total-suffix': '<span class="total-suffix-content">total</span>'
        }
      }
    )
    // 各项 suffix 只在对应 .mcl-item（非总计）里
    const itemSuffix = w.find('.mcl-item:not(.mcl-total) .suffix-content')
    const totalSuffix = w.find('.mcl-total .total-suffix-content')
    expect(itemSuffix.exists()).toBe(true)
    expect(totalSuffix.exists()).toBe(true)
    // 各项插槽不会跑进总计区，总计插槽也不会跑进各项区
    expect(w.find('.mcl-total .suffix-content').exists()).toBe(false)
    expect(w.find('.mcl-item:not(.mcl-total) .total-suffix-content').exists()).toBe(false)
  })
})

describe('MaterialCountList — hideZeroInDetail（详情态隐藏为 0 的项）', () => {
  const LIST3 = [
    { field: 'doc', label: '文档' },
    { field: 'image', label: '图片' },
    { field: 'video', label: '视频' }
  ]
  // 各项标签文本，便于断言留下的是哪几项
  const labels = w => w.findAll('.mcl-item .mcl-label').wrappers.map(x => x.text())

  it('全局开关：详情态隐藏所有为 0 的项（0 / 缺省 / 空串 都算 0）', () => {
    const w = factory({
      detail: true,
      hideZeroInDetail: true,
      list: LIST3,
      value: { doc: '2', image: '0', video: '' } // image=0、video空串→0、doc=2
    })
    expect(w.findAll('.mcl-item').length).toBe(1)
    expect(labels(w)).toEqual(['文档'])
  })

  it('缺省项（formData 无该字段，默认展示 0）也被隐藏', () => {
    const w = factory({
      detail: true,
      hideZeroInDetail: true,
      list: LIST3,
      value: { doc: '5' } // image / video 缺省 → 展示 0 → 隐藏
    })
    expect(labels(w)).toEqual(['文档'])
  })

  it('录入态不过滤：始终展示全部项（便于把 0 改成其他值）', () => {
    const w = factory({
      detail: false,
      hideZeroInDetail: true,
      list: LIST3,
      value: { doc: '2', image: '0', video: '0' }
    })
    expect(w.findAll('.mcl-item').length).toBe(3)
  })

  it('开关关闭（默认）时详情态照常展示 0 项', () => {
    const w = factory({
      detail: true,
      list: LIST3,
      value: { doc: '2', image: '0', video: '0' }
    })
    expect(w.findAll('.mcl-item').length).toBe(3)
  })

  it('自定义非数字 defaultValue（如「—」）：缺省项不算 0，不被隐藏', () => {
    const w = factory({
      detail: true,
      hideZeroInDetail: true,
      defaultValue: '—',
      list: LIST3,
      value: { doc: '0' } // doc 显式 0 → 隐藏；image/video 缺省显示「—」→ 保留
    })
    expect(labels(w)).toEqual(['图片', '视频'])
  })

  it('每项 item.hideZero=false 覆盖全局：该 0 项强制保留', () => {
    const w = factory({
      detail: true,
      hideZeroInDetail: true,
      list: [
        { field: 'doc', label: '文档' },
        { field: 'image', label: '图片', hideZero: false } // 覆盖：即便为 0 也展示
      ],
      value: { doc: '0', image: '0' }
    })
    expect(labels(w)).toEqual(['图片'])
  })

  it('每项 item.hideZero=true 覆盖全局关闭：单独隐藏该 0 项', () => {
    const w = factory({
      detail: true,
      hideZeroInDetail: false, // 全局关
      list: [
        { field: 'doc', label: '文档' },
        { field: 'image', label: '图片', hideZero: true } // 单独开
      ],
      value: { doc: '0', image: '0' }
    })
    expect(labels(w)).toEqual(['文档'])
  })

  it('非 0 项始终保留', () => {
    const w = factory({
      detail: true,
      hideZeroInDetail: true,
      list: LIST3,
      value: { doc: '1', image: '2', video: '3' }
    })
    expect(w.findAll('.mcl-item').length).toBe(3)
  })

  it('总计为 0（联动求和）时也被隐藏', () => {
    const w = factory({
      detail: true,
      hideZeroInDetail: true,
      showTotal: true,
      totalField: 'total',
      totalSync: true,
      list: LIST3,
      value: { doc: '0', image: '0', video: '0' } // 求和=0 → 总计也应隐藏
    })
    expect(w.find('.mcl-total').exists()).toBe(false)
  })

  it('总计为 0（独立手填值 0）时也被隐藏', () => {
    const w = factory({
      detail: true,
      hideZeroInDetail: true,
      showTotal: true,
      totalField: 'total',
      list: LIST3,
      value: { doc: '2', total: '0' } // 总计手填 0
    })
    expect(w.find('.mcl-total').exists()).toBe(false)
  })

  it('总计非 0 时正常展示', () => {
    const w = factory({
      detail: true,
      hideZeroInDetail: true,
      showTotal: true,
      totalField: 'total',
      list: LIST3,
      value: { doc: '2', total: '2' }
    })
    expect(w.find('.mcl-total').exists()).toBe(true)
    expect(w.find('.mcl-total .mcl-tag').text()).toBe('2')
  })

  it('totalHideZero=false 覆盖全局：总计为 0 仍展示（各项照常隐藏）', () => {
    const w = factory({
      detail: true,
      hideZeroInDetail: true,
      totalHideZero: false,
      showTotal: true,
      totalField: 'total',
      totalSync: true,
      list: LIST3,
      value: { doc: '0', image: '0', video: '0' }
    })
    // 各项全隐藏，但总计强制保留
    expect(w.findAll('.mcl-item:not(.mcl-total)').length).toBe(0)
    expect(w.find('.mcl-total').exists()).toBe(true)
  })

  it('totalHideZero=true 覆盖全局关闭：仅总计为 0 时隐藏（各项照常展示）', () => {
    const w = factory({
      detail: true,
      hideZeroInDetail: false, // 各项不隐藏
      totalHideZero: true,
      showTotal: true,
      totalField: 'total',
      list: LIST3,
      value: { doc: '0', image: '2', video: '0', total: '0' }
    })
    // 各项照常全展示
    expect(w.findAll('.mcl-item:not(.mcl-total)').length).toBe(3)
    // 仅总计为 0 被隐藏
    expect(w.find('.mcl-total').exists()).toBe(false)
  })

  it('录入态：总计为 0 也始终展示（便于录入）', () => {
    const w = factory({
      detail: false,
      hideZeroInDetail: true,
      showTotal: true,
      totalField: 'total',
      totalSync: true,
      list: LIST3,
      value: { doc: '0', image: '0', video: '0' }
    })
    expect(w.find('.mcl-total').exists()).toBe(true)
  })

  it('各项全隐藏、只剩总计时：总计是容器首个元素（保证 :first-child 去悬空分隔线的样式生效）', () => {
    const w = factory({
      detail: true,
      hideZeroInDetail: true,
      totalHideZero: false, // 各项全为 0 被隐藏，但强制保留总计以验证「只剩总计」布局
      showTotal: true,
      totalField: 'total',
      list: LIST3,
      value: { doc: '0', image: '0', video: '0', total: '0' }
    })
    // 各项均被过滤，无普通项
    expect(w.findAll('.mcl-item:not(.mcl-total)').length).toBe(0)
    // 总计是容器的第一个元素子节点 → CSS .mcl-total:first-child 命中
    const container = w.find('.material-count-list').element
    const total = w.find('.mcl-total').element
    expect(container.firstElementChild).toBe(total)
  })

  it('隐藏项不影响总计求和（0 项对和无贡献，总计照常）', () => {
    const w = factory({
      detail: true,
      hideZeroInDetail: true,
      showTotal: true,
      totalField: 'total',
      totalSync: true,
      list: LIST3,
      value: { doc: '2', image: '0', video: '3' }
    })
    // 只剩 doc / video 两项 + 总计
    expect(w.findAll('.mcl-item:not(.mcl-total)').length).toBe(2)
    expect(w.vm.computedSum).toBe(5)
    expect(w.find('.mcl-total .mcl-tag').text()).toBe('5')
  })
})
