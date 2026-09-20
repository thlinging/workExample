/**
 * tree-locator —— 给 vue-easy-tree / element el-tree 用的「定位 + 移动后跟随」工具
 *
 * 解决的问题：懒加载树里编辑一个节点、并且可能把它挂到别的父级下，保存后要让它
 * 重新出现在用户视野里——祖先链可能整条都没加载过，得逐级 load 再滚过去。
 *
 * 设计取向：
 *   · 纯 JS，不依赖 Vue、不依赖本项目任何东西，拷到别的工程直接能用；
 *   · 只要求调用方能给出 ve-tree 实例（传 getter，所以外面包几层封装都无所谓）；
 *   · 虚拟滚动树和普通树都支持，从实例上自行判断，调用方不用关心；
 *   · 所有失败都通过返回值告知（{ ok:false, reason }），不抛异常、不硬滚。
 *
 * 核心是 locate()——「编辑后定位」「搜索结果定位」「URL 带 id 进来定位」本质是同一件事，
 * applyMove() 只是在它前面加了一段局部增删。
 *
 * 依赖的组件内部实现（升级 vue-easy-tree 时需要复核这几个）：
 *   tree.store.nodesMap / tree.store.key / tree.dataList / tree.itemSize / tree.height
 *   tree.remove() / tree.append() / tree.setCurrentKey() / store.updateChildren()
 *   node.expand(cb) / node.loadData() / node.shouldLoadData() / node.loaded / node.loading
 */

const DEFAULTS = {
  // 'center' 把目标滚到视口中部，'top' 滚到顶部。跨父级移动后 center 更容易找到目标
  align: 'center',
  // 定位后让目标行闪一下。虚拟滚动下 DOM 会复用，所以 class 挂在树根上，靠 .is-current 选中目标
  highlight: true,
  flashClass: 've-locating',
  flashDuration: 1600,
  // 设为当前节点。注意 store.remove() 会把 currentNode 置空，移动后必须重设
  setCurrent: true,
  // 单级 lazy load 的等待上限，超时返回 { ok:false, reason:'timeout' }
  loadTimeout: 10000,
  // 祖先链里代表「虚拟根」的占位 id。若依那套 sys_dept.ancestors 是 "0,100,101"，
  // 那个 0 在前端 nodesMap 里并不存在，不滤掉会让展开在第一级就断掉。
  // 如果你的树真有 id 为 0 的节点，传 [] 关掉这个过滤。
  rootPlaceholders: ['0']
}

/* ────────────────────────────────────────────────────────────────
 * 内部工具
 * ──────────────────────────────────────────────────────────────── */

// 等待某个条件成立。用于「节点正在 load」的场景，见 expandNode 的注释
function waitUntil(check, timeout, interval = 50) {
  return new Promise(resolve => {
    const start = Date.now()
    const tick = () => {
      if (check()) return resolve(true)
      if (Date.now() - start >= timeout) return resolve(false)
      setTimeout(tick, interval)
    }
    tick()
  })
}

function fail(reason, extra) {
  return Object.assign({ ok: false, reason }, extra)
}

function isVirtual(tree) {
  // ve-tree 的模板里就是靠 height 决定走 RecycleScroller 还是普通渲染
  return !!tree.height
}

function itemSizeOf(tree) {
  return tree.itemSize || 26
}

// RecycleScroller 的滚动容器。优先按组件名找（与组件自己的 scrollToItem 实现一致），
// 拿不到再退回 DOM 查询——后者在组件内部结构调整后更容易失效，故作为兜底
function getScroller(tree) {
  const vm = (tree.$children || []).find(c => c.$options && c.$options.name === 'RecycleScroller')
  if (vm && vm.$el) return vm.$el
  return tree.$el ? tree.$el.querySelector('.vue-recycle-scroller') : null
}

// 从树上取一个样本 key，用来判断 id 的真实类型（见 alignKeyType）
function sampleKey(tree) {
  const list = tree.dataList
  if (list && list.length) return list[0].key
  const map = tree.store && tree.store.nodesMap
  if (map) {
    const first = Object.keys(map)[0]
    if (first !== undefined) return map[first].key
  }
  return undefined
}

/**
 * 把祖先链里的 id 对齐成树里 id 的真实类型。
 *
 * 这是最容易翻车的一步：后端的 ancestors 是字符串（"1,33"），split 出来全是 string；
 * 而 id 字段在 JSON 里常常是 number。nodesMap 是普通对象、键会自动转字符串，所以
 * nodesMap[key] 取得到，让人误以为没问题；但最后定位那一步
 * dataList.findIndex(n => n.key === key) 用的是严格相等，类型不一致直接 -1，
 * 症状是「展开全对了就是滚不过去」，且不报错。
 */
function alignKeyType(keys, tree) {
  const sample = sampleKey(tree)
  if (typeof sample === 'number') return keys.map(Number)
  if (typeof sample === 'string') return keys.map(String)
  return keys
}

// 收下三种形态的祖先链：数组、逗号串、斜杠串
function parseRawPath(input, rootPlaceholders) {
  const arr = Array.isArray(input) ? input : String(input).split(/[,/]/)
  return arr
    .map(s => (typeof s === 'string' ? s.trim() : s))
    .filter(s => s !== '' && s !== null && s !== undefined)
    .filter(s => rootPlaceholders.indexOf(String(s)) === -1)
}

/**
 * 从一个 Node 往上回溯出祖先链（根在前，不含自身）。
 * 单独导出是给「下拉树选父级」用的：用户在下拉树里点了新父，那一刻就能算出 path，
 * 不必等后端给 ancestors。两棵树是不同实例没关系，这里只取 key。
 */
export function pathOfNode(node) {
  const keys = []
  let p = node
  while (p && p.level > 0) {
    keys.unshift(p.key)
    p = p.parent
  }
  // 传进来的节点自身也被收进去了，祖先链要去掉它
  keys.pop()
  return keys
}

/**
 * 安全地展开一个节点，并等到它的子级真正 load 完。
 *
 * ⚠️ 不能直接 new Promise(r => node.expand(r))：Node.loadData 里有
 *    `(!this.loading || Object.keys(defaultProps).length)` 这个判断——节点正在
 *    load 时再调一次 expand()，整个分支被静默跳过，回调永远不会执行，await 就挂死了。
 *    所以正在 load 的情况要单独等 loaded 翻转，另外再加一层超时兜底。
 */
function expandNode(node, timeout) {
  // 非懒加载、或已经 load 过：直接置展开态即可，不必走 expand() 那套回调
  if (typeof node.shouldLoadData !== 'function' || !node.shouldLoadData()) {
    node.expanded = true
    return Promise.resolve(true)
  }

  if (node.loading) {
    return waitUntil(() => node.loaded, timeout).then(ok => {
      if (ok) node.expanded = true
      return ok
    })
  }

  return new Promise(resolve => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      resolve(false)
    }, timeout)

    node.expand(() => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(true)
    })
  })
}

// 快照 / 还原展开态。updateChildren 内部是「先 remove 所有孩子再逐个 append」，
// 会把这一层子孙的展开态一起抹掉，故在它前后各调一次
function snapshotExpanded(tree) {
  const map = tree.store && tree.store.nodesMap
  if (!map) return []
  return Object.keys(map).filter(k => map[k].expanded).map(k => map[k].key)
}

function restoreExpanded(tree, keys) {
  const map = tree.store && tree.store.nodesMap
  if (!map) return
  keys.forEach(k => {
    const node = map[k]
    // 直接赋值而不是逐个 expand()：这里只是恢复视图状态，不需要触发 lazy load，
    // 也不该派发 n 次 node-expand 事件
    if (node) node.expanded = true
  })
}

/**
 * 让「append 到根」可用。
 *
 * 懒加载树通常不传 data prop，于是 store.root.data 是 undefined；
 * 而 Node.getChildren 对 level 0 的节点直接 `return this.data`（node.js:441），
 * insertChild 拿到后立刻 `children.indexOf(...)`（node.js:240）——直接抛
 * TypeError: Cannot read properties of undefined (reading 'indexOf')。
 *
 * 补一个与现有子节点一致的数组即可：既让 insertChild 能 push，
 * 又不会因为数组是空的而把已有根节点当成重复项。
 */
function ensureRootData(tree) {
  const root = tree.store && tree.store.root
  if (!root) return
  if (!Array.isArray(root.data)) {
    root.data = (root.childNodes || []).map(n => n.data)
  }
}

function sameId(a, b) {
  if (a === null || a === undefined) return b === null || b === undefined
  return String(a) === String(b)
}

// 「挂在根下」的多种表达：null / undefined，以及后端惯用的虚拟根 id（若依是 '0'）。
// 不统一处理的话，parentId 传 '0' 会被当成「找不到 id 为 0 的父节点」而静默跳过，
// 节点就从树上消失了
function makeIsRoot(rootPlaceholders) {
  return function isRoot(id) {
    if (id === null || id === undefined || id === '') return true
    return rootPlaceholders.indexOf(String(id)) !== -1
  }
}

/* ────────────────────────────────────────────────────────────────
 * 工厂
 * ──────────────────────────────────────────────────────────────── */

/**
 * @param {Function|Object} treeRef ve-tree 实例，或返回实例的 getter（推荐后者：
 *        树可能在你的封装里、也可能还没挂载，getter 每次现取最稳）
 * @param {Object} options 见 DEFAULTS
 */
export function createTreeLocator(treeRef, options = {}) {
  const defaults = Object.assign({}, DEFAULTS, options)
  const isRoot = makeIsRoot(defaults.rootPlaceholders)

  // 递增序号，用来作废上一次尚未完成的定位（用户连点、或定位途中又发起了新的定位）
  let seq = 0
  let flashTimer = null

  function resolveTree() {
    const tree = typeof treeRef === 'function' ? treeRef() : treeRef
    // 组件销毁后 $el 会留着但 store 没了，一并判掉
    if (!tree || !tree.store) return null
    return tree
  }

  /**
   * 解析出「要逐级展开的祖先链」。
   * 优先用显式传入的（后端 ancestors，或下拉树用 pathOfNode 算出来的）；
   * 没有就看目标节点是不是已经在树上，是的话直接回溯。
   */
  function resolvePath(tree, key, input, opts) {
    if (input !== undefined && input !== null && input !== '') {
      let keys = parseRawPath(input, opts.rootPlaceholders)
      keys = alignKeyType(keys, tree)
      // 兼容后端两种约定：ancestors 含不含自身都能用
      if (keys.length && sameId(keys[keys.length - 1], key)) keys.pop()
      return keys
    }
    const node = tree.store.nodesMap[key]
    if (node) return pathOfNode(node)
    return null
  }

  function scrollToKey(tree, key, align) {
    if (isVirtual(tree)) {
      const list = tree.dataList || []
      const index = list.findIndex(n => n.key === key)
      if (index === -1) return fail('not-found')

      const scroller = getScroller(tree)
      if (!scroller) return fail('no-scroller')

      const size = itemSizeOf(tree)
      let top = index * size
      if (align === 'center') {
        top -= Math.max(0, (scroller.clientHeight - size) / 2)
      }
      scroller.scrollTop = Math.max(0, top)
      return { ok: true, index }
    }

    // 普通渲染：没有扁平列表可算下标，只能找到对应的节点组件再 scrollIntoView
    const el = findNodeEl(tree, key)
    if (!el) return fail('not-found')
    el.scrollIntoView({ block: align === 'center' ? 'center' : 'start' })
    return { ok: true, index: -1 }
  }

  // 在组件树里找 key 对应的节点组件的 DOM（仅普通渲染模式需要）
  function findNodeEl(tree, key) {
    let found = null
    const walk = vm => {
      if (found || !vm) return
      if (vm.node && vm.node.key === key && vm.$el) {
        found = vm.$el
        return
      }
      const children = vm.$children || []
      children.forEach(walk)
    }
    walk(tree)
    return found
  }

  function flash(tree, opts) {
    const el = tree.$el
    if (!el) return
    clearTimeout(flashTimer)
    el.classList.remove(opts.flashClass)
    // 强制回流，否则连续两次定位同一行时动画不会重播
    void el.offsetWidth
    el.classList.add(opts.flashClass)
    flashTimer = setTimeout(() => {
      el.classList.remove(opts.flashClass)
    }, opts.flashDuration)
  }

  /**
   * 把某个节点展开出来并滚进视野。
   *
   * @param {String|Number} key 目标节点的 node-key 值
   * @param {Object} opts { path, align, highlight, setCurrent, loadTimeout }
   *        path 可以是数组、逗号串、斜杠串；含不含自身都行；不传则尝试从树上回溯
   * @returns {Promise<{ok:boolean, index?:number, reason?:string, at?:*}>}
   *        reason: no-tree | no-path | path-broken | timeout | aborted | not-found | no-scroller
   */
  async function locate(key, opts = {}) {
    const o = Object.assign({}, defaults, opts)
    const token = ++seq

    let tree = resolveTree()
    if (!tree) return fail('no-tree')

    const path = resolvePath(tree, key, o.path, o)
    if (path === null) return fail('no-path')

    // 逐级展开。必须串行：上一级 load 完，下一级的节点才会出现在 nodesMap 里
    for (let i = 0; i < path.length; i++) {
      if (token !== seq) return fail('aborted')
      tree = resolveTree()
      if (!tree) return fail('no-tree')

      const node = tree.store.nodesMap[path[i]]
      // 上一级 load 回来的孩子里没有这一级 —— 通常是别人同时改了数据
      if (!node) return fail('path-broken', { at: path[i] })

      const ok = await expandNode(node, o.loadTimeout)
      if (!ok) return fail('timeout', { at: path[i] })
    }

    tree = resolveTree()
    if (!tree) return fail('no-tree')

    // 等 dataList 重算 + RecycleScroller 完成一次渲染，否则算出来的下标是旧的
    await tree.$nextTick()
    await nextFrame()
    if (token !== seq) return fail('aborted')

    tree = resolveTree()
    if (!tree) return fail('no-tree')

    if (o.setCurrent && typeof tree.setCurrentKey === 'function') {
      tree.setCurrentKey(key)
    }

    const result = scrollToKey(tree, key, o.align)
    if (!result.ok) return result

    // 高亮依赖 .is-current，setCurrent 关掉时它也就没有落点了
    if (o.highlight && o.setCurrent) flash(tree, o)

    return result
  }

  /**
   * 节点编辑保存后调用：先把树上的结构改对，再定位过去。
   *
   * 只动受影响的两个分支，绝不整树刷新——懒加载树重建等于把用户展开的所有分支清零。
   *
   * @param {Object} payload
   *   - data         编辑后的节点数据（至少要含 node-key 字段）
   *   - key          可选，默认从 data 里按 store.key 取
   *   - oldParentId  移动前的父 id（根级传 null）
   *   - newParentId  移动后的父 id（根级传 null）
   *   - path         新位置的祖先链，同 locate 的 path
   *   - siblings     可选，新父下的完整子级列表（后端返回）。给了就能保证顺序正确
   * @returns {Promise<Object>} locate 的返回值，外加 orderUnknown（见下）
   */
  async function applyMove(payload) {
    const tree = resolveTree()
    if (!tree) return fail('no-tree')

    const { data, oldParentId, newParentId, path, siblings } = payload
    const key = payload.key !== undefined ? payload.key : data[tree.store.key]

    // 快路径：父级没变，就地改数据即可。不动树结构 = 滚动位置、展开态、勾选态全部零抖动。
    // 两边都指向根时也算没变（一边给 null、一边给 '0' 的情况很常见）
    const sameParent = (isRoot(oldParentId) && isRoot(newParentId)) ||
      sameId(oldParentId, newParentId)
    if (sameParent) {
      const node = tree.store.nodesMap[key]
      if (node) Object.assign(node.data, data)
      return locate(key, { path })
    }

    let orderUnknown = false
    const toRoot = isRoot(newParentId)
    const newParent = toRoot ? null : tree.store.nodesMap[newParentId]

    // 结构操作包一层：本模块对外承诺「不抛异常，失败都在返回值里」，
    // 但 store 的增删是组件内部实现，数据不一致时可能直接抛
    try {
      // ① 从旧父摘除。store.remove 顺带会把 currentNode 置空，靠后面 locate 的 setCurrent 补回
      const node = tree.store.nodesMap[key]
      if (node) tree.remove(node.data)

      // ② 处理新父
      if (toRoot) {
        // 移到根级。root 节点没有 key，用不了 updateChildren，只能 append 到末尾，
        // 所以根级这一层的顺序始终无法保证
        ensureRootData(tree)
        tree.append(data, null)
        orderUnknown = true
      } else if (!newParent) {
        // 新父所在的分支压根没加载过 —— 什么都不做，用户展开时自然会拉到最新数据
      } else if (!newParent.loaded) {
        // 已在树上但没展开过 —— 也不要 append：它会先显示一个孤零零的孩子，
        // 等真正展开时 loadData 里的 childNodes = [] 又会把它清掉，白闪一下
      } else if (siblings) {
        // 用后端返回的整层数据替换，顺序天然正确
        const keep = snapshotExpanded(tree)
        tree.store.updateChildren(newParentId, siblings)
        restoreExpanded(tree, keep)
      } else {
        // 只能追加到末尾。若这一层是按 sort 排序的，刷新页面后顺序会变，
        // 故把 orderUnknown 抛给调用方决定要不要提示
        tree.append(data, newParent.data)
        orderUnknown = true
      }
    } catch (err) {
      return fail('structure-error', { error: err })
    }

    const result = await locate(key, { path })
    return Object.assign({}, result, { orderUnknown })
  }

  /**
   * 包住一段会改变树结构的操作，操作结束后把视口还原到原处。
   * 用于「不追着节点跑」的场景：删除、批量改动、或者移动后希望留在原地。
   *
   * @param {Function} fn 会改变树结构的操作，可以是 async
   * @param {String|Number} anchorKey 锚点节点（通常传旧父 id）。树的行数变了之后，
   *        同一个 scrollTop 对应的内容会整体位移，所以要靠一个仍然存在的节点来对齐
   */
  async function keepViewport(fn, anchorKey) {
    const tree = resolveTree()
    let anchor = null

    if (tree && isVirtual(tree) && anchorKey !== undefined) {
      const scroller = getScroller(tree)
      const index = (tree.dataList || []).findIndex(n => n.key === anchorKey)
      if (scroller && index > -1) {
        anchor = { key: anchorKey, offset: index * itemSizeOf(tree) - scroller.scrollTop }
      }
    }

    const returned = await fn()

    const after = resolveTree()
    if (after && anchor) {
      await after.$nextTick()
      const scroller = getScroller(after)
      const index = (after.dataList || []).findIndex(n => n.key === anchor.key)
      if (scroller && index > -1) {
        scroller.scrollTop = Math.max(0, index * itemSizeOf(after) - anchor.offset)
      }
    }

    return returned
  }

  // 作废进行中的定位（比如用户手动滚动了，或路由离开）
  function cancel() {
    seq++
    clearTimeout(flashTimer)
  }

  return { locate, applyMove, keepViewport, cancel }
}

// RecycleScroller 是在 nextTick 之后才根据新的 items 重排的，多等一帧更保险
function nextFrame() {
  return new Promise(resolve => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve())
    else setTimeout(resolve, 16)
  })
}

export default createTreeLocator
