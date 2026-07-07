# antd v1 + Element UI 2.x 统一主题编译方案

> 针对本项目现状（vue-cli 4 + less-loader modifyVars + src/theme/presets.js 唯一主题源，
> VUE_APP_THEME 编译期选方案）设计。**2026-07-06 已实施并验证**：
> default（丹红 #f5222d）与 ocean（拂晓蓝 #1890ff）两方案构建，antd 与 element 主色均同步切换，
> element 默认蓝 #409eff 零残留，93 个单测全部通过。
>
> 实施要点与方案的差异：
> - sass 固定装 **1.32.13**（最后一个不刷 `/` 除法弃用警告的版本），sass-loader@10
> - element 按组件注册（src/plugins/element-ui.js），**不整包 Vue.use(ElementUI)**——
>   否则其 $message/$confirm/$notify 会覆盖 ant-design-vue.js 挂在 Vue.prototype 上的同名方法
> - element 弹层服务（Message/MessageBox/Notification）未注册，需要时用别名挂载（如 $elMessage）

## 一、核心思路：一份主题源，喂两套预处理器

两个库没法直接共享变量——antd v1 是 **Less**（`@primary-color`），element 2.x 是 **SCSS**（`$--color-primary`），预处理器不同。但本项目的 presets.js 是 **JS 对象**，恰好是两边的公共上游：

```
                        ┌─→ modifyVars ──→ less-loader ──→ antd 样式
presets.js（唯一主题源）─┤
                        ├─→ elementVars ─→ sass-loader ──→ element 样式
                        │    （$--xx 变量字符串，additionalData 注入）
                        └─→ cssVars ─────→ ThemeManager ─→ 业务自定义元素（运行时）
```

改 `.env` 的 `VUE_APP_THEME` 重新编译，antd、element、业务 CSS 变量三者同时换色，永不脱节。

## 二、落地步骤

### 1. 装依赖

```bash
npm i element-ui@2.15.12
npm i -D sass sass-loader@10
```

sass-loader 必须选 **10**（vue-cli 4 支持的最高版本，对应配置项叫 `additionalData`；
装成 8 的话配置项叫 `prependData`，装 11+ 则 webpack4 不兼容）。

### 2. presets.js 加一个出口：antd 变量 → element 变量的映射

在 `getPreset()` 里派生（新增字段，不动现有结构）：

```js
// antd less 变量 → element scss 变量 的字符串，供 sass-loader additionalData 注入。
// 注入的定义先于源码里的 !default，因此官方默认值自动让位。
function toElementVars(modifyVars) {
  const map = {
    '@primary-color':      '$--color-primary',
    '@success-color':      '$--color-success',
    '@warning-color':      '$--color-warning',
    '@error-color':        '$--color-danger',
    '@font-size-base':     '$--font-size-base',
    '@border-radius-base': '$--border-radius-base',
    '@border-color-base':  '$--border-color-base'
  }
  return Object.keys(map)
    .filter(k => modifyVars[k])
    .map(k => `${map[k]}: ${modifyVars[k]};`)
    .join('\n')
}
// getPreset 返回值里加：elementVars: toElementVars(modifyVars)
```

### 3. vue.config.js 的 loaderOptions 加 scss 段

```js
css: {
  loaderOptions: {
    less: { modifyVars: theme.modifyVars, javascriptEnabled: true },
    scss: {
      // 注入到每个 .scss 文件顶部；本项目样式全是 less，
      // 实际只会作用于下面这一个 element 主题入口，无污染
      additionalData: theme.elementVars
    }
  }
}
```

### 4. 新建 `src/theme/element-theme.scss` 并在 main.js 引入

```scss
// element-ui 主题入口：变量由 vue.config.js 的 additionalData 注入（源自 presets.js），
// 这里只负责指定字体路径并引入 theme-chalk 源码
$--font-path: '~element-ui/lib/theme-chalk/fonts';
@import "~element-ui/packages/theme-chalk/src/index";
```

main.js 里**不要**再引 `element-ui/lib/theme-chalk/index.css`，改引这个 scss：

```js
import ElementUI from 'element-ui'
import '@/theme/element-theme.scss'
Vue.use(ElementUI)
```

字体不用手动拷——webpack 的 css-loader 认 `~` 前缀，会从 node_modules 解析并打进产物。

## 三、几个必然遇到的问题与答案

### 派生色算法不同，要紧吗？

不要紧。同一个主色进去，antd 用 less 的 `colorPalette()` 算 `@primary-1~9`，element 用 scss 的 `mix()` 算 `light-1~9`，**hover/浅背景的色阶会有细微差异**，但各自库内部是自洽的，肉眼基本无感。若要求严格一致，只能手动把 element 的 `$--color-primary-light-1~9` 也写进映射表逐个指定。

### element scss 编译出的重复规则问题

theme-chalk 组件间互相 @import 会产生重复规则（详见 docs/自行编译element-theme-chalk.md）。
本项目 production 构建走 cssnano（optimize-css-assets-webpack-plugin），其中的
postcss-discard-duplicates 会自动去掉完全相同的重复规则，**不用额外处理**；dev 模式不压缩、体积大些，无所谓。

### 编译时的 DEPRECATION 警告

dart-sass 编译 theme-chalk 老代码会刷 `/` 除法弃用警告，无害。嫌吵可在 loaderOptions.scss 里加
`sassOptions: { quietDeps: true }`（对 `~` 引入的 node_modules 源码部分生效有限，能压掉多少算多少）。

### 运行时换肤呢？

element 2.x 和 antd v1 一样没有运行时变量。当前项目的编译期方案（VUE_APP_THEME）对两个库天然一致。
若将来恢复 webpack-theme-color-replacer：该插件是"按颜色值抽取 CSS 规则"的，与库无关——把
element 的主色系（按 mix 白色 10%~90% 算出 light-1~9，逻辑加进 colorSeries.js 即可）追加到
matchColors，就能把 element 一并纳入运行时换色，机制与 antd 完全共用。

## 四、如果不想把 element 编译并进 webpack

备选：沿用 `F:\element-theme-build` 外部编译，但把它的 my-theme.scss 改成由脚本从本项目
presets.js 生成（`node -e` 读 getPreset → 写 scss → 跑 sass）。产物拷进 public/ 用 link 引入。
缺点：多一道手工步骤、字体要自己拷、容易忘记同步——**除非项目坚决不引 sass 工具链，否则不推荐**。
