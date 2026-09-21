/**
 * ConfirmDialog3 —— 三按钮版 confirm 的渲染层。
 *
 * 结构、class 名、按钮组件全部复刻 ant-design-vue@1.7.8 的 es/modal/ConfirmDialog.js，
 * 因此外观 100% 由 antd 自己的 confirm.less 决定，本文件不含一行 CSS；按钮间距也靠
 * 那份 less 里的 `.ant-modal-confirm-btns button + button { margin-left: 8px }`
 * 自动生效，第三个按钮不用补样式。
 *
 * 与原版的唯一差异：按钮区可以多渲染一个按钮（thirdText / onThird）。
 *
 * 这不是给页面直接写标签用的组件，而是 $antConfirm3() 的内部渲染层：
 * props.close 由挂载层 confirm3.js 注入，直接当组件用会缺这个注入而无法关闭。
 */
import Icon from 'ant-design-vue/es/icon'
import Dialog from 'ant-design-vue/es/modal/Modal'
import ActionButton from 'ant-design-vue/es/modal/ActionButton'
import { getConfirmLocale } from 'ant-design-vue/es/modal/locale'

export default {
  // 与原版一致的函数式组件：不声明 props，挂载层通过 h(_, { props }) 整份传进来
  functional: true,
  render(h, context) {
    const { props } = context
    const {
      onCancel,
      onOk,
      onThird,
      close,
      zIndex,
      afterClose,
      visible,
      keyboard,
      centered,
      getContainer,
      maskStyle,
      okButtonProps,
      cancelButtonProps,
      thirdButtonProps,
      closable = false
    } = props

    // iconType 在 antd 里已废弃，这里仅作回退以便老调用方平移
    const icon = props.icon || props.iconType || 'question-circle'
    const okType = props.okType || 'primary'
    // 与 okType 对称的顶层简写；不给默认值，缺省即 antd 的默认按钮样式
    const thirdType = props.thirdType
    const prefixCls = props.prefixCls || 'ant-modal'
    const contentPrefixCls = `${prefixCls}-confirm`
    const okCancel = 'okCancel' in props ? props.okCancel : true
    const width = props.width || 416
    const style = props.style || {}
    const mask = props.mask === undefined ? true : props.mask
    const maskClosable = props.maskClosable === undefined ? false : props.maskClosable
    const runtimeLocale = getConfirmLocale()
    const okText = props.okText || (okCancel ? runtimeLocale.okText : runtimeLocale.justOkText)
    const cancelText = props.cancelText || runtimeLocale.cancelText
    const thirdText = props.thirdText
    // 第三个按钮的站位，默认排在最右；非法值一律回退到 right
    const thirdPlacement = props.thirdPlacement || 'right'
    const autoFocusButton = props.autoFocusButton === null ? false : props.autoFocusButton || 'ok'
    const transitionName = props.transitionName || 'zoom'
    const maskTransitionName = props.maskTransitionName || 'fade'

    const classString = [
      contentPrefixCls,
      `${contentPrefixCls}-${props.type}`,
      `${prefixCls}-${props.type}`,
      props.class
    ].filter(Boolean).join(' ')

    const cancelButton = okCancel && h(ActionButton, {
      attrs: {
        actionFn: onCancel,
        closeModal: close,
        autoFocus: autoFocusButton === 'cancel',
        buttonProps: cancelButtonProps
      }
    }, [cancelText])

    // 不传 thirdText 就退化成原版的两按钮，方便调用方从 $confirm 平移过来
    const thirdButton = thirdText && h(ActionButton, {
      attrs: {
        type: thirdType,
        actionFn: onThird,
        closeModal: close,
        autoFocus: autoFocusButton === 'third',
        buttonProps: thirdButtonProps
      }
    }, [thirdText])

    const okButton = h(ActionButton, {
      attrs: {
        type: okType,
        actionFn: onOk,
        closeModal: close,
        autoFocus: autoFocusButton === 'ok',
        buttonProps: okButtonProps
      }
    }, [okText])

    const BTN_ORDER = {
      left: [thirdButton, cancelButton, okButton],
      middle: [cancelButton, thirdButton, okButton],
      right: [cancelButton, okButton, thirdButton]
    }
    const orderedBtns = BTN_ORDER[thirdPlacement] || BTN_ORDER.right

    const iconNode = typeof icon === 'string' ? h(Icon, { attrs: { type: icon } }) : icon(h)

    return h(Dialog, {
      attrs: {
        prefixCls,
        wrapClassName: centered ? `${contentPrefixCls}-centered` : '',
        visible,
        closable,
        title: '',
        transitionName,
        // confirm 形态下底部按钮由 body 里的 -btns 承担，Dialog 自带的 footer 必须留空
        footer: '',
        maskTransitionName,
        mask,
        maskClosable,
        maskStyle,
        width,
        zIndex,
        afterClose,
        keyboard,
        centered,
        getContainer
      },
      class: classString,
      on: {
        cancel: e => close({ triggerCancel: true }, e)
      },
      style
    }, [
      h('div', { class: `${contentPrefixCls}-body-wrapper` }, [
        h('div', { class: `${contentPrefixCls}-body` }, [
          iconNode,
          props.title === undefined ? null : h('span', { class: `${contentPrefixCls}-title` }, [
            typeof props.title === 'function' ? props.title(h) : props.title
          ]),
          h('div', { class: `${contentPrefixCls}-content` }, [
            typeof props.content === 'function' ? props.content(h) : props.content
          ])
        ]),
        h('div', { class: `${contentPrefixCls}-btns` }, orderedBtns.filter(Boolean))
      ])
    ])
  }
}
