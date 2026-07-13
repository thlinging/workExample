import Vue from 'vue'
// 样式不引 lib/theme-chalk/index.css（那是写死默认蓝的成品），
// 而是引本项目的主题入口，编译期与 antd 共用 presets.js 的主题变量
import '@/theme/element-theme.scss'

// 注意：不能整包 Vue.use(ElementUI)——它会把 $message/$confirm/$notify 挂到
// Vue.prototype 上，覆盖掉 ant-design-vue.js 里已注册的同名方法。
// 因此按组件注册，且不注册 element 的弹层服务（Message/MessageBox/Notification）。
import {
  Button,
  Input,
  Select,
  Option,
  DatePicker,
  Switch,
  Tag,
  Radio,
  RadioGroup,
  Checkbox,
  CheckboxGroup,
  Pagination,
  Table,
  TableColumn,
  Slider,
  Link,
  Progress
} from 'element-ui'

const components = [
  Button,
  Input,
  Select,
  Option,
  DatePicker,
  Switch,
  Tag,
  Radio,
  RadioGroup,
  Checkbox,
  CheckboxGroup,
  Pagination,
  Table,
  TableColumn,
  Slider,
  Link,
  Progress
]

components.forEach(component => {
  Vue.use(component)
})
