/**
 * B 服务 - 报表相关接口（前缀 /bapi）
 *
 * 与 A 服务的唯一区别是引入的实例不同；B 后台的响应体字段差异已在
 * src/utils/http.js 的 resolve 里抹平，这里拿到的 data 结构和 A 服务一致。
 */
import { requestB } from '@/utils/http'

export function getReportList (params) {
  return requestB.get('/report/list', { params })
}

export function getReportSummary (params) {
  return requestB.get('/report/summary', { params })
}

/**
 * 导出报表。raw: true 时拦截器返回完整的 axios 响应而不是 data，
 * 因为文件名要从 headers 的 content-disposition 里取。
 */
export function exportReport (params) {
  return requestB.get('/report/export', {
    params,
    responseType: 'blob',
    raw: true,
    timeout: 60000 // 导出比普通接口慢，单独放宽，避免走全局 15s 超时
  })
}

/**
 * 大屏轮询类接口用得上取消：组件 destroyed 时调 source.cancel()，
 * 拦截器识别 axios.isCancel 后静默丢弃，不会弹提示。
 *
 *   import axios from 'axios'
 *   const source = axios.CancelToken.source()
 *   getReportTrend(params, source.token)
 *   // beforeDestroy() { source.cancel() }
 */
export function getReportTrend (params, cancelToken) {
  return requestB.get('/report/trend', { params, cancelToken })
}
