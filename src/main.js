import Vue from 'vue'
import App from './App.vue'
import router from './router'
import './plugins/ant-design-vue'
import './plugins/element-ui'
// 虚拟滚动树：样式复用上面 element 主题里的 .el-tree，故必须排在 element 之后
import './plugins/vue-easy-tree'
// Mintlify 设计系统：令牌层（字体 + CSS 变量）在前，组件覆盖层在后。
// 放在组件库样式之后引入，确保覆盖层能压过 antd/element 的默认样式。
import './theme/design-tokens.css'
import './theme/mintlify.css'
import ResizableModal from './plugins/resizable-modal'
import installModalDirectives from './directives'
import VueUeditorWrap from 'vue-ueditor-wrap'
import ThemeManager from './theme/ThemeManager'

Vue.use(ResizableModal)
// 默认导出即安装函数，Vue.use 会以 Vue 为参调用它注册三个指令
Vue.use(installModalDirectives)
// UEditor 1.4.3 的 Vue 封装（wrapper 本身不含 UEditor，资源在组件里用 UEDITOR_HOME_URL 指向 CDN）
Vue.component('vue-ueditor-wrap', VueUeditorWrap)

Vue.config.productionTip = false

new Vue({
  router,
  render: h => h(App)
}).$mount('#app')

// 应用初始主题（写入方案 CSS 变量，并恢复用户上次手动选的主题色）。挂载后调用，确保 DOM 就绪。
ThemeManager.init()
