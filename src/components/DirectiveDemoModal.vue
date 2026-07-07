<template>
  <a-modal
    :visible="visible"
    :title="title"
    :width="resizeOpts.initialWidth"
    :mask-closable="false"
    :destroy-on-close="true"
    ok-text="确定"
    cancel-text="取消"
    @ok="close"
    @cancel="close"
  >
    <div
      v-resize-modal="resizeOpts"
      v-drag-modal="dragOpts"
      v-fullscreen-modal="isFullscreen"
      class="directive-modal-content"
    >
      <div style="margin-bottom: 12px;">
        <a-button @click="isFullscreen = !isFullscreen">
          {{ isFullscreen ? '退出全屏' : '全屏' }}
        </a-button>
        <span class="size-tip" style="margin-left: 8px;">
          全屏期间拖拽/缩放暂停，退出后恢复到全屏前的位置和大小（越界会自动钳回视口）
        </span>
      </div>
      <a-alert
        message="这是通过自定义指令 v-resize-modal 实现的可调整大小弹窗"
        type="info"
        show-icon
      />
      <p style="margin-top: 16px;">
        用法：把 <code>v-resize-modal</code> 加在弹窗内的任意元素上，指令会自动向上找到
        <code>.ant-modal-content</code> 并接入 interactjs。<br />
        指令以 <code>destroy-on-close</code> 配合使用，每次打开都会重新挂载、重置尺寸。
      </p>
      <p>请试着拖拽右下角调整窗口大小，或按住<b>标题栏</b>拖动整个弹窗（碰到屏幕边缘会停住）。</p>

      <a-divider style="margin: 12px 0;">按内容切换宽度（演示响应式跟随）</a-divider>
      <a-radio-group v-model="mode" button-style="solid">
        <a-radio-button value="compact">紧凑（480）</a-radio-button>
        <a-radio-button value="normal">常规（560）</a-radio-button>
        <a-radio-button value="wide">宽屏（820）</a-radio-button>
      </a-radio-group>
      <p style="margin-top: 12px;">{{ modeText }}</p>

      <p v-if="size" class="size-tip">
        当前尺寸：<b>{{ size.width }} × {{ size.height }}</b>
      </p>
      <p v-if="pos" class="size-tip">
        拖拽偏移：<b>x {{ pos.x }} / y {{ pos.y }}</b>
      </p>
    </div>
  </a-modal>
</template>

<script>
export default {
  name: 'DirectiveDemoModal',
  model: { prop: 'visible', event: 'update:visible' },
  props: {
    visible: { type: Boolean, default: false },
    title: { type: String, default: '指令版可调整弹窗' }
  },
  data() {
    return {
      size: null,
      mode: 'normal',
      // 全屏开关：纯响应式 boolean，由按钮翻转，指令负责进入/退出与 clamp
      isFullscreen: false,
      // 推荐写法：显式给指令传 initialWidth / initialHeight，并让 a-modal 的 :width
      // 与 initialWidth 保持一致。这样初始尺寸由指令直接接管，不依赖入场动画期间的
      // DOM 测量，弹窗一定按预期尺寸打开（避免“设宽高后打不开”的问题）。
      resizeOpts: {
        initialWidth: 560,
        // 高度可用 vh：指令内部会换算成 px，并在窗口尺寸变化时自动重算
        initialHeight: '70vh',
        minWidth: 360,
        // min/max 同样支持单位，拖拽时按当前视口实时换算
        minHeight: '30vh',
        maxHeight: '100vh',
        onResize: ({ width, height }) => {
          this.size = { width: Math.round(width), height: Math.round(height) }
        }
      },
      // 拖拽配置：默认从 .ant-modal-header 拖动，碰到视口边缘即停
      dragOpts: {
        onDrag: ({ x, y }) => {
          this.pos = { x: Math.round(x), y: Math.round(y) }
        }
      },
      pos: null
    }
  },
  computed: {
    modeText() {
      return {
        compact: '紧凑模式：内容较少，弹窗收窄到 480。',
        normal: '常规模式：默认宽度 560。',
        wide: '宽屏模式：内容较多（如表格/多列），弹窗放宽到 820。'
      }[this.mode]
    }
  },
  watch: {
    visible(val) {
      if (!val) {
        this.size = null
        this.pos = null
        this.isFullscreen = false // destroy-on-close 会重挂，状态归零
      }
    },
    // 业务逻辑改变宽度：只要改 resizeOpts.initialWidth，指令的 componentUpdated
    // 钩子就会响应并同步弹窗宽度（拖拽中的手动尺寸不受影响）。
    mode(val) {
      this.resizeOpts.initialWidth = { compact: 480, normal: 560, wide: 820 }[val]
    }
  },
  methods: {
    close() {
      this.$emit('update:visible', false)
    }
  }
}
</script>

<style scoped>
.directive-modal-content {
  height: 100%;
}
.size-tip {
  margin-top: 12px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
</style>
