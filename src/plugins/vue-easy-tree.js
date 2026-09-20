import Vue from 'vue'
// 只补 element theme-chalk 里没有的那一条虚拟滚动样式，其余全部复用项目主题（见下）
import './vue-easy-tree.css'

/*
 * vue-easy-tree（@wchbrad/vue-easy-tree 1.0.13）—— 支持虚拟滚动的大数据量树。
 * API 与 element-ui 的 el-tree 对齐（data / props / node-key / show-checkbox /
 * lazy+load / filter / draggable，方法也是 setCheckedKeys / getCheckedNodes / filter）。
 *
 * ── 为什么从 src 源码引入，而不是 import 包名 ──────────────────────────
 * 该包的 package.json main 指向 dist/vue-easy-tree.js，那是个 **没有配 externals**
 * 的 UMD 包：作者把整份 vue 2.6.11（含编译器）打了进去。直接 import 包名会得到
 * 第二个 Vue 实例，且平白多出 ~100KB 产物。
 * 改从 src 引入后：组件由本项目的 webpack 编译，用的就是项目自己的 vue 2.6.2，
 * 全局单实例。代价是需要 vue.config.js 的 transpileDependencies（它含 JSX）。
 *
 * ── 为什么不引它自带的 src/assets/index.scss ──────────────────────────
 * 它的样式就是 element-ui 树样式的副本，$namespace 同为 'el'，类名完全是
 * .el-tree / .el-tree-node / .el-checkbox；而本项目的 element 主题入口
 * （src/theme/element-theme.scss）编译的是 theme-chalk **全量** index.scss，
 * 早已包含 tree.scss + checkbox.scss + icon.scss。
 * 因此复用项目样式即可，还白拿三件事：
 *   1) 编译期主题——色值来自 presets.js，与 antd 同源；
 *   2) 运行时换肤——色值在抽取范围内，ThemeManager 换色时树跟着变；
 *   3) Mintlify 覆盖层——见 theme/mintlify.css 末尾的 el-tree 段。
 * 反过来若引它自带的 scss，那份样式带的是写死的 element 默认蓝，既不跟主题也不跟换肤。
 * 逐行 diff 过两份 tree.scss，实质差异只有两条，处理见 vue-easy-tree.css。
 */
import VueEasyTree from '@wchbrad/vue-easy-tree/src/components/ve-tree.vue'

// 组件 name 为 'VueEasyTree'，注册后模板里写 <vue-easy-tree>
Vue.component(VueEasyTree.name, VueEasyTree)
