// antd 主题色阶生成 —— 构建期(vue.config.js)与运行时(浏览器)共用同一份逻辑，
// 保证 matchColors(构建抽取) 与 newColors(运行时替换) 顺序严格一一对应。
// 思路复刻 ant-design-pro-vue 的 getThemeColors。
const varyColor = require('webpack-theme-color-replacer/client/varyColor')
const { generate } = require('@ant-design/colors')

// 给定一个主色，产出一串"与该主色相关的派生色"。
// 只要构建期和运行期都调用本函数（传各自的主色），两边数组顺序天然一致。
function getAntdSerials(color) {
  // 9 档由浅到深的 lighten 变体：覆盖 hover / active / faded / border 等派生色
  const lightens = new Array(9).fill().map((t, i) => varyColor.lighten(color, i / 10))
  // antd 官方调色板 primary-1 ~ primary-10
  const palettes = generate(color)
  // rgb 逗号形式：部分 rgba() 规则用到
  const rgb = varyColor.toNum3(color).join(',')
  return lightens.concat(palettes).concat(rgb)
}

module.exports = { getAntdSerials }
