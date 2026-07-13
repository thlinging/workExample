// 编译期主题方案注册表 —— modifyVars 的唯一源头。
// vue.config.js（Node 构建侧）与 ThemeManager.js（浏览器运行侧）共用本文件，
// 保证 antd 的 less 变量与业务自定义 CSS 变量永远出自同一套方案，不再有"多处对齐"问题。
//
// 用法：
//   · 选方案：改 .env 里的 VUE_APP_THEME（default / deepRed），重启 serve 或重新 build 生效
//   · 加方案：在 presets 里加一个对象即可，其余文件不用动
//   · 加公共变量：往 baseVars 里加（antd 全部可覆盖变量见
//     node_modules/ant-design-vue/lib/style/themes/default.less）
//
// 注意：这是"编译期"方案注册，运行时不可切换整套方案；运行时换主色由
// webpack-theme-color-replacer 做色值替换（antd+element+自定义元素），见 vue.config.js。
// CommonJS 写法是为了让 vue.config.js 能直接 require。

// ── 所有方案共用的 antd 默认变量（非主色类）────────────────────────────
const baseVars = {
  // 功能色：各方案统一，不随主色变。
  // ⚠️ 运行时换肤按颜色字符串匹配替换、不分语义：功能色及其全部派生色都不能与任何方案
  // 主色的替换序列撞值，否则换主色会连带劫持危险按钮/错误提示等。antd 默认 error/highlight
  // (=@red-6 #f5222d) 与本项目红系主色序列相邻、极易撞值，下面是程序化搜出的零碰撞近似色
  // （目视几乎无差）。单测把关：src/theme/__tests__/preset-collision.spec.js，改功能色或加方案跑 npm test。
  '@success-color': '#52b51b',
  '@warning-color': '#faad14',
  '@error-color': '#f5132c',
  '@highlight-color': '#f5132c', // antd 默认=@red-6，同 error 处理（表单必填星号等）
  '@info-color': '#1881fe', // antd 默认=@blue-6（功能蓝），程序化零碰撞近似色

  // 文字
  '@heading-color': 'rgba(0, 0, 0, 0.85)',
  '@text-color': 'rgba(0, 0, 0, 0.65)',
  '@text-color-secondary': 'rgba(0, 0, 0, 0.45)',
  '@font-size-base': '14px',

  // 边框 / 圆角
  '@border-color-base': '#d9d9d9',
  '@border-radius-base': '4px',

  // 布局
  '@layout-header-background': '#001529'
}

// ── 主题方案：每套 = antd 主色变量 + 业务自定义 CSS 变量 ─────────────────
// modifyVars 只写与该方案相关的"差异变量"，公共部分自动继承 baseVars。
// cssVars 里的 --primary-color 可省略，getPreset 会自动取 @primary-color 对齐。
const presets = {
  // Mintlify 设计系统的默认强调色：深薄荷 #00b48a。
  // 全站 antd/element 的主色（链接、开关/复选/单选选中、标签页、选中日期、分页当前页…）
  // 默认即取它，与 Mintlify 设计语言协调；主按钮由 mintlify.css 的 #app 覆盖恒为黑药丸。
  // 选深薄荷而非亮薄荷 #00d4a4：antd 有「主色底+白字」场景（选中日期格等），深薄荷白字对比更足。
  // /theme 页可临时预览别的色（不持久化、离开自动重置），详见 docs/Mintlify设计系统重构.md。
  mintlify: {
    name: '薄荷绿（Mintlify）',
    modifyVars: {
      '@primary-color': '#00b48a',
      '@link-color': '#00b48a'
    },
    cssVars: {
      '--header-bg': '#ffffff',
      '--breadcrumb-color': 'rgba(0, 0, 0, 0.45)'
    }
  },

  default: {
    name: '丹红（默认）',
    modifyVars: {
      '@primary-color': '#f12b25',
      '@link-color': '#f12b25'
    },
    cssVars: {
      '--header-bg': '#001529',
      '--breadcrumb-color': 'rgba(0, 0, 0, 0.45)'
    }
  },

  deepRed: {
    name: '深红',
    modifyVars: {
      '@primary-color': '#ac2417',
      '@link-color': '#ac2417'
    },
    cssVars: {
      '--header-bg': '#5c0011',
      '--breadcrumb-color': 'rgba(0, 0, 0, 0.45)'
    }
  }
}

// ── element-ui 出口：antd less 变量 → element scss 变量 ──────────────────
// 生成 "$--xx: 值;" 字符串，由 vue.config.js 经 sass-loader 的 additionalData
// 注入到 scss 文件顶部；先于 theme-chalk 源码里的 !default，官方默认值自动让位。
// element 全部可覆盖变量见 node_modules/element-ui/packages/theme-chalk/src/common/var.scss
const antdToElementMap = {
  '@primary-color':      '$--color-primary',
  '@success-color':      '$--color-success',
  '@warning-color':      '$--color-warning',
  '@error-color':        '$--color-danger',
  '@font-size-base':     '$--font-size-base',
  '@border-radius-base': '$--border-radius-base',
  '@border-color-base':  '$--border-color-base'
}

function toElementVars(modifyVars) {
  return Object.keys(antdToElementMap)
    .filter(k => modifyVars[k])
    .map(k => `${antdToElementMap[k]}: ${modifyVars[k]};`)
    .join('\n')
}

// 取一套完整方案（baseVars 已合并、--primary-color 已对齐、element 变量已派生）。
// key 不存在时回退 default，保证构建永不因配错主题而失败。
function getPreset(key) {
  const hit = Object.prototype.hasOwnProperty.call(presets, key)
  const k = hit ? key : 'default'
  const p = presets[k]
  const modifyVars = Object.assign({}, baseVars, p.modifyVars)
  // antd「进行中」色（progress/steps 当前步/badge processing）默认固定蓝、不跟随主色；
  // 让它默认取主色，编译期与运行时换肤才能一起变。方案显式配置则以配置为准
  if (!modifyVars['@processing-color']) {
    modifyVars['@processing-color'] = modifyVars['@primary-color']
  }
  const cssVars = Object.assign(
    { '--primary-color': modifyVars['@primary-color'] },
    p.cssVars
  )
  return { key: k, name: p.name, modifyVars, cssVars, elementVars: toElementVars(modifyVars) }
}

function listPresets() {
  return Object.keys(presets).map(k => getPreset(k))
}

module.exports = { presets, baseVars, getPreset, listPresets }
