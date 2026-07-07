// 主题管理：把主题方案落到页面上（<html> 标记类 + 自定义 CSS 变量），并记忆用户偏好。
//   · usePreset(key)     —— 运行时切换整套方案（标记类 + cssVars；antd 部分屏蔽中）
//   · changePrimary(hex) —— 只改主题色不切方案（用户手动选色）
//   · 持久化走可替换的存储层（默认 localStorage，将来存库时 setStorage 换实现即可）
//
// antd 组件换肤（webpack-theme-color-replacer 运行时色值替换）暂时屏蔽。
// 恢复方法（详见 docs/主题换肤方案说明.md）：
//   1. vue.config.js 放开 ThemeColorReplacer 插件的注释
//   2. 本文件放开下面两行 import，把 _apply/_applyPrimary 改为 async，
//      放开其中的 changeColor 调用并在调用处 await
// import client from 'webpack-theme-color-replacer/client'
// import { getAntdSerials } from './colorSeries'

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
    const preset = this._apply(getPreset(key))
    try {
      await this.storage.save({ key: preset.key, primary: null })
    } catch (e) { /* 存储失败不阻塞换肤 */ }
    return preset
  }

  // 只改主题色（不切方案），并持久化
  async changePrimary(color) {
    this._applyPrimary(color)
    try {
      await this.storage.save({ primary: color })
    } catch (e) { /* 存储失败不阻塞换肤 */ }
    return color
  }

  // 应用初始主题：编译期方案打底 → 叠加存储的方案 → 叠加存储的自定义主色
  async init() {
    this._apply(getPreset(this.current))

    let saved = null
    try {
      saved = await this.storage.load()
    } catch (e) { /* 读取失败保持默认 */ }
    if (!saved) return

    if (saved.key && saved.key !== this.current) this._apply(getPreset(saved.key))
    if (saved.primary) this._applyPrimary(saved.primary)
  }

  // 当前方案 key（'default' / 'ocean' ...）。按主题写分支逻辑（如 <img> 换图）用它判断，
  // 不要拿 getPrimary 的颜色反推主题。
  getKey() {
    return this.current
  }

  // 当前生效的主题色：用户自定义色 → 否则当前方案主色
  getPrimary() {
    return this.primary
  }

  // ── 内部：纯"落到页面"，不碰存储 ────────────────────────────────

  // 应用整套方案：标记类 + 全量 cssVars + 状态
  _apply(preset) {
    // antd 全套换色（暂时屏蔽）：
    // await client.changer.changeColor({ newColors: getAntdSerials(preset.modifyVars['@primary-color']) }, Promise)
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
  _applyPrimary(color) {
    // antd 全套换色（暂时屏蔽）：
    // await client.changer.changeColor({ newColors: getAntdSerials(color) }, Promise)
    document.documentElement.style.setProperty('--primary-color', color)
    this.primary = color
  }
}

// 单例：全局唯一入口
export default new ThemeManager()
