/**
 * A 服务 - 用户相关接口（前缀 /api）
 *
 * 业务组件只 import 这里的函数，不感知请求走的是哪个后台。
 * 将来 B 服务并入 A，改的也只是 api 层的 import，页面一行不动。
 */
import { requestA } from '@/utils/http'

export function getUserList (params) {
  return requestA.get('/user/list', { params })
}

export function getUserDetail (id) {
  return requestA.get(`/user/${id}`)
}

export function saveUser (data) {
  return requestA.post('/user/save', data)
}

export function removeUser (id) {
  return requestA.delete(`/user/${id}`)
}

/**
 * silent: true 让拦截器不弹全局提示，由调用方自己处理错误。
 * 校验类接口（用户名重复、验证码错误）需要就地提示在表单上，不适合弹 message。
 */
export function checkUserName (userName) {
  return requestA.get('/user/check-name', { params: { userName }, silent: true })
}
