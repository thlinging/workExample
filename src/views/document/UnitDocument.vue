<template>
  <div class="doc-page">
    <!-- ── 接收材料：下发到本单位的意见稿 ─────────────────────── -->
    <section class="doc-zone">
      <div class="zone-title">接收材料</div>
      <div class="zone-filter">
        <document-filter-bar :loading="issuedLoading" @search="handleIssuedSearch" />
      </div>
      <div class="zone-table">
        <a-table
          row-key="id"
          size="middle"
          :columns="issuedColumns"
          :data-source="issuedList"
          :loading="issuedLoading"
          :pagination="false"
          :scroll="{ x: 1180, y: 1 }"
        >
          <!-- 需要整行数据的列，把 dataIndex 留空 —— antd 的 TableCell 在 dataIndex 为空时
               直接把 record 当作第一个参数传给插槽。不能写 slot-scope="text, record"：
               vue 2.6.2 的 scoped slot 只透传第一个参数，record 会是 undefined。 -->
          <template slot="status" slot-scope="text">
            <a-tag :color="text === '有效' ? 'red' : ''">{{ text }}</a-tag>
          </template>
          <template slot="finishTime" slot-scope="text">
            <span v-if="text">{{ text }}</span>
            <span v-else class="cell-muted">未办结</span>
          </template>
          <template slot="attach" slot-scope="record">
            <a href="javascript:;" @click="downloadAttach(record)">
              <a-icon type="paper-clip" /> {{ record.attach }}
            </a>
          </template>
        </a-table>
      </div>
    </section>

    <!-- ── 发送材料：本单位发出的回复函 ───────────────────────── -->
    <section class="doc-zone">
      <div class="zone-title">发送材料</div>
      <div class="zone-filter">
        <document-filter-bar :loading="replyLoading" @search="handleReplySearch" />
      </div>
      <div class="zone-table">
        <a-table
          row-key="id"
          size="middle"
          :columns="replyColumns"
          :data-source="replyList"
          :loading="replyLoading"
          :pagination="false"
          :scroll="{ x: 1000, y: 1 }"
        >
          <template slot="status" slot-scope="text">
            <a-tag :color="text === '有效' ? 'red' : ''">{{ text }}</a-tag>
          </template>
          <template slot="attach" slot-scope="record">
            <a href="javascript:;" @click="downloadAttach(record)">
              <a-icon type="paper-clip" /> {{ record.attach }}
            </a>
          </template>
        </a-table>
      </div>
    </section>
  </div>
</template>

<script>
import DocumentFilterBar from './components/DocumentFilterBar.vue'
import { getIssuedDocuments, getReplyDocuments } from '@/api/a/document'

// TODO 对接：当前单位应从登录态取（用户信息接口 / store），先按原型写死华东子公司
const CURRENT_UNIT = { unitId: 'u1', unitName: '华东子公司' }

export default {
  name: 'UnitDocument',
  components: { DocumentFilterBar },
  data () {
    return {
      currentUnitId: CURRENT_UNIT.unitId,

      issuedList: [],
      issuedLoading: false,
      issuedFilter: {},

      replyList: [],
      replyLoading: false,
      replyFilter: {},

      issuedColumns: [
        { title: '文号', dataIndex: 'docNo', width: 130 },
        // 每列都给宽度：漏给的列会在 antd 的 fixed 布局里吃掉全部剩余空间，
        // 把后面的列挤到最右边。全给宽度后是按比例拉伸，观感均匀。
        { title: '文件名称', dataIndex: 'title', width: 320, ellipsis: true },
        { title: '状态', dataIndex: 'status', width: 90, scopedSlots: { customRender: 'status' } },
        { title: '发文时间', dataIndex: 'sendTime', width: 120 },
        { title: '办理期限', dataIndex: 'dateLine', width: 120 },
        { title: '来函单位', dataIndex: 'fromUnit', width: 120 },
        { title: '办结时间', dataIndex: 'finishTime', width: 120, scopedSlots: { customRender: 'finishTime' } },
        // dataIndex 留空 = 把整行交给插槽（见模板注释）；此时必须给 key，否则多列同名冲突
        { title: '附件', key: 'attach', dataIndex: '', width: 160, scopedSlots: { customRender: 'attach' } }
      ],

      replyColumns: [
        { title: '收文单位', dataIndex: 'unitName', width: 130 },
        { title: '文号', dataIndex: 'docNo', width: 140 },
        { title: '文件名称', dataIndex: 'title', width: 360, ellipsis: true },
        { title: '状态', dataIndex: 'status', width: 90, scopedSlots: { customRender: 'status' } },
        { title: '发文时间', dataIndex: 'sendTime', width: 120 },
        { title: '附件', key: 'attach', dataIndex: '', width: 160, scopedSlots: { customRender: 'attach' } }
      ]
    }
  },
  created () {
    this.loadIssued()
    this.loadReply()
  },
  mounted () {
    // 页面是 fixed 全屏的，外层文档流里只剩页脚 —— 不锁住的话还能滚出一截空白
    document.body.style.overflow = 'hidden'
  },
  beforeDestroy () {
    document.body.style.overflow = ''
  },
  methods: {
    // 子公司端只看得到本单位的数据，unitId 恒定带上
    buildParams (filter) {
      return Object.assign({ unitId: this.currentUnitId }, filter)
    },

    loadIssued () {
      this.issuedLoading = true
      getIssuedDocuments(this.buildParams(this.issuedFilter))
        .then(list => {
          this.issuedList = list || []
        })
        .finally(() => {
          this.issuedLoading = false
        })
    },

    loadReply () {
      this.replyLoading = true
      getReplyDocuments(this.buildParams(this.replyFilter))
        .then(list => {
          this.replyList = list || []
        })
        .finally(() => {
          this.replyLoading = false
        })
    },

    handleIssuedSearch (params) {
      this.issuedFilter = params
      this.loadIssued()
    },

    handleReplySearch (params) {
      this.replyFilter = params
      this.loadReply()
    },

    // TODO 对接：后端给下载地址后改成 window.open(url) 或走 blob 下载
    downloadAttach (record) {
      this.$message.info('下载附件：' + record.attach)
    }
  }
}
</script>

<style lang="less" scoped>
// 页面配色写死，不接主题系统
@doc-red: #f12b25;
@doc-red-hover: #f75c52;
@doc-red-soft: #fff1f0;
@line: #e5e5e5;

// 全屏工作台，同总公司端；本页没有左侧栏，就是上下两块各占一半
.doc-page {
  position: fixed;
  top: 64px;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.doc-zone {
  flex: 1 1 50%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px 16px;
  box-sizing: border-box;

  & + .doc-zone {
    border-top: 1px solid @line;
  }
}

.zone-title {
  flex: none;
  font-size: 16px;
  font-weight: 600;
  color: #0a0a0a;
  line-height: 24px;
}

// 查询条件另起一行
.zone-filter {
  flex: none;
  padding: 10px 0;
}

.zone-table {
  flex: 1;
  min-height: 0;
}

.cell-muted {
  color: #a8a8aa;
}

// ── 表格覆盖（颜色写死）────────────────────────────────────────
// 挂 `#app` 是为了压过 src/theme/mintlify.css 里带 id 的规则；
// `::v-deep` 穿透到 antd 内部，data-v 仍钉在 .zone-table 上，不会外泄
// （less 里不能用 `>>>`，解析不了）。
#app .zone-table {
  ::v-deep {
    .ant-table-thead > tr > th {
      background: #fafafa;
      color: #3a3a3c;
      font-weight: 600;
    }

    .ant-table-tbody > tr:hover > td {
      background: @doc-red-soft;
    }

    a {
      color: @doc-red;

      &:hover {
        color: @doc-red-hover;
      }
    }

    .ant-spin-dot i {
      background-color: @doc-red;
    }

    // 表格撑满所在区域、表头固定。
    // 做法：给 a-table 传了 scroll.y（一个占位值）让 antd 渲染成「表头 + 表体」两段结构，
    // 这里把 antd 写在 .ant-table-body 上的 inline max-height 用 !important 顶掉，
    // 改由 flex 撑满剩余高度 —— 不用 JS 量高度，窗口缩放也自动跟随。
    .ant-table-wrapper,
    .ant-spin-nested-loading,
    .ant-spin-container,
    .ant-table,
    .ant-table-content,
    .ant-table-scroll {
      height: 100%;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    .ant-table-body {
      flex: 1;
      min-height: 0;
      max-height: none !important;
      overflow-y: auto !important;
      // antd 设的是 overflow-x: scroll，轨道会一直占着；改 auto，列放得下时不显示
      overflow-x: auto !important;
    }

    .ant-table-placeholder {
      border-bottom: none;
    }
  }
}
</style>
