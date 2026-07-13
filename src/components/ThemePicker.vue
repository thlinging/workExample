<template>
  <!-- 单系统换肤：用户在当前系统内手动选主题色。
       预设色板一键切换，或用原生取色器自定义任意颜色。 -->
  <div class="theme-picker">
    <span class="label">主题色：</span>

    <span
      v-for="c in presets"
      :key="c"
      class="swatch"
      :class="{ active: c.toLowerCase() === current.toLowerCase() }"
      :style="{ background: c }"
      :title="c"
      @click="pick(c)"
    >
      <a-icon v-if="c.toLowerCase() === current.toLowerCase()" type="check" />
    </span>

    <label class="custom" title="自定义颜色">
      <a-icon type="highlight" />
      <input type="color" :value="current" @change="pick($event.target.value)" />
    </label>

    <span class="current-hex">{{ current }}</span>
  </div>
</template>

<script>
import ThemeManager from '@/theme/ThemeManager'

// 白色文字/图标（主按钮文字、dark 标签、步骤数字…）与主题色的对比度。
// 换肤靠色值替换，白字是"钉死"的：主色一旦偏浅，白字白图标就糊在主色底上。
// 阈值 2.0：现有两个预设（丹红/深红）均 >2 通过，黄/浅色会 <2 触发提醒。
const MIN_WHITE_CONTRAST = 2.0
function whiteContrast(hex) {
  const c = String(hex).replace('#', '')
  const n = c.length === 3 ? c.split('').map(x => x + x).join('') : c
  const chan = i => {
    const v = parseInt(n.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  const L = 0.2126 * chan(0) + 0.7152 * chan(2) + 0.0722 * chan(4)
  return 1.05 / (L + 0.05) // 白色相对亮度=1，对比度=(1+0.05)/(L+0.05)
}

export default {
  name: 'ThemePicker',
  data() {
    return {
      // 常用预设色（首个为系统默认深薄荷，其余为 antd 官方色板便捷取色，供演示对比）
      presets: ['#00b48a', '#f12b25', '#1890ff', '#52c41a', '#722ed1', '#fa8c16', '#13c2c2'],
      current: ThemeManager.getPrimary()
    }
  },
  methods: {
    async pick(color) {
      // 临时预览：不持久化。离开 /theme 由路由守卫 reset() 恢复默认深薄荷。
      await ThemeManager.preview(color)
      this.current = color
      this.$emit('change', color)
      if (whiteContrast(color) < MIN_WHITE_CONTRAST && this.$message) {
        this.$message.warning('主题色偏浅：白色文字/图标（主按钮、dark 标签、步骤数字等）可能对比不足')
      }
    }
  }
}
</script>

<style scoped>
.theme-picker {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.label {
  color: rgba(0, 0, 0, 0.65);
}

.swatch {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06) inset;
  transition: transform 0.15s;
}

.swatch:hover {
  transform: scale(1.12);
}

.swatch.active {
  box-shadow: 0 0 0 2px #fff inset, 0 0 0 3px currentColor;
}

.custom {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed rgba(0, 0, 0, 0.25);
  position: relative;
  color: rgba(0, 0, 0, 0.45);
}

/* 原生取色器隐形铺满，只保留点击热区 */
.custom input[type='color'] {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.current-hex {
  margin-left: 4px;
  font-family: 'Courier New', monospace;
  color: rgba(0, 0, 0, 0.45);
}
</style>
