import confirm3 from './confirm3'

const Confirm3Plugin = {
  install(Vue) {
    Vue.prototype.$antConfirm3 = confirm3
  }
}

export { confirm3 }
export default Confirm3Plugin
