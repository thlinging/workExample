/**
 * 各后台的 axios 实例。新增后台时在这里再调一次 createRequest，
 * 并在 .env.* 里补一个 VUE_APP_BASE_API_XXX 前缀。
 *
 * 只有 VUE_APP_ 开头的变量会被 vue-cli 注入到客户端代码，改名要留意。
 */
import createRequest from './request'

/** A 服务（主后台），前缀 /api */
export const requestA = createRequest({
  name: 'A服务',
  baseURL: process.env.VUE_APP_BASE_API,
  getToken: () => localStorage.getItem('token'),
  onUnauthorized: () => {
    // 项目暂无登录页。接入后在这里清 token 并跳转，例如：
    // localStorage.removeItem('token')
    // router.replace({ name: 'login' })
  }
})

/** B 服务（第二个后台），前缀 /bapi。鉴权与响应体字段和 A 不同，在此收敛差异 */
export const requestB = createRequest({
  name: 'B服务',
  baseURL: process.env.VUE_APP_BASE_API_B,
  getToken: () => localStorage.getItem('token_b'),
  tokenHeader: 'X-Access-Token',
  // 假设 B 后台返回 { status, result, errMsg }，适配成统一结构后
  // 业务层拿到的东西和 A 服务完全一致
  resolve: body => ({
    ok: body.status === 0,
    data: body.result,
    msg: body.errMsg,
    code: body.status
  })
})

// 绝大多数接口走 A 服务，给个默认导出少写一个花括号
export default requestA
