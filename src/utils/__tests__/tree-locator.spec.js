import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTreeLocator, pathOfNode } from '@/utils/tree-locator'

/*
 * 用一个最小的假树替身跑逻辑分支——真组件跑不了：RecycleScroller 在 jsdom 里
 * 拿不到 clientHeight，虚拟列表也不会真渲染。这里只验 tree-locator 自己的决策：
 * 路径归一化、三级兜底、lazy 展开的等待与超时、移动时对新父的四种处理。
 */

// 造一个带 parent 链的假 Node
function makeNode(key, parent, opts = {}) {
  const node = {
    key,
    data: { id: key, name: String(key) },
    parent,
    level: parent ? parent.level + 1 : 0,
    expanded: false,
    loaded: opts.loaded !== undefined ? opts.loaded : true,
    loading: !!opts.loading,
    childNodes: [],
    shouldLoadData() {
      return !this.loaded
    },
    expand(cb) {
      // 复刻真实行为：正在 load 时重复调用会被静默忽略，回调永不执行
      if (this.loading) return
      if (!this.loaded) {
        this.loading = true
        setTimeout(() => {
          this.loading = false
          this.loaded = true
          this.expanded = true
          if (cb) cb()
        }, opts.loadDelay || 10)
        return
      }
      this.expanded = true
      if (cb) cb()
    }
  }
  if (parent) parent.childNodes.push(node)
  return node
}

// 假 ve-tree 实例：只实现 tree-locator 用到的那部分
function makeTree({ keys = ['a', 'b', 'c'], virtual = true, itemSize = 26 } = {}) {
  const nodesMap = Object.create(null)
  const root = { key: undefined, level: 0, childNodes: [], data: null }

  keys.forEach(k => {
    nodesMap[k] = makeNode(k, root)
  })

  const tree = {
    height: virtual ? '400px' : 0,
    itemSize,
    dataList: keys.map(k => nodesMap[k]),
    store: {
      key: 'id',
      nodesMap,
      root,
      updateChildren: vi.fn(),
      append: vi.fn()
    },
    $el: {
      classList: { add: vi.fn(), remove: vi.fn() },
      offsetWidth: 0,
      querySelector: () => tree._scroller
    },
    $children: [],
    $nextTick: () => Promise.resolve(),
    setCurrentKey: vi.fn(),
    remove: vi.fn(),
    append: vi.fn(),
    _scroller: { scrollTop: 0, clientHeight: 260 }
  }
  return tree
}

beforeEach(() => {
  // 让 nextFrame 立刻结算，避免每个用例都要真等一帧
  vi.stubGlobal('requestAnimationFrame', cb => setTimeout(cb, 0))
})

describe('pathOfNode', () => {
  it('回溯出根在前、不含自身的祖先链', () => {
    const root = { key: undefined, level: 0, parent: null, childNodes: [] }
    const a = makeNode('a', root)
    const b = makeNode('b', a)
    const c = makeNode('c', b)
    expect(pathOfNode(c)).toEqual(['a', 'b'])
  })

  it('根级节点的祖先链为空', () => {
    const root = { key: undefined, level: 0, parent: null, childNodes: [] }
    expect(pathOfNode(makeNode('a', root))).toEqual([])
  })
})

describe('path 归一化', () => {
  it('逗号串、斜杠串、数组都收，并滤掉虚拟根 0', async () => {
    for (const input of ['0,a,b', '0/a/b', ['0', 'a', 'b']]) {
      const tree = makeTree({ keys: ['a', 'b', 'c'] })
      const locator = createTreeLocator(() => tree)
      const r = await locator.locate('c', { path: input, highlight: false })
      expect(r.ok, `输入 ${JSON.stringify(input)}`).toBe(true)
      expect(tree.store.nodesMap.a.expanded).toBe(true)
      expect(tree.store.nodesMap.b.expanded).toBe(true)
    }
  })

  it('祖先链含自身时会去掉末尾，不会把自己也展开一遍', async () => {
    const tree = makeTree({ keys: ['a', 'b', 'c'] })
    const locator = createTreeLocator(() => tree)
    const r = await locator.locate('c', { path: '0,a,b,c', highlight: false })
    expect(r.ok).toBe(true)
    expect(tree.store.nodesMap.c.expanded).toBe(false)
  })

  it('树里 id 是数字时，字符串祖先链会被对齐成数字', async () => {
    const tree = makeTree({ keys: [1, 2, 3] })
    const locator = createTreeLocator(() => tree)
    // 后端 ancestors always 是字符串，这里必须转成数字才能命中 dataList 的严格相等
    const r = await locator.locate(3, { path: '0,1,2', highlight: false })
    expect(r.ok).toBe(true)
    expect(r.index).toBe(2)
  })

  it('rootPlaceholders 置空后不再过滤 0', async () => {
    const tree = makeTree({ keys: ['0', 'a'] })
    const locator = createTreeLocator(() => tree, { rootPlaceholders: [] })
    const r = await locator.locate('a', { path: '0', highlight: false })
    expect(r.ok).toBe(true)
    expect(tree.store.nodesMap['0'].expanded).toBe(true)
  })

  it('不传 path 且节点不在树上时返回 no-path', async () => {
    const tree = makeTree()
    const locator = createTreeLocator(() => tree)
    expect((await locator.locate('missing')).reason).toBe('no-path')
  })
})

describe('懒加载展开', () => {
  it('等 load 完成后才继续下一级', async () => {
    const tree = makeTree({ keys: ['a', 'b'] })
    tree.store.nodesMap.a.loaded = false
    const locator = createTreeLocator(() => tree)

    const r = await locator.locate('b', { path: ['a'], highlight: false })
    expect(r.ok).toBe(true)
    expect(tree.store.nodesMap.a.loaded).toBe(true)
  })

  it('节点正在 load 时不会挂死（expand 的回调此时不会触发）', async () => {
    const tree = makeTree({ keys: ['a', 'b'] })
    const a = tree.store.nodesMap.a
    a.loaded = false
    a.loading = true
    // 模拟这次 load 在 80ms 后结束
    setTimeout(() => {
      a.loading = false
      a.loaded = true
    }, 80)

    const locator = createTreeLocator(() => tree)
    const r = await locator.locate('b', { path: ['a'], highlight: false, loadTimeout: 1000 })
    expect(r.ok).toBe(true)
    expect(a.expanded).toBe(true)
  })

  it('load 迟迟不回来时按 timeout 失败并指出卡在哪一级', async () => {
    const tree = makeTree({ keys: ['a', 'b'] })
    const a = tree.store.nodesMap.a
    a.loaded = false
    a.loading = true // 永远不结束

    const locator = createTreeLocator(() => tree)
    const r = await locator.locate('b', { path: ['a'], highlight: false, loadTimeout: 120 })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('timeout')
    expect(r.at).toBe('a')
  })

  it('祖先链里有一级不在 nodesMap 时返回 path-broken', async () => {
    const tree = makeTree({ keys: ['a', 'b'] })
    const locator = createTreeLocator(() => tree)
    const r = await locator.locate('b', { path: ['a', 'ghost'], highlight: false })
    expect(r.reason).toBe('path-broken')
    expect(r.at).toBe('ghost')
  })
})

describe('滚动定位', () => {
  it('align=center 把目标滚到视口中部', async () => {
    const tree = makeTree({ keys: ['a', 'b', 'c', 'd', 'e'], itemSize: 26 })
    const locator = createTreeLocator(() => tree)
    await locator.locate('e', { path: [], align: 'center', highlight: false })
    // index 4 * 26 - (260 - 26) / 2 = 104 - 117 → 负数被夹到 0
    expect(tree._scroller.scrollTop).toBe(0)

    const tall = makeTree({ keys: Array.from({ length: 50 }, (_, i) => `n${i}`) })
    const l2 = createTreeLocator(() => tall)
    await l2.locate('n40', { path: [], align: 'center', highlight: false })
    expect(tall._scroller.scrollTop).toBe(40 * 26 - (260 - 26) / 2)
  })

  it('align=top 把目标滚到顶部', async () => {
    const tree = makeTree({ keys: Array.from({ length: 50 }, (_, i) => `n${i}`) })
    const locator = createTreeLocator(() => tree)
    await locator.locate('n10', { path: [], align: 'top', highlight: false })
    expect(tree._scroller.scrollTop).toBe(10 * 26)
  })

  it('展开成功但目标不在列表里时返回 not-found', async () => {
    const tree = makeTree({ keys: ['a'] })
    tree.store.nodesMap.b = makeNode('b', tree.store.root) // 在 map 里但不在 dataList
    const locator = createTreeLocator(() => tree)
    expect((await locator.locate('b', { highlight: false })).reason).toBe('not-found')
  })
})

describe('applyMove', () => {
  function setup(overrides = {}) {
    const tree = makeTree({ keys: ['p1', 'p2', 'x'] })
    Object.assign(tree.store.nodesMap.p2, overrides)
    const locator = createTreeLocator(() => tree)
    return { tree, locator }
  }

  it('父级没变时走快路径：只改数据，不动树结构', async () => {
    const { tree, locator } = setup()
    await locator.applyMove({
      data: { id: 'x', name: '改了名' },
      oldParentId: 'p1',
      newParentId: 'p1',
      path: ['p1']
    })
    expect(tree.remove).not.toHaveBeenCalled()
    expect(tree.append).not.toHaveBeenCalled()
    expect(tree.store.nodesMap.x.data.name).toBe('改了名')
  })

  it('null 与 0 都表示根级，二者之间移动仍算没变', async () => {
    const { tree, locator } = setup()
    await locator.applyMove({
      data: { id: 'x', name: 'n' },
      oldParentId: null,
      newParentId: '0',
      path: []
    })
    expect(tree.remove).not.toHaveBeenCalled()
  })

  it('给了 siblings 就用 updateChildren 保证顺序', async () => {
    const { tree, locator } = setup()
    const siblings = [{ id: 'x', name: 'n' }]
    await locator.applyMove({
      data: { id: 'x', name: 'n' },
      oldParentId: 'p1',
      newParentId: 'p2',
      path: ['p2'],
      siblings
    })
    expect(tree.remove).toHaveBeenCalled()
    expect(tree.store.updateChildren).toHaveBeenCalledWith('p2', siblings)
  })

  it('没给 siblings 只能 append，并回报 orderUnknown', async () => {
    const { tree, locator } = setup()
    const r = await locator.applyMove({
      data: { id: 'x', name: 'n' },
      oldParentId: 'p1',
      newParentId: 'p2',
      path: ['p2']
    })
    expect(tree.append).toHaveBeenCalled()
    expect(r.orderUnknown).toBe(true)
  })

  it('新父还没 load 过时不动它，交给展开时自然拉取', async () => {
    const { tree, locator } = setup({ loaded: false })
    await locator.applyMove({
      data: { id: 'x', name: 'n' },
      oldParentId: 'p1',
      newParentId: 'p2',
      path: ['p2'],
      siblings: [{ id: 'x', name: 'n' }]
    })
    expect(tree.store.updateChildren).not.toHaveBeenCalled()
    expect(tree.append).not.toHaveBeenCalled()
  })

  it('移到根级：懒加载树的 root.data 是 undefined，也不能崩', async () => {
    const { tree, locator } = setup()
    // 复刻真实情况：lazy 树不传 data prop，root.data 就是 undefined，
    // 而 Node.getChildren 对 level 0 直接 return this.data，insertChild 随即
    // 对它调 indexOf —— 不兜底就是 TypeError
    tree.store.root.data = undefined
    tree.append = vi.fn(() => {
      const children = tree.store.root.data
      children.indexOf(null) // 没兜底的话这里抛 TypeError
    })

    const r = await locator.applyMove({
      data: { id: 'x', name: 'n' },
      oldParentId: 'p1',
      newParentId: null,
      path: []
    })
    expect(r.reason).not.toBe('structure-error')
    expect(Array.isArray(tree.store.root.data)).toBe(true)
    expect(r.orderUnknown).toBe(true)
  })

  it('结构操作抛错时转成 structure-error，不往外抛', async () => {
    const { tree, locator } = setup()
    tree.remove = vi.fn(() => {
      throw new Error('boom')
    })
    const r = await locator.applyMove({
      data: { id: 'x', name: 'n' },
      oldParentId: 'p1',
      newParentId: 'p2',
      path: ['p2']
    })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('structure-error')
    expect(r.error.message).toBe('boom')
  })

  it('新父不在树上时同样跳过', async () => {
    const { tree, locator } = setup()
    await locator.applyMove({
      data: { id: 'x', name: 'n' },
      oldParentId: 'p1',
      newParentId: 'not-loaded-branch',
      path: []
    })
    expect(tree.store.updateChildren).not.toHaveBeenCalled()
    expect(tree.append).not.toHaveBeenCalled()
  })
})

describe('cancel / 并发', () => {
  it('后发起的定位会作废前一个', async () => {
    const tree = makeTree({ keys: ['a', 'b'] })
    tree.store.nodesMap.a.loaded = false
    const locator = createTreeLocator(() => tree)

    const first = locator.locate('b', { path: ['a'], highlight: false })
    const second = locator.locate('b', { path: [], highlight: false })

    expect((await first).reason).toBe('aborted')
    expect((await second).ok).toBe(true)
  })

  it('cancel 后进行中的定位不再操作树', async () => {
    const tree = makeTree({ keys: ['a', 'b'] })
    tree.store.nodesMap.a.loaded = false
    const locator = createTreeLocator(() => tree)

    const pending = locator.locate('b', { path: ['a'], highlight: false })
    locator.cancel()
    expect((await pending).reason).toBe('aborted')
    expect(tree.setCurrentKey).not.toHaveBeenCalled()
  })
})

describe('keepViewport', () => {
  it('结构变化后按锚点还原滚动位置', async () => {
    const keys = Array.from({ length: 50 }, (_, i) => `n${i}`)
    const tree = makeTree({ keys })
    tree._scroller.scrollTop = 20 * 26 // 锚点 n20 正好在视口顶部
    const locator = createTreeLocator(() => tree)

    await locator.keepViewport(() => {
      // 模拟锚点之前少了两行，锚点整体上移
      tree.dataList = tree.dataList.filter(n => n.key !== 'n1' && n.key !== 'n2')
    }, 'n20')

    // n20 现在是第 18 行，视口偏移保持不变
    expect(tree._scroller.scrollTop).toBe(18 * 26)
  })
})
