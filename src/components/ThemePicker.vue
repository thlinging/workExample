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

export default {
  name: 'ThemePicker',
  data() {
    return {
      // 常用预设色（antd 官方色板主色）
      presets: ['#1890ff', '#52c41a', '#722ed1', '#f5222d', '#fa8c16', '#13c2c2', '#eb2f96'],
      current: ThemeManager.getPrimary()
    }
  },
  methods: {
    async pick(color) {
      await ThemeManager.changePrimary(color)
      this.current = color
      this.$emit('change', color)
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
