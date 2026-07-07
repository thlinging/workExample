<template>
  <div class="dual-date-range">
    <!-- 粒度切换 -->
    <a-select
      :value="mode"
      class="ddr-mode"
      @change="onModeChange"
    >
      <a-select-option value="year">按年</a-select-option>
      <a-select-option value="month">按年月</a-select-option>
      <a-select-option value="date">按年月日</a-select-option>
    </a-select>

    <!-- 开始：$attrs 透传 antd DatePicker 其它属性（allowClear/size/disabled...） -->
    <a-date-picker
      v-if="mode === 'year'"
      v-bind="$attrs"
      class="ddr-picker"
      mode="year"
      :format="format"
      :value="startMoment"
      :placeholder="startPh"
      :open="startOpen"
      :disabled-date="disabledStart"
      @openChange="o => (startOpen = o)"
      @panelChange="onStartPanelSelect"
      @change="onStartChange"
    />
    <!-- 按年月：用 a-date-picker mode=month（而非 a-month-picker）才有面板顶部手输框 -->
    <a-date-picker
      v-else-if="mode === 'month'"
      v-bind="$attrs"
      class="ddr-picker"
      mode="month"
      :format="format"
      :value="startMoment"
      :placeholder="startPh"
      :open="startOpen"
      :disabled-date="disabledStart"
      @openChange="o => (startOpen = o)"
      @panelChange="onStartPanelSelect"
      @change="onStartChange"
    >
      <template #default="{ value }">
        <a-input
          readonly
          class="ddr-trigger-input"
          :placeholder="startPh"
          :value="outerText(value)"
        >
          <a-icon
            v-if="value && showClearIcon"
            slot="suffix"
            type="close-circle"
            theme="filled"
            class="ddr-trigger-clear"
            @click.native.stop="onStartChange(null)"
          />
          <a-icon
            v-else-if="!value && showCalendarIcon"
            slot="suffix"
            type="calendar"
          />
        </a-input>
      </template>
    </a-date-picker>
    <a-date-picker
      v-else
      v-bind="$attrs"
      class="ddr-picker"
      :format="format"
      :value="startMoment"
      :placeholder="startPh"
      :disabled-date="disabledStart"
      @change="onStartChange"
    >
      <!-- 覆盖触发框：面板显示 YYYYMMDD，这里强制显示 YYYY-MM-DD -->
      <template #default="{ value }">
        <a-input
          readonly
          class="ddr-trigger-input"
          :placeholder="startPh"
          :value="outerText(value)"
        >
          <a-icon
            v-if="value && showClearIcon"
            slot="suffix"
            type="close-circle"
            theme="filled"
            class="ddr-trigger-clear"
            @click.native.stop="onStartChange(null)"
          />
          <a-icon
            v-else-if="!value && showCalendarIcon"
            slot="suffix"
            type="calendar"
          />
        </a-input>
      </template>
    </a-date-picker>

    <span class="ddr-sep">~</span>

    <!-- 结束 -->
    <a-date-picker
      v-if="mode === 'year'"
      v-bind="$attrs"
      class="ddr-picker"
      mode="year"
      :format="format"
      :value="endMoment"
      :placeholder="endPh"
      :open="endOpen"
      :disabled-date="disabledEnd"
      @openChange="o => (endOpen = o)"
      @panelChange="onEndPanelSelect"
      @change="onEndChange"
    />
    <!-- 按年月：用 a-date-picker mode=month（而非 a-month-picker）才有面板顶部手输框 -->
    <a-date-picker
      v-else-if="mode === 'month'"
      v-bind="$attrs"
      class="ddr-picker"
      mode="month"
      :format="format"
      :value="endMoment"
      :placeholder="endPh"
      :open="endOpen"
      :disabled-date="disabledEnd"
      @openChange="o => (endOpen = o)"
      @panelChange="onEndPanelSelect"
      @change="onEndChange"
    >
      <template #default="{ value }">
        <a-input
          readonly
          class="ddr-trigger-input"
          :placeholder="endPh"
          :value="outerText(value)"
        >
          <a-icon
            v-if="value && showClearIcon"
            slot="suffix"
            type="close-circle"
            theme="filled"
            class="ddr-trigger-clear"
            @click.native.stop="onEndChange(null)"
          />
          <a-icon
            v-else-if="!value && showCalendarIcon"
            slot="suffix"
            type="calendar"
          />
        </a-input>
      </template>
    </a-date-picker>
    <a-date-picker
      v-else
      v-bind="$attrs"
      class="ddr-picker"
      :format="format"
      :value="endMoment"
      :placeholder="endPh"
      :disabled-date="disabledEnd"
      @change="onEndChange"
    >
      <!-- 覆盖触发框：面板显示 YYYYMMDD，这里强制显示 YYYY-MM-DD -->
      <template #default="{ value }">
        <a-input
          readonly
          class="ddr-trigger-input"
          :placeholder="endPh"
          :value="outerText(value)"
        >
          <a-icon
            v-if="value && showClearIcon"
            slot="suffix"
            type="close-circle"
            theme="filled"
            class="ddr-trigger-clear"
            @click.native.stop="onEndChange(null)"
          />
          <a-icon
            v-else-if="!value && showCalendarIcon"
            slot="suffix"
            type="calendar"
          />
        </a-input>
      </template>
    </a-date-picker>
  </div>
</template>

<script>
import moment from 'moment'

// 各粒度的「显示格式」：数组首项用于触发框显示/失焦回填；
// 其余项是面板顶部手输框能接受的紧凑写法（moment 数组严格解析逐个试）。
// 例：date 粒度下用户可在面板里敲 20240615，触发框仍显示 2024-06-15。
const FORMATS = {
  year: ['YYYY'],
  // month/date 首项=紧凑写法：面板顶部手输框默认显示/回填成 202406 / 20240615；
  // 触发框另用默认插槽强制显示带横线（见模板 #default），面板与触发框两边解耦。
  month: ['YYYYMM', 'YYYY-MM'],
  date: ['YYYYMMDD', 'YYYY-MM-DD']
}
// 对外 emit 值 + 回显的「规范格式」：始终带横线，与显示首项保持一致
const VALUE_FORMATS = { year: 'YYYY', month: 'YYYY-MM', date: 'YYYY-MM-DD' }
const UNITS = { year: 'year', month: 'month', date: 'day' }
// 回显反推用：严格匹配（strict 模式逐个试），同时兼容带横线与紧凑 YYYYMMDD 写法
const PARSE_FORMATS = ['YYYY-MM-DD', 'YYYY-MM', 'YYYY', 'YYYYMMDD', 'YYYYMM']

export default {
  name: 'DualDateRangePicker',
  // 关闭默认 attr 继承，改为手动透传给两个内部 picker
  inheritAttrs: false,
  props: {
    // 两端各自的双向绑定值（格式化字符串，类型由格式承载以支持自动回显）
    // 用法：:start-value.sync="x" :end-value.sync="y"
    //   "2024" -> 按年，"2024-06" -> 按年月，"2024-06-15" -> 按年月日
    startValue: {
      type: String,
      default: null
    },
    endValue: {
      type: String,
      default: null
    },
    // 初始粒度：year | month | date（无回显值时使用）
    defaultMode: {
      type: String,
      default: 'date'
    },
    // 占位符可覆盖；为空时按粒度给默认值
    startPlaceholder: {
      type: String,
      default: ''
    },
    endPlaceholder: {
      type: String,
      default: ''
    },
    // 触发框右侧两个图标的显隐（仅作用于 month/date 自定义触发框）：
    //   有值时显示的清除图标 / 无值时显示的日历图标
    showClearIcon: {
      type: Boolean,
      default: true
    },
    showCalendarIcon: {
      type: Boolean,
      default: true
    }
  },
  data() {
    return {
      // 初始粒度：优先按回显值的格式自动反推，无值则用 defaultMode
      mode:
        this.detectMode(this.startValue) ||
        this.detectMode(this.endValue) ||
        this.defaultMode,
      // 年模式下需要受控 open，靠 panelChange 取值后手动关闭
      startOpen: false,
      endOpen: false
    }
  },
  computed: {
    // 比较粒度：同年/同月/同日视为相等，允许开始===结束
    compareUnit() {
      return UNITS[this.mode]
    },
    format() {
      return FORMATS[this.mode]
    },
    // 字符串 -> moment，喂给内部 picker
    startMoment() {
      return this.toMoment(this.startValue)
    },
    endMoment() {
      return this.toMoment(this.endValue)
    },
    startPh() {
      return (
        this.startPlaceholder ||
        { year: '开始年份', month: '开始年月', date: '开始日期' }[this.mode]
      )
    },
    endPh() {
      return (
        this.endPlaceholder ||
        { year: '结束年份', month: '结束年月', date: '结束日期' }[this.mode]
      )
    }
  },
  watch: {
    // 外部异步回填（如详情接口后到）时，按新值的格式自动纠正粒度
    startValue: 'syncModeFromValue',
    endValue: 'syncModeFromValue'
  },
  methods: {
    // 按字符串格式反推粒度：纯函数，data() 阶段即可调用
    // 同时兼容带横线与紧凑写法：2024→年；2024-06/202406→年月；2024-06-15/20240615→年月日
    detectMode(str) {
      if (!str) return null
      if (/^\d{4}$/.test(str)) return 'year'
      if (/^\d{4}-?\d{2}$/.test(str)) return 'month'
      return 'date'
    },
    toMoment(str) {
      if (!str) return null
      const m = moment(str, PARSE_FORMATS, true)
      return m.isValid() ? m : null
    },
    syncModeFromValue() {
      const m = this.detectMode(this.startValue) || this.detectMode(this.endValue)
      if (m && m !== this.mode) {
        this.mode = m
        this.$emit('update:mode', m)
      }
    },
    // 开始框：禁用晚于结束值的日期（按当前粒度比较）
    disabledStart(current) {
      if (!current || !this.endMoment) return false
      return current.isAfter(this.endMoment, this.compareUnit)
    },
    // 结束框：禁用早于开始值的日期
    disabledEnd(current) {
      if (!current || !this.startMoment) return false
      return current.isBefore(this.startMoment, this.compareUnit)
    },
    // 内部 picker 给的是 moment，对外回流统一为格式化字符串
    onStartChange(val) {
      const str = this.fmt(val)
      this.$emit('update:startValue', str)
      this.$emit('change', this.buildPayload(str, this.endValue))
    },
    onEndChange(val) {
      const str = this.fmt(val)
      this.$emit('update:endValue', str)
      this.$emit('change', this.buildPayload(this.startValue, str))
    },
    // 年/月模式：受控 open，点击年份或月份只会触发 panelChange（不触发 change），
    // 在这里取值并手动关闭面板；面板顶部输入框手输则另走 @change。
    onStartPanelSelect(value) {
      this.startOpen = false
      this.onStartChange(value)
    },
    onEndPanelSelect(value) {
      this.endOpen = false
      this.onEndChange(value)
    },
    onModeChange(mode) {
      this.mode = mode
      this.startOpen = false
      this.endOpen = false
      // 粒度变化后旧值的格式/禁用逻辑都不再适用，清空两端
      this.$emit('update:startValue', null)
      this.$emit('update:endValue', null)
      this.$emit('update:mode', mode)
      this.$emit('change', this.buildPayload(null, null))
    },
    // moment -> 当前粒度的规范字符串（始终带横线，与 valueFormat 风格统一）
    fmt(v) {
      return v ? v.format(VALUE_FORMATS[this.mode]) : null
    },
    // month/date 触发框插槽专用：moment -> 当前粒度带横线显示串（与面板紧凑格式解耦）
    outerText(v) {
      return v ? v.format(VALUE_FORMATS[this.mode]) : ''
    },
    // change 事件载荷：格式化字符串 + moment 原值（start/end 已是字符串）
    buildPayload(start, end) {
      return {
        mode: this.mode,
        start: start || null,
        end: end || null,
        startMoment: this.toMoment(start),
        endMoment: this.toMoment(end)
      }
    }
  }
}
</script>

<style scoped>
.dual-date-range {
  display: flex;
  align-items: center;
  width: 100%;
}

/* 粒度选择固定宽度，不参与平分 */
.ddr-mode {
  flex: 0 0 96px;
  width: 96px;
  margin-right: 8px;
}

/* 两个日期框平分父容器去掉下拉与分隔符后的剩余宽度，并设下限防止过窄 */
.ddr-picker {
  flex: 1 1 0;
  min-width: 110px;
}

/* date 触发框：自定义插槽 a-input 充满 picker 宽度 */
.ddr-trigger-input {
  width: 100%;
}

/* 清除图标平时是次要色，hover 变深，贴近原生 picker 体验 */
.ddr-trigger-clear {
  color: rgba(0, 0, 0, 0.25);
  cursor: pointer;
}

.ddr-trigger-clear:hover {
  color: rgba(0, 0, 0, 0.45);
}

.ddr-sep {
  flex: 0 0 auto;
  margin: 0 8px;
  color: rgba(0, 0, 0, 0.45);
  user-select: none;
}
</style>
