// 编译期主题方案：由 .env 的 VUE_APP_THEME 选定（default / deepRed），
// 全部变量集中在 src/theme/presets.js 维护，这里只负责取用。
const { getPreset } = require('./src/theme/presets')
const theme = getPreset(process.env.VUE_APP_THEME)

// antd + element 运行时换肤引擎（webpack-theme-color-replacer）。配置与踩坑注释都在
// src/theme/themeColorReplacer.js，这里只按当前方案主色实例化。
const createThemeColorReplacer = require('./src/theme/themeColorReplacer')

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
    },
    // 双后台分流：前缀与 .env.* 里的 VUE_APP_BASE_API* 一一对应，
    // 生产环境由 nginx 的两个 location 做同样的事。改 target 为真实地址即可。
    //
    // ⚠️ pathRewrite 必须和 nginx 的 proxy_pass 尾斜杠保持同一行为，否则本地正常线上 404：
    //    不 rewrite  <=>  proxy_pass http://host:port;   （保留前缀）
    //    rewrite 掉  <=>  proxy_pass http://host:port/;  （剥掉前缀）
    // 判断依据是后端接口真实路径带不带这个前缀，详见 docs/多后台接口方案.md
    //
    // 规则按 key 顺序匹配，所以两个前缀不能互为前缀（用 /api + /bapi 而非 /api + /api-b）
    proxy: {
      // A 服务：后端自带 /api 上下文，前缀原样转发
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      },
      // B 服务：/bapi 只是为分流造出来的前缀，转发前剥掉
      '/bapi': {
        target: 'http://127.0.0.1:9090',
        changeOrigin: true,
        pathRewrite: { '^/bapi': '' }
      }
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
      createThemeColorReplacer(theme.modifyVars['@primary-color'])
    ]
  }
}
