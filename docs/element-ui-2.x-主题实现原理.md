# Element UI 2.5.12 的主题实现原理

> 适用于 Element UI 2.x 全系（2.5.12 属于 2019 年初的版本），文末附与本项目 antd v1 方案的对比。

## 一、核心机制：SCSS 变量 + `!default` + 独立主题包

Element UI 2.x 的主题**完全是编译期方案**，没有用到 CSS 变量（CSS 变量是 Element Plus 才引入的）。

### 1. 样式源码单独一个包：theme-chalk

- 组件逻辑在 `element-ui/packages/<组件名>/` 下，**不含任何样式**。
- 全部样式集中在 `packages/theme-chalk/`（"粉笔"主题），源码是 SCSS，发布时也单独发一个 npm 包 `element-theme-chalk`。
- 用 gulp（gulp-sass + gulp-cssmin）把 `src/*.scss` 编译成 `lib/theme-chalk/*.css`，也就是我们平时引的 `element-ui/lib/theme-chalk/index.css`。

这个"样式与逻辑分离 + 主题独立成包"的设计，目的就是让主题可以整体替换——理论上你可以写一个自己的 `theme-xxx` 包完全换掉 chalk。

### 2. 变量全部集中在 var.scss，且都带 `!default`

`packages/theme-chalk/src/common/var.scss` 定义了全部设计变量，2.x 的变量名有个特殊的 `$--` 前缀：

```scss
$--color-primary: #409EFF !default;
$--color-success: #67C23A !default;
$--color-danger:  #F56C6C !default;
$--border-radius-base: 4px !default;
$--font-path: 'fonts' !default;
// ……共几百个
```

关键是 **`!default`**：SCSS 里它表示"若该变量已被赋值，则跳过本次赋值"。所以定制主题的标准姿势是——**先声明自己的变量，再 import 官方源码**，官方的默认值就全部让位了：

```scss
/* element-variables.scss */
$--color-primary: teal;

/* 必须设：icon 字体的相对路径，不然编译后找不到字体文件 */
$--font-path: '~element-ui/lib/theme-chalk/fonts';

@import "~element-ui/packages/theme-chalk/src/index";
```

然后在入口里 `import './element-variables.scss'` 替代原来的 `index.css` 即可。这要求项目里装了 sass-loader（且 2.x 时代对 node-sass/dart-sass 版本有讲究）。

### 3. 衍生色：不是手写的，是 mix() 算出来的

主题色只有一个 `$--color-primary`，但按钮 hover、浅色背景等一系列"淡化色"是编译期用 `mix()` 混白算的：

```scss
$--color-primary-light-1: mix($--color-white, $--color-primary, 10%) !default; // 53a8ff
$--color-primary-light-2: mix($--color-white, $--color-primary, 20%) !default;
// ……一直到 light-9（就是 #ecf5ff 那种极浅背景）
```

所以改一个主色，整套 hover/disabled/浅背景色阶会自动跟着变。这一点后面讲"运行时换肤"时很重要。

### 4. BEM 由 mixin 生成

选择器不是手写的，`src/mixins/mixins.scss` 提供 `b / e / m / when` 四个 mixin：

```scss
@include b(button) {        // 生成 .el-button
  @include m(primary) { … } // 生成 .el-button--primary
  @include when(disabled) { … } // 生成 .el-button.is-disabled
}
```

`$namespace: 'el'` 也是变量，理论上连组件前缀都能换。

## 二、官方提供的三种定制途径（2.5.12 当时）

| 途径 | 做法 | 适合场景 |
|---|---|---|
| 覆盖 SCSS 变量 | 上面的 element-variables.scss 写法 | 项目本身用 webpack + sass，**最常用** |
| element-theme CLI | `npm i element-theme element-theme-chalk -D`，`et --init` 生成变量文件，改完跑 `et`，产出一套编译好的 CSS 目录 | 项目不想引 sass 工具链，只要成品 CSS |
| 官网在线主题编辑器（Theme Roller） | 在 element.eleme.io 可视化改变量，下载编译好的主题 zip | 设计师/快速出活 |

三种本质相同：**都是重新跑一遍 SCSS 编译**，只是入口不同。

## 三、运行时动态换肤为什么这么"脏"

因为 2.x 没有 CSS 变量，浏览器里没有任何可运行时修改的"变量"存在——编译完就是写死的十六进制色值。所以 vue-element-admin 的 ThemePicker 那套经典做法是**字符串替换**：

1. `fetch` 拿到 `index.css` 的完整文本；
2. 用默认主色 `#409EFF` 及其全部衍生色（按上面 `mix()` 的公式，用 JS 重新实现 tint/shade 算出 light-1~9）做正则替换，换成新主色对应的色阶；
3. 把替换后的 CSS 塞进一个 `<style>` 标签覆盖原样式。

能工作，但缺点明显：要下载整份 CSS、首次切换有闪烁、只能换"色"不能换圆角字号等其他变量。这是机制（编译期 SCSS）决定的，不是实现偷懒。

## 四、和本项目 antd v1 方案的对比

| | Element UI 2.x | Ant Design Vue 1.x（本项目） |
|---|---|---|
| 预处理器 | SCSS | Less |
| 覆盖机制 | `!default`（先定义自己的，再 import 源码） | `modifyVars` / `@import` 后再赋值（Less 变量懒求值，**后定义的赢**） |
| 变量前缀 | `$--color-primary` | `@primary-color` |
| 衍生色 | 编译期 `mix()` | 编译期 `colorPalette()`（less 插件函数） |
| 运行时换肤 | 无原生支持，靠 CSS 文本替换 | 同样无原生支持（antd-theme-generator 等也是类似思路） |

两家在 2.x/1.x 时代思路完全同构：**设计变量 → 预处理器编译期展开 → 运行时不可变**。真正的运行时换肤都要等到下一代（Element Plus / antd v5 的 CSS 变量与 CSS-in-JS）。本项目 presets.js 的多方案 modifyVars + 自定义 CSS 变量层，实际上就是在 v1 上手工补出"运行时可变"的那一层。
