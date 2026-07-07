# resize-project

基于 **Vue 2.6.2** + **ant-design-vue 1.7.8** 的项目脚手架。

## 技术栈

- Vue `2.6.2`
- Vue Router `^3.5.3`
- ant-design-vue `1.7.8`（通过 `babel-plugin-import` 按需加载）
- @vue/cli-service `~4.5.19`
- less `^3.13.1`

## 环境要求

- Node.js 建议 **14.x ~ 16.x**（与 vue-cli 4.5 / webpack 4 配套）
- npm 6.x 或 yarn 1.x

> 若使用 Node 17+ 出现 `ERR_OSSL_EVP_UNSUPPORTED`，可在启动前设置 `set NODE_OPTIONS=--openssl-legacy-provider`（Windows）。

## 安装

```bash
npm install
# 或
yarn install
```

## 常用命令

```bash
# 启动开发服务器（默认 http://localhost:8080）
npm run serve

# 生产构建，产物输出到 dist/
npm run build

# 代码风格检查
npm run lint
```

## 目录结构

```
resizeProject
├── public/
│   └── index.html              # HTML 模板
├── src/
│   ├── App.vue                 # 根组件
│   ├── main.js                 # 入口文件
│   ├── plugins/
│   │   └── ant-design-vue.js   # 按需注册 antd 组件
│   ├── router/
│   │   └── index.js            # 路由配置
│   └── views/
│       ├── Home.vue            # 首页（表单 / 卡片示例）
│       └── About.vue           # 关于页（表格示例）
├── babel.config.js             # Babel 配置（含 import 插件）
├── vue.config.js               # webpack / devServer 配置
├── .eslintrc.js
└── package.json
```

## 按需加载说明

`babel.config.js` 中已配置：

```js
['import', { libraryName: 'ant-design-vue', libraryDirectory: 'es', style: true }]
```

在 `src/plugins/ant-design-vue.js` 中通过 `Vue.use()` 注册需要的组件即可，新增组件时在该文件追加即可，无需手动引入样式。

为了支持 antd 的 less 变量覆盖，`vue.config.js` 中开启了 `javascriptEnabled: true`。
