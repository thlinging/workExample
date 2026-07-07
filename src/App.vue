<template>
  <div id="app">
    <a-layout class="app-layout">
      <a-layout-header class="app-header">
        <div class="logo">Resize Project</div>
        <a-menu
          theme="dark"
          mode="horizontal"
          :selected-keys="selectedKeys"
          class="app-menu"
          @click="onMenuClick"
        >
          <a-menu-item key="/">首页</a-menu-item>
          <a-menu-item key="/ueditor">UEditor</a-menu-item>
          <a-menu-item key="/theme">主题演示</a-menu-item>
          <a-menu-item key="/about">关于</a-menu-item>
        </a-menu>
      </a-layout-header>

      <a-layout-content class="app-content">
        <router-view />
      </a-layout-content>

      <a-layout-footer class="app-footer">
        Vue 2.6.2 + ant-design-vue 1.7.8
      </a-layout-footer>
    </a-layout>
  </div>
</template>

<script>
export default {
  name: 'App',
  computed: {
    selectedKeys() {
      return [this.$route.path]
    }
  },
  methods: {
    onMenuClick({ key }) {
      if (this.$route.path !== key) {
        this.$router.push(key)
      }
    }
  }
}
</script>

<style>
html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
}

#app {
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', Arial, sans-serif;
  height: 100%;
}

.app-layout {
  min-height: 100vh;
}

.app-header {
  display: flex;
  align-items: center;
  padding: 0 24px;
  /* 业务层 CSS 变量：顶部导航背景取自自定义主题变量（默认回退到 antd 深色） */
  background: var(--header-bg, #001529);
}

.logo {
  color: #fff;
  font-size: 18px;
  font-weight: 600;
  margin-right: 32px;
}

.app-menu {
  flex: 1;
  line-height: 64px;
}

/* 顶部 dark 菜单选中项：背景=主题色（antd 默认，换肤时跟随），
   强制纯白加粗文字，避免换成丹红等深主题色后红底文字对比不足、看不清。
   同时覆盖主菜单与右侧系统切换器（都在 .app-header 内）。 */
.app-header .ant-menu-dark .ant-menu-item-selected,
.app-header .ant-menu-dark .ant-menu-item-selected > a,
.app-header .ant-menu-dark .ant-menu-item-selected:hover,
.app-header .ant-menu-dark .ant-menu-item-selected:hover > a {
  color: #fff;
  font-weight: 600;
}

.app-content {
  padding: 24px;
  background: #f0f2f5;
}

.app-footer {
  text-align: center;
}
</style>
