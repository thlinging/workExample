<template>
  <div id="app">
    <div class="app-shell">
      <!-- 顶部导航：白色粘性栏 + 墨色 logo + 下划线激活链接 + 黑药丸 CTA -->
      <header class="app-nav">
        <div class="app-nav-inner">
          <div class="brand">
            <span class="brand-mark">◆</span>
            <span class="brand-name">业务演示</span>
          </div>

          <nav class="nav-links">
            <a
              v-for="item in navItems"
              :key="item.path"
              class="nav-link"
              :class="{ 'is-active': isActive(item.path) }"
              href="javascript:;"
              @click="go(item.path)"
            >{{ item.label }}</a>
          </nav>

          <div class="nav-cta">
            <a
              class="nav-ghost"
              href="https://www.antdv.com/components/overview-cn"
              target="_blank"
              rel="noopener"
            >Ant Design 文档</a>
            <a
              class="nav-ghost"
              href="https://element.eleme.cn/#/zh-CN/component/installation"
              target="_blank"
              rel="noopener"
            >Element UI 文档</a>
          </div>
        </div>
      </header>

      <main class="app-content">
        <router-view />
      </main>

      <footer class="app-footer">
        <div class="app-footer-inner">
          <div class="footer-brand">
            <span class="brand-mark">◆</span>
            <span>业务演示</span>
          </div>
          <div class="footer-meta">
            Vue 2.6.2 · ant-design-vue 1.7.8 · element-ui 2.15 · interactjs
          </div>
        </div>
      </footer>
    </div>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      navItems: [
        { path: '/', label: '首页' },
        { path: '/theme', label: '主题演示' },
        { path: '/about', label: '关于' }
      ]
    }
  },
  methods: {
    isActive(path) {
      return this.$route.path === path
    },
    go(path) {
      if (this.$route.path !== path) {
        this.$router.push(path)
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

/*
 * 修复 Windows 谷歌浏览器下「系统整体偏左、不居中」：
 * Chrome 用经典（非覆盖式）竖向滚动条，约 17px，只从右侧挤占视口宽度。
 * 本系统为流式铺满 + 左右等距留白，滚动条使右侧实际留白比左侧宽 → 整体视觉左偏。
 * scrollbar-gutter: stable both-edges 让浏览器在两侧对称预留滚动条槽，
 * 无论滚动条是否出现，内容都保持真正居中（Mac 覆盖式滚动条本就无此问题）。
 */
html {
  scrollbar-gutter: stable both-edges;
}

#app {
  height: 100%;
}

.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--m-surface-soft);
}

/* ── 顶部导航 ─────────────────────────────────────────────── */
.app-nav {
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgba(255, 255, 255, 0.85);
  -webkit-backdrop-filter: saturate(180%) blur(12px);
  backdrop-filter: saturate(180%) blur(12px);
  border-bottom: 1px solid var(--m-hairline-soft);
}

.app-nav-inner {
  width: 100%;
  box-sizing: border-box;
  height: 64px;
  padding: 0 32px;
  display: flex;
  align-items: center;
  gap: 40px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 16px;
  color: var(--m-ink);
  flex: none;
}

.brand-mark {
  color: var(--m-mint);
  font-size: 14px;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.nav-link {
  position: relative;
  padding: 6px 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--m-steel);
  border-radius: var(--m-r-sm);
  transition: color 0.15s ease;
}

.nav-link:hover {
  color: var(--m-ink);
}

.nav-link.is-active {
  color: var(--m-ink);
}

/* 激活下划线：Mintlify segmented-tab 语汇 */
.nav-link.is-active::after {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: -21px;
  height: 2px;
  background: var(--m-ink);
}

.nav-cta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

.nav-ghost {
  padding: 8px 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--m-ink);
  border-radius: var(--m-r-md);
}

.nav-ghost:hover {
  color: var(--m-mint-deep);
}

/* 黑药丸主 CTA */
.nav-pill {
  padding: 8px 18px;
  font-size: 14px;
  font-weight: 500;
  color: var(--m-on-primary) !important;
  background: var(--m-primary);
  border-radius: var(--m-r-full);
  transition: background 0.15s ease;
}

.nav-pill:hover {
  background: var(--m-charcoal);
  color: var(--m-on-primary) !important;
}

/* ── 内容区 ───────────────────────────────────────────────── */
.app-content {
  flex: 1;
  width: 100%;
  padding: 40px 32px;
  box-sizing: border-box;
}

/* ── 页脚 ─────────────────────────────────────────────────── */
.app-footer {
  border-top: 1px solid var(--m-hairline);
  background: var(--m-canvas);
}

.app-footer-inner {
  width: 100%;
  box-sizing: border-box;
  padding: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--m-ink);
}

.footer-meta {
  font-size: 13px;
  color: var(--m-steel);
  font-family: var(--m-font-mono);
}

/* ── 响应式 ───────────────────────────────────────────────── */
@media (max-width: 768px) {
  .app-nav-inner {
    padding: 0 16px;
    gap: 16px;
  }
  .nav-links {
    gap: 0;
    overflow-x: auto;
  }
  .nav-ghost {
    display: none;
  }
  .app-content {
    padding: 24px 16px;
  }
}
</style>
