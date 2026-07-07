# ant-design-vue 1.7.8 默认主题变量清单

> 来源：`node_modules/ant-design-vue/lib/style/themes/default.less`（antd 3 血统）。
>
> 注意：这些是 **less 变量**，不是浏览器里的 CSS 自定义属性（`--xxx`）——它们只在**编译期**存在，
> 编译后全部变成死值（详见《编译期主题方案》）。本项目覆盖方式：改 `src/theme/presets.js`
> 的 `baseVars`（全方案公用）或各方案的 `modifyVars`（方案差异）。
> **变量名写错不会报错、只会静默无效**，改完务必肉眼验证。

## 0. 常用速查（本项目最可能用到的）

| 变量　　　　　　　　　　　　　　　　 | 默认值 | 说明 |
| --- | --- | --- |
| `@primary-color` | `@blue-6`（#1890ff） | 全局主色，本项目各方案已覆盖 |
| `@link-color` | `@primary-color` | 链接色 |
| `@success-color` | `@green-6`（#52c41a） | 成功色 |
| `@warning-color` | `@gold-6`（#faad14） | 警告色 |
| `@error-color` | `@red-6`（#f5222d） | 错误色 |
| `@font-size-base` | `14px` | 基础字号 |
| `@heading-color` | `rgba(0,0,0,.85)` | 标题色 |
| `@text-color` | `rgba(0,0,0,.65)` | 正文色 |
| `@text-color-secondary` | `rgba(0,0,0,.45)` | 次要文字 |
| `@disabled-color` | `rgba(0,0,0,.25)` | 禁用态文字 |
| `@border-radius-base` | `4px` | 基础圆角 |
| `@border-color-base` | `hsv(0,0,85%)`（#d9d9d9） | 边框色 |
| `@box-shadow-base` | `0 2px 8px rgba(0,0,0,.15)` | 浮层阴影 |
| `@layout-header-background` | `#001529` | Layout 头部/侧栏深色背景 |
| `@table-header-bg` | `@background-color-light`（#fafafa） | 表头背景 |
| `@menu-dark-item-active-bg` | `@primary-color` | ⚠️ dark 菜单选中项背景=主色，主色改深色系时注意对比度（App.vue 已做文字覆盖） |

## 1. 全局颜色

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `@primary-color` | `@blue-6` | 主色 |
| `@info-color` | `@blue-6` | 信息色 |
| `@success-color` | `@green-6` | 成功色 |
| `@processing-color` | `@blue-6` | 进行中（Progress/Badge processing） |
| `@error-color` | `@red-6` | 错误色 |
| `@highlight-color` | `@red-6` | 高亮色（必填星号等） |
| `@warning-color` | `@gold-6` | 警告色 |
| `@normal-color` | `#d9d9d9` | 中性色 |
| `@white` / `@black` | `#fff` / `#000` | 基础黑白 |

引用的官方色板主色（来自 `../color/colors`，每种色另有 `-1`~`-10` 十档色阶可用）：
`@blue-6 #1890ff`、`@red-6 #f5222d`、`@green-6 #52c41a`、`@gold-6 #faad14`、`@yellow-6 #fadb14`、
`@orange-6 #fa8c16`、`@volcano-6 #fa541c`、`@purple-6 #722ed1`、`@geekblue-6 #2f54eb`、
`@cyan-6 #13c2c2`、`@magenta-6 #eb2f96`、`@lime-6 #a0d911`。

## 2. 主色色阶（自动派生，一般不手动覆盖）

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `@primary-1` | `colorPalette(@primary-color, 1)` | hover/active 背景、Alert info 背景 |
| `@primary-2` | `colorPalette(@primary-color, 2)` | Tree 选中背景等 |
| `@primary-3` ~ `@primary-4` | 同上算法 3/4 档 | Slider 轨道等 |
| `@primary-5` | 5 档 | 大量 hover/active 文字色、输入框 hover 边框 |
| `@primary-6` | `@primary-color` | 即主色本身（别用它，用 `@primary-color`） |
| `@primary-7` | 7 档 | active 加深色 |
| `@primary-8` ~ `@primary-10` | 8/9/10 档 | 预留，默认未使用 |

## 3. 基础脚手架

### 背景 / 字体

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `@body-background` | `#fff` | `<body>` 背景 |
| `@component-background` | `#fff` | 组件基础背景 |
| `@font-family` | 系统字体栈（-apple-system…Microsoft YaHei…） | 全局字体 |
| `@code-family` | SFMono-Regular, Consolas… | 代码字体 |
| `@font-variant-base` / `@font-feature-settings-base` | `tabular-nums` / `'tnum'` | 等宽数字 |

### 文字颜色

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `@text-color` | `fade(@black, 65%)` | 正文 |
| `@text-color-secondary` | `fade(@black, 45%)` | 次要文字 |
| `@text-color-inverse` | `@white` | 反色文字 |
| `@heading-color` | `fade(#000, 85%)` | 标题 |
| `@text-color-dark` / `@text-color-secondary-dark` / `@heading-color-dark` | `fade(@white, 85%/65%/100%)` | 深色背景上的文字 |
| `@icon-color` / `@icon-color-hover` | `inherit` / `fade(@black, 75%)` | 图标 |
| `@text-selection-bg` | `@primary-color` | 选中文本背景 |

### 字号 / 行高 / 圆角

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `@font-size-base` / `@font-size-lg` / `@font-size-sm` | `14px` / `+2px` / `12px` | 字号三档 |
| `@heading-1-size` ~ `@heading-4-size` | base×2.71 / 2.14 / 1.71 / 1.42（向上取整） | h1~h4 |
| `@line-height-base` | `1.5` | 行高 |
| `@border-radius-base` / `@border-radius-sm` | `4px` / `2px` | 圆角 |

### 间距 / 控件通用

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `@padding-lg` / `-md` / `-sm` / `-xs` | `24/16/12/8px` | 容器→小间距四档 |
| `@control-padding-horizontal` / `-sm` | `@padding-sm` / `@padding-xs` | 表单控件水平内边距 |
| `@item-active-bg` / `@item-hover-bg` | `@primary-1` | 列表项/单元格 active、hover 背景 |

## 4. 链接 / 边框 / 背景 / 禁用 / 阴影

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `@link-color` | `@primary-color` | 链接 |
| `@link-hover-color` / `@link-active-color` | 色阶 5 / 7 档 | 链接 hover/active |
| `@link-decoration` / `@link-hover-decoration` | `none` / `none` | 下划线 |
| `@border-color-base` | `hsv(0,0,85%)` #d9d9d9 | 组件外边框 |
| `@border-color-split` | `hsv(0,0,91%)` #e8e8e8 | 组件内分割线 |
| `@border-color-inverse` | `@white` | 反色边框 |
| `@border-width-base` / `@border-style-base` | `1px` / `solid` | 边框宽度/线型 |
| `@outline-width` / `@outline-blur-size` / `@outline-color` | `2px` / `0` / `@primary-color` | 聚焦光晕 |
| `@background-color-light` | `hsv(0,0,98%)` #fafafa | 表头/选中项背景 |
| `@background-color-base` | `hsv(0,0,96%)` #f5f5f5 | 默认灰背景 |
| `@disabled-color` / `@disabled-bg` | `fade(#000,25%)` / `@background-color-base` | 禁用态 |
| `@disabled-color-dark` | `fade(#fff,35%)` | 深色下禁用文字 |
| `@shadow-color` | `rgba(0,0,0,.15)` | 阴影基色 |
| `@box-shadow-base` | `@shadow-1-down` | 默认浮层阴影 |
| `@shadow-1-up/down/left/right` | `0 ±2px 8px @shadow-color` 各方向 | 四方向阴影 |
| `@shadow-2` | `0 4px 12px @shadow-color` | 较大阴影 |

## 5. 动画

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `@ease-base-out/in`、`@ease-out/in/in-out`、`@ease-*-back/circ/quint` | 各 cubic-bezier | 缓动曲线全家桶 |
| `@animation-duration-slow` | `0.3s` | Modal 等 |
| `@animation-duration-base` | `0.2s` | 常规 |
| `@animation-duration-fast` | `0.1s` | Tooltip 等 |
| `@wave-animation-width` | `6px` | 点击波纹扩散宽度 |

## 6. 响应式断点 / 栅格

| 变量 | 默认值 |
| --- | --- |
| `@screen-xs / sm / md / lg / xl / xxl` | `480 / 576 / 768 / 992 / 1200 / 1600px`（各有 `-min`，`-max` = 下一档 -1px） |
| `@grid-columns` | `24` |
| `@grid-gutter-width` | `0` |

## 7. Layout / z-index

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `@layout-body-background` | `#f0f2f5` | 内容区背景 |
| `@layout-header-background` / `@layout-sider-background` | `#001529` | 头部/侧栏 |
| `@layout-footer-background` | `@layout-body-background` | 页脚 |
| `@layout-header-height` / `@layout-header-padding` | `64px` / `0 50px` | 头部尺寸 |
| `@layout-footer-padding` | `24px 50px` | 页脚内边距 |
| `@layout-trigger-height` / `-background` / `-color` | `48px` / `#002140` / `#fff` | 侧栏折叠触发器 |
| `@layout-zero-trigger-width/height` | `36/42px` | 零宽触发器 |
| `@layout-sider-background-light` 等 `-light` 系 | `#fff` / `@text-color` | light 主题侧栏 |

z-index（由低到高）：`badge/table-fixed=1`，`affix/back-top/picker-panel/popup-close=10`，
`modal/modal-mask=1000`，`message/notification=1010`，`popover=1030`，`dropdown/picker=1050`，`tooltip=1060`。

## 8. 组件级变量

### Button

| 变量 | 默认值 |
| --- | --- |
| `@btn-font-weight` | `400` |
| `@btn-border-radius-base` / `-sm`、`@btn-border-width` / `-style` | 跟随全局 |
| `@btn-shadow` / `@btn-primary-shadow` / `@btn-text-shadow` | 细微投影三件套 |
| `@btn-primary-color` / `@btn-primary-bg` | `#fff` / `@primary-color` |
| `@btn-default-color` / `-bg` / `-border` | `@text-color` / `@component-background` / `@border-color-base` |
| `@btn-danger-color` / `-bg` / `-border` | `#fff` / error 色阶 5 档 ×2 |
| `@btn-disable-color` / `-bg` / `-border` | 跟随禁用态 |
| `@btn-height-base` / `-lg` / `-sm` | `32 / 40 / 24px` |
| `@btn-padding-base` / `-lg` / `-sm`、`@btn-font-size-lg` / `-sm` | 跟随间距/字号 |
| `@btn-circle-size*` / `@btn-square-size*` | = 同档高度 |
| `@btn-group-border` | `@primary-5` |

### 表单类（Form / Input / InputNumber / Select / Checkbox / Radio / Switch / Slider）

| 变量 | 默认值 |
| --- | --- |
| `@label-color` / `@label-required-color` | `@heading-color` / `@highlight-color` |
| `@form-item-margin-bottom` | `24px` |
| `@form-item-trailing-colon` | `true`（label 冒号） |
| `@form-vertical-label-padding` / `-margin` | `0 0 8px` / `0` |
| `@form-error-input-bg` / `@form-warning-input-bg` | `@input-bg` |
| `@input-height-base` / `-lg` / `-sm` | `32 / 40 / 24px` |
| `@input-color` / `@input-bg` / `@input-border-color` | `@text-color` / 组件背景 / `@border-color-base` |
| `@input-placeholder-color` | `hsv(0,0,75%)` #bfbfbf |
| `@input-hover-border-color` | `@primary-5` |
| `@input-disabled-bg` | `@disabled-bg` |
| `@input-padding-vertical-base/-sm/-lg`、`@input-padding-horizontal*` | `4/1/6px`、跟随控件内边距 |
| `@input-addon-bg` | `@background-color-light` |
| `@input-number-handler-*`（bg/hover-bg/active-bg/border） | 跟随组件背景/`@primary-5`/`#f4f4f4` |
| `@select-border-color` / `@select-dropdown-bg` / `@select-background` | 跟随全局 |
| `@select-item-selected-color` / `-font-weight` / `-bg` | `@text-color` / `600` / `#fafafa` |
| `@select-item-active-bg` | `@item-active-bg` |
| `@checkbox-size` / `@checkbox-color` / `@checkbox-check-color` | `16px` / `@primary-color` / `#fff` |
| `@radio-size` / `@radio-dot-color` | `16px` / `@primary-color` |
| `@radio-button-bg` / `-checked-bg` / `-color` / `-hover-color` / `-active-color` | 默认按钮系 / `@primary-5` / `@primary-7` |
| `@switch-height` / `@switch-sm-height` | `22 / 16px` |
| `@switch-color` | `@primary-color` |
| `@switch-disabled-opacity` | `0.4` |
| `@slider-rail-background-color`（及 hover） | `@background-color-base` / `#e1e1e1` |
| `@slider-track-background-color`（及 hover） | `@primary-3` / `@primary-4` |
| `@slider-handle-color`（hover/focus/tooltip-open 各档） | `@primary-3/4`、`tint(主色,20%)` 等 |
| `@slider-dot-border-color`（及 active） | 分割线色 / `tint(主色,50%)` |
| `@slider-disabled-color` / `-background-color` | 禁用色 / 组件背景 |

### 导航类（Menu / Tabs / Breadcrumb / Dropdown / Pagination / PageHeader / Anchor）

| 变量 | 默认值 |
| --- | --- |
| `@menu-item-height` / `@menu-inline-toplevel-item-height` | `40px` |
| `@menu-collapsed-width` | `80px` |
| `@menu-bg` / `@menu-popup-bg` | `@component-background` |
| `@menu-item-color` / `@menu-highlight-color` | `@text-color` / `@primary-color` |
| `@menu-item-active-bg` / `-active-border-width` | `@item-active-bg` / `3px` |
| `@menu-icon-size` / `-lg`、`@menu-item-font-size` | 跟随字号 |
| `@menu-dark-bg` / `@menu-dark-submenu-bg` | `@layout-header-background` / `#000c17` |
| `@menu-dark-color` / `@menu-dark-highlight-color` | 深色次要文字 / `#fff` |
| `@menu-dark-item-active-bg` | `@primary-color` ⚠️ 主色即选中背景 |
| `@menu-dark-selected-item-icon-color` / `-text-color` | `@white` |
| `@tabs-highlight-color` / `@tabs-active-color` / `@tabs-hover-color` | `@primary-color` / `@primary-7` / `@primary-5` |
| `@tabs-ink-bar-color` / `@tabs-card-active-color` | `@primary-color` |
| `@tabs-card-height` / `-head-background` / `-gutter` | `40px` / `#fafafa` / `2px` |
| `@tabs-bar-margin` / 各方向 padding/margin | 见源码（横向 `12px 16px` 等） |
| `@breadcrumb-base-color` / `-last-item-color` | 次要文字 / `@text-color` |
| `@breadcrumb-link-color`（及 hover） | 次要文字 / `@primary-5` |
| `@breadcrumb-separator-color` / `-margin` | 次要文字 / `0 8px` |
| `@dropdown-selected-color` | `@primary-color` |
| `@dropdown-vertical-padding` / `-font-size` / `-line-height` | `5px` / 基础字号 / `22px` |
| `@pagination-item-size` / `-sm` | `32 / 24px` |
| `@pagination-item-bg-active` / `-font-weight-active` | 组件背景 / `500` |
| `@page-header-padding`（及 vertical / breadcrumb） | `24 / 16 / 12px` |
| `@anchor-border-color` | `@border-color-split` |

### 数据展示（Table / Tag / Badge / Card / List / Tree / Collapse / Avatar / Statistic / Timeline / Carousel / Rate / Comment / Descriptions / Empty / Typography）

| 变量 | 默认值 |
| --- | --- |
| `@table-header-bg` / `-color` / `-sort-bg` | `#fafafa` / `@heading-color` / `@background-color-base` |
| `@table-row-hover-bg` | `@primary-1` |
| `@table-selected-row-bg`（及 hover / sort） | `#fafafa` |
| `@table-expanded-row-bg` | `#fbfbfb` |
| `@table-padding-vertical` / `-horizontal` | `16px` |
| `@table-footer-bg` / `-color` | 同表头 |
| `@tag-default-bg` / `-color` / `@tag-font-size` | `#fafafa` / `@text-color` / `12px` |
| `@badge-height` / `-dot-size` / `-status-size` | `20 / 6 / 6px` |
| `@badge-font-size` / `-font-weight` / `-text-color` | `12px` / `normal` / 组件背景 |
| `@card-head-color` / `-background` | `@heading-color` / `transparent` |
| `@card-padding-base` / `-head-padding` / `-inner-head-padding` | `24 / 16 / 12px` |
| `@card-shadow` | `0 2px 8px rgba(0,0,0,.09)` |
| `@card-actions-background` / `@card-radius` / `@card-skeleton-bg` | `#fafafa` / `@border-radius-sm` / `#cfd8dc` |
| `@list-item-padding` / `@list-empty-text-padding` | `12px 0` / `16px` |
| `@list-header/footer-background` | `transparent` |
| `@tree-title-height` / `@tree-child-padding` | `24 / 18px` |
| `@tree-node-hover-bg` / `-selected-bg` | `@item-hover-bg` / `@primary-2` |
| `@tree-directory-selected-color` / `-bg` | `#fff` / `@primary-color` |
| `@collapse-header-bg` / `-padding` | `#fafafa` / `12px 16px` |
| `@collapse-content-bg` / `-padding`、`@collapse-panel-border-radius` | 组件背景 / `16px` / 基础圆角 |
| `@avatar-size-base` / `-lg` / `-sm` | `32 / 40 / 24px` |
| `@avatar-bg` / `-color` / `-border-radius` | `#ccc` / `#fff` / 基础圆角 |
| `@statistic-content-font-size` / `-unit-font-size` / `-title-font-size` | `24 / 16px` / 基础字号 |
| `@timeline-width` / `-color` / `-dot-color` / `-dot-bg` | `2px` / 分割线色 / `@primary-color` / 组件背景 |
| `@carousel-dot-width` / `-height` / `-active-width` | `16 / 3 / 24px` |
| `@rate-star-color` / `-bg` | `@yellow-6` / 分割线色 |
| `@comment-*`（padding/缩进/作者色/操作色等） | 见源码，均中性灰系 |
| `@descriptions-bg` | `#fafafa` |
| `@empty-font-size` | 基础字号 |
| `@typography-title-font-weight` / `-margin-top` / `-margin-bottom` | `600` / `1.2em` / `0.5em` |

### 反馈类（Modal / Message / Notification / Tooltip / Popover / Alert / Progress / Spin / Skeleton / Drawer）

| 变量 | 默认值 |
| --- | --- |
| `@modal-body-padding` | `24px` |
| `@modal-header-bg` / `@modal-footer-bg` | 组件背景 / `transparent` |
| `@modal-heading-color`、`@modal-*-border-color-split` | `@heading-color`、分割线色 |
| `@modal-mask-bg` | `fade(@black, 45%)` |
| `@message-notice-content-padding` | `10px 16px` |
| `@tooltip-bg` / `-color` / `-max-width` | `rgba(0,0,0,.75)` / `#fff` / `250px` |
| `@tooltip-arrow-width` / `-distance` | `5px` / 派生 |
| `@popover-bg` / `-color` / `-min-width` / `-arrow-width` | 组件背景 / `@text-color` / `177px` / `6px` |
| `@alert-{success,info,warning,error}-bg-color` | 对应功能色的 1 档 |
| `@alert-*-border-color` | 对应功能色的 3 档 |
| `@alert-*-icon-color` | 对应功能色本身 |
| `@progress-default-color` / `-remaining-color` | `@processing-color` / `@background-color-base` |
| `@progress-text-color` / `-radius` | `@text-color` / `100px` |
| `@spin-dot-size`（sm/base/lg） | `14 / 20 / 32px` |
| `@skeleton-color` | `#f2f2f2` |
| `@drawer-header-padding` / `-body-padding` | `16px 24px` / `24px` |

### 其他（Transfer / BackTop / TimePicker / Cascader / 前缀）

| 变量 | 默认值 |
| --- | --- |
| `@transfer-list-height` / `-header-height` / `-disabled-bg` | `200 / 40px` / 禁用背景 |
| `@back-top-color` / `-bg` / `-hover-bg` | `#fff` / 次要文字色 / `@text-color` |
| `@time-picker-panel-column-width` / `-panel-width` / `-selected-bg` | `56px` / ×3 / 灰背景 |
| `@cascader-dropdown-*` | 跟随 dropdown |
| `@ant-prefix` / `@iconfont-css-prefix` / `@html-selector` | `ant` / `anticon` / `html` |

---

## 使用提示

1. **只需覆盖"源头"变量**：绝大多数组件级变量都引用全局变量（如 `@table-row-hover-bg: @primary-1`），改 `@primary-color` 即可全链路联动；只有想让某组件"脱离全局"时才单独覆盖组件级变量。
2. **本项目入口**：`src/theme/presets.js` → 公共放 `baseVars`、方案差异放各方案 `modifyVars`；不要直接改 `vue.config.js`。
3. **改完必须重启** dev server（less 编译期生效）。
4. 想确认某个变量到底被哪些样式用到：在 `node_modules/ant-design-vue/lib/` 下全文搜该变量名即可。
