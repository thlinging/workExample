<template>
  <a-modal
    :visible="visible"
    title="左右联动表格"
    :width="900"
    :footer="null"
    :mask-closable="false"
    :destroy-on-close="true"
    @cancel="close"
  >
    <div class="linked-tables">
      <!-- 左侧：分类表。点击某行 -> 高亮右侧同分类的所有商品并定位 -->
      <div class="linked-pane">
        <div class="pane-title">分类（点击某行联动右侧）</div>
        <a-table
          size="small"
          row-key="id"
          :columns="leftColumns"
          :data-source="leftData"
          :pagination="false"
          :scroll="{ y: tableHeight }"
          :custom-row="leftCustomRow"
          :row-class-name="leftRowClassName"
        />
      </div>

      <!-- 右侧：商品表。匹配行高亮 + 第一条匹配行滚动到可视区居中 -->
      <div class="linked-pane">
        <div class="pane-title">
          商品
          <span v-if="activeCategoryId" class="pane-title-sub">
            （已高亮「{{ activeCategoryName }}」共 {{ matchCount }} 条）
          </span>
        </div>
        <a-table
          ref="rightTable"
          size="small"
          row-key="id"
          :columns="rightColumns"
          :data-source="rightData"
          :pagination="false"
          :scroll="{ y: tableHeight }"
          :row-class-name="rightRowClassName"
        />
      </div>
    </div>
  </a-modal>
</template>

<script>
// ===== mock 数据 =====
const CATEGORIES = [
  { id: 'C01', name: '手机数码' },
  { id: 'C02', name: '家用电器' },
  { id: 'C03', name: '服饰鞋包' },
  { id: 'C04', name: '食品生鲜' },
  { id: 'C05', name: '图书文具' },
  { id: 'C06', name: '运动户外' }
]

// 每个分类下若干商品名，用来生成右表
const PRODUCT_NAMES = {
  C01: ['智能手机', '蓝牙耳机', '平板电脑', '充电宝', '智能手表', '数据线'],
  C02: ['电饭煲', '微波炉', '空气炸锅', '电风扇', '吸尘器', '电热水壶'],
  C03: ['运动外套', '帆布鞋', '双肩包', '牛仔裤', '针织衫', '皮带'],
  C04: ['新鲜苹果', '有机蔬菜', '冷冻牛排', '纯牛奶', '坚果礼盒', '海鲜拼盘'],
  C05: ['钢笔套装', '笔记本', '畅销小说', '彩色铅笔', '文件夹', '便利贴'],
  C06: ['登山背包', '瑜伽垫', '羽毛球拍', '保温水壶', '骑行头盔', '跑步鞋']
}

// 生成右表商品，并“打散”各分类顺序，使匹配行分布在不同滚动位置
function buildProducts() {
  const buckets = CATEGORIES.map(cat =>
    PRODUCT_NAMES[cat.id].map((name, i) => ({
      categoryId: cat.id,
      name,
      price: (Math.round((30 + Math.random() * 470) * 100) / 100).toFixed(2),
      idx: i
    }))
  )
  // 轮询交错（round-robin），让同分类商品散落在列表各处
  const products = []
  let added = true
  let round = 0
  while (added) {
    added = false
    buckets.forEach(bucket => {
      if (bucket[round]) {
        products.push(bucket[round])
        added = true
      }
    })
    round++
  }
  const catName = id => CATEGORIES.find(c => c.id === id).name
  return products.map((p, i) => ({
    id: 'P' + String(i + 1).padStart(3, '0'),
    name: p.name,
    categoryId: p.categoryId,
    categoryName: catName(p.categoryId),
    price: p.price
  }))
}

export default {
  name: 'LinkedTableModal',
  model: { prop: 'visible', event: 'update:visible' },
  props: {
    visible: { type: Boolean, default: false }
  },
  data() {
    const rightData = buildProducts()
    // 左表：分类 + 该分类下商品数（按右表统计，保证一致）
    const leftData = CATEGORIES.map(cat => ({
      id: cat.id,
      name: cat.name,
      count: rightData.filter(p => p.categoryId === cat.id).length
    }))
    return {
      tableHeight: 360,
      activeCategoryId: '',
      leftData,
      rightData,
      leftColumns: [
        { title: '分类编码', dataIndex: 'id', width: 90 },
        { title: '分类名称', dataIndex: 'name' },
        { title: '商品数', dataIndex: 'count', width: 70, align: 'right' }
      ],
      rightColumns: [
        { title: '商品编码', dataIndex: 'id', width: 90 },
        { title: '商品名称', dataIndex: 'name' },
        { title: '所属分类', dataIndex: 'categoryName', width: 100 },
        { title: '价格', dataIndex: 'price', width: 90, align: 'right' }
      ]
    }
  },
  computed: {
    activeCategoryName() {
      const c = this.leftData.find(c => c.id === this.activeCategoryId)
      return c ? c.name : ''
    },
    matchCount() {
      return this.rightData.filter(p => p.categoryId === this.activeCategoryId).length
    }
  },
  watch: {
    visible(val) {
      // destroy-on-close 会重挂，这里把高亮态归零
      if (!val) this.activeCategoryId = ''
    }
  },
  methods: {
    // 左表每行绑定点击事件
    leftCustomRow(record) {
      return {
        on: { click: () => this.onSelectCategory(record) }
      }
    },
    // 左表选中行高亮
    leftRowClassName(record) {
      return record.id === this.activeCategoryId ? 'linked-row-active' : ''
    },
    // 右表匹配行高亮
    rightRowClassName(record) {
      return record.categoryId === this.activeCategoryId ? 'linked-row-highlight' : ''
    },
    onSelectCategory(record) {
      // 再次点击已选中的行 -> 取消高亮
      if (this.activeCategoryId === record.id) {
        this.activeCategoryId = ''
        return
      }
      this.activeCategoryId = record.id
      const firstMatch = this.rightData.find(p => p.categoryId === record.id)
      if (!firstMatch) {
        this.$message.info('右侧没有匹配的数据')
        return
      }
      this.scrollIntoView(firstMatch.id)
    },
    // 把右表中指定 rowKey 的行滚动到滚动容器内居中
    scrollIntoView(rowKey) {
      this.$nextTick(() => {
        const tableEl = this.$refs.rightTable && this.$refs.rightTable.$el
        if (!tableEl) return
        // antd v1 设了 scroll.y 后，表体在 .ant-table-body 这个独立滚动容器里
        const container = tableEl.querySelector('.ant-table-body')
        if (!container) return
        // antd v1 行节点带 data-row-key 属性
        const row = container.querySelector('[data-row-key="' + rowKey + '"]')
        if (!row) return
        const cRect = container.getBoundingClientRect()
        const rRect = row.getBoundingClientRect()
        // 用 getBoundingClientRect 差值在容器内滚动，避免 scrollIntoView 连带滚动整页
        const top =
          container.scrollTop +
          (rRect.top - cRect.top) -
          (container.clientHeight - row.offsetHeight) / 2
        container.scrollTo({ top, behavior: 'smooth' })
      })
    },
    close() {
      this.$emit('update:visible', false)
    }
  }
}
</script>

<style scoped>
.linked-tables {
  display: flex;
  gap: 16px;
}
.linked-pane {
  flex: 1;
  min-width: 0;
}
.pane-title {
  margin-bottom: 8px;
  font-weight: 600;
}
.pane-title-sub {
  margin-left: 4px;
  font-weight: 400;
  font-size: 12px;
  color: #1890ff;
}

/* 左表行可点击 */
.linked-tables ::v-deep .ant-table-tbody > tr {
  cursor: pointer;
}
/* 左表选中行 */
.linked-tables ::v-deep .ant-table-tbody > tr.linked-row-active > td {
  background-color: #e6f7ff;
}
/* 右表匹配高亮行（带一次闪烁提示） */
.linked-tables ::v-deep .ant-table-tbody > tr.linked-row-highlight > td {
  background-color: #fffbe6;
  animation: linked-flash 0.6s ease;
}
@keyframes linked-flash {
  0% {
    background-color: #ffe58f;
  }
  100% {
    background-color: #fffbe6;
  }
}
</style>
