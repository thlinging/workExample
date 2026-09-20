import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import(/* webpackChunkName: "home" */ '@/views/Home.vue')
  },
  {
    path: '/about',
    name: 'About',
    component: () => import(/* webpackChunkName: "about" */ '@/views/About.vue')
  },
  {
    path: '/ueditor',
    name: 'UEditorDemo',
    component: () => import(/* webpackChunkName: "ueditor" */ '@/views/UEditorDemo.vue')
  },
  {
    path: '/theme',
    name: 'ThemeDemo',
    component: () => import(/* webpackChunkName: "theme" */ '@/views/ThemeDemo.vue')
  },
  {
    path: '/easy-tree',
    name: 'EasyTreeDemo',
    component: () => import(/* webpackChunkName: "easy-tree" */ '@/views/EasyTreeDemo.vue')
  }
]

const router = new VueRouter({
  mode: 'hash',
  routes
})

// 换色隔离：/theme 是运行时换色的演示沙盒——离开该页时把主色重置回系统默认
// （Mintlify 深薄荷），保证 Home/About/UEditor 恒为统一设计风格，不被演示选色污染。
// 用异步 import 避免与 main.js 的初始化次序耦合；reset 为 fire-and-forget 不阻塞导航。
router.afterEach((to, from) => {
  if (from.path === '/theme' && to.path !== '/theme') {
    import('@/theme/ThemeManager').then(m => m.default.reset())
  }
})

export default router
