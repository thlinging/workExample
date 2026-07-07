<template>
  <a-modal
    v-bind="$attrs"
    :visible="visible"
    :width="initialWidth"
    :wrap-class-name="composedWrapClass"
    v-on="$listeners"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]>
      <slot :name="slotName" />
    </template>
    <template
      v-for="(_, slotName) in $scopedSlots"
      #[slotName]="scope"
    >
      <slot :name="slotName" v-bind="scope" />
    </template>
  </a-modal>
</template>

<script>
import interact from 'interactjs'

let uid = 0

export default {
  name: 'AResizableModal',
  inheritAttrs: false,
  props: {
    visible: { type: Boolean, default: false },
    initialWidth: { type: Number, default: 520 },
    initialHeight: { type: Number, default: 400 },
    minWidth: { type: Number, default: 320 },
    minHeight: { type: Number, default: 200 },
    maxWidth: { type: Number, default: 99999 },
    maxHeight: { type: Number, default: 99999 },
    edges: {
      type: Object,
      default: () => ({ right: true, bottom: true, bottomRight: true })
    },
    handleMargin: { type: Number, default: 8 },
    showHandle: { type: Boolean, default: true }
  },
  data() {
    return {
      uniqueClass: `a-resizable-modal-${++uid}`,
      interactable: null,
      modalEl: null,
      contentEl: null,
      attachTimer: null
    }
  },
  computed: {
    composedWrapClass() {
      const extra = this.$attrs.wrapClassName || this.$attrs['wrap-class-name'] || ''
      const handle = this.showHandle ? 'a-resizable-modal--show-handle' : ''
      return [this.uniqueClass, 'a-resizable-modal-wrap', handle, extra]
        .filter(Boolean)
        .join(' ')
    }
  },
  watch: {
    visible: {
      immediate: true,
      handler(val) {
        if (val) {
          this.$nextTick(() => this.scheduleAttach())
        } else {
          this.detach()
        }
      }
    }
  },
  beforeDestroy() {
    this.detach()
  },
  methods: {
    scheduleAttach(retry = 0) {
      clearTimeout(this.attachTimer)
      const wrap = document.querySelector(`.${this.uniqueClass}`)
      const modal = wrap && wrap.querySelector('.ant-modal')
      const content = modal && modal.querySelector('.ant-modal-content')
      if (!modal || !content) {
        if (retry < 30) {
          this.attachTimer = setTimeout(() => this.scheduleAttach(retry + 1), 30)
        }
        return
      }
      this.attach(modal, content)
    },
    attach(modal, content) {
      this.detach()
      this.modalEl = modal
      this.contentEl = content
      modal.classList.add('a-resizable-modal-target')
      this.applySize(this.initialWidth, this.initialHeight)

      this.interactable = interact(content).resizable({
        edges: this.edges,
        margin: this.handleMargin,
        modifiers: [
          interact.modifiers.restrictSize({
            min: { width: this.minWidth, height: this.minHeight },
            max: { width: this.maxWidth, height: this.maxHeight }
          })
        ],
        listeners: {
          start: event => {
            this.$emit('resize-start', event.rect)
          },
          move: event => {
            const { width, height } = event.rect
            this.applySize(width, height)
            this.$emit('resize', { width, height })
          },
          end: event => {
            this.$emit('resize-end', event.rect)
          }
        }
      })
    },
    applySize(width, height) {
      if (!this.modalEl || !this.contentEl) return
      this.modalEl.style.width = width + 'px'
      this.contentEl.style.width = width + 'px'
      this.contentEl.style.height = height + 'px'
      const header = this.contentEl.querySelector('.ant-modal-header')
      const footer = this.contentEl.querySelector('.ant-modal-footer')
      const body = this.contentEl.querySelector('.ant-modal-body')
      if (body) {
        const headerH = header ? header.offsetHeight : 0
        const footerH = footer ? footer.offsetHeight : 0
        body.style.height = Math.max(0, height - headerH - footerH) + 'px'
        body.style.overflow = 'auto'
        body.style.boxSizing = 'border-box'
      }
    },
    detach() {
      clearTimeout(this.attachTimer)
      this.attachTimer = null
      if (this.interactable) {
        this.interactable.unset()
        this.interactable = null
      }
      if (this.modalEl) {
        this.modalEl.classList.remove('a-resizable-modal-target')
        this.modalEl = null
      }
      this.contentEl = null
    }
  }
}
</script>

<style>
.a-resizable-modal-target {
  padding-bottom: 0 !important;
}

.a-resizable-modal-target .ant-modal-content {
  position: relative;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}

.a-resizable-modal-target .ant-modal-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

.a-resizable-modal--show-handle .a-resizable-modal-target .ant-modal-content::after {
  content: '';
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 14px;
  height: 14px;
  cursor: nwse-resize;
  pointer-events: none;
  background-image: linear-gradient(
    135deg,
    transparent 0 5px,
    rgba(0, 0, 0, 0.35) 5px 6px,
    transparent 6px 8px,
    rgba(0, 0, 0, 0.35) 8px 9px,
    transparent 9px
  );
}
</style>
