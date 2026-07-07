<template>
  <a-resizable-modal
    :visible="visible"
    :title="title"
    :ok-text="okText"
    :cancel-text="cancelText"
    :confirm-loading="confirmLoading"
    :mask-closable="false"
    :initial-width="560"
    :initial-height="360"
    :min-width="360"
    :min-height="240"
    @ok="handleOk"
    @cancel="handleCancel"
    @resize="onResize"
  >
    <a-form-model
      ref="form"
      :model="form"
      :rules="rules"
      :label-col="{ span: 5 }"
      :wrapper-col="{ span: 16 }"
    >
      <a-form-model-item label="姓名" prop="name">
        <a-input v-model="form.name" placeholder="请输入姓名" allow-clear />
      </a-form-model-item>
      <a-form-model-item label="备注" prop="remark">
        <a-input
          v-model="form.remark"
          type="textarea"
          :auto-size="{ minRows: 3, maxRows: 5 }"
          placeholder="可选"
        />
      </a-form-model-item>
    </a-form-model>
    <div class="modal-size-tip">
      拖拽右下角调整弹窗尺寸
      <span v-if="size">（{{ size.width }} × {{ size.height }}）</span>
    </div>
  </a-resizable-modal>
</template>

<script>
export default {
  name: 'DemoModal',
  model: {
    prop: 'visible',
    event: 'update:visible'
  },
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: '示例弹窗'
    },
    okText: {
      type: String,
      default: '确定'
    },
    cancelText: {
      type: String,
      default: '取消'
    }
  },
  data() {
    return {
      confirmLoading: false,
      size: null,
      form: {
        name: '',
        remark: ''
      },
      rules: {
        name: [{ required: true, message: '请输入姓名', trigger: 'blur' }]
      }
    }
  },
  watch: {
    visible(val) {
      if (val) {
        this.$nextTick(() => {
          this.$refs.form && this.$refs.form.clearValidate()
        })
      }
    }
  },
  methods: {
    handleOk() {
      this.$refs.form.validate(valid => {
        if (!valid) return
        this.confirmLoading = true
        setTimeout(() => {
          this.confirmLoading = false
          this.$emit('submit', { ...this.form })
          this.close()
        }, 400)
      })
    },
    handleCancel() {
      this.close()
    },
    onResize({ width, height }) {
      this.size = { width: Math.round(width), height: Math.round(height) }
    },
    close() {
      this.$emit('update:visible', false)
      this.$nextTick(() => {
        this.form.name = ''
        this.form.remark = ''
        this.$refs.form && this.$refs.form.clearValidate()
      })
    }
  }
}
</script>

<style scoped>
.modal-size-tip {
  margin-top: 8px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  text-align: right;
}
</style>
