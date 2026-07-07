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
  }
]

const router = new VueRouter({
  mode: 'hash',
  routes
})

export default router
