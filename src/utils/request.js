/**
 * axios 请求实例工厂（axios 0.24.0）
 *
 * 项目要同时对接多个后台，但它们的差异只集中在三处：接口前缀、鉴权头、响应体字段名。
 * 其余行为（超时、错误提示、取消请求、401 处理）完全一致，所以这里抽成工厂按配置
 * 产出实例，而不是复制多份 axios 配置——加第三个后台时只需在 http.js 里多调一次。
 *
 * 实例统一在 src/utils/http.js 创建，业务代码不直接引用本文件。
 * 整体方案（前缀分流、nginx 配置、前缀剥离的坑）见 docs/多后台接口方案.md
 */
import axios from 'axios'
import { message } from 'ant-design-vue'

const DEFAULT_TIMEOUT = 15000
// 后端约定的成功业务码，与各后台不一致时由 createRequest 的 resolve 覆盖
const SUCCESS_CODE = 200

// HTTP 状态码 -> 中文提示。只列真正需要区分的，其余走 err.message 兜底。
const HTTP_ERROR_TEXT = {
  400: '请求参数有误',
  401: '登录已失效，请重新登录',
  403: '没有该操作权限',
  404: '接口不存在',
  500: '服务器开小差了',
  502: '网关异常',
  503: '服务暂不可用',
  504: '网关超时'
}

/**
 * 默认响应体适配器：把后端返回归一成 { ok, data, msg, code }。
 * 各后台字段名不同（code/status、msg/message）时，在 createRequest 里传自己的 resolve，
 * 把差异全部收在这一层——业务层永远只拿到 data，不感知是哪个后台的格式。
 */
function defaultResolve (body) {
  return {
    ok: body.code === SUCCESS_CODE || body.code === 0,
    data: body.data,
    msg: body.msg || body.message,
    code: body.code
  }
}

// 文件下载（Blob）、纯文本等非 JSON 响应不该被当业务体解包
function isBusinessBody (data) {
  return Object.prototype.toString.call(data) === '[object Object]'
}

/**
 * 构造带业务信息的错误对象，业务层 catch 时可读 err.code / err.msg 做分支。
 * 不用自定义 Error 子类，是为了避免 babel 转 ES5 后 instanceof 失效。
 */
function createError (msg, code, raw) {
  const err = new Error(msg)
  err.code = code
  err.msg = msg
  err.raw = raw
  return err
}

/**
 * @param {object}   options
 * @param {string}   options.name          服务名，只用于错误提示里区分是哪个后台挂了
 * @param {string}   options.baseURL       接口前缀，来自 .env
 * @param {number}   [options.timeout]
 * @param {string}   [options.tokenHeader] 鉴权请求头名，默认 Authorization
 * @param {Function} [options.getToken]    取 token，返回假值则不带鉴权头
 * @param {Function} [options.resolve]     响应体适配器，见 defaultResolve
 * @param {Function} [options.onUnauthorized] 401 回调（跳登录页等），只在拿到 401 时调一次
 */
export default function createRequest (options = {}) {
  const {
    name = '后台服务',
    baseURL = '',
    timeout = DEFAULT_TIMEOUT,
    tokenHeader = 'Authorization',
    getToken,
    resolve = defaultResolve,
    onUnauthorized
  } = options

  const instance = axios.create({ baseURL, timeout })

  instance.interceptors.request.use(config => {
    const token = getToken && getToken()
    if (token) config.headers[tokenHeader] = token
    return config
  })

  instance.interceptors.response.use(
    res => {
      // config.raw 为 true 时把整个响应交给调用方——下载文件要从 headers
      // 里取 content-disposition 拿文件名，只给 data 是不够的
      if (res.config.raw || !isBusinessBody(res.data)) return res

      const { ok, data, msg, code } = resolve(res.data)
      if (ok) return data

      // 业务码级别的 401：HTTP 是 200，但后端在体里说登录失效
      if (code === 401) return handleUnauthorized(msg)

      // config.silent 让调用方自行接管错误提示（表单校验类接口常需要）
      if (!res.config.silent) message.error(`[${name}] ${msg || '请求失败'}`)
      return Promise.reject(createError(msg || '请求失败', code, res))
    },
    err => {
      // 主动取消（路由切走、重复请求覆盖）不是错误，静默吞掉，
      // 且不能 resolve——否则 then 分支会拿着 undefined 继续跑
      if (axios.isCancel(err)) return new Promise(() => {})

      const res = err.response
      if (res && res.status === 401) return handleUnauthorized(HTTP_ERROR_TEXT[401])

      let text
      if (res) {
        text = HTTP_ERROR_TEXT[res.status] || `请求失败(${res.status})`
      } else if (err.code === 'ECONNABORTED') {
        // axios 0.24 的超时走 ECONNABORTED，与断网区分开，提示才有指导意义
        text = `请求超时(${timeout / 1000}s)`
      } else {
        text = '网络异常，请检查网络连接'
      }

      if (!(err.config && err.config.silent)) message.error(`[${name}] ${text}`)
      return Promise.reject(createError(text, res && res.status, err))
    }
  )

  function handleUnauthorized (text) {
    message.error(`[${name}] ${text || HTTP_ERROR_TEXT[401]}`)
    if (onUnauthorized) onUnauthorized()
    // 401 之后页面通常要跳登录，返回永不落定的 Promise，
    // 避免各业务页的 catch 在跳转过程中又弹一轮提示
    return new Promise(() => {})
  }

  return instance
}
