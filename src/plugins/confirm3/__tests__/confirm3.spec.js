import Vue from 'vue'
import { describe, it, expect, afterEach, vi } from 'vitest'
import Modal from 'ant-design-vue/es/modal'
import Confirm3Plugin, { confirm3 } from '@/plugins/confirm3'

// 真实运行时 plugins/ant-design-vue.js 里的 Vue.use(Modal) 会经由 Base 注册
// ant-ref / ant-portal 指令，测试里补上，环境才与线上一致
Vue.use(Modal)

// 函数式弹窗直接挂在 body 下，断言与清理都对着 document 做
const btns = () => document.querySelectorAll('.ant-modal-confirm-btns .ant-btn')
// antd Button 会给「两个汉字」的文案自动插一个空格（取 消），这里归一化后再比文案。
// 反过来说，第三个按钮同样吃到这条规则，说明它走的就是真正的 antd Button
const norm = el => el.textContent.replace(/\s+/g, '')
const texts = () => Array.from(btns()).map(norm)
// 按文案取按钮，免得断言被 thirdPlacement 改变的下标带偏
const btn = text => Array.from(btns()).find(b => norm(b) === text)

// 等一次渲染；Modal 内部还有一层 transition，故多刷几拍更稳
async function flush(times = 3) {
  for (let i = 0; i < times; i++) await Vue.nextTick()
}
// ActionButton 的 autoFocus 走的是 setTimeout，nextTick 推不动，得等真实定时器
const waitTimer = (ms = 30) => new Promise(resolve => setTimeout(resolve, ms))

afterEach(() => {
  Modal.destroyAll()
  document.body.innerHTML = ''
})

describe('confirm3 — 插件安装', () => {
  it('Vue.use 后挂在原型上的方法名是 $antConfirm3', () => {
    Vue.use(Confirm3Plugin)

    expect(Vue.prototype.$antConfirm3).toBe(confirm3)
  })
})

describe('confirm3 — 按钮渲染', () => {
  it('传 thirdText 时渲染三个按钮，第三个默认排在最右', async () => {
    confirm3({
      title: '确认发布？',
      content: '发布后不可撤回',
      okText: '发布',
      thirdText: '存为草稿',
      cancelText: '取消'
    })
    await flush()

    expect(texts()).toEqual(['取消', '发布', '存为草稿'])
  })

  it('thirdPlacement 可以把第三个按钮挪到中间或最左', async () => {
    confirm3({ okText: '发布', thirdText: '存为草稿', cancelText: '取消', thirdPlacement: 'middle' })
    await flush()
    expect(texts()).toEqual(['取消', '存为草稿', '发布'])

    Modal.destroyAll()
    await flush()

    confirm3({ okText: '发布', thirdText: '存为草稿', cancelText: '取消', thirdPlacement: 'left' })
    await flush()
    expect(texts()).toEqual(['存为草稿', '取消', '发布'])
  })

  it('thirdPlacement 传了非法值时回退到最右，不至于漏渲染按钮', async () => {
    confirm3({ okText: '发布', thirdText: '存为草稿', cancelText: '取消', thirdPlacement: '乱写的' })
    await flush()

    expect(texts()).toEqual(['取消', '发布', '存为草稿'])
  })

  it('不传 thirdText 时退化为原版的两个按钮', async () => {
    confirm3({ title: '确认？', okText: '确定', cancelText: '取消' })
    await flush()

    expect(texts()).toEqual(['取消', '确定'])
  })

  it('沿用 antd 的 confirm class，故样式走原版 confirm.less', async () => {
    confirm3({ title: '确认？', thirdText: '第三个' })
    await flush()

    expect(document.querySelector('.ant-modal-confirm')).toBeTruthy()
    expect(document.querySelector('.ant-modal-confirm-body-wrapper')).toBeTruthy()
    expect(document.querySelector('.ant-modal-confirm-btns')).toBeTruthy()
    // 第三个按钮就是普通 .ant-btn，间距由相邻选择器 button + button 兜住
    expect(btn('第三个').classList.contains('ant-btn')).toBe(true)
  })

  it('补上了 Modal.confirm 的 type 默认值，图标配色选择器才能命中', async () => {
    confirm3({ title: '确认？', thirdText: '第三个' })
    await flush()

    // confirm.less 靠 .ant-modal-confirm-confirm ... > .anticon 给问号图标上橙色，
    // 挂载层漏掉 type 默认值的话这里会变成 .ant-modal-confirm-undefined，颜色就丢了
    expect(document.querySelector('.ant-modal-confirm-confirm')).toBeTruthy()
    expect(document.querySelector('.ant-modal-confirm-body > .anticon')).toBeTruthy()
  })

  it('okType 只作用于确定按钮，第三个按钮是默认样式', async () => {
    confirm3({ title: '确认？', okText: '确定', cancelText: '取消', thirdText: '第三个' })
    await flush()

    expect(btn('确定').classList.contains('ant-btn-primary')).toBe(true)
    expect(btn('第三个').classList.contains('ant-btn-primary')).toBe(false)
    expect(btn('取消').classList.contains('ant-btn-primary')).toBe(false)
  })

  it('thirdType 是第三个按钮的顶层简写，对称于 okType', async () => {
    confirm3({ title: '确认？', thirdText: '仅归档', thirdType: 'dashed' })
    await flush()

    expect(btn('仅归档').classList.contains('ant-btn-dashed')).toBe(true)
  })

  it('同时给了 thirdType 和 thirdButtonProps 时以后者为准（与 okType 的行为一致）', async () => {
    // Vue 提取 props 时 props 优先于 attrs，thirdType 走 attrs、buttonProps 走 props，
    // 故后者胜出；okType 与 okButtonProps 也是这个关系
    confirm3({
      title: '确认？',
      thirdText: '仅归档',
      thirdType: 'dashed',
      thirdButtonProps: { props: { type: 'danger' } }
    })
    await flush()

    expect(btn('仅归档').classList.contains('ant-btn-danger')).toBe(true)
    expect(btn('仅归档').classList.contains('ant-btn-dashed')).toBe(false)
  })

  it('thirdButtonProps 能透传到第三个按钮', async () => {
    confirm3({
      title: '确认？',
      thirdText: '危险操作',
      thirdButtonProps: { props: { type: 'danger' } }
    })
    await flush()

    expect(btn('危险操作').classList.contains('ant-btn-danger')).toBe(true)
  })
})

describe('confirm3 — 自动聚焦', () => {
  it('默认不聚焦任何按钮，两个 primary 并排时才不会有 focus 态色差', async () => {
    // antd 的 .ant-btn-primary:focus 会换成浅一档主色，这是与 $confirm 有意不同的一处
    confirm3({ title: '确认？', okText: '发布', thirdText: '存为草稿', thirdType: 'primary' })
    await flush()
    await waitTimer()

    expect(Array.from(btns()).some(b => document.activeElement === b)).toBe(false)
  })

  it('调用方传 autoFocusButton 能把自动聚焦要回来', async () => {
    confirm3({ title: '确认？', okText: '发布', thirdText: '存为草稿', autoFocusButton: 'ok' })
    await flush()
    await waitTimer()

    expect(document.activeElement).toBe(btn('发布'))
  })

  it('autoFocusButton 也能指到第三个按钮', async () => {
    confirm3({ title: '确认？', okText: '发布', thirdText: '存为草稿', autoFocusButton: 'third' })
    await flush()
    await waitTimer()

    expect(document.activeElement).toBe(btn('存为草稿'))
  })
})

describe('confirm3 — 第三个按钮的行为', () => {
  it('点击后调用 onThird 并关闭弹窗', async () => {
    const onThird = vi.fn()
    confirm3({ title: '确认？', thirdText: '存为草稿', onThird })
    await flush()

    btn('存为草稿').click()
    await flush()

    expect(onThird).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.ant-modal-confirm')).toBeFalsy()
  })

  it('onThird 返回 Promise 时按钮进入 loading，resolve 后才关闭', async () => {
    let resolveFn
    const onThird = () => new Promise(resolve => { resolveFn = resolve })
    confirm3({ title: '确认？', thirdText: '提交', onThird })
    await flush()

    btn('提交').click()
    await flush()

    expect(btn('提交').classList.contains('ant-btn-loading')).toBe(true)
    expect(document.querySelector('.ant-modal-confirm')).toBeTruthy()

    resolveFn()
    await flush(5)

    expect(document.querySelector('.ant-modal-confirm')).toBeFalsy()
  })

  it('onThird 声明了形参时交由调用方自己决定何时关闭', async () => {
    // 与 ActionButton 的既有约定一致：actionFn.length 非 0 则把 close 传进去
    let close
    const onThird = fn => { close = fn }
    confirm3({ title: '确认？', thirdText: '提交', onThird })
    await flush()

    btn('提交').click()
    await flush()

    expect(document.querySelector('.ant-modal-confirm')).toBeTruthy()

    close()
    await flush()

    expect(document.querySelector('.ant-modal-confirm')).toBeFalsy()
  })

  it('确定与取消按钮的回调不受影响', async () => {
    const onOk = vi.fn()
    const onCancel = vi.fn()
    confirm3({ title: '确认？', cancelText: '取消', thirdText: '第三个', onOk, onCancel })
    await flush()

    btn('取消').click()
    await flush()
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onOk).not.toHaveBeenCalled()
  })
})

describe('confirm3 — 生命周期与 antd 保持一致', () => {
  it('返回 { destroy, update }，destroy 会移除挂载节点', async () => {
    const modal = confirm3({ title: '确认？', thirdText: '第三个' })
    await flush()
    expect(typeof modal.destroy).toBe('function')
    expect(typeof modal.update).toBe('function')

    modal.destroy()
    await flush()

    expect(document.querySelector('.ant-modal-confirm')).toBeFalsy()
  })

  it('update 能改写文案', async () => {
    const modal = confirm3({ title: '确认？', thirdText: '第三个', okText: '确定' })
    await flush()

    modal.update({ okText: '我确定了' })
    await flush()

    expect(btn('我确定了')).toBeTruthy()
  })

  it('close 注册进了 antd 的 destroyFns，Modal.destroyAll() 能清掉它', async () => {
    confirm3({ title: '确认？', thirdText: '第三个' })
    await flush()
    expect(document.querySelector('.ant-modal-confirm')).toBeTruthy()

    Modal.destroyAll()
    await flush()

    expect(document.querySelector('.ant-modal-confirm')).toBeFalsy()
  })
})
