<template>
  <div class="theme-demo">
    <!-- ── 控制台：选色 + 自检 ───────────────────────────── -->
    <section class="console">
      <div class="console__intro">
        <h1 class="console__title">主题换肤演示</h1>
        <p class="console__desc">
          运行时换肤已启用 —— ant-design-vue、element-ui 与自定义元素随选色实时联动
        </p>
      </div>
      <div class="console__actions">
        <theme-picker @change="onChange" />
        <a-tooltip title="排查换色后宽泛规则盖掉白字/透明边框的级联误伤，结果输出到控制台">
          <a-button class="audit-btn" @click="runAudit">级联自检</a-button>
        </a-tooltip>
      </div>
    </section>

    <!-- ── ant-design-vue ───────────────────────────────── -->
    <section class="lib">
      <header class="lib__head">
        <span class="lib__badge">ant-design-vue</span>
        <span class="lib__ver">v1.7.8</span>
        <span class="lib__line"></span>
      </header>

      <div class="blocks">
        <div class="block">
          <div class="block__label">按钮</div>
          <div class="block__body">
            <a-button type="primary">主要按钮</a-button>
            <a-button type="primary" ghost>幽灵按钮</a-button>
            <a-button type="dashed">虚线按钮</a-button>
            <a-button type="link">链接按钮</a-button>
            <a-button>默认按钮</a-button>
            <a-button type="primary" disabled>禁用</a-button>
          </div>
          <p class="block__note">默认按钮悬浮描边变主色；链接按钮悬浮无边框</p>
        </div>

        <div class="block">
          <div class="block__label">开关 / 复选 / 单选 / 可选标签</div>
          <div class="block__body">
            <a-switch v-model="antd.switch" />
            <a-checkbox v-model="antd.checked">已勾选</a-checkbox>
            <a-radio-group v-model="antd.radio">
              <a-radio value="a">选项 A</a-radio>
              <a-radio value="b">选项 B</a-radio>
            </a-radio-group>
            <a-radio-group v-model="antd.radioBtn" button-style="solid">
              <a-radio-button value="x">单选 X</a-radio-button>
              <a-radio-button value="y">单选 Y</a-radio-button>
            </a-radio-group>
            <a-checkable-tag v-model="antd.tagChecked">可选标签</a-checkable-tag>
          </div>
        </div>

        <div class="block">
          <div class="block__label">输入 / 选择 / 日期</div>
          <div class="block__body block__body--stack">
            <a-input class="demo-ctrl" placeholder="聚焦看边框主色" />
            <a-select v-model="antd.sel" class="demo-ctrl">
              <a-select-option value="1">选项一</a-select-option>
              <a-select-option value="2">选项二</a-select-option>
            </a-select>
            <a-date-picker class="demo-ctrl" />
          </div>
          <p class="block__note">聚焦时边框与日期面板“今天”为主色</p>
        </div>

        <div class="block">
          <div class="block__label">滑块 / 进度</div>
          <div class="block__body block__body--stack">
            <a-slider v-model="antd.slider" />
            <a-progress :percent="60" />
          </div>
        </div>

        <div class="block">
          <div class="block__label">分页</div>
          <div class="block__body">
            <a-pagination :default-current="2" :total="50" size="small" />
          </div>
        </div>

        <div class="block">
          <div class="block__label">菜单 · 横向</div>
          <div class="block__body block__body--stack">
            <a-menu mode="horizontal" :selected-keys="['1']">
              <a-menu-item key="1">选中项</a-menu-item>
              <a-menu-item key="2">菜单项</a-menu-item>
              <a-menu-item key="3">菜单项</a-menu-item>
            </a-menu>
          </div>
          <p class="block__note">选中项文字与下划线为主色</p>
        </div>

        <div class="block">
          <div class="block__label">菜单 · 深色 inline（换肤高危）</div>
          <div class="block__body block__body--stack">
            <a-menu mode="inline" theme="dark" :selected-keys="['1']" :default-open-keys="['sub']">
              <a-menu-item key="1">选中项（主色底）</a-menu-item>
              <a-sub-menu key="sub">
                <span slot="title">子菜单</span>
                <a-menu-item key="2">子项一</a-menu-item>
                <a-menu-item key="3">子项二</a-menu-item>
              </a-sub-menu>
            </a-menu>
          </div>
          <p class="block__note">深色菜单 hover/选中文字须保持白色（顶栏同款高危）</p>
        </div>

        <div class="block">
          <div class="block__label">徽标 / 加载 / 提示</div>
          <div class="block__body block__body--stack">
            <a-space wrap>
              <a-badge status="processing" text="processing 状态" />
              <a-badge :count="5" />
              <a-spin />
            </a-space>
            <a-alert message="info 提示（功能色，勿被主色劫持）" type="info" show-icon />
          </div>
          <p class="block__note">processing 圆点随主色变；info 提示保持功能蓝</p>
        </div>

        <div class="block block--wide">
          <div class="block__label">标签页</div>
          <div class="block__body block__body--stack">
            <a-tabs default-active-key="1">
              <a-tab-pane key="1" tab="标签一">激活标签的文字和下划线是主题色。</a-tab-pane>
              <a-tab-pane key="2" tab="标签二">切换选色可看到它跟着变。</a-tab-pane>
            </a-tabs>
          </div>
        </div>

        <div class="block block--wide">
          <div class="block__label">步骤条</div>
          <div class="block__body block__body--stack">
            <a-steps :current="1" size="small">
              <a-step title="已完成" />
              <a-step title="进行中" description="圈内数字白字" />
              <a-step title="待处理" />
            </a-steps>
          </div>
        </div>
      </div>
    </section>

    <!-- ── element-ui ───────────────────────────────────── -->
    <section class="lib">
      <header class="lib__head">
        <span class="lib__badge">element-ui</span>
        <span class="lib__ver">v2.15.12</span>
        <span class="lib__line"></span>
      </header>

      <div class="blocks">
        <div class="block block--wide">
          <div class="block__label">按钮</div>
          <div class="block__body">
            <el-button type="primary">主要按钮</el-button>
            <el-button type="success">成功按钮</el-button>
            <el-button type="warning">警告按钮</el-button>
            <el-button type="danger">危险按钮</el-button>
            <el-button type="info">信息按钮</el-button>
            <el-button>默认按钮</el-button>
            <el-button type="primary" plain>朴素主按钮</el-button>
            <el-button type="primary" round>圆角按钮</el-button>
            <el-button type="text">文字按钮</el-button>
            <el-button type="primary" class="is-active">is-active 主按钮</el-button>
            <el-button type="success" class="is-active">is-active 成功</el-button>
            <el-button type="primary" disabled>禁用</el-button>
          </div>
          <p class="block__note">
            只有主按钮随主色变，成功 / 警告 / 危险 / 信息保持功能色；悬浮、按下、is-active 时主按钮文字须保持白色
          </p>
        </div>

        <div class="block block--wide">
          <div class="block__label">标签 · 换肤高危区</div>
          <div class="block__body">
            <el-tag closable>默认标签</el-tag>
            <el-tag effect="dark" closable>dark 标签</el-tag>
            <el-tag effect="plain" closable>plain 标签</el-tag>
            <el-tag type="success" effect="dark">成功 dark</el-tag>
            <el-tag type="warning">警告</el-tag>
            <el-tag type="danger" effect="plain">危险 plain</el-tag>
          </div>
          <p class="block__note">dark 白字不丢、plain 白底不染、关闭键悬浮反白、功能色标签不被主色劫持</p>
        </div>

        <div class="block">
          <div class="block__label">开关 / 复选 / 单选 / 链接</div>
          <div class="block__body">
            <el-switch v-model="el.switch" />
            <el-checkbox v-model="el.checked">已勾选</el-checkbox>
            <el-radio v-model="el.radio" label="a">选项 A</el-radio>
            <el-radio v-model="el.radio" label="b">选项 B</el-radio>
            <el-link type="primary" href="javascript:;">主色链接</el-link>
          </div>
        </div>

        <div class="block">
          <div class="block__label">输入 / 选择 / 日期</div>
          <div class="block__body block__body--stack">
            <el-input class="demo-ctrl" placeholder="聚焦看边框主色" />
            <el-select v-model="el.sel" class="demo-ctrl">
              <el-option label="选项一" value="1" />
              <el-option label="选项二" value="2" />
            </el-select>
            <el-date-picker v-model="el.date" class="demo-ctrl" type="date" placeholder="选日期" />
          </div>
        </div>

        <div class="block">
          <div class="block__label">滑块 / 进度</div>
          <div class="block__body block__body--stack">
            <el-slider v-model="el.slider" />
            <el-progress :percentage="60" />
          </div>
        </div>

        <div class="block">
          <div class="block__label">分页 · 背景模式</div>
          <div class="block__body block__body--stack">
            <el-pagination background layout="prev, pager, next" :total="50" :current-page="2" />
          </div>
          <p class="block__note">当前页为主色底</p>
        </div>

        <div class="block block--wide">
          <div class="block__label">表格 · 点击行高亮</div>
          <div class="block__body block__body--stack">
            <el-table :data="el.tableData" highlight-current-row border size="small">
              <el-table-column prop="name" label="名称" width="120" />
              <el-table-column prop="desc" label="说明" />
            </el-table>
          </div>
          <p class="block__note">高亮行背景 = 主色最浅档 light-9，随主色跟随变化</p>
        </div>
      </div>
    </section>

    <!-- ── 自定义元素 ───────────────────────────────────── -->
    <section class="lib">
      <header class="lib__head">
        <span class="lib__badge lib__badge--plain">自定义元素</span>
        <span class="lib__ver">CSS 变量 var(--primary-color) 驱动</span>
        <span class="lib__line"></span>
      </header>

      <div class="blocks">
        <div class="block">
          <div class="block__label">徽标 / 描边 / 链接</div>
          <div class="block__body">
            <span class="my-badge">自定义徽标</span>
            <span class="my-outline">描边块</span>
            <span class="my-link">自定义链接</span>
          </div>
          <p class="block__note">不依赖任何 UI 库，纯 CSS 变量联动</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import ThemePicker from '@/components/ThemePicker.vue'
import auditThemeOverrides from '@/theme/themeAudit'

export default {
  name: 'ThemeDemo',
  components: { ThemePicker },
  data() {
    return {
      antd: {
        switch: true,
        checked: true,
        radio: 'a',
        radioBtn: 'x',
        tagChecked: true,
        slider: 40,
        sel: '1'
      },
      el: {
        switch: true,
        checked: true,
        radio: 'a',
        slider: 40,
        sel: '1',
        date: new Date(),
        tableData: [
          { name: '行一', desc: '点我看高亮行背景（light-9）' },
          { name: '行二', desc: '换主色后高亮色应跟着变' },
          { name: '行三', desc: '——' }
        ]
      }
    }
  },
  methods: {
    onChange(color) {
      this.$message.success(`主题色已切换为 ${color}`)
    },
    runAudit() {
      const result = auditThemeOverrides()
      if (!result.ran) {
        this.$message.info(result.reason)
      } else if (result.findings.length) {
        this.$message.warning(`发现 ${result.findings.length} 处疑似级联误伤，明细见控制台（console.table）`)
      } else {
        this.$message.success('未发现级联误伤（覆盖面=当前页面的组件）')
      }
    }
  }
}
</script>

<style scoped>
.theme-demo {
  width: 100%;
  padding: 8px 4px 48px;
  color: var(--m-charcoal);
}

/* ── 控制台 ───────────────────────────────────────── */
.console {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 20px 40px;
  padding: 24px 28px;
  border-radius: var(--m-r-xl);
  overflow: hidden;
  background: var(--m-canvas);
  border: 1px solid var(--m-hairline);
  box-shadow: none;
}

/* 左侧主色装饰条：跟随主题色 */
.console::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--primary-color, #1890ff);
}

.console__title {
  margin: 0 0 6px;
  font-size: 28px;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.5px;
  color: var(--m-ink);
}

.console__desc {
  margin: 0;
  font-size: 14px;
  color: var(--m-steel);
}

.console__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

/* ── 库分区 ───────────────────────────────────────── */
.lib {
  margin-top: 32px;
}

.lib__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.lib__badge {
  flex: none;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2px;
  padding: 4px 14px;
  border-radius: var(--m-r-md);
  color: var(--m-ink);
  background: var(--m-surface);
  border: 1px solid var(--m-hairline);
}

.lib__badge--plain {
  color: var(--m-steel);
}

.lib__ver {
  flex: none;
  font-size: 12px;
  font-family: var(--m-font-mono);
  color: var(--m-stone);
}

.lib__line {
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, var(--m-hairline), transparent);
}

/* ── 区块网格 ─────────────────────────────────────── */
.blocks {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  /* stretch：同一行的卡片拉伸到最高者，高度对齐 */
  align-items: stretch;
}

.block {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 20px;
  overflow: hidden;
  background: var(--m-canvas);
  border: 1px solid var(--m-hairline);
  border-radius: var(--m-r-lg);
  box-shadow: none;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}

.block:hover {
  border-color: var(--m-mint);
  box-shadow: var(--m-shadow-2);
}

.block--wide {
  grid-column: 1 / -1;
}

.block__label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--m-ink);
}

.block__label::before {
  content: '';
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--primary-color, #1890ff);
}

.block__body {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

/* 表单类：纵向铺开、拉伸占满，避免窄卡片里被挤出边界 */
.block__body--stack {
  flex-direction: column;
  align-items: stretch;
}

.block__note {
  /* 锚到卡片底部：等高拉伸后多出的空高落在说明之上，说明作为“页脚”对齐 */
  margin: auto 0 0;
  padding-top: 2px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--m-steel);
}

/* 输入类控件在区块内自适应，最宽 260 */
.demo-ctrl {
  width: 100%;
  max-width: 260px;
}

/* ── 自定义元素（CSS 变量驱动）────────────────────── */
.my-badge {
  padding: 3px 12px;
  border-radius: 10px;
  color: #fff;
  background: var(--primary-color, #1890ff);
}

.my-outline {
  padding: 3px 12px;
  border-radius: 6px;
  color: var(--primary-color, #1890ff);
  border: 1px solid var(--primary-color, #1890ff);
}

.my-link {
  color: var(--primary-color, #1890ff);
  cursor: pointer;
  text-decoration: underline;
}
</style>
