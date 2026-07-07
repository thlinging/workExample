// antd 运行时换肤（webpack-theme-color-replacer）已暂时屏蔽。
// 恢复方法：放开下面两行 require 和 configureWebpack.plugins 里的插件注释，
// 同时放开 src/theme/ThemeManager.js 里的 changeColor 调用。详见 docs/主题换肤方案说明.md。
// const ThemeColorReplacer = require('webpack-theme-color-replacer')
// const { getAntdSerials } = require('./src/theme/colorSeries')

// 编译期主题方案：由 .env 的 VUE_APP_THEME 选定（default / ocean / forest），
// 全部变量集中在 src/theme/presets.js 维护，这里只负责取用。
const { getPreset } = require('./src/theme/presets')
const theme = getPreset(process.env.VUE_APP_THEME)

module.exports = {
  publicPath: './',
  outputDir: 'dist',
  assetsDir: 'static',
  productionSourceMap: false,
  lintOnSave: process.env.NODE_ENV !== 'production',
  devServer: {
    host: '0.0.0.0',
    port: 8080,
    open: true,
    overlay: {
      warnings: false,
      errors: true
    }
  },
  css: {
    loaderOptions: {
      less: {
        // 编译期定制 antd 主题：覆盖 antd 的 less 变量后再编译。
        // 未显式覆盖的派生变量（@primary-1~9 等）会自动跟随 @primary-color。
        modifyVars: theme.modifyVars,
        javascriptEnabled: true
      },
      scss: {
        // 编译期定制 element-ui 主题：与 antd 同源（presets.js 派生的 $--xx 变量），
        // 注入到每个 scss 文件顶部。本项目样式全走 less，
        // 实际只作用于 src/theme/element-theme.scss 这一个入口，无污染。
        additionalData: theme.elementVars
      }
    }
  },
  configureWebpack: {
    plugins: [
      // antd 运行时换肤引擎（暂时屏蔽，恢复见文件顶部说明）
      // new ThemeColorReplacer({
      //   // 固定名（不用 [contenthash]）：injectCss 下该 css 已注入带 hash 的 js，
      //   // 无需再对文件名做 hash；同时规避插件内部 md4 在 Node 17+/OpenSSL3 下的报错。
      //   fileName: 'static/css/theme-colors.css',
      //   // 与运行时 ThemeManager 用同一个 getAntdSerials，保证顺序一一对应；
      //   // 主色直接取当前方案，天然与 modifyVars 对齐
      //   matchColors: getAntdSerials(theme.modifyVars['@primary-color']),
      //   // 把抽取出的主题色样式直接注入 js，运行时无需额外下载 css 文件（省一次请求、切换更即时）
      //   injectCss: true,
      //   isJsUgly: process.env.NODE_ENV !== 'development'
      // })
    ]
  }
}
