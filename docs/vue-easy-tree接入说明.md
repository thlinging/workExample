# vue-easy-tree 接入说明

> 需求：项目里要能渲染上万级的树，滚动不能卡。
>
> **当前状态：已接入。** 组件在 `src/plugins/vue-easy-tree.js` 全局注册，任何页面直接写
> `<vue-easy-tree>` 即可；演示页 `/easy-tree`（`src/views/EasyTreeDemo.vue`）覆盖虚拟滚动、
> 过滤、懒加载、自定义节点四类用法，并把性能指标显示在页面上。

一句话概括：**它就是 element 的 `el-tree` 加了一层 `vue-virtual-scroller`——API 照搬，样式同名，
所以本项目直接复用自己那套 element 主题，不引它自带的样式。**

---

## 一、怎么用

给了 `height` 就是虚拟滚动，不给就是普通全量渲染，其余与 `el-tree` 一致：

```vue
<!-- 虚拟滚动：node-key 必填，height 决定容器高度，item-size 是行高（默认 26） -->
<vue-easy-tree
  ref="tree"
  node-key="id"
  height="460px"
  :item-size="26"
  :data="treeData"
  :props="{ children: 'children', label: 'label' }"
  show-checkbox
  :filter-node-method="filterNode"
  @node-click="onNodeClick"
  @check="onCheck"
/>
```

方法也照搬 el-tree：`getCheckedKeys()` / `getHalfCheckedKeys()` / `setCheckedKeys()` /
`setCurrentKey()` / `filter()` / `getNode()` …… 从 `el-tree` 迁过来基本零成本。

---

## 二、版本适配：两个必须做的动作

这个包对依赖的声明不太规范，直接 `npm i` 会踩两个坑，接入时都已处理。

### 1. `package.json` 的 `overrides`——避免两份 Vue

它把 `vue: 2.6.11` 写成了**硬 dependency**（本该是 peerDependency），
而本项目锁的是 `vue: 2.6.2`。npm 解析不到交集，就会在
`node_modules/@wchbrad/vue-easy-tree/node_modules/` 里嵌套装第二份 Vue，
连带 `vue-virtual-scroller` 也被拖进嵌套目录。

```json
"overrides": {
  "@wchbrad/vue-easy-tree": { "vue": "$vue" },
  "vue-virtual-scroller":  { "vue": "$vue" }
}
```

`$vue` 表示"跟随根 dependencies 里的 vue 版本"，即 2.6.2。装完 `npm ls vue`
应该全是 `2.6.2 deduped`，一个 `invalid` 都没有。

> ⚠️ 本项目 `.gitignore` 掉了 `package-lock.json`。全新环境直接 `npm i` 会按
> overrides 正确解析；但**本地已经装过旧版本**的话，lock 里的嵌套记录会顶掉 overrides，
> 需要先 `rm -rf node_modules/@wchbrad` 再 `npm i`。

### 2. `vue.config.js` 的 `transpileDependencies`——它含 JSX

```js
transpileDependencies: ['@wchbrad/vue-easy-tree'],
```

`tree-node.vue` 和 `virtual-tree-node.vue` 用的是 `<script type="text/jsx">`。
babel 默认 exclude `node_modules`，不转译就会把 JSX 原样丢给 webpack 解析，直接构建失败。

---

## 三、为什么从 src 源码引入，不 import 包名

`package.json` 的 `main` 指向 `dist/vue-easy-tree.js`，那是个 **没有配 externals** 的 UMD 包
（见包内 `webpack.config.js`，`resolve.alias` 把 `vue$` 指到 `vue/dist/vue.esm.js` 后整包打进去了）。
直接 `import VueEasyTree from '@wchbrad/vue-easy-tree'` 会：

- 得到第二个 Vue 实例（响应式、全局 API 都不与主应用共享）；
- 产物白白多出约 100KB 的重复 Vue；
- 它的样式也一并被打进 dist，写死 element 默认蓝，主题接不上。

所以 `src/plugins/vue-easy-tree.js` 里走的是源码路径：

```js
import VueEasyTree from '@wchbrad/vue-easy-tree/src/components/ve-tree.vue'
Vue.component(VueEasyTree.name, VueEasyTree)   // name = 'VueEasyTree'
```

由本项目的 webpack 编译，用项目自己的 vue 2.6.2，全局单实例。

---

## 四、样式：复用项目的 element 主题

它的 scss 里 `$namespace: 'el'`，类名与 element 完全同名——`.el-tree`、`.el-tree-node`、
`.el-checkbox`。而本项目的 element 主题入口（`src/theme/element-theme.scss`）编译的是
theme-chalk **全量** `index.scss`，早就包含 `tree.scss` / `checkbox.scss` / `icon.scss`。

于是**不引它自带的 `src/assets/index.scss`**，白拿三件事：

| 白拿的能力     | 来源                                                   |
| -------------- | ------------------------------------------------------ |
| 编译期主题     | `presets.js` 的 `$--color-primary`，与 antd 同源       |
| 运行时换肤     | 色值在抽取范围内，`ThemeManager.changeColor` 一起换     |
| Mintlify 覆盖层 | `src/theme/mintlify.css` 末尾的 `.el-tree` 段          |

两份 `tree.scss` 逐行 diff 过，忽略格式后实质差异只有两条：

1. element 有 `.el-tree-node__content { height: 26px }`，它没有。
   **无需处理**：虚拟节点模板里打了 inline `height: ${itemSize}px`，优先级更高，
   `item-size` 取什么值都对；非虚拟模式则回到 element 原生的 26px。
2. 它多出 `.el-tree-node__expand-icon-no-transition`，element 没有。
   **必须补**，见 `src/plugins/vue-easy-tree.css`——虚拟滚动复用 DOM 行，
   展开箭头的 `transform` 过渡会在复用时被角度突变触发，表现为滚动时箭头乱转，
   这个类就是用来禁掉过渡的。

### 换肤色序补的一档

element 的 `tree.scss` 把「当前高亮行」底色写成 `mix($--color-white, $--color-primary, 92%)`，
**不走** `light-1~9` 那套 10% 步进，所以不在 element 官方色序里——换主色时树的选中行不跟随
（element 官方主题工具同样漏了它）。`src/theme/colorSeries.js` 的 `getElementSerials`
末尾补了这一档：

```js
// 树「当前高亮行」底色 = mix(白, 主色, 92%)
varyColor.mix('#fff', color, 0.92)
```

补完后 `dist/static/css/theme-colors.css` 里就能看到
`.el-tree--highlight-current .el-tree-node.is-current>.el-tree-node__content` 这条规则了。
`src/theme/__tests__/color-series.spec.js` 钉住了这一档，防止后续重构被顺手删掉；
`preset-collision.spec.js` 则确认新增的这档不与任何功能色撞值。

---

## 五、与 el-tree 的行为差异（踩坑记录）

### `@check-change` 基本不触发，请用 `@check`

`src/components/mixins/common-methods.js`：

```js
// vue-easy-tree（&&）
if (this.oldChecked !== checked && this.oldIndeterminate !== indeterminate) {
    this.tree.$emit("check-change", node.data, checked, indeterminate);
}
```

element 原版这里是 `||`。改成 `&&` 后要求 checked 与 indeterminate **同时翻转**才派发，
勾选一个普通节点（checked 变、indeterminate 不变）压根不会触发。

用 `@check` 代替，载荷与 el-tree 一致：

```js
onCheck(data, info) {
  // info: { checkedNodes, checkedKeys, halfCheckedNodes, halfCheckedKeys }
}
```

### 多出来的东西

| 能力            | 说明                                                        |
| --------------- | ----------------------------------------------------------- |
| `scrollToItem(key)` | 按 node-key 把目标行滚到视口顶部，仅虚拟滚动模式有效        |
| `item-size`     | 行高，默认 26，与 element 的 `.el-tree-node__content` 默认高一致 |
| `keeps` / `extra-line` | 渲染行数与缓冲，一般不用动                             |

---

## 六、性能实测（本机 Chrome，`/easy-tree` 页面上的指标）

下表是热身后连续采集的一组数据（`item-size=26`、`height=460px`）：

| 规模          | 造数据 | 建树 + 首屏渲染 | 过滤一次 | 实际 DOM 行数 |
| ------------- | ------ | --------------- | -------- | ------------- |
| 1 万（10,020）  | 143ms  | 532ms           | 31ms     | **20**        |
| 5 万（50,050）  | 202ms  | 1715ms          | 56ms     | **20**        |
| 10 万（100,050）| 191ms  | 2220ms          | 92ms     | **20**        |

> 「造数据」是纯 JS 建对象数组，受 JIT 影响大，三档都在百毫秒量级，不必当作趋势看。
> 「过滤」测的是关键字 `第 03 组`（命中少）；换成命中几千行的 `成员 099` 时 10 万档约 290ms。

关键结论：**DOM 行数恒定 20，与数据量无关**——这就是虚拟滚动的价值，滚动和过滤都很稳。

但 `建树 + 首屏渲染` 这一列是 O(n) 且不可回避：`TreeStore` 要为每个节点 new 一个 `Node`
并交给 Vue 做响应式，10 万节点这一步就是秒级的。**虚拟滚动只省渲染，不省建树。**
真要上大数据量，配合 `lazy` + `load` 分层拉取才是正解。

---

## 七、涉及的文件

| 文件                                   | 作用                                       |
| -------------------------------------- | ------------------------------------------ |
| `package.json`                         | 依赖 + `overrides` 钉住 vue 版本           |
| `vue.config.js`                        | `transpileDependencies`（JSX）             |
| `src/plugins/vue-easy-tree.js`         | 源码引入 + 全局注册，含选型理由            |
| `src/plugins/vue-easy-tree.css`        | 唯一的功能性样式补丁                       |
| `src/main.js`                          | 引入插件（必须排在 element 之后）          |
| `src/theme/mintlify.css`               | `.el-tree` 的 Mintlify 覆盖层              |
| `src/theme/colorSeries.js`             | 补 mix 92% 一档，让选中行跟随换肤          |
| `src/theme/__tests__/color-series.spec.js` | 钉住那一档                             |
| `src/views/EasyTreeDemo.vue`           | 演示页 `/easy-tree`                        |

---

## 八、升级注意

升级 `@wchbrad/vue-easy-tree` 时按顺序检查：

1. `package.json` 的 `dependencies.vue` 是否还写成硬依赖——是则 `overrides` 继续留着；
2. `src/assets/tree.scss` 与当前 element 版本的 `tree.scss` 再 diff 一次，
   差异若不止本文第四节那两条，`vue-easy-tree.css` 要跟着补；
3. `common-methods.js` 里 `check-change` 的 `&&` 是否修好了——修好了就能换回 `@check-change`；
4. `npm ls vue` 必须全是 `2.6.2 deduped`。
