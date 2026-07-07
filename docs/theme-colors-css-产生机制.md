# `theme-colors.css` 是怎么产生的

> 配套阅读：[主题换肤方案说明](./主题换肤方案说明.md)
> 结论先行：`theme-colors.css` **不是普通打包产物**，而是 `webpack-theme-color-replacer` 插件在
> webpack 构建**末尾**，把全站所有产物里"含主题色的 CSS 声明"扫出来、去重合并，
> 再作为一个**新资源塞回 webpack** 生成的文件。它不来自任何源码文件，完全是扫描结果拼出来的。

---

## 一、触发时机：webpack 的 `emit` 钩子

```js
// src/index.js:21
compiler.hooks.emit.tapAsync('ThemeColorReplacer', (compilation, callback) => {
  this.handler.handle(compilation)   // ← 造文件就在这
  callback()
})
```

`emit` 是 webpack **所有资源都编译完、即将写盘的最后一刻**。此时 `compilation.assets` 里
已经有全部产物（每个 `.js`、`.css` 的最终内容）。插件就在这一刻切进去加工。

---

## 二、产生流程（四步）

```
compilation.assets（所有打包好的 js/css）
        │
        ▼  ① 遍历每个 asset（AssetsExtractor.extractAsset :95）
   ├─ 是 .css 文件 → 直接扫描内容
   └─ 是 .js 文件  → 先用正则把 css-loader 内嵌的 css 字符串抠出来再扫描
        │
        ▼  ② 逐条规则筛选（Extractor.extractColors）
   把 CSS 按 { } 拆成一条条规则，每条再按 ; 拆成声明，
   用 matchColors 的正则 test 每条声明 → 命中主题色的才保留
   结果形如：  选择器{只留命中的那几条声明}
        │
        ▼  ③ 去重 + 合并（AssetsExtractor:62 dropDuplicate + join('\n')）
   得到一整份文本 = output
        │  ← 这里 console.log('Extracted theme color css content length: '+output.length)
        │    就是构建日志里看到的那行
        ▼  ④ 把 output 当成"新资源"塞回 webpack（Handler.handle:24）
   compilation.assets['static/css/theme-colors.css'] = {
     source: () => output,   // 文件内容
     size:   () => output.length
   }
```

**第 ④ 步是关键**：插件凭空往 `compilation.assets` 里加了一个新 key，webpack 后续照常把它
写盘 → 于是 `dist/static/css/theme-colors.css` 就出现了。

---

## 三、顺带做的第二件事：注入 js

同一个 `handle` 里还调了 `addToEntryJs`（Handler.js:38），往入口 js 尾部拼一段全局配置：

```js
window.__theme_COLOR_cfg = { url: '.../theme-colors.css', colors: matchColors } // 运行时用的基准色
// 因为开了 injectCss:true，还多注入一份整份 css 文本：
window.__theme_COLOR_css = "……整个 theme-colors.css 的文本……"
```

这就是**运行时 `client` 不用发请求、直接拿到 css 文本**的来源
（`client/themeColorChanger.js` 的 `getCssString` 里 `win().__theme_COLOR_css` 读的就是它）。

---

## 四、几个值得知道的细节

| 细节 | 位置 | 说明 |
|---|---|---|
| **css 藏在 js 里也能抽** | AssetsExtractor.js:100 | 按需引入 / 小 css 内联时，css 以字符串形式打进 js，插件用正则 `Css_Loader_Reg_UGLY/DEV` 把它抠出来照样扫描。所以不管 css 在独立文件还是 js 里都能抽到。 |
| **增量构建有缓存** | `_themeCssCache` :88 | dev 模式改一点代码，没变的 asset 直接用上次结果，不重复扫全站。 |
| **容错重试** | :72 | 若第一遍一条都没抽到（说明 `isJsUgly` 判断反了），自动翻转再扫一次。 |
| **可扩展外部 css** | :54 | `externalCssFiles` 能把 CDN 上的 css 也读进来一起抽。 |
| **可二次加工** | :65 | `resolveCss(output)` 能对最终文本做后处理。 |

---

## 五、核心筛选逻辑（Extractor 怎么判断"含主题色"）

匹配用的正则由 `matchColors` 生成（Extractor.js:12）：

```js
matchColors.map(c =>
  new RegExp(c.replace(/\s/g, '').replace(/,/g, ',\\s*') + '([\\da-f]{2})?(\\b|\\)|,|\\s)', 'i')
)
```

- `matchColors` = `getAntdSerials(BASE_PRIMARY)`，即主色的一整串色阶（约 20 个颜色）。
- 正则对每个颜色做了处理：忽略空格、允许 `rgb` 逗号后的空格、允许 8 位 hex（带透明度）、
  用 `(\b|\)|,|\s)` 保证是**完整颜色**而不是某个更长颜色的前缀。
- 逐条 CSS 声明去 `test`，命中任一色就保留该声明。

> 正因为匹配的是 `matchColors` 这串**死颜色**，所以 `theme-colors.css` 里必须是死颜色、
> 不能是 `var(--primary-color)` —— 否则既抽不出来、运行时也没法做字符串替换。

---

## 六、一句话总结

**`theme-colors.css` = 插件在 webpack `emit` 阶段，把全站所有产物里"含主题色的 CSS 声明"
扫出来、去重合并，再作为一个新资源塞回 webpack 生成的文件**；同时把它的内容 / 基准色注入
入口 js，供运行时替换使用。

---

## 附：涉及的插件源码文件

| 文件 | 职责 |
|---|---|
| `src/index.js` | 挂 `emit` 钩子，入口 |
| `src/Handler.js` | 造出新资源 + 注入入口 js |
| `src/AssetsExtractor.js` | 遍历所有 asset，从 css/js 里取出 css 文本 |
| `src/Extractor.js` | 逐条规则/声明筛选出含主题色的部分 |
| `src/replaceFileName.js` | 处理文件名里的 `[contenthash]`（我们去掉了，规避 Node 24 md4 报错） |
| `client/themeColorChanger.js` | 运行时读取该 css 并做颜色替换 |
