<template>
  <div class="doc-filter">
    <a-input
      v-model="form.docNo"
      class="doc-filter-input"
      placeholder="文号"
      allow-clear
      @pressEnter="emitSearch"
    />
    <a-input
      v-model="form.title"
      class="doc-filter-input is-wide"
      placeholder="文件名称"
      allow-clear
      @pressEnter="emitSearch"
    />
    <a-range-picker
      v-model="form.range"
      class="doc-filter-range"
      :placeholder="['发文起始', '发文截止']"
      value-format="YYYY-MM-DD"
      dropdown-class-name="doc-popup"
      :locale="zhCN"
      :allow-clear="true"
    />
    <a-button type="primary" :loading="loading" @click="emitSearch">查询</a-button>
    <a-button @click="emitReset">重置</a-button>
  </div>
</template>

<script>
/**
 * 发送/接收材料表格上方的筛选条 —— 四张表格共用。
 *
 * 只负责收集条件并 emit('search', params)，不自己发请求：
 * 请求由页面统一发，因为「点单位」等外部条件也要并进同一次查询。
 *
 * 日期用 value-format 直接吐字符串，页面侧不必自己转 moment。
 */
import moment from 'moment'
import 'moment/locale/zh-cn'
import zhCN from 'ant-design-vue/es/date-picker/locale/zh_CN'

// 项目此前没配过 antd 语言包，日期面板默认是英文（Aug 2026 / Su Mo Tu…）。
// 这里给日期组件配中文。注意 moment.locale 是全局的：本组件一旦被打包进来，
// 全站 moment 的月份/星期名都会变中文 —— 对中文业务系统是想要的效果，
// 但如果哪天有页面依赖英文月份名，得改成 moment 实例级 locale。
moment.locale('zh-cn')

export default {
  name: 'DocumentFilterBar',
  props: {
    loading: { type: Boolean, default: false }
  },
  data () {
    return {
      zhCN,
      form: {
        docNo: '',
        title: '',
        range: [] // ['YYYY-MM-DD', 'YYYY-MM-DD']
      }
    }
  },
  methods: {
    // 拍平成后端要的形状，页面直接透传给接口
    toParams () {
      const range = this.form.range || []
      return {
        docNo: this.form.docNo || '',
        title: this.form.title || '',
        startDate: range[0] || '',
        endDate: range[1] || ''
      }
    },
    emitSearch () {
      this.$emit('search', this.toParams())
    },
    emitReset () {
      this.form.docNo = ''
      this.form.title = ''
      this.form.range = []
      this.$emit('search', this.toParams())
    }
  }
}
</script>

<style lang="less" scoped>
// 页面配色写死，不接主题系统（换肤引擎与设计令牌都不参与）
@doc-red: #f12b25;
@doc-red-hover: #f75c52;
@doc-red-active: #c8150f;
@doc-radius: 4px;

.doc-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.doc-filter-input {
  width: 130px;

  &.is-wide {
    width: 180px;
  }
}

.doc-filter-range {
  width: 240px;
}

@media (max-width: 1200px) {
  .doc-filter-input,
  .doc-filter-input.is-wide,
  .doc-filter-range {
    width: auto;
    flex: 1 1 140px;
  }
}

// antd 覆盖：颜色写死，圆角 4px。
// 挂 `#app` 是必须的 —— src/theme/mintlify.css 用的是 `#app .ant-btn`（带 id，
// 权重比 scoped 的属性选择器高），不带 id 的规则压不过它，按钮会保持黑药丸。
// `::v-deep` 让样式穿透到 antd 组件内部，同时 data-v 仍钉在 .doc-filter 上，不会外泄
// （less 里不能用 `>>>`，解析不了，要用 ::v-deep）。
#app .doc-filter {
  ::v-deep {
    .ant-btn {
      border-radius: @doc-radius;

      &:not(.ant-btn-primary) {
        &:hover,
        &:focus {
          color: @doc-red;
          border-color: @doc-red;
        }
      }
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

      &:active {
        background: @doc-red-active;
        border-color: @doc-red-active;
      }
    }

    .ant-input {
      border-radius: @doc-radius;

      &:hover {
        border-color: @doc-red-hover;
      }

      &:focus {
        border-color: @doc-red;
        box-shadow: 0 0 0 2px fade(@doc-red, 14%);
      }
    }

    .ant-calendar-picker:hover .ant-input {
      border-color: @doc-red-hover;
    }

    .ant-calendar-picker-focused .ant-input {
      border-color: @doc-red;
      box-shadow: 0 0 0 2px fade(@doc-red, 14%);
    }
  }
}
</style>

<!--
  日期面板渲染到 body 上，不在本组件的 DOM 里，scoped 和 ::v-deep 都够不到，
  所以这一段不能带 scoped。作用域靠上面模板传的 dropdown-class-name="doc-popup"
  收住 —— 只有本页面的日期面板会带这个 class，不会影响其它页面。
-->
<style lang="less">
@doc-red: #f12b25;
@doc-red-soft: #fff1f0;

.doc-popup {
  .ant-calendar-selected-day .ant-calendar-date,
  .ant-calendar-selected-start-date .ant-calendar-date,
  .ant-calendar-selected-end-date .ant-calendar-date {
    background: @doc-red;
    color: #fff;
  }

  .ant-calendar-today .ant-calendar-date {
    border-color: @doc-red;
    color: @doc-red;
  }

  .ant-calendar-date:hover {
    background: @doc-red-soft;
  }

  .ant-calendar-in-range-cell::before {
    background: @doc-red-soft;
  }
}
</style>
