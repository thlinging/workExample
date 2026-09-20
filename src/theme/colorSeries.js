// antd / element 主题色阶生成 —— 构建期(vue.config.js)与运行时(浏览器)共用同一份逻辑，
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

// element-ui(theme-chalk) 的主色派生色 —— 源码里全部由 scss mix() 算出，
// 权重定义见 node_modules/element-ui/packages/theme-chalk/src/common/var.scss 与 button.scss。
// varyColor.mix 与 dart-sass 的 mix() 同公式同舍入、输出小写 hex，
// 可与 element-theme.scss 的编译产物逐字节对齐（替换引擎按字符串精确匹配，差一字节就失效）。
function getElementSerials(color) {
  // $--color-primary-light-1~9 = mix(白, 主色, 10%~90%)：hover 背景、表格选中行、plain 按钮等
  const lights = new Array(9).fill().map((t, i) => varyColor.mix('#fff', color, (i + 1) / 10))
  return lights.concat([
    // 按钮 :active 文字/边框 = mix(黑, 主色, 10%)（$--button-active-shade-percent）
    varyColor.mix('#000', color, 0.1),
    // slider 滑块 hover = mix(主色, 黑, 97%)（$--slider-button-hover-color）
    varyColor.mix(color, '#000', 0.97),
    // 树「当前高亮行」底色 = mix(白, 主色, 92%)。tree.scss 里直接写死了 92%，
    // 不走 light-1~9 那套 10% 步进，不补这一档换主色时树的选中行不会跟着变。
    // （element 官方的换肤色序同样漏了它，这里是本项目补的一档，供 el-tree 与
    //   vue-easy-tree 共用——两者类名相同、样式同源。）
    varyColor.mix('#fff', color, 0.92)
  ])
}

// antd + element 合并色阶：构建侧 matchColors 与运行侧 newColors 都用它，两库色系
// 随主色一次替换。两序列有重复值（主色本身、部分档位相同），新旧映射一致，重复无害。
function getThemeSerials(color) {
  return getAntdSerials(color).concat(getElementSerials(color))
}

module.exports = { getAntdSerials, getElementSerials, getThemeSerials }
