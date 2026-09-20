/**
 * A 服务 - 意见稿及回复管理（前缀 /api）
 *
 * 两个页面共用本文件：
 *   · 总公司端（/document/hq）  发送材料 = 下发意见稿，接收材料 = 各单位回复函
 *   · 子公司端（/document/unit）接收材料 = 收到的意见稿，发送材料 = 本单位回复函
 * 同一份数据，站在两端看方向相反 —— 所以接口按「业务身份」命名（issued / reply），
 * 不按页面上的「发送 / 接收」命名，免得两边对不上。
 *
 * ⚠️ 后端未就绪，当前走本文件底部的 mock。接通真实接口时：
 *   1. 把 USE_MOCK 改成 false
 *   2. 核对下面每个函数里的 url 与后端实际路径
 *   3. 删掉 mock 区（页面代码一行不用改）
 */
import { requestA } from '@/utils/http'

const USE_MOCK = true

/** 左侧单位列表。params: { keyword, year, sort } */
export function getUnitList (params) {
  if (USE_MOCK) return mockUnitList(params)
  return requestA.get('/document/unit/list', { params })
}

/** 下发的意见稿。params: { unitId, docNo, title, startDate, endDate } */
export function getIssuedDocuments (params) {
  if (USE_MOCK) return mockIssued(params)
  return requestA.get('/document/issued/list', { params })
}

/** 各单位的回复函。params 同上 */
export function getReplyDocuments (params) {
  if (USE_MOCK) return mockReply(params)
  return requestA.get('/document/reply/list', { params })
}

/**
 * 「对应函件」候选列表 —— 回复函要挂到哪一份下发函件上。
 * 业务口径是「支持选择国家局外发的函件」，即候选范围不限于本单位收到的那几份。
 */
export function getRelatedDocOptions (params) {
  if (USE_MOCK) return mockIssued({})
  return requestA.get('/document/issued/options', { params })
}

/** 回复函关联到指定下发函件 */
export function bindRelatedDoc (data) {
  if (USE_MOCK) return mockOk()
  return requestA.post('/document/reply/bind', data)
}

/** 「上传到办理环节」 */
export function uploadToProcess (id) {
  if (USE_MOCK) return mockOk()
  return requestA.post('/document/reply/upload-process', { id })
}

/* ══════════════════════════════════════════════════════════════════
 * 以下全部是 mock，接通后端后整段删除
 * ════════════════════════════════════════════════════════════════ */

const UNIT_LIST = [
  { unitId: 'u1', unitName: '华东子公司', sendCount: 8 },
  { unitId: 'u2', unitName: '华南子公司', sendCount: 5 },
  { unitId: 'u3', unitName: '华北子公司', sendCount: 12 },
  { unitId: 'u4', unitName: '西部子公司', sendCount: 3 }
]

// status 取值：有效 / 无效
const ISSUED_LIST = [
  { id: 1, docNo: 'Z-2026-001', unitId: 'u1', unitName: '华东子公司', title: '关于XX项目征求意见稿', status: '有效', sendTime: '2026-03-10', dateLine: '2026-04-10', fromUnit: '国家局', finishTime: '2026-03-28', attach: '意见稿.pdf' },
  { id: 2, docNo: 'Z-2026-002', unitId: 'u3', unitName: '华北子公司', title: '制度修订征求意见稿', status: '有效', sendTime: '2026-04-05', dateLine: '2026-05-10', fromUnit: '国家局', finishTime: '', attach: '制度修订.docx' },
  { id: 3, docNo: 'Z-2026-003', unitId: 'u2', unitName: '华南子公司', title: '预算调整意见稿', status: '无效', sendTime: '2026-05-12', dateLine: '2026-06-10', fromUnit: '国家局', finishTime: '', attach: '预算调整.pdf' }
]

const REPLY_LIST = [
  { id: 1, docNo: 'H-2026-FH01', unitId: 'u1', unitName: '华东子公司', title: '华东子公司关于XX项目的回复函', status: '有效', sendTime: '2026-03-18', fromUnit: '华南子公司', dateLine: '2026-04-10', relatedDocNo: '', attach: '华东回复.pdf' },
  { id: 2, docNo: 'H-2026-FH02', unitId: 'u3', unitName: '华北子公司', title: '华北子公司制度修订回复意见', status: '无效', sendTime: '2026-04-12', fromUnit: '华东子公司', dateLine: '2026-04-10', relatedDocNo: 'Z-2026-002', attach: '华北回复.docx' }
]

// 模拟网络延迟，让页面的 loading 态在开发期也看得见
function delay (data) {
  return new Promise(resolve => setTimeout(() => resolve(deepCopy(data)), 200))
}

function deepCopy (v) {
  return JSON.parse(JSON.stringify(v))
}

function mockOk () {
  return delay({ success: true })
}

/**
 * mock 侧的过滤 —— 只为让筛选条「点了有反应」，真实过滤将来由后端 SQL 做。
 * 页面只管把 params 传下来，这里怎么实现都不影响页面代码。
 */
function matchDoc (row, params) {
  const p = params || {}
  if (p.unitId && row.unitId !== p.unitId) return false
  if (p.docNo && row.docNo.indexOf(p.docNo) === -1) return false
  if (p.title && row.title.indexOf(p.title) === -1) return false
  if (p.startDate && row.sendTime < p.startDate) return false
  if (p.endDate && row.sendTime > p.endDate) return false
  return true
}

function mockUnitList (params) {
  const p = params || {}
  let list = UNIT_LIST.slice()
  if (p.keyword) {
    list = list.filter(u => u.unitName.indexOf(p.keyword) !== -1)
  }
  list.sort((a, b) => (p.sort === 'asc' ? a.sendCount - b.sendCount : b.sendCount - a.sendCount))
  return delay(list)
}

function mockIssued (params) {
  return delay(ISSUED_LIST.filter(r => matchDoc(r, params)))
}

function mockReply (params) {
  return delay(REPLY_LIST.filter(r => matchDoc(r, params)))
}
