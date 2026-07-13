// 主题管理：把主题方案落到页面上（antd/element 组件色值替换 + <html> 标记类 +
// 自定义 CSS 变量），并记忆用户偏好。
//   · usePreset(key)     —— 运行时切换整套方案（组件换色 + 标记类 + cssVars）
//   · changePrimary(hex) —— 只改主题色不切方案（用户手动选色）
//   · 持久化走可替换的存储层（默认 localStorage，将来存库时 setStorage 换实现即可）
//
// 组件换肤 = webpack-theme-color-replacer 运行时色值替换，与 vue.config.js 的
// ThemeColorReplacer 插件配套（构建期抽取 + 运行期替换共用 getThemeSerials）。
// 原理与踩坑详见 docs/主题换肤方案说明.md。
import client from 'webpack-theme-color-replacer/client'
import { getThemeSerials } from './colorSeries'

import { getPreset } from './presets'
import localThemeStorage from './themeStorage'

class ThemeManager {
  constructor() {
    // 出厂状态 = 编译期方案（VUE_APP_THEME）：保证 init 完成前 getKey/getPrimary 也有合法值
    const preset = getPreset(process.env.VUE_APP_THEME)
    this.current = preset.key
    this.primary = preset.modifyVars['@primary-color']
    this.storage = localThemeStorage
  }

  // 换存储实现（如登录后改为走接口存库）：传入符合 themeStorage.js 约定的 { load, save }
  setStorage(storage) {
    this.storage = storage
  }

  // 运行时切换整套方案，并持久化；切方案即重置用户自定义主色
  async usePreset(key) {
    const preset = await this._apply(getPreset(key))
    try {
      await this.storage.save({ key: preset.key, primary: null })
    } catch (e) { /* 存储失败不阻塞换肤 */ }
    return preset
  }

  // 只改主题色（不切方案），并持久化。保留供将来「用户主题存库」用；
  // 当前 /theme 演示走不持久化的 preview()。
  async changePrimary(color) {
    await this._applyPrimary(color)
    try {
      await this.storage.save({ primary: color })
    } catch (e) { /* 存储失败不阻塞换肤 */ }
    return color
  }

  // 临时预览某主题色（/theme 演示专用）：只落到页面，不持久化。
  // 配合路由守卫「离开 /theme 调 reset()」，实现「演示页跟随主色、其余系统恒为 Mintlify」。
  async preview(color) {
    await this._applyPrimary(color)
    return color
  }

  // 重置回当前方案主色（Mintlify 深薄荷），不持久化。离开 /theme 时调用。
  async reset() {
    await this._apply(getPreset(this.current))
    return this.primary
  }

  // 应用初始主题：编译期方案打底 → 叠加存储的方案 → 叠加存储的自定义主色
  async init() {
    await this._apply(getPreset(this.current))

    let saved = null
    try {
      saved = await this.storage.load()
    } catch (e) { /* 读取失败保持默认 */ }
    if (!saved) return

    if (saved.key && saved.key !== this.current) await this._apply(getPreset(saved.key))
    // 注意：不再于启动时恢复 saved.primary —— 运行时选色现为 /theme 页的临时演示
    // （不持久化、离开即重置），系统默认外观恒为方案主色（Mintlify 深薄荷）。
    // changePrimary 的持久化能力保留，供将来「登录用户主题存库」场景启用。
  }

  // 当前方案 key（'default' / 'deepRed'）。按主题写分支逻辑（如 <img> 换图）用它判断，
  // 不要拿 getPrimary 的颜色反推主题。
  getKey() {
    return this.current
  }

  // 当前生效的主题色：用户自定义色 → 否则当前方案主色
  getPrimary() {
    return this.primary
  }

  // ── 内部：纯"落到页面"，不碰存储 ────────────────────────────────

  // 应用整套方案：组件全套换色 + 标记类 + 全量 cssVars + 状态
  async _apply(preset) {
    await client.changer.changeColor({ newColors: getThemeSerials(preset.modifyVars['@primary-color']) }, Promise)
    const root = document.documentElement
    Array.from(root.classList)
      .filter(name => name.indexOf('theme-') === 0)
      .forEach(name => root.classList.remove(name))
    root.classList.add('theme-' + preset.key)
    Object.keys(preset.cssVars).forEach(name => root.style.setProperty(name, preset.cssVars[name]))
    this.current = preset.key
    this.primary = preset.modifyVars['@primary-color']
    return preset
  }

  // 只应用主题色
  async _applyPrimary(color) {
    await client.changer.changeColor({ newColors: getThemeSerials(color) }, Promise)
    document.documentElement.style.setProperty('--primary-color', color)
    this.primary = color
  }
}

// 单例：全局唯一入口
export default new ThemeManager()
