<template>
  <div class="easy-tree-demo">
    <!-- ── 卡片一：虚拟滚动 · 大数据量 ─────────────────────────────── -->
    <a-card class="panel" :bordered="false">
      <template #title>
        <span class="panel-title"><a-icon type="apartment" /> vue-easy-tree · 虚拟滚动大数据树</span>
      </template>
      <template #extra>
        <span class="panel-extra">@wchbrad/vue-easy-tree 1.0.13 · 源码引入 · vue 2.6.2 单实例</span>
      </template>

      <a-alert
        class="tip"
        type="info"
        show-icon
        message="传了 height 就走虚拟滚动：只渲染视口内的十几行 DOM，节点总量再大，滚动都不掉帧。"
        description="但要留意下面的耗时：虚拟滚动只省渲染，建树不省——TreeStore 仍要为每个节点建 Node 并做响应式，10 万节点这一步是秒级的，真上大数据建议配合懒加载。样式则完全复用项目自己的 element 主题（类名同为 .el-tree），编译期主题、运行时换肤色序、Mintlify 覆盖层都覆盖得到。"
      />

      <!-- 控制条 -->
      <div class="toolbar">
        <span class="toolbar-label">数据规模</span>
        <a-radio-group v-model="scale" button-style="solid" size="small" @change="rebuild">
          <a-radio-button :value="10000">1 万</a-radio-button>
          <a-radio-button :value="50000">5 万</a-radio-button>
          <a-radio-button :value="100000">10 万</a-radio-button>
        </a-radio-group>

        <a-input
          v-model="keyword"
          class="toolbar-search"
          size="small"
          placeholder="按名称过滤，如「成员 0123」"
          allow-clear
        >
          <a-icon slot="prefix" type="search" />
        </a-input>

        <a-switch v-model="showCheckbox" size="small" />
        <span class="toolbar-label">复选框</span>

        <a-switch v-model="highlightCurrent" size="small" />
        <span class="toolbar-label">高亮当前行</span>

        <a-button size="small" @click="countChecked">统计勾选</a-button>
        <a-button size="small" @click="locateRandom">随机定位一个节点</a-button>
      </div>

      <div class="tree-layout">
        <div class="tree-box" :class="{ 'is-busy': building }">
          <a-spin :spinning="building" tip="正在构建节点…">
            <vue-easy-tree
              ref="tree"
              node-key="id"
              height="460px"
              :item-size="26"
              :data="treeData"
              :props="treeProps"
              :show-checkbox="showCheckbox"
              :highlight-current="highlightCurrent"
              :filter-node-method="filterNode"
              :expand-on-click-node="false"
              @node-click="onNodeClick"
              @check="onCheck"
            />
          </a-spin>
        </div>

        <aside class="side">
          <div class="metrics">
            <div class="metric">
              <div class="metric-label">数据节点总数</div>
              <div class="metric-value">{{ stats.total.toLocaleString() }}</div>
            </div>
            <div class="metric">
              <div class="metric-label">造数据耗时</div>
              <div class="metric-value">{{ stats.buildMs }} <em>ms</em></div>
            </div>
            <div class="metric">
              <div class="metric-label">建树 + 首屏渲染</div>
              <div class="metric-value">{{ stats.renderMs }} <em>ms</em></div>
            </div>
            <div class="metric metric-hl">
              <div class="metric-label">当前实际 DOM 行数</div>
              <div class="metric-value">{{ domRows }}</div>
            </div>
            <div v-if="stats.filterMs !== null" class="metric metric-wide">
              <div class="metric-label">上次过滤耗时</div>
              <div class="metric-value">{{ stats.filterMs }} <em>ms</em></div>
            </div>
          </div>

          <div class="log">
            <div class="log-title">事件日志</div>
            <p v-if="!logs.length" class="log-empty">点一下树节点试试</p>
            <p v-for="(item, i) in logs" :key="i" class="log-item">
              <span class="log-time">{{ item.time }}</span>{{ item.text }}
            </p>
          </div>
        </aside>
      </div>
    </a-card>

    <!-- ── 卡片二：懒加载 + 自定义节点内容 ─────────────────────────── -->
    <a-card class="panel" :bordered="false">
      <template #title>
        <span class="panel-title"><a-icon type="cluster" /> 懒加载 与 自定义节点</span>
      </template>
      <template #extra>
        <span class="panel-extra">不传 height 即普通渲染，API 与 el-tree 一致</span>
      </template>

      <a-row :gutter="24">
        <a-col :xs="24" :md="12">
          <div class="sub-title">懒加载（lazy + load）</div>
          <p class="sub-desc">展开时才向后端要下一层，这里用 400ms 延时模拟请求。</p>
          <div class="tree-box tree-box-sm">
            <vue-easy-tree
              node-key="id"
              lazy
              :load="loadNode"
              :props="lazyProps"
              show-checkbox
            />
          </div>
        </a-col>

        <a-col :xs="24" :md="12">
          <div class="sub-title">自定义节点内容（作用域插槽）</div>
          <p class="sub-desc">
            默认插槽拿到 <code>{ node, data }</code>，可自由排版。
          </p>
          <div class="tree-box tree-box-sm">
            <vue-easy-tree
              node-key="id"
              :data="slotData"
              :props="treeProps"
              default-expand-all
              :expand-on-click-node="false"
            >
              <template v-slot="{ data }">
                <span class="slot-row">
                  <span class="slot-label">{{ data.label }}</span>
                  <a-tag v-if="data.tag" :color="data.tagColor" class="slot-tag">{{ data.tag }}</a-tag>
                  <span v-if="data.count !== undefined" class="slot-count">{{ data.count }} 人</span>
                </span>
              </template>
            </vue-easy-tree>
          </div>
        </a-col>
      </a-row>
    </a-card>

    <!-- ── 卡片三：懒加载组织树 · 编辑后跟随定位 ───────────────────── -->
    <a-card class="panel" :bordered="false">
      <template #title>
        <span class="panel-title"><a-icon type="environment" /> 编辑后跟随定位（懒加载 + 跨父级移动）</span>
      </template>
      <template #extra>
        <span class="panel-extra">src/utils/tree-locator.js · 共 {{ orgTotal }} 个地区</span>
      </template>

      <a-alert
        class="tip"
        type="info"
        show-icon
        message="改了名或换了上级，保存后节点会被展开出来、滚到视口中部并闪一下——不整树刷新，只动受影响的两个分支。"
        description="难点在懒加载：新上级所在的分支可能压根没加载过。所以保存接口要返回 ancestors（祖先链），前端拿它逐级 load 再定位。鼠标悬浮在节点上会出现「编辑」。"
      />

      <div class="toolbar">
        <span class="toolbar-label">搜索定位</span>
        <a-input
          v-model="orgKeyword"
          class="toolbar-search"
          size="small"
          placeholder="输入地区名，如 浙江"
          @pressEnter="locateByKeyword"
        >
          <a-icon slot="prefix" type="search" />
        </a-input>
        <a-button size="small" :loading="locating" @click="locateByKeyword">定位过去</a-button>
        <a-divider type="vertical" />
        <a-button size="small" @click="collapseOrgAll">全部收起</a-button>
        <span class="toolbar-hint">
          同一个 locate()，编辑后定位和搜索定位走的是同一条路径
        </span>
      </div>

      <div class="tree-layout">
        <div class="tree-box">
          <vue-easy-tree
            ref="orgTree"
            node-key="id"
            height="420px"
            :item-size="26"
            lazy
            :load="loadOrg"
            :props="orgProps"
            highlight-current
            :expand-on-click-node="false"
          >
            <template v-slot="{ data }">
              <span class="org-node">
                <span class="org-name">{{ data.name }}</span>
                <a class="org-edit" @click.stop="openEdit(data)">编辑</a>
              </span>
            </template>
          </vue-easy-tree>
        </div>

        <aside class="side">
          <div class="log">
            <div class="log-title">定位结果</div>
            <p v-if="!orgLogs.length" class="log-empty">悬浮节点点「编辑」试试</p>
            <!-- 日志行超长会被省略号截断，用 title 兜住完整内容 -->
            <p
              v-for="(item, i) in orgLogs"
              :key="i"
              class="log-item"
              :class="{ 'is-bad': item.bad }"
              :title="item.text"
            >
              <span class="log-time">{{ item.time }}</span>{{ item.text }}
            </p>
          </div>
        </aside>
      </div>
    </a-card>

    <!-- 编辑弹窗：改名 + 用下拉树选上级 -->
    <a-modal
      v-model="editVisible"
      title="编辑地区"
      ok-text="保存"
      cancel-text="取消"
      :confirm-loading="saving"
      :mask-closable="false"
      @ok="handleSave"
    >
      <div class="form-item">
        <label class="form-label">名称</label>
        <a-input v-model="editForm.name" placeholder="请输入地区名称" />
      </div>
      <div class="form-item">
        <label class="form-label">上级地区</label>
        <a-tree-select
          v-model="editForm.parentId"
          class="form-control"
          allow-clear
          tree-default-expand-all
          placeholder="留空表示挂到最顶层"
          :tree-data="parentOptions"
          :replace-fields="{ title: 'name', key: 'id', value: 'id', children: 'children' }"
          :dropdown-style="{ maxHeight: '320px', overflow: 'auto' }"
        />
        <p class="form-hint">
          换个上级试试——选一个从没展开过的分支，看它怎么被逐级加载出来
        </p>
      </div>
    </a-modal>
  </div>
</template>

<script>
import { createTreeLocator } from '@/utils/tree-locator'
import {
  fetchChildren,
  fetchParentOptions,
  updateNode,
  searchNode,
  countNodes
} from '@/mock/orgTree'

/*
 * vue-easy-tree 演示页。
 * 组件在 src/plugins/vue-easy-tree.js 全局注册（走 src 源码而非 dist，原因见该文件）。
 *
 * 三层结构按总量反推：部门 / 小组 / 成员。数字凑到接近整数规模，方便看指标。
 */
const SHAPES = {
  10000: { dept: 20, group: 20, member: 24 },
  50000: { dept: 50, group: 25, member: 39 },
  100000: { dept: 50, group: 40, member: 49 }
}

const pad = (n, width) => String(n).padStart(width, '0')

export default {
  name: 'EasyTreeDemo',
  data() {
    return {
      scale: 10000,
      keyword: '',
      showCheckbox: true,
      highlightCurrent: true,
      building: false,
      treeData: [],
      treeProps: { children: 'children', label: 'label' },
      lazyProps: { children: 'children', label: 'label', isLeaf: 'leaf' },
      stats: { total: 0, buildMs: 0, renderMs: 0, filterMs: null },
      domRows: 0,
      logs: [],
      domTimer: null,
      // 自定义节点内容的小样本
      slotData: [
        {
          id: 's-1',
          label: '研发中心',
          tag: '一级部门',
          tagColor: 'blue',
          children: [
            { id: 's-1-1', label: '前端组', count: 12, tag: '在招', tagColor: 'green' },
            { id: 's-1-2', label: '后端组', count: 18 },
            { id: 's-1-3', label: '测试组', count: 6, tag: '缺编', tagColor: 'orange' }
          ]
        },
        {
          id: 's-2',
          label: '市场中心',
          tag: '一级部门',
          tagColor: 'blue',
          children: [{ id: 's-2-1', label: '品牌组', count: 9 }]
        }
      ],

      // ── 卡片三：懒加载组织树 ──────────────────────────────
      orgProps: { children: 'children', label: 'name', isLeaf: 'leaf' },
      orgTotal: countNodes(),
      orgKeyword: '',
      orgLogs: [],
      locating: false,
      editVisible: false,
      saving: false,
      parentOptions: [],
      // 记录进入弹窗时的原始父级，保存时用来判断是否发生了移动
      editing: { id: null, oldParentId: null },
      editForm: { name: '', parentId: undefined }
    }
  },
  watch: {
    // 过滤走组件的 filter()，内部会把不匹配节点的 visible 置 false，
    // 虚拟列表 (smoothTree) 直接跳过不可见节点，不会留空行。
    keyword(val) {
      const t0 = performance.now()
      this.$refs.tree.filter(val)
      this.$nextTick(() => {
        this.stats.filterMs = Math.round(performance.now() - t0)
      })
    }
  },
  created() {
    // 传 getter 而不是实例：树可能还没挂载，也可能被包在别的组件里，每次现取最稳。
    // locator 不需要响应式，挂在 this 上即可，别放进 data
    this.locator = createTreeLocator(() => this.$refs.orgTree)
  },
  mounted() {
    this.rebuild()
    // 实时显示 DOM 行数——这是虚拟滚动最直观的证据：数据 10 万，DOM 恒定几十行。
    // 组件没有暴露滚动事件，这里用轮询取代，仅本演示页使用。
    this.domTimer = setInterval(this.refreshDomRows, 500)
  },
  beforeDestroy() {
    clearInterval(this.domTimer)
    // 作废可能还在等 lazy load 的定位，避免组件销毁后继续操作 DOM
    this.locator.cancel()
  },
  methods: {
    rebuild() {
      this.building = true
      this.keyword = ''
      // 让 loading 先画出来，再做同步的重活，否则大规模建树会卡住这一帧
      this.$nextTick(() => {
        setTimeout(() => {
          const t0 = performance.now()
          const { data, total } = this.buildData(this.scale)
          this.treeData = data
          const t1 = performance.now()

          this.$nextTick(() => {
            this.building = false
            this.stats = {
              total,
              buildMs: Math.round(t1 - t0),
              renderMs: Math.round(performance.now() - t1),
              filterMs: null
            }
            this.refreshDomRows()
          })
        }, 0)
      })
    },

    buildData(scale) {
      const shape = SHAPES[scale]
      const data = []
      let total = 0
      for (let i = 1; i <= shape.dept; i++) {
        const groups = []
        for (let j = 1; j <= shape.group; j++) {
          const members = []
          for (let k = 1; k <= shape.member; k++) {
            members.push({ id: `m-${i}-${j}-${k}`, label: `成员 ${pad(total + 1, 6)}` })
            total++
          }
          groups.push({ id: `g-${i}-${j}`, label: `第 ${pad(j, 2)} 组`, children: members })
          total++
        }
        data.push({ id: `d-${i}`, label: `研发中心 ${pad(i, 2)}`, children: groups })
        total++
      }
      return { data, total }
    },

    filterNode(value, data) {
      if (!value) return true
      return data.label.indexOf(value) !== -1
    },

    refreshDomRows() {
      const box = this.$refs.tree && this.$refs.tree.$el
      this.domRows = box ? box.querySelectorAll('.el-tree-node').length : 0
    },

    countChecked() {
      const keys = this.$refs.tree.getCheckedKeys()
      const half = this.$refs.tree.getHalfCheckedKeys()
      this.$message.info(`已勾选 ${keys.length} 个节点，半选 ${half.length} 个`)
      this.pushLog(`统计勾选：全选 ${keys.length} / 半选 ${half.length}`)
    },

    // scrollToItem 是 vue-easy-tree 相对 el-tree 多出来的方法：
    // 按 node-key 把目标行滚到视口顶部（只在虚拟滚动模式下有效）。
    locateRandom() {
      const shape = SHAPES[this.scale]
      const i = Math.ceil(Math.random() * shape.dept)
      const j = Math.ceil(Math.random() * shape.group)
      const k = Math.ceil(Math.random() * shape.member)
      const id = `m-${i}-${j}-${k}`
      // 先展开到目标层级，节点在虚拟列表里存在，滚动才有意义
      this.$refs.tree.setCurrentKey(`d-${i}`)
      this.$refs.tree.store.nodesMap[`d-${i}`].expand()
      this.$refs.tree.store.nodesMap[`g-${i}-${j}`].expand()
      this.$nextTick(() => {
        this.$refs.tree.setCurrentKey(id)
        this.$refs.tree.scrollToItem(id)
        this.pushLog(`定位到 ${id}`)
      })
    },

    onNodeClick(data) {
      this.pushLog(`点击节点：${data.label}`)
    },

    // 用 @check 而不是 el-tree 常用的 @check-change：后者在 vue-easy-tree 里
    // 判断条件被写成了 `oldChecked !== checked && oldIndeterminate !== indeterminate`
    // （element 原版是 ||），要求两个状态同时翻转才派发，实际上几乎不触发。
    // @check 的载荷与 el-tree 一致：(data, { checkedKeys, halfCheckedKeys, ... })
    onCheck(data, info) {
      this.pushLog(`勾选变更：${data.label}（当前共 ${info.checkedKeys.length} 项）`)
    },

    pushLog(text) {
      const d = new Date()
      const time = `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}`
      this.logs.unshift({ time, text })
      if (this.logs.length > 8) this.logs.pop()
    },

    /* ── 卡片三：懒加载组织树 + 编辑后定位 ───────────────────── */

    // 懒加载：level 0 是虚拟根，对应假后端里 parentId 为 '0' 的那一层
    loadOrg(node, resolve) {
      const parentId = node.level === 0 ? '0' : node.data.id
      fetchChildren(parentId).then(resolve)
    },

    openEdit(data) {
      this.editing = { id: data.id, oldParentId: data.parentId }
      this.editForm = {
        name: data.name,
        // 挂在最顶层时给 undefined，让 tree-select 显示 placeholder
        parentId: data.parentId === '0' ? undefined : data.parentId
      }
      this.editVisible = true

      if (!this.parentOptions.length) {
        fetchParentOptions().then(list => {
          this.parentOptions = list
        })
      }
    },

    async handleSave() {
      if (!this.editForm.name.trim()) {
        this.$message.warning('名称不能为空')
        return
      }
      this.saving = true
      // tree-select 清空后是 undefined，按后端约定转回虚拟根 '0'
      const parentId = this.editForm.parentId || '0'
      const res = await updateNode({
        id: this.editing.id,
        name: this.editForm.name.trim(),
        parentId
      })
      this.saving = false

      if (!res.ok) {
        this.$message.error(res.message)
        return
      }
      this.editVisible = false

      // 核心：结构就地改对 + 定位过去。ancestors 是 "0,r1,r1-p2" 这种逗号串，
      // 里头的虚拟根 '0' 由 tree-locator 自己滤掉
      const result = await this.locator.applyMove({
        data: res.node,
        oldParentId: this.editing.oldParentId,
        newParentId: res.node.parentId,
        path: res.ancestors,
        siblings: res.siblings
      })

      this.reportLocate(result, res.node.name)
    },

    async locateByKeyword() {
      const kw = this.orgKeyword.trim()
      if (!kw) return
      this.locating = true
      const hit = await searchNode(kw)
      this.locating = false

      if (!hit) {
        this.pushOrgLog(`没找到包含「${kw}」的地区`, true)
        return
      }
      // 与编辑后定位完全同一个调用，只是 path 换成搜索接口给的
      const result = await this.locator.locate(hit.node.id, { path: hit.ancestors })
      this.reportLocate(result, hit.node.name)
    },

    // 定位失败的 reason 都是可分辨的，真实项目按需给不同提示
    reportLocate(result, name) {
      if (result.ok) {
        const suffix = result.orderUnknown ? '（后端未返回同层顺序，位置可能与刷新后不一致）' : ''
        this.pushOrgLog(`已定位到「${name}」，第 ${result.index + 1} 行${suffix}`)
        return
      }
      const REASONS = {
        'no-tree': '树实例不在了',
        'no-path': '拿不到祖先链，无法展开',
        'path-broken': `祖先链在 ${result.at} 处断了，数据可能已被他人修改`,
        timeout: `展开 ${result.at} 超时`,
        aborted: '被新的定位请求取代',
        'not-found': '展开完成但没在列表里找到该节点',
        'no-scroller': '没找到滚动容器'
      }
      this.pushOrgLog(`定位「${name}」失败：${REASONS[result.reason] || result.reason}`, true)
    },

    collapseOrgAll() {
      const tree = this.$refs.orgTree
      const map = tree.store.nodesMap
      Object.keys(map).forEach(k => {
        map[k].expanded = false
      })
      // 行数骤减，旧的 scrollTop 会落在列表范围之外，归零省得留一段空白
      const scroller = tree.$el.querySelector('.vue-recycle-scroller')
      if (scroller) scroller.scrollTop = 0
      this.pushOrgLog('已全部收起，再定位一次看逐级加载')
    },

    pushOrgLog(text, bad) {
      const d = new Date()
      const time = `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}`
      this.orgLogs.unshift({ time, text, bad: !!bad })
      if (this.orgLogs.length > 8) this.orgLogs.pop()
    },

    // 懒加载：level 0 是虚拟根，往下每次展开再要一层，第 3 层标记为叶子
    loadNode(node, resolve) {
      if (node.level === 0) {
        return resolve([
          { id: 'lz-1', label: '华东大区' },
          { id: 'lz-2', label: '华北大区' }
        ])
      }
      if (node.level >= 3) return resolve([])
      setTimeout(() => {
        const base = node.data.id
        resolve([
          { id: `${base}-1`, label: `${node.data.label} / 子项 A`, leaf: node.level >= 2 },
          { id: `${base}-2`, label: `${node.data.label} / 子项 B`, leaf: node.level >= 2 }
        ])
      }, 400)
    }
  }
}
</script>

<style scoped>
.easy-tree-demo {
  width: 100%;
}
.panel {
  margin-bottom: 24px;
}
.panel-title {
  font-weight: 600;
  color: var(--m-ink);
}
.panel-extra {
  color: var(--m-steel);
  font-size: 13px;
  font-family: var(--m-font-mono);
}
.tip {
  margin-bottom: 16px;
}

/* ── 控制条 ─────────────────────────────────────────────────── */
.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 14px;
  margin-bottom: 16px;
  background: var(--m-surface-soft);
  border: 1px solid var(--m-hairline);
  border-radius: var(--m-r-md);
}
.toolbar-label {
  font-size: 13px;
  color: var(--m-steel);
}
.toolbar-search {
  width: 220px;
}

/* ── 树 + 侧栏 ──────────────────────────────────────────────── */
.tree-layout {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}
.tree-box {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--m-hairline);
  border-radius: var(--m-r-md);
  background: var(--m-canvas);
  overflow: hidden;
}
.tree-box-sm {
  height: 300px;
  overflow: auto;
  padding: 8px 4px;
}
.side {
  width: 260px;
  flex: none;
}

.metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
}
.metric {
  padding: 10px 12px;
  border: 1px solid var(--m-hairline);
  border-radius: var(--m-r-md);
  background: var(--m-canvas);
}
/* 唯一需要读者注意的数字：DOM 行数 */
.metric-hl {
  background: var(--m-surface-code);
  border-color: var(--m-surface-code);
}
/* 过滤耗时是第 5 格，跨列铺满，避免 2 列网格落单 */
.metric-wide {
  grid-column: 1 / -1;
}
.metric-hl .metric-label {
  color: var(--m-on-dark-muted);
}
.metric-hl .metric-value {
  color: var(--m-mint);
}
.metric-label {
  font-size: 11px;
  color: var(--m-stone);
  margin-bottom: 4px;
}
.metric-value {
  font-family: var(--m-font-mono);
  font-size: 18px;
  font-weight: 600;
  color: var(--m-ink);
}
.metric-value em {
  font-style: normal;
  font-size: 12px;
  font-weight: 400;
  color: var(--m-stone);
}

.log {
  padding: 12px;
  border: 1px solid var(--m-hairline);
  border-radius: var(--m-r-md);
  background: var(--m-surface-soft);
}
.log-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--m-steel);
  margin-bottom: 8px;
}
.log-empty {
  margin: 0;
  font-size: 13px;
  color: var(--m-muted);
}
.log-item {
  margin: 0 0 4px;
  font-size: 12px;
  color: var(--m-charcoal);
  font-family: var(--m-font-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.log-time {
  color: var(--m-muted);
  margin-right: 8px;
}

/* ── 卡片二 ─────────────────────────────────────────────────── */
.sub-title {
  font-weight: 600;
  color: var(--m-ink);
  margin-bottom: 4px;
}
.sub-desc {
  font-size: 13px;
  color: var(--m-steel);
  margin-bottom: 12px;
}
.sub-desc code {
  font-family: var(--m-font-mono);
  font-size: 12px;
  padding: 1px 5px;
  border-radius: var(--m-r-xs);
  background: var(--m-surface);
}
.slot-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.slot-label {
  color: var(--m-charcoal);
}
.slot-tag {
  margin: 0;
}
.slot-count {
  font-size: 12px;
  color: var(--m-stone);
  font-family: var(--m-font-mono);
}

/* ── 卡片三 ─────────────────────────────────────────────────── */
.toolbar-hint {
  font-size: 12px;
  color: var(--m-muted);
}
.log-item.is-bad {
  color: var(--m-error);
}
.form-item {
  margin-bottom: 18px;
}
.form-label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--m-ink);
}
.form-control {
  width: 100%;
}
.form-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--m-stone);
}

@media (max-width: 992px) {
  .tree-layout {
    flex-direction: column;
  }
  .side {
    width: 100%;
  }
}
</style>

<!--
  非 scoped：这两部分都要作用到树组件内部的 .el-tree-node，
  scoped 的属性选择器打不进去。靠 .easy-tree-demo 前缀限定影响范围。
-->
<style lang="scss">
/* 定位高亮动画。默认色就是薄荷绿，这里演示如何覆盖成别的主题色 */
$ve-locate-flash-color: rgba(0, 212, 164, 0.35);
@import '@/utils/tree-locator.scss';

.easy-tree-demo {
  .org-node {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }

  .org-name {
    color: var(--m-charcoal);
  }

  /*
   * 悬浮才出现的编辑入口，用纯 CSS 控制——不要用 JS 记 hoverKey：
   * RecycleScroller 会复用行 DOM，鼠标没动而内容换了，JS 记的 hover 态会串到别的行。
   * 用 visibility 而不是 display，保证行高不因按钮出现而跳动。
   */
  .org-edit {
    visibility: hidden;
    font-size: 12px;
    color: var(--m-mint-deep);
  }

  .el-tree-node__content:hover .org-edit {
    visibility: visible;
  }
}
</style>
