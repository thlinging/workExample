import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import createRequest from '@/utils/request'

// 拦截器里会弹全局提示，测试环境没有 DOM 容器也不关心样式，整体 stub 掉，
// 顺便可以断言"该提示时提示、该静默时静默"
vi.mock('ant-design-vue', () => ({ message: { error: vi.fn() } }))
import { message } from 'ant-design-vue'

// 用自定义 adapter 而不是 mock 掉整个 axios：这样请求/响应拦截器是真的在跑，
// 测的才是本文件的逻辑。自定义 adapter 需要自己完成 settle（判状态码抛错）。
function mockAdapter (reply) {
  return config => {
    const status = reply.status === undefined ? 200 : reply.status
    const res = {
      data: reply.data,
      status,
      statusText: '',
      headers: reply.headers || {},
      config
    }
    if (status >= 200 && status < 300) return Promise.resolve(res)
    const err = new Error(`Request failed with status code ${status}`)
    err.response = res
    err.config = config
    return Promise.reject(err)
  }
}

// 断言一个 Promise 保持"永不落定"（401 / 主动取消走这条路，
// 目的是不让业务层的 catch 在跳转过程中再弹一轮提示）
function stayPending (promise) {
  return Promise.race([
    promise.then(() => 'settled', () => 'settled'),
    new Promise(resolve => setTimeout(() => resolve('pending'), 20))
  ])
}

const okBody = { code: 200, data: { id: 1 }, msg: 'ok' }

beforeEach(() => {
  message.error.mockClear()
})

describe('createRequest 响应处理', () => {
  it('成功时只把业务 data 交给调用方', async () => {
    const request = createRequest({ baseURL: '/api' })
    const data = await request.get('/user/1', { adapter: mockAdapter({ data: okBody }) })

    expect(data).toEqual({ id: 1 })
    expect(message.error).not.toHaveBeenCalled()
  })

  it('业务码失败时 reject，并带上 code / msg 供业务分支使用', async () => {
    const request = createRequest({ name: 'A服务', baseURL: '/api' })
    const body = { code: 5001, msg: '库存不足' }

    await expect(
      request.get('/order', { adapter: mockAdapter({ data: body }) })
    ).rejects.toMatchObject({ code: 5001, msg: '库存不足' })

    expect(message.error).toHaveBeenCalledWith('[A服务] 库存不足')
  })

  it('silent 请求不弹全局提示，交给调用方自行处理', async () => {
    const request = createRequest({ baseURL: '/api' })
    const body = { code: 5001, msg: '用户名已存在' }

    await request
      .get('/user/check-name', { silent: true, adapter: mockAdapter({ data: body }) })
      .catch(err => expect(err.msg).toBe('用户名已存在'))

    expect(message.error).not.toHaveBeenCalled()
  })

  it('raw 请求返回完整响应，以便从 headers 取下载文件名', async () => {
    const request = createRequest({ baseURL: '/bapi' })
    const headers = { 'content-disposition': 'attachment; filename=report.xlsx' }
    const res = await request.get('/report/export', {
      raw: true,
      headers: {},
      adapter: mockAdapter({ data: okBody, headers })
    })

    expect(res.headers['content-disposition']).toContain('report.xlsx')
    expect(res.data).toBe(okBody)
  })

  it('非 JSON 响应（Blob）不被当业务体解包', async () => {
    const request = createRequest({ baseURL: '/bapi' })
    const blob = new Blob(['x'])
    const res = await request.get('/report/export', { adapter: mockAdapter({ data: blob }) })

    expect(res.data).toBe(blob)
  })

  it('自定义 resolve 能抹平另一个后台的字段差异', async () => {
    // B 后台用 { status, result, errMsg }，业务层拿到的仍是纯 data
    const request = createRequest({
      baseURL: '/bapi',
      resolve: body => ({ ok: body.status === 0, data: body.result, msg: body.errMsg, code: body.status })
    })
    const data = await request.get('/report/list', {
      adapter: mockAdapter({ data: { status: 0, result: [1, 2], errMsg: '' } })
    })

    expect(data).toEqual([1, 2])
  })
})

describe('createRequest 鉴权与前缀', () => {
  it('token 写入指定的请求头，baseURL 取配置值', async () => {
    let sent
    const request = createRequest({
      baseURL: '/bapi',
      tokenHeader: 'X-Access-Token',
      getToken: () => 'token-b'
    })
    await request.get('/report/list', {
      adapter: config => {
        sent = config
        return mockAdapter({ data: okBody })(config)
      }
    })

    expect(sent.headers['X-Access-Token']).toBe('token-b')
    expect(sent.baseURL).toBe('/bapi')
  })

  it('取不到 token 时不带鉴权头', async () => {
    let sent
    const request = createRequest({ baseURL: '/api', getToken: () => null })
    await request.get('/public', {
      adapter: config => {
        sent = config
        return mockAdapter({ data: okBody })(config)
      }
    })

    expect(sent.headers.Authorization).toBeUndefined()
  })
})

describe('createRequest 异常分支', () => {
  it('HTTP 错误码转成中文提示，并带上服务名', async () => {
    const request = createRequest({ name: 'B服务', baseURL: '/bapi' })

    await expect(
      request.get('/report', { adapter: mockAdapter({ status: 500 }) })
    ).rejects.toMatchObject({ code: 500 })

    expect(message.error).toHaveBeenCalledWith('[B服务] 服务器开小差了')
  })

  it('超时（ECONNABORTED）与断网提示区分开', async () => {
    const request = createRequest({ name: 'A服务', baseURL: '/api', timeout: 3000 })
    const timeoutAdapter = () => {
      const err = new Error('timeout of 3000ms exceeded')
      err.code = 'ECONNABORTED'
      return Promise.reject(err)
    }

    await expect(request.get('/slow', { adapter: timeoutAdapter })).rejects.toThrow('请求超时(3s)')
    expect(message.error).toHaveBeenCalledWith('[A服务] 请求超时(3s)')
  })

  it('无响应时提示网络异常', async () => {
    const request = createRequest({ name: 'A服务', baseURL: '/api' })
    const offlineAdapter = () => Promise.reject(new Error('Network Error'))

    await expect(request.get('/any', { adapter: offlineAdapter })).rejects.toThrow('网络异常，请检查网络连接')
  })

  it('HTTP 401 触发 onUnauthorized，且 Promise 不落定', async () => {
    const onUnauthorized = vi.fn()
    const request = createRequest({ name: 'A服务', baseURL: '/api', onUnauthorized })

    const state = await stayPending(request.get('/user', { adapter: mockAdapter({ status: 401 }) }))

    expect(state).toBe('pending')
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(message.error).toHaveBeenCalledWith('[A服务] 登录已失效，请重新登录')
  })

  it('业务码 401（HTTP 200）同样触发 onUnauthorized', async () => {
    const onUnauthorized = vi.fn()
    const request = createRequest({ baseURL: '/api', onUnauthorized })
    const body = { code: 401, msg: 'token 已过期' }

    const state = await stayPending(request.get('/user', { adapter: mockAdapter({ data: body }) }))

    expect(state).toBe('pending')
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('主动取消不弹提示、不落定，避免组件销毁后仍走 catch', async () => {
    const request = createRequest({ baseURL: '/api' })
    const cancelAdapter = () => Promise.reject(new axios.Cancel('canceled'))

    const state = await stayPending(request.get('/trend', { adapter: cancelAdapter }))

    expect(state).toBe('pending')
    expect(message.error).not.toHaveBeenCalled()
  })
})
