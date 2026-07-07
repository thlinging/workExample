// 编译期主题方案注册表 —— modifyVars 的唯一源头。
// vue.config.js（Node 构建侧）与 ThemeManager.js（浏览器运行侧）共用本文件，
// 保证 antd 的 less 变量与业务自定义 CSS 变量永远出自同一套方案，不再有"多处对齐"问题。
//
// 用法：
//   · 选方案：改 .env 里的 VUE_APP_THEME（default / ocean / forest），重启 serve 或重新 build 生效
//   · 加方案：在 presets 里加一个对象即可，其余文件不用动
//   · 加公共变量：往 baseVars 里加（antd 全部可覆盖变量见
//     node_modules/ant-design-vue/lib/style/themes/default.less）
//
// 注意：这是"编译期"定制，运行时不可切换；运行时换色只影响 cssVars 驱动的自定义元素
// （antd 运行时换肤引擎已暂时屏蔽，见 vue.config.js 顶部说明）。
// CommonJS 写法是为了让 vue.config.js 能直接 require。

// ── 所有方案共用的 antd 默认变量（非主色类）────────────────────────────
const baseVars = {
  // 功能色：各方案统一，不随主色变
  '@success-color': '#52c41a',
  '@warning-color': '#faad14',
  '@error-color': '#f5222d',

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
  default: {
    name: '丹红（默认）',
    modifyVars: {
      '@primary-color': '#f5222d',
      '@link-color': '#f5222d'
    },
    cssVars: {
      '--header-bg': '#001529',
      '--breadcrumb-color': 'rgba(0, 0, 0, 0.45)'
    }
  },

  ocean: {
    name: '拂晓蓝',
    modifyVars: {
      '@primary-color': '#1890ff',
      '@link-color': '#1890ff'
    },
    cssVars: {
      '--header-bg': '#002766',
      '--breadcrumb-color': 'rgba(0, 0, 0, 0.45)'
    }
  },

  forest: {
    name: '极光绿',
    modifyVars: {
      '@primary-color': '#52c41a',
      '@link-color': '#52c41a'
    },
    cssVars: {
      '--header-bg': '#135200',
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
