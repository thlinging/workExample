<template>
  <a-modal
    :visible="visible"
    title="UEditor 弹窗（可拖拽 / 缩放 / 全屏）"
    :width="820"
    :footer="null"
    :mask-closable="false"
    :destroy-on-close="true"
    @cancel="close"
  >
    <!-- 三个自研指令均为 bare 用法、不传任何配置对象，全部走指令内置默认：
         v-resize-modal（缺省宽用 offsetWidth、缺省高延迟测量）、
         v-drag-modal（缺省从 .ant-modal-header 拖）、
         v-fullscreen-modal 只接一个响应式 boolean 触发（非配置对象） -->
    <div
      v-resize-modal
      v-drag-modal
      v-fullscreen-modal="isFullscreen"
      class="ueditor-modal-body"
    >
      <div class="modal-toolbar">
        <a-button size="small" @click="isFullscreen = !isFullscreen">
          {{ isFullscreen ? '退出全屏' : '全屏' }}
        </a-button>
        <span class="hint">标题栏拖动 · 右下角缩放 · 全屏切换（指令均为默认配置）</span>
      </div>

      <vue-ueditor-wrap
        v-model="content"
        :config="editorConfig"
        :editor-id="editorId"
        @ready="onReady"
      />
    </div>
  </a-modal>
</template>

<script>
export default {
  name: 'UEditorModal',
  model: { prop: 'visible', event: 'update:visible' },
  props: {
    visible: { type: Boolean, default: false }
  },
  data() {
    return {
      // 全屏开关：纯响应式 boolean，由按钮翻转，v-fullscreen-modal 负责进入/退出
      isFullscreen: false,
      content: '<p>UEditor 1.4.3 跑在自研<strong>可拖拽 / 缩放 / 全屏</strong>弹窗里。</p>',
      editorId: 'ueditor-modal-1',
      editorConfig: {
        UEDITOR_HOME_URL: 'https://cdn.jsdelivr.net/npm/baidu-ueditor@1.4.3/',
        serverUrl: '',
        initialFrameHeight: 260,
        autoHeightEnabled: false
      }
    }
  },
  watch: {
    visible(val) {
      // destroy-on-close 会重挂，关闭时把全屏状态归零
      if (!val) this.isFullscreen = false
    }
  },
  methods: {
    onReady(editor) {
      // UEditor 自带「全屏」用 viewport 坐标算绝对定位补偿（left/top = 负的当前视口坐标），
      // 前提是全屏容器的包含块就是视口。但 v-drag-modal 拖拽后会给 .ant-modal 留下 transform，
      // 而「有 transform 的祖先」会成为 position:absolute/fixed 后代的包含块 —— UEditor 的补偿
      // 于是被套到「已偏移的弹窗」上，编辑器和弹窗一起被甩出视口，只剩遮罩（表现为弹窗消失）。
      // 对策：必须在 UEditor 计算全屏定位之前清掉 transform，故用 beforefullscreenchange
      //（早于定位逻辑）清成 none；退出时在 fullscreenchanged 里还原到拖拽后的位置。
      // 注意：不能在 fullscreenchanged 里清——那时 UEditor 已带着 transform 算完补偿，反被甩飞。
      // 不拖拽时 transform 本就是 none，此逻辑无副作用。
      const getModalEl = () => editor.container && editor.container.closest('.ant-modal')
      editor.addListener('beforefullscreenchange', (type, enabled) => {
        const modalEl = getModalEl()
        if (modalEl && enabled) {
          this._savedTransform = modalEl.style.transform
          modalEl.style.transform = 'none'
        }
      })
      editor.addListener('fullscreenchanged', (type, enabled) => {
        const modalEl = getModalEl()
        if (modalEl && !enabled) {
          modalEl.style.transform = this._savedTransform || ''
          this._savedTransform = undefined
        }
      })
    },
    close() {
      this.$emit('update:visible', false)
    }
  }
}
</script>

<style scoped>
.ueditor-modal-body {
  height: 100%;
}
.modal-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.hint {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
</style>
