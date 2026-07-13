# Mintlify 设计系统重构

> 依据根目录 `DESIGN.md`（Mintlify 设计语言分析）对整个前端进行的一次视觉重构。
> 本文是该设计层的**权威出处**；改设计令牌或组件覆盖规则请同步本文。
> 与运行时换肤方案的关系见文末「与换肤引擎的共存」。

## 目标风格

Mintlify 语汇：Inter 正文 + Geist Mono 代码；**黑色药丸主按钮统治**、薄荷绿
`#00d4a4` 仅作强调/激活**点缀**；扁平、密集、克制圆角的文档级界面；输入框聚焦
用薄荷绿作激活信号。

## 分层结构

重构不改业务逻辑，只新增两层样式 + 调整外壳/页面模板，**不侵入换肤引擎**。

| 层 | 文件 | 职责 |
|---|---|---|
| 设计令牌 | `src/theme/design-tokens.css` | `@font-face`（本地 woff2）+ `:root` 全部 `--m-*` 变量（颜色/字体/间距/圆角/阴影/排版尺度） |
| 组件覆盖 | `src/theme/mintlify.css` | 全局基础排版 + antd/element 组件 Mintlify 化；排版工具类（`.m-*`） |
| 外壳 | `src/App.vue` | 白色粘性顶栏 + 墨色 logo + 下划线激活导航 + 黑药丸 CTA + 页脚 region |
| 页面 | `src/views/*.vue` | Home 英雄区 + 卡片；其余页面消费令牌、继承覆盖层 |

两层样式在 `src/main.js` 中于**组件库样式之后**引入（令牌层在前、覆盖层在后），
确保能压过 antd/element 默认样式：

```js
import './plugins/ant-design-vue'
import './plugins/element-ui'
import './theme/design-tokens.css'
import './theme/mintlify.css'
```

## 字体（本地打包，离线可用）

Inter 与 Geist Mono 均为**可变字体**（单文件覆盖 100–900 字重），从 Google Fonts
取 woff2 落到 `src/assets/fonts/`，各含 latin + latin-ext 两个子集，共 4 个文件
（约 170KB）。`@font-face` 用 `unicode-range` 分流子集，`font-display: swap`。
**中文字形不在拉丁字体内**，会自然回退到系统中文字体（PingFang / 微软雅黑）——
符合 Mintlify 的拉丁设计定位。

| 文件 | 用途 |
|---|---|
| `inter-latin.woff2` / `inter-latin-ext.woff2` | UI 正文、标题、导航、按钮标签 |
| `geistmono-latin.woff2` / `geistmono-latin-ext.woff2` | 代码块、JSON 预览、类型/版本号等等宽场景 |

换字体只需替换这 4 个文件并保持文件名，或改 `design-tokens.css` 的 `@font-face`。

## 令牌速览（`--m-*`）

- **品牌/强调**：`--m-primary`(#0a0a0a 黑) · `--m-mint`(#00d4a4) · `--m-mint-deep` ·
  `--m-error`(#d45656) · `--m-tag`(#3772cf) · `--m-orange`(#f55a3c)
- **表面/线**：`--m-canvas`(#fff) · `--m-surface`(#f7f7f7) · `--m-surface-soft`(#fafafa) ·
  `--m-surface-code`(#1c1c1e 深色代码底) · `--m-hairline`(#e5e5e5)
- **文字**：`--m-ink` → `--m-charcoal` → `--m-slate` → `--m-steel` → `--m-stone` → `--m-muted`
- **圆角**：`--m-r-xs`4 / `-sm`6 / `-md`8 / `-lg`12 / `-xl`16 / `-xxl`24 / `-full`9999
- **间距**：`--m-sp-xxs`4 … `--m-sp-hero`120（4px 基元）
- **阴影**：`--m-shadow-1/2/3` + `--m-shadow-mint`
- **排版尺度**：`--m-fs-hero`72 … `--m-fs-micro-up`11 及对应 line-height / letter-spacing

排版工具类：`.m-hero-display` `.m-display` `.m-h1~3` `.m-subtitle` `.m-caption`
`.m-micro-up` `.m-mono`；按钮强调工具类 `.m-btn-accent`（薄荷绿药丸）。

## 组件覆盖要点

- **按钮全部药丸化**（`--m-r-full`）：`.ant-btn-primary` / `.el-button--primary` = 黑药丸；
  危险 = 错误红药丸；链接按钮 = 墨色无边框；`.m-btn-accent` = 薄荷绿强调 CTA。
  - ⚠️ **变体需排除，勿一刀切**：antd 幽灵按钮（`.ant-btn-background-ghost`）保留原生
    「透明底 + 主色描边」——primary/danger 的实心填充规则均用 `:not(.ant-btn-background-ghost)`
    排除；`.ant-btn` 的形状与表面拆成两条（形状给全部，表面 `background/border/color` 只给非幽灵）。
    element 文字按钮（`.el-button--text`）单独恢复 `border-color: transparent`，否则 generic
    `.el-button` 的发丝线边框会给无边框文字按钮加上可见方框。
- **输入/选择聚焦** = 薄荷绿边框 + 淡薄荷环（替换 antd 默认蓝焦点）。
- **卡片扁平** + 发丝线边框、无阴影；hover 才给 `--m-shadow-2`。
- **标签徽标化**：`.ant-tag` / `.el-tag` 圆角 pill。
- **表格/Tabs/分页/Modal/消息/Tooltip** 等按令牌统一圆角、分隔线、字号。

### ⚠️ `#app` 作用域约定（关键）

凡是可能与**运行时换肤引擎**（webpack-theme-color-replacer 在 `<head>` 尾部追加的
纯 class 选择器）冲突的**颜色**规则，一律用 `#app` 前缀抬高优先级（id > class），
稳压过引擎——这样主按钮的 Mintlify 黑不会被引擎的主色覆盖，二者互不打架。
形状/排版/间距类规则不涉及冲突，用常规选择器即可。

## 与换肤引擎的共存（默认薄荷 + /theme 隔离）

换肤引擎（`ThemeManager` / `presets.js` / `themeColorReplacer.js` / `colorSeries.js`）
**完全保留**，但默认强调色与作用范围按 Mintlify 需求重新编排：

**1. 系统默认强调色 = 深薄荷 `#00b48a`**
`presets.js` 新增 `mintlify` 方案并经 `.env` 的 `VUE_APP_THEME=mintlify` 设为默认。
于是**全站** antd/element 的主色（链接、开关/复选/单选选中、标签页下划线、选中日期、
分页当前页、element 表格高亮、`var(--primary-color)` 自定义元素…）默认即薄荷，与
Mintlify 协调。**主按钮**由 `#app` 覆盖恒为黑药丸；功能色（成功/警告/危险/信息）保持不变。
选深薄荷而非亮薄荷 `#00d4a4`：antd 有「主色底 + 白字」场景（选中日期格等），深薄荷白字对比更足。

**2. /theme 是换色演示沙盒，选色隔离在该页内**
- `ThemePicker` 选色调 `ThemeManager.preview(color)` —— 只落页面、**不持久化**。
- 路由守卫（`router/index.js` 的 `afterEach`）在**离开 /theme** 时调 `ThemeManager.reset()`，
  把主色全局重置回默认薄荷。→ **/theme 内组件实时跟随选色演示；Home/About/UEditor
  永远是 Mintlify 薄荷**，不被演示选色污染。
- `ThemeManager.init()` 启动时**不再恢复** `saved.primary`（运行时选色现为演示态）；
  `changePrimary()`（持久化版）保留，供将来「登录用户主题存库」启用。
- 外壳导航/页脚用固定 `--m-*` 令牌、不吃主色，故即便在 /theme 选了别的色，顶栏仍稳如 Mintlify。

即 **Mintlify 决定「形状 / 字体 / 中性面 / 主 CTA / 默认薄荷强调」，/theme 沙盒演示「换色能力」**。
换肤引擎本身的机制/踩坑权威文档仍是 `docs/主题换肤方案说明.md`。

> 注：标签页、分页当前页等**只出现在 /theme** 的组件，覆盖层**故意不钉墨色**，
> 让其跟随主色（默认薄荷、演示时跟随）——钉死会破坏演示且对其他页零收益。

## 验证

- `npm run build`：通过；4 个 woff2 正确打包进 `dist/static/fonts/` 并被 app.css 引用；
  引擎产物 `theme-colors.css` 照常生成。
- `npm test`：104 项全过，无回归。
- Playwright 实测 Home / `/theme`：顶栏、英雄区、卡片、深色代码块、两库按钮黑药丸、
  引擎组件跟随主色，均符合预期。

## 维护指引

1. 改颜色/圆角/间距/字体 → 只改 `design-tokens.css`。
2. 改某组件观感 → 改 `mintlify.css`；涉及颜色且会与引擎冲突的，务必保留 `#app` 前缀。
3. 新增页面 → 直接消费 `--m-*` 令牌与 `.m-*` 工具类，卡片/按钮自动继承覆盖层。
4. 导航用编程式跳转（`$router.push`）而非 `<router-link>`——本环境 router-link 渲染
   异常（渲染成裸文本），沿用 App.vue 的 `go(path)` 写法。
5. **布局为流式 100%**：外壳（nav/content/footer）与各页面均不设 `max-width`，铺满窗口 +
   32px 左右留白（`.app-content`）。这是应需求覆盖了 DESIGN.md 的 1280px 居中规范。
   - ⚠️ **流式铺满 + 经典滚动条 = 整体左偏**：Windows Chrome 用经典（非覆盖式）竖向滚动条（~17px），
     只从右侧挤占视口，使右留白宽于左留白 → 系统整体视觉左偏、「不居中」。App.vue 全局加
     `html { scrollbar-gutter: stable both-edges }` 两侧对称预留滚动条槽，保持真正居中；
     Mac 覆盖式滚动条本无此问题，故只在 Chrome/Windows 复现，Playwright 无头（覆盖式）也测不出。
6. 改默认强调色 → 改 `presets.js` 的 `mintlify` 方案主色并跑 `npm test`（collision 把关）；
   `/theme` 的演示色板在 `ThemePicker.vue` 的 `presets` 数组。
