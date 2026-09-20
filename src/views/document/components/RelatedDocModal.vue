<template>
  <a-modal
    :visible="visible"
    title="选择对应函件"
    width="820px"
    wrap-class-name="doc-popup-modal"
    :confirm-loading="saving"
    ok-text="确定关联"
    cancel-text="取消"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <div class="related-tip">
      为回复函
      <b>{{ replyDoc ? replyDoc.docNo : '' }}</b>
      选择对应的下发函件（可选择国家局外发的函件）。
    </div>

    <a-table
      class="related-table"
      row-key="id"
      size="middle"
      :columns="columns"
      :data-source="list"
      :loading="loading"
      :pagination="{ pageSize: 5, size: 'small', hideOnSinglePage: true }"
      :row-selection="rowSelection"
      :custom-row="customRow"
    />
  </a-modal>
</template>

<script>
import { getRelatedDocOptions } from '@/api/a/document'

export default {
  name: 'RelatedDocModal',
  props: {
    visible: { type: Boolean, default: false },
    // 正在设置关联的那条回复函
    replyDoc: { type: Object, default: null },
    // 提交中（由页面在调 bindRelatedDoc 期间置真）
    saving: { type: Boolean, default: false }
  },
  data () {
    return {
      loading: false,
      list: [],
      selectedRowKeys: [],
      columns: [
        { title: '文号', dataIndex: 'docNo', width: 130 },
        { title: '文件名称', dataIndex: 'title', ellipsis: true },
        { title: '收文单位', dataIndex: 'unitName', width: 130 },
        { title: '发文时间', dataIndex: 'sendTime', width: 120 },
        { title: '办理期限', dataIndex: 'dateLine', width: 120 }
      ]
    }
  },
  computed: {
    rowSelection () {
      return {
        type: 'radio',
        selectedRowKeys: this.selectedRowKeys,
        onChange: keys => {
          this.selectedRowKeys = keys
        }
      }
    },
    selectedRow () {
      return this.list.find(r => r.id === this.selectedRowKeys[0]) || null
    }
  },
  watch: {
    // 每次打开都重新拉候选并按当前已关联值回显
    visible (open) {
      if (open) this.load()
    }
  },
  methods: {
    load () {
      this.loading = true
      getRelatedDocOptions({ replyId: this.replyDoc ? this.replyDoc.id : '' })
        .then(list => {
          this.list = list || []
          const bound = this.replyDoc && this.replyDoc.relatedDocNo
          const hit = bound ? this.list.find(r => r.docNo === bound) : null
          this.selectedRowKeys = hit ? [hit.id] : []
        })
        .finally(() => {
          this.loading = false
        })
    },
    // 整行可点，不用非得点中那个小圆点
    customRow (record) {
      return {
        on: {
          click: () => {
            this.selectedRowKeys = [record.id]
          }
        }
      }
    },
    handleOk () {
      if (!this.selectedRow) {
        this.$message.warning('请先选择一份函件')
        return
      }
      this.$emit('ok', this.selectedRow)
    },
    handleCancel () {
      this.$emit('update:visible', false)
    }
  }
}
</script>

<!--
  Modal 整体渲染到 body 上，scoped 的 data-v 属性钉不到它的内容，所以本组件的样式
  一律不带 scoped。作用域靠模板里传的 wrap-class-name="doc-popup-modal" 收住 ——
  只有本页面的弹窗带这个 class，不会影响其它页面的 Modal。
  这里也不需要 `#app` 前缀：弹窗在 #app 之外，mintlify.css 的 `#app .ant-btn` 够不到它。
-->
<style lang="less">
@doc-red: #f12b25;
@doc-red-hover: #f75c52;
@doc-red-soft: #fff1f0;
@doc-radius: 4px;

.doc-popup-modal {
  .related-tip {
    margin-bottom: 12px;
    font-size: 13px;
    color: #5a5a5c;
  }

  .related-table .ant-table-tbody > tr {
    cursor: pointer;
  }

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

  .ant-table-tbody > tr.ant-table-row-selected > td,
  .ant-table-tbody > tr:hover > td {
    background: @doc-red-soft;
  }

  .ant-radio-checked .ant-radio-inner {
    border-color: @doc-red;
  }

  .ant-radio-inner::after {
    background-color: @doc-red;
  }

  .ant-spin-dot i {
    background-color: @doc-red;
  }
}
</style>
