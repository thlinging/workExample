import Vue from 'vue'
import {
  Button,
  Layout,
  Menu,
  Icon,
  Row,
  Col,
  Space,
  Card,
  Form,
  FormModel,
  Input,
  InputNumber,
  Select,
  TreeSelect,
  Radio,
  DatePicker,
  Table,
  Tag,
  Modal,
  Drawer,
  Tabs,
  Tooltip,
  Pagination,
  Spin,
  Divider,
  Avatar,
  Badge,
  Alert,
  Switch,
  Checkbox,
  Slider,
  Progress,
  Steps,
  message,
  notification
} from 'ant-design-vue'

const components = [
  Button,
  Layout,
  Menu,
  Icon,
  Row,
  Col,
  Space,
  Card,
  Form,
  FormModel,
  Input,
  InputNumber,
  Select,
  TreeSelect,
  Radio,
  DatePicker,
  Table,
  Tag,
  Modal,
  Drawer,
  Tabs,
  Tooltip,
  Pagination,
  Spin,
  Divider,
  Avatar,
  Badge,
  Alert,
  Switch,
  Checkbox,
  Slider,
  Progress,
  Steps
]

components.forEach(component => {
  Vue.use(component)
})

message.config({
  duration: 2,
  maxCount: 3
})

Vue.prototype.$message = message
Vue.prototype.$notification = notification
Vue.prototype.$confirm = Modal.confirm
Vue.prototype.$info = Modal.info
Vue.prototype.$success = Modal.success
Vue.prototype.$error = Modal.error
Vue.prototype.$warning = Modal.warning
