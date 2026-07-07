<template>
  <a-modal
    :visible="visible"
    :width="resizeOpts.initialWidth"
    :mask-closable="false"
    :destroy-on-close="true"
    :body-style="{ padding: 0 }"
    ok-text="确定"
    cancel-text="取消"
    @ok="close"
    @cancel="close"
  >
    <!-- 标题栏放在 title 插槽：既是拖拽把手（drag 指令默认从 .ant-modal-header 拖），
         又把全屏按钮挪出 body，让 iframe 真正占满 body 100% -->
    <template slot="title">
      <span>内嵌 iframe 的可拖拽 / 可缩放弹窗</span>
      <a-button size="small" style="margin-left: 12px;" @click="isFullscreen = !isFullscreen">
        {{ isFullscreen ? '退出全屏' : '全屏' }}
      </a-button>
    </template>

    <!-- 指令挂在这个铺满 body 的容器上；iframe 宽高 100% 填满它 -->
    <div
      v-resize-modal="resizeOpts"
      v-drag-modal="dragOpts"
      v-fullscreen-modal="isFullscreen"
      class="iframe-modal-content"
    >
      <iframe class="demo-iframe" :srcdoc="iframeDoc"></iframe>
    </div>
  </a-modal>
</template>

<script>
export default {
  name: 'IframeDemoModal',
  model: { prop: 'visible', event: 'update:visible' },
  props: {
    visible: { type: Boolean, default: false }
  },
  data() {
    return {
      isFullscreen: false,
      resizeOpts: {
        initialWidth: 800,
        initialHeight: '70vh',
        minWidth: 360,
        minHeight: '30vh',
        maxHeight: '100vh'
      },
      dragOpts: {},
      // 用 srcdoc 内联一个独立文档：这是真正的嵌套 browsing context，
      // 能真实复现“指针移到 iframe 上方时事件被 iframe 文档接走”的场景，
      // 同时不依赖外网、也不受目标站点 X-Frame-Options 限制。
      iframeDoc: [
        '<!doctype html><html><head><meta charset="utf-8"><style>',
        'html,body{height:100%;margin:0}',
        'body{display:flex;align-items:center;justify-content:center;',
        'font-family:sans-serif;color:#555;background:#f0f5ff;',
        'background-image:linear-gradient(45deg,#e6f0ff 25%,transparent 25%),',
        'linear-gradient(-45deg,#e6f0ff 25%,transparent 25%);',
        'background-size:24px 24px;user-select:none}',
        '.box{text-align:center;padding:24px;border-radius:8px;background:#fff;',
        'box-shadow:0 2px 12px rgba(0,0,0,.08)}',
        '</style></head><body><div class="box">',
        '<h3>我是 iframe 内部文档</h3>',
        '<p>把弹窗拖动 / 缩放时，故意把鼠标甩到我这片区域再松手。</p>',
        '<p>修复后：松手即停，弹窗不再“粘”着继续动。</p>',
        '</div></body></html>'
      ].join('')
    }
  },
  watch: {
    visible(val) {
      if (!val) this.isFullscreen = false // destroy-on-close 重挂，状态归零
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
/* 容器铺满 body（body padding 已置 0），iframe 再 100% 填满容器 */
.iframe-modal-content {
  height: 100%;
}
.demo-iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}
</style>
