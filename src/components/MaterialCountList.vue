<template>
  <div class="material-count-list">
    <div
      v-for="item in displayList"
      :key="item.field"
      class="mcl-item"
    >
      <span class="mcl-label">{{ item.label }}</span>

      <!-- 录入态：数字输入框，最小 0；缺省（formData 无值）显示 defaultValue（默认 0）。
           input-number 编辑时有独立内部态，可正常删空重填，不会被强行打回 -->
      <a-input-number
        v-if="!detail"
        class="mcl-input"
        :value="getNumber(item.field)"
        :min="0"
        @change="val => onInput(item.field, val)"
      />
      <!-- 详情态：份数用 a-tag 展示，颜色取 item.color，缺省 tagColor（默认蓝） -->
      <a-tag v-else class="mcl-tag" :color="item.color || tagColor">{{ getCount(item.field) }}</a-tag>

      <span class="mcl-unit">{{ item.unit || unit }}</span>

      <!-- 尾端插槽：内容完全交给使用者，组件只按 item.suffix 控制是否展示；
           透出该项配置与当前份数供插槽使用 -->
      <slot v-if="item.suffix" name="suffix" :item="item" :count="getCount(item.field)" />
    </div>

    <!-- 总计：showTotal && totalField 时展示。输入框两种模式都可编辑。
         totalSync=true —— 恒等于各项之和并实时写回 formData[totalField]，手输的值会自动回到求和值；
         totalSync=false —— 总计为独立手填字段，与各项不联动 -->
    <div v-if="showTotalRow" class="mcl-item mcl-total">
      <span class="mcl-label">{{ totalLabel }}</span>

      <a-input-number
        v-if="!detail"
        class="mcl-input"
        :value="getTotalNumber()"
        :min="0"
        @change="onTotalInput"
      />
      <a-tag v-else class="mcl-tag" :color="totalColor || tagColor">{{ getTotal() }}</a-tag>

      <span class="mcl-unit">{{ totalUnit }}</span>

      <!-- 总计专属尾端插槽：与各项的 #suffix 区分开，由 totalSuffix 开关控制是否展示；
           透出当前总计份数供插槽使用 -->
      <slot v-if="totalSuffix" name="total-suffix" :count="getTotal()" />
    </div>
  </div>
</template>

<script>
export default {
  name: 'MaterialCountList',
  // 用默认 v-model 双向绑定 formData：value 进、input 出
  model: {
    prop: 'value',
    event: 'input'
  },
  props: {
    // 双向绑定的份数表单对象，形如 { doc: '2', image: '3' }
    // 用法：v-model="formData"
    value: {
      type: Object,
      default: () => ({})
    },
    // 材料类型配置数组，每项 { field, label, unit?, color?, suffix? }
    //   field  —— 对应 formData 里的字段名（份数存这里）
    //   label  —— 展示名，如「文档」
    //   unit   —— 单位，缺省取全局 unit prop（默认「份」）
    //   color  —— 详情态份数 a-tag 颜色，缺省取全局 tagColor。
    //             支持 ant-design-vue 预设色名：pink / red / orange / green /
    //             cyan / blue / purple，以及 magenta / volcano / gold / lime /
    //             geekblue；也可传任意自定义色值（如 '#f50'）
    //   suffix —— 是否展示尾端 #suffix 插槽（true 才渲染该项插槽，内容由使用者提供）
    list: {
      type: Array,
      default: () => []
    },
    // 详情态：为 true 时输入框换成纯文本展示
    detail: {
      type: Boolean,
      default: false
    },
    // 全局默认单位，可被每项的 item.unit 覆盖
    unit: {
      type: String,
      default: '份'
    },
    // 详情态份数 a-tag 的默认颜色，可被每项的 item.color 覆盖
    // 取值同 list[].color：预设色名 pink/red/orange/green/cyan/blue/purple/
    // magenta/volcano/gold/lime/geekblue，或自定义色值
    tagColor: {
      type: String,
      default: 'blue'
    },
    // 缺省显示值：formData 里没有该字段时仅用于展示，不会写回 formData
    defaultValue: {
      type: [String, Number],
      default: '0'
    },
    // 是否展示末尾「总计」（还需配 totalField 才生效）
    showTotal: {
      type: Boolean,
      default: false
    },
    // 总计绑定的 formData 字段名，总数存这里，与各项一样双向更新
    totalField: {
      type: String,
      default: ''
    },
    // 总计展示名
    totalLabel: {
      type: String,
      default: '总计'
    },
    // 总计单位，默认「份」，可配置（独立于各项的 unit）
    totalUnit: {
      type: String,
      default: '份'
    },
    // 详情态总计 a-tag 颜色，缺省取全局 tagColor，取值同 list[].color
    totalColor: {
      type: String,
      default: ''
    },
    // 总计是否与各项联动：
    //   true  —— 总计恒等于各项之和，实时写回 formData[totalField]，用户不可手改
    //   false —— 总计为独立手填字段，与各项不联动（缺省）
    totalSync: {
      type: Boolean,
      default: false
    },
    // 是否展示总计专属尾端插槽 #total-suffix（与各项的 #suffix 区分开，true 才渲染）
    totalSuffix: {
      type: Boolean,
      default: false
    },
    // 详情态下：某项份数为 0 时是否隐藏该项（不展示这一行）。全局开关，对所有项生效。
    // 每项可用 item.hideZero（true/false）单独覆盖此全局值。
    // 仅作用于详情态；录入态始终展示，便于把 0 改成其他值。
    // 「为 0」以展示值计（Number(getCount)===0）：故 defaultValue 为非数字（如 '—'）时，
    // 缺省项不算 0、不会被隐藏。
    hideZeroInDetail: {
      type: Boolean,
      default: false
    },
    // 总计是否也遵循「为 0 时详情态隐藏」：
    //   缺省（undefined）—— 跟随全局 hideZeroInDetail（与各项一致）；
    //   true / false —— 单独控制总计（如各项隐藏 0 但总计想始终显示，传 false）。
    totalHideZero: {
      type: Boolean,
      default: undefined
    }
  },
  computed: {
    // 各项份数之和（非数字按 0 计）
    computedSum() {
      return this.sumOf(this.value)
    },
    // 实际渲染的项：录入态始终为完整 list；详情态下按开关过滤掉「为 0」的项。
    displayList() {
      if (!this.detail) return this.list
      return this.list.filter(item => !this.isHiddenZero(item))
    },
    // 是否渲染总计行：基础开关 showTotal && totalField；
    // 详情态下若「隐藏 0」生效且总计为 0，则一并隐藏（与各项同一套规则）。
    // 隐藏开关取 totalHideZero（若显式配置）否则跟随全局 hideZeroInDetail。
    showTotalRow() {
      if (!this.showTotal || !this.totalField) return false
      if (this.detail) {
        const hide = this.totalHideZero != null ? this.totalHideZero : this.hideZeroInDetail
        if (hide && Number(this.getTotal()) === 0) return false
      }
      return true
    }
  },
  methods: {
    // 取某字段用于展示的份数：formData 有值用其值，没有则回退 defaultValue（仅展示，不落库）
    // 仅用于详情态 a-tag 展示；录入态用 getInputValue 取真实值
    getCount(field) {
      const v = this.value ? this.value[field] : undefined
      return v === undefined || v === null || v === '' ? this.defaultValue : v
    },
    // 详情态下该项是否因「为 0」被隐藏：
    //   开关取 item.hideZero（若显式配置）否则全局 hideZeroInDetail；
    //   「为 0」按展示值判定（Number(getCount)===0），非数字缺省值不算 0。
    isHiddenZero(item) {
      const on = item.hideZero != null ? item.hideZero : this.hideZeroInDetail
      return on && Number(this.getCount(item.field)) === 0
    },
    // 录入态 input-number 取值：返回数字。formData 无值时回退 defaultValue（默认 0）展示，
    // 但该缺省值不写回 formData（只有 @change 真实改动才落库）
    getNumber(field) {
      const v = this.value ? this.value[field] : undefined
      if (v === undefined || v === null || v === '') {
        const d = Number(this.defaultValue)
        return isNaN(d) ? undefined : d
      }
      const n = Number(v)
      return isNaN(n) ? undefined : n
    },
    // 对给定表单对象按 list 字段求和，非数字/缺省按 0 计
    sumOf(form) {
      return this.list.reduce((acc, item) => {
        const n = Number(form ? form[item.field] : undefined)
        return acc + (isNaN(n) ? 0 : n)
      }, 0)
    },
    // 详情态总计文本：优先显示已存总数（保留手填值）；缺省时联动模式回退求和、否则回退 defaultValue
    getTotal() {
      const raw = this.value ? this.value[this.totalField] : undefined
      const hasRaw = !(raw === undefined || raw === null || raw === '')
      if (hasRaw) return raw
      return this.totalSync ? String(this.computedSum) : String(this.defaultValue)
    },
    // 录入态 input-number 总计数字：优先取已存真实值（手填值保留，不被求和拉回）；
    // 缺省时联动模式回退求和、否则回退 defaultValue
    getTotalNumber() {
      const v = this.value ? this.value[this.totalField] : undefined
      if (v === undefined || v === null || v === '') {
        const d = Number(this.totalSync ? this.computedSum : this.defaultValue)
        return isNaN(d) ? undefined : d
      }
      const n = Number(v)
      return isNaN(n) ? undefined : n
    },
    // 输入回写：不直接改 prop，emit 一个新对象保证响应式。val 为 input-number 给出的数字（清空为 null）。
    // 联动模式（totalSync）下，改各项时把最新求和写回 totalField，覆盖此前总计的手填值——「改前面修后面」
    onInput(field, val) {
      const next = { ...this.value, [field]: val }
      if (this.showTotal && this.totalField && this.totalSync) {
        next[this.totalField] = this.sumOf(next)
      }
      this.$emit('input', next)
      this.$emit('change', field, val)
    },
    // 总计手动录入：直接回写并保留手填值（联动模式也不拉回求和，直到下次改各项时才被重算覆盖）
    onTotalInput(val) {
      this.$emit('input', { ...this.value, [this.totalField]: val })
      this.$emit('change', this.totalField, val)
    }
  }
}
</script>

<style scoped>
.material-count-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
}

/* 单条材料：标签 + 输入框/文本 + 单位 横向排列 */
.mcl-item {
  display: inline-flex;
  align-items: center;
}

.mcl-label {
  margin-right: 8px;
  color: rgba(0, 0, 0, 0.85);
  white-space: nowrap;
}

.mcl-input {
  width: 50px;
}

/* 隐藏 input-number 的上下步进箭头，外观回归普通窄输入框 */
.mcl-input /deep/ .ant-input-number-handler-wrap {
  display: none;
}
/* 箭头隐藏后输入区不必为其留出右侧空间 */
.mcl-input /deep/ .ant-input-number-input {
  padding: 0 8px;
}

/* 详情态份数 tag：去圆角；右侧留白交给 .mcl-unit */
.mcl-tag {
  margin-right: 0;
  border-radius: 0;
  /* 字号默认 14px（antd a-tag 默认 12px，这里放大到与正文一致） */
  font-size: 14px;
  /* 左右内边距 6px（antd 默认 0 7px，这里收窄一点） */
  padding: 0 6px;
}

/* 单位颜色与 label 保持一致 */
.mcl-unit {
  margin-left: 6px;
  color: rgba(0, 0, 0, 0.85);
  white-space: nowrap;
}

/* 总计：与各项拉开一点间距 */
.mcl-total {
  margin-left: 4px;
  padding-left: 16px;
  border-left: 1px solid #f0f0f0;
}

/* 各项全被隐藏（如 hideZeroInDetail 下全部为 0）时，总计成为首个元素，
   去掉左侧分隔线与缩进，避免悬空的竖线和多余留白 */
.mcl-total:first-child {
  margin-left: 0;
  padding-left: 0;
  border-left: none;
}
</style>
