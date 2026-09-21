/**
 * $antConfirm3 —— 带第三个按钮的 Modal.confirm。
 *
 * 挂载逻辑照搬 ant-design-vue@1.7.8 的 es/modal/confirm.js：同样在 body 下建一个 div
 * 手动 new Vue 渲染、同样返回 { destroy, update }、同样把 close 注册进 antd 的
 * destroyFns，因此 Modal.destroyAll() 一样能把它清掉，调用方无需区别对待。
 *
 * 用法与 this.$confirm 保持一致，额外支持 thirdText / onThird / thirdType / thirdButtonProps
 * （thirdType 之于第三个按钮，等同 okType 之于确定按钮）以及 thirdPlacement：
 * 第三个按钮默认排在最右，传 'middle' / 'left' 可改站位。
 *
 *   this.$antConfirm3({
 *     title: '确认发布？',
 *     content: '发布后不可撤回',
 *     okText: '发布', thirdText: '存为草稿', cancelText: '取消',
 *     // 默认排列：[取消] [发布] [存为草稿]
 *     onOk: () => this.publish(),      // 返回 Promise 则按钮自动 loading，同 $confirm
 *     onThird: () => this.saveDraft()
 *   })
 */
import Vue from 'vue'
import Base from 'ant-design-vue/es/base'
import { destroyFns } from 'ant-design-vue/es/modal/Modal'
import ConfirmDialog3 from './ConfirmDialog3'

export default function confirm3(config) {
  const div = document.createElement('div')
  const el = document.createElement('div')
  div.appendChild(el)
  document.body.appendChild(div)

  // parentContext 只用于给 new Vue 指定 parent，不能作为 props 往下传
  const { parentContext, ...restConfig } = config
  // type 与 okCancel 这两个默认值是 Modal.confirm 在 es/modal/index.js 里补的，
  // 这里必须一并补上：confirm.less 的图标配色选择器是 `.ant-modal-confirm-confirm`，
  // 少了 type 就会渲染成 -undefined，问号图标的橙色会丢
  let currentConfig = {
    type: 'confirm',
    okCancel: true,
    // 与 $confirm 有意不同的一处：默认不自动聚焦确定按钮。
    // antd 的 .ant-btn-primary:focus 会把背景换成浅一档主色（@primary-5），
    // 两按钮时看不出来，三按钮里两个 primary 并排就成了明显色差。
    // 需要「打开即回车确认」的调用点自己传 autoFocusButton: 'ok' 找回来。
    autoFocusButton: null,
    ...restConfig,
    close,
    visible: true
  }

  let confirmDialogInstance = null
  const confirmDialogProps = { props: {} }

  function close(...args) {
    destroy(...args)
  }

  function update(newConfig) {
    currentConfig = { ...currentConfig, ...newConfig }
    confirmDialogProps.props = currentConfig
  }

  function destroy(...args) {
    if (confirmDialogInstance && div.parentNode) {
      confirmDialogInstance.$destroy()
      confirmDialogInstance = null
      div.parentNode.removeChild(div)
    }

    // 点遮罩/按 Esc 关闭时 Dialog 会带上 triggerCancel，此时补调一次 onCancel
    const triggerCancel = args.some(param => param && param.triggerCancel)
    if (config.onCancel && triggerCancel) {
      config.onCancel(...args)
    }

    for (let i = 0; i < destroyFns.length; i++) {
      if (destroyFns[i] === close) {
        destroyFns.splice(i, 1)
        break
      }
    }
  }

  function render(props) {
    confirmDialogProps.props = props
    // antd install 时会把宿主 Vue 存进 Base.Vue；项目里 overrides 钉了单份 vue，
    // 这里仍沿用原版的取法，避免出现第二份 Vue 时渲染到错误的实例上
    const V = Base.Vue || Vue
    return new V({
      el,
      parent: parentContext,
      data() {
        return { confirmDialogProps }
      },
      render(h) {
        // 先解构一层再传，原版注释为「避免报错，原因不详」，这里保持一致
        const cdProps = { ...this.confirmDialogProps }
        return h(ConfirmDialog3, cdProps)
      }
    })
  }

  confirmDialogInstance = render(currentConfig)
  destroyFns.push(close)

  return {
    destroy: close,
    update
  }
}
