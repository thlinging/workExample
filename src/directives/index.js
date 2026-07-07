import resizeDirective from './resize-modal'
import dragDirective from './drag-modal'
import fullscreenDirective from './fullscreen-modal'

// 三个弹窗增强指令（resize / drag / fullscreen）的统一安装函数。
// 默认导出的就是这个安装函数本身，用法：
//   import installModalDirectives from '@/directives'
//   Vue.use(installModalDirectives)
// 如需自定义指令名，可传：
//   Vue.use(installModalDirectives, {
//     resize: { name: 'resize-modal' },
//     drag: { name: 'drag-modal' },
//     fullscreen: { name: 'fullscreen-modal' }
//   })
export default function install(Vue, options = {}) {
  const resizeName = (options.resize && options.resize.name) || 'resize-modal'
  const dragName = (options.drag && options.drag.name) || 'drag-modal'
  const fullscreenName = (options.fullscreen && options.fullscreen.name) || 'fullscreen-modal'
  Vue.directive(resizeName, resizeDirective)
  Vue.directive(dragName, dragDirective)
  Vue.directive(fullscreenName, fullscreenDirective)
}

// 也可按需单独引入某个指令自行注册：
//   import { dragDirective } from '@/directives'
//   Vue.directive('drag-modal', dragDirective)
export { resizeDirective, dragDirective, fullscreenDirective }
