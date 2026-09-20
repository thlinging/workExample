# 意见稿及回复管理页面 —— Vue 化可行性分析

> 源文件：`page/gjj.html`（总公司/管理端）、`page/unit.html`（子公司/单位端）
> 目标：改写为本项目的 Vue 2 页面，组件用 ant-design-vue 1.7.8，红色主题。
> 结论：**可行，无技术障碍**。工作量集中在布局重排与两个待定决策上。
>
> **本文档后半段（第六节起）是已落地的实现记录**，含最终决策、文件清单和三个踩坑。

---

## 一、原页面在做什么

### gjj.html（总公司端，12K）

```
┌ header 蓝色横条：平台名 + 当前用户 ────────────────────────┐
├ aside 288px ─────────┬ main 双卡片 ──────────────────────┤
│ 机关名称搜索框        │ 卡片1「发送材料」                   │
│ 发文年份下拉 + 查询    │   行内筛选：文号/文件名/日期~日期/查询 │
│ 排序下拉（函件数升降）  │   表格 7 列：文号 收文单位 文件名称    │
│ ──────────────       │        MJ 发文时间 办理期限 附件      │
│ 收文单位列表（可点击）  │ 卡片2「接收材料」                   │
│  · 华东子公司 [8件]   │   同款筛选条                        │
│  · 华南子公司 [5件]   │   表格 9 列：… + 对应函件（请选择）    │
│  · 华北子公司 [12件]  │        + 附件 + 操作（上传到办理环节） │
└──────────────────────┴────────────────────────────────────┘
```

交互只有三个：点单位 → 高亮 + 过滤两张表；排序下拉 → 重排左侧列表；其余按钮/搜索框**均未绑定事件**。

### unit.html（子公司端，8K）

无左侧栏，上下两张卡片表格（上「接收材料」8 列，下「发送材料」6 列），外加一个手写的「新增回复文件」遮罩弹窗。

---

## 二、可行性逐项核对

### 1. 组件映射 —— 全部有对应，无需引入新库

| 原生实现 | ant-design-vue 1.7.8 | 是否已注册 |
| --- | --- | --- |
| `<table>` + innerHTML 拼接 | `a-table`（columns + dataSource，附带分页/排序/固定表头） | ✅ 已注册 |
| `<input placeholder>` | `a-input` | ✅ |
| `<select>` | `a-select` | ✅ |
| `<input type="date">` ×2 + `~` | `a-range-picker`，或直接复用本项目 `DualDateRangePicker.vue` | ✅ |
| 筛选条整体 | `a-form-model` inline，或 `a-space` 简单排布 | ✅ |
| 白底圆角卡片 | `a-card` | ✅ |
| 左侧单位列表 | `a-menu`（扁平）或 `a-tree`（层级） | ⚠️ Tree 未注册 |
| `[8件]` 角标 | `a-badge` / `a-tag` | ✅ |
| 手写遮罩弹窗 | `a-modal` + `a-form-model` | ✅ |
| `<input type="file">` | `a-upload` | ⚠️ 未注册 |
| 空表格 | `a-empty`（a-table 自带 locale.emptyText） | ⚠️ Empty 未注册 |
| Font Awesome 图标 | `a-icon`：`fa-user`→`user`、`fa-building-o`→`bank`、`fa-paperclip`→`paper-clip`、`fa-plus`→`plus` | ✅ |

需要往 `src/plugins/ant-design-vue.js` 追加的：`Tree`、`Upload`、`Empty`、`Popconfirm`（删除确认用）。改一处、四行，零风险。

### 2. 红色主题 —— 方案已在，但有一处必须先决策

`src/theme/presets.js` 里**已经预置了两套红**：

- `default` 丹红 `#f12b25`
- `deepRed` 深红 `#ac2417`

切换只需改 `.env` 的 `VUE_APP_THEME=default`，重启 `npm run serve`。antd less 变量 + element scss 变量 + 运行时换肤序列会一起走通（这套机制见 `docs/主题换肤方案说明.md`）。

**但是**：当前全站叠了一层 Mintlify 设计系统，`src/theme/mintlify.css:140` 有

```css
#app .ant-btn-primary:not(.ant-btn-background-ghost) { background: var(--m-primary); /* 黑 */ }
```

主按钮被**锁死为黑色药丸**，不跟随主色。所以改成红色主题后，红的是链接、选中态、开关、当前分页、日期选中格 —— 而「查询」「保存提交」这些主按钮**仍然是黑的**。这不是 bug，是当初刻意的设计决策（`docs/Mintlify设计系统重构.md` 为权威出处）。

三条出路：

| 方案 | 做法 | 影响面 |
| --- | --- | --- |
| A. 页面级作用域覆盖（推荐） | 新页面外层加 `.doc-page` 类，在页面内把 `.ant-btn-primary` 覆盖回主色红 | 只影响这两个业务页，Home/About/主题演示保持 Mintlify 黑药丸 |
| B. 全站改红 | 改 `.env` + 调整 mintlify.css 的 `--m-primary` | 全站视觉换血，首页英雄区、导航 CTA 一起变 |
| C. 只换强调色 | 仅改 `.env`，接受主按钮维持黑色 | 改动最小，但「红色主题」的观感打折 |

### 3. 布局 —— 最主要的改造量

原页面是 `html,body{height:100%}` + flex 撑满视口、左右各自滚动的**全屏工作台**布局。

本项目的壳（`src/App.vue`）是：粘性白色导航栏 64px + `.app-content{padding:40px 32px}` + 页脚，属于**文档流页面**，随内容长高。

两者不能直接叠 —— 直接套进去会出现「双层导航条」+「内层 100vh 溢出到页脚之下」。需要选：

- **嵌入现有壳**：去掉原页面的蓝色 header（平台名/用户名挪到页面标题区或复用顶部导航），左右栏改成固定高度（`calc(100vh - 64px - footer)`）或干脆让页面随内容自然滚动。改动温和，风格统一。
- **独立全屏路由**：给这两个页面单独的 layout（不挂 App.vue 的导航/页脚），保留原本的工作台观感。需要在 `src/router/index.js` 里做 layout 分流，改动稍大但更贴近原稿意图。

Tailwind 本项目未安装，所有 `flex-1 px-3 py-2 bg-gray-50` 之类的原子类都要重写成 scoped CSS。好在配色/间距/圆角在 `src/theme/design-tokens.css` 里有现成的 `--m-*` 令牌可直接引用，不用凭空定值。

### 4. 数据层 —— 已有基础设施

原页面把 `unitList / sendData / replyData` 三个数组硬编码在 `<script>` 里。本项目已有完整请求层：`src/utils/http.js`（双后台 `/api` + `/bapi`）、`src/api/a/`、`src/api/b/`。

建议先建 `src/api/a/document.js` 定义接口函数（列表/详情/关联函件/上传），组件里正常调用；后端未就绪时在 api 文件内返回 mock Promise，接通时删掉 mock 即可，组件一行不改。

### 5. 原页面的既有缺陷（转写时会自然消失，此处备案）

1. `unit.html:162` —— `document.getElementById("addReplyBtn").onclick`，但该按钮在 78-80 行被注释掉了，**这行必然抛 `Cannot set property of null`，脚本中断**，所以「新增回复」弹窗实际根本打不开。转成 `a-modal` 后没有这个问题，但需确认：**这个新增功能到底要不要保留？**
2. `unit.html:103` `w-max-md` 不是合法 Tailwind 类（应为 `max-w-md`），弹窗实际没有宽度约束。
3. `gjj.html:218` 排序下拉重排后传的是排序副本，但 `selectedUnitId` 的过滤状态与之无关联，且搜索框 `unitSearch`、年份查询按钮、上下两条表格筛选条**全部无事件绑定**——即这些筛选是纯静态占位。
4. 左侧被称作「树」，数据结构却是**扁平数组**。若真实业务是「中央和国家机关 → 下属单位」两级，要用 `a-tree`；若确实是平铺清单，`a-menu` 更合适、也更省事。

---

## 三、待定决策（做之前需要拍板）

1. **红色的落地方式** —— A / B / C 三选一（见上表，推荐 A）。
2. **布局归属** —— 嵌入现有壳，还是独立全屏 layout。
3. **左侧是树还是平铺列表** —— 取决于真实数据是否有层级。
4. **那些无绑定的筛选条** —— 是要做成可用的前端过滤（无后端也能跑），还是维持占位。
5. **「对应函件」选择** —— 原稿是个 `请选择` 链接。做成弹窗内表格单选（`a-modal` + `a-table` radio 选择列）是标准做法，确认即可。
6. **子公司端「新增回复文件」** —— 保留（原稿已注释掉入口）还是去掉。
7. **两端是否合并** —— 两页表格结构高度重合（发送/接收材料）。可抽公共组件 `DocumentTable.vue`，按角色传不同 columns；也可各写各的，简单直白。

---

## 四、建议的文件规划

```
src/views/document/
  HeadquarterDocument.vue     # 总公司端（左单位栏 + 双表）
  UnitDocument.vue            # 子公司端（双表 + 新增弹窗）
  components/
    DocumentTable.vue         # 发送/接收材料表（columns 由父级传入）
    DocumentFilterBar.vue     # 文号/文件名/日期区间/查询 筛选条
    UnitSidebar.vue           # 左侧单位列表 + 搜索/年份/排序
    RelatedDocModal.vue       # 「对应函件」选择弹窗
src/api/a/document.js         # 接口定义（可先内置 mock）
```

路由挂 `/document/hq` 与 `/document/unit`，顶部导航按需加两个入口。

---

## 五、工作量估计

| 项 | 估计 |
| --- | --- |
| antd 组件注册补齐 + 主题红色落地 | 小 |
| 公共子组件（表格/筛选条/侧栏/关联弹窗） | 中 |
| 两个页面组装 + 布局适配 | 中 |
| mock 数据 + api 骨架 | 小 |

整体一次可以做完，不存在需要预研的技术风险点。

---

## 六、实施记录（已完成）

### 最终决策

| 决策点 | 结果 |
| --- | --- |
| 颜色 | **写死，不接主题系统**。全是 hex，不用 `--m-*` 设计令牌 |
| 样式落点 | **没有独立样式文件**，全部写在各组件的 `<style lang="less">` 里（含不带 scoped 的弹层块） |
| 布局 | **全屏工作台**。保留顶部导航，页面 `fixed` 铺满导航以下视口；无页面标题区、无卡片边框圆角 |
| 分栏 | 总公司端左右两栏，中间一条右边框分隔，两栏等高拉满；子公司端只有右侧部分 |
| 表格区 | 上下各占 **50%** 高度，**无分页**，表头固定、表体内部滚动；标题一行、查询条件另起一行 |
| 按钮圆角 | **4px**（压过 mintlify.css 的药丸圆角） |
| 状态列 | 原型的 `MJ` 列改为**状态**，取值 `有效 / 无效` |
| 左侧结构 | **扁平列表**，不上 `a-tree`；数据结构保留 `unitId/unitName`，将来要分级再换 |
| 筛选条 | **保持占位语义**，但事件全绑好（v-model → params → 接口函数），后端一接就通 |
| 新增回复弹窗 | **去掉**（原型入口本就是注释掉的） |

全局主题文件（`mintlify.css` / `presets.js` / `.env`）自始至终没有改动过；这两个页面的样式
覆盖全部收在自己的组件里，与换肤引擎无任何关系。已验证首页主按钮仍是黑药丸 9999px 薄荷绿，
未被污染。

### 文件清单

```
src/views/document/
  HeadquarterDocument.vue          总公司端 /document/hq
  UnitDocument.vue                 子公司端 /document/unit
  components/
    UnitSidebar.vue                左侧单位栏（搜索/年份/排序 + 可点列表）
    DocumentFilterBar.vue          文号/文件名/日期区间/查询/重置，四张表共用
    RelatedDocModal.vue            「对应函件」选择弹窗（表格单选，整行可点）
src/api/a/document.js              接口定义 + mock（USE_MOCK 开关）
```

没有独立的样式文件，样式全在各组件的 `<style lang="less">` 里 —— 分配规则见下面「样式为什么这么分」。

改动到的既有文件：`src/router/index.js`（两条路由）、`src/App.vue`（两个导航入口）。

### 样式为什么这么分

样式一律 `lang="less"`（loader 在 `vue.config.js` 里早就配好了，含 `javascriptEnabled` 与 antd 的 `modifyVars`）。颜色在每个组件顶部用 less 变量声明一遍 —— 故意不抽公共变量文件，这两个页面要的就是自包含、不依赖任何外部样式源。透明度用 `fade(@doc-red, 14%)` 而不是手写 rgba。

按「谁的 DOM 归谁管」拆到组件里，有三条规则决定了写法：

**1. 深度选择器要用 `::v-deep`，不能用 `>>>`**

`>>>` 是纯 CSS 里的写法，less 解析不了会直接报错。less/scss 下用 `::v-deep`，还能配合嵌套写成一整块：

```less
#app .doc-filter {
  ::v-deep {
    .ant-btn { border-radius: @doc-radius; }
    .ant-btn-primary { … }
  }
}
```

**2. 覆盖 antd 的规则必须带 `#app` 前缀**

`src/theme/mintlify.css` 用的是 `#app .ant-btn`（含 id）。scoped 编译出来的 `.doc-filter[data-v-x] .ant-btn` 权重是 (0,2,1)，压不过 (1,1,0) —— 不带 `#app` 按钮就还是黑药丸。写成 `#app .doc-filter { ::v-deep {…} }` 后编译为 `#app .doc-filter[data-v-x] .ant-btn` (1,2,1)，既压得过又不外泄。

**3. 弹层的样式不能带 scoped**

日期面板、select 下拉、Modal 都渲染到 `body` 上，不在组件的 DOM 树里，scoped 的 data-v 属性钉不上去，`>>>` 也够不到。这几处写在组件的第二个、不带 scoped 的 `<style>` 块里，作用域靠模板传的 `dropdown-class-name="doc-popup"` / `wrap-class-name="doc-popup-modal"` 收住 —— 只有这两个页面的弹层带这些 class。弹层在 `#app` 之外，反而不需要 `#app` 前缀。

| 组件 | scoped 里管 | 非 scoped 块管 |
| --- | --- | --- |
| `DocumentFilterBar` | 筛选条布局、按钮/输入框的红色与 4px 圆角 | `.doc-popup` 日期面板 |
| `UnitSidebar` | 侧栏布局、里面的按钮/输入/下拉框 | `.doc-popup` select 下拉项 |
| `HeadquarterDocument` / `UnitDocument` | 页面布局、表格（表头/hover/链接/撑满） | — |
| `RelatedDocModal` | — | `.doc-popup-modal` 整个弹窗 |

表格那段两个页面各有一份（结构相同），是为了避免为了复用再包一层表格组件。

### 接后端时要动的地方

1. `src/api/a/document.js` 顶部 `USE_MOCK = false`，核对每个函数的 url，删掉文件下半截 mock 区；
2. `UnitDocument.vue` 的 `CURRENT_UNIT` 常量改成从登录态取；
3. 两个页面里的 `downloadAttach()` 改成真实下载（`window.open(url)` 或 blob）；
4. `UnitSidebar.vue` 的 `years` 写死数组改成字典接口。

页面组件本身不需要改 —— 筛选条件已经是拍平后的 `{ unitId, docNo, title, startDate, endDate }`，直接透传。

### 三个踩坑（都已修，改代码时别踩回去）

**1. `slot-scope` 的第二个参数拿不到（vue 2.6.2）**

```html
<!-- ✗ record 是 undefined。#name="text, record" 和 slot-scope="text, record" 都一样 -->
<template slot="attach" slot-scope="text, record">
```

本项目锁 `vue@2.6.2` / `vue-template-compiler@2.6.2`，这个版本的 scoped slot 只把第一个参数透传进来，而 antd 的 `customRender` 是按 `(text, record, index, column)` 调的。

绕法：需要整行数据的列**把 `dataIndex` 留空**，antd 的 `TableCell` 在 `dataIndex` 为空时直接把 `record` 当第一个参数传进来；此时必须补 `key`，否则多列同名冲突。

```js
{ title: '附件', key: 'attach', dataIndex: '', scopedSlots: { customRender: 'attach' } }
```
```html
<template slot="attach" slot-scope="record">{{ record.attach }}</template>
```

**2. `a-select-option` 必须显式写 `key`**

缺 key 时 antd 会按下标去匹配 value，把 `v-model` 的值纠正成**错误的那一项**，还会顺带触发一次 `change`。现象很隐蔽：下拉框显示第二个选项、排序结果跟着错，但代码里的默认值明明是第一个。

**3. 日期面板原本是英文**

项目此前没配过 antd 语言包，`DatePicker` 面板是 `Aug 2026 / Su Mo Tu`。这里给 `a-range-picker` 传了 `zh_CN`，并在 `DocumentFilterBar.vue` 里 `moment.locale('zh-cn')`。

⚠️ `moment.locale` 是**全局**的：这个组件一旦被打包进来，全站 moment 的月份/星期名都变中文。对中文业务系统是想要的效果，但若哪天有页面依赖英文月份名，得改成 moment 实例级 locale。

### 两个布局细节（改动时注意）

**1. 表格撑满 + 表头固定，没用 JS 量高度**

antd 1.x 只有传了 `scroll.y` 才会把表格拆成「表头 + 表体」两段、表头才固定，而 `y` 要求一个具体数值。这里传 `y: 1` 作占位让它拆段，再在 `document.css` 里用 `!important` 顶掉 antd 写在 `.ant-table-body` 上的 inline `max-height`，改由 flex 撑满剩余高度。好处是窗口缩放自动跟随，不用监听 resize。

顺带把 antd 的 `overflow-x: scroll` 改成 `auto`，列放得下时不会一直挂着一条空滚动条轨道。

因为固定表头 + 固定列叠加容易出对齐问题，「操作」列的 `fixed: 'right'` 去掉了，列多时靠横向滚动看。

**2. 页面是 `position: fixed` 全屏**

`top: 64px`（顶部导航高度）铺到视口底部，绕开 `App.vue` 内容区的 padding 和页脚，左右两栏才能真正等高拉满。代价是文档流里只剩页脚、还能滚出一截空白，所以两个页面在 `mounted` 里锁 `body.overflow`、`beforeDestroy` 还原 —— 改成别的布局方式时记得把这段一起去掉。

### 验证情况

- `npm run lint` 通过，`npm run build` 通过；
- 浏览器实测：单位联动过滤两表、筛选条查询+重置、「对应函件」弹窗选择→关联回填、日期面板中文与红色选中态，均正常；控制台无报错；
- 专门验过表格：塞 30 行后表体内部滚动、表头不动、表头与表体列对齐；两块区域实测高度 468 / 467（各占一半）；
- 样式搬进组件、并改写成 less 后，两轮都重新验过三处弹层：日期面板今日红字、select 选中项红底、弹窗确定按钮红底 4px 圆角、提示文字与整行 pointer 光标全部生效；侧栏 `::v-deep .ant-spin-container` 的滚动容器也仍然是 `overflow-y: auto`；
- 离开页面后 `body.overflow` 正确还原，首页滚动不受影响；首页主按钮仍是 9999px 黑药丸/薄荷绿，确认无全局污染。

### 原型里没有照搬的两处

- `unit.html` 的上表 thead 有「办结时间」列，tbody 却在该位置渲染了一个「请选择」链接（错位）。这里按表头语义走，显示 `finishTime`，无值时展示灰色「未办结」。
- 原型的 `MJ` 列已按要求改成**状态**列，取值 `有效 / 无效`（mock 里字段名是 `status`），用 `a-tag` 展示：有效红底、无效灰底。
