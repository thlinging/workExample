/**
 * 地区组织树的假后端 —— 只服务 /easy-tree 演示页，用来验证 tree-locator。
 *
 * 刻意做成和真实后端一样的形态：
 *   · 内存里存扁平的 { id, name, parentId }，parentId 为 '0' 表示挂在根下；
 *   · 只提供「按父 id 拉一层」的接口（对应懒加载树的 load）；
 *   · 保存接口返回 ancestors 逗号串（若依 sys_dept.ancestors 那种，含虚拟根 '0'）
 *     和新父下的完整子级，供前端定位与排序。
 */

const REGIONS = [
  { name: '华东大区', provinces: ['江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省'] },
  { name: '华北大区', provinces: ['北京市', '天津市', '河北省', '山西省', '内蒙古自治区'] },
  { name: '华南大区', provinces: ['广东省', '广西壮族自治区', '海南省'] }
]

// 每个省下挂多少个市。给到 20 是为了让展开后的列表足够长，滚动定位才有意义
const CITY_PER_PROVINCE = 20

const nodes = Object.create(null)

function add(id, name, parentId, leaf) {
  nodes[id] = { id, name, parentId, leaf: !!leaf }
}

function seed() {
  REGIONS.forEach((region, ri) => {
    const regionId = `r${ri + 1}`
    add(regionId, region.name, '0', false)

    region.provinces.forEach((province, pi) => {
      const provinceId = `${regionId}-p${pi + 1}`
      add(provinceId, province, regionId, false)

      for (let ci = 1; ci <= CITY_PER_PROVINCE; ci++) {
        const cityId = `${provinceId}-c${ci}`
        add(cityId, `${province.slice(0, 2)}市辖区 ${String(ci).padStart(2, '0')}`, provinceId, true)
      }
    })
  })
}

seed()

function delay(value, ms = 320) {
  return new Promise(resolve => setTimeout(() => resolve(value), ms))
}

function clone(node) {
  return { id: node.id, name: node.name, parentId: node.parentId, leaf: node.leaf }
}

// 同一层内按名称排序，模拟后端的 order by sort_num
function childrenOf(parentId) {
  return Object.keys(nodes)
    .map(k => nodes[k])
    .filter(n => n.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
    .map(clone)
}

/** 祖先链，根在前、不含自身、含虚拟根 '0'——即 "0,r1,r1-p2" */
function ancestorsOf(id) {
  const chain = []
  let cur = nodes[id]
  while (cur) {
    chain.unshift(cur.parentId)
    if (cur.parentId === '0') break
    cur = nodes[cur.parentId]
  }
  return chain.join(',')
}

/** 懒加载用：拉某个父节点下的一层。parentId 传 '0' 取根级 */
export function fetchChildren(parentId) {
  return delay(childrenOf(parentId))
}

/**
 * 保存编辑。可改名，也可换父级。
 * 返回值刻意做全，前端定位需要的三样都在里面。
 */
export function updateNode({ id, name, parentId }) {
  const node = nodes[id]
  if (!node) return delay({ ok: false, message: '节点不存在' })

  // 不允许挂到自己的子孙下（真实后端也必须拦，否则会成环）
  if (parentId !== node.parentId && isDescendant(parentId, id)) {
    return delay({ ok: false, message: '不能移动到自己的下级节点' })
  }

  node.name = name
  node.parentId = parentId

  return delay({
    ok: true,
    node: clone(node),
    ancestors: ancestorsOf(id),
    siblings: childrenOf(parentId)
  })
}

function isDescendant(maybeChildId, ancestorId) {
  let cur = nodes[maybeChildId]
  while (cur && cur.parentId !== '0') {
    if (cur.parentId === ancestorId) return true
    cur = nodes[cur.parentId]
  }
  return false
}

/**
 * 给「选父级」的下拉树用：一次给出完整层级。
 * 真实项目里这个下拉树多半也是懒加载 + 搜索的，那样前端就算不出祖先链，
 * 只能依赖保存接口返回的 ancestors——本演示走的正是后者。
 */
export function fetchParentOptions() {
  const build = parentId =>
    childrenOf(parentId)
      .filter(n => !n.leaf) // 只有非叶子能当父级
      .map(n => ({ id: n.id, name: n.name, children: build(n.id) }))
  return delay(build('0'), 120)
}

/** 按名称搜一个节点，返回它和它的祖先链——演示 locate 的通用用法（搜索结果定位） */
export function searchNode(keyword) {
  const kw = String(keyword || '').trim()
  if (!kw) return delay(null, 80)
  const hit = Object.keys(nodes)
    .map(k => nodes[k])
    .find(n => n.name.indexOf(kw) !== -1)
  if (!hit) return delay(null, 80)
  return delay({ node: clone(hit), ancestors: ancestorsOf(hit.id) }, 80)
}

/** 仅供演示页显示总量 */
export function countNodes() {
  return Object.keys(nodes).length
}
