# 自己编译 Element UI 2.15.12 的 theme-chalk.css

> 2026-07 实测通过（Windows + dart-sass）。换成 2.5.12 等其他 2.x 版本做法完全相同，只是 `npm i element-ui@<版本>` 换个号。
>
> **现成工具已搭好：`F:\element-theme-build`**（改 `my-theme.scss` → `npm run build`，详见该目录下 README.md）。

## 结论：不用克隆源码仓库

npm 上发布的 `element-ui` 包**自带 theme-chalk 的全部 SCSS 源码**（`node_modules/element-ui/packages/theme-chalk/src/`，共 100 个文件）。官方文档里 `@import "~element-ui/packages/theme-chalk/src/index"` 的定制写法依赖的就是这份源码，所以拿现代的 dart-sass 直接编译即可，完全绕开官方构建链里已经年久失修的 node-sass。

## 实测步骤（三条命令）

```bash
mkdir et-build && cd et-build
npm i element-ui@2.15.12 sass clean-css-cli
```

写入口文件 `my-theme.scss`（想改的变量写在 import 之前，`!default` 机制会让官方默认值让位）：

```scss
$--color-primary: #16a085;      // 想覆盖的变量都写在这里
$--font-path: 'fonts';           // icon 字体的相对路径，见下文
@import "./node_modules/element-ui/packages/theme-chalk/src/index";
```

编译 + 压缩去重：

```bash
npx sass --no-source-map --style=compressed my-theme.scss dist/theme-chalk.css
npx cleancss -O2 -o dist/theme-chalk.min.css dist/theme-chalk.css
```

## 两个必须知道的坑

### 1. clean-css 那步不是可有可无的

theme-chalk 的组件 scss 会互相 `@import`（select 引 input/tag/scrollbar 等），而 SCSS 的 `@import` 是文本内联，同一段规则会被重复输出多次。实测数据（以 `.el-input__inner{` 出现次数为例）：

| 文件 | 出现次数 | 体积 |
|---|---|---|
| sass 直出 | 227 | 454 KB |
| clean-css -O2 去重后 | **45** | **209 KB** |
| 官方 lib/theme-chalk/index.css | **45** | 240 KB |

官方成品里也残留 45 次重复——因为官方 gulp 管线（gulp-cssmin，内核就是老版 clean-css 的 advanced 优化）干的是同一件事。去重后我们的产物和官方结构一致；30KB 的差值是官方多跑了 autoprefixer（`ie > 9` 等老浏览器前缀），需要的话补一步 `postcss + autoprefixer` 即可。

### 2. 字体文件要自己拷

icon 字体不在 CSS 里，把 `node_modules/element-ui/lib/theme-chalk/fonts/` 整个目录拷到产物 CSS 旁边，并保证 `$--font-path` 指向它（同目录就写 `'fonts'`）。漏了这步图标会全变成方块。

## 其他备选路线（都不如上面这条）

| 路线 | 问题 |
|---|---|
| 克隆 element 仓库 tag v2.15.12，`cd packages/theme-chalk && npm i && gulp build` | gulpfile 用的是 gulp-sass 4（node-sass 内核），node-sass 在新版 Node/Windows 上装不上，得退到 Node 14/16 + VS 构建工具，折腾 |
| `element-theme` CLI（`et`） | 同样绑死 node-sass，2019 年后基本没维护 |
| 官网在线主题编辑器 | 服务早已下线/不可用 |

## 备注

- dart-sass 编译时会刷几百条 `math.div` 弃用警告（老 SCSS 的 `/` 除法写法），**无害**，加 `--quiet-deps` 也压不干净（源码不是依赖形式引入），忽略即可。若担心未来 sass 2.0 移除 `/` 除法，把 sass 锁在 1.x（本次实测 sass 1.x 最新版可用）。
- 全部可覆盖变量清单见 `node_modules/element-ui/packages/theme-chalk/src/common/var.scss`。
- 验证方式：编译产物中默认蓝 `#409eff` 应零出现，`.el-button--primary` 的 background-color 应为你的新主色。
