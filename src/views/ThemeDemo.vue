<template>
  <div class="theme-demo">
    <a-card title="换肤 · 手动切换主题色">
      <template #extra>
        <span class="tip">antd 换肤已暂时屏蔽，选色仅联动下方"自定义元素"部分</span>
      </template>

      <!-- 主题色选择器：预设 + 自定义取色 -->
      <theme-picker @change="onChange" />

      <a-divider />

      <!-- ① antd 组件：原由色值替换引擎驱动，引擎已暂时屏蔽，保持编译期默认色（丹红） -->
      <h4>antd 组件（换肤已屏蔽，不随选色变化）</h4>
      <a-space wrap>
        <a-button type="primary">主要按钮</a-button>
        <a-button type="primary" ghost>幽灵按钮</a-button>
        <a-button type="link">链接按钮</a-button>
        <a-button>默认按钮</a-button>
        <a-spin />
      </a-space>

      <div class="row">
        <a-radio-group v-model="radio">
          <a-radio value="a">选项 A</a-radio>
          <a-radio value="b">选项 B</a-radio>
          <a-radio value="c">选项 C</a-radio>
        </a-radio-group>
      </div>

      <div class="row">
        <a-input placeholder="聚焦看边框主色" style="width: 220px" />
        <a-select v-model="sel" style="width: 160px; margin-left: 12px">
          <a-select-option value="1">选项一</a-select-option>
          <a-select-option value="2">选项二</a-select-option>
        </a-select>
        <a-date-picker style="margin-left: 12px" />
      </div>

      <div class="row">
        <a-tabs default-active-key="1">
          <a-tab-pane key="1" tab="标签一">激活标签的下划线是主题色</a-tab-pane>
          <a-tab-pane key="2" tab="标签二">切换选色可看到它跟着变</a-tab-pane>
        </a-tabs>
      </div>

      <div class="row">
        <a-pagination :default-current="2" :total="50" />
      </div>

      <a-divider />

      <!-- ② 自定义业务元素：由 CSS 变量 var(--primary-color) 驱动 -->
      <h4>自定义元素（CSS 变量 var(--primary-color) 驱动）</h4>
      <a-space wrap>
        <span class="my-badge">自定义徽标</span>
        <span class="my-outline">描边块</span>
        <span class="my-link">自定义链接</span>
      </a-space>
    </a-card>
  </div>
</template>

<script>
import ThemePicker from '@/components/ThemePicker.vue'

export default {
  name: 'ThemeDemo',
  components: { ThemePicker },
  data() {
    return {
      radio: 'a',
      sel: '1'
    }
  },
  methods: {
    onChange(color) {
      this.$message.success(`主题色已切换为 ${color}`)
    }
  }
}
</script>

<style scoped>
.theme-demo {
  max-width: 900px;
}

.tip {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}

h4 {
  margin: 8px 0 12px;
  color: rgba(0, 0, 0, 0.85);
}

.row {
  margin-top: 16px;
}

/* 以下三个自定义元素完全靠 CSS 变量联动，不依赖 antd */
.my-badge {
  padding: 2px 10px;
  border-radius: 10px;
  color: #fff;
  background: var(--primary-color, #1890ff);
}

.my-outline {
  padding: 2px 10px;
  border-radius: 4px;
  color: var(--primary-color, #1890ff);
  border: 1px solid var(--primary-color, #1890ff);
}

.my-link {
  color: var(--primary-color, #1890ff);
  cursor: pointer;
  text-decoration: underline;
}
</style>
