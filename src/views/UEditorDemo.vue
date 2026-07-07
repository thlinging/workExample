<template>
  <div class="ueditor-demo">
    <a-card class="panel" :bordered="false">
      <template #title>
        <span class="panel-title"><a-icon type="edit" /> UEditor 1.4.3 富文本编辑器</span>
      </template>
      <template #extra>
        <span class="panel-extra">vue-ueditor-wrap + CDN 加载</span>
      </template>

      <a-alert
        class="tip"
        type="info"
        show-icon
        message="UEditor 1.4.3.3（UTF8）静态资源经 jsdelivr CDN 加载；首次打开需联网拉取约 400KB。"
        description="UEditor 已停止维护，图片/附件上传需自备后端（serverUrl），此处仅演示纯前端富文本编辑与取值。"
      />

      <vue-ueditor-wrap
        v-model="content"
        :config="editorConfig"
        :editor-id="editorId"
        @ready="onReady"
      />

      <div class="actions">
        <a-button type="primary" @click="showHtml">获取内容 HTML</a-button>
        <a-button @click="setSample">填充示例内容</a-button>
        <a-tag v-if="ready" color="green">编辑器已就绪</a-tag>
        <a-tag v-else color="orange">加载中…</a-tag>
      </div>

      <div v-if="htmlPreview" class="preview">
        <div class="preview-label">v-model 当前值：</div>
        <pre class="preview-code">{{ htmlPreview }}</pre>
      </div>
    </a-card>
  </div>
</template>

<script>
export default {
  name: 'UEditorDemo',
  data() {
    return {
      content: '<p>在此输入内容，试试<strong>加粗</strong>、<em>斜体</em>、插入列表等。</p>',
      htmlPreview: '',
      ready: false,
      editorId: 'ueditor-demo-1',
      // UEDITOR_HOME_URL 必须以 / 结尾；指向构建好的 UEditor 1.4.3 UTF8 资源。
      editorConfig: {
        UEDITOR_HOME_URL: 'https://cdn.jsdelivr.net/npm/baidu-ueditor@1.4.3/',
        // 无后端上传服务，先留空避免 config 请求报错
        serverUrl: '',
        initialFrameHeight: 320,
        autoHeightEnabled: false
      }
    }
  },
  methods: {
    onReady() {
      this.ready = true
    },
    showHtml() {
      this.htmlPreview = this.content
    },
    setSample() {
      this.content =
        '<h2>UEditor 示例</h2><p>这是一段<strong>富文本</strong>，包含<span style="color:#e60000;">彩色文字</span>与列表：</p><ul><li>第一项</li><li>第二项</li></ul>'
    }
  }
}
</script>

<style scoped>
.ueditor-demo {
  max-width: 1080px;
  margin: 0 auto;
}
.panel {
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}
.panel-title {
  font-weight: 600;
}
.panel-extra {
  color: rgba(0, 0, 0, 0.45);
  font-size: 13px;
}
.tip {
  margin-bottom: 16px;
}
.actions {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.preview {
  margin-top: 16px;
}
.preview-label {
  color: rgba(0, 0, 0, 0.45);
  margin-bottom: 6px;
}
.preview-code {
  margin: 0;
  padding: 10px 12px;
  border-radius: 6px;
  background: #f5f5f5;
  color: rgba(0, 0, 0, 0.65);
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
