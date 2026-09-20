<template>
  <aside class="unit-sidebar">
    <div class="unit-filters">
      <div class="unit-filters-title">中央和国家机关名称</div>

      <a-input
        v-model="keyword"
        placeholder="搜索中央和国家机关名称"
        allow-clear
        @pressEnter="emitQuery"
      >
        <a-icon slot="prefix" type="search" />
      </a-input>

      <div class="unit-filter-row">
        <label class="unit-filter-label">发文年份</label>
        <a-select
          v-model="year"
          class="unit-filter-control"
          dropdown-class-name="doc-popup"
        >
          <!-- key 必须显式写：缺 key 时 antd 会按下标匹配 value，把 v-model 纠正成错误的项 -->
          <a-select-option key="all" value="">全部年份</a-select-option>
          <a-select-option v-for="y in years" :key="y" :value="y">{{ y }}</a-select-option>
        </a-select>
        <a-button type="primary" :loading="loading" @click="emitQuery">查询</a-button>
      </div>

      <div class="unit-filter-row">
        <label class="unit-filter-label">排序</label>
        <a-select
          v-model="sort"
          class="unit-filter-control"
          dropdown-class-name="doc-popup"
          @change="emitQuery"
        >
          <a-select-option key="desc" value="desc">按函件数量降序</a-select-option>
          <a-select-option key="asc" value="asc">按函件数量升序</a-select-option>
        </a-select>
      </div>
    </div>

    <div class="unit-list-hint">收文单位（点击切换查看）</div>

    <a-spin :spinning="loading" class="unit-list-wrap">
      <div class="unit-list">
        <!-- 「全部」项：对应原页面初始未选中单位、两表显示全量数据的状态 -->
        <div
          class="unit-item"
          :class="{ 'is-active': !value }"
          @click="select('')"
        >
          <span class="unit-name"><a-icon type="appstore" /> 全部单位</span>
          <span class="unit-count">[{{ totalCount }}件]</span>
        </div>

        <div
          v-for="unit in list"
          :key="unit.unitId"
          class="unit-item"
          :class="{ 'is-active': value === unit.unitId }"
          @click="select(unit.unitId)"
        >
          <span class="unit-name"><a-icon type="bank" /> {{ unit.unitName }}</span>
          <span class="unit-count">[{{ unit.sendCount }}件]</span>
        </div>

        <div v-if="!loading && !list.length" class="unit-empty">无匹配单位</div>
      </div>
    </a-spin>
  </aside>
</template>

<script>
/**
 * 总公司端左侧「收文单位」栏。
 *
 * 原型里叫「树」，但数据是扁平的一层，所以这里就是可点选列表，不上 a-tree —— 将来
 * 真出现「中央和国家机关 → 下属单位」两级时再换，列表项的结构留了 unitId/unitName。
 *
 * 选中的单位用 v-model 双向绑定；搜索/年份/排序统一 emit('query', {...})，
 * 由页面去调接口。
 */
export default {
  name: 'UnitSidebar',
  model: { prop: 'value', event: 'change' },
  props: {
    value: { type: String, default: '' }, // 当前选中 unitId，'' = 全部
    list: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false }
  },
  data () {
    return {
      keyword: '',
      year: '',
      sort: 'desc',
      // 年份候选先写死，接后端时换成字典接口
      years: ['2026', '2025', '2024']
    }
  },
  computed: {
    totalCount () {
      return this.list.reduce((sum, u) => sum + (u.sendCount || 0), 0)
    }
  },
  mounted () {
    // 首次加载也由本组件发起 —— 保证请求条件永远等于侧栏 UI 上显示的条件，
    // 不会出现「下拉写着降序、列表却是别的顺序」这种不一致
    this.emitQuery()
  },
  methods: {
    select (unitId) {
      if (unitId === this.value) return
      this.$emit('change', unitId)
    },
    emitQuery () {
      this.$emit('query', {
        keyword: this.keyword,
        year: this.year,
        sort: this.sort
      })
    }
  }
}
</script>

<style lang="less" scoped>
// 页面配色写死，不接主题系统
@doc-red: #f12b25;
@doc-red-hover: #f75c52;
@doc-red-soft: #fff1f0;
@doc-radius: 4px;
@line: #e5e5e5;
@line-soft: #ededed;

// 左栏：撑满整个高度，与右侧只用一条右边框分隔（无卡片边框/圆角/阴影）
.unit-sidebar {
  width: 280px;
  flex: none;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-right: 1px solid @line;
  box-sizing: border-box;
  overflow: hidden;
}

.unit-filters {
  padding: 12px 16px;
  border-bottom: 1px solid @line-soft;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.unit-filters-title {
  font-size: 14px;
  font-weight: 600;
  color: #0a0a0a;
}

.unit-filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.unit-filter-label {
  font-size: 13px;
  color: #5a5a5c;
  flex: none;
}

.unit-filter-control {
  flex: 1;
  min-width: 0;
}

.unit-list-hint {
  padding: 10px 16px 6px;
  font-size: 12px;
  color: #888888;
}

.unit-list-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;

  // a-spin 包裹层不撑高，靠内部容器滚动
  ::v-deep .ant-spin-container {
    height: 100%;
    overflow-y: auto;
  }
}

.unit-list {
  padding: 0 8px 12px;
}

.unit-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 4px;
  border-radius: @doc-radius;
  font-size: 14px;
  color: #3a3a3c;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;

  &:hover {
    background: #f7f7f7;
  }

  &.is-active {
    background: @doc-red-soft;
    color: @doc-red;
    font-weight: 500;

    .unit-count {
      color: @doc-red;
    }
  }
}

.unit-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unit-count {
  flex: none;
  font-size: 12px;
  color: #a8a8aa;
}

.unit-empty {
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: #a8a8aa;
}

// antd 覆盖：挂 `#app` 是必须的 —— mintlify.css 用 `#app .ant-btn`（带 id，权重更高），
// 不带 id 的规则压不过，按钮会保持黑药丸。less 里穿透用 ::v-deep（`>>>` 解析不了）。
#app .unit-sidebar {
  ::v-deep {
    .ant-btn {
      border-radius: @doc-radius;
    }

    .ant-btn-primary {
      background: @doc-red;
      border-color: @doc-red;
      color: #fff;

      &:hover,
      &:focus {
        background: @doc-red-hover;
        border-color: @doc-red-hover;
        color: #fff;
      }
    }

    .ant-input,
    .ant-select-selection {
      border-radius: @doc-radius;

      &:hover {
        border-color: @doc-red-hover;
      }
    }

    .ant-input:focus,
    .ant-select-focused .ant-select-selection,
    .ant-select-open .ant-select-selection {
      border-color: @doc-red;
      box-shadow: 0 0 0 2px fade(@doc-red, 14%);
    }

    .ant-spin-dot i {
      background-color: @doc-red;
    }
  }
}
</style>

<!--
  年份/排序的下拉面板渲染到 body 上，scoped 够不到，这段不能带 scoped。
  作用域靠模板里传的 dropdown-class-name="doc-popup" 收住。
-->
<style lang="less">
.doc-popup {
  .ant-select-dropdown-menu-item-selected,
  .ant-select-dropdown-menu-item-active {
    background: #fff1f0;
    color: #f12b25;
  }
}
</style>
