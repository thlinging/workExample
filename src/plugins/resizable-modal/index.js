import ResizableModal from './ResizableModal.vue'

const ResizableModalPlugin = {
  install(Vue, options = {}) {
    const name = options.name || ResizableModal.name
    Vue.component(name, ResizableModal)
  }
}

export { ResizableModal }
export default ResizableModalPlugin
