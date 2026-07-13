// antd + element 运行时换肤引擎（webpack-theme-color-replacer）的构建配置。
// 从 vue.config.js 抽离，与 ThemeManager 的 changeColor 配套；两侧共用 getThemeSerials
// 保证「构建抽取」与「运行替换」的色序一一对应。原理与踩坑详见 docs/主题换肤方案说明.md。
//
// 用法：vue.config.js 里 require 本文件，传入当前方案主色即可得到配好的插件实例，
// 无需关心内部的选择器收窄 / 产物补丁细节。
const ThemeColorReplacer = require('webpack-theme-color-replacer')
const forElementUI = require('webpack-theme-color-replacer/forElementUI')
const { getThemeSerials } = require('./colorSeries')

module.exports = function createThemeColorReplacer(primaryColor) {
  return new ThemeColorReplacer({
    // 固定名（不用 [contenthash]）：injectCss 下该 css 已注入带 hash 的 js，
    // 无需再对文件名做 hash；同时规避插件内部 md4 在 Node 17+/OpenSSL3 下的报错。
    fileName: 'static/css/theme-colors.css',
    // 与运行时 ThemeManager 用同一个 getThemeSerials（antd 色板 + element mix 派生色
    // 的合并序列），保证顺序一一对应；主色取当前方案，天然与 modifyVars/elementVars 对齐
    matchColors: getThemeSerials(primaryColor),
    // 收窄宽泛选择器：抽取器只抽「含主题色的声明」，color:#fff / transparent 等修正声明被丢弃。
    // 选择器过宽时，追加到 <body> 尾的规则同优先级后来居上，会盖掉原样式的白字/透明边框
    // （dark 标签、primary 按钮悬浮白字等）。下面对 antd、element 的几处宽泛规则逐一收窄。
    // 详见 docs/主题换肤方案说明.md。
    changeSelector(selector, util) {
      // antd 默认按钮 hover/active 宽泛规则：排除自带白字的 primary/danger、透明边框的 link
      // （否则悬浮被染出边框），这些态由原样式保留
      if (selector === '.ant-btn:focus,.ant-btn:hover' ||
          selector === '.ant-btn.active,.ant-btn:active') {
        return util.changeEach(selector,
          ':not(.ant-btn-primary):not(.ant-btn-danger):not(.ant-btn-link)')
      }
      // antd 横向菜单 hover/选中文字染主色，本为浅色菜单设计；但深色顶栏 (.ant-menu-dark)
      // 同挂一个 <ul>、同优先级也命中，会把 hover 白字变主色。收窄成 :not(.ant-menu-dark)，
      // 只作用浅色菜单；深色菜单选中主色底由独立 .ant-menu-dark 规则照常换色
      if (/\.ant-menu-horizontal\s*>/.test(selector)) {
        return selector.replace(/\.ant-menu-horizontal(\s*)>/g,
          '.ant-menu-horizontal:not(.ant-menu-dark)$1>')
      }
      // element 标签：除官方排除的 dark，还要排除 plain（白底会被 light-9 盖）和四种功能色
      // type（其规则不含主题色不被抽取，但 :not 收窄推高优先级，不排会反盖功能色）
      const TAG_VARIANTS = ':not(.el-tag--success):not(.el-tag--warning)' +
        ':not(.el-tag--danger):not(.el-tag--info)'
      if (selector === '.el-tag .el-tag__close') {
        return '.el-tag:not(.el-tag--dark)' + TAG_VARIANTS + ' .el-tag__close'
      }
      const changed = forElementUI.changeSelector(selector, util)
      if (changed === '.el-tag:not(.el-tag--dark)') {
        return '.el-tag:not(.el-tag--dark):not(.el-tag--plain)' + TAG_VARIANTS
      }
      // sass 自编译把官方合并规则 .el-button.is-active,.el-button.is-plain:active 拆开了，
      // 落单的 .el-button.is-active 会盖掉五种 type 按钮 is-active 的白字，这里补收窄
      if (changed === '.el-button.is-active') {
        return changed + ':not(.el-button--primary):not(.el-button--success)' +
          ':not(.el-button--warning):not(.el-button--danger):not(.el-button--info)'
      }
      return changed
    },
    // 补回被抽取丢掉的「非主题色修正声明」：原样式里靠文档顺序获胜的 transparent/白字修正
    // 不含主题色、不被抽取，追加的主色规则会反超它们，故在产物末尾补回。
    resolveCss(css) {
      return css +
        // link 按钮悬浮无边框（原样式用 transparent 盖掉色板5边框）
        '.ant-btn-link:hover,.ant-btn-link:focus,.ant-btn-link:active{border-color:transparent}' +
        // 步骤条「进行中」圈内数字白字（原样式用 #fff 盖掉主色打底），否则同色底看不见
        '.ant-steps-item-process .ant-steps-item-icon>.ant-steps-icon{color:#fff}'
    },
    // 把抽取出的主题色样式直接注入 js，运行时无需额外下载 css 文件（省一次请求、切换更即时）
    injectCss: true,
    isJsUgly: process.env.NODE_ENV !== 'development'
  })
}
